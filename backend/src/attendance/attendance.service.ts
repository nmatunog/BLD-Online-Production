import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { MemberLookupService } from '../common/services/member-lookup.service';
import { CheckInMethod, EventStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getCheckInSessionSlotsForEvent } from '../common/utils/event-checkin-session-slots.util';
import { getEventStaffAccess } from '../common/utils/event-staff-access.util';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private memberLookup: MemberLookupService,
  ) {}

  async checkIn(
    createAttendanceDto: CreateAttendanceDto,
    userId: string,
    userRole: UserRole,
  ) {
    // Verify event exists and is active
    const event = await this.prisma.event.findUnique({
      where: { id: createAttendanceDto.eventId },
      select: {
        id: true,
        ministry: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        status: true,
        location: true,
        venue: true,
        category: true,
        isRecurring: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const canonicalEvent = await this.findCanonicalDuplicateEvent(event.id);
    if (canonicalEvent && canonicalEvent.id !== event.id) {
      throw new ConflictException({
        code: 'DUPLICATE_EVENT_CANONICAL',
        message: 'This event is a duplicate slot. Please check in to the canonical event instead.',
        canonicalEvent: {
          id: canonicalEvent.id,
          title: canonicalEvent.title,
          startDate: canonicalEvent.startDate,
          startTime: canonicalEvent.startTime,
          location: canonicalEvent.location,
          venue: canonicalEvent.venue,
        },
      });
    }

    // Check if event is ongoing or upcoming
    const now = new Date();
    const eventStartDate = new Date(event.startDate);
    const eventEndDate = new Date(event.endDate);

    // Interpret event date+time as Asia/Manila (UTC+8) so server timezone doesn't block check-in
    const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
    const toManilaAsUtc = (d: Date, hours: number, minutes: number) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0) - MANILA_OFFSET_MS);

    const [startHours, startMinutes] = event.startTime
      ? (event.startTime.split(':').map((p, i) => (i === 0 ? parseInt(p, 10) : parseInt(p || '0', 10))) as [number, number])
      : [0, 0];
    const actualEventStartDateTime = toManilaAsUtc(eventStartDate, startHours, startMinutes);

    const [endHours, endMinutes] = event.endTime
      ? (event.endTime.split(':').map((p, i) => (i === 0 ? parseInt(p, 10) : parseInt(p || '0', 10))) as [number, number])
      : [23, 59];
    const actualEventEndDateTime = toManilaAsUtc(eventEndDate, endHours, endMinutes);

    // Calculate 2 hours before event start
    const twoHoursBeforeStart = new Date(actualEventStartDateTime.getTime() - 2 * 60 * 60 * 1000);

    // Recurring events (e.g. Community Worship) allow check-in within 7 days after event end
    const recurringCategories = ['Community Worship', 'Word Sharing Circle'];
    const categoryRecurring =
      event.category &&
      (recurringCategories.includes(event.category) ||
        ['Corporate Worship', 'Corporate Worship (Weekly Recurring)'].includes(event.category));
    const isRecurring = event.isRecurring === true || categoryRecurring === true;
    const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
    const sevenDaysAfterEnd = new Date(actualEventEndDateTime.getTime() + MS_7_DAYS);

    // Check if trying to check in too early (more than 2 hours before start) — skip for past recurring within window
    const isCompletedRecurringWithinWindow =
      event.status === 'COMPLETED' && isRecurring && now > actualEventEndDateTime && now <= sevenDaysAfterEnd;
    if (!isCompletedRecurringWithinWindow && now < twoHoursBeforeStart) {
      // Format the acceptable check-in time for the error message
      const opts: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      };
      const acceptableTime = twoHoursBeforeStart.toLocaleString('en-US', opts);
      const eventStartTime = actualEventStartDateTime.toLocaleString('en-US', opts);
      throw new BadRequestException(
        `Check-in is only available 2 hours before the event starts. Please check in at ${acceptableTime} (Event starts at ${eventStartTime})`,
      );
    }

    // Block check-in after event end; recurring events get 7 days after end
    if (actualEventEndDateTime < now) {
      if (isRecurring && now <= sevenDaysAfterEnd) {
        // Allow: recurring event within 7 days after end
      } else if (isRecurring && now > sevenDaysAfterEnd) {
        throw new BadRequestException(
          'Check-in for this event is only available within 7 days after it ended.',
        );
      } else {
        throw new BadRequestException('Event has already ended');
      }
    }

    // Verify member exists and is active
    const member = await this.prisma.member.findUnique({
      where: { id: createAttendanceDto.memberId },
      include: { user: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (!member.user.isActive) {
      throw new BadRequestException('Member account is inactive');
    }

    // Check permissions: Members can only check themselves in unless they are ministry staff for this event
    if (userRole === UserRole.MEMBER) {
      const currentUserMember = await this.prisma.member.findUnique({
        where: { userId },
      });
      const isSelfCheckIn = !!currentUserMember && currentUserMember.id === createAttendanceDto.memberId;

      if (!isSelfCheckIn) {
        const staffAccess = await getEventStaffAccess(this.prisma, userId, {
          id: event.id,
          ministry: event.ministry,
        });
        if (!staffAccess.allowed) {
          throw new ForbiddenException(staffAccess.reason || 'You can only check yourself in');
        }
      }
    }

    // Check if already checked in (same member + event + session slot)
    const sessionSlot = (createAttendanceDto.sessionSlot ?? '').trim();
    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        memberId: createAttendanceDto.memberId,
        eventId: createAttendanceDto.eventId,
        sessionSlot,
      },
    });

    if (existingAttendance) {
      throw new ConflictException('Member is already checked in to this event session');
    }

    // Create attendance record
    const attendance = await this.prisma.attendance.create({
      data: {
        memberId: createAttendanceDto.memberId,
        eventId: createAttendanceDto.eventId,
        sessionSlot,
        method: createAttendanceDto.method || CheckInMethod.MANUAL,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            location: true,
            venue: true,
          },
        },
      },
    });

    return attendance;
  }

  async checkInByQR(
    communityId: string,
    eventId: string,
    userId: string,
    userRole: UserRole,
  ) {
    // Lookup member by Community ID
    const member = await this.memberLookup.findByCommunityId(communityId);

    // Create attendance DTO
    const createDto: CreateAttendanceDto = {
      memberId: member.id,
      eventId,
      method: CheckInMethod.QR_CODE,
    };

    return this.checkIn(createDto, userId, userRole);
  }

  async publicCheckIn(communityId: string, eventId: string) {
    // Lookup member by Community ID
    const member = await this.memberLookup.findByCommunityId(communityId);

    // Create attendance DTO
    const createDto: CreateAttendanceDto = {
      memberId: member.id,
      eventId,
      method: CheckInMethod.QR_CODE,
    };

    // For public check-in, we use the member's userId and MEMBER role
    // This allows the member to check themselves in without being logged in
    // The checkIn method will validate that the userId matches the member's userId
    return this.checkIn(createDto, member.userId, UserRole.MEMBER);
  }

  async findAll(query: AttendanceQueryDto) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {};

    if (query.eventId) {
      where.eventId = query.eventId;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.communityId) {
      const member = await this.memberLookup.findByCommunityId(query.communityId);
      where.memberId = member.id;
    }

    if (query.dateFrom || query.dateTo) {
      where.checkInTime = {};
      if (query.dateFrom) {
        where.checkInTime.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.checkInTime.lte = new Date(query.dateTo);
      }
    }

    if (query.eventStatus) {
      where.event = {
        status: query.eventStatus,
      };
    }

    const sortBy = query.sortBy || 'checkInTime';
    const sortOrder = query.sortOrder || 'desc';

    const orderBy: Prisma.AttendanceOrderByWithRelationInput = {};
    if (sortBy === 'checkedInAt' || sortBy === 'checkInTime') {
      orderBy.checkInTime = sortOrder;
    } else if (sortBy === 'memberName') {
      orderBy.member = {
        lastName: sortOrder,
      };
    } else if (sortBy === 'eventTitle') {
      orderBy.event = {
        title: sortOrder,
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          member: {
            include: {
              user: {
                select: {
                  email: true,
                  phone: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              location: true,
              venue: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const attendances = await this.prisma.attendance.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });

    return attendances;
  }

  async findByMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const attendances = await this.prisma.attendance.findMany({
      where: { memberId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            location: true,
            venue: true,
            status: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });

    return attendances;
  }

  async findMe(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    return this.findByMember(member.id);
  }

  async getMemberByUserId(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    return member;
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    // Members can only remove their own check-ins
    if (userRole === UserRole.MEMBER) {
      const member = await this.getMemberByUserId(userId);
      if (attendance.memberId !== member.id) {
        throw new ForbiddenException('You can only remove your own check-ins');
      }
    }

    await this.prisma.attendance.delete({
      where: { id },
    });

    return attendance;
  }

  async getEventStats(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const [total, qrCodeCount, manualCount] = await Promise.all([
      this.prisma.attendance.count({
        where: { eventId },
      }),
      this.prisma.attendance.count({
        where: {
          eventId,
          method: CheckInMethod.QR_CODE,
        },
      }),
      this.prisma.attendance.count({
        where: {
          eventId,
          method: CheckInMethod.MANUAL,
        },
      }),
    ]);

    return {
      total,
      qrCodeCount,
      manualCount,
    };
  }

  private async findCanonicalDuplicateEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || !event.startTime) return null;

    const manilaDayKey = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

    const eventDayKey = manilaDayKey(new Date(event.startDate));
    const title = (event.title || '').trim().toLowerCase();
    const category = (event.category || '').trim().toLowerCase();
    const ministry = (event.ministry || '').trim().toLowerCase();
    const venue = (event.venue || '').trim().toLowerCase();

    const candidates = await this.prisma.event.findMany({
      where: {
        id: { not: event.id },
        isRecurring: true,
        title: event.title,
        category: event.category,
        startTime: event.startTime,
        venue: event.venue || null,
        status: { in: [EventStatus.UPCOMING, EventStatus.ONGOING, EventStatus.COMPLETED] },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        startTime: true,
        location: true,
        venue: true,
        ministry: true,
        category: true,
        createdAt: true,
      },
    });

    const sameSlot = candidates.filter((e) => {
      const sameDay = manilaDayKey(new Date(e.startDate)) === eventDayKey;
      const sameTitle = (e.title || '').trim().toLowerCase() === title;
      const sameCategory = (e.category || '').trim().toLowerCase() === category;
      const eMinistry = (e.ministry || '').trim().toLowerCase();
      const eVenue = (e.venue || '').trim().toLowerCase();
      const sameMinistry = eMinistry === ministry;
      const sameVenue = eVenue === venue;
      return sameDay && sameTitle && sameCategory && sameMinistry && sameVenue;
    });

    if (sameSlot.length === 0) return null;

    const all = [
      {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        startTime: event.startTime,
        location: event.location,
        venue: event.venue,
        createdAt: event.createdAt,
      },
      ...sameSlot,
    ];

    all.sort((a, b) => {
      const byCreated = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (byCreated !== 0) return byCreated;
      return a.id.localeCompare(b.id);
    });

    return all[0];
  }

  /**
   * Build a clean, flat attendance roster for a specific event.
   *
   * Designed for the staff-facing "Download Attendance Roster" button on the
   * candidate quick check-in page: one row per recorded check-in, joining the
   * Member's identity (Community ID, name, encounter, class) with the
   * EventCandidate's roster context (class group, candidate class label) and
   * the human-readable AM/PM session label.
   */
  async getEventAttendanceRoster(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const attendances = await this.prisma.attendance.findMany({
      where: { eventId },
      include: {
        member: {
          select: {
            id: true,
            communityId: true,
            firstName: true,
            lastName: true,
            encounterType: true,
            classNumber: true,
            ministry: true,
            apostolate: true,
            user: { select: { phone: true, email: true } },
          },
        },
      },
    });

    // Pull EventCandidate rows so we can attach class group / candidate class label
    // to attendees who came in via the seeded candidate flow.
    const candidates = await this.prisma.eventCandidate.findMany({
      where: { eventId, memberId: { not: null } },
      select: {
        memberId: true,
        candidateClass: true,
        classGroup: true,
        familyName: true,
        firstName: true,
        cleanMobile: true,
        mobileNumber: true,
      },
    });
    const candidateByMemberId = new Map<
      string,
      (typeof candidates)[number]
    >();
    for (const c of candidates) {
      if (c.memberId) candidateByMemberId.set(c.memberId, c);
    }

    const sessionOptions = getCheckInSessionSlotsForEvent(event);
    const sessionLabelByValue = new Map(sessionOptions.map((s) => [s.value, s.label]));

    const manilaTimeFormatter = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const rows = attendances
      .map((a) => {
        const cand = candidateByMemberId.get(a.memberId);
        const sessionLabel =
          sessionLabelByValue.get(a.sessionSlot) ||
          (a.sessionSlot ? a.sessionSlot : 'Single check-in');
        return {
          attendanceId: a.id,
          memberId: a.memberId,
          communityId: a.member.communityId,
          familyName: a.member.lastName,
          firstName: a.member.firstName,
          encounterType: a.member.encounterType,
          classNumber: a.member.classNumber,
          ministry: a.member.ministry || null,
          apostolate: a.member.apostolate || null,
          // Candidate-flow context (only present for attendees who came in via the seeded list)
          candidateClass: cand?.candidateClass || null,
          classGroup: cand?.classGroup || null,
          mobileNumber:
            cand?.cleanMobile || cand?.mobileNumber || a.member.user?.phone || null,
          email: a.member.user?.email || null,
          sessionSlot: a.sessionSlot,
          sessionLabel,
          checkInTimeIso: a.checkInTime.toISOString(),
          checkInTimeManila: manilaTimeFormatter.format(a.checkInTime),
          method: a.method,
        };
      })
      // Stable, human-friendly ordering: session first, then family/first name.
      .sort((a, b) => {
        if (a.sessionSlot < b.sessionSlot) return -1;
        if (a.sessionSlot > b.sessionSlot) return 1;
        const fam = a.familyName.localeCompare(b.familyName);
        if (fam !== 0) return fam;
        return a.firstName.localeCompare(b.firstName);
      });

    const totalsBySession: Record<string, number> = {};
    for (const r of rows) {
      totalsBySession[r.sessionSlot] = (totalsBySession[r.sessionSlot] || 0) + 1;
    }

    return {
      eventId: event.id,
      eventTitle: event.title,
      eventStartDate: event.startDate.toISOString(),
      eventEndDate: event.endDate.toISOString(),
      sessions: sessionOptions,
      totalsBySession,
      totalRows: rows.length,
      uniqueMembers: new Set(rows.map((r) => r.memberId)).size,
      generatedAt: new Date().toISOString(),
      rows,
    };
  }
}


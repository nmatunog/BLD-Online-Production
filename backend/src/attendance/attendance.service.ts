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
import { CheckInMethod, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

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
    });

    if (!event) {
      throw new NotFoundException('Event not found');
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

    // Completed recurring events (e.g. Community Worship) are available for check-in anytime
    const isCompletedRecurring = event.status === 'COMPLETED' && event.isRecurring === true;

    // Check if trying to check in too early (more than 2 hours before start) — skip for completed recurring
    if (!isCompletedRecurring && now < twoHoursBeforeStart) {
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

    // Block check-in after event end, except for completed recurring events (check-in anytime)
    if (!isCompletedRecurring && actualEventEndDateTime < now) {
      throw new BadRequestException('Event has already ended');
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

    // Check permissions: Members can only check themselves in
    // For public check-in, the userId is the member's own userId, so this check will pass
    if (userRole === UserRole.MEMBER) {
      const currentUserMember = await this.prisma.member.findUnique({
        where: { userId },
      });
      // Allow if it's the member checking themselves in (userId matches member's userId)
      if (currentUserMember && currentUserMember.id !== createAttendanceDto.memberId) {
        throw new ForbiddenException('You can only check yourself in');
      }
    }

    // Check if already checked in
    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        memberId: createAttendanceDto.memberId,
        eventId: createAttendanceDto.eventId,
      },
    });

    if (existingAttendance) {
      throw new ConflictException('Member is already checked in to this event');
    }

    // Create attendance record
    const attendance = await this.prisma.attendance.create({
      data: {
        memberId: createAttendanceDto.memberId,
        eventId: createAttendanceDto.eventId,
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
}


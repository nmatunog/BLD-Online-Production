import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { AssignClassShepherdDto } from './dto/assign-class-shepherd.dto';
import { CancelEventDto } from './dto/cancel-event.dto';
import { Prisma, EventStatus, UserRole, EventAuditAction } from '@prisma/client';
import QRCode from 'qrcode';
import { BunnyCDNService } from '../common/services/bunnycdn.service';
import { MINISTRIES_BY_APOSTOLATE } from '../common/constants/organization.constants';

/** Number of weeks ahead to auto-create recurring occurrence rows */
const RECURRING_OCCURRENCE_WEEKS_AHEAD = 24;

/** Monday 00:00:00 UTC for the week containing d */
function getStartOfWeekUTC(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday = 1
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Sunday 23:59:59.999 UTC for the week containing d */
function getEndOfWeekUTC(d: Date): Date {
  const start = getStartOfWeekUTC(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Serialize event to JSON for audit snapshot (dates to ISO string, Decimal to number) */
function eventToSnapshot(event: {
  id: string;
  title: string;
  eventType: string;
  category: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  location: string;
  venue?: string | null;
  status: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const snap: Record<string, unknown> = {
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    category: event.category,
    description: event.description ?? null,
    startDate: event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate,
    endDate: event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    location: event.location,
    venue: event.venue ?? null,
    status: event.status,
    hasRegistration: event.hasRegistration ?? false,
    registrationFee: event.registrationFee != null ? Number(event.registrationFee) : null,
    maxParticipants: event.maxParticipants ?? null,
    encounterType: event.encounterType ?? null,
    classNumber: event.classNumber ?? null,
    ministry: event.ministry ?? null,
    isRecurring: event.isRecurring ?? false,
    recurrencePattern: event.recurrencePattern ?? null,
    recurrenceDays: event.recurrenceDays ?? [],
    recurrenceInterval: event.recurrenceInterval ?? null,
    monthlyType: event.monthlyType ?? null,
    monthlyDayOfMonth: event.monthlyDayOfMonth ?? null,
    monthlyWeekOfMonth: event.monthlyWeekOfMonth ?? null,
    monthlyDayOfWeek: event.monthlyDayOfWeek ?? null,
    recurrenceTemplateId: event.recurrenceTemplateId ?? null,
    cancellationReason: event.cancellationReason ?? null,
  };
  return snap;
}

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private bunnyCDN: BunnyCDNService,
  ) {}

  async create(createEventDto: CreateEventDto, createdById?: string) {
    // Validate dates and times
    const startDate = new Date(createEventDto.startDate);
    const endDate = new Date(createEventDto.endDate);

    // Combine date with time if time is provided
    let actualStartDateTime = new Date(startDate);
    let actualEndDateTime = new Date(endDate);

    if (createEventDto.startTime) {
      // Parse time string (handles both "HH:MM" and "HH:MM:SS" formats)
      const timeParts = createEventDto.startTime.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      actualStartDateTime = new Date(startDate);
      actualStartDateTime.setHours(hours, minutes, 0, 0);
    }

    if (createEventDto.endTime) {
      // Parse time string (handles both "HH:MM" and "HH:MM:SS" formats)
      const timeParts = createEventDto.endTime.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      actualEndDateTime = new Date(endDate);
      actualEndDateTime.setHours(hours, minutes, 0, 0);
    }

    // Validate that end datetime is after start datetime
    if (actualStartDateTime >= actualEndDateTime) {
      throw new BadRequestException('End date/time must be after start date/time');
    }

    // Validate ministry if provided (must be a known ministry)
    if (createEventDto.ministry?.trim()) {
      const allMinistries = Object.values(MINISTRIES_BY_APOSTOLATE).flat();
      if (!allMinistries.some((m) => m === createEventDto.ministry?.trim())) {
        throw new BadRequestException(
          `Ministry must be one of: ${allMinistries.slice(0, 5).join(', ')}...`,
        );
      }
    }

    // Validate recurring event configuration
    if (createEventDto.isRecurring) {
      if (!createEventDto.recurrencePattern) {
        throw new BadRequestException('Recurrence pattern is required for recurring events');
      }

      if (createEventDto.recurrencePattern === 'weekly' && (!createEventDto.recurrenceDays || createEventDto.recurrenceDays.length === 0)) {
        throw new BadRequestException('Recurrence days are required for weekly recurring events');
      }

      if (createEventDto.recurrencePattern === 'monthly' && !createEventDto.monthlyType) {
        throw new BadRequestException('Monthly type is required for monthly recurring events');
      }
    }

    // Create event
    const event = await this.prisma.event.create({
      data: {
        title: createEventDto.title,
        eventType: createEventDto.eventType,
        category: createEventDto.category,
        description: createEventDto.description || null,
        startDate,
        endDate,
        startTime: createEventDto.startTime || null,
        endTime: createEventDto.endTime || null,
        location: createEventDto.location,
        venue: createEventDto.venue || null,
        status: createEventDto.status || EventStatus.UPCOMING,
        hasRegistration: createEventDto.hasRegistration || false,
        registrationFee: createEventDto.registrationFee ? createEventDto.registrationFee : null,
        maxParticipants: createEventDto.maxParticipants || null,
        encounterType: createEventDto.encounterType || null,
        classNumber: createEventDto.classNumber || null,
        isRecurring: createEventDto.isRecurring || false,
        recurrencePattern: createEventDto.recurrencePattern || null,
        recurrenceDays: createEventDto.recurrenceDays || [],
        recurrenceInterval: createEventDto.recurrenceInterval || null,
        monthlyType: createEventDto.monthlyType || null,
        monthlyDayOfMonth: createEventDto.monthlyDayOfMonth || null,
        monthlyWeekOfMonth: createEventDto.monthlyWeekOfMonth || null,
        monthlyDayOfWeek: createEventDto.monthlyDayOfWeek || null,
        ministry: createEventDto.ministry?.trim() || null,
        createdById: createdById || null,
      },
      include: {
        _count: {
          select: {
            attendances: true,
            registrations: true,
          },
        },
      },
    });

    // Generate QR code
    if (event.id) {
      await this.generateQRCode(event.id);
    }

    // Audit log (CREATE)
    if (createdById) {
      const user = await this.prisma.user.findUnique({ where: { id: createdById }, select: { email: true, phone: true } });
      const userEmail = user?.email ?? user?.phone ?? null;
      await this.prisma.eventAuditLog.create({
        data: {
          eventId: event.id,
          action: EventAuditAction.CREATE,
          userId: createdById,
          userEmail: userEmail ?? undefined,
          previousSnapshot: Prisma.JsonNull,
          changedFields: Prisma.JsonNull,
        },
      });
    }

    // Auto-create future occurrence rows in background so create response returns quickly (avoids timeout)
    if (event.isRecurring && !event.recurrenceTemplateId) {
      void this.generateRecurringOccurrences(event.id, RECURRING_OCCURRENCE_WEEKS_AHEAD).catch((err) => {
        console.error('[EventsService] generateRecurringOccurrences failed:', err);
      });
    }

    return event;
  }

  /**
   * Generate future occurrence rows for a recurring template.
   * Each occurrence is a copy of the template with that week's startDate/endDate and recurrenceTemplateId set.
   */
  async generateRecurringOccurrences(templateId: string, weeksAhead: number = RECURRING_OCCURRENCE_WEEKS_AHEAD): Promise<number> {
    const template = await this.prisma.event.findUnique({
      where: { id: templateId, isRecurring: true, recurrenceTemplateId: null },
    });
    if (!template) return 0;

    const pattern = (template.recurrencePattern || '').toLowerCase();
    const recurrenceDays = (template.recurrenceDays || []).map((d) => String(d).toLowerCase());
    const interval = template.recurrenceInterval ?? 1;

    const templateStart = new Date(template.startDate);
    const templateEnd = new Date(template.endDate);
    const durationMs = templateEnd.getTime() - templateStart.getTime();

    const now = new Date();
    let count = 0;

    if (pattern === 'weekly' && recurrenceDays.length > 0) {
      // Day of week: 0 = Sunday, 1 = Monday, ... 6 = Saturday
      const dayNumbers = recurrenceDays.map((d) => {
        const map: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
        };
        return map[d] ?? 1;
      });

      const weekStart = getStartOfWeekUTC(templateStart > now ? templateStart : now);

      for (let w = 0; w < weeksAhead; w++) {
        const baseWeek = new Date(weekStart);
        baseWeek.setUTCDate(baseWeek.getUTCDate() + w * 7 * interval);

        for (const dayNum of dayNumbers) {
          const occStart = new Date(baseWeek);
          occStart.setUTCDate(baseWeek.getUTCDate() + (dayNum === 0 ? 6 : dayNum - 1));
          occStart.setUTCHours(
            templateStart.getUTCHours(),
            templateStart.getUTCMinutes(),
            templateStart.getUTCSeconds(),
            templateStart.getUTCMilliseconds(),
          );
          if (occStart < now) continue;

          const occEnd = new Date(occStart.getTime() + durationMs);

          const existing = await this.prisma.event.findFirst({
            where: {
              recurrenceTemplateId: templateId,
              startDate: { gte: new Date(occStart.getTime() - 1000), lte: new Date(occStart.getTime() + 1000) },
            },
          });
          if (existing) continue;

          await this.prisma.event.create({
            data: {
              title: template.title,
              eventType: template.eventType,
              category: template.category,
              description: template.description,
              startDate: occStart,
              endDate: occEnd,
              startTime: template.startTime,
              endTime: template.endTime,
              location: template.location,
              venue: template.venue,
              status: occEnd < now ? EventStatus.COMPLETED : occStart <= now && occEnd >= now ? EventStatus.ONGOING : EventStatus.UPCOMING,
              hasRegistration: template.hasRegistration,
              registrationFee: template.registrationFee,
              maxParticipants: template.maxParticipants,
              encounterType: template.encounterType,
              classNumber: template.classNumber,
              ministry: template.ministry,
              isRecurring: true,
              recurrencePattern: template.recurrencePattern,
              recurrenceDays: template.recurrenceDays,
              recurrenceInterval: template.recurrenceInterval,
              monthlyType: template.monthlyType,
              monthlyDayOfMonth: template.monthlyDayOfMonth,
              monthlyWeekOfMonth: template.monthlyWeekOfMonth,
              monthlyDayOfWeek: template.monthlyDayOfWeek,
              recurrenceTemplateId: templateId,
            },
          });
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Ensure all recurring templates have future occurrence rows. Call after deploy or periodically.
   * Super User only.
   */
  async ensureRecurringOccurrencesForAllTemplates(weeksAhead: number = RECURRING_OCCURRENCE_WEEKS_AHEAD): Promise<{ templatesProcessed: number; occurrencesCreated: number }> {
    const templates = await this.prisma.event.findMany({
      where: { isRecurring: true, recurrenceTemplateId: null },
      select: { id: true },
    });
    let totalCreated = 0;
    for (const t of templates) {
      totalCreated += await this.generateRecurringOccurrences(t.id, weeksAhead);
    }
    return { templatesProcessed: templates.length, occurrencesCreated: totalCreated };
  }

  async findAll(
    query: EventQueryDto,
    user?: { role: string; ministry?: string },
  ) {
    // Automatically update event statuses based on current date/time
    await this.updateEventStatuses();

    const {
      search,
      status,
      eventType,
      category,
      startDateFrom,
      startDateTo,
      sortBy = 'startDate',
      sortOrder = 'asc',
      page = 1,
      limit = 50,
      includeAllMinistryEvents,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EventWhereInput = {};

    // Ministry visibility: default = general (ministry null) + user's ministry only. Admin/Super can include all.
    const canSeeAllMinistryEvents =
      user?.role === UserRole.SUPER_USER ||
      user?.role === UserRole.ADMINISTRATOR ||
      user?.role === UserRole.DCS;
    if (!canSeeAllMinistryEvents || !includeAllMinistryEvents) {
      // General events (no ministry) + events for user's ministry only
      const ministryFilter: Prisma.EventWhereInput[] = [
        { ministry: null },
        { ministry: '' },
      ];
      if (user?.ministry) {
        ministryFilter.push({ ministry: user.ministry });
      }
      const andClauses: Prisma.EventWhereInput[] = Array.isArray(where.AND)
        ? [...where.AND]
        : where.AND
          ? [where.AND]
          : [];
      andClauses.push({ OR: ministryFilter });
      where.AND = andClauses;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (category) {
      where.category = category;
    }

    if (startDateFrom || startDateTo) {
      where.startDate = {};
      if (startDateFrom) {
        where.startDate.gte = new Date(startDateFrom);
      }
      if (startDateTo) {
        where.startDate.lte = new Date(startDateTo);
      }
    }

    // Normal users: only events within this week (recurring occurrences) OR all non-recurring events. Super User sees all via super/all.
    const isSuperUser = user?.role === UserRole.SUPER_USER;
    if (!isSuperUser && user) {
      const startOfWeek = getStartOfWeekUTC(new Date());
      const endOfWeek = getEndOfWeekUTC(new Date());
      const visibilityClause: Prisma.EventWhereInput = {
        OR: [
          { recurrenceTemplateId: { not: null }, startDate: { gte: startOfWeek, lte: endOfWeek } },
          { isRecurring: false },
        ],
      };
      const andClauses: Prisma.EventWhereInput[] = Array.isArray(where.AND) ? [...where.AND] : where.AND ? [where.AND] : [];
      andClauses.push(visibilityClause);
      where.AND = andClauses;
    }

    // Build orderBy
    const orderBy: Prisma.EventOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'title':
        orderBy.title = sortOrder;
        break;
      case 'createdAt':
        orderBy.createdAt = sortOrder;
        break;
      case 'startDate':
      default:
        orderBy.startDate = sortOrder;
        break;
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              attendances: true,
              registrations: true,
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
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

  /**
   * Super User only: return all events (recurring and non-recurring), no status/ministry filter.
   * Includes creator (who created and when) for cleanup/audit.
   */
  async findAllForSuperUser() {
    await this.updateEventStatuses();
    const data = await this.prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { attendances: true, registrations: true },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            phone: true,
            member: {
              select: {
                firstName: true,
                lastName: true,
                nickname: true,
              },
            },
          },
        },
      },
    });
    return { data };
  }

  async findOne(id: string, user?: { role: string; ministry?: string }) {
    // Automatically update event statuses based on current date/time
    await this.updateEventStatuses();

    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            attendances: true,
            registrations: true,
          },
        },
        classShepherds: {
          include: {
            user: {
              include: {
                member: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    communityId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Ministry-specific event: only visible to that ministry or Admin/Super/DCS
    if (user && event.ministry) {
      const canSeeAll =
        user.role === UserRole.SUPER_USER ||
        user.role === UserRole.ADMINISTRATOR ||
        user.role === UserRole.DCS;
      if (!canSeeAll && user.ministry !== event.ministry) {
        throw new ForbiddenException('You do not have access to this ministry-specific event');
      }
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto, userId?: string) {
    const existingEvent = await this.findOne(id);

    // Helper function to combine date and time
    const combineDateTime = (date: Date, time?: string | null): Date => {
      const result = new Date(date);
      if (time) {
        // Parse time string (handles both "HH:MM" and "HH:MM:SS" formats)
        const timeParts = time.split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        result.setHours(hours, minutes, 0, 0);
      }
      return result;
    };

    // Validate dates and times if provided
    if (updateEventDto.startDate && updateEventDto.endDate) {
      const startDate = new Date(updateEventDto.startDate);
      const endDate = new Date(updateEventDto.endDate);
      const startTime = updateEventDto.startTime ?? existingEvent.startTime;
      const endTime = updateEventDto.endTime ?? existingEvent.endTime;

      const actualStartDateTime = combineDateTime(startDate, startTime);
      const actualEndDateTime = combineDateTime(endDate, endTime);

      if (actualStartDateTime >= actualEndDateTime) {
        throw new BadRequestException('End date/time must be after start date/time');
      }
    } else if (updateEventDto.startDate) {
      const startDate = new Date(updateEventDto.startDate);
      const endDate = new Date(existingEvent.endDate);
      const startTime = updateEventDto.startTime ?? existingEvent.startTime;
      const endTime = updateEventDto.endTime ?? existingEvent.endTime;

      const actualStartDateTime = combineDateTime(startDate, startTime);
      const actualEndDateTime = combineDateTime(endDate, endTime);

      if (actualStartDateTime >= actualEndDateTime) {
        throw new BadRequestException('End date/time must be after start date/time');
      }
    } else if (updateEventDto.endDate) {
      const startDate = new Date(existingEvent.startDate);
      const endDate = new Date(updateEventDto.endDate);
      const startTime = updateEventDto.startTime ?? existingEvent.startTime;
      const endTime = updateEventDto.endTime ?? existingEvent.endTime;

      const actualStartDateTime = combineDateTime(startDate, startTime);
      const actualEndDateTime = combineDateTime(endDate, endTime);

      if (actualStartDateTime >= actualEndDateTime) {
        throw new BadRequestException('End date/time must be after start date/time');
      }
    } else if (updateEventDto.startTime || updateEventDto.endTime) {
      // If only times are being updated, validate against existing dates
      const startDate = new Date(existingEvent.startDate);
      const endDate = new Date(existingEvent.endDate);
      const startTime = updateEventDto.startTime ?? existingEvent.startTime;
      const endTime = updateEventDto.endTime ?? existingEvent.endTime;

      const actualStartDateTime = combineDateTime(startDate, startTime);
      const actualEndDateTime = combineDateTime(endDate, endTime);

      if (actualStartDateTime >= actualEndDateTime) {
        throw new BadRequestException('End date/time must be after start date/time');
      }
    }

    // Validate recurring event configuration if updating
    if (updateEventDto.isRecurring !== undefined && updateEventDto.isRecurring) {
      const recurrencePattern = updateEventDto.recurrencePattern || existingEvent.recurrencePattern;
      
      if (!recurrencePattern) {
        throw new BadRequestException('Recurrence pattern is required for recurring events');
      }

      if (recurrencePattern === 'weekly') {
        const recurrenceDays = updateEventDto.recurrenceDays || existingEvent.recurrenceDays;
        if (!recurrenceDays || recurrenceDays.length === 0) {
          throw new BadRequestException('Recurrence days are required for weekly recurring events');
        }
      }

      if (recurrencePattern === 'monthly') {
        const monthlyType = updateEventDto.monthlyType || existingEvent.monthlyType;
        if (!monthlyType) {
          throw new BadRequestException('Monthly type is required for monthly recurring events');
        }
      }
    }

    // Validate ministry if provided
    if (updateEventDto.ministry !== undefined && updateEventDto.ministry?.trim()) {
      const allMinistries = Object.values(MINISTRIES_BY_APOSTOLATE).flat();
      if (!allMinistries.some((m) => m === updateEventDto.ministry?.trim())) {
        throw new BadRequestException('Ministry must be one of the known ministries');
      }
    }

    const previousSnapshot = eventToSnapshot(existingEvent as Parameters<typeof eventToSnapshot>[0]);
    const changedFields: Record<string, { old: unknown; new: unknown }> = {};
    const fieldMap: Array<[keyof UpdateEventDto, string]> = [
      ['title', 'title'],
      ['eventType', 'eventType'],
      ['category', 'category'],
      ['description', 'description'],
      ['startDate', 'startDate'],
      ['endDate', 'endDate'],
      ['startTime', 'startTime'],
      ['endTime', 'endTime'],
      ['location', 'location'],
      ['venue', 'venue'],
      ['status', 'status'],
      ['hasRegistration', 'hasRegistration'],
      ['registrationFee', 'registrationFee'],
      ['maxParticipants', 'maxParticipants'],
      ['ministry', 'ministry'],
    ];
    for (const [dtoKey, snapKey] of fieldMap) {
      const val = updateEventDto[dtoKey];
      if (val === undefined) continue;
      const oldVal = (previousSnapshot as Record<string, unknown>)[snapKey];
      const newVal = val instanceof Date ? val.toISOString() : val;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedFields[snapKey] = { old: oldVal, new: newVal };
      }
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...(updateEventDto.title && { title: updateEventDto.title }),
        ...(updateEventDto.eventType && { eventType: updateEventDto.eventType }),
        ...(updateEventDto.category && { category: updateEventDto.category }),
        ...(updateEventDto.description !== undefined && { description: updateEventDto.description || null }),
        ...(updateEventDto.startDate && { startDate: new Date(updateEventDto.startDate) }),
        ...(updateEventDto.endDate && { endDate: new Date(updateEventDto.endDate) }),
        ...(updateEventDto.startTime !== undefined && { startTime: updateEventDto.startTime || null }),
        ...(updateEventDto.endTime !== undefined && { endTime: updateEventDto.endTime || null }),
        ...(updateEventDto.location && { location: updateEventDto.location }),
        ...(updateEventDto.venue !== undefined && { venue: updateEventDto.venue || null }),
        ...(updateEventDto.status && { status: updateEventDto.status }),
        ...(updateEventDto.hasRegistration !== undefined && { hasRegistration: updateEventDto.hasRegistration }),
        ...(updateEventDto.registrationFee !== undefined && { registrationFee: updateEventDto.registrationFee ? updateEventDto.registrationFee : null }),
        ...(updateEventDto.maxParticipants !== undefined && { maxParticipants: updateEventDto.maxParticipants || null }),
        ...(updateEventDto.isRecurring !== undefined && { isRecurring: updateEventDto.isRecurring }),
        ...(updateEventDto.recurrencePattern !== undefined && { recurrencePattern: updateEventDto.recurrencePattern || null }),
        ...(updateEventDto.recurrenceDays !== undefined && { recurrenceDays: updateEventDto.recurrenceDays || [] }),
        ...(updateEventDto.recurrenceInterval !== undefined && { recurrenceInterval: updateEventDto.recurrenceInterval || null }),
        ...(updateEventDto.monthlyType !== undefined && { monthlyType: updateEventDto.monthlyType || null }),
        ...(updateEventDto.monthlyDayOfMonth !== undefined && { monthlyDayOfMonth: updateEventDto.monthlyDayOfMonth || null }),
        ...(updateEventDto.monthlyWeekOfMonth !== undefined && { monthlyWeekOfMonth: updateEventDto.monthlyWeekOfMonth || null }),
        ...(updateEventDto.monthlyDayOfWeek !== undefined && { monthlyDayOfWeek: updateEventDto.monthlyDayOfWeek || null }),
        ...(updateEventDto.ministry !== undefined && { ministry: updateEventDto.ministry?.trim() || null }),
      },
      include: {
        _count: {
          select: {
            attendances: true,
            registrations: true,
          },
        },
      },
    });

    if (userId && Object.keys(changedFields).length > 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
      const userEmail = user?.email ?? user?.phone ?? null;
      await this.prisma.eventAuditLog.create({
        data: {
          eventId: event.id,
          action: EventAuditAction.UPDATE,
          userId,
          userEmail: userEmail ?? undefined,
          previousSnapshot: previousSnapshot as Prisma.InputJsonValue,
          changedFields: changedFields as Prisma.InputJsonValue,
          restoredAt: null,
          restoredBy: null,
        },
      });
    }

    return event;
  }

  async remove(id: string, userId?: string) {
    await this.findOne(id);

    // Check if event has attendances or registrations
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            attendances: true,
            registrations: true,
          },
        },
      },
    });

    const snapshot = event ? (eventToSnapshot(event as Parameters<typeof eventToSnapshot>[0]) as Prisma.InputJsonValue) : null;

    let result: { id: string };
    if (event && (event._count.attendances > 0 || event._count.registrations > 0)) {
      // Soft delete: Update status to CANCELLED
      result = await this.prisma.event.update({
        where: { id },
        data: { status: EventStatus.CANCELLED },
      });
    } else {
      // Hard delete if no dependencies
      result = await this.prisma.event.delete({
        where: { id },
      });
    }

    if (userId && snapshot) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
      const userEmail = user?.email ?? user?.phone ?? null;
      await this.prisma.eventAuditLog.create({
        data: {
          eventId: result.id, // for soft delete; for hard delete event no longer exists but we store id in snapshot
          action: EventAuditAction.DELETE,
          userId,
          userEmail: userEmail ?? undefined,
          previousSnapshot: snapshot,
          changedFields: Prisma.JsonNull,
        },
      });
    }

    return result;
  }

  /**
   * Super User only: get event audit log (who created, edited, deleted; what was changed).
   */
  async getAuditLog(limit = 50, offset = 0) {
    const [data, total] = await Promise.all([
      this.prisma.eventAuditLog.findMany({
        orderBy: { performedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              member: { select: { firstName: true, lastName: true, nickname: true } },
            },
          },
        },
      }),
      this.prisma.eventAuditLog.count(),
    ]);
    return { data, total, limit, offset };
  }

  /**
   * Super User only: revert a DELETE (restore event from snapshot) or an UPDATE (restore previous state).
   */
  async revertAuditEntry(auditLogId: string, revertedBy: string) {
    const entry = await this.prisma.eventAuditLog.findUnique({
      where: { id: auditLogId },
    });
    if (!entry) throw new NotFoundException('Audit log entry not found');
    if (entry.restoredAt) throw new BadRequestException('This change was already reverted');

    if (entry.action === EventAuditAction.DELETE && entry.previousSnapshot) {
      const snap = entry.previousSnapshot as Record<string, unknown>;
      const { id: _oldId, ...rest } = snap;
      await this.prisma.event.create({
        data: {
          title: rest.title as string,
          eventType: rest.eventType as string,
          category: rest.category as string,
          description: (rest.description as string | null) ?? undefined,
          startDate: new Date(rest.startDate as string),
          endDate: new Date(rest.endDate as string),
          startTime: (rest.startTime as string | null) ?? undefined,
          endTime: (rest.endTime as string | null) ?? undefined,
          location: rest.location as string,
          venue: (rest.venue as string | null) ?? undefined,
          status: (rest.status as EventStatus) ?? EventStatus.UPCOMING,
          hasRegistration: (rest.hasRegistration as boolean) ?? false,
          registrationFee: rest.registrationFee != null ? (rest.registrationFee as number) : undefined,
          maxParticipants: (rest.maxParticipants as number | null) ?? undefined,
          encounterType: (rest.encounterType as string | null) ?? undefined,
          classNumber: (rest.classNumber as number | null) ?? undefined,
          ministry: (rest.ministry as string | null) ?? undefined,
          isRecurring: (rest.isRecurring as boolean) ?? false,
          recurrencePattern: (rest.recurrencePattern as string | null) ?? undefined,
          recurrenceDays: ((rest.recurrenceDays as string[]) ?? []) as string[],
          recurrenceInterval: (rest.recurrenceInterval as number | null) ?? undefined,
          monthlyType: (rest.monthlyType as string | null) ?? undefined,
          monthlyDayOfMonth: (rest.monthlyDayOfMonth as number | null) ?? undefined,
          monthlyWeekOfMonth: (rest.monthlyWeekOfMonth as number | null) ?? undefined,
          monthlyDayOfWeek: (rest.monthlyDayOfWeek as string | null) ?? undefined,
          recurrenceTemplateId: (rest.recurrenceTemplateId as string | null) ?? undefined,
          cancellationReason: (rest.cancellationReason as string | null) ?? undefined,
          createdById: revertedBy,
        },
      });
    } else if (entry.action === EventAuditAction.UPDATE && entry.eventId && entry.previousSnapshot) {
      const snap = entry.previousSnapshot as Record<string, unknown>;
      await this.prisma.event.update({
        where: { id: entry.eventId },
        data: {
          title: snap.title as string,
          eventType: snap.eventType as string,
          category: snap.category as string,
          description: (snap.description as string | null) ?? null,
          startDate: new Date(snap.startDate as string),
          endDate: new Date(snap.endDate as string),
          startTime: (snap.startTime as string | null) ?? null,
          endTime: (snap.endTime as string | null) ?? null,
          location: snap.location as string,
          venue: (snap.venue as string | null) ?? null,
          status: (snap.status as EventStatus) ?? EventStatus.UPCOMING,
          hasRegistration: (snap.hasRegistration as boolean) ?? false,
          registrationFee: snap.registrationFee != null ? (snap.registrationFee as number) : null,
          maxParticipants: (snap.maxParticipants as number | null) ?? null,
          ministry: (snap.ministry as string | null) ?? null,
          isRecurring: (snap.isRecurring as boolean) ?? false,
          recurrencePattern: (snap.recurrencePattern as string | null) ?? null,
          recurrenceDays: ((snap.recurrenceDays as string[]) ?? []) as string[],
          recurrenceInterval: (snap.recurrenceInterval as number | null) ?? null,
          monthlyType: (snap.monthlyType as string | null) ?? null,
          monthlyDayOfMonth: (snap.monthlyDayOfMonth as number | null) ?? null,
          monthlyWeekOfMonth: (snap.monthlyWeekOfMonth as number | null) ?? null,
          monthlyDayOfWeek: (snap.monthlyDayOfWeek as string | null) ?? null,
          recurrenceTemplateId: (snap.recurrenceTemplateId as string | null) ?? null,
          cancellationReason: (snap.cancellationReason as string | null) ?? null,
        },
      });
    } else {
      throw new BadRequestException('This audit entry cannot be reverted');
    }

    await this.prisma.eventAuditLog.update({
      where: { id: auditLogId },
      data: { restoredAt: new Date(), restoredBy: revertedBy },
    });
    return { success: true, message: 'Reverted successfully' };
  }

  /**
   * Super User only: find potential duplicate events (same title, category, start date, time, location).
   * Returns groups of events that look like duplicates for cleanup.
   */
  async findDuplicates() {
    const events = await this.prisma.event.findMany({
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        category: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        location: true,
        isRecurring: true,
        recurrenceTemplateId: true,
        createdAt: true,
        createdBy: { select: { id: true, email: true, phone: true, member: { select: { firstName: true, lastName: true } } } },
      },
    });

    const key = (e: { title: string; category: string; startDate: Date; startTime?: string | null; location: string }) =>
      `${e.title}|${e.category}|${e.startDate.toISOString().slice(0, 10)}|${e.startTime ?? ''}|${e.location}`;

    const byKey = new Map<string, typeof events>();
    for (const e of events) {
      const k = key(e);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(e);
    }

    const groups = Array.from(byKey.entries())
      .filter(([, list]) => list.length > 1)
      .map(([keys, list]) => ({ keys, events: list }));

    return { groups };
  }

  async regenerateQRCode(id: string) {
    await this.findOne(id);
    return this.generateQRCode(id);
  }

  private async generateQRCode(eventId: string): Promise<string> {
    try {
      // Generate QR code data - include both JSON format and URL format
      // URL format allows direct access to public check-in page
      // In development, try to use local network IP if available, otherwise use localhost
      let baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      // In development mode, try to detect local network IP for phone scanning
      if (process.env.NODE_ENV !== 'production' && baseUrl.includes('localhost')) {
        // Check if LOCAL_IP is set in environment
        const localIp = process.env.LOCAL_IP;
        if (localIp) {
          baseUrl = `http://${localIp}:3000`;
        }
        // Otherwise, keep localhost (user can set LOCAL_IP env var if needed)
      }
      
      // Ensure baseUrl has protocol
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}`;
      }
      
      const publicCheckInUrl = `${baseUrl}/checkin/${eventId}`;
      
      // Log the URL being encoded (for debugging)
      console.log('📱 Generating QR code with URL:', publicCheckInUrl);
      
      // Generate QR code as data URL
      // The qrcode library automatically detects URLs and encodes them properly
      const qrCodeDataUrl = await QRCode.toDataURL(publicCheckInUrl, {
        errorCorrectionLevel: 'H', // Higher error correction for better scanning
        type: 'image/png',
        width: 300,
        margin: 2, // Increased margin for better scanning
        color: {
          dark: '#000000', // Pure black
          light: '#FFFFFF', // Pure white
        },
      });

      // Upload to BunnyCDN if configured, otherwise use data URL
      let qrCodeUrl: string;
      if (this.bunnyCDN.isConfigured()) {
        try {
          qrCodeUrl = await this.bunnyCDN.uploadQRCode(
            qrCodeDataUrl,
            'event',
            eventId,
          );
        } catch (error) {
          // Fallback to data URL if BunnyCDN upload fails
          console.warn('BunnyCDN upload failed, using data URL:', error);
          qrCodeUrl = qrCodeDataUrl;
        }
      } else {
        // Use data URL if BunnyCDN is not configured
        qrCodeUrl = qrCodeDataUrl;
      }

      // Update event with QR code URL
      await this.prisma.event.update({
        where: { id: eventId },
        data: { qrCodeUrl },
      });

      return qrCodeUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  async updateEventStatuses() {
    const now = new Date();

    // Get all events that need status updates
    const eventsToCheck = await this.prisma.event.findMany({
      where: {
        status: { in: [EventStatus.UPCOMING, EventStatus.ONGOING] },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    // Calculate actual start and end datetimes for each event
    const updates: Array<{ id: string; newStatus: EventStatus }> = [];

    for (const event of eventsToCheck) {
      // Combine date with time if time exists
      let actualStartDate = new Date(event.startDate);
      let actualEndDate = new Date(event.endDate);

      // If startTime exists, combine it with startDate
      if (event.startTime) {
        // Parse time string (handles both "HH:MM" and "HH:MM:SS" formats)
        const timeParts = event.startTime.split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        actualStartDate = new Date(event.startDate);
        actualStartDate.setHours(hours, minutes, 0, 0);
      }

      // If endTime exists, combine it with endDate
      if (event.endTime) {
        // Parse time string (handles both "HH:MM" and "HH:MM:SS" formats)
        const timeParts = event.endTime.split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        actualEndDate = new Date(event.endDate);
        actualEndDate.setHours(hours, minutes, 0, 0);
      }

      // Determine new status
      if (actualEndDate < now) {
        // Event has ended
        if (event.status !== EventStatus.COMPLETED) {
          updates.push({ id: event.id, newStatus: EventStatus.COMPLETED });
        }
      } else if (actualStartDate <= now && actualEndDate >= now) {
        // Event is currently ongoing
        if (event.status !== EventStatus.ONGOING) {
          updates.push({ id: event.id, newStatus: EventStatus.ONGOING });
        }
      }
      // If event hasn't started yet, keep it as UPCOMING (no update needed)
    }

    // Batch update events
    for (const update of updates) {
      await this.prisma.event.update({
        where: { id: update.id },
        data: { status: update.newStatus },
      });
    }

    return { 
      message: 'Event statuses updated successfully',
      updated: updates.length,
    };
  }

  /**
   * Check if an event is an Encounter Event
   */
  private isEncounterEvent(event: { category?: string; eventType?: string; title?: string }): boolean {
    const encounterCategories = [
      'Marriage Encounter',
      'Singles Encounter',
      'Solo Parents Encounter',
      'Family Encounter',
      'Youth Encounter',
    ];

    const encounterTypes = ['ME', 'SE', 'SPE', 'FE', 'YE', 'ENCOUNTER'];

    if (event.category && encounterCategories.includes(event.category)) {
      return true;
    }

    if (event.eventType && encounterTypes.includes(event.eventType.toUpperCase())) {
      return true;
    }

    if (event.title && event.title.toLowerCase().includes('encounter')) {
      return true;
    }

    return false;
  }

  /**
   * Assign a Class Shepherd to an Encounter Event for a specific encounter class
   */
  async assignClassShepherd(
    eventId: string,
    assignDto: AssignClassShepherdDto,
    assignedBy: string,
  ) {
    // Verify event exists
    const event = await this.findOne(eventId);

    // Check if event is an Encounter Event
    if (!this.isEncounterEvent(event)) {
      throw new BadRequestException(
        'Class Shepherd assignment is only available for Encounter Events',
      );
    }

    // Verify user exists and has CLASS_SHEPHERD role
    const user = await this.prisma.user.findUnique({
      where: { id: assignDto.userId },
      include: { member: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${assignDto.userId} not found`);
    }

    if (user.role !== UserRole.CLASS_SHEPHERD) {
      throw new BadRequestException(
        `User must have CLASS_SHEPHERD role. Current role: ${user.role}`,
      );
    }

    // Check if user is already assigned to this event and class
    const existingAssignment = await this.prisma.eventClassShepherd.findUnique({
      where: {
        eventId_userId_encounterType_classNumber: {
          eventId,
          userId: assignDto.userId,
          encounterType: assignDto.encounterType.toUpperCase(),
          classNumber: assignDto.classNumber,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(
        `User is already assigned as Class Shepherd for ${assignDto.encounterType} Class ${assignDto.classNumber} in this event`,
      );
    }

    // Check current count of shepherds for this event and class (max 4)
    const currentShepherds = await this.prisma.eventClassShepherd.count({
      where: {
        eventId,
        encounterType: assignDto.encounterType.toUpperCase(),
        classNumber: assignDto.classNumber,
      },
    });

    if (currentShepherds >= 4) {
      throw new BadRequestException(
        `Maximum of 4 Class Shepherds allowed per encounter class. Current count: ${currentShepherds}`,
      );
    }

    // Create assignment
    const assignment = await this.prisma.eventClassShepherd.create({
      data: {
        eventId,
        userId: assignDto.userId,
        encounterType: assignDto.encounterType.toUpperCase(),
        classNumber: assignDto.classNumber,
        assignedBy,
      },
      include: {
        user: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                communityId: true,
              },
            },
          },
        },
      },
    });

    return assignment;
  }

  /**
   * Remove a Class Shepherd assignment from an Encounter Event
   */
  async removeClassShepherd(
    eventId: string,
    assignmentId: string,
  ) {
    // Verify assignment exists and belongs to this event
    const assignment = await this.prisma.eventClassShepherd.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Class Shepherd assignment not found`);
    }

    if (assignment.eventId !== eventId) {
      throw new BadRequestException(
        'Assignment does not belong to this event',
      );
    }

    // Delete assignment
    await this.prisma.eventClassShepherd.delete({
      where: { id: assignmentId },
    });

    return { message: 'Class Shepherd assignment removed successfully' };
  }

  /**
   * Get all Class Shepherd assignments for an event
   */
  async getClassShepherds(eventId: string) {
    // Verify event exists
    await this.findOne(eventId);

    const assignments = await this.prisma.eventClassShepherd.findMany({
      where: { eventId },
      include: {
        user: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                communityId: true,
                encounterType: true,
                classNumber: true,
              },
            },
          },
        },
      },
      orderBy: [
        { encounterType: 'asc' },
        { classNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Group by encounter class
    const grouped = assignments.reduce((acc, assignment) => {
      const key = `${assignment.encounterType}-${assignment.classNumber}`;
      if (!acc[key]) {
        acc[key] = {
          encounterType: assignment.encounterType,
          classNumber: assignment.classNumber,
          shepherds: [],
        };
      }
      acc[key].shepherds.push(assignment);
      return acc;
    }, {} as Record<string, { encounterType: string; classNumber: number; shepherds: typeof assignments }>);

    return {
      assignments,
      grouped: Object.values(grouped),
    };
  }

  /**
   * Get Class Shepherd assignments for a specific encounter class in an event
   */
  async getClassShepherdsByClass(
    eventId: string,
    encounterType: string,
    classNumber: number,
  ) {
    // Verify event exists
    await this.findOne(eventId);

    const assignments = await this.prisma.eventClassShepherd.findMany({
      where: {
        eventId,
        encounterType: encounterType.toUpperCase(),
        classNumber,
      },
      include: {
        user: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                communityId: true,
                encounterType: true,
                classNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return assignments;
  }

  /**
   * Cancel an event
   */
  async cancel(id: string, cancelEventDto: CancelEventDto) {
    const event = await this.findOne(id);

    if (event.status === 'CANCELLED') {
      throw new BadRequestException('Event is already cancelled');
    }

    if (event.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed event');
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: cancelEventDto.cancellationReason || null,
      },
      include: {
        _count: {
          select: {
            registrations: true,
            attendances: true,
          },
        },
      },
    });

    return updatedEvent;
  }
}


import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { AssignClassShepherdDto } from './dto/assign-class-shepherd.dto';
import { CancelEventDto } from './dto/cancel-event.dto';
import { Prisma, EventStatus, UserRole } from '@prisma/client';
import QRCode from 'qrcode';
import { BunnyCDNService } from '../common/services/bunnycdn.service';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private bunnyCDN: BunnyCDNService,
  ) {}

  async create(createEventDto: CreateEventDto) {
    // Validate dates
    const startDate = new Date(createEventDto.startDate);
    const endDate = new Date(createEventDto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
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

    return event;
  }

  async findAll(query: EventQueryDto) {
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
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EventWhereInput = {};

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

  async findOne(id: string) {
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

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const existingEvent = await this.findOne(id);

    // Validate dates if both are provided
    if (updateEventDto.startDate && updateEventDto.endDate) {
      const startDate = new Date(updateEventDto.startDate);
      const endDate = new Date(updateEventDto.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }
    } else if (updateEventDto.startDate) {
      const startDate = new Date(updateEventDto.startDate);
      const endDate = new Date(existingEvent.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }
    } else if (updateEventDto.endDate) {
      const startDate = new Date(existingEvent.startDate);
      const endDate = new Date(updateEventDto.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
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

    return event;
  }

  async remove(id: string) {
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

    if (event && (event._count.attendances > 0 || event._count.registrations > 0)) {
      // Soft delete: Update status to CANCELLED
      return this.prisma.event.update({
        where: { id },
        data: { status: EventStatus.CANCELLED },
      });
    }

    // Hard delete if no dependencies
    return this.prisma.event.delete({
      where: { id },
    });
  }

  async regenerateQRCode(id: string) {
    await this.findOne(id);
    return this.generateQRCode(id);
  }

  private async generateQRCode(eventId: string): Promise<string> {
    try {
      // Generate QR code data (event ID for check-in)
      const qrData = JSON.stringify({
        type: 'event',
        eventId,
        timestamp: new Date().toISOString(),
      });

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
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

    // Update ongoing events
    await this.prisma.event.updateMany({
      where: {
        status: EventStatus.UPCOMING,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      data: {
        status: EventStatus.ONGOING,
      },
    });

    // Update completed events
    await this.prisma.event.updateMany({
      where: {
        status: { in: [EventStatus.UPCOMING, EventStatus.ONGOING] },
        endDate: { lt: now },
      },
      data: {
        status: EventStatus.COMPLETED,
      },
    });

    return { message: 'Event statuses updated successfully' };
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


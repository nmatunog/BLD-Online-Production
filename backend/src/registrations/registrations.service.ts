import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { RegisterNonMemberDto } from './dto/register-non-member.dto';
import { RegisterCoupleDto } from './dto/register-couple.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdateRoomAssignmentDto } from './dto/update-room-assignment.dto';
import { RegistrationQueryDto } from './dto/registration-query.dto';
import {
  Prisma,
  RegistrationType,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RegistrationsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async registerMember(
    eventId: string,
    registerMemberDto: RegisterMemberDto,
  ) {
    // Verify event exists and has registration enabled
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    if (!event.hasRegistration) {
      throw new BadRequestException(
        'This event does not have registration enabled',
      );
    }

    // Check capacity
    if (event.maxParticipants) {
      const currentRegistrations = await this.prisma.eventRegistration.count({
        where: { eventId },
      });
      if (currentRegistrations >= event.maxParticipants) {
        throw new BadRequestException('Event registration is full');
      }
    }

    // Look up member by Community ID
    const member = await this.prisma.member.findUnique({
      where: { communityId: registerMemberDto.memberCommunityId.toUpperCase() },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with Community ID "${registerMemberDto.memberCommunityId}" not found`,
      );
    }

    // Check if already registered
    const existingRegistration = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        memberId: member.id,
      },
    });

    if (existingRegistration) {
      throw new ConflictException('Member is already registered for this event');
    }

    // Calculate payment amount
    let paymentAmount = event.registrationFee
      ? Number(event.registrationFee)
      : 0;

    // Create registration
    const registration = await this.prisma.eventRegistration.create({
      data: {
        eventId,
        memberId: member.id,
        registrationType: RegistrationType.MEMBER,
        firstName: registerMemberDto.firstName || member.firstName,
        lastName: registerMemberDto.lastName || member.lastName,
        middleName: registerMemberDto.middleName || member.middleName || null,
        email: member.user?.email || null,
        phone: member.user?.phone || null,
        specialRequirements: registerMemberDto.specialRequirements || null,
        emergencyContact: registerMemberDto.emergencyContact || null,
        memberCommunityId: member.communityId,
        coupleRegistrationId: registerMemberDto.coupleRegistrationId || null,
        coupleRole: registerMemberDto.coupleRole || null,
        paymentStatus: PaymentStatus.PENDING,
        paymentAmount: paymentAmount > 0 ? paymentAmount : null,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
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
            registrationFee: true,
          },
        },
      },
    });

    return registration;
  }

  async registerNonMember(
    eventId: string,
    registerNonMemberDto: RegisterNonMemberDto,
  ) {
    // Verify event exists and has registration enabled
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    if (!event.hasRegistration) {
      throw new BadRequestException(
        'This event does not have registration enabled',
      );
    }

    // Check capacity
    if (event.maxParticipants) {
      const currentRegistrations = await this.prisma.eventRegistration.count({
        where: { eventId },
      });
      if (currentRegistrations >= event.maxParticipants) {
        throw new BadRequestException('Event registration is full');
      }
    }

    // Calculate payment amount (non-member fee if different)
    let paymentAmount = event.registrationFee
      ? Number(event.registrationFee)
      : 0;

    // Create registration
    const registration = await this.prisma.eventRegistration.create({
      data: {
        eventId,
        registrationType: RegistrationType.NON_MEMBER,
        firstName: registerNonMemberDto.firstName,
        lastName: registerNonMemberDto.lastName,
        middleName: registerNonMemberDto.middleName || null,
        email: registerNonMemberDto.email || null,
        phone: registerNonMemberDto.phone || null,
        specialRequirements: registerNonMemberDto.specialRequirements || null,
        emergencyContact: registerNonMemberDto.emergencyContact || null,
        coupleRegistrationId: registerNonMemberDto.coupleRegistrationId || null,
        coupleRole: registerNonMemberDto.coupleRole || null,
        paymentStatus: PaymentStatus.PENDING,
        paymentAmount: paymentAmount > 0 ? paymentAmount : null,
        notes: registerNonMemberDto.city
          ? `City: ${registerNonMemberDto.city}, Encounter: ${registerNonMemberDto.encounterType}, Class: ${registerNonMemberDto.classNumber}`
          : null,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            registrationFee: true,
          },
        },
      },
    });

    // If this is an Encounter event and all required fields are provided, create member profile
    if (
      registerNonMemberDto.city &&
      registerNonMemberDto.encounterType &&
      registerNonMemberDto.classNumber &&
      (registerNonMemberDto.email || registerNonMemberDto.phone)
    ) {
      try {
        // Check if user already exists
        const normalizedPhone = registerNonMemberDto.phone
          ? normalizePhoneNumber(registerNonMemberDto.phone)
          : null;

        let existingUser = null;
        if (registerNonMemberDto.email) {
          existingUser = await this.prisma.user.findUnique({
            where: { email: registerNonMemberDto.email },
            include: { member: true },
          });
        }
        if (!existingUser && normalizedPhone) {
          existingUser = await this.prisma.user.findFirst({
            where: { phone: normalizedPhone },
            include: { member: true },
          });
        }

        if (existingUser) {
          // User exists - check if they already have a member profile
          if (existingUser.member) {
            // Member profile already exists, link registration to it
            await this.prisma.eventRegistration.update({
              where: { id: registration.id },
              data: { memberId: existingUser.member.id },
            });
          } else {
            // User exists but no member profile - create one
            const classNum = parseInt(registerNonMemberDto.classNumber, 10);
            if (isNaN(classNum) || classNum < 1 || classNum > 999) {
              throw new BadRequestException(
                'Class number must be between 1 and 999',
              );
            }

            // Generate Community ID (city and encounterType are guaranteed to exist due to outer if check)
            const city = registerNonMemberDto.city!;
            const encounterType = registerNonMemberDto.encounterType!;
            const communityId = await this.generateCommunityId(
              city,
              encounterType,
              registerNonMemberDto.classNumber!,
            );

            // Create member profile
            const member = await this.prisma.member.create({
              data: {
                userId: existingUser.id,
                firstName: registerNonMemberDto.firstName,
                lastName: registerNonMemberDto.lastName,
                middleName: registerNonMemberDto.middleName || null,
                suffix: registerNonMemberDto.nameSuffix || null,
                nickname: registerNonMemberDto.nickname || null,
                communityId,
                city: city.toUpperCase(),
                encounterType: encounterType.toUpperCase(),
                classNumber: classNum,
                apostolate: registerNonMemberDto.apostolate || null,
                ministry: registerNonMemberDto.ministry || null,
              },
            });

            // Link registration to member
            await this.prisma.eventRegistration.update({
              where: { id: registration.id },
              data: { memberId: member.id },
            });
          }
        } else {
          // Create new user and member profile
          // Generate a temporary password (user will need to reset it)
          const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          const classNum = parseInt(registerNonMemberDto.classNumber, 10);
          if (isNaN(classNum) || classNum < 1 || classNum > 999) {
            throw new BadRequestException(
              'Class number must be between 1 and 999',
            );
          }

          // Generate Community ID (city and encounterType are guaranteed to exist due to outer if check)
          const city = registerNonMemberDto.city!;
          const encounterType = registerNonMemberDto.encounterType!;
          const communityId = await this.generateCommunityId(
            city,
            encounterType,
            registerNonMemberDto.classNumber!,
          );

          // Create user and member in transaction
          await this.prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
              data: {
                email: registerNonMemberDto.email || null,
                phone: normalizedPhone || null,
                passwordHash,
                role: UserRole.MEMBER,
                // Mark as needing password reset
                isActive: true,
              },
            });

            // Create member profile
            const member = await tx.member.create({
              data: {
                userId: user.id,
                firstName: registerNonMemberDto.firstName,
                lastName: registerNonMemberDto.lastName,
                middleName: registerNonMemberDto.middleName || null,
                suffix: registerNonMemberDto.nameSuffix || null,
                nickname: registerNonMemberDto.nickname || null,
                communityId,
                city: city.toUpperCase(),
                encounterType: encounterType.toUpperCase(),
                classNumber: classNum,
                apostolate: registerNonMemberDto.apostolate || null,
                ministry: registerNonMemberDto.ministry || null,
              },
            });

            // Link registration to member
            await tx.eventRegistration.update({
              where: { id: registration.id },
              data: { memberId: member.id },
            });

            // TODO: Send email/SMS with temporary password and instructions to reset
            // For now, store temp password in notes (not secure, but functional)
            await tx.eventRegistration.update({
              where: { id: registration.id },
              data: {
                notes: `${registration.notes || ''}\n[TEMP PASSWORD: ${tempPassword} - User should reset password on first login]`.trim(),
              },
            });
          });
        }
      } catch (error) {
        // Log error but don't fail registration
        console.error('Error creating member profile for non-member:', error);
        // Registration is still created, just without member link
      }
    }

    return registration;
  }

  async registerCouple(
    eventId: string,
    registerCoupleDto: RegisterCoupleDto,
  ) {
    // Verify event exists and has registration enabled
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    if (!event.hasRegistration) {
      throw new BadRequestException(
        'This event does not have registration enabled',
      );
    }

    // Check capacity (couple counts as 2)
    if (event.maxParticipants) {
      const currentRegistrations = await this.prisma.eventRegistration.count({
        where: { eventId },
      });
      if (currentRegistrations + 2 > event.maxParticipants) {
        throw new BadRequestException(
          'Event registration does not have capacity for couple',
        );
      }
    }

    // Generate couple registration ID
    const coupleRegistrationId = `COUPLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Look up both members
    const husband = await this.prisma.member.findUnique({
      where: { communityId: registerCoupleDto.husbandCommunityId.toUpperCase() },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const wife = await this.prisma.member.findUnique({
      where: { communityId: registerCoupleDto.wifeCommunityId.toUpperCase() },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!husband) {
      throw new NotFoundException(
        `Husband with Community ID "${registerCoupleDto.husbandCommunityId}" not found`,
      );
    }

    if (!wife) {
      throw new NotFoundException(
        `Wife with Community ID "${registerCoupleDto.wifeCommunityId}" not found`,
      );
    }

    // Check if either is already registered
    const existingHusband = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        memberId: husband.id,
      },
    });

    const existingWife = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        memberId: wife.id,
      },
    });

    if (existingHusband || existingWife) {
      throw new ConflictException(
        'One or both members are already registered for this event',
      );
    }

    // Calculate payment amount (single fee for couple)
    const paymentAmount = event.registrationFee
      ? Number(event.registrationFee)
      : 0;

    // Create both registrations in a transaction
    const [husbandRegistration, wifeRegistration] = await this.prisma.$transaction([
      this.prisma.eventRegistration.create({
        data: {
          eventId,
          memberId: husband.id,
          registrationType: RegistrationType.COUPLE,
          firstName: registerCoupleDto.husbandFirstName || husband.firstName,
          lastName: registerCoupleDto.husbandLastName || husband.lastName,
          middleName: registerCoupleDto.husbandMiddleName || husband.middleName || null,
          email: husband.user?.email || null,
          phone: husband.user?.phone || null,
          specialRequirements: registerCoupleDto.specialRequirements || null,
          emergencyContact: registerCoupleDto.emergencyContact || null,
          memberCommunityId: husband.communityId,
          coupleRegistrationId,
          coupleRole: 'HUSBAND',
          paymentStatus: PaymentStatus.PENDING,
          paymentAmount: paymentAmount > 0 ? paymentAmount : null,
        },
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.eventRegistration.create({
        data: {
          eventId,
          memberId: wife.id,
          registrationType: RegistrationType.COUPLE,
          firstName: registerCoupleDto.wifeFirstName || wife.firstName,
          lastName: registerCoupleDto.wifeLastName || wife.lastName,
          middleName: registerCoupleDto.wifeMiddleName || wife.middleName || null,
          email: wife.user?.email || null,
          phone: wife.user?.phone || null,
          specialRequirements: registerCoupleDto.specialRequirements || null,
          emergencyContact: registerCoupleDto.emergencyContact || null,
          memberCommunityId: wife.communityId,
          coupleRegistrationId,
          coupleRole: 'WIFE',
          paymentStatus: PaymentStatus.PENDING,
          paymentAmount: null, // Only charge once for couple
        },
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      husband: husbandRegistration,
      wife: wifeRegistration,
      coupleRegistrationId,
    };
  }

  async findAll(eventId: string, query: RegistrationQueryDto) {
    const {
      search,
      registrationType,
      paymentStatus,
      roomAssignment,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EventRegistrationWhereInput = {
      eventId,
      ...(registrationType && { registrationType }),
      ...(paymentStatus && { paymentStatus }),
      ...(roomAssignment && { roomAssignment }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { memberCommunityId: { contains: search.toUpperCase(), mode: 'insensitive' } },
        ],
      }),
    };

    // Build orderBy
    const orderBy: Prisma.EventRegistrationOrderByWithRelationInput = {};
    if (sortBy === 'firstName' || sortBy === 'lastName' || sortBy === 'createdAt' || sortBy === 'paymentStatus') {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [registrations, total] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where,
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  role: true,
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
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.eventRegistration.count({ where }),
    ]);

    return {
      data: registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
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
            registrationFee: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID "${id}" not found`);
    }

    return registration;
  }

  async update(id: string, updateRegistrationDto: UpdateRegistrationDto) {
    await this.findOne(id); // Verify registration exists

    const updated = await this.prisma.eventRegistration.update({
      where: { id },
      data: {
        ...updateRegistrationDto,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
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
          },
        },
      },
    });

    return updated;
  }

  async updatePaymentStatus(
    id: string,
    updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    const registration = await this.findOne(id);

    const updated = await this.prisma.eventRegistration.update({
      where: { id },
      data: {
        paymentStatus: updatePaymentStatusDto.paymentStatus,
        paymentAmount: updatePaymentStatusDto.paymentAmount
          ? updatePaymentStatusDto.paymentAmount
          : registration.paymentAmount,
        paymentReference: updatePaymentStatusDto.paymentReference || null,
        notes: updatePaymentStatusDto.notes || null,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
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
          },
        },
      },
    });

    // If this is a couple registration, update the partner's payment status too
    if (registration.coupleRegistrationId) {
      await this.prisma.eventRegistration.updateMany({
        where: {
          coupleRegistrationId: registration.coupleRegistrationId,
          id: { not: id },
        },
        data: {
          paymentStatus: updatePaymentStatusDto.paymentStatus,
          paymentReference: updatePaymentStatusDto.paymentReference || null,
        },
      });
    }

    return updated;
  }

  async updateRoomAssignment(
    id: string,
    updateRoomAssignmentDto: UpdateRoomAssignmentDto,
  ) {
    const registration = await this.findOne(id); // Get registration for couple check

    const updated = await this.prisma.eventRegistration.update({
      where: { id },
      data: {
        roomAssignment: updateRoomAssignmentDto.roomAssignment,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
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
          },
        },
      },
    });

    // If this is a couple registration, update the partner's room assignment too
    if (registration.coupleRegistrationId) {
      await this.prisma.eventRegistration.updateMany({
        where: {
          coupleRegistrationId: registration.coupleRegistrationId,
          id: { not: id },
        },
        data: {
          roomAssignment: updateRoomAssignmentDto.roomAssignment,
        },
      });
    }

    return updated;
  }

  async delete(id: string) {
    await this.findOne(id); // Verify registration exists

    await this.prisma.eventRegistration.delete({
      where: { id },
    });

    return { message: 'Registration deleted successfully' };
  }

  async getSummary(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const [
      totalRegistrations,
      memberRegistrations,
      nonMemberRegistrations,
      coupleRegistrations,
      pendingPayments,
      paidPayments,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.eventRegistration.count({
        where: { eventId },
      }),
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          registrationType: RegistrationType.MEMBER,
        },
      }),
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          registrationType: RegistrationType.NON_MEMBER,
        },
      }),
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          registrationType: RegistrationType.COUPLE,
        },
      }),
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          paymentStatus: PaymentStatus.PENDING,
        },
      }),
      this.prisma.eventRegistration.count({
        where: {
          eventId,
          paymentStatus: PaymentStatus.PAID,
        },
      }),
      this.prisma.eventRegistration.aggregate({
        where: {
          eventId,
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: {
          paymentAmount: true,
        },
      }),
    ]);

    return {
      event: {
        id: event.id,
        title: event.title,
        maxParticipants: event.maxParticipants,
        registrationFee: event.registrationFee,
      },
      summary: {
        totalRegistrations,
        memberRegistrations,
        nonMemberRegistrations,
        coupleRegistrations,
        pendingPayments,
        paidPayments,
        totalRevenue: totalRevenue._sum.paymentAmount || 0,
        capacityUsed: event.maxParticipants
          ? (totalRegistrations / event.maxParticipants) * 100
          : null,
      },
    };
  }

  private async generateCommunityId(
    city: string,
    encounterType: string,
    classNumber: string,
  ): Promise<string> {
    const cityCode = city.substring(0, 3).toUpperCase();
    const encounterCode = encounterType.toUpperCase();
    const parsedClassNumber = parseInt(classNumber, 10);

    if (isNaN(parsedClassNumber) || parsedClassNumber < 1 || parsedClassNumber > 999) {
      throw new BadRequestException(
        'Class number must be a numeric value between 1 and 999.',
      );
    }

    // Find existing members for this city, encounter type, and class number
    const existingMembers = await this.prisma.member.findMany({
      where: {
        city: cityCode,
        encounterType: encounterCode,
        classNumber: parsedClassNumber,
      },
      select: {
        communityId: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    let nextSequence = 1;
    if (existingMembers.length > 0) {
      const maxSequence = existingMembers.reduce((max, member) => {
        const match = member.communityId.match(/(\d{2})$/);
        if (match) {
          return Math.max(max, parseInt(match[1], 10));
        }
        return max;
      }, 0);
      nextSequence = maxSequence + 1;
    }

    if (nextSequence > 99) {
      throw new ConflictException(
        `Maximum members (99) reached for class ${classNumber} in ${cityCode}-${encounterCode}.`,
      );
    }

    const formattedClassNumber = String(parsedClassNumber).padStart(2, '0');
    const formattedSequence = String(nextSequence).padStart(2, '0');

    return `${cityCode}-${encounterCode}${formattedClassNumber}${formattedSequence}`;
  }
}


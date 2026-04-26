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
import { ClaimEventCandidateDto } from './dto/claim-event-candidate.dto';
import { EventCandidateQueryDto } from './dto/event-candidate-query.dto';
import { ResolveCandidateDuplicateDto } from './dto/resolve-candidate-duplicate.dto';
import {
  Prisma,
  RegistrationType,
  PaymentStatus,
  UserRole,
  EventCandidateStatus,
} from '@prisma/client';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import * as bcrypt from 'bcryptjs';

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

  async findAllWithSummary(eventId: string, query: RegistrationQueryDto) {
    const [listResult, summaryResult] = await Promise.all([
      this.findAll(eventId, query),
      this.getSummary(eventId),
    ]);
    return {
      ...listResult,
      summary: summaryResult,
    };
  }

  async importCandidatesFromCsv(eventId: string, csvBuffer: Buffer, dryRun = false) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const csvText = csvBuffer.toString('utf-8').replace(/^\uFEFF/, '');
    const parsed = this.parseCsv(csvText);
    if (parsed.length === 0) {
      throw new BadRequestException('CSV is empty');
    }

    const header = parsed[0].map((h) => String(h || '').trim());
    const requiredHeaders = ['Candidate Class', 'Family Name', 'First Name'];
    for (const req of requiredHeaders) {
      if (!header.includes(req)) {
        throw new BadRequestException(`Missing required CSV column: ${req}`);
      }
    }
    const idx = (name: string) => header.indexOf(name);

    const validationErrors: Array<{ row: number; reason: string }> = [];
    const normalizedRows: Array<{
      row: number;
      classGroup?: string | null;
      classShepherds?: string | null;
      candidateClass: string;
      familyName: string;
      firstName: string;
      mobileNumber?: string | null;
      cleanMobile?: string | null;
      cmpATaken?: string | null;
      candidateClassNorm: string;
      familyNameNorm: string;
      firstNameNorm: string;
    }> = [];

    for (let r = 1; r < parsed.length; r++) {
      const row = parsed[r];
      if (row.every((v) => String(v || '').trim() === '')) continue;
      const candidateClass = String(row[idx('Candidate Class')] || '').trim();
      const familyName = String(row[idx('Family Name')] || '').trim();
      const firstName = String(row[idx('First Name')] || '').trim();

      if (!candidateClass || !familyName || !firstName) {
        validationErrors.push({ row: r + 1, reason: 'Missing Candidate Class / Family Name / First Name' });
        continue;
      }
      try {
        this.parseCandidateClass(candidateClass);
      } catch (e) {
        validationErrors.push({ row: r + 1, reason: e instanceof Error ? e.message : 'Invalid Candidate Class' });
        continue;
      }

      const rawMobile = String(row[idx('Mobile Number')] || '').trim();
      const cleanMobileCsv = String(row[idx('Clean Mobile')] || '').trim();
      const normalizedMobile = cleanMobileCsv || (rawMobile ? normalizePhoneNumber(rawMobile) : null);

      normalizedRows.push({
        row: r + 1,
        classGroup: idx('Class Group') >= 0 ? String(row[idx('Class Group')] || '').trim() || null : null,
        classShepherds: idx('Class Shepherds') >= 0 ? String(row[idx('Class Shepherds')] || '').trim() || null : null,
        candidateClass,
        familyName,
        firstName,
        mobileNumber: rawMobile || null,
        cleanMobile: normalizedMobile || null,
        cmpATaken: idx('CMP-A Taken') >= 0 ? String(row[idx('CMP-A Taken')] || '').trim() || null : null,
        candidateClassNorm: this.normalizeText(candidateClass),
        familyNameNorm: this.normalizeText(familyName),
        firstNameNorm: this.normalizeText(firstName),
      });
    }

    const duplicateKeys = new Set<string>();
    const seen = new Set<string>();
    for (const row of normalizedRows) {
      const key = this.candidateSignatureKey(
        row.candidateClassNorm,
        row.familyNameNorm,
        row.firstNameNorm,
        row.cleanMobile,
      );
      if (seen.has(key)) duplicateKeys.add(key);
      seen.add(key);
    }
    if (duplicateKeys.size > 0) {
      for (const row of normalizedRows) {
        const key = this.candidateSignatureKey(
          row.candidateClassNorm,
          row.familyNameNorm,
          row.firstNameNorm,
          row.cleanMobile,
        );
        if (duplicateKeys.has(key)) {
          validationErrors.push({ row: row.row, reason: 'Duplicate row signature in CSV' });
        }
      }
    }

    if (dryRun || validationErrors.length > 0) {
      return {
        dryRun: true,
        totalRows: parsed.length - 1,
        validRows: normalizedRows.length,
        invalidRows: validationErrors.length,
        errors: validationErrors,
      };
    }

    let created = 0;
    let updated = 0;
    for (const row of normalizedRows) {
      const existing = await this.prisma.eventCandidate.findFirst({
        where: {
          eventId,
          candidateClassNorm: row.candidateClassNorm,
          familyNameNorm: row.familyNameNorm,
          firstNameNorm: row.firstNameNorm,
          cleanMobile: row.cleanMobile,
        },
      });
      if (existing) {
        await this.prisma.eventCandidate.update({
          where: { id: existing.id },
          data: {
            classGroup: row.classGroup,
            classShepherds: row.classShepherds,
            candidateClass: row.candidateClass,
            familyName: row.familyName,
            firstName: row.firstName,
            mobileNumber: row.mobileNumber,
            cleanMobile: row.cleanMobile,
            cmpATaken: row.cmpATaken,
          },
        });
        updated++;
      } else {
        await this.prisma.eventCandidate.create({
          data: {
            eventId,
            classGroup: row.classGroup,
            classShepherds: row.classShepherds,
            candidateClass: row.candidateClass,
            familyName: row.familyName,
            firstName: row.firstName,
            mobileNumber: row.mobileNumber,
            cleanMobile: row.cleanMobile,
            cmpATaken: row.cmpATaken,
            candidateClassNorm: row.candidateClassNorm,
            familyNameNorm: row.familyNameNorm,
            firstNameNorm: row.firstNameNorm,
          },
        });
        created++;
      }
    }

    return {
      dryRun: false,
      totalRows: parsed.length - 1,
      importedRows: normalizedRows.length,
      created,
      updated,
      invalidRows: validationErrors.length,
      errors: validationErrors,
    };
  }

  async listCandidates(eventId: string, query: EventCandidateQueryDto) {
    const where: Prisma.EventCandidateWhereInput = { eventId };
    if (query.status) where.status = query.status as EventCandidateStatus;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { candidateClass: { contains: q, mode: 'insensitive' } },
        { familyName: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { cleanMobile: { contains: q } },
      ];
    }
    const rows = await this.prisma.eventCandidate.findMany({
      where,
      include: {
        member: { select: { id: true, communityId: true, firstName: true, lastName: true } },
        registration: { select: { id: true, paymentStatus: true, createdAt: true } },
      },
      // Keep newest rows first so de-dup keeps the latest imported/claimed record.
      orderBy: [{ updatedAt: 'desc' }, { status: 'asc' }, { candidateClass: 'asc' }, { familyName: 'asc' }, { firstName: 'asc' }],
    });

    // Defensive de-duplication by candidate signature to avoid duplicate listings
    // when the same CSV is uploaded multiple times.
    const deduped = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = this.candidateSignatureKey(
        row.candidateClassNorm,
        row.familyNameNorm,
        row.firstNameNorm,
        row.cleanMobile,
      );
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
    }
    return Array.from(deduped.values());
  }

  async getCandidateSummary(eventId: string) {
    const grouped = await this.prisma.eventCandidate.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { _all: true },
    });
    const byStatus = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const total = grouped.reduce((s, row) => s + row._count._all, 0);
    return {
      total,
      imported: byStatus.IMPORTED || 0,
      claimed: byStatus.CLAIMED || 0,
      registered: byStatus.REGISTERED || 0,
      rejected: byStatus.REJECTED || 0,
    };
  }

  async getCandidateDuplicatePreview(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const rows = await this.prisma.eventCandidate.findMany({
      where: { eventId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        member: { select: { id: true, communityId: true } },
        registration: { select: { id: true, createdAt: true } },
      },
    });

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = this.candidateSignatureKey(
        row.candidateClassNorm,
        row.familyNameNorm,
        row.firstNameNorm,
        row.cleanMobile,
      );
      const bucket = groups.get(key) || [];
      bucket.push(row);
      groups.set(key, bucket);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, bucket]) => bucket.length > 1)
      .map(([signature, bucket]) => {
        const conflictFields = this.getCandidateConflictFields(bucket);
        return {
          signature,
          candidateClass: bucket[0]?.candidateClass || '',
          familyName: bucket[0]?.familyName || '',
          firstName: bucket[0]?.firstName || '',
          cleanMobile: bucket[0]?.cleanMobile || null,
          count: bucket.length,
          hasConflicts: conflictFields.length > 0,
          conflictFields,
          rows: bucket.map((r) => ({
            id: r.id,
            status: r.status,
            classGroup: r.classGroup,
            classShepherds: r.classShepherds,
            mobileNumber: r.mobileNumber,
            cleanMobile: r.cleanMobile,
            cmpATaken: r.cmpATaken,
            memberId: r.memberId,
            registrationId: r.registrationId,
            notes: r.notes,
            updatedAt: r.updatedAt,
          })),
        };
      })
      .sort((a, b) => b.count - a.count);

    const duplicateRecords = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
    const recordsToRemove = duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);

    return {
      totalGroups: duplicateGroups.length,
      duplicateRecords,
      recordsToRemove,
      groups: duplicateGroups,
    };
  }

  async harmonizeCandidateDuplicates(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.eventCandidate.findMany({
        where: { eventId },
        orderBy: [{ updatedAt: 'desc' }],
      });

      const groups = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = this.candidateSignatureKey(
          row.candidateClassNorm,
          row.familyNameNorm,
          row.firstNameNorm,
          row.cleanMobile,
        );
        const bucket = groups.get(key) || [];
        bucket.push(row);
        groups.set(key, bucket);
      }

      let mergedGroups = 0;
      let removedRecords = 0;

      for (const [, bucket] of groups.entries()) {
        if (bucket.length <= 1) continue;

        const sorted = [...bucket].sort((a, b) => {
          const statusDiff = this.candidateStatusRank(b.status) - this.candidateStatusRank(a.status);
          if (statusDiff !== 0) return statusDiff;
          const regDiff = Number(Boolean(b.registrationId)) - Number(Boolean(a.registrationId));
          if (regDiff !== 0) return regDiff;
          const memberDiff = Number(Boolean(b.memberId)) - Number(Boolean(a.memberId));
          if (memberDiff !== 0) return memberDiff;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

        const keeper = sorted[0];
        const duplicates = sorted.slice(1);

        let mergedNotes = keeper.notes || '';
        let mergedStatus = keeper.status;
        let claimedAt = keeper.claimedAt;
        let registeredAt = keeper.registeredAt;
        let memberId = keeper.memberId;
        let registrationId = keeper.registrationId;
        let classGroup = keeper.classGroup;
        let classShepherds = keeper.classShepherds;
        let mobileNumber = keeper.mobileNumber;
        let cleanMobile = keeper.cleanMobile;
        let cmpATaken = keeper.cmpATaken;

        for (const dup of duplicates) {
          if (!memberId && dup.memberId) memberId = dup.memberId;
          if (!registrationId && dup.registrationId) registrationId = dup.registrationId;
          if (!classGroup && dup.classGroup) classGroup = dup.classGroup;
          if (!classShepherds && dup.classShepherds) classShepherds = dup.classShepherds;
          if (!mobileNumber && dup.mobileNumber) mobileNumber = dup.mobileNumber;
          if (!cleanMobile && dup.cleanMobile) cleanMobile = dup.cleanMobile;
          if (!cmpATaken && dup.cmpATaken) cmpATaken = dup.cmpATaken;
          if (!claimedAt && dup.claimedAt) claimedAt = dup.claimedAt;
          if (!registeredAt && dup.registeredAt) registeredAt = dup.registeredAt;
          if (this.candidateStatusRank(dup.status) > this.candidateStatusRank(mergedStatus)) {
            mergedStatus = dup.status;
          }
          if (dup.notes && !mergedNotes.includes(dup.notes)) {
            mergedNotes = [mergedNotes, dup.notes].filter(Boolean).join('\n');
          }
        }

        await tx.eventCandidate.update({
          where: { id: keeper.id },
          data: {
            status: mergedStatus,
            memberId,
            registrationId,
            classGroup,
            classShepherds,
            mobileNumber,
            cleanMobile,
            cmpATaken,
            claimedAt,
            registeredAt,
            notes: mergedNotes || null,
          },
        });

        const duplicateIds = duplicates.map((d) => d.id);
        await tx.eventCandidate.deleteMany({
          where: { id: { in: duplicateIds } },
        });

        mergedGroups++;
        removedRecords += duplicateIds.length;
      }

      return {
        mergedGroups,
        removedRecords,
      };
    });
  }

  async resolveCandidateDuplicate(eventId: string, dto: ResolveCandidateDuplicateDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.eventCandidate.findMany({
        where: { eventId },
        orderBy: [{ updatedAt: 'desc' }],
      });

      const group = rows.filter((r) => {
        const key = this.candidateSignatureKey(
          r.candidateClassNorm,
          r.familyNameNorm,
          r.firstNameNorm,
          r.cleanMobile,
        );
        return key === dto.signature;
      });

      if (group.length <= 1) {
        throw new BadRequestException('No duplicate group found for the selected signature');
      }

      const keeper = group.find((r) => r.id === dto.keeperId);
      if (!keeper) {
        throw new BadRequestException('Selected keeper row is not in the duplicate group');
      }

      const deleteIds = (dto.deleteIds && dto.deleteIds.length > 0
        ? dto.deleteIds
        : group.filter((r) => r.id !== dto.keeperId).map((r) => r.id))
        .filter((id) => id !== dto.keeperId);

      if (deleteIds.length === 0) {
        throw new BadRequestException('No duplicate rows selected for deletion');
      }

      const duplicates = group.filter((r) => deleteIds.includes(r.id));
      let mergedStatus = keeper.status;
      let mergedNotes = keeper.notes || '';
      let claimedAt = keeper.claimedAt;
      let registeredAt = keeper.registeredAt;
      let memberId = keeper.memberId;
      let registrationId = keeper.registrationId;
      let classGroup = keeper.classGroup;
      let classShepherds = keeper.classShepherds;
      let mobileNumber = keeper.mobileNumber;
      let cleanMobile = keeper.cleanMobile;
      let cmpATaken = keeper.cmpATaken;

      for (const dup of duplicates) {
        if (!memberId && dup.memberId) memberId = dup.memberId;
        if (!registrationId && dup.registrationId) registrationId = dup.registrationId;
        if (!classGroup && dup.classGroup) classGroup = dup.classGroup;
        if (!classShepherds && dup.classShepherds) classShepherds = dup.classShepherds;
        if (!mobileNumber && dup.mobileNumber) mobileNumber = dup.mobileNumber;
        if (!cleanMobile && dup.cleanMobile) cleanMobile = dup.cleanMobile;
        if (!cmpATaken && dup.cmpATaken) cmpATaken = dup.cmpATaken;
        if (!claimedAt && dup.claimedAt) claimedAt = dup.claimedAt;
        if (!registeredAt && dup.registeredAt) registeredAt = dup.registeredAt;
        if (this.candidateStatusRank(dup.status) > this.candidateStatusRank(mergedStatus)) {
          mergedStatus = dup.status;
        }
        if (dup.notes && !mergedNotes.includes(dup.notes)) {
          mergedNotes = [mergedNotes, dup.notes].filter(Boolean).join('\n');
        }
      }

      await tx.eventCandidate.update({
        where: { id: keeper.id },
        data: {
          status: mergedStatus,
          memberId,
          registrationId,
          classGroup,
          classShepherds,
          mobileNumber,
          cleanMobile,
          cmpATaken,
          claimedAt,
          registeredAt,
          notes: mergedNotes || null,
        },
      });

      const deleted = await tx.eventCandidate.deleteMany({
        where: { id: { in: deleteIds } },
      });

      return {
        signature: dto.signature,
        keeperId: dto.keeperId,
        removedRecords: deleted.count,
      };
    });
  }

  async claimCandidateForEvent(eventId: string, dto: ClaimEventCandidateDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event with ID "${eventId}" not found`);
    if (!event.hasRegistration) throw new BadRequestException('This event does not have registration enabled');

    const classNorm = this.normalizeText(dto.candidateClass);
    const familyNorm = this.normalizeText(dto.familyName);
    const firstNorm = this.normalizeText(dto.firstName);
    const normalizedMobile = dto.mobileNumber ? normalizePhoneNumber(dto.mobileNumber) : null;

    const candidates = await this.prisma.eventCandidate.findMany({
      where: {
        eventId,
        status: { in: [EventCandidateStatus.IMPORTED, EventCandidateStatus.CLAIMED, EventCandidateStatus.REGISTERED] },
        candidateClassNorm: classNorm,
        familyNameNorm: familyNorm,
        firstNameNorm: firstNorm,
        ...(normalizedMobile ? { OR: [{ cleanMobile: normalizedMobile }, { cleanMobile: null }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (candidates.length === 0) {
      throw new NotFoundException('No candidate match found for this event');
    }
    if (candidates.length > 1 && !normalizedMobile) {
      throw new ConflictException('Multiple candidate rows matched. Provide mobile number to disambiguate.');
    }
    const candidate = normalizedMobile
      ? candidates.find((c) => c.cleanMobile === normalizedMobile) || candidates[0]
      : candidates[0];

    const parsedClass = this.parseCandidateClass(candidate.candidateClass);
    const cityCode = this.deriveCityCode(event.location);

    const result = await this.prisma.$transaction(async (tx) => {
      let member = candidate.memberId
        ? await tx.member.findUnique({ where: { id: candidate.memberId }, include: { user: true } })
        : null;
      let tempPassword: string | null = null;
      let userCreated = false;
      let generatedCommunityId: string | null = null;

      if (!member) {
        const existingMember = await tx.member.findFirst({
          where: {
            firstName: { equals: candidate.firstName, mode: 'insensitive' },
            lastName: { equals: candidate.familyName, mode: 'insensitive' },
            encounterType: parsedClass.encounterType,
            classNumber: parsedClass.classNumber,
          },
          include: { user: true },
        });
        if (existingMember) {
          member = existingMember as any;
        }
      }

      if (!member) {
        const email = dto.email?.trim().toLowerCase() || null;
        const mobile = normalizedMobile || candidate.cleanMobile || null;
        if (!email && !mobile) {
          throw new BadRequestException(
            'Mobile number or email is required for first-time claim so login can be created.',
          );
        }

        let user = email
          ? await tx.user.findUnique({ where: { email }, include: { member: true } })
          : null;
        if (!user && mobile) {
          user = await tx.user.findFirst({ where: { phone: mobile }, include: { member: true } });
        }

        if (!user) {
          tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
          const passwordHash = await bcrypt.hash(tempPassword, 10);
          user = await tx.user.create({
            data: {
              email,
              phone: mobile,
              passwordHash,
              role: UserRole.MEMBER,
              isActive: true,
            },
            include: { member: true },
          });
          userCreated = true;
        }

        if (user.member) {
          member = await tx.member.findUnique({ where: { id: user.member.id }, include: { user: true } }) as any;
        } else {
          generatedCommunityId = await this.generateCommunityId(cityCode, parsedClass.encounterType, String(parsedClass.classNumber));
          member = await tx.member.create({
            data: {
              userId: user.id,
              firstName: candidate.firstName,
              lastName: candidate.familyName,
              communityId: generatedCommunityId,
              city: cityCode,
              encounterType: parsedClass.encounterType,
              classNumber: parsedClass.classNumber,
              ministry: null,
              apostolate: null,
            },
            include: { user: true },
          }) as any;
        }
      }

      if (!member) {
        throw new ConflictException('Unable to resolve or create member profile for this candidate');
      }

      const existingReg = await tx.eventRegistration.findFirst({
        where: { eventId, memberId: member.id },
      });
      let registration = existingReg;
      if (!registration) {
        const paymentAmount = event.registrationFee ? Number(event.registrationFee) : 0;
        registration = await tx.eventRegistration.create({
          data: {
            eventId,
            memberId: member.id,
            registrationType: RegistrationType.MEMBER,
            firstName: member.firstName,
            lastName: member.lastName,
            middleName: member.middleName,
            email: member.user?.email || dto.email?.trim().toLowerCase() || null,
            phone: member.user?.phone || normalizedMobile || candidate.cleanMobile || null,
            memberCommunityId: member.communityId,
            paymentStatus: PaymentStatus.PENDING,
            paymentAmount: paymentAmount > 0 ? paymentAmount : null,
          },
        });
      }

      await tx.eventCandidate.update({
        where: { id: candidate.id },
        data: {
          status: EventCandidateStatus.REGISTERED,
          claimedAt: new Date(),
          registeredAt: new Date(),
          memberId: member.id,
          registrationId: registration.id,
          cleanMobile: normalizedMobile || candidate.cleanMobile,
          mobileNumber: dto.mobileNumber || candidate.mobileNumber,
        },
      });

      return {
        candidateId: candidate.id,
        memberId: member.id,
        communityId: member.communityId,
        registrationId: registration.id,
        generatedCommunityId,
        userCreated,
        tempPassword,
      };
    });

    return result;
  }

  private parseCsv(csv: string): string[][] {
    const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
    return lines.map((line) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (ch === ',' && !inQuotes) {
          values.push(current);
          current = '';
          continue;
        }
        current += ch;
      }
      values.push(current);
      return values.map((v) => v.trim());
    });
  }

  private normalizeText(input: string): string {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private candidateSignatureKey(
    classNorm: string,
    familyNorm: string,
    firstNorm: string,
    cleanMobile?: string | null,
  ): string {
    return `${classNorm}|${familyNorm}|${firstNorm}|${cleanMobile || ''}`;
  }

  private candidateStatusRank(status: EventCandidateStatus): number {
    switch (status) {
      case EventCandidateStatus.REGISTERED:
        return 4;
      case EventCandidateStatus.CLAIMED:
        return 3;
      case EventCandidateStatus.IMPORTED:
        return 2;
      case EventCandidateStatus.REJECTED:
      default:
        return 1;
    }
  }

  private getCandidateConflictFields(rows: Array<{
    classGroup: string | null;
    classShepherds: string | null;
    mobileNumber: string | null;
    cleanMobile: string | null;
    cmpATaken: string | null;
    notes: string | null;
    status: EventCandidateStatus;
  }>): string[] {
    const conflicts: string[] = [];
    const hasDiff = <T>(values: T[]) => new Set(values.map((v) => (v ?? null) as T)).size > 1;

    if (hasDiff(rows.map((r) => r.status))) conflicts.push('status');
    if (hasDiff(rows.map((r) => r.classGroup))) conflicts.push('classGroup');
    if (hasDiff(rows.map((r) => r.classShepherds))) conflicts.push('classShepherds');
    if (hasDiff(rows.map((r) => r.mobileNumber))) conflicts.push('mobileNumber');
    if (hasDiff(rows.map((r) => r.cleanMobile))) conflicts.push('cleanMobile');
    if (hasDiff(rows.map((r) => r.cmpATaken))) conflicts.push('cmpATaken');
    if (hasDiff(rows.map((r) => r.notes))) conflicts.push('notes');

    return conflicts;
  }

  private parseCandidateClass(candidateClass: string): { encounterType: string; classNumber: number } {
    const raw = String(candidateClass || '').trim().toUpperCase();
    const m = raw.match(/^([A-Z]{1,4})\s*[- ]?\s*(\d{1,3})$/);
    if (!m) {
      throw new BadRequestException(`Invalid Candidate Class format: "${candidateClass}"`);
    }
    const classNumber = parseInt(m[2], 10);
    if (isNaN(classNumber) || classNumber < 1 || classNumber > 999) {
      throw new BadRequestException(`Invalid class number in Candidate Class: "${candidateClass}"`);
    }
    return { encounterType: m[1], classNumber };
  }

  private deriveCityCode(location?: string | null): string {
    const letters = String(location || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (!letters) return 'CEB';
    return letters.substring(0, 3).padEnd(3, 'X');
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


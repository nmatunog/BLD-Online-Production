import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { BunnyCDNService } from '../common/services/bunnycdn.service';
import {
  isValidMinistryForApostolate,
  isValidApostolate,
  normalizeApostolate,
  normalizeMinistry,
} from '../common/constants/organization.constants';

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private bunnyCDN: BunnyCDNService,
  ) {}

  async create(createMemberDto: CreateMemberDto, userId: string) {
    // Check if user already has a member profile
    const existingMember = await this.prisma.member.findUnique({
      where: { userId },
    });

    if (existingMember) {
      throw new ConflictException('User already has a member profile');
    }

    // Validate apostolate and ministry relationship
    if (createMemberDto.apostolate) {
      if (!isValidApostolate(createMemberDto.apostolate)) {
        throw new BadRequestException(
          `Invalid apostolate: ${createMemberDto.apostolate}. Must be one of the valid BLD Cebu apostolates.`,
        );
      }

      if (createMemberDto.ministry && !isValidMinistryForApostolate(createMemberDto.ministry, createMemberDto.apostolate)) {
        throw new BadRequestException(
          `Ministry "${createMemberDto.ministry}" does not belong to apostolate "${createMemberDto.apostolate}". Please select a valid ministry for this apostolate.`,
        );
      }
    }

    // Generate Community ID
    const communityId = await this.generateCommunityId(
      createMemberDto.city,
      createMemberDto.encounterType,
      createMemberDto.classNumber,
    );

    // Parse class number
    const classNum = parseInt(createMemberDto.classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      throw new BadRequestException(
        'Class number must be between 1 and 999',
      );
    }

    // Create member
    const member = await this.prisma.member.create({
      data: {
        userId,
        firstName: createMemberDto.firstName,
        lastName: createMemberDto.lastName,
        middleName: createMemberDto.middleName || null,
        suffix: createMemberDto.suffix || null,
        nickname: createMemberDto.nickname || null,
        communityId,
        city: createMemberDto.city.toUpperCase(),
        encounterType: createMemberDto.encounterType.toUpperCase(),
        classNumber: classNum,
        apostolate: createMemberDto.apostolate || null,
        ministry: createMemberDto.ministry || null,
        serviceArea: createMemberDto.serviceArea || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    // Generate QR code
    const qrCodeUrl = await this.generateQRCode(member.id, communityId);
    await this.prisma.member.update({
      where: { id: member.id },
      data: { qrCodeUrl },
    });

    return {
      ...member,
      qrCodeUrl,
    };
  }

  async findAll(
    query: MemberQueryDto,
    currentUser?: {
      role: string;
      ministry?: string;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ) {
    const {
      search,
      city,
      encounterType,
      ministry,
      apostolate,
      sortBy,
      sortOrder,
      page = 1,
      limit = 50,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.MemberWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { communityId: { contains: search.toUpperCase(), mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.city = { equals: city.toUpperCase(), mode: 'insensitive' };
    }

    if (encounterType) {
      where.encounterType = {
        equals: encounterType.toUpperCase(),
        mode: 'insensitive',
      };
    }

    // Filter by class number if provided (for CLASS_SHEPHERD)
    if (query.classNumber) {
      const classNum = parseInt(query.classNumber, 10);
      if (!isNaN(classNum)) {
        where.classNumber = classNum;
      }
    }

    if (ministry) {
      where.ministry = { contains: ministry, mode: 'insensitive' };
    }

    if (apostolate) {
      where.apostolate = { contains: apostolate, mode: 'insensitive' };
    }

    // Auto-filter by encounter class for CLASS_SHEPHERD
    // Note: Class Shepherds shepherd a DIFFERENT class than their own
    // e.g., A person from ME Class 18 can be assigned to shepherd ME Class 101
    // The shepherdEncounterType and shepherdClassNumber store the class they shepherd, NOT their own class
    if (currentUser?.role === 'CLASS_SHEPHERD' && currentUser.shepherdEncounterType && currentUser.shepherdClassNumber) {
      where.encounterType = {
        equals: currentUser.shepherdEncounterType.toUpperCase(),
        mode: 'insensitive',
      };
      where.classNumber = currentUser.shepherdClassNumber;
    }

    // Build orderBy
    let orderBy: Prisma.MemberOrderByWithRelationInput | Prisma.MemberOrderByWithRelationInput[] = {};
    switch (sortBy) {
      case 'name':
        orderBy = [
          { lastName: sortOrder || 'asc' },
          { firstName: sortOrder || 'asc' },
        ];
        break;
      case 'communityId':
        orderBy = { communityId: sortOrder || 'asc' };
        break;
      case 'city':
        orderBy = { city: sortOrder || 'asc' };
        break;
      case 'encounterType':
        orderBy = { encounterType: sortOrder || 'asc' };
        break;
      case 'createdAt':
        orderBy = { createdAt: sortOrder || 'desc' };
        break;
      default:
        orderBy = [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ];
    }

    // Execute query
    const [members, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              shepherdEncounterType: true,
              shepherdClassNumber: true,
              ministry: true,
            },
          },
        },
        orderBy: orderBy,
        skip,
        take: limit,
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
        attendances: {
          take: 10,
          orderBy: { checkInTime: 'desc' },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        registrations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    return member;
  }

  async findByCommunityId(communityId: string) {
    const member = await this.prisma.member.findUnique({
      where: { communityId: communityId.toUpperCase() },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with Community ID "${communityId}" not found`,
      );
    }

    return member;
  }

  async findMe(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    return member;
  }

  async update(
    id: string,
    updateMemberDto: UpdateMemberDto,
    options?: { allowCommunityId?: boolean },
  ) {
    const member = await this.findOne(id); // Verify member exists

    // Normalize apostolate/ministry to canonical form (case-insensitive, trim) so production always matches
    const rawApostolate = updateMemberDto.apostolate !== undefined ? updateMemberDto.apostolate : member.apostolate;
    const rawMinistry = updateMemberDto.ministry !== undefined ? updateMemberDto.ministry : member.ministry;
    const apostolate = rawApostolate ? normalizeApostolate(rawApostolate) ?? rawApostolate : null;
    const ministry = rawMinistry && apostolate ? normalizeMinistry(rawMinistry, apostolate) ?? rawMinistry : rawMinistry ?? null;

    if (apostolate) {
      if (!isValidApostolate(apostolate)) {
        throw new BadRequestException(
          `Invalid apostolate: ${rawApostolate}. Must be one of the valid BLD Cebu apostolates.`,
        );
      }

      if (ministry && !isValidMinistryForApostolate(ministry, apostolate)) {
        throw new BadRequestException(
          `Ministry "${rawMinistry}" does not belong to apostolate "${apostolate}". Please select a valid ministry for this apostolate.`,
        );
      }
    }

    const updateData: Prisma.MemberUpdateInput = {};
    const userUpdateData: Prisma.UserUpdateInput = {};

    // Update member fields
    if (updateMemberDto.firstName !== undefined) {
      updateData.firstName = updateMemberDto.firstName;
    }
    if (updateMemberDto.lastName !== undefined) {
      updateData.lastName = updateMemberDto.lastName;
    }
    if (updateMemberDto.middleName !== undefined) {
      updateData.middleName = updateMemberDto.middleName || null;
    }
    if (updateMemberDto.suffix !== undefined) {
      updateData.suffix = updateMemberDto.suffix || null;
    }
    if (updateMemberDto.nickname !== undefined) {
      updateData.nickname = updateMemberDto.nickname || null;
    }
    if (options?.allowCommunityId && updateMemberDto.communityId !== undefined) {
      const raw = updateMemberDto.communityId != null ? String(updateMemberDto.communityId).trim() : '';
      if (raw) {
        const existing = await this.prisma.member.findFirst({
          where: { communityId: raw, id: { not: id } },
        });
        if (existing) {
          throw new BadRequestException(
            `Community ID "${raw}" is already in use by another member.`,
          );
        }
        updateData.communityId = raw;
      }
    }
    if (updateMemberDto.city !== undefined) {
      const cityVal = updateMemberDto.city != null ? String(updateMemberDto.city).trim() : '';
      updateData.city = cityVal ? cityVal.toUpperCase() : member.city;
    }
    if (updateMemberDto.encounterType !== undefined) {
      const etVal = updateMemberDto.encounterType != null ? String(updateMemberDto.encounterType).trim() : '';
      updateData.encounterType = etVal ? etVal.toUpperCase() : member.encounterType;
    }
    if (updateMemberDto.classNumber !== undefined && updateMemberDto.classNumber !== '') {
      const raw = String(updateMemberDto.classNumber).trim();
      const classNum = raw ? parseInt(raw, 10) : NaN;
      if (isNaN(classNum) || classNum < 1 || classNum > 999) {
        throw new BadRequestException(
          'Class number must be between 1 and 999',
        );
      }
      updateData.classNumber = classNum;
    }
    if (updateMemberDto.apostolate !== undefined) {
      updateData.apostolate = apostolate ?? (updateMemberDto.apostolate || null);
    }
    if (updateMemberDto.ministry !== undefined) {
      updateData.ministry = ministry ?? (updateMemberDto.ministry || null);
    }
    if (updateMemberDto.serviceArea !== undefined) {
      updateData.serviceArea = updateMemberDto.serviceArea || null;
    }
    if (updateMemberDto.photoUrl !== undefined) {
      updateData.photoUrl = updateMemberDto.photoUrl || null;
    }
    if (updateMemberDto.gender !== undefined) {
      updateData.gender = updateMemberDto.gender ? String(updateMemberDto.gender).trim() || null : null;
    }
    if (updateMemberDto.profession !== undefined) {
      updateData.profession = updateMemberDto.profession ? String(updateMemberDto.profession).trim() || null : null;
    }
    if (updateMemberDto.civilStatus !== undefined) {
      updateData.civilStatus = updateMemberDto.civilStatus ? String(updateMemberDto.civilStatus).trim() || null : null;
    }
    if (updateMemberDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = updateMemberDto.dateOfBirth ? String(updateMemberDto.dateOfBirth).trim() || null : null;
    }
    if (updateMemberDto.spouseName !== undefined) {
      updateData.spouseName = updateMemberDto.spouseName ? String(updateMemberDto.spouseName).trim() || null : null;
    }
    if (updateMemberDto.dateOfMarriage !== undefined) {
      updateData.dateOfMarriage = updateMemberDto.dateOfMarriage ? String(updateMemberDto.dateOfMarriage).trim() || null : null;
    }
    if (updateMemberDto.numberOfChildren !== undefined) {
      const n = Number(updateMemberDto.numberOfChildren);
      updateData.numberOfChildren = Number.isInteger(n) && n >= 0 ? n : null;
    }
    if (updateMemberDto.children !== undefined) {
      updateData.children = Array.isArray(updateMemberDto.children) ? updateMemberDto.children : Prisma.JsonNull;
    }
    if (updateMemberDto.dateOfEncounter !== undefined) {
      updateData.dateOfEncounter = updateMemberDto.dateOfEncounter ? String(updateMemberDto.dateOfEncounter).trim() || null : null;
    }

    // Update user fields (email and phone); normalize email to lowercase for consistent uniqueness
    if (updateMemberDto.email !== undefined) {
      const raw = updateMemberDto.email ? String(updateMemberDto.email).trim() : '';
      userUpdateData.email = raw ? raw.toLowerCase() : null;
    }
    if (updateMemberDto.phone !== undefined) {
      // Normalize phone number if provided
      userUpdateData.phone = updateMemberDto.phone 
        ? normalizePhoneNumber(updateMemberDto.phone) 
        : null;
    }

    // Update both member and user in a transaction
    try {
      return await this.prisma.$transaction(async (tx) => {
        // If taking over email/phone from an inactive account, clear it from the inactive user first
        const newEmail = userUpdateData.email != null ? String(userUpdateData.email).trim() : '';
        if (newEmail) {
          // Match inactive users by email (case-insensitive) so we clear regardless of casing
          const inactiveWithEmail = await tx.user.findMany({
            where: {
              id: { not: member.userId },
              isActive: false,
              email: { not: null },
            },
            select: { id: true, email: true },
          });
          const toClear = inactiveWithEmail.filter(
            (u) => u.email && u.email.toLowerCase() === newEmail.toLowerCase(),
          );
          for (const u of toClear) {
            await tx.user.update({ where: { id: u.id }, data: { email: null } });
          }
        }
        const newPhone = userUpdateData.phone != null ? String(userUpdateData.phone).trim() : '';
        if (newPhone) {
          await tx.user.updateMany({
            where: {
              phone: newPhone,
              id: { not: member.userId },
              isActive: false,
            },
            data: { phone: null },
          });
        }

        // Update user if there are user fields to update
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: member.userId },
            data: userUpdateData,
          });
        }

        // Update member
        return tx.member.update({
          where: { id },
          data: updateData,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                shepherdEncounterType: true,
                shepherdClassNumber: true,
                ministry: true,
              },
            },
          },
        });
      });
    } catch (e: unknown) {
      // Never leak 500: convert all errors to HTTP exceptions with a safe message
      const prismaError = e as { code?: string; meta?: { target?: string[] }; message?: string };
      if (prismaError?.code === 'P2002' && prismaError?.meta?.target) {
        const target = prismaError.meta.target as string[];
        if (target?.includes('email')) {
          throw new ConflictException('This email is already in use by another account.');
        }
        if (target?.includes('phone')) {
          throw new ConflictException('This phone number is already in use by another account.');
        }
        if (target?.includes('communityId')) {
          throw new BadRequestException('This Community ID is already in use by another member.');
        }
      }
      // Any other Prisma or runtime error → 400 with safe message (never 500)
      throw new BadRequestException(
        'Profile update failed. Please check your entries (apostolate, ministry, class number) and try again.',
      );
    }
  }

  async remove(id: string, currentUserId?: string) {
    const member = await this.findOne(id);

    if (currentUserId && member.userId === currentUserId) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }

    // Soft delete by deactivating the user
    await this.prisma.user.update({
      where: { id: member.userId },
      data: { isActive: false },
    });

    return { message: 'Member deactivated successfully' };
  }

  /**
   * Permanently delete a member and their user account. Only allowed when the account is already deactivated.
   */
  async permanentDelete(id: string, currentUserId?: string) {
    const member = await this.findOne(id);

    if (currentUserId && member.userId === currentUserId) {
      throw new ForbiddenException('You cannot permanently delete your own account.');
    }

    const user = member.user as { isActive?: boolean } | undefined;
    if (user?.isActive !== false) {
      throw new BadRequestException(
        'Account must be deactivated before it can be permanently removed. Deactivate the member first, then remove permanently.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete member first (cascades Attendance; EventRegistration.memberId set null by schema)
      await tx.member.delete({ where: { id } });
      // Then delete user (cascades Session, EventClassShepherd)
      await tx.user.delete({ where: { id: member.userId } });
    });

    return { message: 'Member and account permanently removed.' };
  }

  async regenerateQRCode(id: string) {
    const member = await this.findOne(id);
    const qrCodeUrl = await this.generateQRCode(member.id, member.communityId);

    return this.prisma.member.update({
      where: { id },
      data: { qrCodeUrl },
      select: {
        id: true,
        communityId: true,
        qrCodeUrl: true,
      },
    });
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

  private async generateQRCode(
    memberId: string,
    communityId: string,
  ): Promise<string> {
    try {
      // Generate QR code data URL
      const qrData = JSON.stringify({
        memberId,
        communityId,
        type: 'member',
      });

      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      // Upload to BunnyCDN if configured, otherwise use data URL
      if (this.bunnyCDN.isConfigured()) {
        try {
          return await this.bunnyCDN.uploadQRCode(
            qrCodeDataUrl,
            'member',
            memberId,
          );
        } catch (error) {
          // Fallback to data URL if BunnyCDN upload fails
          console.warn('BunnyCDN upload failed, using data URL:', error);
          return qrCodeDataUrl;
        }
      }

      // Return data URL if BunnyCDN is not configured
      return qrCodeDataUrl;
    } catch (error) {
      throw new BadRequestException('Failed to generate QR code');
    }
  }
}

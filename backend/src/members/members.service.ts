import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { Prisma, UserRole } from '@prisma/client';
import QRCode from 'qrcode';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { BunnyCDNService } from '../common/services/bunnycdn.service';
import {
  isValidMinistryForApostolate,
  isValidApostolate,
  normalizeApostolate,
  normalizeMinistry,
} from '../common/constants/organization.constants';

/** Inputs that map to Cebu (Community ID starts with CEB) */
const CEBU_ALIASES = ['talisay', 'don bosco', 'holy family', 'schoenstatt'];
const KNOWN_CITY_CODES = ['CEB', 'BAL', 'DAN', 'DUM', 'ORM', 'MAN'];

/**
 * Normalize city to 3-letter code for storage and Community ID.
 * Talisay, Don Bosco, Holy Family, Schoenstatt → CEB.
 */
function normalizeCityToCode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (CEBU_ALIASES.some((alias) => lower.includes(alias))) return 'CEB';
  const upper = raw.toUpperCase();
  if (KNOWN_CITY_CODES.includes(upper)) return upper;
  return upper.substring(0, 3);
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

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

    const cityCode = normalizeCityToCode(createMemberDto.city);
    if (!cityCode) {
      throw new BadRequestException('City or location is required.');
    }

    // Generate Community ID (uses 3-letter city code)
    const communityId = await this.generateCommunityId(
      cityCode,
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

    // Create member (store 3-letter city code)
    const member = await this.prisma.member.create({
      data: {
        userId,
        firstName: createMemberDto.firstName,
        lastName: createMemberDto.lastName,
        middleName: createMemberDto.middleName || null,
        suffix: createMemberDto.suffix || null,
        nickname: createMemberDto.nickname || null,
        communityId,
        city: cityCode,
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
      firstName,
      lastName,
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

    if (firstName?.trim()) {
      where.firstName = { contains: firstName.trim(), mode: 'insensitive' };
    }

    if (lastName?.trim()) {
      where.lastName = { contains: lastName.trim(), mode: 'insensitive' };
    }

    if (search && !firstName?.trim() && !lastName?.trim()) {
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

    if (query.role || query.isActive !== undefined) {
      where.user = {};
      if (query.role) (where.user as Prisma.UserWhereInput).role = query.role as UserRole;
      if (query.isActive !== undefined) (where.user as Prisma.UserWhereInput).isActive = query.isActive;
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

    // Backfill missing QR code for existing members
    if (!member.qrCodeUrl) {
      try {
        const qrCodeUrl = await this.generateQRCode(member.id, member.communityId);
        await this.prisma.member.update({
          where: { id: member.id },
          data: { qrCodeUrl },
        });
        member.qrCodeUrl = qrCodeUrl;
      } catch (error) {
        console.warn(`Failed to generate QR code for ${member.communityId}:`, error);
      }
    }

    // Lazy backfill: migrate data:image/ qrCodeUrl to BunnyCDN when configured
    if (this.bunnyCDN.isConfigured() && member.qrCodeUrl?.startsWith('data:image/')) {
      try {
        const qrCodeUrl = await this.generateQRCode(member.id, member.communityId);
        await this.prisma.member.update({
          where: { id: member.id },
          data: { qrCodeUrl },
        });
        member.qrCodeUrl = qrCodeUrl;
        this.logger.log(`Migrated QR code to CDN for ${member.communityId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to backfill QR code to CDN for ${member.communityId}:`,
          error,
        );
      }
    }

    // Lazy backfill: migrate data:image/ photoUrl to BunnyCDN when configured
    if (this.bunnyCDN.isConfigured() && member.photoUrl?.startsWith('data:image/')) {
      try {
        const cdnUrl = await this.bunnyCDN.uploadMemberPhoto(
          member.photoUrl,
          member.communityId,
          'image/jpeg',
        );
        await this.prisma.member.update({
          where: { id: member.id },
          data: { photoUrl: cdnUrl },
        });
        member.photoUrl = cdnUrl;
        this.logger.log(`Migrated photo to CDN for ${member.communityId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to backfill photo to CDN for ${member.communityId}:`,
          error,
        );
      }
    }

    // Soft-fix: rewrite photoUrl/qrCodeUrl missing https:// scheme
    const updates: { photoUrl?: string; qrCodeUrl?: string } = {};
    if (member.photoUrl && !member.photoUrl.startsWith('data:') && !member.photoUrl.startsWith('http://') && !member.photoUrl.startsWith('https://')) {
      if (/^[\w.-]+\.[\w.-]+\//.test(member.photoUrl) || member.photoUrl.includes('.b-cdn.net/')) {
        updates.photoUrl = `https://${member.photoUrl}`;
        member.photoUrl = updates.photoUrl;
      }
    }
    if (member.qrCodeUrl && !member.qrCodeUrl.startsWith('data:') && !member.qrCodeUrl.startsWith('http://') && !member.qrCodeUrl.startsWith('https://')) {
      if (/^[\w.-]+\.[\w.-]+\//.test(member.qrCodeUrl) || member.qrCodeUrl.includes('.b-cdn.net/')) {
        updates.qrCodeUrl = `https://${member.qrCodeUrl}`;
        member.qrCodeUrl = updates.qrCodeUrl;
      }
    }
    if (Object.keys(updates).length > 0) {
      try {
        await this.prisma.member.update({
          where: { id: member.id },
          data: updates,
        });
        this.logger.log(`Fixed scheme-less URLs for ${member.communityId}`);
      } catch (error) {
        this.logger.warn(`Failed to fix URLs for ${member.communityId}:`, error);
      }
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
      updateData.city = cityVal ? normalizeCityToCode(cityVal) : member.city;
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

    // Try to get existing counter
    let counter = await this.prisma.communityIdCounter.findUnique({
      where: {
        cityCode_encounterCode_classNumber: {
          cityCode,
          encounterCode,
          classNumber: parsedClassNumber,
        },
      },
    });
    
    if (!counter) {
      // First time for this class: seed from existing members' max sequence
      const existingMembers = await this.prisma.member.findMany({
        where: {
          city: cityCode,
          encounterType: encounterCode,
          classNumber: parsedClassNumber,
        },
        select: { communityId: true },
      });
      
      let maxSequence = 0;
      if (existingMembers.length > 0) {
        const sequences = existingMembers
          .map((m) => {
            const match = m.communityId.match(/\d{2}$/);
            return match ? parseInt(match[0], 10) : 0;
          })
          .filter((seq) => seq > 0);
        if (sequences.length > 0) {
          maxSequence = Math.max(...sequences);
        }
      }
      
      // Create counter seeded with max+1, or 1 if no members exist
      try {
        counter = await this.prisma.communityIdCounter.create({
          data: {
            cityCode,
            encounterCode,
            classNumber: parsedClassNumber,
            nextSequence: maxSequence + 1,
          },
        });
      } catch (error) {
        // Race: another request created it first, fetch and use it
        counter = await this.prisma.communityIdCounter.findUniqueOrThrow({
          where: {
            cityCode_encounterCode_classNumber: {
              cityCode,
              encounterCode,
              classNumber: parsedClassNumber,
            },
          },
        });
      }
    }
    
    // Atomically increment and get next sequence
    const updated = await this.prisma.communityIdCounter.update({
      where: {
        cityCode_encounterCode_classNumber: {
          cityCode,
          encounterCode,
          classNumber: parsedClassNumber,
        },
      },
      data: {
        nextSequence: { increment: 1 },
      },
    });
    
    const nextSequence = updated.nextSequence - 1;

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
      // Generate QR code with plain Community ID string (e.g., "CEB-ME1002")
      // This matches the format expected by the check-in scanner
      // The scanner calls qrUtils.extractMemberData() which accepts plain Community ID strings
      const qrCodeDataUrl = await QRCode.toDataURL(communityId, {
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

  /**
   * Store a processed ID photo. Prefers BunnyCDN; falls back to a compressed JPEG data URL
   * so signup still works when CDN env vars are missing.
   */
  async savePhoto(
    memberId: string,
    file: { buffer: Buffer; mimetype?: string } | string,
  ): Promise<{ photoUrl: string }> {
    const member = await this.findOne(memberId);

    let buffer: Buffer;
    let contentType = 'image/jpeg';

    if (typeof file === 'string') {
      if (!file.startsWith('data:image/')) {
        throw new BadRequestException('Photo must be an image data URL');
      }
      const match = file.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        throw new BadRequestException('Invalid photo data URL');
      }
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = file.buffer;
      contentType = file.mimetype || 'image/jpeg';
    }

    if (!buffer?.length) {
      throw new BadRequestException('Photo file is empty');
    }
    if (buffer.length > 2.5 * 1024 * 1024) {
      throw new BadRequestException('Photo is too large (max 2.5 MB after processing)');
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(contentType)) {
      throw new BadRequestException('Photo must be JPEG, PNG, or WebP');
    }

    let photoUrl: string;
    if (this.bunnyCDN.isConfigured()) {
      try {
        photoUrl = await this.bunnyCDN.uploadMemberPhoto(buffer, member.communityId, contentType);
      } catch (error) {
        console.warn('BunnyCDN photo upload failed, storing data URL:', error);
        photoUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    } else {
      photoUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    await this.prisma.member.update({
      where: { id: memberId },
      data: { photoUrl },
    });

    return { photoUrl };
  }
}

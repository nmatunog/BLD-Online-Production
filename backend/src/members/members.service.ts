import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { BunnyCDNService } from '../common/services/bunnycdn.service';

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

  async update(id: string, updateMemberDto: UpdateMemberDto) {
    const member = await this.findOne(id); // Verify member exists

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
    if (updateMemberDto.city !== undefined) {
      updateData.city = updateMemberDto.city.toUpperCase();
    }
    if (updateMemberDto.encounterType !== undefined) {
      updateData.encounterType = updateMemberDto.encounterType.toUpperCase();
    }
    if (updateMemberDto.classNumber !== undefined) {
      const classNum = parseInt(updateMemberDto.classNumber, 10);
      if (isNaN(classNum) || classNum < 1 || classNum > 999) {
        throw new BadRequestException(
          'Class number must be between 1 and 999',
        );
      }
      updateData.classNumber = classNum;
    }
    if (updateMemberDto.apostolate !== undefined) {
      updateData.apostolate = updateMemberDto.apostolate || null;
    }
    if (updateMemberDto.ministry !== undefined) {
      updateData.ministry = updateMemberDto.ministry || null;
    }
    if (updateMemberDto.serviceArea !== undefined) {
      updateData.serviceArea = updateMemberDto.serviceArea || null;
    }
    if (updateMemberDto.photoUrl !== undefined) {
      updateData.photoUrl = updateMemberDto.photoUrl || null;
    }

    // Update user fields (email and phone)
    if (updateMemberDto.email !== undefined) {
      userUpdateData.email = updateMemberDto.email || null;
    }
    if (updateMemberDto.phone !== undefined) {
      // Normalize phone number if provided
      userUpdateData.phone = updateMemberDto.phone 
        ? normalizePhoneNumber(updateMemberDto.phone) 
        : null;
    }

    // Update both member and user in a transaction
    return this.prisma.$transaction(async (tx) => {
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
  }

  async remove(id: string) {
    const member = await this.findOne(id);

    // Soft delete by deactivating the user
    await this.prisma.user.update({
      where: { id: member.userId },
      data: { isActive: false },
    });

    return { message: 'Member deactivated successfully' };
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

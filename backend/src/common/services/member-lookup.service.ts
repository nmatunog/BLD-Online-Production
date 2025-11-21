import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Member } from '@prisma/client';

@Injectable()
export class MemberLookupService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find member by communityId (e.g., "CEB-ME1801")
   * Used for check-ins and member lookups
   */
  async findByCommunityId(communityId: string): Promise<Member> {
    const member = await this.prisma.member.findUnique({
      where: { communityId },
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

    if (!member.user.isActive) {
      throw new NotFoundException(
        `Member with Community ID "${communityId}" is inactive`,
      );
    }

    return member;
  }

  /**
   * Validate communityId format
   * Format: CITY-ENCOUNTERTYPECLASSNUMBER (e.g., "CEB-ME1801")
   */
  isValidCommunityIdFormat(communityId: string): boolean {
    const pattern = /^[A-Z]{3}-[A-Z]{2,4}\d{4}$/;
    return pattern.test(communityId);
  }

  /**
   * Normalize communityId (uppercase, trim)
   */
  normalizeCommunityId(communityId: string): string {
    return communityId.trim().toUpperCase();
  }
}


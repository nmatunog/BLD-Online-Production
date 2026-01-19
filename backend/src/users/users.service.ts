import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async assignRole(userId: string, assignRoleDto: AssignRoleDto): Promise<unknown> {
    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const originalRole = user.role;
    const originalShepherdEncounterType = user.shepherdEncounterType;
    const originalShepherdClassNumber = user.shepherdClassNumber;
    const originalMinistry = user.ministry;

    // Validate role-specific requirements
    if (assignRoleDto.role === UserRole.CLASS_SHEPHERD) {
      if (!assignRoleDto.shepherdEncounterType || !assignRoleDto.shepherdClassNumber) {
        throw new BadRequestException(
          'shepherdEncounterType and shepherdClassNumber are required for CLASS_SHEPHERD role',
        );
      }

      // Check if user is already a shepherd of a different class
      if (
        user.role === UserRole.CLASS_SHEPHERD &&
        user.shepherdEncounterType &&
        user.shepherdClassNumber &&
        (user.shepherdEncounterType.toUpperCase() !== assignRoleDto.shepherdEncounterType.toUpperCase() ||
          user.shepherdClassNumber !== assignRoleDto.shepherdClassNumber)
      ) {
        throw new ConflictException(
          `User is already assigned as Class Shepherd for ${user.shepherdEncounterType} Class ${user.shepherdClassNumber}. A member cannot be a shepherd of 2 encounter classes at the same time.`,
        );
      }
    }

    if (assignRoleDto.role === UserRole.MINISTRY_COORDINATOR) {
      if (!assignRoleDto.ministry) {
        throw new BadRequestException(
          'ministry is required for MINISTRY_COORDINATOR role',
        );
      }

      // Check if user is already a coordinator of a different ministry
      if (
        user.role === UserRole.MINISTRY_COORDINATOR &&
        user.ministry &&
        user.ministry !== assignRoleDto.ministry
      ) {
        throw new ConflictException(
          `User is already assigned as Ministry Coordinator for ${user.ministry}. Ministry coordinators can only be such for one ministry at a time.`,
        );
      }
    }

    // Prepare update data
    const updateData: {
      role: UserRole;
      shepherdEncounterType?: string | null;
      shepherdClassNumber?: number | null;
      ministry?: string | null;
    } = {
      role: assignRoleDto.role,
    };

    // Clear role-specific fields when changing roles
    if (assignRoleDto.role === UserRole.CLASS_SHEPHERD) {
      updateData.shepherdEncounterType = assignRoleDto.shepherdEncounterType?.toUpperCase() || null;
      updateData.shepherdClassNumber = assignRoleDto.shepherdClassNumber || null;
      updateData.ministry = null; // Clear ministry when assigning CLASS_SHEPHERD
    } else if (assignRoleDto.role === UserRole.MINISTRY_COORDINATOR) {
      updateData.ministry = assignRoleDto.ministry || null;
      updateData.shepherdEncounterType = null; // Clear shepherd fields when assigning MINISTRY_COORDINATOR
      updateData.shepherdClassNumber = null;
    } else {
      // For other roles, clear role-specific fields
      updateData.shepherdEncounterType = null;
      updateData.shepherdClassNumber = null;
      updateData.ministry = null;
    }

    try {
      // Update user role
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
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
      });

      return {
        ...updatedUser,
        message: `Role successfully assigned: ${assignRoleDto.role}`,
      };
    } catch (error) {
      // Rollback: restore original role and fields
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          role: originalRole,
          shepherdEncounterType: originalShepherdEncounterType,
          shepherdClassNumber: originalShepherdClassNumber,
          ministry: originalMinistry,
        },
      });

      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to assign role: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async removeRole(userId: string, roleToRemove: UserRole): Promise<unknown> {
    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Check if user has the role to remove
    if (user.role !== roleToRemove) {
      throw new BadRequestException(
        `User does not have the role ${roleToRemove} to remove`,
      );
    }

    // Remove role-specific fields and set to MEMBER
    const updateData: {
      role: UserRole;
      shepherdEncounterType?: null;
      shepherdClassNumber?: null;
      ministry?: null;
    } = {
      role: UserRole.MEMBER,
      shepherdEncounterType: null,
      shepherdClassNumber: null,
      ministry: null,
    };

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    });

    return {
      ...updatedUser,
      message: `Role ${roleToRemove} successfully removed. User is now ${UserRole.MEMBER}`,
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}


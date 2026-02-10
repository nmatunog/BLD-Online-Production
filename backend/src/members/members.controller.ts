import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Members')
@Controller('members')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER, 
    UserRole.ADMINISTRATOR, 
    UserRole.DCS, 
    UserRole.MINISTRY_COORDINATOR,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Create a new member profile' })
  @ApiResponse({ status: 201, description: 'Member created successfully' })
  @ApiResponse({ status: 409, description: 'User already has a member profile' })
  async create(
    @Body() createMemberDto: CreateMemberDto,
    @CurrentUser() user: { 
      id: string;
      role: UserRole;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    // Check if CLASS_SHEPHERD can create members (only for their assigned class)
    if (user.role === UserRole.CLASS_SHEPHERD) {
      if (user.shepherdEncounterType && user.shepherdClassNumber) {
        const createEncounterType = createMemberDto.encounterType.toUpperCase();
        const createClassNumber = parseInt(createMemberDto.classNumber, 10);
        if (
          createEncounterType !== user.shepherdEncounterType.toUpperCase() ||
          createClassNumber !== user.shepherdClassNumber
        ) {
          throw new ForbiddenException('You can only create members for your assigned encounter class');
        }
      } else {
        throw new BadRequestException('Class Shepherd assignment not configured');
      }
    }
    
    const member = await this.membersService.create(createMemberDto, user.id);
    return {
      success: true,
      data: member,
      message: 'Member created successfully',
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER,
    UserRole.ADMINISTRATOR,
    UserRole.DCS,
    UserRole.MINISTRY_COORDINATOR,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Get all members with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  async findAll(
    @Query() query: MemberQueryDto,
    @CurrentUser() user: { 
      id: string; 
      role: UserRole; 
      ministry?: string;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    // Filter by ministry if user is MINISTRY_COORDINATOR
    if (user.role === UserRole.MINISTRY_COORDINATOR && user.ministry) {
      query.ministry = user.ministry;
    }

    // Filter by encounter class if user is CLASS_SHEPHERD
    // Note: Class Shepherds shepherd a DIFFERENT class than their own
    // e.g., A person from ME Class 18 can be assigned to shepherd ME Class 101
    // The shepherdEncounterType and shepherdClassNumber store the class they shepherd, NOT their own class
    if (user.role === UserRole.CLASS_SHEPHERD && user.shepherdEncounterType && user.shepherdClassNumber) {
      query.encounterType = user.shepherdEncounterType;
      // Note: classNumber filtering will be handled in the service
      query.classNumber = user.shepherdClassNumber.toString();
    }

    const result = await this.membersService.findAll(query, user);
    return {
      success: true,
      data: result, // Return the full MembersResponse object (includes data and pagination)
      message: 'Members retrieved successfully',
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user member profile' })
  @ApiResponse({ status: 200, description: 'Member profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member profile not found' })
  async findMe(
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const member = await this.membersService.findMe(user.id);
    return {
      success: true,
      data: member,
      message: 'Member profile retrieved successfully',
    };
  }

  private readonly logger = new Logger(MembersController.name);

  @Put('me')
  @ApiOperation({ summary: 'Update current user member profile' })
  @ApiResponse({ status: 200, description: 'Member profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or update failed' })
  @ApiResponse({ status: 404, description: 'Member profile not found' })
  async updateMe(
    @CurrentUser() user: { id: string; role: string },
    @Body() updateMemberDto: UpdateMemberDto,
  ): Promise<ApiResponseDto<unknown>> {
    try {
      const member = await this.membersService.findMe(user.id);
      const dto = { ...updateMemberDto };
      if (user.role !== UserRole.SUPER_USER && dto.communityId !== undefined) {
        delete dto.communityId;
      }
      const updatedMember = await this.membersService.update(member.id, dto);
      return {
        success: true,
        data: updatedMember,
        message: 'Member profile updated successfully',
      };
    } catch (err) {
      // Re-throw known HTTP exceptions (400, 404, 409) so client gets correct status
      if (err instanceof HttpException) {
        throw err;
      }
      // Log unexpected errors; never return 500 to client for profile update
      this.logger.warn('PUT /members/me unexpected error', err instanceof Error ? err.stack : String(err));
      throw new BadRequestException(
        'Profile update failed. Please check your entries (apostolate, ministry, class number) and try again.',
      );
    }
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER,
    UserRole.ADMINISTRATOR,
    UserRole.DCS,
    UserRole.MINISTRY_COORDINATOR,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Get a member by ID' })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { 
      id: string; 
      role: UserRole;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    const member = await this.membersService.findOne(id);
    
    // Check if CLASS_SHEPHERD can access this member (must be from their class)
    if (user.role === UserRole.CLASS_SHEPHERD) {
      if (user.shepherdEncounterType && user.shepherdClassNumber) {
        if (
          member.encounterType.toUpperCase() !== user.shepherdEncounterType.toUpperCase() ||
          member.classNumber !== user.shepherdClassNumber
        ) {
          throw new ForbiddenException('You can only access members from your assigned encounter class');
        }
      } else {
        throw new BadRequestException('Class Shepherd assignment not configured');
      }
    }
    
    return {
      success: true,
      data: member,
      message: 'Member retrieved successfully',
    };
  }

  @Get('community/:communityId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER,
    UserRole.ADMINISTRATOR,
    UserRole.DCS,
    UserRole.MINISTRY_COORDINATOR,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Get a member by Community ID' })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async findByCommunityId(
    @Param('communityId') communityId: string,
    @CurrentUser() user: { 
      id: string; 
      role: UserRole;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    const member = await this.membersService.findByCommunityId(communityId);
    
    // Check if CLASS_SHEPHERD can access this member (must be from their class)
    if (user.role === UserRole.CLASS_SHEPHERD) {
      if (user.shepherdEncounterType && user.shepherdClassNumber) {
        if (
          member.encounterType.toUpperCase() !== user.shepherdEncounterType.toUpperCase() ||
          member.classNumber !== user.shepherdClassNumber
        ) {
          throw new ForbiddenException('You can only access members from your assigned encounter class');
        }
      } else {
        throw new BadRequestException('Class Shepherd assignment not configured');
      }
    }
    
    return {
      success: true,
      data: member,
      message: 'Member retrieved successfully',
    };
  }

  @Public()
  @Get('public/community/:communityId')
  @ApiOperation({ summary: 'Public member lookup by Community ID (no authentication required)' })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async publicFindByCommunityId(
    @Param('communityId') communityId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const member = await this.membersService.findByCommunityId(communityId);
    return {
      success: true,
      data: member,
      message: 'Member retrieved successfully',
    };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER, 
    UserRole.ADMINISTRATOR, 
    UserRole.DCS, 
    UserRole.MINISTRY_COORDINATOR,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Update a member profile' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async update(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @CurrentUser() user: { 
      id: string; 
      role: UserRole; 
      ministry?: string;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    const member = await this.membersService.findOne(id);
    
    // Check permissions for MINISTRY_COORDINATOR
    if (user.role === UserRole.MINISTRY_COORDINATOR) {
      if (member.ministry !== user.ministry) {
        throw new ForbiddenException('You can only edit members from your own ministry');
      }
    }
    
    // Check permissions for CLASS_SHEPHERD (must be from their assigned class)
    if (user.role === UserRole.CLASS_SHEPHERD) {
      if (user.shepherdEncounterType && user.shepherdClassNumber) {
        if (
          member.encounterType.toUpperCase() !== user.shepherdEncounterType.toUpperCase() ||
          member.classNumber !== user.shepherdClassNumber
        ) {
          throw new ForbiddenException('You can only edit members from your assigned encounter class');
        }
      } else {
        throw new BadRequestException('Class Shepherd assignment not configured');
      }
    }

    const dto = { ...updateMemberDto };
    if (user.role !== UserRole.SUPER_USER && dto.communityId !== undefined) {
      delete dto.communityId;
    }
    const updatedMember = await this.membersService.update(id, dto);
    return {
      success: true,
      data: updatedMember,
      message: 'Member updated successfully',
    };
  }

  @Delete(':id/permanent')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently remove a deactivated member and account' })
  @ApiResponse({ status: 200, description: 'Member and account permanently removed' })
  @ApiResponse({ status: 400, description: 'Account must be deactivated first' })
  @ApiResponse({ status: 403, description: 'Cannot permanently delete your own account' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.membersService.permanentDelete(id, user.id);
    return {
      success: true,
      data: result,
      message: 'Member and account permanently removed.',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a member (soft delete)' })
  @ApiResponse({ status: 200, description: 'Member deactivated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate your own account' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.membersService.remove(id, user.id);
    return {
      success: true,
      data: result,
      message: 'Member deactivated successfully',
    };
  }

  @Post(':id/qr-code/regenerate')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER, 
    UserRole.ADMINISTRATOR, 
    UserRole.DCS,
    UserRole.CLASS_SHEPHERD,
  )
  @ApiOperation({ summary: 'Regenerate QR code for a member' })
  @ApiResponse({ status: 200, description: 'QR code regenerated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async regenerateQRCode(
    @Param('id') id: string,
    @CurrentUser() user: { 
      id: string; 
      role: UserRole;
      shepherdEncounterType?: string;
      shepherdClassNumber?: number;
    },
  ): Promise<ApiResponseDto<unknown>> {
    // Check if CLASS_SHEPHERD can regenerate QR for this member
    if (user.role === UserRole.CLASS_SHEPHERD) {
      const member = await this.membersService.findOne(id);
      if (user.shepherdEncounterType && user.shepherdClassNumber) {
        if (
          member.encounterType.toUpperCase() !== user.shepherdEncounterType.toUpperCase() ||
          member.classNumber !== user.shepherdClassNumber
        ) {
          throw new ForbiddenException('You can only regenerate QR codes for members from your assigned encounter class');
        }
      } else {
        throw new BadRequestException('Class Shepherd assignment not configured');
      }
    }
    
    const result = await this.membersService.regenerateQRCode(id);
    return {
      success: true,
      data: result,
      message: 'QR code regenerated successfully',
    };
  }
}


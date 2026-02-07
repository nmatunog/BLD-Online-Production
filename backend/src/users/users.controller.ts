import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(): Promise<ApiResponseDto<unknown>> {
    const users = await this.usersService.getAllUsers();
    return {
      success: true,
      data: users,
      message: 'Users retrieved successfully',
    };
  }

  @Put(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate assignment' })
  async assignRole(
    @Param('id') userId: string,
    @Body() assignRoleDto: AssignRoleDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    // Only Super User can assign Administrator or Super User roles
    if (
      (assignRoleDto.role === UserRole.ADMINISTRATOR || assignRoleDto.role === UserRole.SUPER_USER) &&
      currentUser.role !== UserRole.SUPER_USER
    ) {
      throw new ForbiddenException('Only a Super User can assign Administrator or Super User roles');
    }
    // Prevent self-role modification to prevent lockout
    if (userId === currentUser.id && assignRoleDto.role !== currentUser.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const result = await this.usersService.assignRole(userId, assignRoleDto);
    return {
      success: true,
      data: result,
      message: 'Role assigned successfully',
    };
  }

  @Put(':id/role/remove')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove role from a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async removeRole(
    @Param('id') userId: string,
    @Body() body: { role: UserRole },
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    // Prevent self-role removal to prevent lockout
    if (userId === currentUser.id) {
      throw new ForbiddenException('You cannot remove your own role');
    }

    // Only allow removing CLASS_SHEPHERD or MINISTRY_COORDINATOR
    if (
      body.role !== UserRole.CLASS_SHEPHERD &&
      body.role !== UserRole.MINISTRY_COORDINATOR
    ) {
      throw new BadRequestException('Can only remove CLASS_SHEPHERD or MINISTRY_COORDINATOR roles');
    }

    const result = await this.usersService.removeRole(userId, body.role);
    return {
      success: true,
      data: result,
      message: 'Role removed successfully',
    };
  }
}


import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInQrDto } from './dto/check-in-qr.dto';
import { PublicCheckInDto } from './dto/public-check-in.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Check in a member to an event' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Member or event not found' })
  @ApiResponse({ status: 409, description: 'Already checked in' })
  async checkIn(
    @Body() createAttendanceDto: CreateAttendanceDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    const attendance = await this.attendanceService.checkIn(
      createAttendanceDto,
      user.id,
      user.role,
    );
    return {
      success: true,
      data: attendance,
      message: 'Check-in successful',
    };
  }

  @Post('check-in/qr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Check in using QR code (Community ID)' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Invalid QR code' })
  @ApiResponse({ status: 404, description: 'Member or event not found' })
  @ApiResponse({ status: 409, description: 'Already checked in' })
  async checkInByQR(
    @Body() checkInQrDto: CheckInQrDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    const attendance = await this.attendanceService.checkInByQR(
      checkInQrDto.communityId,
      checkInQrDto.eventId,
      user.id,
      user.role,
    );
    return {
      success: true,
      data: attendance,
      message: 'Check-in successful',
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER,
    UserRole.ADMINISTRATOR,
    UserRole.DCS,
    UserRole.MINISTRY_COORDINATOR,
  )
  @ApiOperation({ summary: 'Get all attendance records with filters' })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  async findAll(
    @Query() query: AttendanceQueryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.attendanceService.findAll(query);
    return {
      success: true,
      data: result.data,
      message: 'Attendance records retrieved successfully',
    };
  }

  @Get('event/:eventId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_USER,
    UserRole.ADMINISTRATOR,
    UserRole.DCS,
    UserRole.MINISTRY_COORDINATOR,
  )
  @ApiOperation({ summary: 'Get attendance records for a specific event' })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  async findByEvent(@Param('eventId') eventId: string): Promise<ApiResponseDto<unknown>> {
    const attendances = await this.attendanceService.findByEvent(eventId);
    return {
      success: true,
      data: attendances,
      message: 'Attendance records retrieved successfully',
    };
  }

  @Get('member/:memberId')
  @ApiOperation({ summary: 'Get attendance records for a specific member' })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  async findByMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    // Members can only view their own attendance
    if (user.role === UserRole.MEMBER) {
      const member = await this.attendanceService.getMemberByUserId(user.id);
      if (member.id !== memberId) {
        throw new ForbiddenException('You can only view your own attendance records');
      }
    }

    const attendances = await this.attendanceService.findByMember(memberId);
    return {
      success: true,
      data: attendances,
      message: 'Attendance records retrieved successfully',
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user attendance records' })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved successfully' })
  async findMe(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<unknown>> {
    const attendances = await this.attendanceService.findMe(user.id);
    return {
      success: true,
      data: attendances,
      message: 'Attendance records retrieved successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a check-in record' })
  @ApiResponse({ status: 200, description: 'Check-in removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Attendance record not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ): Promise<ApiResponseDto<unknown>> {
    const attendance = await this.attendanceService.remove(id, user.id, user.role);
    return {
      success: true,
      data: attendance,
      message: 'Check-in removed successfully',
    };
  }

  @Get('event/:eventId/stats')
  @ApiOperation({ summary: 'Get attendance statistics for an event' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getEventStats(@Param('eventId') eventId: string): Promise<ApiResponseDto<unknown>> {
    const stats = await this.attendanceService.getEventStats(eventId);
    return {
      success: true,
      data: stats,
      message: 'Statistics retrieved successfully',
    };
  }

  @Public()
  @Post('public/check-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public check-in (no authentication required)' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Member or event not found' })
  @ApiResponse({ status: 409, description: 'Already checked in' })
  async publicCheckIn(
    @Body() publicCheckInDto: PublicCheckInDto,
  ): Promise<ApiResponseDto<unknown>> {
    const attendance = await this.attendanceService.publicCheckIn(
      publicCheckInDto.communityId,
      publicCheckInDto.eventId,
    );
    return {
      success: true,
      data: attendance,
      message: 'Check-in successful',
    };
  }
}


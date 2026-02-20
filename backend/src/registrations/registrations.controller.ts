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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { RegisterNonMemberDto } from './dto/register-non-member.dto';
import { RegisterCoupleDto } from './dto/register-couple.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdateRoomAssignmentDto } from './dto/update-room-assignment.dto';
import { RegistrationQueryDto } from './dto/registration-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Registrations')
@Controller('registrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('events/:eventId/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Register a member for an event' })
  @ApiResponse({ status: 201, description: 'Member registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid registration data or event full' })
  @ApiResponse({ status: 404, description: 'Event or member not found' })
  @ApiResponse({ status: 409, description: 'Member already registered' })
  async registerMember(
    @Param('eventId') eventId: string,
    @Body() registerMemberDto: RegisterMemberDto,
  ): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.registerMember(
      eventId,
      registerMemberDto,
    );
    return {
      success: true,
      data: registration,
      message: 'Member registered successfully',
    };
  }

  @Post('events/:eventId/non-members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Register a non-member for an event' })
  @ApiResponse({ status: 201, description: 'Non-member registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid registration data or event full' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async registerNonMember(
    @Param('eventId') eventId: string,
    @Body() registerNonMemberDto: RegisterNonMemberDto,
  ): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.registerNonMember(
      eventId,
      registerNonMemberDto,
    );
    return {
      success: true,
      data: registration,
      message: 'Non-member registered successfully',
    };
  }

  @Post('events/:eventId/couples')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Register a couple for an event (ME events)' })
  @ApiResponse({ status: 201, description: 'Couple registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid registration data or event full' })
  @ApiResponse({ status: 404, description: 'Event or members not found' })
  @ApiResponse({ status: 409, description: 'One or both members already registered' })
  async registerCouple(
    @Param('eventId') eventId: string,
    @Body() registerCoupleDto: RegisterCoupleDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.registrationsService.registerCouple(
      eventId,
      registerCoupleDto,
    );
    return {
      success: true,
      data: result,
      message: 'Couple registered successfully',
    };
  }

  @Get('events/:eventId/registrations-and-summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Get registrations and summary for an event (one call)' })
  @ApiResponse({ status: 200, description: 'Registrations and summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findAllWithSummary(
    @Param('eventId') eventId: string,
    @Query() query: RegistrationQueryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.registrationsService.findAllWithSummary(eventId, query);
    return {
      success: true,
      data: result,
      message: 'Registrations and summary retrieved successfully',
    };
  }

  @Get('events/:eventId/registrations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Get all registrations for an event' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: RegistrationQueryDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.registrationsService.findAll(eventId, query);
    return {
      success: true,
      data: result,
      message: 'Registrations retrieved successfully',
    };
  }

  @Get('events/:eventId/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Get registration summary for an event' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getSummary(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const summary = await this.registrationsService.getSummary(eventId);
    return {
      success: true,
      data: summary,
      message: 'Summary retrieved successfully',
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Get a registration by ID' })
  @ApiResponse({ status: 200, description: 'Registration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async findOne(@Param('id') id: string): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.findOne(id);
    return {
      success: true,
      data: registration,
      message: 'Registration retrieved successfully',
    };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR, UserRole.CLASS_SHEPHERD)
  @ApiOperation({ summary: 'Update a registration' })
  @ApiResponse({ status: 200, description: 'Registration updated successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async update(
    @Param('id') id: string,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.update(
      id,
      updateRegistrationDto,
    );
    return {
      success: true,
      data: registration,
      message: 'Registration updated successfully',
    };
  }

  @Put(':id/payment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({ summary: 'Update payment status for a registration' })
  @ApiResponse({ status: 200, description: 'Payment status updated successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.updatePaymentStatus(
      id,
      updatePaymentStatusDto,
    );
    return {
      success: true,
      data: registration,
      message: 'Payment status updated successfully',
    };
  }

  @Put(':id/room')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({ summary: 'Assign or update room for a registration' })
  @ApiResponse({ status: 200, description: 'Room assignment updated successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async updateRoomAssignment(
    @Param('id') id: string,
    @Body() updateRoomAssignmentDto: UpdateRoomAssignmentDto,
  ): Promise<ApiResponseDto<unknown>> {
    const registration = await this.registrationsService.updateRoomAssignment(
      id,
      updateRoomAssignmentDto,
    );
    return {
      success: true,
      data: registration,
      message: 'Room assignment updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a registration' })
  @ApiResponse({ status: 200, description: 'Registration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async delete(@Param('id') id: string): Promise<ApiResponseDto<unknown>> {
    const result = await this.registrationsService.delete(id);
    return {
      success: true,
      data: result,
      message: 'Registration deleted successfully',
    };
  }
}


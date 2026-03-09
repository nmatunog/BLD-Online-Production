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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { AssignClassShepherdDto } from './dto/assign-class-shepherd.dto';
import { CancelEventDto } from './dto/cancel-event.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { UserRole } from '@prisma/client';

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid event data' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const event = await this.eventsService.create(createEventDto, user.id);
    return {
      success: true,
      data: event,
      message: 'Event created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all events with filters and pagination (ministry-filtered by default)' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(
    @Query() query: EventQueryDto,
    @CurrentUser() user: { id: string; role: string; ministry?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.findAll(query, user);
    return {
      success: true,
      data: result,
      message: 'Events retrieved successfully',
    };
  }

  @Post('recurring/ensure-occurrences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super User only: generate future occurrence rows for all recurring templates' })
  @ApiResponse({ status: 200, description: 'Occurrences generated' })
  async ensureRecurringOccurrences(): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.ensureRecurringOccurrencesForAllTemplates();
    return {
      success: true,
      data: result,
      message: `Processed ${result.templatesProcessed} templates, created ${result.occurrencesCreated} occurrences`,
    };
  }

  @Get('super/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Super User only: get all events (recurring + non-recurring) with creator info for cleanup' })
  @ApiResponse({ status: 200, description: 'All events retrieved successfully' })
  async findAllForSuperUser(): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.findAllForSuperUser();
    return {
      success: true,
      data: result,
      message: 'All events retrieved successfully',
    };
  }

  @Get('super/audit-log')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Super User only: get event audit log (who created, edited, deleted; what changed)' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved' })
  async getAuditLog(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.getAuditLog(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return { success: true, data: result, message: 'Audit log retrieved' };
  }

  @Post('super/audit-log/:auditLogId/revert')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super User only: revert an event deletion or edit' })
  @ApiResponse({ status: 200, description: 'Reverted successfully' })
  @ApiResponse({ status: 400, description: 'Already reverted or cannot revert' })
  async revertAuditEntry(
    @Param('auditLogId') auditLogId: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.revertAuditEntry(auditLogId, user.id);
    return { success: true, data: result, message: result.message };
  }

  @Get('super/duplicates')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Super User only: find duplicate events for cleanup' })
  @ApiResponse({ status: 200, description: 'Duplicate groups retrieved' })
  async findDuplicates(): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.findDuplicates();
    return { success: true, data: result, message: 'Duplicate groups retrieved' };
  }

  @Post('super/duplicates/correct-all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super User only: keep one event per duplicate group, merge check-ins, remove the rest' })
  @ApiResponse({ status: 200, description: 'Duplicates corrected' })
  async correctAllDuplicates(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.correctAllDuplicates(user.id);
    return {
      success: true,
      data: result,
      message: `Corrected ${result.groupsProcessed} group(s): ${result.eventsRemoved} duplicate(s) removed, ${result.attendancesMerged} check-in(s) kept.`,
    };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events (general + user ministry by default)' })
  @ApiResponse({ status: 200, description: 'Upcoming events retrieved successfully' })
  async findUpcoming(
    @CurrentUser() user: { id: string; role: string; ministry?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.findAll(
      {
        status: 'UPCOMING' as any,
        sortBy: 'startDate',
        sortOrder: 'asc',
        limit: 20,
      },
      user,
    );
    return {
      success: true,
      data: result.data,
      message: 'Upcoming events retrieved successfully',
    };
  }

  // Public route must be defined BEFORE the generic :id route
  // Otherwise NestJS will match /events/public/:id to /events/:id with id="public"
  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Public event lookup by ID (no authentication required)' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async publicFindOne(@Param('id') id: string): Promise<ApiResponseDto<unknown>> {
    console.log('🔓 [PUBLIC ROUTE] Public event lookup requested for ID:', id);
    console.log('🔓 [PUBLIC ROUTE] Full path: /events/public/' + id);
    
    try {
      const event = await this.eventsService.findOne(id);
      if (!event) {
        console.error('❌ [PUBLIC ROUTE] Event not found in database:', id);
        throw new NotFoundException(`Event with ID ${id} not found`);
      }
      console.log('✅ [PUBLIC ROUTE] Event found:', event?.title);
      return {
        success: true,
        data: event,
        message: 'Event retrieved successfully',
      };
    } catch (error) {
      console.error('❌ [PUBLIC ROUTE] Error in publicFindOne:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID (ministry visibility enforced)' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied to ministry-specific event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; ministry?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const event = await this.eventsService.findOne(id, user);
    return {
      success: true,
      data: event,
      message: 'Event retrieved successfully',
    };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const event = await this.eventsService.update(id, updateEventDto, user.id);
    return {
      success: true,
      data: event,
      message: 'Event updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an event (soft delete if has dependencies)' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.remove(id, user.id);
    return {
      success: true,
      data: result,
      message: 'Event deleted successfully',
    };
  }

  @Post(':id/qr-code/regenerate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Regenerate QR code for an event' })
  @ApiResponse({ status: 200, description: 'QR code regenerated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async regenerateQRCode(@Param('id') id: string): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.regenerateQRCode(id);
    return {
      success: true,
      data: { qrCodeUrl: result },
      message: 'QR code regenerated successfully',
    };
  }

  @Post('status/update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Update event statuses based on current date/time' })
  @ApiResponse({ status: 200, description: 'Event statuses updated successfully' })
  async updateStatuses(): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.updateEventStatuses();
    return {
      success: true,
      data: result,
      message: 'Event statuses updated successfully',
    };
  }

  @Post(':id/class-shepherds')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @ApiOperation({ summary: 'Assign a Class Shepherd to an Encounter Event for a specific encounter class' })
  @ApiResponse({ status: 201, description: 'Class Shepherd assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid assignment or maximum shepherds reached' })
  @ApiResponse({ status: 404, description: 'Event or user not found' })
  async assignClassShepherd(
    @Param('id') eventId: string,
    @Body() assignDto: AssignClassShepherdDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const assignment = await this.eventsService.assignClassShepherd(
      eventId,
      assignDto,
      user.id,
    );
    return {
      success: true,
      data: assignment,
      message: 'Class Shepherd assigned successfully',
    };
  }

  @Get(':id/class-shepherds')
  @ApiOperation({ summary: 'Get all Class Shepherd assignments for an event' })
  @ApiResponse({ status: 200, description: 'Class Shepherd assignments retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getClassShepherds(
    @Param('id') eventId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.getClassShepherds(eventId);
    return {
      success: true,
      data: result,
      message: 'Class Shepherd assignments retrieved successfully',
    };
  }

  @Get(':id/class-shepherds/:encounterType/:classNumber')
  @ApiOperation({ summary: 'Get Class Shepherd assignments for a specific encounter class' })
  @ApiResponse({ status: 200, description: 'Class Shepherd assignments retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getClassShepherdsByClass(
    @Param('id') eventId: string,
    @Param('encounterType') encounterType: string,
    @Param('classNumber') classNumber: string,
  ): Promise<ApiResponseDto<unknown>> {
    const classNum = parseInt(classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      throw new BadRequestException('Invalid class number');
    }
    const assignments = await this.eventsService.getClassShepherdsByClass(
      eventId,
      encounterType,
      classNum,
    );
    return {
      success: true,
      data: assignments,
      message: 'Class Shepherd assignments retrieved successfully',
    };
  }

  @Delete(':id/class-shepherds/:assignmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a Class Shepherd assignment from an Encounter Event' })
  @ApiResponse({ status: 200, description: 'Class Shepherd assignment removed successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async removeClassShepherd(
    @Param('id') eventId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventsService.removeClassShepherd(
      eventId,
      assignmentId,
    );
    return {
      success: true,
      data: result,
      message: 'Class Shepherd assignment removed successfully',
    };
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an event' })
  @ApiResponse({ status: 200, description: 'Event cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Event cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async cancel(
    @Param('id') id: string,
    @Body() cancelEventDto: CancelEventDto,
  ): Promise<ApiResponseDto<unknown>> {
    const event = await this.eventsService.cancel(id, cancelEventDto);
    return {
      success: true,
      data: event,
      message: 'Event cancelled successfully',
    };
  }
}


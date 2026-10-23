import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { AttendanceMonitoringService } from './attendance-monitoring.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import {
  AttendanceMonitoringExportQueryDto,
  AttendanceMonitoringQueryDto,
} from './dto/attendance-monitoring-query.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly attendanceMonitoringService: AttendanceMonitoringService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Generate report (auto-dispatch by reportType)' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generate(@Query() query: ReportQueryDto) {
    return this.reportsService.generateReport(query);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Generate attendance report' })
  async attendance(@Query() query: Omit<ReportQueryDto, 'reportType'>) {
    return this.reportsService.generateAttendanceReport({
      ...(query as any),
      reportType: ReportType.ATTENDANCE,
    });
  }

  @Get('registration')
  @ApiOperation({ summary: 'Generate registration report' })
  async registration(@Query() query: Omit<ReportQueryDto, 'reportType'>) {
    return this.reportsService.generateRegistrationReport({
      ...(query as any),
      reportType: ReportType.REGISTRATION,
    });
  }

  @Get('member')
  @ApiOperation({ summary: 'Generate member report' })
  async member(@Query() query: Omit<ReportQueryDto, 'reportType'>) {
    return this.reportsService.generateMemberReport({
      ...(query as any),
      reportType: ReportType.MEMBER,
    });
  }

  @Get('event')
  @ApiOperation({ summary: 'Generate event report' })
  async event(@Query() query: Omit<ReportQueryDto, 'reportType'>) {
    return this.reportsService.generateEventReport({
      ...(query as any),
      reportType: ReportType.EVENT,
    });
  }

  @Get('monthly-attendance-trend')
  @ApiOperation({ summary: 'Monthly attendance trend (CW % & WSC %) for a ministry by year' })
  @ApiQuery({ name: 'ministry', required: true, description: 'Ministry name' })
  @ApiQuery({ name: 'year', required: false, description: 'Year (default: current year)' })
  @ApiResponse({ status: 200, description: 'Array of { month, monthLabel, cwPercentage, wscPercentage }' })
  async monthlyAttendanceTrend(
    @Query('ministry') ministry: string,
    @Query('year') yearParam?: string,
  ) {
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (Number.isNaN(year)) {
      return [];
    }
    return this.reportsService.getMonthlyAttendanceTrend(ministry, year);
  }

  @Get('attendance-monitoring')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({
    summary: 'Attendance Monitoring report (CW & WSC by ministry)',
    description:
      'Percent = attended ÷ sessions held. A session is held when a CW/WSC event exists, is not cancelled, and has at least one check-in. Dates are Asia/Manila.',
  })
  @ApiResponse({ status: 200, description: 'Attendance monitoring report' })
  async attendanceMonitoring(
    @Query() query: AttendanceMonitoringQueryDto,
    @CurrentUser() user: CurrentUser,
  ) {
    return this.attendanceMonitoringService.getReport(query, user);
  }

  @Get('attendance-monitoring/export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_USER, UserRole.ADMINISTRATOR, UserRole.DCS, UserRole.MINISTRY_COORDINATOR)
  @ApiOperation({ summary: 'Export Attendance Monitoring as XLSX or CSV' })
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  async attendanceMonitoringExport(
    @Query() query: AttendanceMonitoringExportQueryDto,
    @CurrentUser() user: CurrentUser,
  ): Promise<StreamableFile> {
    const file = await this.attendanceMonitoringService.exportWorkbook(query, user);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}

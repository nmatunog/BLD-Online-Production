import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
}

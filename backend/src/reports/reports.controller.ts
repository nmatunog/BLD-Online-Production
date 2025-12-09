import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async generateReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateReport(query);
  }

  @Get('attendance')
  async getAttendanceReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateAttendanceReport({
      ...query,
      reportType: 'ATTENDANCE' as any,
    });
  }

  @Get('registration')
  async getRegistrationReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateRegistrationReport({
      ...query,
      reportType: 'REGISTRATION' as any,
    });
  }

  @Get('member')
  async getMemberReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateMemberReport({
      ...query,
      reportType: 'MEMBER' as any,
    });
  }

  @Get('event')
  async getEventReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateEventReport({
      ...query,
      reportType: 'EVENT' as any,
    });
  }

  @Get('recurring-attendance')
  async getRecurringAttendanceReport(@Query() query: ReportQueryDto) {
    return this.reportsService.generateRecurringAttendanceReport({
      ...query,
      reportType: 'RECURRING_ATTENDANCE' as any,
    });
  }
}




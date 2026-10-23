import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AttendanceMonitoringService } from './attendance-monitoring.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, AttendanceMonitoringService],
  exports: [ReportsService, AttendanceMonitoringService],
})
export class ReportsModule {}







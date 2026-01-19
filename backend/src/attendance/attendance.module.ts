import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MemberLookupModule } from '../common/services/member-lookup.module';

@Module({
  imports: [PrismaModule, MemberLookupModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}


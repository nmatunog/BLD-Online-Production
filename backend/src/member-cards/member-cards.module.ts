import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MemberCardsController } from './member-cards.controller';
import { MemberCardsService } from './member-cards.service';

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [MemberCardsController],
  providers: [MemberCardsService],
  exports: [MemberCardsService],
})
export class MemberCardsModule {}

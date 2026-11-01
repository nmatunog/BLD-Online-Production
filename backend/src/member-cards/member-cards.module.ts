import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MemberCardsController } from './member-cards.controller';
import { MemberCardsService } from './member-cards.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [MemberCardsController],
  providers: [MemberCardsService, OptionalJwtAuthGuard],
  exports: [MemberCardsService],
})
export class MemberCardsModule {}

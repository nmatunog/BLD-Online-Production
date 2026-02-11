import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { AllowExtraFieldsPipe } from './pipes/allow-extra-fields.pipe';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BunnyCDNModule } from '../common/services/bunnycdn.module';

@Module({
  imports: [PrismaModule, BunnyCDNModule],
  controllers: [MembersController],
  providers: [MembersService, AllowExtraFieldsPipe],
  exports: [MembersService],
})
export class MembersModule {}


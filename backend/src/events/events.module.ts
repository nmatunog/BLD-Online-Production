import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BunnyCDNModule } from '../common/services/bunnycdn.module';

@Module({
  imports: [PrismaModule, BunnyCDNModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}


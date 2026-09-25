import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdPhotoClientEventsController } from './id-photo-client-events.controller';
import { IdPhotoClientEventsService } from './id-photo-client-events.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [IdPhotoClientEventsController],
  providers: [IdPhotoClientEventsService],
})
export class IdPhotoModule {}

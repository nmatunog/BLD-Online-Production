import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { IdPhotoClientEventDto } from './dto/id-photo-client-event.dto';
import { IdPhotoClientEventsService } from './id-photo-client-events.service';

@ApiTags('ID Photo')
@Controller('id-photo')
export class IdPhotoClientEventsController {
  constructor(private readonly events: IdPhotoClientEventsService) {}

  @Public()
  @Post('client-events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a client-side ID photo failure (signup-safe)' })
  async create(@Body() body: IdPhotoClientEventDto, @Req() req: Request): Promise<void> {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress;
    await this.events.record(body, {
      ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
    });
  }
}

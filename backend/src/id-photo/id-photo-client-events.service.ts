import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { IdPhotoClientEventDto } from './dto/id-photo-client-event.dto';

const MAX_EVENTS_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

export type IdPhotoClientEventContext = {
  ip?: string;
  userAgent?: string;
  authorization?: string;
};

@Injectable()
export class IdPhotoClientEventsService {
  private readonly logger = new Logger(IdPhotoClientEventsService.name);
  private readonly recentByIp = new Map<string, number[]>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  isRateLimited(ip: string, now = Date.now()): boolean {
    const key = ip || 'unknown';
    const next = (this.recentByIp.get(key) ?? []).filter((t) => now - t <= WINDOW_MS);
    if (next.length >= MAX_EVENTS_PER_WINDOW) {
      this.recentByIp.set(key, next);
      return true;
    }
    next.push(now);
    this.recentByIp.set(key, next);
    return false;
  }

  async resolveMemberId(authorization?: string): Promise<string | undefined> {
    if (!authorization) return undefined;
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : authorization.trim();
    if (!token) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token);
      if (!payload?.sub) return undefined;
      const member = await this.prisma.member.findUnique({
        where: { userId: payload.sub },
        select: { id: true },
      });
      return member?.id;
    } catch {
      return undefined;
    }
  }

  async record(dto: IdPhotoClientEventDto, ctx: IdPhotoClientEventContext): Promise<void> {
    const ip = (ctx.ip || 'unknown').slice(0, 80);
    if (this.isRateLimited(ip)) {
      return;
    }

    const memberId = await this.resolveMemberId(ctx.authorization);
    this.logger.warn(
      [
        'id-photo-client-event',
        `reason=${dto.reason}`,
        `flow=${dto.flow}`,
        `width=${dto.width ?? ''}`,
        `height=${dto.height ?? ''}`,
        `mimeType=${dto.mimeType ?? ''}`,
        `memberId=${memberId ?? ''}`,
        `ua=${(ctx.userAgent || '').slice(0, 180)}`,
      ].join(' '),
    );
  }
}

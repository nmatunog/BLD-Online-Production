import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<{
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    ministry?: string;
    shepherdEncounterType?: string;
    shepherdClassNumber?: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { member: { select: { ministry: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Ministry: MINISTRY_COORDINATOR uses user.ministry; members use member.ministry for event visibility
    const ministry = user.ministry || user.member?.ministry || undefined;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      ministry,
      shepherdEncounterType: user.shepherdEncounterType || undefined,
      shepherdClassNumber: user.shepherdClassNumber || undefined,
    };
  }
}


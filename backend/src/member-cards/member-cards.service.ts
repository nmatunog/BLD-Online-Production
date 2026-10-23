import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CheckInMethod, MemberCardStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateAttendanceDto } from '../attendance/dto/create-attendance.dto';
import { isCardVerifyStaffRole } from './member-card-roles';
import {
  buildNfcUrl,
  decryptCardToken,
  encryptCardToken,
  generateCardToken,
  hashCardToken,
  isValidTokenFormat,
  resolveCardTokenSecret,
} from './member-card-token.util';

const VALID_CARD_STATUSES: MemberCardStatus[] = [
  MemberCardStatus.ACTIVE,
  MemberCardStatus.ENCODED,
];

const MAX_LOOKUPS_PER_WINDOW = 30;
const LOOKUP_WINDOW_MS = 60_000;

export type CardActor = {
  id: string;
  role: UserRole;
  ministry?: string | null;
};

export type PublicCardMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string | null;
  photoUrl: string | null;
};

export type DoorVerifyStatus = 'ACTIVE' | 'REVOKED' | 'NOT_FOUND';

const MEMBER_PUBLIC_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  nickname: true,
  communityId: true,
  ministry: true,
  photoUrl: true,
} as const;

@Injectable()
export class MemberCardsService {
  private readonly logger = new Logger(MemberCardsService.name);
  private readonly recentLookupsByIp = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  isRateLimited(ip: string, now = Date.now()): boolean {
    const key = ip || 'unknown';
    const next = (this.recentLookupsByIp.get(key) ?? []).filter(
      (t) => now - t <= LOOKUP_WINDOW_MS,
    );
    if (next.length >= MAX_LOOKUPS_PER_WINDOW) {
      this.recentLookupsByIp.set(key, next);
      return true;
    }
    next.push(now);
    this.recentLookupsByIp.set(key, next);
    return false;
  }

  assertStaffCanVerify(actor: CardActor): void {
    if (isCardVerifyStaffRole(actor.role)) {
      return;
    }
    if (actor.role === UserRole.MEMBER && actor.ministry?.trim()) {
      return;
    }
    throw new ForbiddenException(
      'Only staff can verify member ID cards. Sign in with a staff account.',
    );
  }

  private tokenSecret(): string {
    return resolveCardTokenSecret();
  }

  private toPublicMember(member: PublicCardMember): PublicCardMember {
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      communityId: member.communityId,
      ministry: member.ministry,
      photoUrl: member.photoUrl,
    };
  }

  private toListItem(card: {
    id: string;
    memberId: string;
    status: MemberCardStatus;
    issuedAt: Date;
    revokedAt: Date | null;
    encodedAt: Date | null;
    lastVerifiedAt: Date | null;
    member: PublicCardMember;
  }) {
    return {
      id: card.id,
      memberId: card.memberId,
      status: card.status,
      issuedAt: card.issuedAt,
      revokedAt: card.revokedAt,
      encodedAt: card.encodedAt,
      lastVerifiedAt: card.lastVerifiedAt,
      member: this.toPublicMember(card.member),
    };
  }

  private async issueOne(memberId: string, issuedByUserId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { ...MEMBER_PUBLIC_SELECT, user: { select: { isActive: true } } },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (!member.user.isActive) {
      throw new BadRequestException('Cannot issue a card for an inactive member');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.memberCard.findFirst({
        where: { memberId, status: { in: VALID_CARD_STATUSES } },
      });
      if (existing) {
        return { skipped: true as const, card: existing, member, token: null as string | null };
      }

      const token = generateCardToken();
      const card = await tx.memberCard.create({
        data: {
          memberId,
          tokenHash: hashCardToken(token),
          tokenEncrypted: encryptCardToken(token, this.tokenSecret()),
          status: MemberCardStatus.ACTIVE,
          issuedByUserId,
        },
      });
      return { skipped: false as const, card, member, token };
    });
  }

  async issue(
    memberIds: string[],
    issuedByUserId: string,
  ): Promise<{
    issued: Array<{ cardId: string; memberId: string; nfcUrl: string; token: string }>;
    skipped: Array<{ memberId: string; reason: string; cardId?: string }>;
  }> {
    const uniqueIds = [...new Set(memberIds)];
    const issued: Array<{ cardId: string; memberId: string; nfcUrl: string; token: string }> = [];
    const skipped: Array<{ memberId: string; reason: string; cardId?: string }> = [];

    for (const memberId of uniqueIds) {
      try {
        const result = await this.issueOne(memberId, issuedByUserId);
        if (result.skipped) {
          skipped.push({
            memberId,
            reason: 'Member already has an active card',
            cardId: result.card.id,
          });
          continue;
        }
        issued.push({
          cardId: result.card.id,
          memberId,
          token: result.token as string,
          nfcUrl: buildNfcUrl(result.token as string),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not issue card';
        skipped.push({ memberId, reason: message });
      }
    }

    return { issued, skipped };
  }

  async issueForWrite(
    memberId: string,
    issuedByUserId: string,
  ): Promise<{
    cardId: string;
    memberId: string;
    alreadyIssued: boolean;
    token: string;
    nfcUrl: string;
    member: PublicCardMember;
  }> {
    const existing = await this.prisma.memberCard.findFirst({
      where: { memberId, status: { in: VALID_CARD_STATUSES } },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });
    if (existing) {
      const token = decryptCardToken(existing.tokenEncrypted, this.tokenSecret());
      return {
        cardId: existing.id,
        memberId,
        alreadyIssued: true,
        token,
        nfcUrl: buildNfcUrl(token),
        member: this.toPublicMember(existing.member),
      };
    }

    const created = await this.issueOne(memberId, issuedByUserId);
    if (created.skipped || !created.token) {
      throw new ConflictException('Member already has an active card');
    }
    return {
      cardId: created.card.id,
      memberId,
      alreadyIssued: false,
      token: created.token,
      nfcUrl: buildNfcUrl(created.token),
      member: this.toPublicMember(created.member),
    };
  }

  async revoke(cardId: string, revokedByUserId: string) {
    const card = await this.prisma.memberCard.findUnique({
      where: { id: cardId },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    if (card.status === MemberCardStatus.REVOKED) {
      return this.toListItem(card);
    }
    const updated = await this.prisma.memberCard.update({
      where: { id: cardId },
      data: {
        status: MemberCardStatus.REVOKED,
        revokedAt: new Date(),
        revokedByUserId,
      },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });
    return this.toListItem(updated);
  }

  async reissue(cardId: string, issuedByUserId: string) {
    const card = await this.prisma.memberCard.findUnique({
      where: { id: cardId },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.memberCard.updateMany({
        where: { memberId: card.memberId, status: { in: VALID_CARD_STATUSES } },
        data: {
          status: MemberCardStatus.REVOKED,
          revokedAt: new Date(),
          revokedByUserId: issuedByUserId,
        },
      });

      const token = generateCardToken();
      const created = await tx.memberCard.create({
        data: {
          memberId: card.memberId,
          tokenHash: hashCardToken(token),
          tokenEncrypted: encryptCardToken(token, this.tokenSecret()),
          status: MemberCardStatus.ACTIVE,
          issuedByUserId,
        },
        include: { member: { select: MEMBER_PUBLIC_SELECT } },
      });
      return { created, token };
    });

    return {
      card: this.toListItem(result.created),
      token: result.token,
      nfcUrl: buildNfcUrl(result.token),
    };
  }

  async markEncoded(cardId: string) {
    const card = await this.prisma.memberCard.findUnique({
      where: { id: cardId },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    if (card.status === MemberCardStatus.REVOKED) {
      throw new BadRequestException('Cannot mark a revoked card as encoded');
    }
    const updated = await this.prisma.memberCard.update({
      where: { id: cardId },
      data: {
        status: MemberCardStatus.ENCODED,
        encodedAt: card.encodedAt ?? new Date(),
      },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });
    return this.toListItem(updated);
  }

  async list(query: { search?: string; status?: MemberCardStatus; page?: number; limit?: number }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.MemberCardWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.member = {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { nickname: { contains: q, mode: 'insensitive' } },
          { communityId: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.memberCard.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
        include: { member: { select: MEMBER_PUBLIC_SELECT } },
      }),
      this.prisma.memberCard.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async exportRows(query: { search?: string; status?: MemberCardStatus }) {
    const where: Prisma.MemberCardWhereInput = {
      status: query.status ?? { in: VALID_CARD_STATUSES },
    };
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.member = {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { communityId: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const rows = await this.prisma.memberCard.findMany({
      where,
      orderBy: [{ member: { lastName: 'asc' } }, { member: { firstName: 'asc' } }],
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });

    return rows.map((row) => {
      const token = decryptCardToken(row.tokenEncrypted, this.tokenSecret());
      return {
        cardId: row.id,
        memberId: row.memberId,
        name: `${row.member.firstName} ${row.member.lastName}`.trim(),
        communityId: row.member.communityId,
        ministry: row.member.ministry ?? '',
        photoUrl: row.member.photoUrl ?? '',
        nfcUrl: buildNfcUrl(token),
        token,
        status: row.status,
        issuedAt: row.issuedAt,
        encodedAt: row.encodedAt,
      };
    });
  }

  private logLookup(entry: {
    result: DoorVerifyStatus;
    cardId?: string;
    memberId?: string;
    userId: string;
    ip: string;
  }): void {
    this.logger.log(
      [
        'member-card-lookup',
        `result=${entry.result}`,
        `cardId=${entry.cardId ?? ''}`,
        `memberId=${entry.memberId ?? ''}`,
        `userId=${entry.userId}`,
        `ip=${entry.ip}`,
      ].join(' '),
    );
  }

  async verify(
    rawToken: string,
    actor: CardActor,
    ip: string,
  ): Promise<{
    status: DoorVerifyStatus;
    cardStatus: MemberCardStatus | null;
    member: PublicCardMember | null;
    cardId: string | null;
  }> {
    this.assertStaffCanVerify(actor);
    if (this.isRateLimited(ip)) {
      throw new BadRequestException('Too many card lookups. Please wait a moment and try again.');
    }

    const token = (rawToken || '').trim();
    if (!isValidTokenFormat(token)) {
      this.logLookup({ result: 'NOT_FOUND', userId: actor.id, ip });
      return { status: 'NOT_FOUND', cardStatus: null, member: null, cardId: null };
    }

    const card = await this.prisma.memberCard.findUnique({
      where: { tokenHash: hashCardToken(token) },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });

    if (!card) {
      this.logLookup({ result: 'NOT_FOUND', userId: actor.id, ip });
      return { status: 'NOT_FOUND', cardStatus: null, member: null, cardId: null };
    }

    await this.prisma.memberCard.update({
      where: { id: card.id },
      data: { lastVerifiedAt: new Date() },
    });

    if (card.status === MemberCardStatus.REVOKED) {
      this.logLookup({
        result: 'REVOKED',
        cardId: card.id,
        memberId: card.memberId,
        userId: actor.id,
        ip,
      });
      return {
        status: 'REVOKED',
        cardStatus: card.status,
        member: this.toPublicMember(card.member),
        cardId: card.id,
      };
    }

    this.logLookup({
      result: 'ACTIVE',
      cardId: card.id,
      memberId: card.memberId,
      userId: actor.id,
      ip,
    });
    return {
      status: 'ACTIVE',
      cardStatus: card.status,
      member: this.toPublicMember(card.member),
      cardId: card.id,
    };
  }

  async checkInByToken(
    rawToken: string,
    eventId: string,
    actor: CardActor,
    ip: string,
    sessionSlot?: string,
  ) {
    const verified = await this.verify(rawToken, actor, ip);
    if (verified.status !== 'ACTIVE' || !verified.member) {
      throw new BadRequestException(
        verified.status === 'REVOKED'
          ? 'This card has been revoked. Do not check this member in from this card.'
          : 'Card not found. Do not check anyone in.',
      );
    }

    const dto: CreateAttendanceDto = {
      memberId: verified.member.id,
      eventId,
      method: CheckInMethod.QR_CODE,
      ...(sessionSlot ? { sessionSlot } : {}),
    };

    return this.attendanceService.checkIn(dto, actor.id, actor.role);
  }
}

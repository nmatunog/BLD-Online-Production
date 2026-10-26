import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
  cardTokenHashesEqual,
  decryptCardToken,
  encryptCardToken,
  generateCardToken,
  hashCardToken,
  isValidTokenFormat,
  resolveCardTokenSecret,
} from './member-card-token.util';
import { resolveDisplayMinistry, type MinistrySourceMember } from './member-card-ministry';

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
  ministryHistory: {
    where: { endDate: null },
    select: { ministry: true },
    orderBy: { startDate: 'desc' as const },
    take: 1,
  },
  user: {
    select: { ministry: true },
  },
} as const;

type MemberPublicRecord = PublicCardMember & MinistrySourceMember;

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
    throw new ForbiddenException(
      'Only staff can verify member ID cards. Sign in with a staff account.',
    );
  }

  private tokenSecret(): string {
    return resolveCardTokenSecret();
  }

  private toPublicMember(member: MemberPublicRecord): PublicCardMember {
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      communityId: member.communityId,
      ministry: resolveDisplayMinistry(member),
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
    member: MemberPublicRecord;
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
      select: { ...MEMBER_PUBLIC_SELECT, user: { select: { isActive: true, ministry: true } } },
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

  private activeMemberWhere(search?: string): Prisma.MemberWhereInput {
    const where: Prisma.MemberWhereInput = {
      user: { isActive: true },
    };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
        { communityId: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async listMemberIds(query: { search?: string }) {
    const rows = await this.prisma.member.findMany({
      where: this.activeMemberWhere(query.search),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        communityId: true,
      },
    });
    return {
      ids: rows.map((row) => row.id),
      total: rows.length,
      members: rows,
    };
  }

  async exportRows(query: {
    search?: string;
    status?: MemberCardStatus;
    memberIds?: string[];
    all?: boolean;
  }) {
    const uniqueIds = [...new Set((query.memberIds ?? []).filter(Boolean))];
    if (uniqueIds.length > 2000) {
      throw new BadRequestException('Too many member IDs for export');
    }

    const where: Prisma.MemberWhereInput =
      uniqueIds.length > 0 && query.all !== true
        ? { id: { in: uniqueIds } }
        : this.activeMemberWhere(query.search);

    const rows = await this.prisma.member.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        ...MEMBER_PUBLIC_SELECT,
        cards: {
          orderBy: { issuedAt: 'desc' },
          select: {
            id: true,
            status: true,
            tokenEncrypted: true,
            issuedAt: true,
            encodedAt: true,
          },
        },
      },
    });

    return rows.map((row) => {
      const liveCard = row.cards.find((card) => VALID_CARD_STATUSES.includes(card.status));
      const latestCard = liveCard ?? row.cards[0];
      const token =
        liveCard && latestCard
          ? decryptCardToken(latestCard.tokenEncrypted, this.tokenSecret())
          : '';
      return {
        cardId: latestCard?.id ?? '',
        memberId: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        communityId: row.communityId,
        ministry: resolveDisplayMinistry(row) ?? '',
        photoUrl: row.photoUrl ?? '',
        nfcUrl: token ? buildNfcUrl(token) : '',
        cardStatus: latestCard?.status ?? '',
        token,
        status: latestCard?.status ?? '',
        issuedAt: latestCard?.issuedAt ?? null,
        encodedAt: latestCard?.encodedAt ?? null,
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
      throw new HttpException(
        'Too many card lookups. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = (rawToken || '').trim();
    if (!isValidTokenFormat(token)) {
      this.logLookup({ result: 'NOT_FOUND', userId: actor.id, ip });
      return { status: 'NOT_FOUND', cardStatus: null, member: null, cardId: null };
    }

    const presentedHash = hashCardToken(token);
    const card = await this.prisma.memberCard.findUnique({
      where: { tokenHash: presentedHash },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });

    if (!card || !cardTokenHashesEqual(card.tokenHash, presentedHash)) {
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

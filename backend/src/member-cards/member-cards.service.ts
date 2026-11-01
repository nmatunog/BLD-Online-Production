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
import {
  assessPrintReadiness,
  matchesPrintReadyFilter,
  type PrintReadyFilter,
} from './member-card-readiness';
import { publicVerifyJson, toPublicVerifyResult } from './dto/public-verify-result.dto';
import { matchesOrgFilter, resolveCurrentApostolate, type OrgFilter } from './member-card-org-filter';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {
  allowedPhotoHosts,
  buildPrintPackZip,
  isAllowedPhotoUrl,
  PRINT_PACK_MAX_MEMBERS,
  type PrintPackCard,
  type PrintPackSkip,
} from './member-card-print-pack';

const PRINT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PRINT_PHOTO_CONCURRENCY = 6;

/** Read a fetch body but stop as soon as it passes maxBytes. */
async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('photo is too large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** Run fn over items with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const VALID_CARD_STATUSES: MemberCardStatus[] = [
  MemberCardStatus.ACTIVE,
  MemberCardStatus.ENCODED,
];

// Generous because a whole church Wi-Fi (one IP) self-checks-in at once; tokens are 128-bit+.
const MAX_LOOKUPS_PER_WINDOW = 120;
const LOOKUP_WINDOW_MS = 60_000;
const MAX_TRACKED_LOOKUP_IPS = 5_000;

export type CardActor = {
  id: string;
  role: UserRole;
  ministry?: string | null;
};

/** Resolved display DTO. `ministry` is never null — use resolveDisplayMinistry(). */
export type PublicCardMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string;
  photoUrl: string | null;
};

/** Prisma/DB row: Member.ministry and user.ministry stay string | null. */
export type MemberMinistryDbRecord = MinistrySourceMember & {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string | null;
  photoUrl: string | null;
};

export type DoorVerifyStatus = 'ACTIVE' | 'REVOKED' | 'NOT_FOUND';

export type StaffVerifyResult = {
  view: 'staff';
  status: DoorVerifyStatus;
  cardStatus: MemberCardStatus | null;
  member: PublicCardMember | null;
  cardId: string | null;
};

export type IdPrintExportRow = {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  bloodType: string;
  photoUrl: string;
  verifyUrl: string;
};

export const ID_PRINT_EXPORT_COLUMNS = [
  'memberId',
  'fullName',
  'firstName',
  'lastName',
  'bloodType',
  'photoUrl',
  'verifyUrl',
] as const;

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
    select: { ministry: true, startDate: true, endDate: true },
    orderBy: { startDate: 'desc' as const },
    take: 1,
  },
  user: {
    select: { ministry: true },
  },
} as const;

const PRINT_MEMBER_SELECT = {
  ...MEMBER_PUBLIC_SELECT,
  apostolate: true,
  bloodType: true,
  cards: {
    orderBy: { issuedAt: 'desc' as const },
    select: {
      id: true,
      status: true,
      tokenEncrypted: true,
      tokenHash: true,
      issuedAt: true,
      encodedAt: true,
    },
  },
} as const;

type MemberPublicRecord = MemberMinistryDbRecord;

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
    // Verify is public now, so cap the tracker: drop IPs with no lookups in the current window.
    if (this.recentLookupsByIp.size > MAX_TRACKED_LOOKUP_IPS) {
      for (const [trackedIp, times] of this.recentLookupsByIp) {
        if (!times.some((t) => now - t <= LOOKUP_WINDOW_MS)) {
          this.recentLookupsByIp.delete(trackedIp);
        }
      }
    }
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

  private async loadPrintMembers(where: Prisma.MemberWhereInput) {
    return this.prisma.member.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: PRINT_MEMBER_SELECT,
    });
  }

  private toIdPrintExportRow(row: {
    firstName: string;
    lastName: string;
    communityId: string;
    bloodType?: string | null;
    photoUrl?: string | null;
    cards: Array<{
      status: MemberCardStatus;
      tokenEncrypted: string;
    }>;
  }): IdPrintExportRow {
    const liveCard = row.cards.find((card) => VALID_CARD_STATUSES.includes(card.status));
    const token = liveCard ? decryptCardToken(liveCard.tokenEncrypted, this.tokenSecret()) : '';
    return {
      memberId: row.communityId,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      firstName: row.firstName,
      lastName: row.lastName,
      bloodType: row.bloodType?.trim() ?? '',
      photoUrl: row.photoUrl ?? '',
      verifyUrl: token ? buildNfcUrl(token) : '',
    };
  }

  async listMemberIds(
    query: { search?: string; printReady?: PrintReadyFilter } & OrgFilter,
  ) {
    const rows = (await this.loadPrintMembers(this.activeMemberWhere(query.search))).filter(
      (row) => matchesOrgFilter(row, query),
    );
    const assessed = rows.map((row) => {
      const readiness = assessPrintReadiness(row);
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        nickname: row.nickname,
        communityId: row.communityId,
        photoUrl: row.photoUrl,
        ministry: resolveDisplayMinistry(row),
        apostolate: resolveCurrentApostolate(row),
        ready: readiness.ready,
        missing: readiness.missing,
      };
    });
    const ready = assessed.filter((row) => row.ready);
    const missing = assessed.filter((row) => !row.ready);
    const filtered = assessed.filter((row) => matchesPrintReadyFilter(row.ready, query.printReady));
    return {
      ids: filtered.map((row) => row.id),
      total: filtered.length,
      counts: {
        ready: ready.length,
        missing: missing.length,
        all: assessed.length,
      },
      members: filtered,
    };
  }

  async exportRows(
    query: {
      search?: string;
      status?: MemberCardStatus;
      memberIds?: string[];
      all?: boolean;
      printReady?: PrintReadyFilter;
    } & OrgFilter,
  ): Promise<IdPrintExportRow[]> {
    const uniqueIds = [...new Set((query.memberIds ?? []).filter(Boolean))];
    if (uniqueIds.length > 2000) {
      throw new BadRequestException('Too many member IDs for export');
    }

    const selected = uniqueIds.length > 0 && query.all !== true;
    const where: Prisma.MemberWhereInput = selected
      ? { id: { in: uniqueIds } }
      : this.activeMemberWhere(query.search);

    const rows = await this.loadPrintMembers(where);
    // The print filter applies to hand-picked members too, so "Ready" never exports an incomplete card.
    // Apostolate/ministry filters apply the same way, so the export matches the list on screen.
    const filtered = rows.filter(
      (row) =>
        matchesOrgFilter(row, query) &&
        matchesPrintReadyFilter(assessPrintReadiness(row).ready, query.printReady),
    );

    return filtered.map((row) => this.toIdPrintExportRow(row));
  }

  /** Download one ID photo from the BunnyCDN pull zone and normalise it to JPEG. */
  protected async fetchPrintPhoto(photoUrl: string): Promise<Buffer> {
    // redirect: 'error' keeps us on the allow-listed CDN host (no hop to another host).
    const response = await fetch(photoUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`photo download failed (${response.status})`);
    }
    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > PRINT_PHOTO_MAX_BYTES) {
      throw new Error('photo is too large');
    }
    const bytes = await readBodyWithLimit(response, PRINT_PHOTO_MAX_BYTES);
    if (bytes.length === 0) {
      throw new Error('photo is empty');
    }
    return sharp(bytes).rotate().jpeg({ quality: 92 }).toBuffer();
  }

  private async toPrintPackEntry(
    row: Awaited<ReturnType<MemberCardsService['loadPrintMembers']>>[number],
    hosts: string[],
  ): Promise<{ card: PrintPackCard } | { skip: PrintPackSkip }> {
    const fullName = `${row.firstName} ${row.lastName}`.trim();
    const skip = (reason: string) => ({ skip: { memberId: row.communityId, fullName, reason } });

    const readiness = assessPrintReadiness(row);
    if (!readiness.ready) {
      return skip(`Not ready: missing ${readiness.missing.join(', ')}`);
    }
    const exportRow = this.toIdPrintExportRow(row);
    if (!exportRow.verifyUrl) return skip('No verify link');
    if (!isAllowedPhotoUrl(row.photoUrl, hosts)) return skip('Photo is not on the ID photo CDN');

    let photo: Buffer;
    try {
      photo = await this.fetchPrintPhoto(row.photoUrl as string);
    } catch (error) {
      this.logger.warn(
        `print-pack photo failed memberId=${row.id}: ${error instanceof Error ? error.message : error}`,
      );
      return skip('Photo could not be downloaded');
    }

    const qr = await QRCode.toBuffer(exportRow.verifyUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 600,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return {
      card: {
        memberId: exportRow.memberId,
        fullName: exportRow.fullName,
        firstName: exportRow.firstName,
        lastName: exportRow.lastName,
        bloodType: exportRow.bloodType,
        verifyUrl: exportRow.verifyUrl,
        photo,
        qr,
      },
    };
  }

  /**
   * ZIP for the ID printer: cards.csv + photos/ + qr/ (QR = public verify link).
   * Only active members who are ready for ID printing are included; the rest go to skipped.csv.
   */
  async buildPrintPack(memberIds: string[]): Promise<{ buffer: Buffer; filename: string }> {
    const uniqueIds = [...new Set(memberIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one member for the print pack');
    }
    if (uniqueIds.length > PRINT_PACK_MAX_MEMBERS) {
      throw new BadRequestException(
        `A print pack can hold up to ${PRINT_PACK_MAX_MEMBERS} members. Select fewer.`,
      );
    }

    const rows = await this.loadPrintMembers({
      AND: [{ id: { in: uniqueIds } }, this.activeMemberWhere()],
    });
    const hosts = allowedPhotoHosts(process.env.BUNNYCDN_CDN_URL);

    // A few downloads at a time keeps a full pack well inside the 60s web proxy limit.
    const entries = await mapWithConcurrency(rows, PRINT_PHOTO_CONCURRENCY, (row) =>
      this.toPrintPackEntry(row, hosts),
    );
    const cards: PrintPackCard[] = [];
    const skipped: PrintPackSkip[] = [];
    for (const entry of entries) {
      if ('card' in entry) cards.push(entry.card);
      else skipped.push(entry.skip);
    }
    const missingCount = uniqueIds.length - rows.length;
    if (missingCount > 0) {
      skipped.push({
        memberId: '',
        fullName: '',
        reason: `${missingCount} selected member(s) not found or inactive`,
      });
    }

    const buffer = await buildPrintPackZip({ cards, skipped });
    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `bld-id-print-pack-${stamp}.zip` };
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

  private toStaffVerifyResult(input: {
    status: DoorVerifyStatus;
    cardStatus: MemberCardStatus | null;
    member: MemberPublicRecord | null;
    cardId: string | null;
  }): StaffVerifyResult {
    return {
      view: 'staff',
      status: input.status,
      cardStatus: input.cardStatus,
      member: input.member ? this.toPublicMember(input.member) : null,
      cardId: input.cardId,
    };
  }

  private presentVerifyResult(
    actor: CardActor | null,
    lookup: {
      status: DoorVerifyStatus;
      cardStatus: MemberCardStatus | null;
      member: MemberPublicRecord | null;
      cardId: string | null;
    },
  ): StaffVerifyResult | ReturnType<typeof publicVerifyJson> {
    if (actor && isCardVerifyStaffRole(actor.role)) {
      return this.toStaffVerifyResult(lookup);
    }
    return publicVerifyJson(
      toPublicVerifyResult({
        status: lookup.status === 'ACTIVE' ? 'VALID' : lookup.status,
        member: lookup.member,
      }),
    );
  }

  async verify(
    rawToken: string,
    actor: CardActor | null,
    ip: string,
  ): Promise<StaffVerifyResult | ReturnType<typeof publicVerifyJson>> {
    // Signed-in door staff are not throttled; anonymous scans are, per IP.
    const staffActor = !!actor && isCardVerifyStaffRole(actor.role);
    if (!staffActor && this.isRateLimited(ip)) {
      throw new HttpException(
        'Too many card lookups. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = (rawToken || '').trim();
    const actorId = actor?.id ?? 'public';
    if (!isValidTokenFormat(token)) {
      this.logLookup({ result: 'NOT_FOUND', userId: actorId, ip });
      return this.presentVerifyResult(actor, {
        status: 'NOT_FOUND',
        cardStatus: null,
        member: null,
        cardId: null,
      });
    }

    const presentedHash = hashCardToken(token);
    const card = await this.prisma.memberCard.findUnique({
      where: { tokenHash: presentedHash },
      include: { member: { select: MEMBER_PUBLIC_SELECT } },
    });

    if (!card || !cardTokenHashesEqual(card.tokenHash, presentedHash)) {
      this.logLookup({ result: 'NOT_FOUND', userId: actorId, ip });
      return this.presentVerifyResult(actor, {
        status: 'NOT_FOUND',
        cardStatus: null,
        member: null,
        cardId: null,
      });
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
        userId: actorId,
        ip,
      });
      return this.presentVerifyResult(actor, {
        status: 'REVOKED',
        cardStatus: card.status,
        member: card.member,
        cardId: card.id,
      });
    }

    this.logLookup({
      result: 'ACTIVE',
      cardId: card.id,
      memberId: card.memberId,
      userId: actorId,
      ip,
    });
    return this.presentVerifyResult(actor, {
      status: 'ACTIVE',
      cardStatus: card.status,
      member: card.member,
      cardId: card.id,
    });
  }

  async checkInByToken(
    rawToken: string,
    eventId: string,
    actor: CardActor,
    ip: string,
    sessionSlot?: string,
  ) {
    this.assertStaffCanVerify(actor);
    const verified = await this.verify(rawToken, actor, ip);
    const staffView = verified as StaffVerifyResult;
    if (staffView.view !== 'staff' || staffView.status !== 'ACTIVE' || !staffView.member) {
      throw new BadRequestException(
        staffView.status === 'REVOKED'
          ? 'This card has been revoked. Do not check this member in from this card.'
          : 'Card not found. Do not check anyone in.',
      );
    }

    const dto: CreateAttendanceDto = {
      memberId: staffView.member.id,
      eventId,
      method: CheckInMethod.QR_CODE,
      ...(sessionSlot ? { sessionSlot } : {}),
    };

    return this.attendanceService.checkIn(dto, actor.id, actor.role);
  }
}

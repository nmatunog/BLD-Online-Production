import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CheckInMethod, MemberCardStatus, UserRole } from '@prisma/client';
import JSZip from 'jszip';
import sharp from 'sharp';
import { ID_PRINT_EXPORT_COLUMNS, MemberCardsService } from './member-cards.service';
import {
  encryptCardToken,
  generateCardToken,
  hashCardToken,
} from './member-card-token.util';

const SECRET = 'test-jwt-secret';

function publicMember(overrides: Partial<{
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  communityId: string;
  ministry: string | null;
  photoUrl: string | null;
}> = {}) {
  return {
    id: 'member-1',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    nickname: 'Juan',
    communityId: 'CEB-ME01-0001',
    ministry: 'Worship',
    photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
    ...overrides,
  };
}

describe('MemberCardsService', () => {
  const prisma = {
    member: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    memberCard: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const attendanceService = { checkIn: jest.fn() };

  let service: MemberCardsService;

  beforeEach(() => {
    process.env.MEMBER_CARD_TOKEN_SECRET = SECRET;
    process.env.JWT_SECRET = 'unrelated-jwt-secret';
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    service = new MemberCardsService(prisma as never, attendanceService as never);
  });

  const admin = { id: 'admin-1', role: UserRole.ADMINISTRATOR };
  const memberUser = { id: 'user-m', role: UserRole.MEMBER };

  describe('auth', () => {
    it('allows staff roles to verify and rejects a plain member', () => {
      expect(() => service.assertStaffCanVerify(admin)).not.toThrow();
      expect(() =>
        service.assertStaffCanVerify({ id: 's', role: UserRole.CLASS_SHEPHERD }),
      ).not.toThrow();
      expect(() => service.assertStaffCanVerify(memberUser)).toThrow(ForbiddenException);
    });

    it('rejects a MEMBER even when they have a ministry', () => {
      expect(() =>
        service.assertStaffCanVerify({
          id: 'm',
          role: UserRole.MEMBER,
          ministry: 'Worship',
        }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('issue / revoke / reissue', () => {
    it('issues a hashed token and returns the plaintext only to the caller', async () => {
      prisma.member.findUnique.mockResolvedValue({
        ...publicMember(),
        user: { isActive: true },
      });
      prisma.memberCard.findFirst.mockResolvedValue(null);
      prisma.memberCard.create.mockImplementation(async ({ data }: { data: { tokenHash: string } }) => ({
        id: 'card-1',
        memberId: 'member-1',
        ...data,
      }));

      const result = await service.issue(['member-1'], admin.id);
      expect(result.issued).toHaveLength(1);
      expect(result.issued[0].token.length).toBeGreaterThanOrEqual(22);
      expect(result.issued[0].nfcUrl).toContain('/verify/');
      expect(prisma.memberCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenHash: hashCardToken(result.issued[0].token),
            status: MemberCardStatus.ACTIVE,
          }),
        }),
      );
    });

    it('skips members who already have an active or encoded card', async () => {
      prisma.member.findUnique.mockResolvedValue({
        ...publicMember(),
        user: { isActive: true },
      });
      prisma.memberCard.findFirst.mockResolvedValue({
        id: 'card-existing',
        status: MemberCardStatus.ENCODED,
      });

      const result = await service.issue(['member-1'], admin.id);
      expect(result.issued).toHaveLength(0);
      expect(result.skipped[0].reason).toMatch(/already has an active card/i);
      expect(prisma.memberCard.create).not.toHaveBeenCalled();
    });

    it('revokes immediately', async () => {
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        status: MemberCardStatus.ACTIVE,
        issuedAt: new Date(),
        revokedAt: null,
        encodedAt: null,
        lastVerifiedAt: null,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        status: MemberCardStatus.REVOKED,
        issuedAt: new Date(),
        revokedAt: new Date(),
        encodedAt: null,
        lastVerifiedAt: null,
        member: publicMember(),
      });

      const row = await service.revoke('card-1', admin.id);
      expect(row.status).toBe(MemberCardStatus.REVOKED);
      expect(row).not.toHaveProperty('token');
      expect(row).not.toHaveProperty('tokenHash');
    });

    it('reissue revokes the previous card and returns a new token', async () => {
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-old',
        memberId: 'member-1',
        status: MemberCardStatus.ACTIVE,
      });
      prisma.memberCard.updateMany.mockResolvedValue({ count: 1 });
      prisma.memberCard.create.mockImplementation(async ({ data }: { data: { tokenHash: string } }) => ({
        id: 'card-new',
        memberId: 'member-1',
        status: MemberCardStatus.ACTIVE,
        issuedAt: new Date(),
        revokedAt: null,
        encodedAt: null,
        lastVerifiedAt: null,
        member: publicMember(),
        ...data,
      }));

      const result = await service.reissue('card-old', admin.id);
      expect(prisma.memberCard.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memberId: 'member-1',
            status: { in: [MemberCardStatus.ACTIVE, MemberCardStatus.ENCODED] },
          }),
          data: expect.objectContaining({ status: MemberCardStatus.REVOKED }),
        }),
      );
      expect(result.card.id).toBe('card-new');
      expect(result.token).toBeTruthy();
      expect(result.nfcUrl).toContain(result.token);
    });
  });

  describe('verify', () => {
    it('returns the full staff door view including internal member id', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.ENCODED,
        member: {
          ...publicMember(),
          email: 'hidden@example.com',
          phone: '09170000000',
          dateOfBirth: '1990-01-01',
          ministryHistory: [{ ministry: 'Music', endDate: null, startDate: '2026-01-01' }],
          user: { ministry: 'Service' },
        },
      });
      prisma.memberCard.update.mockResolvedValue({});

      const result = await service.verify(token, admin, '1.1.1.1');
      expect(result).toMatchObject({
        view: 'staff',
        status: 'ACTIVE',
        cardId: 'card-1',
        member: {
          id: 'member-1',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          nickname: 'Juan',
          communityId: 'CEB-ME01-0001',
          ministry: 'Music',
          photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/hidden@example.com|09170000000|1990-01-01/);
    });

    it('returns only the public allowlist for an unauthenticated scan', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.ACTIVE,
        member: {
          ...publicMember(),
          id: 'member-internal-id',
          email: 'hidden@example.com',
          phone: '09170000000',
          address: '123 Hidden St',
          dateOfBirth: '1990-01-01',
          bloodType: 'O+',
          ministryHistory: [],
          user: { ministry: null },
        },
      });
      prisma.memberCard.update.mockResolvedValue({});

      const result = await service.verify(token, null, '8.8.8.8');
      expect(result).toEqual({
        view: 'public',
        status: 'VALID',
        member: {
          fullName: 'Juan Dela Cruz',
          memberId: 'CEB-ME01-0001',
          ministry: 'Worship',
          photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        },
      });
      expect(JSON.stringify(result)).not.toMatch(
        /hidden@example.com|09170000000|123 Hidden St|1990-01-01|O\+|member-internal-id|card-1/,
      );
    });

    it('gives a signed-in plain member the public allowlist, not the staff view', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.ACTIVE,
        member: {
          ...publicMember(),
          id: 'member-internal-id',
          email: 'hidden@example.com',
          bloodType: 'O+',
          ministryHistory: [],
          user: { ministry: null },
        },
      });
      prisma.memberCard.update.mockResolvedValue({});

      const result = await service.verify(
        token,
        { id: 'member-user', role: UserRole.MEMBER },
        '9.9.9.9',
      );
      expect(result).toMatchObject({ view: 'public', status: 'VALID' });
      expect(JSON.stringify(result)).not.toMatch(/hidden@example.com|O\+|member-internal-id|card-1/);
    });

    it('returns REVOKED for a revoked token and not found for unknown tokens', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValueOnce({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.REVOKED,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({});

      const revokedStaff = await service.verify(token, admin, '2.2.2.2');
      expect(revokedStaff).toMatchObject({ view: 'staff', status: 'REVOKED', cardId: 'card-1' });

      prisma.memberCard.findUnique.mockResolvedValueOnce({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.REVOKED,
        member: { ...publicMember(), ministryHistory: [], user: { ministry: null } },
      });
      const revokedPublic = await service.verify(token, null, '2.2.2.2');
      expect(revokedPublic).toEqual({
        view: 'public',
        status: 'REVOKED',
        member: {
          fullName: 'Juan Dela Cruz',
          memberId: 'CEB-ME01-0001',
          ministry: 'Worship',
          photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        },
      });

      prisma.memberCard.findUnique.mockResolvedValueOnce(null);
      const missingStaff = await service.verify(generateCardToken(), admin, '2.2.2.2');
      expect(missingStaff).toMatchObject({ view: 'staff', status: 'NOT_FOUND', member: null });

      prisma.memberCard.findUnique.mockResolvedValueOnce(null);
      const missingPublic = await service.verify(generateCardToken(), null, '2.2.2.2');
      expect(missingPublic).toEqual({ view: 'public', status: 'NOT_FOUND', member: null });
    });

    it('treats a stored hash mismatch as not found', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(generateCardToken()),
        status: MemberCardStatus.ACTIVE,
        member: publicMember(),
      });

      const result = await service.verify(token, admin, '4.4.4.4');
      expect(result).toMatchObject({ view: 'staff', status: 'NOT_FOUND', member: null });
    });

    it('rate-limits noisy lookup IPs', async () => {
      let limited = 0;
      for (let i = 0; i < 125; i++) {
        if (service.isRateLimited('9.9.9.9', 1_000_000 + i)) limited++;
      }
      expect(limited).toBe(5);
    });

    it('does not throttle signed-in staff on a busy shared IP', async () => {
      for (let i = 0; i < 130; i++) service.isRateLimited('7.7.7.7');
      prisma.memberCard.findUnique.mockResolvedValue(null);
      await expect(service.verify('x'.repeat(30), admin, '7.7.7.7')).resolves.toMatchObject({
        view: 'staff',
        status: 'NOT_FOUND',
      });
      await expect(service.verify('x'.repeat(30), null, '7.7.7.7')).rejects.toMatchObject({
        status: 429,
      });
    });

    it('forgets stale IPs so a public flood cannot grow the tracker forever', () => {
      for (let i = 0; i < 5_001; i++) {
        service.isRateLimited(`10.0.${Math.floor(i / 256)}.${i % 256}`, 1_000_000);
      }
      service.isRateLimited('fresh-ip', 1_000_000 + 120_000);
      const tracked = (service as unknown as { recentLookupsByIp: Map<string, number[]> })
        .recentLookupsByIp;
      expect(tracked.size).toBe(1);
      expect(tracked.has('fresh-ip')).toBe(true);
    });
  });

  describe('print pack', () => {
    function printRow(overrides: Record<string, unknown> = {}) {
      return {
        ...publicMember({ id: 'ready-1', communityId: 'CEB-ME1801' }),
        bloodType: 'O+',
        ministryHistory: [],
        user: { ministry: null },
        cards: [
          {
            status: MemberCardStatus.ACTIVE,
            tokenEncrypted: encryptCardToken('tokenvalue0123456789abcd', SECRET),
            tokenHash: 'hash',
          },
        ],
        ...overrides,
      };
    }

    it('packs ready members with photo + verify-link QR and skips the rest', async () => {
      prisma.member.findMany.mockResolvedValue([
        printRow(),
        printRow({ id: 'no-photo', communityId: 'CEB-ME1802', photoUrl: null }),
        printRow({ id: 'off-cdn', communityId: 'CEB-ME1803', photoUrl: 'https://evil.example.com/x.jpg' }),
        printRow({ id: 'photo-fail', communityId: 'CEB-ME1804' }),
        printRow({ id: 'revoked', communityId: 'CEB-ME1805', cards: [{ status: MemberCardStatus.REVOKED, tokenEncrypted: 'x', tokenHash: 'h' }] }),
      ]);
      const fetchPhoto = jest
        .spyOn(service as unknown as { fetchPrintPhoto: (url: string) => Promise<Buffer> }, 'fetchPrintPhoto')
        .mockImplementation(async (url: string) => {
          if (url.includes('juan') && fetchPhoto.mock.calls.length > 1) throw new Error('boom');
          return Buffer.from([0xff, 0xd8, 0xff]);
        });

      const pack = await service.buildPrintPack(['ready-1', 'no-photo', 'off-cdn', 'photo-fail', 'revoked']);
      expect(pack.filename).toMatch(/^bld-id-print-pack-\d{4}-\d{2}-\d{2}\.zip$/);
      expect(fetchPhoto).toHaveBeenCalledTimes(2);
      expect(fetchPhoto).not.toHaveBeenCalledWith('https://evil.example.com/x.jpg');

      const zip = await JSZip.loadAsync(pack.buffer);
      const csv = await zip.file('cards.csv')!.async('string');
      expect(csv).toContain('CEB-ME1801,Juan Dela Cruz,Juan,Juan,Dela Cruz,O+,photos/CEB-ME1801.jpg,qr/CEB-ME1801.png,https://app.bldcebu.com/verify/tokenvalue0123456789abcd');
      expect(csv).not.toMatch(/CEB-ME180[2-5]/);
      const qr = await zip.file('qr/CEB-ME1801.png')!.async('nodebuffer');
      expect(qr.subarray(0, 4).toString('hex')).toBe('89504e47');

      const skipped = await zip.file('skipped.csv')!.async('string');
      expect(skipped).toContain('CEB-ME1802,Juan Dela Cruz,Not ready: missing photo');
      expect(skipped).toContain('CEB-ME1803,Juan Dela Cruz,Photo is not on the ID photo CDN');
      expect(skipped).toContain('CEB-ME1804,Juan Dela Cruz,Photo could not be downloaded');
      expect(skipped).toContain('CEB-ME1805,Juan Dela Cruz,Not ready: missing card');
      expect(`${csv}${skipped}`).not.toMatch(/tokenEncrypted|hash/);
    });

    it('downloads a photo and converts it to JPEG, failing on a bad response', async () => {
      const png = await sharp({
        create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 10, b: 10 } },
      })
        .png()
        .toBuffer();
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(new Uint8Array(png), { status: 200 }))
        .mockResolvedValueOnce(new Response('nope', { status: 404 }));
      const fetchPhoto = (service as unknown as { fetchPrintPhoto: (u: string) => Promise<Buffer> })
        .fetchPrintPhoto.bind(service);

      const jpg = await fetchPhoto('https://bld-idphotos.b-cdn.net/a.png');
      expect(jpg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
      await expect(fetchPhoto('https://bld-idphotos.b-cdn.net/missing.png')).rejects.toThrow('404');
      fetchMock.mockRestore();
    });

    it('only loads active members and reports IDs it could not include', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      const pack = await service.buildPrintPack(['gone-1', 'gone-2']);
      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ id: { in: ['gone-1', 'gone-2'] } }, { user: { isActive: true } }] },
        }),
      );
      const zip = await JSZip.loadAsync(pack.buffer);
      const skipped = await zip.file('skipped.csv')!.async('string');
      expect(skipped).toContain('2 selected member(s) not found or inactive');
      expect(skipped).not.toContain('gone-1');
    });

    it('refuses redirects and oversized photos', async () => {
      const fetchPhoto = (service as unknown as { fetchPrintPhoto: (u: string) => Promise<Buffer> })
        .fetchPrintPhoto.bind(service);
      const fetchMock = jest.spyOn(global, 'fetch');

      fetchMock.mockResolvedValueOnce(new Response('x', { status: 200 }));
      await fetchPhoto('https://bld-idphotos.b-cdn.net/a.jpg').catch(() => undefined);
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://bld-idphotos.b-cdn.net/a.jpg',
        expect.objectContaining({ redirect: 'error' }),
      );

      fetchMock.mockResolvedValueOnce(
        new Response('x', { status: 200, headers: { 'content-length': String(11 * 1024 * 1024) } }),
      );
      await expect(fetchPhoto('https://bld-idphotos.b-cdn.net/big.jpg')).rejects.toThrow('too large');

      // No content-length: the stream is cut off once it passes the limit.
      let pulled = 0;
      const chunk = new Uint8Array(1024 * 1024);
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled++;
          controller.enqueue(chunk);
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(endless, { status: 200 }));
      await expect(fetchPhoto('https://bld-idphotos.b-cdn.net/stream.jpg')).rejects.toThrow('too large');
      expect(pulled).toBeLessThan(14);
      fetchMock.mockRestore();
    });

    it('rejects empty and oversized selections', async () => {
      await expect(service.buildPrintPack([])).rejects.toBeInstanceOf(BadRequestException);
      const tooMany = Array.from({ length: 51 }, (_, i) => `member-${i}`);
      await expect(service.buildPrintPack(tooMany)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.member.findMany).not.toHaveBeenCalled();
    });
  });

  describe('check-in path', () => {
    it('delegates to existing attendance check-in with the live member id', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.ACTIVE,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({});
      attendanceService.checkIn.mockResolvedValue({ id: 'att-1' });

      await service.checkInByToken(token, 'event-9', admin, '3.3.3.3');
      expect(attendanceService.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'member-1',
          eventId: 'event-9',
          method: CheckInMethod.QR_CODE,
        }),
        admin.id,
        admin.role,
      );
    });

    it('does not check in a revoked card', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.REVOKED,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({});

      await expect(
        service.checkInByToken(token, 'event-9', admin, '3.3.3.3'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(attendanceService.checkIn).not.toHaveBeenCalled();
    });

    it('surfaces already-checked-in from the existing service', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.ACTIVE,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({});
      attendanceService.checkIn.mockRejectedValue(
        new ConflictException('Member is already checked in to this event session'),
      );

      await expect(
        service.checkInByToken(token, 'event-9', admin, '3.3.3.3'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('encode / export', () => {
    it('marks a card encoded after a successful write verify', async () => {
      prisma.memberCard.findUnique.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        status: MemberCardStatus.ACTIVE,
        encodedAt: null,
        issuedAt: new Date(),
        revokedAt: null,
        lastVerifiedAt: null,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({
        id: 'card-1',
        memberId: 'member-1',
        status: MemberCardStatus.ENCODED,
        encodedAt: new Date(),
        issuedAt: new Date(),
        revokedAt: null,
        lastVerifiedAt: null,
        member: publicMember(),
      });

      const row = await service.markEncoded('card-1');
      expect(row.status).toBe(MemberCardStatus.ENCODED);
      expect(row.encodedAt).toBeTruthy();
    });

    it('exports the ID-print columns and blanks fields that are not in the schema', async () => {
      const token = generateCardToken();
      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember(),
          bloodType: 'O+',
          ministryHistory: [],
          user: { ministry: null },
          cards: [
            {
              id: 'card-1',
              status: MemberCardStatus.ACTIVE,
              tokenEncrypted: encryptCardToken(token, SECRET),
              tokenHash: hashCardToken(token),
              issuedAt: new Date(),
              encodedAt: null,
            },
          ],
        },
      ]);

      const rows = await service.exportRows({ all: true });
      expect(Object.keys(rows[0])).toEqual([...ID_PRINT_EXPORT_COLUMNS]);
      expect(Object.keys(rows[0]).join(',')).not.toMatch(/emergency|signature/i);
      expect(ID_PRINT_EXPORT_COLUMNS).toContain('nickname');
      expect(rows[0]).toEqual({
        memberId: 'CEB-ME01-0001',
        fullName: 'Juan Dela Cruz',
        nickname: 'Juan',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        bloodType: 'O+',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        verifyUrl: `https://app.bldcebu.com/verify/${token}`,
      });
    });

    it('prints the nickname, falling back to the first name when it is blank', async () => {
      prisma.member.findMany.mockResolvedValue([
        { ...publicMember({ id: 'm-a', nickname: 'Jun' }), bloodType: null, ministryHistory: [], user: { ministry: null }, cards: [] },
        { ...publicMember({ id: 'm-b', firstName: 'Maria', nickname: '  ' }), bloodType: null, ministryHistory: [], user: { ministry: null }, cards: [] },
        { ...publicMember({ id: 'm-c', firstName: 'Ana', nickname: null }), bloodType: null, ministryHistory: [], user: { ministry: null }, cards: [] },
      ]);
      const rows = await service.exportRows({ all: true });
      expect(rows.map((row) => row.nickname)).toEqual(['Jun', 'Maria', 'Ana']);
    });

    it('exports members without cards and leaves missing schema fields blank', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember({ id: 'member-2', ministry: null }),
          bloodType: null,
          ministryHistory: [{ ministry: 'Music Ministry', endDate: null }],
          user: { ministry: 'Service' },
          cards: [],
        },
      ]);

      const allRows = await service.exportRows({ all: true });
      expect(allRows).toHaveLength(1);
      expect(allRows[0].verifyUrl).toBe('');
      expect(allRows[0].bloodType).toBe('');

      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember({ id: 'member-3', ministry: null }),
          bloodType: null,
          ministryHistory: [],
          user: { ministry: 'Intercessory' },
          cards: [],
        },
      ]);
      const selected = await service.exportRows({ memberIds: ['member-3'] });
      expect(prisma.member.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: { in: ['member-3'] } },
        }),
      );
      expect(selected[0].memberId).toBe('CEB-ME01-0001');
      expect(selected[0].verifyUrl).toBe('');
    });

    it('filters export rows by print readiness', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember({ id: 'ready-1', communityId: 'CEB-ME1801' }),
          bloodType: 'A+',
          ministryHistory: [],
          user: { ministry: null },
          cards: [
            {
              status: MemberCardStatus.ACTIVE,
              tokenEncrypted: encryptCardToken('tokenvalue0123456789abcd', SECRET),
              tokenHash: 'hash',
            },
          ],
        },
        {
          ...publicMember({ id: 'missing-1', firstName: '', communityId: 'bad-id', photoUrl: null }),
          bloodType: null,
          ministryHistory: [],
          user: { ministry: null },
          cards: [],
        },
      ]);

      const readyRows = await service.exportRows({ all: true, printReady: 'READY' });
      expect(readyRows).toHaveLength(1);
      expect(readyRows[0].memberId).toBe('CEB-ME1801');

      const missingRows = await service.exportRows({ all: true, printReady: 'MISSING' });
      expect(missingRows).toHaveLength(1);
      expect(missingRows[0].verifyUrl).toBe('');

      const pickedReady = await service.exportRows({
        memberIds: ['ready-1', 'missing-1'],
        printReady: 'READY',
      });
      expect(pickedReady.map((row) => row.memberId)).toEqual(['CEB-ME1801']);
    });

    it('lists matching member IDs within the print-ready filter and returns counts', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          id: 'member-1',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          nickname: 'Juan',
          communityId: 'CEB-ME1801',
          photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
          ministry: 'Worship',
          ministryHistory: [],
          user: { ministry: null },
          cards: [{ status: MemberCardStatus.ACTIVE, tokenHash: 'abc', tokenEncrypted: 'enc' }],
        },
        {
          id: 'member-2',
          firstName: 'Maria',
          lastName: 'Santos',
          nickname: null,
          communityId: 'CEB-ME1802',
          photoUrl: null,
          ministry: null,
          ministryHistory: [],
          user: { ministry: null },
          cards: [],
        },
      ]);

      const ready = await service.listMemberIds({ search: 'Juan', printReady: 'READY' });
      expect(ready.ids).toEqual(['member-1']);
      expect(ready.total).toBe(1);
      expect(ready.counts).toEqual({ ready: 1, missing: 1, all: 2 });
      expect(ready.members[0].missing).toEqual([]);

      const missing = await service.listMemberIds({ printReady: 'MISSING' });
      expect(missing.ids).toEqual(['member-2']);
      expect(missing.members[0].missing).toEqual(['photo', 'card']);
      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { isActive: true },
          }),
        }),
      );
    });

    it('resolves ministry fallback on card list items without writing', async () => {
      prisma.memberCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          memberId: 'member-1',
          tokenHash: 'abc',
          tokenEncrypted: 'enc',
          status: MemberCardStatus.ACTIVE,
          issuedAt: new Date(),
          revokedAt: null,
          encodedAt: null,
          lastVerifiedAt: null,
          member: {
            ...publicMember({ ministry: null }),
            ministryHistory: [{ ministry: 'Praise Ministry' }],
            user: { ministry: 'Service' },
          },
        },
      ]);
      prisma.memberCard.count.mockResolvedValue(1);

      const listed = await service.list({});
      expect(listed.data[0].member.ministry).toBe('Praise Ministry');
      expect(prisma.member.update).not.toHaveBeenCalled();
      expect(prisma.memberCard.update).not.toHaveBeenCalled();
    });

    it('list items never include tokens or hashes', async () => {
      prisma.memberCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          memberId: 'member-1',
          tokenHash: 'abc',
          tokenEncrypted: 'enc',
          status: MemberCardStatus.ACTIVE,
          issuedAt: new Date(),
          revokedAt: null,
          encodedAt: null,
          lastVerifiedAt: null,
          member: publicMember(),
        },
      ]);
      prisma.memberCard.count.mockResolvedValue(1);

      const listed = await service.list({});
      expect(JSON.stringify(listed)).not.toMatch(/tokenHash|tokenEncrypted|"token"/);
    });
  });
});

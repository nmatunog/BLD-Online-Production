import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CheckInMethod, MemberCardStatus, UserRole } from '@prisma/client';
import { MemberCardsService } from './member-cards.service';
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
    it('returns live member fields and never private contact data', async () => {
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
        },
      });
      prisma.memberCard.update.mockResolvedValue({});

      const result = await service.verify(token, admin, '1.1.1.1');
      expect(result.status).toBe('ACTIVE');
      expect(result.member?.communityId).toBe('CEB-ME01-0001');
      expect(result.member?.ministry).toBe('Worship');
      expect(JSON.stringify(result)).not.toMatch(/hidden@example.com|09170000000|1990-01-01/);
    });

    it('returns REVOKED for a revoked token and NOT_FOUND for unknown tokens', async () => {
      const token = generateCardToken();
      prisma.memberCard.findUnique.mockResolvedValueOnce({
        id: 'card-1',
        memberId: 'member-1',
        tokenHash: hashCardToken(token),
        status: MemberCardStatus.REVOKED,
        member: publicMember(),
      });
      prisma.memberCard.update.mockResolvedValue({});

      const revoked = await service.verify(token, admin, '2.2.2.2');
      expect(revoked.status).toBe('REVOKED');

      prisma.memberCard.findUnique.mockResolvedValueOnce(null);
      const missing = await service.verify(generateCardToken(), admin, '2.2.2.2');
      expect(missing.status).toBe('NOT_FOUND');
      expect(missing.member).toBeNull();
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
      expect(result.status).toBe('NOT_FOUND');
      expect(result.member).toBeNull();
    });

    it('rate-limits noisy lookup IPs', async () => {
      let limited = 0;
      for (let i = 0; i < 35; i++) {
        if (service.isRateLimited('9.9.9.9', 1_000_000 + i)) limited++;
      }
      expect(limited).toBe(5);
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

    it('includes the NFC URL only in export rows', async () => {
      const token = generateCardToken();
      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember(),
          ministryHistory: [],
          user: { ministry: null },
          cards: [
            {
              id: 'card-1',
              status: MemberCardStatus.ACTIVE,
              tokenEncrypted: encryptCardToken(token, SECRET),
              issuedAt: new Date(),
              encodedAt: null,
            },
          ],
        },
      ]);

      const rows = await service.exportRows({ all: true });
      expect(rows[0].nfcUrl).toBe(`https://app.bldcebu.com/verify/${token}`);
      expect(rows[0].token).toBe(token);
      expect(rows[0].cardStatus).toBe(MemberCardStatus.ACTIVE);
    });

    it('exports members without cards when all=true or memberIds are set', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember({ id: 'member-2', ministry: null }),
          ministryHistory: [{ ministry: 'Music Ministry', endDate: null }],
          user: { ministry: 'Service' },
          cards: [],
        },
      ]);

      const allRows = await service.exportRows({ all: true });
      expect(allRows).toHaveLength(1);
      expect(allRows[0].nfcUrl).toBe('');
      expect(allRows[0].cardStatus).toBe('');
      expect(allRows[0].ministry).toBe('Music Ministry');

      prisma.member.findMany.mockResolvedValue([
        {
          ...publicMember({ id: 'member-3', ministry: null }),
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
      expect(selected[0].ministry).toBe('Intercessory');
      expect(selected[0].nfcUrl).toBe('');
    });

    it('lists all matching member IDs for Select all', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          id: 'member-1',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          nickname: 'Juan',
          communityId: 'CEB-ME01-0001',
        },
        {
          id: 'member-2',
          firstName: 'Maria',
          lastName: 'Santos',
          nickname: null,
          communityId: 'CEB-ME01-0002',
        },
      ]);

      const result = await service.listMemberIds({ search: 'Juan' });
      expect(result.ids).toEqual(['member-1', 'member-2']);
      expect(result.total).toBe(2);
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

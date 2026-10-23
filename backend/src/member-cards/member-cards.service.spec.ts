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
    member: { findUnique: jest.fn() },
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
    process.env.JWT_SECRET = SECRET;
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

    it('allows a MEMBER who is ministry door staff', () => {
      expect(() =>
        service.assertStaffCanVerify({
          id: 'm',
          role: UserRole.MEMBER,
          ministry: 'Worship',
        }),
      ).not.toThrow();
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
      prisma.memberCard.findMany.mockResolvedValue([
        {
          id: 'card-1',
          memberId: 'member-1',
          tokenEncrypted: encryptCardToken(token, SECRET),
          status: MemberCardStatus.ACTIVE,
          issuedAt: new Date(),
          encodedAt: null,
          member: publicMember(),
        },
      ]);

      const rows = await service.exportRows({});
      expect(rows[0].nfcUrl).toBe(`https://app.bldcebu.com/verify/${token}`);
      expect(rows[0].token).toBe(token);
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

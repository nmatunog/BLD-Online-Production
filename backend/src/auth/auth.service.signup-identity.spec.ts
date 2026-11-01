import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import type { SignupDto } from './dto/signup.dto';
import type { SignupUpdateDto } from './dto/signup-lookup.dto';

const SECRET = 'identity-test-secret';
const jwt = new JwtService({});

function editToken(memberId: string, communityId: string, type = 'signup-edit', expiresIn = '7d') {
  return jwt.sign({ memberId, communityId, type }, { secret: SECRET, expiresIn });
}

describe('AuthService signup identity rules', () => {
  const prisma = {
    user: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
    member: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const membersService = { savePhoto: jest.fn(), regenerateQRCode: jest.fn() };
  let service: AuthService;

  const ownMember = (user: Partial<{ phone: string | null; passwordHash: string | null; isActive: boolean }> = {}) => ({
    id: 'member-own',
    userId: 'user-own',
    communityId: 'CEB-ME1803',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    nickname: 'Jun',
    encounterType: 'ME',
    classNumber: 18,
    photoUrl: 'https://bld-idphotos.b-cdn.net/own.jpg',
    qrCodeUrl: 'qr',
    user: { id: 'user-own', phone: '09171234567', passwordHash: null, isActive: true, ...user },
  });

  const update = (overrides: Partial<SignupUpdateDto> = {}): SignupUpdateDto =>
    ({
      memberId: 'member-own',
      communityId: 'CEB-ME1803',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      nickname: 'Jun',
      encounterType: 'ME',
      classNumber: '18',
      editToken: editToken('member-own', 'CEB-ME1803'),
      ...overrides,
    }) as SignupUpdateDto;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.JWT_SECRET = SECRET;
    process.env.PUBLIC_APP_URL = 'https://app.bldcebu.com';
    service = new AuthService(prisma as never, jwt, membersService as never);
    prisma.member.update.mockImplementation(async ({ data }: { data: object }) => ({ ...ownMember(), ...data }));
  });

  describe('public last-name suggestions', () => {
    it('never return member IDs or Community IDs', async () => {
      prisma.member.findMany.mockResolvedValue([
        { firstName: 'Juan', lastName: 'Dela Cruz', nickname: 'Jun', encounterType: 'ME', classNumber: 10 },
      ]);
      const result = await service.suggestSignupMatches('Del');
      expect(result).toEqual([
        { firstName: 'Juan', lastName: 'Dela Cruz', nickname: 'Jun', encounterType: 'ME', classNumber: 10 },
      ]);
      const select = prisma.member.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('id');
      expect(select).not.toHaveProperty('communityId');
    });
  });

  describe('signup', () => {
    it('gives the signing-up phone an edit token for its own member only', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.member.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
      prisma.user.create.mockResolvedValue({ id: 'user-new' });
      prisma.member.create.mockResolvedValue({ ...ownMember(), id: 'member-new', communityId: 'CEB-ME1804' });
      membersService.savePhoto.mockResolvedValue({ photoUrl: 'p' });
      membersService.regenerateQRCode.mockResolvedValue({ qrCodeUrl: null });
      jest
        .spyOn(service as unknown as { generateCommunityId: () => Promise<string> }, 'generateCommunityId')
        .mockResolvedValue('CEB-ME1804');

      const result = await service.signup({
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        nickname: 'Jun',
        encounterType: 'ME',
        classNumber: '18',
        phone: '09170000000',
        idPhoto: 'data:image/jpeg;base64,AA',
      } as SignupDto);

      const payload = jwt.verify(result.editToken!, { secret: SECRET });
      expect(payload).toMatchObject({ memberId: 'member-new', communityId: 'CEB-ME1804', type: 'signup-edit' });
    });
  });

  describe('editing signup details (PUT /auth/signup)', () => {
    it('refuses without the edit token, with another member’s token, or a wrong-type token', async () => {
      prisma.member.findFirst.mockResolvedValue(ownMember());
      for (const token of [
        undefined,
        'not-a-jwt',
        editToken('member-other', 'CEB-ME1803'),
        editToken('member-own', 'CEB-ME9999'),
        editToken('member-own', 'CEB-ME1803', 'password-reset'),
        jwt.sign({ memberId: 'member-own', communityId: 'CEB-ME1803', type: 'signup-edit' }, { secret: 'wrong' }),
        // expired edit token
        jwt.sign(
          { memberId: 'member-own', communityId: 'CEB-ME1803', type: 'signup-edit', exp: Math.floor(Date.now() / 1000) - 60 },
          { secret: SECRET },
        ),
        // a normal login (access) token is not an edit token
        jwt.sign({ sub: 'user-own', email: null, phone: '09171234567', role: 'MEMBER' }, { secret: SECRET }),
      ]) {
        await expect(service.updateSignup(update({ editToken: token }))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      }
      expect(prisma.member.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('saves details with a valid token and never reactivates or touches the account', async () => {
      prisma.member.findFirst.mockResolvedValueOnce(ownMember()).mockResolvedValueOnce(null);
      const result = await service.updateSignup(update({ firstName: 'Juanito' }));
      expect(result.firstName).toBe('Juanito');
      expect(prisma.member.update).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('will not change the mobile number (same number is fine)', async () => {
      prisma.member.findFirst.mockResolvedValueOnce(ownMember()).mockResolvedValueOnce(null);
      await expect(service.updateSignup(update({ phone: '09998887777' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.member.findFirst.mockReset();
      prisma.member.findFirst.mockResolvedValueOnce(ownMember()).mockResolvedValueOnce(null);
      await expect(service.updateSignup(update({ phone: '09171234567' }))).resolves.toBeTruthy();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('sets a password only when the account has none yet', async () => {
      prisma.member.findFirst
        .mockResolvedValueOnce(ownMember({ passwordHash: 'existing-hash' }))
        .mockResolvedValueOnce(null);
      await expect(service.updateSignup(update({ password: 'secret1' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      prisma.member.findFirst.mockReset();
      prisma.member.findFirst.mockResolvedValueOnce(ownMember()).mockResolvedValueOnce(null);
      await service.updateSignup(update({ password: 'secret1' }));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-own' },
        data: { passwordHash: expect.any(String) },
      });
    });
  });

  describe('coordinator password setup link', () => {
    const target = (overrides: Record<string, unknown> = {}) => ({
      id: 'member-t',
      firstName: 'Ana',
      lastName: 'Cruz',
      ministry: 'Praise Ministry',
      encounterType: 'ME',
      classNumber: 18,
      user: { id: 'user-t', role: UserRole.MEMBER, isActive: true },
      ...overrides,
    });

    it('gives an in-scope coordinator a one-day reset link for a member', async () => {
      prisma.member.findUnique.mockResolvedValue(target());
      const link = await service.createPasswordSetupLink('member-t', {
        id: 'coord',
        role: UserRole.MINISTRY_COORDINATOR,
        ministry: 'Praise Ministry',
      });
      expect(link.resetUrl).toMatch(/^https:\/\/app\.bldcebu\.com\/reset-password\?token=/);
      const token = decodeURIComponent(link.resetUrl.split('token=')[1]);
      expect(jwt.verify(token, { secret: SECRET })).toMatchObject({ userId: 'user-t', type: 'password-reset' });
      const hours = (new Date(link.expiresAt).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24);
    });

    it('keeps coordinators and shepherds inside their own ministry / class', async () => {
      prisma.member.findUnique.mockResolvedValue(target());
      await expect(
        service.createPasswordSetupLink('member-t', { id: 'c', role: UserRole.MINISTRY_COORDINATOR, ministry: 'Word Ministry' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createPasswordSetupLink('member-t', {
          id: 's',
          role: UserRole.CLASS_SHEPHERD,
          shepherdEncounterType: 'ME',
          shepherdClassNumber: 19,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createPasswordSetupLink('member-t', {
          id: 's',
          role: UserRole.CLASS_SHEPHERD,
          shepherdEncounterType: 'me',
          shepherdClassNumber: 18,
        }),
      ).resolves.toHaveProperty('resetUrl');
    });

    it('never lets an administrator take over a super user or another administrator', async () => {
      for (const role of [UserRole.SUPER_USER, UserRole.ADMINISTRATOR]) {
        prisma.member.findUnique.mockResolvedValue(target({ user: { id: 'user-t', role, isActive: true } }));
        await expect(
          service.createPasswordSetupLink('member-t', { id: 'a', role: UserRole.ADMINISTRATOR }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.createPasswordSetupLink('member-t', { id: 'su', role: UserRole.SUPER_USER }),
        ).resolves.toHaveProperty('resetUrl');
      }
    });

    it('makes the link single-use: it stops working once the password changes', async () => {
      prisma.member.findUnique.mockResolvedValue(
        target({ user: { id: 'user-t', role: UserRole.MEMBER, isActive: true, passwordHash: 'old-hash' } }),
      );
      const link = await service.createPasswordSetupLink('member-t', { id: 'a', role: UserRole.ADMINISTRATOR });
      const token = decodeURIComponent(link.resetUrl.split('token=')[1]);

      (prisma.user as unknown as { findUnique: jest.Mock }).findUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: 'user-t', passwordHash: 'old-hash' })
        .mockResolvedValueOnce({ id: 'user-t', passwordHash: 'new-hash-after-first-use' });
      prisma.user.update.mockResolvedValue({});

      await expect(service.resetPassword({ token, password: 'first1' } as never)).resolves.toBeTruthy();
      await expect(service.resetPassword({ token, password: 'second2' } as never)).rejects.toThrow();
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('lets only full admins do it for staff accounts, never for yourself or deactivated accounts', async () => {
      prisma.member.findUnique.mockResolvedValue(target({ user: { id: 'user-t', role: UserRole.DCS, isActive: true } }));
      await expect(
        service.createPasswordSetupLink('member-t', { id: 'd', role: UserRole.DCS }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createPasswordSetupLink('member-t', { id: 'a', role: UserRole.ADMINISTRATOR }),
      ).resolves.toHaveProperty('resetUrl');

      prisma.member.findUnique.mockResolvedValue(target());
      await expect(
        service.createPasswordSetupLink('member-t', { id: 'user-t', role: UserRole.ADMINISTRATOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.member.findUnique.mockResolvedValue(target({ user: { id: 'user-t', role: UserRole.MEMBER, isActive: false } }));
      await expect(
        service.createPasswordSetupLink('member-t', { id: 'a', role: UserRole.ADMINISTRATOR }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { ADMIN_ACTIVATION_MESSAGE } from './auth.constants';
import type { SignupUpdateDto } from './dto/signup-lookup.dto';

describe('AuthService admin-locked accounts (adminActivationRequired)', () => {
  const prisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    member: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    session: { findUnique: jest.fn(), create: jest.fn() },
  };
  const jwtService = { verify: jest.fn(), sign: jest.fn().mockReturnValue('signed') };
  const membersService = { savePhoto: jest.fn(), regenerateQRCode: jest.fn() };
  let service: AuthService;
  let validHash: string;

  const member = {
    id: 'member-1',
    userId: 'user-1',
    communityId: 'CEB-ME9901',
    firstName: 'Test',
    lastName: 'Nomobile',
    nickname: null,
    encounterType: 'ME',
    classNumber: 99,
    ministry: null,
    apostolate: null,
    photoUrl: null,
    qrCodeUrl: null,
  };

  function lockedUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'test@example.com',
      phone: null,
      // Even a valid password must not get a locked account in.
      passwordHash: validHash,
      role: UserRole.MEMBER,
      isActive: true,
      adminActivationRequired: true,
      ...overrides,
    };
  }

  beforeAll(async () => {
    validHash = await bcrypt.hash('correct-password', 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as never, jwtService as never, membersService as never);
  });

  async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
      await promise;
    } catch (error) {
      return error as Error;
    }
    throw new Error('expected rejection');
  }

  it('login by email rejects a locked account even with the right password', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...lockedUser(), member });
    const error = await rejection(
      service.login({ email: 'test@example.com', password: 'correct-password' } as never),
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('loginByQr rejects a locked account even with the right password', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, user: lockedUser() });
    const error = await rejection(
      service.loginByQr({ communityId: 'ceb-me9901', password: 'correct-password' } as never),
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
  });

  it('the message is checked before the missing-password message', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, user: lockedUser({ passwordHash: null }) });
    const error = await rejection(service.loginByQr({ communityId: 'CEB-ME9901', password: 'x' } as never));
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
  });

  it('a deactivated locked account still reports deactivated', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, user: lockedUser({ isActive: false }) });
    const error = await rejection(service.loginByQr({ communityId: 'CEB-ME9901', password: 'x' } as never));
    expect(error.message).toBe('Account is deactivated');
  });

  it('public PUT /auth/signup (updateSignup) is refused with 403 for a locked account', async () => {
    prisma.member.findFirst.mockResolvedValue({ ...member, user: lockedUser() });
    const dto = {
      memberId: 'member-1',
      communityId: 'CEB-ME9901',
      firstName: 'Test',
      lastName: 'Nomobile',
      encounterType: 'ME',
      classNumber: '99',
      phone: '09171234567',
      password: 'new-password',
    } as SignupUpdateDto;
    const error = await rejection(service.updateSignup(dto));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resetPassword refuses a locked account', async () => {
    jwtService.verify.mockReturnValue({ userId: 'user-1', type: 'password-reset' });
    prisma.user.findUnique.mockResolvedValue(lockedUser());
    const error = await rejection(service.resetPassword({ token: 't', password: 'new-password' } as never));
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('setPasswordFromTemp refuses a locked account', async () => {
    prisma.member.findUnique.mockResolvedValue({ ...member, user: lockedUser() });
    const error = await rejection(
      service.setPasswordFromTemp({
        communityId: 'CEB-ME9901',
        tempPassword: 'correct-password',
        newPassword: 'new-password',
      } as never),
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refreshToken refuses a locked account', async () => {
    jwtService.verify.mockReturnValue({});
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: lockedUser(),
    });
    const error = await rejection(service.refreshToken({ refreshToken: 'r' } as never));
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe(ADMIN_ACTIVATION_MESSAGE);
  });

  it('an unlocked account with a valid password can still log in', async () => {
    prisma.member.findUnique.mockResolvedValue({
      ...member,
      user: lockedUser({ adminActivationRequired: false, phone: '09171234567' }),
    });
    const tokens = jest
      .spyOn(service as unknown as { generateTokens: () => Promise<unknown> }, 'generateTokens')
      .mockResolvedValue({ accessToken: 'a' });
    await expect(
      service.loginByQr({ communityId: 'CEB-ME9901', password: 'correct-password' } as never),
    ).resolves.toEqual({ accessToken: 'a' });
    expect(tokens).toHaveBeenCalled();
  });
});

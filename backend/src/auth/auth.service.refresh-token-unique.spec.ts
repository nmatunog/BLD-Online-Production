import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import type { AuthResult } from './interfaces/auth-result.interface';

type GenerateTokens = (
  user: { id: string; email: string | null; phone: string | null; role: UserRole },
  member: null,
) => Promise<AuthResult>;

describe('AuthService refresh tokens are unique per login', () => {
  const prisma = {
    session: { create: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const jwtService = new JwtService();
  const user = {
    id: 'user-1',
    email: null,
    phone: '09171234567',
    role: UserRole.MEMBER,
    isActive: true,
  };
  let service: AuthService;
  let generateTokens: GenerateTokens;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // Freeze the clock so both logins get the same JWT `iat` second.
    jest.useFakeTimers({ now: new Date('2026-11-24T01:00:00.000Z') });
    prisma.session.create.mockResolvedValue({});
    service = new AuthService(prisma as never, jwtService, {} as never);
    generateTokens = (
      service as unknown as { generateTokens: GenerateTokens }
    ).generateTokens.bind(service);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives two logins for the same user in the same second different refresh tokens', async () => {
    const first = await generateTokens(user, null);
    const second = await generateTokens(user, null);

    expect(first.refreshToken).not.toEqual(second.refreshToken);
    const stored = prisma.session.create.mock.calls.map((c) => c[0].data.refreshToken);
    expect(stored).toEqual([first.refreshToken, second.refreshToken]);
    expect(new Set(stored).size).toBe(2);

    const a = jwtService.verify(first.refreshToken, { secret: 'test-refresh-secret' });
    const b = jwtService.verify(second.refreshToken, { secret: 'test-refresh-secret' });
    expect(a.iat).toBe(b.iat);
    expect(a.sub).toBe('user-1');
    expect(typeof a.jti).toBe('string');
    expect(a.jti).not.toBe(b.jti);
  });

  it('leaves the access token payload unchanged (no jti)', async () => {
    const { accessToken } = await generateTokens(user, null);
    const payload = jwtService.verify(accessToken, { secret: 'test-access-secret' });
    expect(payload).toEqual(
      expect.objectContaining({ sub: 'user-1', phone: '09171234567', role: UserRole.MEMBER }),
    );
    expect(payload.jti).toBeUndefined();
  });

  it('still refreshes by looking up the exact stored refresh token', async () => {
    const { refreshToken } = await generateTokens(user, null);
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      user,
    });
    prisma.user.findUnique.mockResolvedValue({ ...user, member: null });
    prisma.session.create.mockResolvedValue({});

    const result = await service.refreshToken({ refreshToken });

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { refreshToken },
      include: { user: true },
    });
    expect(result.refreshToken).not.toEqual(refreshToken);
  });
});

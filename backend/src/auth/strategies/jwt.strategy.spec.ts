import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy accepts access tokens only', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = 'strategy-secret';
    prisma.user.findUnique.mockReset();
    strategy = new JwtStrategy(prisma as never);
  });

  it('rejects reset and signup-edit tokens before touching the database', async () => {
    for (const payload of [
      { userId: 'u1', type: 'password-reset' },
      { memberId: 'm1', communityId: 'CEB-ME1801', type: 'signup-edit' },
      { sub: 'u1', type: 'signup-edit' },
    ]) {
      await expect(strategy.validate(payload as never)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('still accepts a normal access token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: null,
      phone: '09171234567',
      role: 'MEMBER',
      isActive: true,
      member: { ministry: null },
    });
    await expect(
      strategy.validate({ sub: 'u1', email: null, phone: '09171234567', role: 'MEMBER' }),
    ).resolves.toMatchObject({ id: 'u1', role: 'MEMBER' });
  });
});

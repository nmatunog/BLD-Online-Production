import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { SignupDto } from './dto/signup.dto';
import type { SignupUpdateDto } from './dto/signup-lookup.dto';

const signup: SignupDto = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  nickname: 'Jun',
  encounterType: 'ME',
  classNumber: '18',
  phone: '09171234567',
  idPhoto: 'data:image/jpeg;base64,AAAA',
} as SignupDto;

describe('AuthService signup possible-duplicate check', () => {
  const prisma = {
    user: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
    member: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const membersService = {
    savePhoto: jest.fn(),
    regenerateQRCode: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    service = new AuthService(prisma as never, new JwtService({}), membersService as never);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.user.create.mockResolvedValue({ id: 'user-new' });
    prisma.member.create.mockResolvedValue({
      id: 'member-new',
      userId: 'user-new',
      communityId: 'CEB-ME1803',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      nickname: 'Jun',
      encounterType: 'ME',
      classNumber: 18,
    });
    membersService.savePhoto.mockResolvedValue({ photoUrl: 'https://bld-idphotos.b-cdn.net/new.jpg' });
    membersService.regenerateQRCode.mockResolvedValue({ qrCodeUrl: null });
    jest
      .spyOn(service as unknown as { generateCommunityId: () => Promise<string> }, 'generateCommunityId')
      .mockResolvedValue('CEB-ME1803');
  });

  it('only looks for a same first AND last name match, never the nickname', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await service.signup(signup);
    expect(prisma.member.findFirst).toHaveBeenCalledTimes(1);
    const where = prisma.member.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({
      lastName: { equals: 'Dela Cruz', mode: 'insensitive' },
      firstName: { equals: 'Juan', mode: 'insensitive' },
    });
    expect(JSON.stringify(where)).not.toContain('nickname');
  });

  it('lets a sibling with the same last name and nickname sign up', async () => {
    // Different first name, same "Dela Cruz" + "Jun": no name match, so no flag.
    prisma.member.findFirst.mockResolvedValue(null);
    const result = await service.signup({ ...signup, firstName: 'Jose' } as SignupDto);
    expect(result.communityId).toBe('CEB-ME1803');
    expect(prisma.member.create).toHaveBeenCalled();
  });

  it('flags a same-name member without revealing their account details', async () => {
    prisma.member.findFirst.mockResolvedValue({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      encounterType: 'ME',
      classNumber: 10,
    });

    let caught: unknown;
    try {
      await service.signup(signup);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConflictException);
    const body = (caught as ConflictException).getResponse();
    expect(body).toEqual({
      code: 'POSSIBLE_DUPLICATE',
      message: 'A member with this first and last name is already registered.',
      possibleDuplicate: { firstName: 'Juan', lastName: 'Dela Cruz', encounterType: 'ME', classNumber: 10 },
    });
    expect(JSON.stringify(body)).not.toMatch(/memberId|communityId|photo|existing/i);
    expect(prisma.member.findFirst.mock.calls[0][0].select).toEqual({
      firstName: true,
      lastName: true,
      encounterType: true,
      classNumber: true,
    });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });

  it('continues the signup once the person confirms it is not them', async () => {
    prisma.member.findFirst.mockResolvedValue({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      encounterType: 'ME',
      classNumber: 10,
    });
    const result = await service.signup({ ...signup, confirmNotDuplicate: true } as SignupDto);
    expect(result.isExistingMember).toBe(false);
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
    expect(prisma.member.create).toHaveBeenCalled();
  });

  it('flags (not blocks) a rename to another member’s name in Edit details', async () => {
    const update = {
      memberId: 'member-own',
      communityId: 'CEB-ME1803',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      nickname: 'Jun',
      encounterType: 'ME',
      classNumber: '18',
      editToken: new JwtService({}).sign(
        { memberId: 'member-own', communityId: 'CEB-ME1803', type: 'signup-edit' },
        { secret: 'test-secret', expiresIn: '7d' },
      ),
    } as SignupUpdateDto;
    prisma.member.findFirst
      .mockResolvedValueOnce({ id: 'member-own', communityId: 'CEB-ME1803', userId: 'u', user: {} })
      .mockResolvedValueOnce({ firstName: 'Juan', lastName: 'Dela Cruz', encounterType: 'ME', classNumber: 10 });

    await expect(service.updateSignup(update)).rejects.toBeInstanceOf(ConflictException);
    const clashQuery = prisma.member.findFirst.mock.calls[1][0];
    expect(clashQuery.where.id).toEqual({ not: 'member-own' });
    expect(JSON.stringify(clashQuery.where)).not.toContain('nickname');
  });
});

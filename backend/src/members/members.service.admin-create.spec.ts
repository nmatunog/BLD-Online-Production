import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MembersService } from './members.service';
import type { AdminCreateMemberDto } from './dto/admin-create-member.dto';

const actor = { id: 'admin-1', role: UserRole.ADMINISTRATOR };

const base: AdminCreateMemberDto = {
  firstName: '  Test ',
  lastName: ' Nomobile ',
  encounterType: 'me',
  classNumber: '99',
} as AdminCreateMemberDto;

function p2002(target: string[]) {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target } });
}

describe('MembersService.adminCreate', () => {
  const tx = {
    user: { create: jest.fn() },
    member: { create: jest.fn() },
    memberMinistryHistory: { create: jest.fn() },
  };
  const prisma = {
    user: { findFirst: jest.fn() },
    member: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  };
  const bunnyCDN = { isConfigured: jest.fn().mockReturnValue(false) };
  let service: MembersService;
  let generateCommunityId: jest.SpyInstance;
  let regenerateQRCode: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new MembersService(prisma as never, bunnyCDN as never);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.member.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'user-new',
      ...data,
    }));
    tx.member.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'member-new',
      ...data,
    }));
    // What the DB would return after commit: only the safe user select, never passwordHash.
    prisma.member.findUniqueOrThrow.mockImplementation(async () => {
      const userData = tx.user.create.mock.calls.at(-1)?.[0].data ?? {};
      const memberData = tx.member.create.mock.calls.at(-1)?.[0].data ?? {};
      return {
        id: 'member-new',
        ...memberData,
        user: {
          id: 'user-new',
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          isActive: userData.isActive,
          adminActivationRequired: userData.adminActivationRequired,
        },
        ministryHistory: [],
      };
    });
    generateCommunityId = jest
      .spyOn(service as unknown as { generateCommunityId: () => Promise<string> }, 'generateCommunityId')
      .mockResolvedValue('CEB-ME9901');
    regenerateQRCode = jest
      .spyOn(service, 'regenerateQRCode')
      .mockResolvedValue({ id: 'member-new', communityId: 'CEB-ME9901', qrCodeUrl: 'data:image/png;base64,QR' });
  });

  async function catchError(promise: Promise<unknown>): Promise<unknown> {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('expected promise to reject');
  }

  it('without a mobile creates a login-locked user that can still get an ID', async () => {
    const result = await service.adminCreate(base, actor);

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: null,
        phone: null,
        passwordHash: null,
        role: UserRole.MEMBER,
        isActive: true,
        adminActivationRequired: true,
      },
    });
    expect(tx.member.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-new',
      firstName: 'Test',
      lastName: 'Nomobile',
      communityId: 'CEB-ME9901',
      city: 'CEB',
      encounterType: 'ME',
      classNumber: 99,
    });
    expect(generateCommunityId).toHaveBeenCalledWith('CEB', 'ME', '99');
    expect(regenerateQRCode).toHaveBeenCalledWith('member-new');
    expect(result.user).toMatchObject({ phone: null, isActive: true, adminActivationRequired: true });
  });

  it('with a mobile creates a normal (unlocked) account with a normalized phone', async () => {
    await service.adminCreate({ ...base, phone: '09171234567' }, actor);
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      phone: '09171234567',
      passwordHash: null,
      adminActivationRequired: false,
    });
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
      phone: { in: ['09171234567', '+639171234567'] },
    });
  });

  it('rejects an invalid mobile with 400', async () => {
    const error = await catchError(service.adminCreate({ ...base, phone: '12345' }, actor));
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe('Invalid Philippine mobile number. Use format: 09XXXXXXXXX');
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects a mobile that is already registered with 409', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'someone' });
    const error = await catchError(service.adminCreate({ ...base, phone: '09171234567' }, actor));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('This mobile number is already registered');
  });

  it('rejects an email that is already in use (case-insensitive) with 409', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'someone' });
    const error = await catchError(service.adminCreate({ ...base, email: 'Juan@Example.com' }, actor));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('This email is already in use by another account.');
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
      email: { equals: 'juan@example.com', mode: 'insensitive' },
    });
  });

  it('stores email lower-cased', async () => {
    await service.adminCreate({ ...base, email: ' Juan@Example.com ' }, actor);
    expect(tx.user.create.mock.calls[0][0].data.email).toBe('juan@example.com');
  });

  it.each([
    ['same class', { encounterType: 'ME', classNumber: 99 }, true],
    ['different class', { encounterType: 'ME', classNumber: 12 }, false],
  ])('flags a same-name member as POSSIBLE_DUPLICATE (%s)', async (_label, cls, sameClass) => {
    prisma.member.findFirst.mockResolvedValue({
      firstName: 'Test',
      lastName: 'Nomobile',
      nickname: 'Tess',
      communityId: 'CEB-ME9905',
      ...cls,
    });
    const error = await catchError(service.adminCreate(base, actor));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      code: 'POSSIBLE_DUPLICATE',
      message: 'A member with this first and last name is already registered.',
      possibleDuplicate: {
        firstName: 'Test',
        lastName: 'Nomobile',
        nickname: 'Tess',
        communityId: 'CEB-ME9905',
        ...cls,
      },
      sameClass,
    });
    expect(prisma.member.findFirst.mock.calls[0][0].where).toEqual({
      firstName: { equals: 'Test', mode: 'insensitive' },
      lastName: { equals: 'Nomobile', mode: 'insensitive' },
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('creates anyway when confirmNotDuplicate is set', async () => {
    prisma.member.findFirst.mockResolvedValue({
      firstName: 'Test',
      lastName: 'Nomobile',
      nickname: null,
      communityId: 'CEB-ME9905',
      encounterType: 'ME',
      classNumber: 99,
    });
    await service.adminCreate({ ...base, confirmNotDuplicate: true }, actor);
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
    expect(tx.member.create).toHaveBeenCalledTimes(1);
  });

  it('retries with a fresh Community ID when the generated one collides', async () => {
    generateCommunityId.mockResolvedValueOnce('CEB-ME9901').mockResolvedValueOnce('CEB-ME9902');
    tx.member.create.mockRejectedValueOnce(p2002(['communityId']));
    await service.adminCreate(base, actor);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.member.create.mock.calls[1][0].data.communityId).toBe('CEB-ME9902');
  });

  it('gives a clean error after 3 Community ID collisions', async () => {
    tx.member.create.mockRejectedValue(p2002(['communityId']));
    const error = await catchError(service.adminCreate(base, actor));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe('Could not assign a unique Community ID. Please try again.');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('maps a racing duplicate phone (P2002) to 409 and anything else to a safe 400', async () => {
    tx.user.create.mockRejectedValueOnce(p2002(['phone']));
    const dup = await catchError(service.adminCreate({ ...base, phone: '09171234567' }, actor));
    expect(dup).toBeInstanceOf(ConflictException);

    tx.user.create.mockRejectedValueOnce(new Error('connection reset'));
    const other = await catchError(service.adminCreate(base, actor));
    expect(other).toBeInstanceOf(BadRequestException);
    expect((other as Error).message).not.toContain('connection reset');
  });

  it('creates a ministry history row when a ministry is set', async () => {
    await service.adminCreate(
      {
        ...base,
        apostolate: 'evangelization apostolate',
        ministry: 'Praise Ministry',
        ministryStartDate: '2026-11-01',
      },
      actor,
    );
    expect(tx.member.create.mock.calls[0][0].data).toMatchObject({
      apostolate: 'Evangelization Apostolate',
      ministry: 'Praise Ministry',
    });
    const history = tx.memberMinistryHistory.create.mock.calls[0][0].data;
    expect(history).toMatchObject({ memberId: 'member-new', ministry: 'Praise Ministry', endDate: null });
    expect(history.startDate).toBeInstanceOf(Date);
  });

  it('does not create a history row without a ministry', async () => {
    await service.adminCreate(base, actor);
    expect(tx.memberMinistryHistory.create).not.toHaveBeenCalled();
  });

  it('rejects a ministry that does not belong to the apostolate with 400', async () => {
    const error = await catchError(
      service.adminCreate(
        { ...base, apostolate: 'Pastoral Apostolate', ministry: 'Praise Ministry' },
        actor,
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('keeps the member when QR generation fails', async () => {
    regenerateQRCode.mockRejectedValueOnce(new Error('cdn down'));
    const result = await service.adminCreate(base, actor);
    expect(result.communityId).toBe('CEB-ME9901');
  });

  it('never returns passwordHash', async () => {
    const result = await service.adminCreate({ ...base, phone: '09171234567' }, actor);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    const select = prisma.member.findUniqueOrThrow.mock.calls[0][0].include.user.select;
    expect(select.passwordHash).toBeUndefined();
  });
});

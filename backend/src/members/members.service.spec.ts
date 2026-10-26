import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  BULK_PERMANENT_DELETE_TX_MAX_WAIT_MS,
  BULK_PERMANENT_DELETE_TX_TIMEOUT_MS,
  MembersService,
} from './members.service';
import { MAX_BULK_PERMANENT_DELETE } from './dto/bulk-permanent-delete.dto';

const ID = {
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  superCaller: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  m1: '11111111-1111-4111-8111-111111111111',
  u1: '11111111-1111-4111-8111-111111111110',
  m2: '22222222-2222-4222-8222-222222222222',
  u2: '22222222-2222-4222-8222-222222222220',
  mKeep: '33333333-3333-4333-8333-333333333333',
  uKeep: '33333333-3333-4333-8333-333333333330',
  mSelf: '44444444-4444-4444-8444-444444444444',
  mOk: '55555555-5555-4555-8555-555555555555',
  uOk: '55555555-5555-4555-8555-555555555550',
  mSuper: '66666666-6666-4666-8666-666666666666',
  uSuper: '66666666-6666-4666-8666-666666666660',
  missing: '99999999-9999-4999-8999-999999999999',
};

type StoredMember = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  communityId: string;
  user: { id: string; role: UserRole; isActive: boolean };
};

function seedMember(
  overrides: Partial<StoredMember> & Pick<StoredMember, 'id' | 'userId' | 'communityId'>,
): StoredMember {
  return {
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'Account',
    id: overrides.id,
    userId: overrides.userId,
    communityId: overrides.communityId,
    user: {
      id: overrides.user?.id ?? overrides.userId,
      role: overrides.user?.role ?? UserRole.MEMBER,
      isActive: overrides.user?.isActive ?? true,
    },
  };
}

function uuidAt(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

describe('MembersService.bulkPermanentDelete', () => {
  const bunnyCDN = { isConfigured: jest.fn().mockReturnValue(false) };

  let store: {
    members: Record<string, StoredMember>;
    users: Record<string, { id: string; role: UserRole; isActive: boolean }>;
  };
  let prisma: {
    member: { findUnique: jest.Mock; delete: jest.Mock };
    user: { update: jest.Mock; delete: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: MembersService;
  let loggerLog: jest.SpyInstance;

  const admin = { id: ID.admin, role: UserRole.ADMINISTRATOR };

  function makeTx() {
    return {
      member: {
        findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
          const row = store.members[id];
          return row ?? null;
        }),
        delete: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
          const row = store.members[id];
          if (!row) throw new Error(`member ${id} missing`);
          delete store.members[id];
          return row;
        }),
      },
      user: {
        update: jest.fn(
          async ({
            where: { id },
            data,
          }: {
            where: { id: string };
            data: { isActive: boolean };
          }) => {
            const row = store.users[id];
            if (!row) throw new Error(`user ${id} missing`);
            store.users[id] = { ...row, ...data };
            return store.users[id];
          },
        ),
        delete: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
          const row = store.users[id];
          if (!row) throw new Error(`user ${id} missing`);
          delete store.users[id];
          return row;
        }),
      },
    };
  }

  function putMember(member: StoredMember) {
    store.members[member.id] = member;
    store.users[member.userId] = { ...member.user };
  }

  beforeEach(() => {
    store = { members: {}, users: {} };
    const tx = makeTx();
    prisma = {
      member: { findUnique: tx.member.findUnique, delete: tx.member.delete },
      user: { update: tx.user.update, delete: tx.user.delete },
      $transaction: jest.fn(async (fn: (client: ReturnType<typeof makeTx>) => unknown) => {
        const snapshot = {
          members: { ...store.members },
          users: { ...store.users },
        };
        try {
          return await fn(tx);
        } catch (error) {
          store.members = snapshot.members;
          store.users = snapshot.users;
          throw error;
        }
      }),
    };
    service = new MembersService(prisma as never, bunnyCDN as never);
    loggerLog = jest.spyOn((service as unknown as { logger: { log: (msg: string) => void } }).logger, 'log');
    loggerLog.mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerLog.mockRestore();
  });

  describe('role checks', () => {
    it.each([
      UserRole.MEMBER,
      UserRole.DCS,
      UserRole.MINISTRY_COORDINATOR,
      UserRole.CLASS_SHEPHERD,
    ])('rejects %s', async (role) => {
      await expect(
        service.bulkPermanentDelete([ID.m1], { id: ID.u1, role }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows ADMINISTRATOR and SUPER_USER', async () => {
      putMember(seedMember({ id: ID.m1, userId: ID.u1, communityId: 'CEB-ME9902' }));
      await expect(
        service.bulkPermanentDelete([ID.m1], admin),
      ).resolves.toMatchObject({ deletedCount: 1 });

      putMember(seedMember({ id: ID.m2, userId: ID.u2, communityId: 'CEB-ME8802' }));
      await expect(
        service.bulkPermanentDelete([ID.m2], { id: ID.superCaller, role: UserRole.SUPER_USER }),
      ).resolves.toMatchObject({ deletedCount: 1 });
    });
  });

  describe('self and SUPER_USER guards', () => {
    it('never deletes the caller own account and rolls back the batch', async () => {
      putMember(seedMember({ id: ID.mKeep, userId: ID.uKeep, communityId: 'CEB-ME8801' }));
      putMember(
        seedMember({
          id: ID.mSelf,
          userId: admin.id,
          communityId: 'CEB-ME8605',
          firstName: 'Nilo',
          lastName: 'Admin',
        }),
      );

      await expect(
        service.bulkPermanentDelete([ID.mKeep, ID.mSelf], admin),
      ).rejects.toThrow('You cannot permanently delete your own account.');

      expect(store.members[ID.mKeep]).toBeDefined();
      expect(store.members[ID.mSelf]).toBeDefined();
      expect(store.users[admin.id]).toBeDefined();
    });

    it('never deletes a SUPER_USER account even when the caller is SUPER_USER', async () => {
      putMember(seedMember({ id: ID.mOk, userId: ID.uOk, communityId: 'CEB-ME8606' }));
      putMember(
        seedMember({
          id: ID.mSuper,
          userId: ID.uSuper,
          communityId: 'CEB-ME9901',
          user: { id: ID.uSuper, role: UserRole.SUPER_USER, isActive: true },
        }),
      );

      await expect(
        service.bulkPermanentDelete(
          [ID.mOk, ID.mSuper],
          { id: ID.superCaller, role: UserRole.SUPER_USER },
        ),
      ).rejects.toThrow('SUPER_USER accounts cannot be permanently deleted.');

      expect(store.members[ID.mOk]).toBeDefined();
      expect(store.members[ID.mSuper]).toBeDefined();
      expect(store.users[ID.uSuper]).toBeDefined();
    });
  });

  describe('rollback and cascade', () => {
    it('rolls back every delete when any id is missing', async () => {
      putMember(seedMember({ id: ID.m1, userId: ID.u1, communityId: 'CEB-ME9902' }));

      await expect(
        service.bulkPermanentDelete([ID.m1, ID.missing], admin),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(store.members[ID.m1]).toBeDefined();
      expect(store.users[ID.u1]).toEqual({
        id: ID.u1,
        role: UserRole.MEMBER,
        isActive: true,
      });
    });

    it('deactivates first then deletes member before user so Prisma cascades apply', async () => {
      putMember(
        seedMember({
          id: ID.m1,
          userId: ID.u1,
          communityId: 'CEB-ME9902',
          firstName: 'Ada',
          lastName: 'Reyes',
        }),
      );
      putMember(
        seedMember({
          id: ID.m2,
          userId: ID.u2,
          communityId: 'CEB-ME8802',
          firstName: 'Ben',
          lastName: 'Cruz',
          user: { id: ID.u2, role: UserRole.MEMBER, isActive: true },
        }),
      );

      const order: string[] = [];
      prisma.$transaction.mockImplementationOnce(
        async (fn: (client: ReturnType<typeof makeTx>) => unknown) => {
          const inner = makeTx();
          const userUpdate = inner.user.update;
          const memberDelete = inner.member.delete;
          const userDelete = inner.user.delete;
          inner.user.update = jest.fn(async (args) => {
            order.push(`deactivate:${args.where.id}`);
            return userUpdate(args);
          });
          inner.member.delete = jest.fn(async (args) => {
            order.push(`member.delete:${args.where.id}`);
            return memberDelete(args);
          });
          inner.user.delete = jest.fn(async (args) => {
            order.push(`user.delete:${args.where.id}`);
            return userDelete(args);
          });
          return fn(inner);
        },
      );

      const result = await service.bulkPermanentDelete([ID.m1, ID.m2], admin);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: BULK_PERMANENT_DELETE_TX_MAX_WAIT_MS,
        timeout: BULK_PERMANENT_DELETE_TX_TIMEOUT_MS,
      });
      expect(order).toEqual([
        `deactivate:${ID.u1}`,
        `member.delete:${ID.m1}`,
        `user.delete:${ID.u1}`,
        `deactivate:${ID.u2}`,
        `member.delete:${ID.m2}`,
        `user.delete:${ID.u2}`,
      ]);
      expect(store.members).toEqual({});
      expect(store.users).toEqual({});
      expect(result).toEqual({
        deletedCount: 2,
        communityIds: ['CEB-ME9902', 'CEB-ME8802'],
        results: [
          { memberId: ID.m1, communityId: 'CEB-ME9902', name: 'Ada Reyes', status: 'deleted' },
          { memberId: ID.m2, communityId: 'CEB-ME8802', name: 'Ben Cruz', status: 'deleted' },
        ],
      });
      expect(loggerLog).toHaveBeenCalledWith(
        `AUDIT bulk-permanent-delete admin=${ID.admin} deletedCommunityIds=CEB-ME9902,CEB-ME8802`,
      );
    });

    it('rejects an empty memberIds array before opening a transaction', async () => {
      await expect(service.bulkPermanentDelete([], admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.bulkPermanentDelete(['', '  '], admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects more than 50 ids before opening a transaction', async () => {
      const ids = Array.from({ length: MAX_BULK_PERMANENT_DELETE + 1 }, (_, i) => uuidAt(i));
      await expect(service.bulkPermanentDelete(ids, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MembersService } from './members.service';
import { MAX_BULK_PERMANENT_DELETE } from './dto/bulk-permanent-delete.dto';

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

  const admin = { id: 'admin-1', role: UserRole.ADMINISTRATOR };

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
        service.bulkPermanentDelete(['m1'], { id: 'u1', role }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows ADMINISTRATOR and SUPER_USER', async () => {
      putMember(seedMember({ id: 'm1', userId: 'u1', communityId: 'CEB-ME9902' }));
      await expect(
        service.bulkPermanentDelete(['m1'], admin),
      ).resolves.toMatchObject({ deletedCount: 1 });

      putMember(seedMember({ id: 'm2', userId: 'u2', communityId: 'CEB-ME8802' }));
      await expect(
        service.bulkPermanentDelete(['m2'], { id: 'super-1', role: UserRole.SUPER_USER }),
      ).resolves.toMatchObject({ deletedCount: 1 });
    });
  });

  describe('self and SUPER_USER guards', () => {
    it('never deletes the caller own account and rolls back the batch', async () => {
      putMember(seedMember({ id: 'm-keep', userId: 'u-keep', communityId: 'CEB-ME8801' }));
      putMember(
        seedMember({
          id: 'm-self',
          userId: admin.id,
          communityId: 'CEB-ME8605',
          firstName: 'Nilo',
          lastName: 'Admin',
        }),
      );

      await expect(
        service.bulkPermanentDelete(['m-keep', 'm-self'], admin),
      ).rejects.toThrow('You cannot permanently delete your own account.');

      expect(store.members['m-keep']).toBeDefined();
      expect(store.members['m-self']).toBeDefined();
      expect(store.users[admin.id]).toBeDefined();
    });

    it('never deletes a SUPER_USER account even when the caller is SUPER_USER', async () => {
      putMember(seedMember({ id: 'm-ok', userId: 'u-ok', communityId: 'CEB-ME8606' }));
      putMember(
        seedMember({
          id: 'm-super',
          userId: 'u-super',
          communityId: 'CEB-ME9901',
          user: { id: 'u-super', role: UserRole.SUPER_USER, isActive: true },
        }),
      );

      await expect(
        service.bulkPermanentDelete(
          ['m-ok', 'm-super'],
          { id: 'super-caller', role: UserRole.SUPER_USER },
        ),
      ).rejects.toThrow('SUPER_USER accounts cannot be permanently deleted.');

      expect(store.members['m-ok']).toBeDefined();
      expect(store.members['m-super']).toBeDefined();
      expect(store.users['u-super']).toBeDefined();
    });
  });

  describe('rollback and cascade', () => {
    it('rolls back every delete when any id is missing', async () => {
      putMember(seedMember({ id: 'm1', userId: 'u1', communityId: 'CEB-ME9902' }));

      await expect(
        service.bulkPermanentDelete(['m1', 'missing'], admin),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(store.members['m1']).toBeDefined();
      expect(store.users['u1']).toEqual({
        id: 'u1',
        role: UserRole.MEMBER,
        isActive: true,
      });
    });

    it('deactivates first then deletes member before user so Prisma cascades apply', async () => {
      putMember(
        seedMember({
          id: 'm1',
          userId: 'u1',
          communityId: 'CEB-ME9902',
          firstName: 'Ada',
          lastName: 'Reyes',
        }),
      );
      putMember(
        seedMember({
          id: 'm2',
          userId: 'u2',
          communityId: 'CEB-ME8802',
          firstName: 'Ben',
          lastName: 'Cruz',
          user: { id: 'u2', role: UserRole.MEMBER, isActive: true },
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

      const result = await service.bulkPermanentDelete(['m1', 'm2'], admin);

      expect(order).toEqual([
        'deactivate:u1',
        'member.delete:m1',
        'user.delete:u1',
        'deactivate:u2',
        'member.delete:m2',
        'user.delete:u2',
      ]);
      expect(store.members).toEqual({});
      expect(store.users).toEqual({});
      expect(result).toEqual({
        deletedCount: 2,
        communityIds: ['CEB-ME9902', 'CEB-ME8802'],
        results: [
          { memberId: 'm1', communityId: 'CEB-ME9902', name: 'Ada Reyes', status: 'deleted' },
          { memberId: 'm2', communityId: 'CEB-ME8802', name: 'Ben Cruz', status: 'deleted' },
        ],
      });
      expect(loggerLog).toHaveBeenCalledWith(
        'AUDIT bulk-permanent-delete admin=admin-1 deletedCommunityIds=CEB-ME9902,CEB-ME8802',
      );
    });

    it('rejects more than 50 ids before opening a transaction', async () => {
      const ids = Array.from({ length: MAX_BULK_PERMANENT_DELETE + 1 }, (_, i) => `m${i}`);
      await expect(service.bulkPermanentDelete(ids, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

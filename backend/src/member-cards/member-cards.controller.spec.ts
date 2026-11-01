import 'reflect-metadata';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberCardsController } from './member-cards.controller';
import { CARD_ADMIN_ROLES, CARD_VERIFY_STAFF_ROLES } from './member-card-roles';
import { MemberCardsService } from './member-cards.service';

function handlerContext(
  handler: (...args: never[]) => unknown,
  role?: UserRole,
  ministry: string | null = 'Worship',
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => MemberCardsController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 'user-1', role, ministry } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('MemberCardsController verify auth', () => {
  const guard = new RolesGuard(new Reflector());
  const reflector = new Reflector();

  function checkInStatus(role?: UserRole, ministry: string | null = 'Worship'): number {
    try {
      return guard.canActivate(
        handlerContext(MemberCardsController.prototype.checkIn, role, ministry),
      )
        ? HttpStatus.OK
        : HttpStatus.FORBIDDEN;
    } catch {
      return HttpStatus.FORBIDDEN;
    }
  }

  it('is public so a phone scanner does not need to sign in', () => {
    expect(reflector.get(IS_PUBLIC_KEY, MemberCardsController.prototype.verify)).toBe(true);
    expect(guard.canActivate(handlerContext(MemberCardsController.prototype.verify))).toBe(true);
    expect(
      guard.canActivate(handlerContext(MemberCardsController.prototype.verify, UserRole.MEMBER)),
    ).toBe(true);
  });

  it('returns 200 when staff or a guest calls verify', async () => {
    const service = {
      verify: jest.fn().mockResolvedValue({
        view: 'staff',
        status: 'ACTIVE',
        cardStatus: 'ACTIVE',
        member: null,
        cardId: 'card-1',
      }),
    };
    const controller = new MemberCardsController(service as unknown as MemberCardsService);
    const staffBody = await controller.verify(
      'sometokenvalue0123456789ab',
      { ip: '127.0.0.1', headers: {} } as never,
      { id: 'admin-1', role: UserRole.ADMINISTRATOR },
    );
    expect(staffBody.success).toBe(true);
    expect(service.verify).toHaveBeenCalledWith(
      'sometokenvalue0123456789ab',
      { id: 'admin-1', role: UserRole.ADMINISTRATOR, ministry: undefined },
      '127.0.0.1',
    );

    await controller.verify('sometokenvalue0123456789ab', {
      ip: '10.0.0.2',
      headers: {},
    } as never);
    expect(service.verify).toHaveBeenLastCalledWith(
      'sometokenvalue0123456789ab',
      null,
      '10.0.0.2',
    );
  });

  it('restricts export and member-ids to card admins', () => {
    const exportContext = (role: UserRole): ExecutionContext =>
      ({
        getHandler: () => MemberCardsController.prototype.export,
        getClass: () => MemberCardsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user-1', role } }),
        }),
      }) as unknown as ExecutionContext;
    const memberIdsContext = (role: UserRole): ExecutionContext =>
      ({
        getHandler: () => MemberCardsController.prototype.memberIds,
        getClass: () => MemberCardsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user-1', role } }),
        }),
      }) as unknown as ExecutionContext;

    expect(guard.canActivate(exportContext(UserRole.ADMINISTRATOR))).toBe(true);
    expect(guard.canActivate(exportContext(UserRole.DCS))).toBe(true);
    expect(guard.canActivate(exportContext(UserRole.MEMBER))).toBe(false);
    expect(guard.canActivate(exportContext(UserRole.MINISTRY_COORDINATOR))).toBe(false);
    expect(guard.canActivate(memberIdsContext(UserRole.SUPER_USER))).toBe(true);
    expect(guard.canActivate(memberIdsContext(UserRole.MEMBER))).toBe(false);
  });

  it('allows only admin and door-staff roles on check-in', () => {
    expect(CARD_VERIFY_STAFF_ROLES).toEqual([
      UserRole.SUPER_USER,
      UserRole.ADMINISTRATOR,
      UserRole.DCS,
      UserRole.MINISTRY_COORDINATOR,
      UserRole.CLASS_SHEPHERD,
    ]);
    expect(CARD_VERIFY_STAFF_ROLES).not.toContain(UserRole.MEMBER);
    expect(checkInStatus(UserRole.SUPER_USER)).toBe(200);
    expect(checkInStatus(UserRole.DCS)).toBe(200);
    expect(checkInStatus(UserRole.MINISTRY_COORDINATOR)).toBe(200);
    expect(checkInStatus(UserRole.CLASS_SHEPHERD)).toBe(200);
    expect(checkInStatus(UserRole.MEMBER)).toBe(403);
    expect(checkInStatus()).toBe(403);
  });
});

describe('MemberCardsController print pack auth', () => {
  const guard = new RolesGuard(new Reflector());

  function printPackAllowed(role?: UserRole): boolean {
    try {
      return guard.canActivate(handlerContext(MemberCardsController.prototype.printPack, role));
    } catch {
      return false;
    }
  }

  it('allows only card admins to download a print pack', () => {
    for (const role of CARD_ADMIN_ROLES) expect(printPackAllowed(role)).toBe(true);
    expect(printPackAllowed(UserRole.MINISTRY_COORDINATOR)).toBe(false);
    expect(printPackAllowed(UserRole.CLASS_SHEPHERD)).toBe(false);
    expect(printPackAllowed(UserRole.MEMBER)).toBe(false);
    expect(printPackAllowed()).toBe(false);
  });

  it('is not public', () => {
    expect(
      new Reflector().get(IS_PUBLIC_KEY, MemberCardsController.prototype.printPack),
    ).toBeUndefined();
  });
});

describe('MemberCardsController card password', () => {
  it('is public (the card itself is the proof) and not a staff route', () => {
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, MemberCardsController.prototype.setPasswordWithCard)).toBe(true);
  });
});

import 'reflect-metadata';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberCardsController } from './member-cards.controller';
import { CARD_VERIFY_STAFF_ROLES } from './member-card-roles';
import { MemberCardsService } from './member-cards.service';

function verifyContext(role: UserRole, ministry: string | null = 'Worship'): ExecutionContext {
  return {
    getHandler: () => MemberCardsController.prototype.verify,
    getClass: () => MemberCardsController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-1', role, ministry } }),
    }),
  } as unknown as ExecutionContext;
}

describe('MemberCardsController verify auth', () => {
  const guard = new RolesGuard(new Reflector());

  function verifyStatus(role: UserRole, ministry: string | null = 'Worship'): number {
    return guard.canActivate(verifyContext(role, ministry))
      ? HttpStatus.OK
      : HttpStatus.FORBIDDEN;
  }

  it('returns 403 when a MEMBER with a ministry calls verify', () => {
    expect(verifyStatus(UserRole.MEMBER, 'Worship')).toBe(403);
  });

  it('returns 200 when staff calls verify', async () => {
    expect(verifyStatus(UserRole.ADMINISTRATOR)).toBe(200);
    expect(verifyStatus(UserRole.CLASS_SHEPHERD)).toBe(200);

    const service = {
      verify: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        cardStatus: 'ACTIVE',
        member: null,
        cardId: 'card-1',
      }),
    };
    const controller = new MemberCardsController(service as unknown as MemberCardsService);
    const body = await controller.verify(
      'sometokenvalue0123456789ab',
      { id: 'admin-1', role: UserRole.ADMINISTRATOR },
      { ip: '127.0.0.1', headers: {} } as never,
    );
    expect(body.success).toBe(true);
    expect(service.verify).toHaveBeenCalled();
  });

  it('allows only admin and door-staff roles on verify', () => {
    expect(CARD_VERIFY_STAFF_ROLES).toEqual([
      UserRole.SUPER_USER,
      UserRole.ADMINISTRATOR,
      UserRole.DCS,
      UserRole.MINISTRY_COORDINATOR,
      UserRole.CLASS_SHEPHERD,
    ]);
    expect(CARD_VERIFY_STAFF_ROLES).not.toContain(UserRole.MEMBER);
    expect(verifyStatus(UserRole.SUPER_USER)).toBe(200);
    expect(verifyStatus(UserRole.DCS)).toBe(200);
    expect(verifyStatus(UserRole.MINISTRY_COORDINATOR)).toBe(200);
    expect(verifyStatus(UserRole.MEMBER)).toBe(403);
  });
});

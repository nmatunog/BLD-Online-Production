import 'reflect-metadata';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MembersController } from './members.controller';

function bulkDeleteContext(role: UserRole): ExecutionContext {
  return {
    getHandler: () => MembersController.prototype.bulkPermanentDelete,
    getClass: () => MembersController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'admin-1', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('MembersController bulkPermanentDelete auth', () => {
  const guard = new RolesGuard(new Reflector());

  function statusFor(role: UserRole): number {
    return guard.canActivate(bulkDeleteContext(role))
      ? HttpStatus.OK
      : HttpStatus.FORBIDDEN;
  }

  it('allows SUPER_USER and ADMINISTRATOR only', () => {
    expect(statusFor(UserRole.SUPER_USER)).toBe(HttpStatus.OK);
    expect(statusFor(UserRole.ADMINISTRATOR)).toBe(HttpStatus.OK);
  });

  it('rejects DCS, coordinators, shepherds, and members', () => {
    expect(statusFor(UserRole.DCS)).toBe(HttpStatus.FORBIDDEN);
    expect(statusFor(UserRole.MINISTRY_COORDINATOR)).toBe(HttpStatus.FORBIDDEN);
    expect(statusFor(UserRole.CLASS_SHEPHERD)).toBe(HttpStatus.FORBIDDEN);
    expect(statusFor(UserRole.MEMBER)).toBe(HttpStatus.FORBIDDEN);
  });
});

describe('MembersController Community ID lookup (was public)', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = MembersController.prototype.publicFindByCommunityId;

  function allowed(role?: UserRole): boolean {
    try {
      return guard.canActivate({
        getHandler: () => handler,
        getClass: () => MembersController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role } : undefined }) }),
      } as unknown as ExecutionContext);
    } catch {
      return false;
    }
  }

  it('is no longer public', () => {
    expect(new Reflector().get('isPublic', handler)).toBeUndefined();
  });

  it('allows staff only; members and guests cannot read other members by Community ID', () => {
    expect(allowed(UserRole.ADMINISTRATOR)).toBe(true);
    expect(allowed(UserRole.CLASS_SHEPHERD)).toBe(true);
    expect(allowed(UserRole.MEMBER)).toBe(false);
    expect(allowed()).toBe(false);
  });
});

import 'reflect-metadata';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MembersController } from './members.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

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

function adminCreateContext(role: UserRole): ExecutionContext {
  return {
    getHandler: () => MembersController.prototype.adminCreate,
    getClass: () => MembersController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'caller-1', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('MembersController adminCreate auth', () => {
  const guard = new RolesGuard(new Reflector());

  function statusFor(role: UserRole): number {
    return guard.canActivate(adminCreateContext(role)) ? HttpStatus.OK : HttpStatus.FORBIDDEN;
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

  it('is not public (no @Public), so the global JwtAuthGuard rejects anonymous callers', () => {
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, MembersController.prototype.adminCreate)).toBeUndefined();
  });
});

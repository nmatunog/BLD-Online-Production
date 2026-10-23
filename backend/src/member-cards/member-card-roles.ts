import { UserRole } from '@prisma/client';

/** Privileged admins who may issue, revoke, reissue, export, and encode cards. */
export const CARD_ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_USER,
  UserRole.ADMINISTRATOR,
  UserRole.DCS,
];

/** Staff roles that may open /verify and run door check-in (same as staff check-in). */
export const CARD_VERIFY_STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_USER,
  UserRole.ADMINISTRATOR,
  UserRole.DCS,
  UserRole.MINISTRY_COORDINATOR,
  UserRole.CLASS_SHEPHERD,
];

export function isCardAdminRole(role: UserRole | string | null | undefined): boolean {
  return !!role && (CARD_ADMIN_ROLES as string[]).includes(role);
}

export function isCardVerifyStaffRole(role: UserRole | string | null | undefined): boolean {
  return !!role && (CARD_VERIFY_STAFF_ROLES as string[]).includes(role);
}

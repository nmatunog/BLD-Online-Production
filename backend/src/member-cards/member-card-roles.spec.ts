import { UserRole } from '@prisma/client';
import {
  CARD_VERIFY_STAFF_ROLES,
  isCardVerifyStaffRole,
} from './member-card-roles';

describe('member-card-roles', () => {
  it('treats only admin and door-staff roles as verify-capable', () => {
    expect(CARD_VERIFY_STAFF_ROLES).toEqual([
      UserRole.SUPER_USER,
      UserRole.ADMINISTRATOR,
      UserRole.DCS,
      UserRole.MINISTRY_COORDINATOR,
      UserRole.CLASS_SHEPHERD,
    ]);
    expect(isCardVerifyStaffRole(UserRole.SUPER_USER)).toBe(true);
    expect(isCardVerifyStaffRole(UserRole.ADMINISTRATOR)).toBe(true);
    expect(isCardVerifyStaffRole(UserRole.DCS)).toBe(true);
    expect(isCardVerifyStaffRole(UserRole.MINISTRY_COORDINATOR)).toBe(true);
    expect(isCardVerifyStaffRole(UserRole.CLASS_SHEPHERD)).toBe(true);
    expect(isCardVerifyStaffRole(UserRole.MEMBER)).toBe(false);
  });
});

import { UserRole } from '@prisma/client';

/** Encounter types allowed on the simple /signup flow */
export const SIGNUP_ENCOUNTER_TYPES = ['ME', 'SE', 'SPE', 'YE', 'FE'] as const;

/** Roles that must have a password/PIN before using the portal */
export const PRIVILEGED_ROLES_REQUIRING_CREDENTIALS: UserRole[] = [
  UserRole.SUPER_USER,
  UserRole.ADMINISTRATOR,
  UserRole.DCS,
  UserRole.MINISTRY_COORDINATOR,
  UserRole.CLASS_SHEPHERD,
];

export function roleRequiresCredentials(role: UserRole): boolean {
  return PRIVILEGED_ROLES_REQUIRING_CREDENTIALS.includes(role);
}

/**
 * Shown when an admin-created account (added without a mobile) tries to log in
 * or self-activate. Only an SU/ADMIN adding a mobile in Edit unlocks it.
 */
export const ADMIN_ACTIVATION_MESSAGE =
  "Your account was added by an administrator and isn't activated yet. Ask an administrator to add your mobile number, then use Forgot Password to set your password.";

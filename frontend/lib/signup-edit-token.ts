/**
 * The signup response gives the phone that signed up a private edit token. Only that phone
 * can later fix the member's signup details (PUT /auth/signup). Stored per member, never shown.
 */
const KEY_PREFIX = 'bld.signupEditToken.';

export function saveSignupEditToken(memberId: string, token: string | null | undefined): void {
  if (!memberId || !token) return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${memberId}`, token);
  } catch {
    // Private mode / storage blocked: the member can still log in or ask a coordinator.
  }
}

export function getSignupEditToken(memberId: string | null | undefined): string | null {
  if (!memberId) return null;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${memberId}`);
  } catch {
    return null;
  }
}

export const NO_EDIT_TOKEN_MESSAGE =
  'Details can only be changed from the phone used to sign up. Log in and edit your Profile, or ask your coordinator.';

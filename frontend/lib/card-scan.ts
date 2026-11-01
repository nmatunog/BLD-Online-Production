import { memberCardsService } from '@/services/member-cards.service';

/** Same shape the backend accepts: base64url, at least 22 characters. */
const CARD_TOKEN = /^[A-Za-z0-9_-]{22,}$/;

/**
 * Printed ID cards carry a verify link (https://app.bldcebu.com/verify/<token>).
 * Returns the token when the scanned text is one of those links, otherwise null.
 */
export function extractCardToken(scanned: unknown): string | null {
  if (typeof scanned !== 'string') return null;
  const text = scanned.trim();
  let path: string;
  try {
    path = new URL(text).pathname;
  } catch {
    path = text.startsWith('/verify/') ? text.split(/[?#]/)[0] : '';
  }
  const match = /^\/verify\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  let token: string;
  try {
    token = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return CARD_TOKEN.test(token) ? token : null;
}

export type CardScanResult =
  | { kind: 'member'; communityId: string; name: string }
  | { kind: 'revoked'; communityId: string; name: string }
  | { kind: 'not-found' };

/**
 * Turn a scanned card verify link into the member's Community ID using the public verify
 * lookup, so existing check-in and QR login flows keep working with the new printed cards.
 */
export async function resolveCardScan(token: string): Promise<CardScanResult> {
  const response = await memberCardsService.verify(token);
  const result = response.success ? response.data : undefined;
  if (!result || result.status === 'NOT_FOUND' || !result.member) {
    return { kind: 'not-found' };
  }
  const member =
    result.view === 'public'
      ? { communityId: result.member.memberId, name: result.member.fullName }
      : {
          communityId: result.member.communityId,
          name: `${result.member.firstName} ${result.member.lastName}`.trim(),
        };
  if (!member.communityId) return { kind: 'not-found' };
  if (result.status === 'REVOKED') return { kind: 'revoked', ...member };
  return { kind: 'member', ...member };
}

export const REVOKED_CARD_MESSAGE =
  'This ID card has been revoked. Do not check this member in from this card.';
export const UNKNOWN_CARD_MESSAGE = 'This ID card is not on file.';

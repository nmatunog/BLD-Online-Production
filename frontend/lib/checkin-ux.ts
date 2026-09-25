/**
 * Check-in UX helpers (display only).
 * Dates/times use Asia/Manila per Event Standards v1.
 */

export const MANILA_TZ = 'Asia/Manila';

/** Auto-return to search after a successful staff check-in. */
export const CHECKIN_SUCCESS_DISMISS_MS = 3000;

const COMMUNITY_ID_STRICT = /^[A-Z]{3}-[A-Z]{2,4}\d{2,}$/i;
const COMMUNITY_ID_LOOSE = /^[A-Z]{2,3}-[A-Z0-9]+$/i;

export function looksLikeCommunityId(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return COMMUNITY_ID_STRICT.test(q) || COMMUNITY_ID_LOOSE.test(q);
}

export function normalizeCommunityIdQuery(query: string): string {
  return query.trim().toUpperCase().replace(/\s+/g, '');
}

export function isAlreadyCheckedInMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /already checked in/i.test(message);
}

export function memberDisplayName(member: {
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
}): string {
  const last = (member.lastName || '').trim();
  const nick = (member.nickname || '').trim();
  if (nick) return last ? `${nick} ${last}` : nick;
  const first = (member.firstName || '').trim();
  return `${first} ${last}`.trim();
}

export function formatEventDateManila(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      timeZone: MANILA_TZ,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/** Event startTime is a Manila wall-clock "HH:mm" string. */
export function formatEventTimeManila(timeString: string | null | undefined): string {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    if (Number.isNaN(hour)) return timeString;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${(minutes || '00').slice(0, 2)} ${ampm}`;
  } catch {
    return timeString;
  }
}

export function formatEventWhenManila(
  startDate: string,
  startTime?: string | null,
): string {
  const date = formatEventDateManila(startDate);
  const time = formatEventTimeManila(startTime);
  return time ? `${date} · ${time}` : date;
}

export function checkInErrorHint(message: string): string {
  if (isAlreadyCheckedInMessage(message)) {
    return 'This member is already on the list. No need to check in again.';
  }
  if (/not found|invalid community/i.test(message)) {
    return 'Check the Community ID, or search by name instead.';
  }
  if (/please select an event|event not loaded|select an event first/i.test(message)) {
    return 'Choose an event first, then try again.';
  }
  if (/outside check-in window|already ended|not available/i.test(message)) {
    return 'This event is outside the check-in window. Pick today’s event if it is listed.';
  }
  return 'Try again, or search by name if the QR did not work.';
}

export type CheckInResultKind = 'success' | 'already' | 'error';

export interface CheckInResultState {
  kind: CheckInResultKind;
  name?: string;
  communityId?: string;
  message?: string;
  hint?: string;
}

export function resultFromCheckInError(
  message: string,
  name?: string,
  communityId?: string,
): CheckInResultState {
  if (isAlreadyCheckedInMessage(message)) {
    return {
      kind: 'already',
      name,
      communityId,
      message: 'Already checked in',
      hint: checkInErrorHint(message),
    };
  }
  return {
    kind: 'error',
    name,
    communityId,
    message,
    hint: checkInErrorHint(message),
  };
}

export function splitNameQuery(query: string): { firstName?: string; lastName?: string } {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

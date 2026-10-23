import { EventSeriesCode, EventStatus } from '@prisma/client';
import { getManilaDateParts, toManilaDateString } from '../common/utils/manila-date.helper';
import { officialMinistrySortIndex } from '../common/utils/event-series-code.helper';

export const FOLLOW_UP_THRESHOLD_PCT = 50;
export const MAX_WEEKS_PER_MONTH = 5;
export const UNASSIGNED_MINISTRY = 'Unassigned';

export type WeekMark = 'attended' | 'absent' | 'cancelled' | 'n/a';
export type SessionStatus = 'held' | 'cancelled' | 'not_held';

export interface SessionEventInput {
  id: string;
  startDate: Date;
  status: EventStatus | string;
  seriesCode: EventSeriesCode | string;
  ministry?: string | null;
  eventKind?: string | null;
  checkInCount: number;
}

export interface AttendanceWeekSlot {
  week: number;
  date: string;
  eventId: string;
  status: SessionStatus;
}

/**
 * A calendar session is HELD when it exists, is not cancelled, and has at least one check-in.
 * Cancelled sessions are excluded from the % denominator.
 */
export function sessionStatus(event: Pick<SessionEventInput, 'status' | 'checkInCount'>): SessionStatus {
  if (event.status === EventStatus.CANCELLED || event.status === 'CANCELLED') {
    return 'cancelled';
  }
  return event.checkInCount > 0 ? 'held' : 'not_held';
}

export function isSessionHeld(event: Pick<SessionEventInput, 'status' | 'checkInCount'>): boolean {
  return sessionStatus(event) === 'held';
}

/** Round half-up to a whole percent. Null when the denominator is 0 (n/a). */
export function attendancePct(attended: number, held: number): number | null {
  if (held <= 0) return null;
  return Math.round((attended / held) * 100);
}

export function averagePct(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

export function needsFollowUp(cwPct: number | null, wscPct: number | null): boolean {
  return (cwPct != null && cwPct < FOLLOW_UP_THRESHOLD_PCT) ||
    (wscPct != null && wscPct < FOLLOW_UP_THRESHOLD_PCT);
}

export function formatMemberReportName(member: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}): string {
  const middle = member.middleName?.trim();
  const initial = middle ? ` ${middle.charAt(0).toUpperCase()}.` : '';
  return `${member.lastName}, ${member.firstName}${initial}`;
}

export function isReportableOccurrence(event: Pick<SessionEventInput, 'eventKind'>): boolean {
  return event.eventKind !== 'SERIES';
}

export function isCwEvent(event: Pick<SessionEventInput, 'seriesCode'>): boolean {
  return event.seriesCode === EventSeriesCode.CW || event.seriesCode === 'CW';
}

export function isWscEvent(event: Pick<SessionEventInput, 'seriesCode'>): boolean {
  return event.seriesCode === EventSeriesCode.WSC || event.seriesCode === 'WSC';
}

/**
 * WSC events for a member's ministry. If that ministry has no dedicated WSC,
 * fall back to general WSC events (ministry null).
 */
export function wscEventsForMinistry(
  events: SessionEventInput[],
  ministry: string | null,
): SessionEventInput[] {
  const wsc = events.filter((e) => isWscEvent(e) && isReportableOccurrence(e));
  if (!ministry) {
    return wsc.filter((e) => !e.ministry);
  }
  const dedicated = wsc.filter((e) => e.ministry === ministry);
  if (dedicated.length > 0) return dedicated;
  return wsc.filter((e) => !e.ministry);
}

export function sortSessionsByManilaDate(events: SessionEventInput[]): SessionEventInput[] {
  return [...events].sort((a, b) => {
    const da = toManilaDateString(a.startDate);
    const db = toManilaDateString(b.startDate);
    if (da !== db) return da.localeCompare(db);
    return a.startDate.getTime() - b.startDate.getTime();
  });
}

/**
 * Week k is the k-th CW/WSC calendar session in the Manila month (max 5),
 * including cancelled sessions so they can render as grey dots.
 */
export function mapMonthWeekSlots(events: SessionEventInput[]): AttendanceWeekSlot[] {
  return sortSessionsByManilaDate(events)
    .slice(0, MAX_WEEKS_PER_MONTH)
    .map((event, index) => ({
      week: index + 1,
      date: toManilaDateString(event.startDate),
      eventId: event.id,
      status: sessionStatus(event),
    }));
}

export function weekMarkForMember(
  slot: AttendanceWeekSlot,
  attendedEventIds: Set<string>,
): WeekMark {
  if (slot.status === 'cancelled') return 'cancelled';
  if (slot.status === 'not_held') return 'n/a';
  return attendedEventIds.has(slot.eventId) ? 'attended' : 'absent';
}

export function countAttendedHeld(
  slots: AttendanceWeekSlot[],
  attendedEventIds: Set<string>,
): { attended: number; held: number; pct: number | null; weeks: WeekMark[] } {
  const weeks = slots.map((slot) => weekMarkForMember(slot, attendedEventIds));
  const held = slots.filter((s) => s.status === 'held').length;
  const attended = slots.filter(
    (s) => s.status === 'held' && attendedEventIds.has(s.eventId),
  ).length;
  return { attended, held, pct: attendancePct(attended, held), weeks };
}

export function countAttendedHeldFromEvents(
  events: SessionEventInput[],
  attendedEventIds: Set<string>,
): { attended: number; held: number; pct: number | null } {
  const heldEvents = events.filter((e) => isSessionHeld(e));
  const held = heldEvents.length;
  const attended = heldEvents.filter((e) => attendedEventIds.has(e.id)).length;
  return { attended, held, pct: attendancePct(attended, held) };
}

export function eventsInManilaMonth(
  events: SessionEventInput[],
  year: number,
  month: number,
): SessionEventInput[] {
  return events.filter((e) => {
    const parts = getManilaDateParts(e.startDate);
    return parts.year === year && parts.month === month;
  });
}

export function compareMinistries(a: string, b: string): number {
  if (a === UNASSIGNED_MINISTRY && b !== UNASSIGNED_MINISTRY) return 1;
  if (b === UNASSIGNED_MINISTRY && a !== UNASSIGNED_MINISTRY) return -1;
  const ai = officialMinistrySortIndex(a);
  const bi = officialMinistrySortIndex(b);
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
}

export const REPORT_ADMIN_ROLES = [
  'SUPER_USER',
  'ADMINISTRATOR',
  'DCS',
  'MINISTRY_COORDINATOR',
] as const;

export function isAttendanceMonitoringAdmin(role?: string | null): boolean {
  return !!role && (REPORT_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Admins see all ministries. Ministry coordinators are scoped to their ministry.
 */
export function resolveAttendanceMonitoringMinistry(
  user: { role?: string | null; ministry?: string | null },
  requestedMinistry?: string | null,
): { ministry: string | null; forbidden: boolean } {
  if (!isAttendanceMonitoringAdmin(user.role)) {
    return { ministry: null, forbidden: true };
  }
  if (user.role === 'MINISTRY_COORDINATOR') {
    const ministry = user.ministry?.trim() || null;
    // Fail closed: a coordinator without a ministry must not see all ministries.
    if (!ministry) {
      return { ministry: null, forbidden: true };
    }
    return { ministry, forbidden: false };
  }
  const trimmed = requestedMinistry?.trim();
  return { ministry: trimmed || null, forbidden: false };
}

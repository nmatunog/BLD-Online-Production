import { EventSeriesCode, EventStatus } from '@prisma/client';
import {
  formatManilaLongDate,
  getManilaDateParts,
  lastManilaDateOfMonth,
  manilaTodayDateString,
  toManilaDateString,
} from '../common/utils/manila-date.helper';
import { officialMinistrySortIndex } from '../common/utils/event-series-code.helper';

export const FOLLOW_UP_THRESHOLD_PCT = 50;
export const MAX_WEEKS_PER_MONTH = 5;
export const UNASSIGNED_MINISTRY = 'Unassigned';

export type WeekMark = 'attended' | 'absent' | 'cancelled' | 'n/a' | 'not_yet_member';
export type SessionStatus = 'held' | 'cancelled' | 'not_held';

export interface MinistryRange {
  ministry: string;
  startDate: string;
  endDate: string | null;
}

export interface MemberEligibility {
  communityStart: string;
  ranges: MinistryRange[];
}

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

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Community-level start for CW: admin date, else earliest check-in (Manila day),
 * else member createdAt. Imported Attendance rows count via checkInTime.
 */
export function resolveCommunityStartDate(input: {
  attendanceStartDate?: Date | string | null;
  earliestCheckIn?: Date | string | null;
  createdAt: Date | string;
}): string {
  if (input.attendanceStartDate) {
    return toManilaDateString(asDate(input.attendanceStartDate));
  }
  if (input.earliestCheckIn) {
    return toManilaDateString(asDate(input.earliestCheckIn));
  }
  return toManilaDateString(asDate(input.createdAt));
}

export function resolveMinistryRanges(input: {
  currentMinistry: string | null;
  history: Array<{ ministry: string; startDate: Date | string; endDate: Date | string | null }>;
  communityStart: string;
}): MinistryRange[] {
  if (input.history.length > 0) {
    return [...input.history]
      .map((row) => ({
        ministry: row.ministry,
        startDate: toManilaDateString(asDate(row.startDate)),
        endDate: row.endDate ? toManilaDateString(asDate(row.endDate)) : null,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  const ministry = input.currentMinistry?.trim();
  if (!ministry) return [];
  return [{ ministry, startDate: input.communityStart, endDate: null }];
}

export function ministryOnDate(ranges: MinistryRange[], date: string): string | null {
  for (const range of ranges) {
    if (range.startDate <= date && (range.endDate == null || range.endDate >= date)) {
      return range.ministry;
    }
  }
  return null;
}

/** Ministry the member belonged to on the last Manila day of the report period. */
export function ministryAtPeriodEnd(
  ranges: MinistryRange[],
  periodEnd: string,
  fallbackMinistry?: string | null,
): string {
  return ministryOnDate(ranges, periodEnd) || fallbackMinistry?.trim() || UNASSIGNED_MINISTRY;
}

export function reportPeriodDateBounds(
  year: number,
  month: number | null,
  now: Date = new Date(),
): { start: string; end: string } {
  const today = manilaTodayDateString(now);
  const todayParts = getManilaDateParts(now);
  if (month) {
    return {
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: lastManilaDateOfMonth(year, month),
    };
  }
  return {
    start: `${year}-01-01`,
    end: todayParts.year === year ? today : `${year}-12-31`,
  };
}

export function memberMinistryNote(
  ranges: MinistryRange[],
  displayMinistry: string,
  periodStart: string,
): { joinedMinistryOn: string | null; ministryNote: string | null } {
  const forMinistry = ranges
    .filter((range) => range.ministry === displayMinistry)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (forMinistry.length === 0) {
    return { joinedMinistryOn: null, ministryNote: null };
  }
  const latest = forMinistry.find((range) => range.endDate == null) ?? forMinistry[forMinistry.length - 1];
  const transferredIn = ranges.some(
    (range) => range.ministry !== displayMinistry && range.startDate < latest.startDate,
  );
  if (transferredIn || latest.startDate >= periodStart) {
    return {
      joinedMinistryOn: latest.startDate,
      ministryNote: `Joined ${displayMinistry} on ${formatManilaLongDate(latest.startDate)}`,
    };
  }
  return { joinedMinistryOn: null, ministryNote: null };
}

export function isMemberEligibleForWscEvent(
  event: SessionEventInput,
  ranges: MinistryRange[],
  allWscEvents: SessionEventInput[],
): boolean {
  const date = toManilaDateString(event.startDate);
  const memberMinistry = ministryOnDate(ranges, date);
  if (!memberMinistry) return false;
  return wscEventsForMinistry(allWscEvents, memberMinistry).some((item) => item.id === event.id);
}

export function weekMarkForMember(
  slot: AttendanceWeekSlot,
  attendedEventIds: Set<string>,
  options?: { communityStart?: string | null },
): WeekMark {
  if (options?.communityStart && slot.date < options.communityStart) {
    return 'not_yet_member';
  }
  if (slot.status === 'cancelled') return 'cancelled';
  if (slot.status === 'not_held') return 'n/a';
  return attendedEventIds.has(slot.eventId) ? 'attended' : 'absent';
}

export function countAttendedHeld(
  slots: AttendanceWeekSlot[],
  attendedEventIds: Set<string>,
  options?: { communityStart?: string | null },
): { attended: number; held: number; pct: number | null; weeks: WeekMark[] } {
  const weeks = slots.map((slot) => weekMarkForMember(slot, attendedEventIds, options));
  const eligibleHeld = slots.filter((slot) => {
    if (slot.status !== 'held') return false;
    if (options?.communityStart && slot.date < options.communityStart) return false;
    return true;
  });
  const held = eligibleHeld.length;
  const attended = eligibleHeld.filter((slot) => attendedEventIds.has(slot.eventId)).length;
  return { attended, held, pct: attendancePct(attended, held), weeks };
}

/**
 * WSC week dots follow the current ministry calendar. Weeks the member spent
 * in a previous ministry show as normal attended/absent against that ministry's
 * same week-number session, with weekMinistries set for a tooltip.
 * Percent uses held WSC of the ministry they belonged to on each session date.
 */
export function countWscWithCarryover(
  displaySlots: AttendanceWeekSlot[],
  slotsByMinistry: Record<string, AttendanceWeekSlot[]>,
  attendedEventIds: Set<string>,
  ranges: MinistryRange[],
  displayMinistry: string,
  communityStart: string,
  periodWscEvents: SessionEventInput[],
): {
  attended: number;
  held: number;
  pct: number | null;
  weeks: WeekMark[];
  weekMinistries: Array<string | null>;
} {
  const weeks: WeekMark[] = [];
  const weekMinistries: Array<string | null> = [];
  for (const slot of displaySlots) {
    if (communityStart && slot.date < communityStart) {
      weeks.push('not_yet_member');
      weekMinistries.push(null);
      continue;
    }
    const memberMinistry = ministryOnDate(ranges, slot.date);
    if (memberMinistry && memberMinistry !== displayMinistry) {
      const prior = (slotsByMinistry[memberMinistry] ?? []).find((item) => item.week === slot.week);
      if (prior) {
        weeks.push(weekMarkForMember(prior, attendedEventIds));
        weekMinistries.push(memberMinistry);
        continue;
      }
    }
    weeks.push(weekMarkForMember(slot, attendedEventIds, { communityStart }));
    weekMinistries.push(null);
  }
  const stats = countYtdWscAcrossMinistries(
    periodWscEvents,
    attendedEventIds,
    ranges,
    communityStart,
  );
  return { ...stats, weeks, weekMinistries };
}

export function countAttendedHeldFromEvents(
  events: SessionEventInput[],
  attendedEventIds: Set<string>,
  options?: { communityStart?: string | null },
): { attended: number; held: number; pct: number | null } {
  const heldEvents = events.filter((event) => {
    if (!isSessionHeld(event)) return false;
    if (options?.communityStart && toManilaDateString(event.startDate) < options.communityStart) {
      return false;
    }
    return true;
  });
  const held = heldEvents.length;
  const attended = heldEvents.filter((event) => attendedEventIds.has(event.id)).length;
  return { attended, held, pct: attendancePct(attended, held) };
}

export function countYtdWscAcrossMinistries(
  wscEvents: SessionEventInput[],
  attendedEventIds: Set<string>,
  ranges: MinistryRange[],
  communityStart?: string | null,
): { attended: number; held: number; pct: number | null } {
  const heldEvents = wscEvents.filter((event) => {
    if (!isSessionHeld(event)) return false;
    if (communityStart && toManilaDateString(event.startDate) < communityStart) return false;
    return isMemberEligibleForWscEvent(event, ranges, wscEvents);
  });
  const held = heldEvents.length;
  const attended = heldEvents.filter((event) => attendedEventIds.has(event.id)).length;
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

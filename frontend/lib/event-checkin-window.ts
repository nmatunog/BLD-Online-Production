/**
 * Check-in window: 2 hours before event start → 2 hours after event end.
 * Used to determine "ongoing" for ordering and whether a member can check in.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_7_DAYS = 7 * 24 * MS_PER_HOUR;
const MANILA_UTC_OFFSET_HOURS = 8;

export interface EventWithDates {
  id: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isRecurring?: boolean;
  category?: string | null;
}

function parseTime(dateStr: string, timeStr: string | null | undefined): Date {
  const d = new Date(dateStr);
  if (!timeStr) return d;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Parse date+time as Asia/Manila (UTC+8) and return a Date (UTC timestamp). Matches backend logic. */
function parseTimeManila(dateStr: string, timeStr: string | null | undefined): Date {
  const datePart = dateStr.slice(0, 10);
  const [y, m, day] = datePart.split('-').map(Number);
  const mon = (m ?? 1) - 1;
  let hours = 0;
  let minutes = 0;
  if (timeStr) {
    const parts = timeStr.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  }
  return new Date(Date.UTC(y ?? 0, mon, day ?? 1, hours - MANILA_UTC_OFFSET_HOURS, minutes, 0));
}

/** Check-in window starts 2 hours before event start */
export function getEventWindowStart(event: EventWithDates): Date {
  const start = parseTime(event.startDate, event.startTime);
  return new Date(start.getTime() - 2 * MS_PER_HOUR);
}

/** Check-in window ends 2 hours after event end */
export function getEventWindowEnd(event: EventWithDates): Date {
  const end = parseTime(event.endDate, event.endTime ?? event.startTime);
  return new Date(end.getTime() + 2 * MS_PER_HOUR);
}

/** Event end (date+time only, no buffer). Use for "Ongoing" vs "Completed" display. */
export function getEventEnd(event: EventWithDates): Date {
  return parseTime(event.endDate, event.endTime ?? event.startTime);
}

/**
 * End of this occurrence for display. Recurring events use startDate (Manila) so we never
 * rely on endDate; "Ongoing" / "Completed" stay correct even if endDate was wrong or stale.
 */
function getDisplayEventEnd(event: EventWithDates): Date {
  if (event.isRecurring) {
    return parseTimeManila(event.startDate, event.endTime ?? event.startTime);
  }
  return getEventEnd(event);
}

/** Window end for display/grouping. Recurring: occurrence end + 2h so section/badge match dates. */
function getDisplayEventWindowEnd(event: EventWithDates): Date {
  if (event.isRecurring) {
    return new Date(getDisplayEventEnd(event).getTime() + 2 * MS_PER_HOUR);
  }
  return getEventWindowEnd(event);
}

/** True if event should be displayed as "Ongoing" (within check-in window but not past event end). Uses Manila time for recurring so label matches backend. */
export function isOngoingForDisplay(event: EventWithDates, now: Date = new Date()): boolean {
  const windowStart = event.isRecurring
    ? new Date(parseTimeManila(event.startDate, event.startTime).getTime() - 2 * MS_PER_HOUR)
    : getEventWindowStart(event);
  const eventEnd = getDisplayEventEnd(event);
  return now >= windowStart && now <= eventEnd;
}

/** True if now is within the check-in window [start-2h, end+2h] */
export function isInCheckInWindow(event: EventWithDates, now: Date = new Date()): boolean {
  const start = getEventWindowStart(event);
  const end = getEventWindowEnd(event);
  return now >= start && now <= end;
}

/** True if we're past the check-in window (event "finished" for check-in). Recurring uses occurrence window end so grouping is correct. */
export function isCompletedPastWindow(event: EventWithDates, now: Date = new Date()): boolean {
  return now > getDisplayEventWindowEnd(event);
}

/** True if event's check-in window ended within the last 7 days */
export function isWithin7DaysOfEnd(event: EventWithDates, now: Date = new Date()): boolean {
  const windowEnd = getDisplayEventWindowEnd(event);
  if (now <= windowEnd) return true;
  return now.getTime() - windowEnd.getTime() <= MS_7_DAYS;
}

/**
 * Non-recurring: can check in only while in window.
 * Recurring: can check in while in window OR within 7 days after window end.
 */
export function canCheckInToEvent(event: EventWithDates, now: Date = new Date()): boolean {
  if (isInCheckInWindow(event, now)) return true;
  if (!event.isRecurring) return false;
  return isCompletedPastWindow(event, now) && isWithin7DaysOfEnd(event, now);
}

/** Sort: in check-in window first (ongoing), then by window end desc (recent completed first) */
export function sortEventsForCheckIn<T extends EventWithDates>(events: T[], now: Date = new Date()): T[] {
  return [...events].sort((a, b) => {
    const aIn = isInCheckInWindow(a, now);
    const bIn = isInCheckInWindow(b, now);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    const aEnd = getEventWindowEnd(a).getTime();
    const bEnd = getEventWindowEnd(b).getTime();
    return bEnd - aEnd; // recent first when both same type
  });
}

/**
 * Window start time using Manila time for consistent sort order across timezones.
 */
function getWindowStartManila(e: EventWithDates): number {
  const start = parseTimeManila(e.startDate, e.startTime);
  return start.getTime() - 2 * MS_PER_HOUR;
}

/** Tiebreaker: sort by startDate then startTime then id for deterministic order. */
function eventOrderTiebreaker(a: EventWithDates & { id?: string }, b: EventWithDates & { id?: string }): number {
  const aDate = (a.startDate || '').slice(0, 10);
  const bDate = (b.startDate || '').slice(0, 10);
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  const aTime = a.startTime || '';
  const bTime = b.startTime || '';
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Sort so nearest / most relevant events show first for Check-In and Self Check-In:
 * 1) Events in check-in window (happening now / today) first, by start time ascending
 * 2) Upcoming events (window not yet open) by window start ascending (soonest first)
 * 3) Past events (recurring, within 7 days) by window end descending (most recent first)
 * Uses Manila time for ordering so "closest" is consistent; tiebreaker keeps order deterministic.
 */
export function sortEventsNearestFirst<T extends EventWithDates>(events: T[], now: Date = new Date()): T[] {
  const getWindowStart = (e: EventWithDates) => getWindowStartManila(e);
  const getStart = (e: EventWithDates) => parseTimeManila(e.startDate, e.startTime).getTime();
  const getEnd = (e: EventWithDates) => {
    const end = parseTimeManila(e.endDate, e.endTime ?? e.startTime);
    return end.getTime() + 2 * MS_PER_HOUR;
  };
  return [...events].sort((a, b) => {
    const aIn = isInCheckInWindow(a, now);
    const bIn = isInCheckInWindow(b, now);
    const aStart = getWindowStart(a);
    const bStart = getWindowStart(b);
    const aEnd = getEnd(a);
    const bEnd = getEnd(b);
    const nowT = now.getTime();

    const aUpcoming = aStart > nowT;
    const bUpcoming = bStart > nowT;

    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    if (aIn && bIn) {
      const cmp = getStart(a) - getStart(b);
      return cmp !== 0 ? cmp : eventOrderTiebreaker(a, b);
    }
    if (aUpcoming && bUpcoming) {
      const cmp = aStart - bStart;
      return cmp !== 0 ? cmp : eventOrderTiebreaker(a, b);
    }
    if (!aUpcoming && !bUpcoming) {
      const cmp = bEnd - aEnd;
      return cmp !== 0 ? cmp : eventOrderTiebreaker(a, b);
    }
    return aUpcoming ? -1 : 1; // upcoming before past
  });
}

/** Categories allowed in "past events" search (Community Worship, Word Sharing Circle) */
export const PAST_EVENT_CATEGORIES = ['Community Worship', 'Word Sharing Circle'] as const;

export function isPastEventCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const normalized = category === 'Corporate Worship' || category === 'Corporate Worship (Weekly Recurring)'
    ? 'Community Worship'
    : category;
  return PAST_EVENT_CATEGORIES.includes(normalized as (typeof PAST_EVENT_CATEGORIES)[number]);
}

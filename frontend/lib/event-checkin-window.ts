/**
 * Check-in window: 2 hours before event start → 2 hours after event end.
 * Used to determine "ongoing" for ordering and whether a member can check in.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_7_DAYS = 7 * 24 * MS_PER_HOUR;

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
 * End of this occurrence for display. Recurring events use startDate for the occurrence;
 * we never use endDate here so "Ongoing" is correct even if endDate was wrong or stale (e.g. edited later).
 */
function getDisplayEventEnd(event: EventWithDates): Date {
  if (event.isRecurring) {
    return parseTime(event.startDate, event.endTime ?? event.startTime);
  }
  return getEventEnd(event);
}

/** True if event should be displayed as "Ongoing" (within check-in window but not past event end). Stops showing Ongoing once event end time has passed. */
export function isOngoingForDisplay(event: EventWithDates, now: Date = new Date()): boolean {
  const windowStart = getEventWindowStart(event);
  const eventEnd = getDisplayEventEnd(event);
  return now >= windowStart && now <= eventEnd;
}

/** True if now is within the check-in window [start-2h, end+2h] */
export function isInCheckInWindow(event: EventWithDates, now: Date = new Date()): boolean {
  const start = getEventWindowStart(event);
  const end = getEventWindowEnd(event);
  return now >= start && now <= end;
}

/** True if we're past the check-in window (event "finished" for check-in) */
export function isCompletedPastWindow(event: EventWithDates, now: Date = new Date()): boolean {
  return now > getEventWindowEnd(event);
}

/** True if event's check-in window ended within the last 7 days */
export function isWithin7DaysOfEnd(event: EventWithDates, now: Date = new Date()): boolean {
  const windowEnd = getEventWindowEnd(event);
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

/** Categories allowed in "past events" search (Community Worship, Word Sharing Circle) */
export const PAST_EVENT_CATEGORIES = ['Community Worship', 'Word Sharing Circle'] as const;

export function isPastEventCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const normalized = category === 'Corporate Worship' || category === 'Corporate Worship (Weekly Recurring)'
    ? 'Community Worship'
    : category;
  return PAST_EVENT_CATEGORIES.includes(normalized as (typeof PAST_EVENT_CATEGORIES)[number]);
}

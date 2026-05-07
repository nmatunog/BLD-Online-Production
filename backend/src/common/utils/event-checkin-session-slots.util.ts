import type { Event } from '@prisma/client';

const SLOT_RE = /^\d{4}-\d{2}-\d{2}_(AM|PM)$/;

export type CheckInSessionOption = { value: string; label: string };

/** Manila calendar date key (YYYY-MM-DD). */
export function manilaDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function formatSessionLabel(dateKey: string, period: 'AM' | 'PM'): string {
  const d = new Date(`${dateKey}T12:00:00+08:00`);
  const datePart = d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const periodLabel = period === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)';
  return `${datePart} — ${periodLabel}`;
}

/**
 * For multi-day events: each Manila calendar day from startDate through endDate (inclusive)
 * gets AM + PM session slots so attendees can check in once per session.
 */
export function getCheckInSessionSlotsForEvent(
  event: Pick<Event, 'startDate' | 'endDate'>,
): CheckInSessionOption[] {
  const slots: CheckInSessionOption[] = [];
  let cur = new Date(event.startDate);
  const end = new Date(event.endDate);
  const endKey = manilaDateKey(end);

  while (slots.length < 400) {
    const key = manilaDateKey(cur);
    slots.push(
      { value: `${key}_AM`, label: formatSessionLabel(key, 'AM') },
      { value: `${key}_PM`, label: formatSessionLabel(key, 'PM') },
    );
    if (key >= endKey) break;
    cur = addUtcDays(cur, 1);
  }

  return slots;
}

export function isValidSessionSlotFormat(slot: string): boolean {
  return slot === '' || SLOT_RE.test(slot);
}

export function getAllowedSessionSlotSet(
  event: Pick<Event, 'startDate' | 'endDate'>,
): Set<string> {
  return new Set(getCheckInSessionSlotsForEvent(event).map((s) => s.value));
}

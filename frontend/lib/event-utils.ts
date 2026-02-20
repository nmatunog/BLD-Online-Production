/**
 * Shared event classification helpers (encounter types, etc.).
 */

export interface EventLike {
  category?: string | null;
  title?: string | null;
  eventType?: string | null;
}

const ENCOUNTER_CATEGORIES = [
  'Marriage Encounter',
  'Singles Encounter',
  'Solo Parents Encounter',
  'Family Encounter',
  'Youth Encounter',
] as const;

const ENCOUNTER_TYPE_CODES = ['ME', 'SE', 'SPE', 'FE', 'YE', 'ENCOUNTER'];

export function isEncounterEvent(event: EventLike | null | undefined): boolean {
  if (!event) return false;
  const category = event.category ?? '';
  const eventType = (event.eventType ?? '').toUpperCase();
  const title = (event.title ?? '').toLowerCase();
  return (
    ENCOUNTER_CATEGORIES.includes(category as (typeof ENCOUNTER_CATEGORIES)[number]) ||
    ENCOUNTER_TYPE_CODES.includes(eventType) ||
    title.includes('encounter')
  );
}

export function isMarriageEncounter(event: EventLike | null | undefined): boolean {
  if (!event) return false;
  const category = event.category ?? '';
  const title = (event.title ?? '').toLowerCase();
  const eventType = (event.eventType ?? '').toUpperCase();
  return (
    category === 'Marriage Encounter' ||
    title.includes('marriage encounter') ||
    eventType === 'ME'
  );
}

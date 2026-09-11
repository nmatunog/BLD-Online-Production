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

/**
 * Determines if an event is eligible for Candidate Quick Check-In.
 * Shows banner for encounter-like events (encounters, LSS, seminars, retreats).
 * Hides banner for Community Worship (CW) and Word Sharing Circle (WSC).
 */
export function isCandidateCheckInEvent(event: EventLike | null | undefined): boolean {
  if (!event) return false;

  const category = (event.category ?? '').toLowerCase();
  const title = (event.title ?? '').toLowerCase();

  // Hide for Community Worship (CW)
  if (
    category.includes('community worship') ||
    category.includes('cw') ||
    title.includes('community worship') ||
    /\bcw\b/.test(title)
  ) {
    return false;
  }

  // Hide for Word Sharing Circle (WSC)
  if (
    category.includes('word sharing circle') ||
    category.includes('wsc') ||
    title.includes('word sharing circle') ||
    title.startsWith('wsc -') ||
    /\bwsc\b/.test(title)
  ) {
    return false;
  }

  // Show for encounters (ME, SE, SPE, YE, FE/Family Enrichment)
  if (isEncounterEvent(event)) {
    return true;
  }

  // Show for LSS (Life in the Spirit Seminar, LSS Weekend, LSS Shepherding)
  if (
    category.includes('life in the spirit') ||
    category.includes('lss') ||
    title.includes('life in the spirit') ||
    title.includes('lss weekend') ||
    title.includes('lss shepherding') ||
    /\blss\b/.test(title)
  ) {
    return true;
  }

  // Show for seminars and retreats
  if (
    category.includes('seminar') ||
    category.includes('retreat') ||
    title.includes('seminar') ||
    title.includes('retreat') ||
    title.includes('growth seminar')
  ) {
    return true;
  }

  // Default: hide for all other events
  return false;
}

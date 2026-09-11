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
 * Shows banner for encounter-like events (encounters, LSS Weekend, seminars, retreats).
 * Hides banner for Community Worship (CW), Word Sharing Circle (WSC), and LSS Shepherding.
 */
export function isCandidateCheckInEvent(event: EventLike | null | undefined): boolean {
  if (!event) return false;

  const category = (event.category ?? '').trim().toLowerCase();
  const title = (event.title ?? '').trim().toLowerCase();

  // Hide for Community Worship (CW) - exact category or word-boundary title match
  if (
    category === 'community worship' ||
    title.includes('community worship') ||
    /\bcw\b/i.test(title)
  ) {
    return false;
  }

  // Hide for Word Sharing Circle (WSC) - exact category or word-boundary title match
  if (
    category === 'word sharing circle' ||
    title.includes('word sharing circle') ||
    title.startsWith('wsc -') ||
    /\bwsc\b/i.test(title)
  ) {
    return false;
  }

  // Hide for LSS Shepherding - not for first-time candidates
  if (
    title.includes('lss shepherding') ||
    title.includes('shepherding session') ||
    (category.includes('shepherding') && /\blss\b/i.test(title))
  ) {
    return false;
  }

  // Show for encounters (ME, SE, SPE, YE, FE/Family Enrichment)
  if (isEncounterEvent(event)) {
    return true;
  }

  // Show for LSS Weekend / Life in the Spirit Seminar Weekend
  if (
    category === 'life in the spirit seminar weekend' ||
    title.includes('life in the spirit seminar weekend') ||
    title.includes('lss weekend') ||
    /\blss weekend\b/i.test(title)
  ) {
    return true;
  }

  // Show for seminars and retreats (Growth Seminar, etc.)
  if (
    /\bseminar\b/i.test(category) ||
    /\bretreat\b/i.test(category) ||
    title.includes('growth seminar') ||
    /\bseminar\b/i.test(title) ||
    /\bretreat\b/i.test(title)
  ) {
    return true;
  }

  // Default: hide for all other events
  return false;
}

import { EventSeriesCode } from '@prisma/client';
import { MINISTRIES_BY_APOSTOLATE } from '../constants/organization.constants';

export const OFFICIAL_MINISTRIES: string[] = Object.values(MINISTRIES_BY_APOSTOLATE).flat();

const OFFICIAL_MINISTRIES_LONGEST_FIRST = [...OFFICIAL_MINISTRIES].sort(
  (a, b) => b.length - a.length,
);

export function inferSeriesCode(input: {
  category?: string | null;
  title?: string | null;
  eventType?: string | null;
}): EventSeriesCode {
  const blob = `${input.category || ''} ${input.title || ''} ${input.eventType || ''}`
    .toLowerCase()
    .replace(/_/g, ' ');

  if (
    blob.includes('community worship') ||
    blob.includes('corporate worship') ||
    /(^|[^a-z])cw([^a-z]|$)/.test(blob)
  ) {
    return EventSeriesCode.CW;
  }

  if (
    blob.includes('word sharing') ||
    /(^|[^a-z])wsc([^a-z]|$)/.test(blob)
  ) {
    return EventSeriesCode.WSC;
  }

  return EventSeriesCode.OTHER;
}

/**
 * Longest official ministry name that appears in the event title.
 * Used only for backfill / inference — live WSC matching uses Event.ministry.
 */
export function inferMinistryFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const ministry of OFFICIAL_MINISTRIES_LONGEST_FIRST) {
    if (lower.includes(ministry.toLowerCase())) {
      return ministry;
    }
  }
  return null;
}

export function officialMinistrySortIndex(ministry: string): number {
  const idx = OFFICIAL_MINISTRIES.indexOf(ministry);
  return idx === -1 ? 999 : idx;
}

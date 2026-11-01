import {
  MINISTRIES_BY_APOSTOLATE,
  normalizeApostolate,
} from '../common/constants/organization.constants';
import {
  NO_MINISTRY_ASSIGNED,
  resolveDisplayMinistry,
  type MinistrySourceMember,
} from './member-card-ministry';

/** Ministry filter value for members with no current ministry. */
export const NO_MINISTRY_FILTER = '__NONE__';

export type OrgFilter = {
  apostolate?: string | null;
  ministry?: string | null;
};

export type OrgFilterMember = MinistrySourceMember & { apostolate?: string | null };

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The apostolate a ministry belongs to (ministry names are unique across apostolates). */
export function apostolateForMinistry(ministry: string | null | undefined): string | null {
  if (!ministry?.trim()) return null;
  for (const [apostolate, ministries] of Object.entries(MINISTRIES_BY_APOSTOLATE)) {
    if (ministries.some((name) => sameName(name, ministry))) return apostolate;
  }
  return null;
}

/**
 * The member's current apostolate: taken from their current ministry (so a ministry
 * transfer moves them), falling back to Member.apostolate.
 */
export function resolveCurrentApostolate(member: OrgFilterMember): string | null {
  const ministry = resolveDisplayMinistry(member);
  if (ministry !== NO_MINISTRY_ASSIGNED) {
    const fromMinistry = apostolateForMinistry(ministry);
    if (fromMinistry) return fromMinistry;
  }
  return normalizeApostolate(member.apostolate) ?? (member.apostolate?.trim() || null);
}

export function matchesOrgFilter(member: OrgFilterMember, filter: OrgFilter | undefined): boolean {
  const apostolate = filter?.apostolate?.trim();
  const ministry = filter?.ministry?.trim();

  if (apostolate && !sameName(resolveCurrentApostolate(member), apostolate)) {
    return false;
  }
  if (ministry) {
    const current = resolveDisplayMinistry(member);
    if (ministry === NO_MINISTRY_FILTER) return current === NO_MINISTRY_ASSIGNED;
    if (!sameName(current, ministry)) return false;
  }
  return true;
}

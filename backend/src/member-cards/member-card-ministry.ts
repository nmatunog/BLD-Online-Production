/** Read-time ministry display. Never writes to the database. */
export const NO_MINISTRY_ASSIGNED = 'No ministry assigned';

export type MinistrySourceMember = {
  ministry?: string | null;
  ministryHistory?: Array<{
    ministry?: string | null;
    endDate?: Date | string | null;
    startDate?: Date | string | null;
  }>;
  user?: { ministry?: string | null } | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function latestOpenHistoryMinistry(
  history: MinistrySourceMember['ministryHistory'],
): string | null {
  const open = (history ?? []).filter((row) => row.endDate == null);
  if (open.length === 0) return null;
  const latest = [...open].sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return bTime - aTime;
  })[0];
  return firstNonEmpty(latest?.ministry);
}

/**
 * Current ministry, in this order:
 * 1. MemberMinistryHistory row with endDate null (latest startDate if several)
 * 2. Member.ministry
 * 3. user.ministry
 * 4. "No ministry assigned"
 */
export function resolveDisplayMinistry(member: MinistrySourceMember): string {
  return (
    firstNonEmpty(
      latestOpenHistoryMinistry(member.ministryHistory),
      member.ministry,
      member.user?.ministry,
    ) ?? NO_MINISTRY_ASSIGNED
  );
}

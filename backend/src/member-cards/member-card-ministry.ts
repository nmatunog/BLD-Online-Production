/** Read-time ministry display. Never writes to the database. */
export type MinistrySourceMember = {
  ministry?: string | null;
  ministryHistory?: Array<{ ministry?: string | null; endDate?: Date | string | null }>;
  user?: { ministry?: string | null } | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function resolveDisplayMinistry(member: MinistrySourceMember): string | null {
  const currentHistory = member.ministryHistory?.find((row) => row.endDate == null);
  return firstNonEmpty(member.ministry, currentHistory?.ministry, member.user?.ministry);
}

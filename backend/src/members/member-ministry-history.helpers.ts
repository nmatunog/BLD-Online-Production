import { dayBeforeDateString } from '../common/utils/manila-date.helper';

export interface HistoryRow {
  id: string;
  ministry: string;
  startDate: string;
  endDate: string | null;
}

export interface HistoryCreate {
  ministry: string;
  startDate: string;
  endDate: string | null;
}

export interface HistoryUpdate {
  id: string;
  startDate?: string;
  endDate?: string | null;
  ministry?: string;
}

export interface HistorySyncPlan {
  create: HistoryCreate[];
  update: HistoryUpdate[];
}

function isNonEmptyRange(startDate: string, endDate: string | null): boolean {
  if (endDate == null) return true;
  return startDate <= endDate;
}

/**
 * Plan ministry-history writes for a member update.
 * Dates are Manila YYYY-MM-DD. endDate is inclusive.
 */
export function planMinistryHistorySync(input: {
  existing: HistoryRow[];
  previousMinistry: string | null;
  nextMinistry: string | null;
  requestedStart?: string | null;
  communityStart: string;
  today: string;
}): HistorySyncPlan {
  const nextMinistry = input.nextMinistry?.trim() || null;
  const previousMinistry = input.previousMinistry?.trim() || null;
  const ministryChanged = previousMinistry !== nextMinistry;
  const start = input.requestedStart || input.today;
  const existing = [...input.existing].sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (!ministryChanged && !input.requestedStart) {
    return { create: [], update: [] };
  }

  if (!ministryChanged) {
    if (!nextMinistry) {
      return { create: [], update: [] };
    }
    if (existing.length === 0) {
      return {
        create: [{ ministry: nextMinistry, startDate: start, endDate: null }],
        update: [],
      };
    }
    const current = existing.find((row) => row.endDate == null) ?? existing[existing.length - 1];
    const update: HistoryUpdate[] = [{ id: current.id, startDate: start }];
    const previous = [...existing]
      .filter((row) => row.id !== current.id && row.startDate < (current.startDate || start))
      .pop();
    if (previous) {
      const closedEnd = dayBeforeDateString(start);
      update.push({
        id: previous.id,
        endDate: closedEnd < previous.startDate ? previous.startDate : closedEnd,
      });
    }
    return { create: [], update };
  }

  if (existing.length === 0) {
    const create: HistoryCreate[] = [];
    if (previousMinistry) {
      const closedEnd = dayBeforeDateString(start);
      if (isNonEmptyRange(input.communityStart, closedEnd)) {
        create.push({
          ministry: previousMinistry,
          startDate: input.communityStart,
          endDate: closedEnd,
        });
      }
    }
    if (nextMinistry) {
      create.push({ ministry: nextMinistry, startDate: start, endDate: null });
    }
    return { create, update: [] };
  }

  const current = existing.find((row) => row.endDate == null);
  const update: HistoryUpdate[] = [];
  if (current) {
    if (start <= current.startDate) {
      return {
        create: [],
        update: [{ id: current.id, ministry: nextMinistry ?? current.ministry, startDate: start }],
      };
    }
    const closedEnd = dayBeforeDateString(start);
    update.push({
      id: current.id,
      endDate: closedEnd < current.startDate ? current.startDate : closedEnd,
    });
  }
  const create: HistoryCreate[] = [];
  if (nextMinistry) {
    create.push({ ministry: nextMinistry, startDate: start, endDate: null });
  }
  return { create, update };
}

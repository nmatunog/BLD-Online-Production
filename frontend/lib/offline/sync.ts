import { registrationsService } from '@/services/registrations.service';
import {
  deletePendingCheckin,
  listPendingCheckins,
  recordSyncedCheckin,
  updatePendingCheckin,
} from './db';
import type { PendingCheckin } from './types';

/**
 * Result of a single drain pass — used by the UI to render toasts and update counts.
 */
export interface DrainSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ localId: string; error: string }>;
}

const MAX_ATTEMPTS = 8;

/**
 * Attempt to upload all pending check-ins. Items that fail get their attempt counter
 * incremented; the backend's idempotent (memberId, eventId, sessionSlot) key means
 * replays are safe. Items that succeed move to the syncedCheckins store so the UI
 * can keep showing their ✓ chips after a reload.
 *
 * If `eventId` is supplied, only that event's queue is drained (so a Sync Now button
 * for the active event doesn't try to flush other events the user previously cached).
 */
export async function drainPendingCheckins(eventId?: string): Promise<DrainSummary> {
  const summary: DrainSummary = { attempted: 0, succeeded: 0, failed: 0, errors: [] };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return summary; // Skip silently when offline; the auto-driver will retry.
  }

  let pending: PendingCheckin[];
  try {
    pending = await listPendingCheckins(eventId);
  } catch {
    return summary;
  }

  for (const item of pending) {
    summary.attempted += 1;
    try {
      const res = await registrationsService.quickRegisterAndCheckInCandidate(
        item.eventId,
        item.candidateId,
        item.payload,
      );
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Unknown server error');
      }
      const synced: PendingCheckin = {
        ...item,
        succeeded: true,
        succeededAt: Date.now(),
        lastError: undefined,
        resultCommunityId: res.data.communityId,
        resultGeneratedCommunityId: res.data.generatedCommunityId,
        resultAlreadyAttended: res.data.alreadyAttended,
        resultUserCreated: res.data.userCreated,
        resultTempPassword: res.data.tempPassword,
        resultEncounterType: res.data.encounterType,
        resultClassNumber: res.data.classNumber,
      };
      await recordSyncedCheckin(synced);
      await deletePendingCheckin(item.localId);
      summary.succeeded += 1;
    } catch (err) {
      summary.failed += 1;
      const message =
        err instanceof Error ? err.message : 'Network or server error during sync.';
      summary.errors.push({ localId: item.localId, error: message });
      try {
        await updatePendingCheckin({
          ...item,
          attemptCount: (item.attemptCount || 0) + 1,
          lastAttemptAt: Date.now(),
          lastError: message,
        });
      } catch {
        // best-effort persist; ignore failure
      }
      // After many failed attempts we still keep the row so the user can see/export it.
      // The MAX_ATTEMPTS check is informational only.
      if ((item.attemptCount || 0) + 1 >= MAX_ATTEMPTS) {
        // No-op intentionally — the user must resolve manually (e.g., via export CSV).
      }
    }
  }

  return summary;
}

/**
 * Build a CSV string of pending check-ins for an emergency manual upload path.
 */
export function pendingCheckinsToCsv(items: PendingCheckin[]): string {
  const header = [
    'localId',
    'eventId',
    'candidateId',
    'sessionSlot',
    'familyName',
    'firstName',
    'candidateClass',
    'mobileNumber',
    'encounterType',
    'classNumber',
    'queuedAt',
    'attemptCount',
    'lastError',
  ].join(',');

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const rows = items.map((it) =>
    [
      it.localId,
      it.eventId,
      it.candidateId,
      it.sessionSlot,
      it.candidateSnapshot.familyName,
      it.candidateSnapshot.firstName,
      it.candidateSnapshot.candidateClass,
      it.candidateSnapshot.cleanMobile || it.candidateSnapshot.mobileNumber || '',
      it.payload.encounterType || '',
      it.payload.classNumber ?? '',
      new Date(it.queuedAt).toISOString(),
      it.attemptCount || 0,
      it.lastError || '',
    ]
      .map(escape)
      .join(','),
  );

  return [header, ...rows].join('\n');
}

/**
 * Trigger a browser download of the supplied CSV content.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import type { EventCandidate } from '@/services/registrations.service';

export type SessionOption = { value: string; label: string };

export interface CachedEventBundle {
  eventId: string;
  eventTitle: string;
  candidates: EventCandidate[];
  sessions: SessionOption[];
  cachedAt: number;
}

export interface PendingCheckin {
  /** Locally generated UUID — used as the queue key. */
  localId: string;
  eventId: string;
  candidateId: string;
  sessionSlot: string;
  /** Snapshot of the candidate row at queue time (so the row renders even after refresh). */
  candidateSnapshot: Pick<
    EventCandidate,
    'id' | 'familyName' | 'firstName' | 'candidateClass' | 'cleanMobile' | 'mobileNumber'
  >;
  payload: {
    sessionSlot: string;
    encounterType?: string;
    classNumber?: number;
    mobileNumber?: string;
    email?: string;
  };
  queuedAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
  lastError?: string;
  /** Once true, the row persists in `syncedCheckins` for the session-tag chips and is removed from `pendingCheckins`. */
  succeeded?: boolean;
  succeededAt?: number;
  /** Result data populated after successful sync (so the chip can show Community ID). */
  resultCommunityId?: string;
  resultGeneratedCommunityId?: string | null;
  resultAlreadyAttended?: boolean;
  resultUserCreated?: boolean;
  resultTempPassword?: string | null;
  resultEncounterType?: string;
  resultClassNumber?: number;
}

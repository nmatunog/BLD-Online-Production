'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Search,
  UserCheck,
  AlertCircle,
  X,
  Copy,
  KeyRound,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudUpload,
  Download,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { eventsService, type Event } from '@/services/events.service';
import {
  registrationsService,
  type EventCandidate,
} from '@/services/registrations.service';
import {
  attendanceService,
  type AttendanceRoster,
  type AttendanceRosterRow,
} from '@/services/attendance.service';
import { ENCOUNTER_TYPES } from '@/lib/member-constants';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  enqueueCheckin,
  generateLocalId,
  listCachedEventIds,
  listPendingCheckins,
  listSyncedForEvent,
  loadCachedEvent,
  recordSyncedCheckin,
  saveCachedEvent,
} from '@/lib/offline/db';
import {
  downloadCsv,
  drainPendingCheckins,
  pendingCheckinsToCsv,
} from '@/lib/offline/sync';
import type {
  CachedEventBundle,
  PendingCheckin,
  SessionOption,
} from '@/lib/offline/types';

interface QuickResult {
  candidate: EventCandidate;
  communityId?: string | null;
  generatedCommunityId?: string | null;
  alreadyAttended: boolean;
  userCreated: boolean;
  tempPassword?: string | null;
  encounterType: string;
  classNumber: number;
  sessionSlot: string;
  sessionLabel: string;
  /** True when the check-in was queued offline and not yet uploaded. */
  queuedOffline: boolean;
}

function parseEncounterAndClass(candidateClass: string | null | undefined): {
  encounterType: string;
  classNumber: string;
} {
  const raw = String(candidateClass || '')
    .trim()
    .toUpperCase();
  const m = raw.match(/^([A-Z]{1,4})\s*[- ]?\s*(\d{1,3})$/);
  if (!m) return { encounterType: '', classNumber: '' };
  return { encounterType: m[1], classNumber: m[2] };
}

function statusBadge(status: EventCandidate['status']) {
  switch (status) {
    case 'REGISTERED':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Registered
        </Badge>
      );
    case 'CLAIMED':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          Claimed
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-200">
          Imported
        </Badge>
      );
  }
}

function formatEventDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return iso;
  }
}

function normalizeText(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Local replica of the backend's family/first name search. Used when the page is
 * offline (or just for a fast first render before the API responds).
 */
function searchCandidatesLocally(
  candidates: EventCandidate[],
  firstName: string,
  familyName: string,
  limit = 25,
): EventCandidate[] {
  const firstNorm = normalizeText(firstName);
  const familyNorm = normalizeText(familyName);
  if (!firstNorm && !familyNorm) return [];

  const score = (c: EventCandidate): number => {
    const fam = normalizeText(c.familyName);
    const first = normalizeText(c.firstName);
    let s = 0;
    if (familyNorm) {
      if (fam === familyNorm) s += 100;
      else if (fam.startsWith(familyNorm)) s += 60;
      else if (fam.includes(familyNorm)) s += 30;
    }
    if (firstNorm) {
      if (first === firstNorm) s += 100;
      else if (first.startsWith(firstNorm)) s += 60;
      else if (first.includes(firstNorm)) s += 30;
    }
    return s;
  };

  return candidates
    .map((c) => ({ c, s: score(c) }))
    .filter((row) => row.s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      const fam = normalizeText(a.c.familyName).localeCompare(normalizeText(b.c.familyName));
      if (fam !== 0) return fam;
      return normalizeText(a.c.firstName).localeCompare(normalizeText(b.c.firstName));
    })
    .slice(0, limit)
    .map((row) => row.c);
}

function CandidateQuickCheckInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get('eventId') || '';

  const [eventsLoading, setEventsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);

  const [familyName, setFamilyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EventCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [confirmCandidate, setConfirmCandidate] = useState<EventCandidate | null>(
    null,
  );
  const [confirmEncounterType, setConfirmEncounterType] = useState<string>('');
  const [confirmClassNumber, setConfirmClassNumber] = useState<string>('');
  const [confirmMobile, setConfirmMobile] = useState<string>('');
  const [confirmEmail, setConfirmEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [lastResult, setLastResult] = useState<QuickResult | null>(null);

  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionSlot, setSelectedSessionSlot] = useState('');

  // ---------- Roster state ----------
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [rosterSessionFilter, setRosterSessionFilter] = useState<string>('ALL');
  const [rosterIncludePending, setRosterIncludePending] = useState(true);

  // ---------- Offline state ----------
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [cachedBundle, setCachedBundle] = useState<CachedEventBundle | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [pending, setPending] = useState<PendingCheckin[]>([]);
  const [synced, setSynced] = useState<PendingCheckin[]>([]);
  const [syncing, setSyncing] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshQueueState = useCallback(async (eventId: string) => {
    try {
      const [pendingItems, syncedItems] = await Promise.all([
        listPendingCheckins(eventId),
        listSyncedForEvent(eventId),
      ]);
      setPending(pendingItems);
      setSynced(syncedItems);
    } catch {
      // IndexedDB unavailable — silently keep state.
    }
  }, []);

  // ---------- Online/offline listeners + auto-drain loop ----------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsOnline(true);
      void runDrain('auto');
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    drainTimerRef.current = setInterval(() => {
      if (navigator.onLine) {
        void runDrain('auto');
      }
    }, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (drainTimerRef.current) clearInterval(drainTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load registration-enabled events.
  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await eventsService.getAll({
          limit: 100,
          sortBy: 'startDate',
          sortOrder: 'asc',
          collapseDuplicateDisplay: true,
        });
        if (!res.success) {
          // When offline, fall back to whatever events we have cached so the staff can still pick.
          const cachedIds = await safeListCachedEventIds();
          if (cachedIds.length === 0) {
            toast.error('Failed to load events', {
              description: res.error || 'Unknown error',
            });
            setEvents([]);
            return;
          }
          const cachedEvents: Event[] = [];
          for (const id of cachedIds) {
            const bundle = await loadCachedEvent(id);
            if (bundle) {
              cachedEvents.push({
                id: bundle.eventId,
                title: bundle.eventTitle,
                hasRegistration: true,
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
              } as Event);
            }
          }
          setEvents(cachedEvents);
          if (!selectedEventId && cachedEvents[0]) {
            setSelectedEventId(cachedEvents[0].id);
          }
          toast.info('Showing cached events (offline).', {
            description: 'Connect to the internet to refresh the event list.',
          });
          return;
        }
        const list = (res.data?.data || []).filter((e) => e.hasRegistration);
        setEvents(list);

        if (!selectedEventId) {
          // Default to event whose title contains "spiritual warfare" if present,
          // otherwise the soonest one.
          const preferred =
            list.find((e) =>
              e.title.toLowerCase().includes('spiritual warfare'),
            ) || list[0];
          if (preferred) setSelectedEventId(preferred.id);
        }
      } catch (err) {
        toast.error('Failed to load events', {
          description: getErrorMessage(err, 'Unable to load events'),
        });
      } finally {
        setEventsLoading(false);
      }
    };
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-cache candidates + sessions for the selected event whenever it changes (or when going online).
  useEffect(() => {
    if (!selectedEventId) {
      setCachedBundle(null);
      setSessionOptions([]);
      setSelectedSessionSlot('');
      return;
    }
    let cancelled = false;
    (async () => {
      // Always load whatever cached bundle we have first so offline users see something instantly.
      const cached = await loadCachedEvent(selectedEventId).catch(() => undefined);
      if (cached && !cancelled) {
        setCachedBundle(cached);
        setSessionOptions(cached.sessions);
        setSelectedSessionSlot((prev) => {
          if (prev && cached.sessions.some((s) => s.value === prev)) return prev;
          return cached.sessions[0]?.value || '';
        });
        setCacheStatus('ready');
      } else if (!cancelled) {
        setCacheStatus('idle');
      }
      void refreshQueueState(selectedEventId);

      // Then refresh from the server when online.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cached) setCacheStatus('error');
        return;
      }
      void refreshCacheFromServer(selectedEventId, /*silent*/ Boolean(cached));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  const refreshCacheFromServer = useCallback(
    async (eventId: string, silent: boolean) => {
      if (!silent) setCacheStatus('loading');
      setSessionsLoading(true);
      try {
        const eventInfo = events.find((e) => e.id === eventId);
        const [candidatesRes, sessionsRes] = await Promise.all([
          registrationsService.listCandidates(eventId),
          registrationsService.getCandidateCheckinSessions(eventId),
        ]);
        if (!candidatesRes.success) {
          throw new Error(candidatesRes.error || 'Failed to load candidates');
        }
        if (!sessionsRes.success) {
          throw new Error(sessionsRes.error || 'Failed to load sessions');
        }
        const bundle: CachedEventBundle = {
          eventId,
          eventTitle: eventInfo?.title || eventId,
          candidates: candidatesRes.data || [],
          sessions: sessionsRes.data || [],
          cachedAt: Date.now(),
        };
        await saveCachedEvent(bundle);
        setCachedBundle(bundle);
        setSessionOptions(bundle.sessions);
        setSelectedSessionSlot((prev) => {
          if (prev && bundle.sessions.some((s) => s.value === prev)) return prev;
          return bundle.sessions[0]?.value || '';
        });
        setCacheStatus('ready');
        if (!silent) {
          toast.success('Cached for offline use', {
            description: `${bundle.candidates.length} candidates ready.`,
          });
        }
      } catch (err) {
        if (!silent) {
          toast.error('Could not refresh offline cache', {
            description: getErrorMessage(err, 'Network error'),
          });
        }
        if (cacheStatus !== 'ready') setCacheStatus('error');
      } finally {
        setSessionsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events],
  );

  // Search effect: debounce + use cached candidates first, fall back to API for fresh hits when online.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!selectedEventId) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const fam = familyName.trim();
    const first = firstName.trim();
    if (fam.length < 2 && first.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    // Local match first — gives instant feedback even while offline.
    const localHits = cachedBundle
      ? searchCandidatesLocally(cachedBundle.candidates, first, fam, 25)
      : [];
    setResults(localHits);
    setSearchError(null);

    // If offline, that's all we can do.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await registrationsService.searchCandidatesByName(
          selectedEventId,
          { firstName: first || undefined, familyName: fam || undefined, limit: 25 },
        );
        if (!res.success) {
          // Keep local hits if the server call fails.
          if (localHits.length === 0) setSearchError(res.error || 'Search failed');
          return;
        }
        setResults(res.data || []);
      } catch (err) {
        if (localHits.length === 0) {
          setSearchError(getErrorMessage(err, 'Search failed'));
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [familyName, firstName, selectedEventId, cachedBundle]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const selectedSessionLabel = useMemo(
    () => sessionOptions.find((s) => s.value === selectedSessionSlot)?.label ?? '',
    [sessionOptions, selectedSessionSlot],
  );

  const candidateStatusForSession = useCallback(
    (candidateId: string): 'pending' | 'synced' | undefined => {
      if (!selectedSessionSlot) return undefined;
      const isPending = pending.some(
        (p) => p.candidateId === candidateId && p.sessionSlot === selectedSessionSlot,
      );
      if (isPending) return 'pending';
      const isSynced = synced.some(
        (p) => p.candidateId === candidateId && p.sessionSlot === selectedSessionSlot,
      );
      if (isSynced) return 'synced';
      return undefined;
    },
    [pending, synced, selectedSessionSlot],
  );

  const openConfirmDialog = (candidate: EventCandidate) => {
    const parsed = parseEncounterAndClass(candidate.candidateClass);
    setConfirmCandidate(candidate);
    setConfirmEncounterType(parsed.encounterType || selectedEvent?.encounterType || '');
    setConfirmClassNumber(
      parsed.classNumber || (selectedEvent?.classNumber ? String(selectedEvent.classNumber) : ''),
    );
    setConfirmMobile(candidate.cleanMobile || candidate.mobileNumber || '');
    setConfirmEmail('');
  };

  const closeConfirmDialog = () => {
    setConfirmCandidate(null);
    setConfirmEncounterType('');
    setConfirmClassNumber('');
    setConfirmMobile('');
    setConfirmEmail('');
  };

  const runDrain = useCallback(
    async (mode: 'manual' | 'auto') => {
      if (syncing) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (mode === 'manual') {
          toast.warning('Still offline', {
            description: 'Pending check-ins will upload automatically when signal returns.',
          });
        }
        return;
      }
      setSyncing(true);
      try {
        const summary = await drainPendingCheckins(selectedEventId || undefined);
        if (selectedEventId) await refreshQueueState(selectedEventId);
        if (mode === 'manual' || summary.attempted > 0) {
          if (summary.succeeded > 0 && summary.failed === 0) {
            toast.success(`Uploaded ${summary.succeeded} check-in${summary.succeeded > 1 ? 's' : ''}.`);
          } else if (summary.succeeded > 0 && summary.failed > 0) {
            toast.warning(`Uploaded ${summary.succeeded}, ${summary.failed} still pending.`);
          } else if (summary.failed > 0) {
            toast.error(`${summary.failed} check-in${summary.failed > 1 ? 's' : ''} failed to upload.`, {
              description: summary.errors[0]?.error,
            });
          } else if (mode === 'manual') {
            toast.info('Nothing to upload.');
          }
        }
      } finally {
        setSyncing(false);
      }
    },
    [selectedEventId, syncing, refreshQueueState],
  );

  const handleConfirmSubmit = async () => {
    if (!confirmCandidate || !selectedEventId) return;

    const encounterType = confirmEncounterType.trim().toUpperCase();
    const classNumber = parseInt(confirmClassNumber, 10);

    if (!/^[A-Z]{1,4}$/.test(encounterType)) {
      toast.error('Encounter type is required (e.g. ME, SE, SPE, YE).');
      return;
    }
    if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 999) {
      toast.error('Class number must be between 1 and 999.');
      return;
    }
    if (!selectedSessionSlot) {
      toast.error('Select the check-in session (AM or PM for this day).');
      return;
    }

    const payload = {
      sessionSlot: selectedSessionSlot,
      encounterType,
      classNumber,
      mobileNumber: confirmMobile.trim() || undefined,
      email: confirmEmail.trim() || undefined,
    };

    setSubmitting(true);

    const sessionLabel =
      sessionOptions.find((s) => s.value === selectedSessionSlot)?.label ||
      selectedSessionSlot;

    const queueLocally = async (reason?: string) => {
      const item: PendingCheckin = {
        localId: generateLocalId(),
        eventId: selectedEventId,
        candidateId: confirmCandidate.id,
        sessionSlot: selectedSessionSlot,
        candidateSnapshot: {
          id: confirmCandidate.id,
          familyName: confirmCandidate.familyName,
          firstName: confirmCandidate.firstName,
          candidateClass: confirmCandidate.candidateClass,
          cleanMobile: confirmCandidate.cleanMobile,
          mobileNumber: confirmCandidate.mobileNumber,
        },
        payload,
        queuedAt: Date.now(),
        attemptCount: 0,
        lastError: reason,
      };
      await enqueueCheckin(item);
      await refreshQueueState(selectedEventId);
      setLastResult({
        candidate: confirmCandidate,
        communityId: null,
        generatedCommunityId: null,
        alreadyAttended: false,
        userCreated: false,
        tempPassword: null,
        encounterType,
        classNumber,
        sessionSlot: selectedSessionSlot,
        sessionLabel,
        queuedOffline: true,
      });
      closeConfirmDialog();
      toast.success('Saved for upload', {
        description: `${confirmCandidate.firstName} ${confirmCandidate.familyName} • ${sessionLabel}. Will upload automatically when online.`,
      });
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueLocally('Offline at submit time.');
        return;
      }

      const res = await registrationsService.quickRegisterAndCheckInCandidate(
        selectedEventId,
        confirmCandidate.id,
        payload,
      );

      if (!res.success || !res.data) {
        // Fall back to local queue so the user is never blocked by transient errors.
        await queueLocally(res.error || 'Server returned failure.');
        return;
      }

      const data = res.data;
      // Persist the synced row so the UI keeps the chip across reloads.
      const syncedRow: PendingCheckin = {
        localId: generateLocalId(),
        eventId: selectedEventId,
        candidateId: confirmCandidate.id,
        sessionSlot: data.sessionSlot,
        candidateSnapshot: {
          id: confirmCandidate.id,
          familyName: confirmCandidate.familyName,
          firstName: confirmCandidate.firstName,
          candidateClass: confirmCandidate.candidateClass,
          cleanMobile: confirmCandidate.cleanMobile,
          mobileNumber: confirmCandidate.mobileNumber,
        },
        payload,
        queuedAt: Date.now(),
        attemptCount: 0,
        succeeded: true,
        succeededAt: Date.now(),
        resultCommunityId: data.communityId,
        resultGeneratedCommunityId: data.generatedCommunityId,
        resultAlreadyAttended: data.alreadyAttended,
        resultUserCreated: data.userCreated,
        resultTempPassword: data.tempPassword,
        resultEncounterType: data.encounterType,
        resultClassNumber: data.classNumber,
      };
      await recordSyncedCheckin(syncedRow);
      await refreshQueueState(selectedEventId);

      setLastResult({
        candidate: confirmCandidate,
        communityId: data.communityId,
        generatedCommunityId: data.generatedCommunityId,
        alreadyAttended: data.alreadyAttended,
        userCreated: data.userCreated,
        tempPassword: data.tempPassword,
        encounterType: data.encounterType,
        classNumber: data.classNumber,
        sessionSlot: data.sessionSlot,
        sessionLabel:
          sessionOptions.find((s) => s.value === data.sessionSlot)?.label ||
          data.sessionSlot,
        queuedOffline: false,
      });
      closeConfirmDialog();

      // Refresh search results so the row reflects the new REGISTERED status (best effort).
      const refreshed = await registrationsService
        .searchCandidatesByName(selectedEventId, {
          firstName: firstName.trim() || undefined,
          familyName: familyName.trim() || undefined,
          limit: 25,
        })
        .catch(() => null);
      if (refreshed?.success && refreshed.data) setResults(refreshed.data);

      toast.success(
        data.alreadyAttended
          ? 'Already checked in for this session.'
          : 'Checked in for this session.',
        {
          description: `${syncedRow.candidateSnapshot.firstName} ${syncedRow.candidateSnapshot.familyName} • ${syncedRow.payload.sessionSlot} • Community ID: ${data.communityId}`,
        },
      );
    } catch (err) {
      // Network or transport-level failure: queue and retry.
      await queueLocally(getErrorMessage(err, 'Network error'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error(`Could not copy ${label}`));
  };

  const handleExportPending = async () => {
    if (pending.length === 0) {
      toast.info('No pending check-ins to export.');
      return;
    }
    const csv = pendingCheckinsToCsv(pending);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCsv(`pending-checkins-${stamp}.csv`, csv);
    toast.success(`Exported ${pending.length} pending check-in${pending.length > 1 ? 's' : ''}.`);
  };

  const openRosterDialog = useCallback(async () => {
    if (!selectedEventId) {
      toast.error('Select an event first.');
      return;
    }
    setRosterDialogOpen(true);
    setRoster(null);
    setRosterSessionFilter('ALL');
    setRosterLoading(true);
    try {
      const res = await attendanceService.getEventRoster(selectedEventId);
      if (!res.success || !res.data) {
        toast.error('Could not load roster', {
          description: res.error || 'Server returned no data.',
        });
        setRosterDialogOpen(false);
        return;
      }
      setRoster(res.data);
    } catch (err) {
      toast.error('Could not load roster', {
        description: getErrorMessage(err, 'Network error'),
      });
      setRosterDialogOpen(false);
    } finally {
      setRosterLoading(false);
    }
  }, [selectedEventId]);

  const handleRefreshRoster = useCallback(async () => {
    if (!selectedEventId) return;
    setRosterLoading(true);
    try {
      const res = await attendanceService.getEventRoster(selectedEventId);
      if (!res.success || !res.data) {
        toast.error('Could not refresh roster', {
          description: res.error || 'Server returned no data.',
        });
        return;
      }
      setRoster(res.data);
      toast.success('Roster refreshed');
    } catch (err) {
      toast.error('Could not refresh roster', {
        description: getErrorMessage(err, 'Network error'),
      });
    } finally {
      setRosterLoading(false);
    }
  }, [selectedEventId]);

  /**
   * Build the visible roster rows, optionally folding in this device's
   * not-yet-synced check-ins so the printed sheet matches reality on the floor.
   */
  const rosterDisplayRows = useMemo<
    Array<AttendanceRosterRow & { source: 'synced' | 'pending' }>
  >(() => {
    if (!roster) return [];

    const baseRows: Array<AttendanceRosterRow & { source: 'synced' | 'pending' }> =
      roster.rows.map((r) => ({ ...r, source: 'synced' as const }));

    if (rosterIncludePending && pending.length > 0) {
      const seenKey = new Set(
        baseRows.map((r) => `${r.memberId}|${r.sessionSlot}`),
      );
      for (const p of pending) {
        // Pending rows don't have a Community ID yet (assigned at sync time).
        const sessionLabel =
          roster.sessions.find((s) => s.value === p.sessionSlot)?.label ||
          p.sessionSlot;
        const key = `${p.candidateId}|${p.sessionSlot}`;
        if (seenKey.has(key)) continue;
        baseRows.push({
          attendanceId: `pending:${p.localId}`,
          memberId: `pending:${p.candidateId}`,
          communityId: '— pending —',
          familyName: p.candidateSnapshot.familyName,
          firstName: p.candidateSnapshot.firstName,
          encounterType: p.payload.encounterType || '',
          classNumber: p.payload.classNumber || 0,
          ministry: null,
          apostolate: null,
          candidateClass: p.candidateSnapshot.candidateClass || null,
          classGroup: null,
          mobileNumber:
            p.candidateSnapshot.cleanMobile ||
            p.candidateSnapshot.mobileNumber ||
            null,
          email: null,
          sessionSlot: p.sessionSlot,
          sessionLabel,
          checkInTimeIso: new Date(p.queuedAt).toISOString(),
          checkInTimeManila: new Date(p.queuedAt).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
          }),
          method: 'MANUAL' as const,
          source: 'pending' as const,
        });
      }
    }

    const filtered =
      rosterSessionFilter === 'ALL'
        ? baseRows
        : baseRows.filter((r) => r.sessionSlot === rosterSessionFilter);

    return filtered.sort((a, b) => {
      if (a.sessionSlot < b.sessionSlot) return -1;
      if (a.sessionSlot > b.sessionSlot) return 1;
      const fam = a.familyName.localeCompare(b.familyName);
      if (fam !== 0) return fam;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [roster, rosterSessionFilter, rosterIncludePending, pending]);

  const handleDownloadRoster = useCallback(() => {
    if (!roster || rosterDisplayRows.length === 0) {
      toast.info('No rows to download.');
      return;
    }
    const headers = [
      'Community ID',
      'Family Name',
      'First Name',
      'Encounter',
      'Class',
      'Session',
      'Check-in (Manila)',
      'Method',
      'Status',
      'Mobile',
      'Email',
      'Class Group',
      'Candidate Class',
      'Ministry',
      'Apostolate',
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = rosterDisplayRows.map((r) =>
      [
        r.communityId,
        r.familyName,
        r.firstName,
        r.encounterType,
        r.classNumber || '',
        r.sessionLabel,
        r.checkInTimeManila,
        r.method,
        r.source === 'pending' ? 'Pending upload (this device)' : 'Synced',
        r.mobileNumber || '',
        r.email || '',
        r.classGroup || '',
        r.candidateClass || '',
        r.ministry || '',
        r.apostolate || '',
      ]
        .map(escape)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');

    const safeTitle = (roster.eventTitle || 'event')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const sessionTag =
      rosterSessionFilter === 'ALL' ? 'all-sessions' : rosterSessionFilter;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCsv(`attendance-${safeTitle}-${sessionTag}-${stamp}.csv`, csv);

    toast.success(`Downloaded ${rosterDisplayRows.length} row${rosterDisplayRows.length > 1 ? 's' : ''}.`);
  }, [roster, rosterDisplayRows, rosterSessionFilter]);

  const cacheAgeLabel = useMemo(() => {
    if (!cachedBundle) return null;
    const ageMs = Date.now() - cachedBundle.cachedAt;
    if (ageMs < 60_000) return 'just now';
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, [cachedBundle]);

  const pendingCount = pending.length;
  const syncedCount = synced.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push('/checkin')}
              variant="outline"
              size="sm"
              className="bg-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Candidate Quick Check-In
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Works offline. Open this page <strong>once while online</strong> to cache the
                candidate list, then check people in even with no signal — uploads happen
                automatically when the signal returns.
              </p>
            </div>
          </div>

          {/* Status bar */}
          <div
            className={`rounded-xl border-2 p-4 flex flex-wrap items-center justify-between gap-3 ${
              isOnline
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-amber-50 border-amber-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {isOnline ? (
                <Wifi className="w-6 h-6 text-emerald-700 flex-shrink-0" />
              ) : (
                <WifiOff className="w-6 h-6 text-amber-700 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-gray-900">
                  {isOnline ? 'Online' : 'Offline'}
                  {pendingCount > 0 ? ` · ${pendingCount} pending upload${pendingCount > 1 ? 's' : ''}` : ''}
                  {syncing ? ' · syncing…' : ''}
                </div>
                <div className="text-xs text-gray-700 mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    {cachedBundle
                      ? `${cachedBundle.candidates.length} candidates cached${cacheAgeLabel ? ` (${cacheAgeLabel})` : ''}`
                      : cacheStatus === 'loading'
                        ? 'Caching for offline use…'
                        : 'Not cached yet'}
                  </span>
                  {syncedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      · <CheckCircle2 className="w-3.5 h-3.5" /> {syncedCount} done this event
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() =>
                  selectedEventId &&
                  void refreshCacheFromServer(selectedEventId, /*silent*/ false)
                }
                variant="outline"
                size="sm"
                disabled={!selectedEventId || !isOnline || cacheStatus === 'loading'}
                className="bg-white"
                title="Re-fetch the candidate list and session list"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${cacheStatus === 'loading' ? 'animate-spin' : ''}`} />
                Refresh cache
              </Button>
              <Button
                onClick={() => void runDrain('manual')}
                size="sm"
                disabled={syncing || !isOnline || pendingCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CloudUpload className="w-4 h-4 mr-1.5" /> Sync Now
              </Button>
              <Button
                onClick={() => void openRosterDialog()}
                size="sm"
                disabled={!selectedEventId || !isOnline}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                title={
                  !selectedEventId
                    ? 'Pick an event first.'
                    : !isOnline
                      ? 'Go online to fetch the latest roster.'
                      : 'Download attendance roster for this event'
                }
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Download roster
              </Button>
              {pendingCount > 0 ? (
                <Button
                  onClick={handleExportPending}
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  title="Download pending check-ins as a CSV (emergency backup)"
                >
                  <Download className="w-4 h-4 mr-1.5" /> Export pending
                </Button>
              ) : null}
            </div>
          </div>

          {/* Event picker */}
          <Card className="border-2 border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Calendar className="w-5 h-5 mr-2 text-red-600" />
                Select Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading events...
                </div>
              ) : events.length === 0 ? (
                <div className="flex items-center text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                  No registration-enabled events found.
                </div>
              ) : (
                <>
                  <Select
                    value={selectedEventId}
                    onValueChange={(v) => {
                      setSelectedEventId(v);
                      setResults([]);
                      setLastResult(null);
                    }}
                  >
                    <SelectTrigger className="w-full h-14 border-2 border-red-300 bg-white text-base font-semibold">
                      <SelectValue placeholder="Choose an event..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-red-200 z-[100]">
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="py-3">
                          <div className="flex flex-col">
                            <span className="font-bold">{e.title}</span>
                            <span className="text-xs text-gray-600 mt-0.5">
                              {formatEventDate(e.startDate)}
                              {e.location ? ` • ${e.location}` : ''}
                              {e.encounterType && e.classNumber
                                ? ` • ${e.encounterType} ${e.classNumber}`
                                : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEventId && (
                    <div className="mt-4 space-y-2">
                      <label className="block text-sm font-semibold text-gray-800">
                        Check-in session (this AM or PM)
                      </label>
                      {sessionsLoading && sessionOptions.length === 0 ? (
                        <div className="flex items-center text-sm text-gray-600 py-2">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading sessions...
                        </div>
                      ) : sessionOptions.length === 0 ? (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          No session list returned for this event. Ensure start and end dates span your event days (e.g. May 9–10).
                        </p>
                      ) : (
                        <Select
                          value={selectedSessionSlot}
                          onValueChange={setSelectedSessionSlot}
                        >
                          <SelectTrigger className="w-full h-12 border-2 border-red-200 bg-white">
                            <SelectValue placeholder="Choose morning or afternoon..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-2 border-red-200 z-[100] max-h-[280px]">
                            {sessionOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="py-2">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-gray-500">
                        Switch this dropdown when you move to the next day or session (four slots for a two-day event: Sat AM/PM, Sun AM/PM).
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Last result banner */}
          {lastResult && (
            <Card
              className={`border-2 ${
                lastResult.queuedOffline
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-green-300 bg-green-50'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {lastResult.queuedOffline ? (
                    <CloudUpload className="w-7 h-7 text-amber-700 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7 text-green-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3
                        className={`text-lg font-bold ${
                          lastResult.queuedOffline ? 'text-amber-900' : 'text-green-900'
                        }`}
                      >
                        {lastResult.queuedOffline
                          ? 'Saved — will upload when online'
                          : lastResult.alreadyAttended
                            ? 'Already checked in'
                            : 'Checked In!'}
                      </h3>
                      <button
                        onClick={() => setLastResult(null)}
                        className={
                          lastResult.queuedOffline
                            ? 'text-amber-700 hover:text-amber-900'
                            : 'text-green-700 hover:text-green-900'
                        }
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p
                      className={`text-sm mb-3 ${
                        lastResult.queuedOffline ? 'text-amber-900' : 'text-green-900'
                      }`}
                    >
                      <strong>
                        {lastResult.candidate.firstName} {lastResult.candidate.familyName}
                      </strong>
                      {' • '}
                      {lastResult.encounterType} {lastResult.classNumber}
                      <span
                        className={`block text-xs font-normal mt-1 ${
                          lastResult.queuedOffline ? 'text-amber-800' : 'text-green-800'
                        }`}
                      >
                        Session: {lastResult.sessionLabel}
                      </span>
                    </p>
                    {lastResult.communityId ? (
                      <div className="bg-white border-2 border-green-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                              Community ID
                            </div>
                            <div className="text-2xl font-mono font-bold text-gray-900">
                              {lastResult.communityId}
                            </div>
                            {lastResult.generatedCommunityId && (
                              <div className="text-xs text-green-700 mt-0.5">
                                Newly assigned
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() =>
                              copyToClipboard(lastResult.communityId || '', 'Community ID')
                            }
                            variant="outline"
                            size="sm"
                            className="bg-white"
                          >
                            <Copy className="w-4 h-4 mr-1.5" /> Copy
                          </Button>
                        </div>
                      </div>
                    ) : lastResult.queuedOffline ? (
                      <div className="bg-white border-2 border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-900">
                        Community ID will be assigned by the server during the next sync. The
                        attendance record is safely stored on this device.
                      </div>
                    ) : null}
                    {lastResult.userCreated && lastResult.tempPassword && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <KeyRound className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-amber-900">
                              Temporary password
                            </div>
                            <div className="font-mono text-sm text-amber-900 mt-0.5 break-all">
                              {lastResult.tempPassword}
                            </div>
                            <div className="text-xs text-amber-700 mt-1">
                              Share with the candidate. Expires in 30 days.
                            </div>
                          </div>
                          <Button
                            onClick={() =>
                              copyToClipboard(
                                lastResult.tempPassword || '',
                                'Temp password',
                              )
                            }
                            variant="outline"
                            size="sm"
                            className="bg-white"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Search className="w-5 h-5 mr-2 text-blue-600" />
                Find Candidate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Family Name
                  </label>
                  <Input
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="e.g. Sanchez"
                    className="h-11 text-base"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    First Name
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Henry"
                    className="h-11 text-base"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Type at least 2 characters in either field. Search runs automatically — works offline against the cached list.
              </p>

              {/* Results */}
              {!selectedEventId ? (
                <div className="text-sm text-gray-600 text-center py-8">
                  Select an event to search candidates.
                </div>
              ) : searching && results.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...
                </div>
              ) : searchError ? (
                <div className="flex items-center justify-center py-6 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-2" /> {searchError}
                </div>
              ) : results.length === 0 ? (
                familyName.trim() || firstName.trim() ? (
                  <div className="text-sm text-gray-600 text-center py-6">
                    No matching candidates.
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-6">
                    Start typing a family name or first name above.
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {results.map((c) => {
                    const parsed = parseEncounterAndClass(c.candidateClass);
                    const isRegistered = c.status === 'REGISTERED';
                    const sessionStatus = candidateStatusForSession(c.id);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 rounded-lg p-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {c.familyName}, {c.firstName}
                            </span>
                            {statusBadge(c.status)}
                            {sessionStatus === 'pending' ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 inline-flex items-center gap-1">
                                <CloudUpload className="w-3 h-3" /> Pending upload
                              </Badge>
                            ) : sessionStatus === 'synced' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Checked in (this session)
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {c.candidateClass}
                            {parsed.encounterType && parsed.classNumber
                              ? ` (${parsed.encounterType} ${parsed.classNumber})`
                              : ''}
                            {c.cleanMobile ? ` • ${c.cleanMobile}` : ''}
                            {c.classGroup ? ` • Group: ${c.classGroup}` : ''}
                          </div>
                        </div>
                        <Button
                          onClick={() => openConfirmDialog(c)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          size="sm"
                          disabled={
                            !selectedSessionSlot ||
                            sessionOptions.length === 0
                          }
                          title={
                            !selectedSessionSlot
                              ? 'Select the check-in session (AM/PM) above first.'
                              : isRegistered
                                ? 'Adds attendance for the selected session (Community ID already assigned).'
                                : ''
                          }
                        >
                          <UserCheck className="w-4 h-4 mr-1.5" />
                          {isRegistered ? 'Check in (this session)' : 'Register & check in'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending list */}
          {pendingCount > 0 && (
            <Card className="border-2 border-amber-200 bg-amber-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <CloudUpload className="w-5 h-5 mr-2 text-amber-700" />
                  Pending uploads ({pendingCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {pending.map((p) => (
                    <li key={p.localId} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {p.candidateSnapshot.firstName} {p.candidateSnapshot.familyName}
                        </span>
                        <span className="text-xs text-gray-600 ml-2">
                          {p.payload.encounterType} {p.payload.classNumber} •{' '}
                          {sessionOptions.find((s) => s.value === p.sessionSlot)?.label || p.sessionSlot}
                        </span>
                        {p.lastError ? (
                          <div className="text-xs text-red-700 mt-0.5">
                            Last error: {p.lastError} (attempts: {p.attemptCount})
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs text-amber-800">
                        Saved {new Date(p.queuedAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmCandidate}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog();
        }}
      >
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Encounter & Check In</DialogTitle>
            <DialogDescription>
              Confirm the encounter type and class number for{' '}
              <strong>
                {confirmCandidate?.firstName} {confirmCandidate?.familyName}
              </strong>
              . Community ID is assigned on first registration; later sessions reuse the same ID.
              {selectedSessionLabel ? (
                <>
                  {' '}
                  Checking in for: <strong>{selectedSessionLabel}</strong>.
                </>
              ) : null}
              {!isOnline ? (
                <span className="block mt-2 text-amber-800">
                  You are <strong>offline</strong>. The check-in will be saved on this device and uploaded automatically when signal returns.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Encounter Type *
                </label>
                <Select
                  value={confirmEncounterType}
                  onValueChange={setConfirmEncounterType}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-[200]">
                    {ENCOUNTER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Class Number *
                </label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={confirmClassNumber}
                  onChange={(e) => setConfirmClassNumber(e.target.value)}
                  className="h-11"
                  placeholder="e.g. 18"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mobile Number (optional)
              </label>
              <Input
                value={confirmMobile}
                onChange={(e) => setConfirmMobile(e.target.value)}
                className="h-11"
                placeholder="09xxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email (optional)
              </label>
              <Input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="h-11"
                placeholder="candidate@email.com"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Mobile or email is required only if no member account exists yet.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeConfirmDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Working...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-1.5" /> Confirm & Check In
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster dialog */}
      <Dialog
        open={rosterDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRosterDialogOpen(false);
            setRoster(null);
          }
        }}
      >
        <DialogContent className="bg-white sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Attendance Roster
            </DialogTitle>
            <DialogDescription>
              {roster ? (
                <>
                  <strong>{roster.eventTitle}</strong> · {roster.totalRows} check-in
                  {roster.totalRows === 1 ? '' : 's'} · {roster.uniqueMembers} unique attendee
                  {roster.uniqueMembers === 1 ? '' : 's'}.
                  {pending.length > 0 ? (
                    <span className="block text-amber-700 mt-1">
                      Plus {pending.length} pending upload{pending.length > 1 ? 's' : ''} on this device — toggle below to include them.
                    </span>
                  ) : null}
                </>
              ) : rosterLoading ? (
                'Loading…'
              ) : (
                'Choose options below, then download.'
              )}
            </DialogDescription>
          </DialogHeader>

          {rosterLoading && !roster ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Fetching attendance from server…
            </div>
          ) : roster ? (
            <>
              <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 pb-3 mb-2">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Filter by session
                  </label>
                  <Select
                    value={rosterSessionFilter}
                    onValueChange={setRosterSessionFilter}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[300]">
                      <SelectItem value="ALL">
                        All sessions ({roster.totalRows + (rosterIncludePending ? pending.length : 0)})
                      </SelectItem>
                      {roster.sessions.map((s) => {
                        const synced = roster.totalsBySession[s.value] || 0;
                        const pendingCountForSession = rosterIncludePending
                          ? pending.filter((p) => p.sessionSlot === s.value).length
                          : 0;
                        return (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label} ({synced + pendingCountForSession})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={rosterIncludePending}
                    onChange={(e) => setRosterIncludePending(e.target.checked)}
                    disabled={pending.length === 0}
                  />
                  Include pending uploads ({pending.length})
                </label>
                <Button
                  onClick={() => void handleRefreshRoster()}
                  variant="outline"
                  size="sm"
                  disabled={rosterLoading}
                  className="bg-white"
                >
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${rosterLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold text-gray-700">Community ID</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Name</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Class</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Session</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Time</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rosterDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                          No check-ins for this filter yet.
                        </td>
                      </tr>
                    ) : (
                      rosterDisplayRows.map((r) => (
                        <tr key={r.attendanceId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{r.communityId}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold">
                              {r.familyName}, {r.firstName}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {r.encounterType} {r.classNumber || ''}
                            {r.classGroup ? (
                              <span className="block text-xs text-gray-500">
                                Group: {r.classGroup}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{r.sessionLabel}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">
                            {r.checkInTimeManila}
                          </td>
                          <td className="px-3 py-2">
                            {r.source === 'pending' ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                Pending
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Synced
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <DialogFooter className="border-t border-gray-200 pt-3 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setRosterDialogOpen(false);
                setRoster(null);
              }}
            >
              Close
            </Button>
            <Button
              onClick={handleDownloadRoster}
              disabled={!roster || rosterDisplayRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download CSV ({rosterDisplayRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function safeListCachedEventIds(): Promise<string[]> {
  try {
    return await listCachedEventIds();
  } catch {
    return [];
  }
}

export default function CandidateQuickCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <CandidateQuickCheckInPageInner />
    </Suspense>
  );
}

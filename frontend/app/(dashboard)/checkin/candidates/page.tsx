'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { ENCOUNTER_TYPES } from '@/lib/member-constants';
import { getErrorMessage } from '@/lib/get-error-message';

interface QuickResult {
  candidate: EventCandidate;
  communityId: string;
  generatedCommunityId?: string | null;
  alreadyAttended: boolean;
  userCreated: boolean;
  tempPassword?: string | null;
  encounterType: string;
  classNumber: number;
  sessionSlot: string;
  sessionLabel: string;
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

  const [sessionOptions, setSessionOptions] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionSlot, setSelectedSessionSlot] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          toast.error('Failed to load events', {
            description: res.error || 'Unknown error',
          });
          setEvents([]);
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

  useEffect(() => {
    if (!selectedEventId) {
      setSessionOptions([]);
      setSelectedSessionSlot('');
      return;
    }
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      try {
        const res = await registrationsService.getCandidateCheckinSessions(selectedEventId);
        if (cancelled) return;
        if (!res.success || !res.data?.length) {
          setSessionOptions([]);
          setSelectedSessionSlot('');
          return;
        }
        setSessionOptions(res.data);
        setSelectedSessionSlot((prev) => {
          if (prev && res.data!.some((s) => s.value === prev)) return prev;
          return res.data![0]?.value || '';
        });
      } catch {
        if (!cancelled) {
          setSessionOptions([]);
          setSelectedSessionSlot('');
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  // Debounced search whenever inputs or selected event change.
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

    setSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await registrationsService.searchCandidatesByName(
          selectedEventId,
          { firstName: first || undefined, familyName: fam || undefined, limit: 25 },
        );
        if (!res.success) {
          setSearchError(res.error || 'Search failed');
          setResults([]);
          return;
        }
        setResults(res.data || []);
      } catch (err) {
        setSearchError(getErrorMessage(err, 'Search failed'));
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [familyName, firstName, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const selectedSessionLabel = useMemo(
    () => sessionOptions.find((s) => s.value === selectedSessionSlot)?.label ?? '',
    [sessionOptions, selectedSessionSlot],
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

    setSubmitting(true);
    try {
      const res = await registrationsService.quickRegisterAndCheckInCandidate(
        selectedEventId,
        confirmCandidate.id,
        {
          sessionSlot: selectedSessionSlot,
          encounterType,
          classNumber,
          mobileNumber: confirmMobile.trim() || undefined,
          email: confirmEmail.trim() || undefined,
        },
      );

      if (!res.success || !res.data) {
        toast.error('Registration failed', { description: res.error || 'Unknown error' });
        return;
      }

      const data = res.data;
      const sessionLabel =
        sessionOptions.find((s) => s.value === data.sessionSlot)?.label ||
        data.sessionSlot;
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
        sessionLabel,
      });
      closeConfirmDialog();

      // Refresh search results so the row reflects the new REGISTERED status.
      const refreshed = await registrationsService.searchCandidatesByName(
        selectedEventId,
        {
          firstName: firstName.trim() || undefined,
          familyName: familyName.trim() || undefined,
          limit: 25,
        },
      );
      if (refreshed.success) setResults(refreshed.data || []);

      toast.success(
        data.alreadyAttended
          ? 'Already checked in for this session.'
          : 'Checked in for this session.',
        {
          description: `${sessionLabel} • Community ID: ${data.communityId}`,
        },
      );
    } catch (err) {
      toast.error('Registration failed', {
        description: getErrorMessage(err, 'Unable to register candidate'),
      });
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
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Candidate Quick Check-In
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                For weekend programs (e.g. May 9–10): choose morning or afternoon for each day.
                Search by family name + first name, confirm encounter no., then check in — Community ID is
                assigned on first registration; use the same flow for each AM/PM session.
              </p>
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading
                  events...
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
                      {sessionsLoading ? (
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
            <Card className="border-2 border-green-300 bg-green-50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-7 h-7 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3 className="text-lg font-bold text-green-900">
                        {lastResult.alreadyAttended
                          ? 'Already checked in'
                          : 'Checked In!'}
                      </h3>
                      <button
                        onClick={() => setLastResult(null)}
                        className="text-green-700 hover:text-green-900"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-green-900 mb-3">
                      <strong>
                        {lastResult.candidate.firstName} {lastResult.candidate.familyName}
                      </strong>
                      {' • '}
                      {lastResult.encounterType} {lastResult.classNumber}
                      <span className="block text-xs font-normal text-green-800 mt-1">
                        Session: {lastResult.sessionLabel}
                      </span>
                    </p>
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
                            copyToClipboard(lastResult.communityId, 'Community ID')
                          }
                          variant="outline"
                          size="sm"
                          className="bg-white"
                        >
                          <Copy className="w-4 h-4 mr-1.5" /> Copy
                        </Button>
                      </div>
                    </div>
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
                Type at least 2 characters in either field. Search runs automatically.
              </p>

              {/* Results */}
              {!selectedEventId ? (
                <div className="text-sm text-gray-600 text-center py-8">
                  Select an event to search candidates.
                </div>
              ) : searching ? (
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
                            sessionOptions.length === 0 ||
                            sessionsLoading
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
    </div>
  );
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

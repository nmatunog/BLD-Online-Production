'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, CheckCircle, Camera } from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { membersService } from '@/services/members.service';
import { sortEventsNearestFirst, isRelevantForCheckIn } from '@/lib/event-checkin-window';
import { isCandidateCheckInEvent } from '@/lib/event-utils';
import { getErrorMessage } from '@/lib/get-error-message';
import { withPhotoCacheBust } from '@/lib/photo-url';
import {
  looksLikeCommunityId,
  memberDisplayName,
  normalizeCommunityIdQuery,
  resultFromCheckInError,
  splitNameQuery,
  type CheckInResultState,
} from '@/lib/checkin-ux';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { qrUtils } from '@/lib/qr-scanner-service';
import {
  QRScannerCard,
  ManualCheckInCard,
  CheckInStats,
  RecentCheckIns,
  MoreOptions,
  CheckInLoadingState,
  CheckInResultOverlay,
  StaffSearchBox,
  StaffMemberResultCard,
  EventPickerBar,
  type CheckIn,
  type StaffMemberResult,
} from '@/components/checkin';

function CheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>('');
  const [memberMinistry, setMemberMinistry] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; qrCodeCount: number; manualCount: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [includeAllMinistryEvents, setIncludeAllMinistryEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffMemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResultState | null>(null);
  const [checkingCommunityId, setCheckingCommunityId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const authData = localStorage.getItem('authData');
    let role = '';
    let ministry: string | null = null;
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        role = parsed.user?.role || '';
        const mm = parsed.member?.ministry;
        ministry = typeof mm === 'string' && mm.trim() ? mm.trim() : null;
        setMemberMinistry(ministry);
        setUserRole(role);
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    }

    const staffRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR', 'CLASS_SHEPHERD'];
    const isMemberMinistryStaff = role === 'MEMBER' && !!ministry;

    if (role === 'MEMBER' && !isMemberMinistryStaff) {
      router.replace('/checkin/self-checkin');
      return;
    }
    if (role && !staffRoles.includes(role) && !isMemberMinistryStaff) {
      router.replace('/dashboard');
      return;
    }

    loadEvents(includeAllMinistryEvents, role);
    const eventId = searchParams.get('eventId');
    if (eventId) {
      setSelectedEvent(eventId);
      toast.info('Event pre-selected');
    }
  }, [router, searchParams]);

  const loadEvents = async (includeAllOverride?: boolean, roleOverride?: string) => {
    setLoading(true);
    const includeAll = includeAllOverride ?? includeAllMinistryEvents;
    const role = roleOverride ?? userRole;
    const canIncludeAll = role === 'SUPER_USER' || role === 'ADMINISTRATOR' || role === 'DCS';
    const params = (status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED') => ({
      status,
      sortBy: 'startDate' as const,
      sortOrder: (status === 'COMPLETED' ? 'desc' : 'asc') as 'asc' | 'desc',
      limit: 50,
      includeAllMinistryEvents: canIncludeAll ? includeAll : undefined,
      collapseDuplicateDisplay: true,
    });
    try {
      const [upcomingResult, ongoingResult, completedResult] = await Promise.all([
        eventsService.getAll(params('UPCOMING')),
        eventsService.getAll(params('ONGOING')),
        eventsService.getAll(params('COMPLETED')),
      ]);

      const upcomingList = upcomingResult.success && upcomingResult.data?.data
        ? (Array.isArray(upcomingResult.data.data) ? upcomingResult.data.data : [])
        : [];
      const ongoingList = ongoingResult.success && ongoingResult.data?.data
        ? (Array.isArray(ongoingResult.data.data) ? ongoingResult.data.data : [])
        : [];
      const completedList = completedResult.success && completedResult.data?.data
        ? (Array.isArray(completedResult.data.data) ? completedResult.data.data : []).filter((e: { isRecurring?: boolean }) => e.isRecurring === true)
        : [];

      const seen = new Set<string>();
      const merged = [...upcomingList, ...ongoingList, ...completedList].filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      const now = new Date();
      const relevant = merged.filter((e) => isRelevantForCheckIn(e, now));
      const eventList = sortEventsNearestFirst(relevant, now);

      setEvents(eventList);

      const eventId = searchParams.get('eventId');
      if (eventId && eventList.some(e => e.id === eventId)) {
        setSelectedEvent(eventId);
      } else if (eventList.length > 0) {
        setSelectedEvent(eventList[0].id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load events';
      toast.error('Error Loading Events', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCheckIns = async () => {
    if (!selectedEvent) return;

    try {
      const result = await attendanceService.getByEvent(selectedEvent);
      if (result.success && result.data) {
        const checkIns = Array.isArray(result.data) ? result.data : [];
        setRecentCheckIns(checkIns.slice(0, 10));
        setCheckedInIds(new Set(checkIns.map((row) => row.member.communityId.toUpperCase())));
      }
    } catch (error) {
      console.error('Error loading recent check-ins:', error);
    }
  };

  useEffect(() => {
    if (selectedEvent) {
      loadRecentCheckIns();
      loadStats();
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent && autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadRecentCheckIns();
        loadStats();
      }, 10000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [selectedEvent, autoRefresh]);

  const loadStats = async () => {
    if (!selectedEvent) return;

    setLoadingStats(true);
    try {
      const result = await attendanceService.getEventStats(selectedEvent);
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const resetToSearch = useCallback(() => {
    setCheckInResult(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchEmpty(false);
    setShowScanner(false);
    setCheckingCommunityId(null);
    window.setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const performCheckIn = async (communityId: string) => {
    if (!selectedEvent) {
      setCheckInResult(resultFromCheckInError('Please select an event first'));
      return;
    }

    if (!communityId || !communityId.trim()) {
      setCheckInResult(resultFromCheckInError('Invalid Community ID'));
      return;
    }

    const normalizedCommunityId = communityId.trim().toUpperCase();
    if (checkedInIds.has(normalizedCommunityId)) {
      const existing = searchResults.find(
        (row) => row.communityId.toUpperCase() === normalizedCommunityId,
      );
      setCheckInResult({
        kind: 'already',
        name: existing?.name,
        communityId: normalizedCommunityId,
        message: 'Already checked in',
        hint: 'This member is already on the list. No need to check in again.',
      });
      return;
    }

    setLoading(true);
    setCheckingCommunityId(normalizedCommunityId);

    try {
      const result = await attendanceService.checkIn({
        communityId: normalizedCommunityId,
        eventId: selectedEvent,
        method: 'QR_CODE',
      });

      if (result.success && result.data) {
        const member = result.data.member;
        const displayName = memberDisplayName(member);
        setCheckInResult({
          kind: 'success',
          name: displayName,
          communityId: member.communityId,
          message: 'Checked in',
        });
        loadRecentCheckIns();
        loadStats();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { code?: string; canonicalEvent?: Event; message?: string | string[] } } };
      const conflictPayload = err?.response?.data;
      const conflictCode = conflictPayload?.code;
      const canonical = conflictPayload?.canonicalEvent;

      if (conflictCode === 'DUPLICATE_EVENT_CANONICAL' && canonical?.id) {
        const proceed = window.confirm(
          `This is a duplicate event slot. Check in to canonical event instead?\n\n${canonical.title}`
        );
        if (proceed) {
          setSelectedEvent(canonical.id);
          await performCheckIn(normalizedCommunityId);
          return;
        }
      }

      const errorMessage = getErrorMessage(error, 'Failed to check in');
      const fromResults = searchResults.find(
        (row) => row.communityId.toUpperCase() === normalizedCommunityId,
      );
      setCheckInResult(
        resultFromCheckInError(errorMessage, fromResults?.name, normalizedCommunityId),
      );
    } finally {
      setLoading(false);
      setCheckingCommunityId(null);
    }
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      const eventData = qrUtils.extractEventData(decodedText);
      if (eventData && eventData.eventId) {
        const event = events.find(e => e.id === eventData.eventId);
        if (event) {
          setSelectedEvent(eventData.eventId);
          toast.success(`Event selected: ${event.title}`);
        }
        return;
      }

      const memberData = qrUtils.extractMemberData(decodedText);
      if (memberData && memberData.communityId) {
        await performCheckIn(memberData.communityId);
        return;
      }

      setCheckInResult(resultFromCheckInError('Please scan a valid member QR code.'));
    } catch (error) {
      setCheckInResult(
        resultFromCheckInError(error instanceof Error ? error.message : 'Scan failed. Try again.'),
      );
    }
  };

  const handleUnifiedSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearching(true);
    setSearchEmpty(false);
    try {
      const results: StaffMemberResult[] = [];
      const seen = new Set<string>();

      const pushMember = (member: {
        id: string;
        firstName: string;
        lastName: string;
        nickname?: string | null;
        communityId: string;
        photoUrl?: string | null;
        updatedAt?: string;
      }) => {
        if (seen.has(member.id)) return;
        seen.add(member.id);
        results.push({
          id: member.id,
          name: memberDisplayName(member),
          communityId: member.communityId,
          photoUrl: withPhotoCacheBust(member.photoUrl, member.updatedAt),
        });
      };

      if (looksLikeCommunityId(query)) {
        try {
          const byId = await membersService.getByCommunityId(normalizeCommunityIdQuery(query));
          pushMember(byId);
        } catch {
          // Fall through to name/search lookup
        }
      }

      const searched = await membersService.getAll({
        search: query,
        limit: 10,
      });
      searched.data.forEach(pushMember);

      if (results.length === 0) {
        const { firstName, lastName } = splitNameQuery(query);
        const byName = await membersService.getAll({
          firstName,
          lastName,
          limit: 10,
        });
        byName.data.forEach(pushMember);
      }

      setSearchResults(results);
      setSearchEmpty(results.length === 0);
    } catch (error) {
      toast.error('Search failed', {
        description: error instanceof Error ? error.message : 'Try again',
      });
      setSearchResults([]);
      setSearchEmpty(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchMembers = async (firstName: string, lastName: string): Promise<Array<{ id: string; name: string; communityId: string }>> => {
    try {
      const result = await membersService.getAll({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        limit: 10,
      });

      if (result.data && result.data.length > 0) {
        return result.data.map(m => ({
          id: m.id,
          name: memberDisplayName(m),
          communityId: m.communityId,
        }));
      }

      toast.info('No members found');
      return [];
    } catch (error) {
      toast.error('Search failed', {
        description: error instanceof Error ? error.message : 'Try again',
      });
      return [];
    }
  };

  const handleRemoveCheckIn = async (attendanceId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove the check-in for ${memberName}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await attendanceService.remove(attendanceId);
      if (result.success) {
        toast.success('Check-in Removed', {
          description: `Check-in for ${memberName} has been removed`,
        });
        loadRecentCheckIns();
        loadStats();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove check-in';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const adminRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR'];
  const isAdmin = adminRoles.includes(userRole);
  const isMemberMinistryStaff = userRole === 'MEMBER' && !!memberMinistry;

  const selectedEventData = events.find(e => e.id === selectedEvent);
  const showCandidateQuickCTA =
    !!userRole &&
    (userRole !== 'MEMBER' || isMemberMinistryStaff) &&
    !!selectedEventData &&
    isCandidateCheckInEvent(selectedEventData);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="checkin-screen p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-xl space-y-5 md:max-w-3xl">
          <div className="hidden md:block">
            <h1 className="text-[1.875rem] font-bold text-gray-900">Check-In</h1>
            <p className="mt-1 text-[1.125rem] font-medium text-gray-800">
              Search or scan to check a member in
            </p>
          </div>

          {userRole === 'MEMBER' && !isMemberMinistryStaff && (
            <div className="rounded-xl border-2 border-blue-700 bg-blue-50 p-4">
              <p className="text-[1.125rem] font-medium text-blue-950 mb-2">
                Looking to check yourself in?
              </p>
              <Button
                onClick={() => router.push('/checkin/self-checkin')}
                className="min-h-14 w-full bg-blue-800 text-[1.125rem] font-semibold text-white hover:bg-blue-900"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Go to Self Check-In
              </Button>
            </div>
          )}

          <EventPickerBar
            events={events}
            selectedEventId={selectedEvent}
            onSelect={setSelectedEvent}
            loading={loading && events.length === 0}
          />

          {selectedEvent && (
            <>
              <StaffSearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleUnifiedSearch}
                searching={searching}
                disabled={loading}
                inputRef={searchInputRef}
              />

              <button
                type="button"
                onClick={() => setShowScanner((value) => !value)}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-800 bg-white px-4 text-[1.25rem] font-semibold text-rose-900 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-800 focus-visible:ring-offset-2"
              >
                <Camera className="h-6 w-6" aria-hidden />
                {showScanner ? 'Hide scanner' : 'Scan QR'}
              </button>

              {showScanner && (
                <QRScannerCard
                  onScanSuccess={handleQRScanSuccess}
                  disabled={loading}
                  qrCodeRegionId="qr-reader-dashboard"
                />
              )}

              {searching && <CheckInLoadingState label="Searching members…" />}

              {!searching && searchEmpty && (
                <p className="rounded-xl border-2 border-gray-400 bg-white p-4 text-center text-[1.125rem] font-medium text-gray-900">
                  No members found. Try another name, or tap Scan QR.
                </p>
              )}

              {searchResults.length > 0 && (
                <ul className="space-y-3">
                  {searchResults.map((member) => (
                    <li key={member.id}>
                      <StaffMemberResultCard
                        member={member}
                        alreadyCheckedIn={checkedInIds.has(member.communityId.toUpperCase())}
                        checkingIn={checkingCommunityId === member.communityId.toUpperCase()}
                        onCheckIn={performCheckIn}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <MoreOptions>
                {showCandidateQuickCTA && (
                  <div className="rounded-xl border-2 border-emerald-800 bg-emerald-50 p-4">
                    <p className="text-[1.25rem] font-bold text-emerald-950">Candidate Quick Check-In</p>
                    <p className="mt-1 text-[1.125rem] font-medium text-emerald-950">
                      For first-time encounter, seminar, or retreat candidates only.
                    </p>
                    <Button
                      onClick={() =>
                        router.push(
                          selectedEvent
                            ? `/candidate-checkin?eventId=${selectedEvent}`
                            : '/candidate-checkin',
                        )
                      }
                      className="mt-3 min-h-14 w-full bg-emerald-800 text-[1.125rem] font-semibold text-white hover:bg-emerald-900"
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Open Candidate Check-In
                    </Button>
                  </div>
                )}

                {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') && (
                  <label className="flex min-h-12 items-center gap-3 text-[1.125rem] font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={includeAllMinistryEvents}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIncludeAllMinistryEvents(checked);
                        loadEvents(checked);
                      }}
                      className="h-5 w-5 rounded border-gray-400 text-rose-800 focus:ring-rose-700"
                    />
                    View all ministry events
                  </label>
                )}

                <ManualCheckInCard
                  onCheckIn={performCheckIn}
                  onSearch={handleSearchMembers}
                  loading={loading}
                />

                {stats && (
                  <CheckInStats
                    total={stats.total}
                    qrCodeCount={stats.qrCodeCount}
                    manualCount={stats.manualCount}
                    loading={loadingStats}
                  />
                )}

                <RecentCheckIns
                  checkIns={recentCheckIns}
                  onRemove={handleRemoveCheckIn}
                  onRefresh={() => {
                    loadRecentCheckIns();
                    loadStats();
                  }}
                  autoRefresh={autoRefresh}
                  onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
                  loading={loading}
                  canRemove={isAdmin || userRole === 'MEMBER'}
                />
              </MoreOptions>
            </>
          )}
        </div>
      </div>
      <CheckInResultOverlay result={checkInResult} onDismiss={resetToSearch} />
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <CheckInLoadingState label="Loading check-in…" />
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}

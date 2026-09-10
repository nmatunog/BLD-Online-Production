'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Users,
  Loader2,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { attendanceService, type Attendance } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { membersService } from '@/services/members.service';
import { sortEventsNearestFirst, isRelevantForCheckIn } from '@/lib/event-checkin-window';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { qrUtils } from '@/lib/qr-scanner-service';
import {
  QRScannerCard,
  ManualCheckInCard,
  CheckInStats,
  RecentCheckIns,
  type CheckIn
} from '@/components/checkin';

function normalizeCheckInToken(value?: string | null): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCheckInTime(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split(':');
  const hour = String(parts[0] || '').padStart(2, '0');
  const minute = String(parts[1] || '0').padStart(2, '0');
  return `${hour}:${minute}`;
}

function manilaDateKey(isoDate: string): string {
  try {
    const dt = new Date(isoDate);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  } catch {
    return isoDate;
  }
}

function dedupeCheckInEventsBySlot(list: Event[]): Event[] {
  const visibleDate = (isoDate: string): string => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };
  const visibleTime = (timeString: string | null): string => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const byKey = new Map<string, Event>();
  for (const event of list) {
    // Deduplicate exactly by what the dropdown displays to users.
    const key = [
      normalizeCheckInToken(event.title),
      normalizeCheckInToken(visibleDate(event.startDate)),
      normalizeCheckInToken(visibleTime(event.startTime)),
      normalizeCheckInToken(event.location),
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, event);
      continue;
    }
    const existingScore = (existing._count?.attendances || 0) + (existing._count?.registrations || 0);
    const nextScore = (event._count?.attendances || 0) + (event._count?.registrations || 0);
    if (nextScore > existingScore) {
      byKey.set(key, event);
      continue;
    }
    if (nextScore === existingScore) {
      const existingUpdated = new Date(existing.updatedAt).getTime();
      const nextUpdated = new Date(event.updatedAt).getTime();
      if (nextUpdated > existingUpdated || (nextUpdated === existingUpdated && event.id > existing.id)) {
        byKey.set(key, event);
      }
    }
  }
  return Array.from(byKey.values());
}

function CheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [memberMinistry, setMemberMinistry] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; qrCodeCount: number; manualCount: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [includeAllMinistryEvents, setIncludeAllMinistryEvents] = useState(false);

  // Check authentication and restrict to staff/admins only (members use Self Check-In)
  useEffect(() => {
    const authData = localStorage.getItem('authData');
    let role = '';
    let memberMinistry: string | null = null;
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        role = parsed.user?.role || '';
        const mm = parsed.member?.ministry;
        memberMinistry =
          typeof mm === 'string' && mm.trim() ? mm.trim() : null;
        setMemberMinistry(memberMinistry);
        setUserRole(role);
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    }

    const staffRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR', 'CLASS_SHEPHERD'];
    const isMemberMinistryStaff = role === 'MEMBER' && !!memberMinistry;

    if (role === 'MEMBER' && !isMemberMinistryStaff) {
      router.replace('/checkin/self-checkin');
      return;
    }
    if (role && !staffRoles.includes(role) && !isMemberMinistryStaff) {
      router.replace('/dashboard');
      return;
    }

    loadEvents(includeAllMinistryEvents, role);
    loadRecentCheckIns();

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
      // Fetch UPCOMING, ONGOING, and COMPLETED (recurring only). Default: general + my ministry only.
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

      // Same logic as Self Check-in: merge order upcoming → ongoing → completed, dedupe, filter to relevant-for-check-in, sort nearest first (Manila)
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

      // Auto-select first event or URL event
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
        // Get most recent 10
        setRecentCheckIns(checkIns.slice(0, 10));
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

  // Auto-refresh recent check-ins every 10 seconds
  useEffect(() => {
    if (selectedEvent && autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadRecentCheckIns();
        loadStats();
      }, 10000); // Refresh every 10 seconds

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

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      // Check if it's an event QR code
      const eventData = qrUtils.extractEventData(decodedText);
      if (eventData && eventData.eventId) {
        const event = events.find(e => e.id === eventData.eventId);
        if (event) {
          setSelectedEvent(eventData.eventId);
          toast.success(`Event selected: ${event.title}`);
        }
        return;
      }

      // Extract member data
      const memberData = qrUtils.extractMemberData(decodedText);
      if (memberData && memberData.communityId) {
        await performCheckIn(memberData.communityId);
        return;
      }

      toast.error('Invalid QR Code');
    } catch (error) {
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'Try again',
      });
    }
  };

  const performCheckIn = async (communityId: string) => {
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }

    if (!communityId || !communityId.trim()) {
      toast.error('Invalid Community ID');
      return;
    }

    const normalizedCommunityId = communityId.trim().toUpperCase();
    setLoading(true);

    try {
      const result = await attendanceService.checkIn({
        communityId: normalizedCommunityId,
        eventId: selectedEvent,
        method: 'QR_CODE',
      });

      if (result.success && result.data) {
        const member = result.data.member;
        const displayName = member.nickname
          ? `${member.nickname} ${member.lastName}`
          : `${member.firstName} ${member.lastName}`;

        toast.success('✅ Check-in Successful!', {
          description: `${displayName} (${member.communityId})`,
          duration: 3000,
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

    let errorMessage = 'Failed to check in';
    if (err?.response?.data) {
      const errorData = err.response.data;
      if (Array.isArray(errorData.message)) {
        errorMessage = errorData.message.join(', ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

      toast.error('Check-in Failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
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
          name: m.nickname
            ? `${m.nickname} ${m.lastName}`
            : `${m.firstName} ${m.lastName}`,
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

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatCheckInTime = (timeString: string): string => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return timeString;
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
  const showCandidateQuickCTA =
    !!userRole &&
    (userRole !== 'MEMBER' || isMemberMinistryStaff);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Check-In
            </h1>
            <p className="text-base text-gray-600">
              Scan QR code or manually check in members for events
            </p>
            {showCandidateQuickCTA && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-emerald-900 font-semibold mb-0.5">
                    Candidate Quick Check-In
                  </p>
                  <p className="text-xs text-emerald-800">
                    For first-time encounter candidates: search by family name + first name,
                    confirm the encounter no., and the system auto-assigns a Community ID + checks them in.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    router.push(
                      selectedEvent
                        ? `/candidate-checkin?eventId=${selectedEvent}`
                        : '/candidate-checkin',
                    )
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Open Candidate Check-In
                </Button>
              </div>
            )}
            {userRole === 'MEMBER' && !isMemberMinistryStaff && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Are you a member looking to check yourself in?</strong>
                </p>
                <Button
                  onClick={() => router.push('/checkin/self-checkin')}
                  variant="outline"
                  className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Go to Self Check-In
                </Button>
              </div>
            )}
          </div>

        {/* Event Selection: Tonight's events first as large cards */}
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                Select Event
              </h2>
              {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') && (
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeAllMinistryEvents}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeAllMinistryEvents(checked);
                      loadEvents(checked);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>View all ministry events</span>
                </label>
              )}
            </div>
            {loading && events.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-sm text-gray-600">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <p className="text-base font-medium text-gray-700">No events available</p>
                <p className="text-sm text-gray-500">No upcoming or ongoing events found</p>
              </div>
            ) : (
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger className="w-full min-h-[56px] border-2 bg-white text-base font-semibold">
                  <SelectValue placeholder="Choose an event to begin check-in..." />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100]">
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id} className="text-base py-3">
                      <div>
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-xs text-gray-600">
                          {formatDate(event.startDate)} {event.startTime && formatTime(event.startTime)}
                          {event.location && ` • ${event.location}`}
                        </p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Check-in Methods: Simplified with shared components */}
        {selectedEvent && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* QR Scanner: Continuous mode default ON */}
            <QRScannerCard
              onScanSuccess={handleQRScanSuccess}
              disabled={loading}
              qrCodeRegionId="qr-reader-dashboard"
            />

            {/* Manual Check-in: Secondary */}
            <ManualCheckInCard
              onCheckIn={performCheckIn}
              onSearch={handleSearchMembers}
              loading={loading}
            />
          </div>
        )}

        {/* Statistics: Live count with shared component */}
        {selectedEvent && stats && (
          <CheckInStats
            total={stats.total}
            qrCodeCount={stats.qrCodeCount}
            manualCount={stats.manualCount}
            loading={loadingStats}
          />
        )}

        {/* Recent Check-ins: With shared component */}
        {selectedEvent && (
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
        )}
        </div>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
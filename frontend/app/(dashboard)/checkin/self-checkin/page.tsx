'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  QrCode,
  CheckCircle,
  X,
  Camera,
  Loader2,
  UserCheck,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import { attendanceService, type Attendance } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { registrationsService, type EventRegistration } from '@/services/registrations.service';
import { membersService } from '@/services/members.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CheckInChatbot, { type CheckInChatbotHandle } from '@/components/chatbot/CheckInChatbot';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  formatEventDateManila,
  resultFromCheckInError,
  type CheckInResultState,
} from '@/lib/checkin-ux';
import {
  CheckInLoadingState,
  CheckInResultOverlay,
  MemberIdQrPanel,
  MoreOptions,
} from '@/components/checkin';
import {
  isOngoingForDisplay,
  canCheckInToEvent,
  sortEventsNearestFirst,
  isPastEventCategory,
  isRelevantForCheckIn,
} from '@/lib/event-checkin-window';
import { deviceMemory } from '@/lib/device-memory';

const qrCodeRegionId = 'qr-reader-self';

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

function SelfCheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkInChatbotRef = useRef<CheckInChatbotHandle>(null);
  const scannerRef = useRef<QRScanner | null>(null);

  const [eventList, setEventList] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [currentMember, setCurrentMember] = useState<{ id: string; communityId: string; firstName: string; lastName: string; middleName?: string | null; nickname?: string | null } | null>(null);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [pastEventsLoaded, setPastEventsLoaded] = useState(false);
  const [pastSelectValue, setPastSelectValue] = useState<string>('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [checkInResult, setCheckInResult] = useState<CheckInResultState | null>(null);
  
  // Device memory for remembered member
  const [rememberedMember, setRememberedMember] = useState<ReturnType<typeof deviceMemory.getRememberedMember>>(null);

  const loadEventList = useCallback(async () => {
    setLoadingEvents(true);
    const params = (status: 'UPCOMING' | 'ONGOING' | 'COMPLETED') => ({
      status,
      sortBy: 'startDate' as const,
      sortOrder: (status === 'COMPLETED' ? 'desc' : 'asc') as 'asc' | 'desc',
      limit: 50,
      collapseDuplicateDisplay: true,
    });
    try {
      const [upcomingRes, ongoingRes, completedRes, meRes] = await Promise.all([
        eventsService.getAll(params('UPCOMING')),
        eventsService.getAll(params('ONGOING')),
        eventsService.getAll(params('COMPLETED')),
        attendanceService.getMe(),
      ]);
      const toList = (r: typeof upcomingRes) =>
        r.success && r.data?.data && Array.isArray(r.data.data) ? r.data.data : [];
      const upcoming = toList(upcomingRes);
      const ongoing = toList(ongoingRes);
      const completed = toList(completedRes);
      const attendances: Attendance[] = meRes?.success && Array.isArray(meRes.data) ? meRes.data : [];
      setMyAttendances(attendances);

      const seen = new Set<string>();
      const all = [...upcoming, ...ongoing, ...completed].filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      const now = new Date();
      const mainList = all.filter((e) => isRelevantForCheckIn(e, now));
      const sorted = sortEventsNearestFirst(mainList, now);
      const checkedInIds = new Set(attendances.map((a) => a.eventId));
      const reSorted = [
        ...sorted.filter((e) => !checkedInIds.has(e.id)),
        ...sorted.filter((e) => checkedInIds.has(e.id)),
      ];
      setEventList(reSorted);

      const eventId = searchParams.get('eventId');
      if (eventId && reSorted.some((e) => e.id === eventId)) {
        setSelectedEventId(eventId);
      } else if (reSorted.length > 0) {
        setSelectedEventId((prev) => (prev && reSorted.some((e) => e.id === prev) ? prev : reSorted[0].id));
      }
    } catch (err) {
      toast.error('Could not load events', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoadingEvents(false);
    }
  }, [searchParams]);

  const loadPastEvents = useCallback(async () => {
    if (pastEventsLoaded) return;
    setPastEventsLoaded(true);
    try {
      const res = await eventsService.getAll({
        status: 'COMPLETED',
        sortBy: 'startDate',
        sortOrder: 'desc',
        limit: 30,
        collapseDuplicateDisplay: true,
      });
      const list = res.success && res.data?.data && Array.isArray(res.data.data) ? res.data.data : [];
      const past = list.filter((e) => isPastEventCategory(e.category)).slice(0, 10);
      setPastEvents(past);
    } catch {
      setPastEvents([]);
    }
  }, [pastEventsLoaded]);

  const checkRegistrationStatus = useCallback(
    async (eventId: string, memberId: string) => {
      try {
        const result = await registrationsService.getRegistrations(eventId, {});
        if (result.success && result.data?.data) {
          const memberRegistration = result.data.data.find(
            (reg: EventRegistration) => reg.memberId === memberId
          );
          if (memberRegistration) {
            setIsRegistered(true);
            setRegistration(memberRegistration);
            return;
          }
        }
        setIsRegistered(false);
        setRegistration(null);
      } catch {
        setIsRegistered(false);
        setRegistration(null);
      }
    },
    []
  );

  const checkCheckInStatus = useCallback(async (eventId: string, memberId: string) => {
    try {
      const result = await attendanceService.getByEvent(eventId);
      if (result.success && result.data) {
        const attendance = result.data.find((a: { memberId: string }) => a.memberId === memberId);
        setIsCheckedIn(!!attendance);
      } else {
        setIsCheckedIn(false);
      }
    } catch {
      setIsCheckedIn(false);
    }
  }, []);

  const loadEvent = useCallback(
    async (eventId: string) => {
      try {
        setLoading(true);
        setIsRegistered(false);
        setRegistration(null);
        setIsCheckedIn(false);
        const result = await eventsService.getById(eventId);
        if (!result.success || !result.data) {
          toast.error('Event not found');
          return;
        }
        const loaded = result.data;
        setEvent(loaded);
        setEventList((prev) => {
          if (prev.some((e) => e.id === loaded.id)) return prev;
          return [loaded, ...prev];
        });
        let member = currentMember;
        if (!member?.id) {
          const memberResult = await membersService.getMe();
          if (memberResult?.id) {
            setCurrentMember(memberResult);
            member = memberResult;
          }
        }
        if (member?.id) {
          await checkRegistrationStatus(eventId, member.id);
          await checkCheckInStatus(eventId, member.id);
        }
      } catch (e) {
        toast.error('Failed to load event', {
          description: e instanceof Error ? e.message : 'Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [currentMember?.id, checkRegistrationStatus, checkCheckInStatus]
  );

  useEffect(() => {
    const loadMember = async () => {
      try {
        const memberResult = await membersService.getMe();
        if (memberResult) setCurrentMember(memberResult);
      } catch {
        // If not logged in, check for remembered member
        const remembered = deviceMemory.getRememberedMember();
        if (remembered) {
          setRememberedMember(remembered);
          // Use remembered member as current member for check-in
          setCurrentMember({
            id: remembered.memberId,
            communityId: remembered.communityId,
            firstName: '', // Will be filled from remembered data
            lastName: '',
            nickname: null,
          });
        }
      }
    };
    loadMember();
    loadEventList();
    checkCameraAvailability();
  }, [router, loadEventList]);

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (eventId) {
      setSelectedEventId(eventId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedEventId && eventList.length > 0) {
      loadEvent(selectedEventId);
    } else {
      setEvent(null);
      setIsRegistered(false);
      setRegistration(null);
      setIsCheckedIn(false);
    }
  }, [selectedEventId, eventList.length]);

  const checkCameraAvailability = async () => {
    try {
      const available = await QRScanner.isCameraAvailable();
      setCameraAvailable(available);
    } catch {
      setCameraAvailable(false);
    }
  };

  const startQRScanner = async () => {
    if (!cameraAvailable) {
      toast.error('Camera not available. Please enable camera permissions.');
      return;
    }
    setIsScanning(true);
    await new Promise((r) => setTimeout(r, 100));
    const el = document.getElementById(qrCodeRegionId);
    if (!el) {
      setIsScanning(false);
      toast.error('Scanner could not start. Try again.');
      return;
    }
    try {
      scannerRef.current = new QRScanner(qrCodeRegionId, handleQRScanSuccess, handleQRScanError, {
        continuousMode: true,
        fps: 10,
      });
      await scannerRef.current.start();
    } catch (err) {
      setIsScanning(false);
      toast.error(err instanceof Error ? err.message : 'Could not start camera');
    }
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      const eventData = qrUtils.extractEventData(decodedText);
      if (eventData?.eventId) {
        await stopQRScanner();
        setSelectedEventId(eventData.eventId);
        if (!eventList.some((e) => e.id === eventData.eventId)) {
          await loadEventList();
        }
        await loadEvent(eventData.eventId);
        
        // Auto check-in: signed-in member scans event QR and checks in automatically
        // Wait a bit for loadEvent to complete and update state
        setTimeout(() => {
          handleSelfCheckIn();
        }, 300);
        return;
      }
      toast.error('Please scan a valid event QR code.');
    } catch {
      toast.error('Invalid QR code.');
    }
  };

  const handleQRScanError = () => {}

  const handleSelfCheckIn = async () => {
    if (!event || !currentMember?.id) {
      toast.error('Event or member information is missing.');
      return;
    }
    if (isCheckedIn) {
      toast.info('You are already checked in.');
      return;
    }
    if (event.hasRegistration && !isRegistered) {
      setShowRegistrationDialog(true);
      return;
    }
    setLoading(true);
    try {
      const result = await attendanceService.checkIn({
        communityId: currentMember.communityId,
        eventId: event.id,
        method: 'QR_CODE',
      });
      if (result.success && result.data) {
        setIsCheckedIn(true);
        setMyAttendances((prev) => [result.data as Attendance, ...prev]);
        await loadEventList();
        setCheckInResult({
          kind: 'success',
          name: currentMember.nickname
            ? `${currentMember.nickname} ${currentMember.lastName}`
            : `${currentMember.firstName} ${currentMember.lastName}`.trim(),
          communityId: currentMember.communityId,
          message: 'Checked in',
        });
        toast.success('You’re checked in!');
      }
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response
          ? (err.response as { data?: { code?: string; canonicalEvent?: { id: string; title?: string; startTime?: string | null; venue?: string | null }; message?: string | string[] } }).data
          : undefined;
      if (data?.code === 'DUPLICATE_EVENT_CANONICAL' && data.canonicalEvent?.id) {
        const canonical = data.canonicalEvent;
        const proceed = window.confirm(
          `This event appears to be a duplicate slot.\n\nCheck in to canonical event instead?\n\n${canonical.title || 'Canonical event'}\n${canonical.startTime || ''} ${canonical.venue ? `@ ${canonical.venue}` : ''}`
        );
        if (proceed) {
          setSelectedEventId(canonical.id);
          const retry = await attendanceService.checkIn({
            communityId: currentMember.communityId,
            eventId: canonical.id,
            method: 'QR_CODE',
          });
          if (retry.success && retry.data) {
            setIsCheckedIn(true);
            setMyAttendances((prev) => [retry.data as Attendance, ...prev]);
            await loadEventList();
            setCheckInResult({
              kind: 'success',
              name: currentMember.nickname
                ? `${currentMember.nickname} ${currentMember.lastName}`
                : `${currentMember.firstName} ${currentMember.lastName}`.trim(),
              communityId: currentMember.communityId,
              message: 'Checked in',
            });
            toast.success('You’re checked in!');
            return;
          }
        }
      }
      const str = getErrorMessage(err, 'Check-in failed.');
      setCheckInResult(resultFromCheckInError(str, undefined, currentMember.communityId));
      toast.error(str);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!event || !currentMember) {
      toast.error('Missing information.');
      return;
    }
    if (isRegistered) {
      setShowRegistrationDialog(false);
      return;
    }
    setLoading(true);
    try {
      const result = await registrationsService.registerMember(event.id, {
        memberCommunityId: currentMember.communityId,
        lastName: currentMember.lastName,
        firstName: currentMember.firstName,
        middleName: currentMember.middleName ?? undefined,
        nickname: currentMember.nickname ?? undefined,
      });
      if (result.success && result.data) {
        setIsRegistered(true);
        setRegistration(result.data);
        setShowRegistrationDialog(false);
        toast.success('Registered. You can check in now.');
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response
          ? (err.response as { data?: { message?: string | string[] } }).data?.message
          : null;
      const str = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Registration failed.';
      toast.error(str);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const canCheckIn =
    event &&
    currentMember &&
    !isCheckedIn &&
    event.status !== 'CANCELLED' &&
    canCheckInToEvent(event);

  const qrMember = currentMember?.communityId
    ? {
        firstName: currentMember.firstName || rememberedMember?.displayName || '',
        lastName: currentMember.lastName,
        nickname: currentMember.nickname,
        communityId: currentMember.communityId,
      }
    : rememberedMember
      ? {
          firstName: rememberedMember.displayName,
          lastName: '',
          communityId: rememberedMember.communityId,
        }
      : null;

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader />
      <div className="checkin-screen p-4 md:p-6 max-w-xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 min-h-12 min-w-12 text-[1.125rem] font-semibold text-gray-900"
          onClick={() => router.push('/dashboard')}
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6 mr-1" />
          Back
        </Button>

        <h1 className="hidden md:block text-[1.875rem] font-bold text-gray-900 mb-4">Self Check-In</h1>

        {rememberedMember && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border-2 border-blue-700">
            <p className="text-[1.125rem] font-medium text-blue-950 text-center">
              {deviceMemory.getDisplayText()}
              {' · '}
              <button
                type="button"
                onClick={() => {
                  deviceMemory.clearRememberedMember();
                  setRememberedMember(null);
                  toast.success('Device cleared', {
                    description: 'This phone no longer remembers your identity. Please log in.',
                  });
                  router.push('/login');
                }}
                className="underline font-semibold text-blue-950"
              >
                Not you?
              </button>
            </p>
          </div>
        )}

        {loadingEvents ? (
          <CheckInLoadingState label="Loading events…" />
        ) : eventList.length > 0 && !event ? (
          <CheckInLoadingState label="Loading event…" />
        ) : qrMember ? (
          <MemberIdQrPanel
            member={qrMember}
            event={event}
            alreadyCheckedIn={isCheckedIn}
            onPrimaryAction={handleSelfCheckIn}
            primaryLabel={event?.hasRegistration && !isRegistered ? 'Register & Check In' : 'Check In'}
            primaryBusy={loading}
            primaryDisabled={!canCheckIn}
          />
        ) : (
          <p className="rounded-xl border-2 border-gray-400 bg-white p-5 text-center text-[1.125rem] font-medium text-gray-900">
            Sign in to see your QR code and check in.
          </p>
        )}

        {event?.hasRegistration && !isRegistered && !isCheckedIn && (
          <p className="mt-4 text-[1.125rem] font-medium text-amber-950 bg-amber-50 py-3 px-3 rounded-xl text-center border-2 border-amber-700">
            This event requires registration. Tap Register & Check In.
          </p>
        )}

        {!event && !loadingEvents && (
          <p className="mt-4 text-center text-[1.125rem] font-medium text-gray-900">
            No events right now. Open More options to pick a past event.
          </p>
        )}

        <MoreOptions className="mt-6">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-12 text-[1.125rem] font-semibold text-gray-900 hover:bg-gray-100"
              onClick={() => setShowEventPicker(!showEventPicker)}
            >
              {showEventPicker ? 'Hide other events' : 'Need a different event?'}
            </Button>
            {showEventPicker && (
              <div className="mt-3 space-y-3">
                {eventList.length > 0 && (
                  <div>
                    <label className="block text-[1.125rem] font-semibold text-gray-900 mb-2">Choose an event</label>
                    <Select
                      value={selectedEventId || undefined}
                      onValueChange={(v) => {
                        setSelectedEventId(v);
                        const fromPast = pastEvents.find((e) => e.id === v);
                        if (fromPast) {
                          setEventList((prev) => (prev.some((e) => e.id === v) ? prev : [fromPast, ...prev]));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full min-h-12 text-[1.125rem]">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventList.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="text-[1.125rem] py-3">
                            {e.title} — {formatEventDateManila(e.startDate)}
                            {isOngoingForDisplay(e) ? ' · Ongoing' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="block text-[1.125rem] font-semibold text-gray-900 mb-2">Past events</label>
                  <Select
                    onOpenChange={(open) => open && loadPastEvents()}
                    value={pastSelectValue || undefined}
                    onValueChange={(v) => {
                      if (v && v !== '_none') {
                        setSelectedEventId(v);
                        const fromPast = pastEvents.find((e) => e.id === v);
                        if (fromPast) {
                          setEventList((prev) => (prev.some((e) => e.id === v) ? prev : [fromPast, ...prev]));
                        }
                        setPastSelectValue('');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full min-h-12 text-[1.125rem] text-gray-900">
                      <SelectValue placeholder="Community Worship / Word Sharing Circle" />
                    </SelectTrigger>
                    <SelectContent>
                      {pastEvents.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-[1.125rem] py-3">
                          {e.title} — {formatEventDateManila(e.startDate)}
                        </SelectItem>
                      ))}
                      {pastEventsLoaded && pastEvents.length === 0 && (
                        <SelectItem value="_none" disabled>No past events found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full min-h-12 text-[1.125rem] font-semibold border-2 border-gray-500"
            onClick={isScanning ? stopQRScanner : startQRScanner}
            disabled={!cameraAvailable}
          >
            {isScanning ? (
              <>
                <X className="w-5 h-5 mr-2" />
                Stop scanner
              </>
            ) : (
              <>
                <Camera className="w-5 h-5 mr-2" />
                Scan QR
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-12 text-[1.125rem] font-semibold border-2 border-gray-500"
            onClick={() => checkInChatbotRef.current?.open()}
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Get help
          </Button>

          {myAttendances.length > 0 && (
            <div>
              <h2 className="text-[1.25rem] font-bold text-gray-900 mb-3">Already checked in</h2>
              <ul className="space-y-2">
                {myAttendances.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl bg-green-50 border-2 border-green-800 text-gray-900"
                  >
                    <CheckCircle className="w-5 h-5 shrink-0 text-green-800" />
                    <span className="font-semibold text-[1.125rem]">{a.event?.title ?? 'Event'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </MoreOptions>

        {isScanning && (
          <Card className="mt-6 bg-white border-2 border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-[1.375rem] flex items-center gap-2 text-gray-900">
                <QrCode className="w-6 h-6 text-rose-800" />
                Point your camera at the event QR code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div id={qrCodeRegionId} className="w-full min-h-[260px] rounded-xl overflow-hidden bg-black" />
              <p className="text-[1.125rem] font-medium text-gray-900 mt-3">Hold the QR code in front of your camera.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Registration dialog */}
      <Dialog open={showRegistrationDialog} onOpenChange={setShowRegistrationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Register for this event</DialogTitle>
            <DialogDescription className="text-base">
              {event?.title} — {event ? formatDate(event.startDate) : ''}
            </DialogDescription>
          </DialogHeader>
          {event?.hasRegistration && event.registrationFee != null && Number(event.registrationFee) > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg text-base text-gray-700">
              <span className="font-semibold">Fee:</span> ₱{Number(event.registrationFee).toFixed(2)}
            </div>
          )}
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 min-h-[52px] text-base font-medium"
              onClick={() => setShowRegistrationDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 min-h-[52px] text-base font-semibold bg-blue-600 hover:bg-blue-700"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering…
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CheckInChatbot
        ref={checkInChatbotRef}
        onCheckInSuccess={() => {
          if (selectedEventId) {
            loadEvent(selectedEventId);
          }
        }}
      />
      <CheckInResultOverlay result={checkInResult} onDismiss={() => setCheckInResult(null)} />
    </div>
  );
}

export default function SelfCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <SelfCheckInContent />
    </Suspense>
  );
}

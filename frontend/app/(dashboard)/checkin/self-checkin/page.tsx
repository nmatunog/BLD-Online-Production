'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  QrCode,
  CheckCircle,
  X,
  Camera,
  AlertCircle,
  Loader2,
  UserCheck,
  ArrowLeft,
  LogIn,
  MessageSquare,
} from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { registrationsService, type EventRegistration } from '@/services/registrations.service';
import { membersService } from '@/services/members.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CheckInChatbot, { type CheckInChatbotHandle } from '@/components/chatbot/CheckInChatbot';
import {
  isInCheckInWindow,
  isOngoingForDisplay,
  isCompletedPastWindow,
  isWithin7DaysOfEnd,
  canCheckInToEvent,
  sortEventsForCheckIn,
  isPastEventCategory,
} from '@/lib/event-checkin-window';

const qrCodeRegionId = 'qr-reader-self';

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

  const loadEventList = useCallback(async () => {
    setLoadingEvents(true);
    const params = (status: 'UPCOMING' | 'ONGOING' | 'COMPLETED') => ({
      status,
      sortBy: 'startDate' as const,
      sortOrder: (status === 'COMPLETED' ? 'desc' : 'asc') as 'asc' | 'desc',
      limit: 50,
    });
    try {
      const [upcomingRes, ongoingRes, completedRes] = await Promise.all([
        eventsService.getAll(params('UPCOMING')),
        eventsService.getAll(params('ONGOING')),
        eventsService.getAll(params('COMPLETED')),
      ]);
      const toList = (r: typeof upcomingRes) =>
        r.success && r.data?.data && Array.isArray(r.data.data) ? r.data.data : [];
      const upcoming = toList(upcomingRes);
      const ongoing = toList(ongoingRes);
      const completed = toList(completedRes);

      const seen = new Set<string>();
      const all = [...upcoming, ...ongoing, ...completed].filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      const now = new Date();
      // Show: in check-in window (ongoing) OR completed recurring within 7 days
      const mainList = all.filter(
        (e) =>
          isInCheckInWindow(e, now) ||
          (isCompletedPastWindow(e, now) && e.isRecurring && isWithin7DaysOfEnd(e, now))
      );
      const sorted = sortEventsForCheckIn(mainList, now);
      setEventList(sorted);

      const eventId = searchParams.get('eventId');
      if (eventId && sorted.some((e) => e.id === eventId)) {
        setSelectedEventId(eventId);
      } else if (sorted.length > 0 && !selectedEventId) {
        setSelectedEventId(sorted[0].id);
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
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }
    const loadMember = async () => {
      try {
        const memberResult = await membersService.getMe();
        if (memberResult) setCurrentMember(memberResult);
      } catch {
        // ignore
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
        toast.success('Event selected. You can check in below.');
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
      if (result.success) {
        setIsCheckedIn(true);
        toast.success('You’re checked in!');
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response
          ? (err.response as { data?: { message?: string | string[] } }).data?.message
          : null;
      const str = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Check-in failed.';
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

  const formatTime = (timeString: string) => {
    try {
      const [h, m] = timeString.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${m} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const canCheckIn =
    event &&
    currentMember &&
    !isCheckedIn &&
    event.status !== 'CANCELLED' &&
    canCheckInToEvent(event);

  if (!authService.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-2 border-gray-200">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-14 h-14 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Sign in required</h2>
            <p className="text-lg text-gray-600 mb-6">Log in to check in or register for events.</p>
            <Button
              onClick={() => router.push('/login')}
              className="min-h-[56px] px-6 text-lg font-semibold bg-purple-600 hover:bg-purple-700"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader />
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        {/* Back: large tap target */}
        <Button
          variant="ghost"
          className="mb-4 min-h-[48px] min-w-[48px] text-lg text-gray-700"
          onClick={() => router.push('/dashboard')}
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6 mr-1" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">Self Check-In</h1>
        <p className="text-lg text-gray-600 mb-6">Tap the green button to check in for today&apos;s event.</p>

        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="p-6 space-y-6">
            {loadingEvents ? (
              <div className="flex items-center justify-center gap-3 py-8 text-gray-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-lg">Loading events…</span>
              </div>
            ) : !event && eventList.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-lg text-gray-600">No events right now.</p>
                <p className="text-base text-gray-500 mt-2">Tap &quot;Need a different event?&quot; below to see past events.</p>
              </div>
            ) : eventList.length > 0 && !event ? (
              <div className="flex items-center justify-center gap-3 py-8 text-gray-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-lg">Loading event…</span>
              </div>
            ) : event ? (
              <>
                {/* Event name: large, clear */}
                <div className="text-center">
                  <p className="text-xl font-semibold text-gray-900 leading-tight">{event.title}</p>
                  <p className="text-base text-gray-600 mt-1">
                    {formatDate(event.startDate)}
                    {event.startTime ? ` at ${formatTime(event.startTime)}` : ''}
                  </p>
                </div>

                {/* One primary action: big Check In or You're checked in */}
                {loading ? (
                  <div className="flex items-center justify-center gap-3 py-6 text-gray-600">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-lg">Loading…</span>
                  </div>
                ) : isCheckedIn ? (
                  <div
                    className="flex items-center justify-center gap-3 w-full min-h-[72px] py-4 px-6 rounded-xl bg-green-600 text-white text-xl font-semibold border-2 border-green-700 shadow-md"
                    aria-live="polite"
                  >
                    <CheckCircle className="w-8 h-8 shrink-0" />
                    You are checked in!
                  </div>
                ) : (
                  <>
                    {event.hasRegistration && !isRegistered && (
                      <p className="text-base text-amber-800 bg-amber-50 py-2 px-3 rounded-lg text-center">
                        This event requires registration. Tap the button below to register and check in.
                      </p>
                    )}
                    <Button
                      onClick={handleSelfCheckIn}
                      disabled={!canCheckIn || loading}
                      className="w-full min-h-[72px] py-4 text-xl font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl border-2 border-green-700 shadow-md disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                          Checking in…
                        </>
                      ) : event.hasRegistration && !isRegistered ? (
                        <>
                          <UserCheck className="w-6 h-6 mr-2" />
                          Register & Check In
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-6 h-6 mr-2" />
                          Check In
                        </>
                      )}
                    </Button>
                  </>
                )}
              </>
            ) : null}

            {/* Need a different event? — collapsed by default to reduce choices */}
            <div className="border-t border-gray-200 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="w-full min-h-[48px] text-base font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => setShowEventPicker(!showEventPicker)}
              >
                {showEventPicker ? 'Hide other events' : 'Need a different event?'}
              </Button>
              {showEventPicker && (
                <div className="mt-3 space-y-3 pl-0">
                  {eventList.length > 0 && (
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">Choose an event</label>
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
                        <SelectTrigger className="w-full min-h-[48px] text-base">
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventList.map((e) => (
                            <SelectItem key={e.id} value={e.id} className="text-base py-3">
                              {e.title} — {formatDate(e.startDate)}
                              {isOngoingForDisplay(e) ? ' · Ongoing' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">Past events</label>
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
                      <SelectTrigger className="w-full min-h-[48px] text-base text-gray-600">
                        <SelectValue placeholder="Community Worship / Word Sharing Circle" />
                      </SelectTrigger>
                      <SelectContent>
                        {pastEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="text-base py-3">
                            {e.title} — {formatDate(e.startDate)}
                          </SelectItem>
                        ))}
                        {pastEventsLoaded && pastEvents.length === 0 && (
                          <SelectItem value="_none" disabled>No past events found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {eventList.length === 0 && !pastEvents.length && (
                    <p className="text-base text-gray-500">No other events right now.</p>
                  )}
                </div>
              )}
            </div>

            {/* Secondary: Scan QR + Get help — large tap targets, visually lighter */}
            <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[52px] text-base border-2"
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
                    Scan QR code instead
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[52px] text-base border-2"
                onClick={() => checkInChatbotRef.current?.open()}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Get help
              </Button>
            </div>
          </CardContent>
        </Card>

        {isScanning && (
          <Card className="mt-6 bg-white border-2 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <QrCode className="w-6 h-6 text-purple-600" />
                Point your camera at the event QR code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div id={qrCodeRegionId} className="w-full min-h-[260px] rounded-xl overflow-hidden bg-black" />
              <p className="text-base text-gray-600 mt-3">Hold the QR code in front of your camera.</p>
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

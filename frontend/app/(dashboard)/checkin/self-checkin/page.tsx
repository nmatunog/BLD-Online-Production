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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ChatbotSignUp, { type ChatbotSignUpHandle } from '@/components/chatbot/ChatbotSignUp';

const qrCodeRegionId = 'qr-reader-self';

function SelfCheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatbotRef = useRef<ChatbotSignUpHandle>(null);
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

  const loadEventList = useCallback(async () => {
    setLoadingEvents(true);
    const params = (status: 'ONGOING' | 'COMPLETED') => ({
      status,
      sortBy: 'startDate' as const,
      sortOrder: (status === 'COMPLETED' ? 'desc' : 'asc') as 'asc' | 'desc',
      limit: 50,
    });
    try {
      const [ongoingResult, completedResult] = await Promise.all([
        eventsService.getAll(params('ONGOING')),
        eventsService.getAll(params('COMPLETED')),
      ]);
      const ongoingList =
        ongoingResult.success && ongoingResult.data?.data
          ? Array.isArray(ongoingResult.data.data) ? ongoingResult.data.data : []
          : [];
      const completedList =
        completedResult.success && completedResult.data?.data
          ? (Array.isArray(completedResult.data.data) ? completedResult.data.data : []).filter(
              (e: Event) => e.isRecurring === true
            )
          : [];
      const seen = new Set<string>();
      const merged = [...ongoingList, ...completedList].filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      merged.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setEventList(merged);

      const eventId = searchParams.get('eventId');
      if (eventId && merged.some((e) => e.id === eventId)) {
        setSelectedEventId(eventId);
      } else if (merged.length > 0 && !selectedEventId) {
        setSelectedEventId(merged[0].id);
      }
    } catch (err) {
      toast.error('Could not load events', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoadingEvents(false);
    }
  }, [searchParams]);

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
    (event.status === 'ONGOING' || (event.status === 'COMPLETED' && event.isRecurring));

  if (!authService.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2 text-gray-800">Sign in required</h2>
            <p className="text-gray-600 mb-4">Log in to check in or register for events.</p>
            <Button onClick={() => router.push('/login')} className="bg-purple-600 hover:bg-purple-700">
              <LogIn className="w-4 h-4 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/checkin')} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Self Check-In</h1>
            <p className="text-sm text-gray-500">Choose an event and check in, or scan the event QR.</p>
          </div>
        </div>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            {/* Event dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Which event?</label>
              {loadingEvents ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading events…
                </div>
              ) : eventList.length === 0 ? (
                <p className="text-sm text-gray-500">No ongoing or recent recurring events.</p>
              ) : (
                <Select
                  value={selectedEventId || undefined}
                  onValueChange={(v) => setSelectedEventId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventList.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} — {formatDate(e.startDate)}
                        {e.status === 'ONGOING' ? ' · Ongoing' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Event summary + Check-in */}
            {event && (
              <div className="rounded-lg bg-gray-50 p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{event.title}</span>
                  <span>{formatDate(event.startDate)}</span>
                  {event.startTime && <span>{formatTime(event.startTime)}</span>}
                  <Badge
                    variant={event.status === 'ONGOING' ? 'default' : 'secondary'}
                    className={event.status === 'ONGOING' ? 'bg-green-600' : ''}
                  >
                    {event.status}
                  </Badge>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    {event.hasRegistration && !isRegistered && (
                      <p className="text-sm text-amber-700">
                        This event requires registration. Register below, then check in.
                      </p>
                    )}
                    {isCheckedIn ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <span className="font-medium">You’re checked in</span>
                      </div>
                    ) : (
                      <Button
                        onClick={handleSelfCheckIn}
                        disabled={!canCheckIn || loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="lg"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Checking in…
                          </>
                        ) : event.hasRegistration && !isRegistered ? (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Register & Check In
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Check In
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Actions: AI Assistant + QR */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => chatbotRef.current?.open('signup')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                AI Assistant
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={isScanning ? stopQRScanner : startQRScanner}
                disabled={!cameraAvailable}
              >
                {isScanning ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Stop scanner
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Check in via QR
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR scanner area */}
        {isScanning && (
          <Card className="mt-4 bg-white border border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-5 h-5 text-purple-600" />
                Scan event QR code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div id={qrCodeRegionId} className="w-full min-h-[240px] rounded-lg overflow-hidden bg-black" />
              <p className="text-sm text-gray-500 mt-2">Point your camera at the event QR code.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Registration dialog */}
      <Dialog open={showRegistrationDialog} onOpenChange={setShowRegistrationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register for this event</DialogTitle>
            <DialogDescription>
              {event?.title} — {event ? formatDate(event.startDate) : ''}
            </DialogDescription>
          </DialogHeader>
          {event?.hasRegistration && event.registrationFee != null && Number(event.registrationFee) > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-gray-700">
              <span className="font-medium">Fee:</span> ₱{Number(event.registrationFee).toFixed(2)}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowRegistrationDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleRegister} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registering…
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ChatbotSignUp ref={chatbotRef} />
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

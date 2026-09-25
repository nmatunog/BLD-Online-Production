'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  CheckCircle, 
  UserCheck,
  ArrowLeft,
  LogIn,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { type Event } from '@/services/events.service';
import { apiClient } from '@/services/api-client';
import { type ApiResponse } from '@/types/api.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { qrUtils } from '@/lib/qr-scanner-service';
import { deviceMemory } from '@/lib/device-memory';
import { EventHeader, QRScannerCard, ManualCheckInCard, CheckInResultOverlay, MoreOptions } from '@/components/checkin';
import { getErrorMessage } from '@/lib/get-error-message';
import { resultFromCheckInError, type CheckInResultState } from '@/lib/checkin-ux';

export default function PublicCheckInPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string;
  
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [rememberedMember, setRememberedMember] = useState<ReturnType<typeof deviceMemory.getRememberedMember>>(null);
  const [checkInMode, setCheckInMode] = useState<'choose' | 'self' | 'staff'>('choose');
  const [autoCheckInAttempted, setAutoCheckInAttempted] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResultState | null>(null);

  useEffect(() => {
    if (eventId) {
      loadEvent(eventId);
    }
    
    const remembered = deviceMemory.getRememberedMember();
    setRememberedMember(remembered);
    
    if (!remembered) {
      setCheckInMode('staff');
    } else if (deviceMemory.isStaffOrAdmin()) {
      setCheckInMode('choose');
    } else {
      setCheckInMode('self');
    }
  }, [eventId]);

  useEffect(() => {
    if (checkInMode === 'self' && rememberedMember && event && !isCheckedIn && !loading && !autoCheckInAttempted) {
      setAutoCheckInAttempted(true);
      setTimeout(() => {
        handleSelfCheckIn();
      }, 500);
    }
  }, [checkInMode, rememberedMember, event, isCheckedIn, loading, autoCheckInAttempted]);

  const loadEvent = async (eventId: string) => {
    try {
      setLoading(true);
      // Use public endpoint for unauthenticated access
      const response = await apiClient.get<ApiResponse<Event>>(`/events/public/${eventId}`);
      if (response.data.success && response.data.data) {
        setEvent(response.data.data);
      } else {
        toast.error('Event Not Found', {
          description: 'The event you are trying to access does not exist.',
        });
      }
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Failed to Load Event', {
        description: error instanceof Error ? error.message : 'Could not load event details',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      const memberData = qrUtils.extractMemberData(decodedText);
      if (memberData && memberData.communityId) {
        await performCheckIn(memberData.communityId);
        return;
      }
      toast.error('Invalid QR Code', {
        description: 'Please scan a valid member QR code',
      });
    } catch (error) {
      toast.error('Scan Failed', {
        description: error instanceof Error ? error.message : 'Failed to process QR code',
      });
    }
  };

  const performCheckIn = async (communityId: string) => {
    if (!event) {
      toast.error('Event not loaded');
      return;
    }

    if (!communityId || !communityId.trim()) {
      toast.error('Invalid Community ID');
      return;
    }

    const normalizedId = communityId.trim().toUpperCase();
    setLoading(true);

    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/attendance/public/check-in', {
        communityId: normalizedId,
        eventId: event.id,
      });

      if (response.data.success) {
        setIsCheckedIn(true);
        setCheckInResult({
          kind: 'success',
          name: rememberedMember?.displayName,
          communityId: normalizedId,
          message: 'Checked in',
        });
        toast.success('✅ Check-in Successful!', {
          description: 'Member has been checked in',
          duration: 3000,
        });
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to check in');
      setCheckInResult(resultFromCheckInError(errorMessage, rememberedMember?.displayName, normalizedId));
      toast.error('Check-in Failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelfCheckIn = async () => {
    if (!event || !rememberedMember) {
      toast.error('Missing Information');
      return;
    }

    if (isCheckedIn) {
      toast.info('Already Checked In');
      return;
    }

    await performCheckIn(rememberedMember.communityId);
  };

  if (loading && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Event Not Found</h2>
            <p className="text-gray-600 mb-4">The event you are trying to access does not exist.</p>
            <Button onClick={() => router.push('/login')} variant="outline">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[1.75rem] font-bold text-gray-900">Event Check-In</h1>
            {checkInMode !== 'staff' && (
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
                className="min-h-12 text-[1.125rem] font-semibold text-gray-900"
              >
                <LogIn className="w-5 h-5 mr-1" />
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="checkin-screen p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-6 md:max-w-4xl">
          {/* Event Header */}
          <EventHeader
            title={event.title}
            startDate={event.startDate}
            startTime={event.startTime}
            location={event.location}
          />
          {/* Mode Selection: Choose / Self / Staff */}
          {checkInMode === 'choose' && rememberedMember && (
            <Card className="bg-white border-blue-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Choose Your Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[1.125rem] font-medium text-gray-900 mb-2">
                  {deviceMemory.getDisplayText()}
                </p>
                
                <Button
                  onClick={() => {
                    setCheckInMode('self');
                    setTimeout(() => handleSelfCheckIn(), 100);
                  }}
                  className="w-full min-h-14 bg-green-700 hover:bg-green-800 text-white text-[1.25rem] font-semibold"
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  Check in as {rememberedMember.displayName}
                </Button>
                
                <Button
                  onClick={() => setCheckInMode('staff')}
                  variant="outline"
                  className="w-full min-h-14 border-2 border-gray-500 text-[1.125rem] font-semibold text-gray-900"
                >
                  I&apos;m staff — scan members
                </Button>
                
                {/* Quiet: Not you? */}
                <button
                  type="button"
                  onClick={() => {
                    deviceMemory.clearRememberedMember();
                    setRememberedMember(null);
                    setCheckInMode('staff');
                    toast.success('Device cleared');
                  }}
                  className="w-full text-sm text-blue-700 underline hover:text-blue-900 py-2 min-h-[44px]"
                >
                  Not you?
                </button>
              </CardContent>
            </Card>
          )}

          {/* Self check-in result for remembered member */}
          {checkInMode === 'self' && rememberedMember && (
            <>
              <Card className="bg-white border-green-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Check-In Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {isCheckedIn ? (
                    <div className="flex items-center gap-3 text-green-800" aria-live="polite" role="status">
                      <CheckCircle className="w-8 h-8" />
                      <div>
                        <p className="text-[1.375rem] font-bold text-gray-900">Checked in</p>
                        <p className="text-[1.125rem] font-medium text-gray-900">
                          {rememberedMember.displayName}
                        </p>
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-rose-800" />
                      <span className="text-[1.125rem] font-medium text-gray-900">Checking in…</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[1.375rem] font-bold text-gray-900">Ready to check in</p>
                      <p className="text-[1.125rem] font-medium text-gray-900">Checking in as {rememberedMember.displayName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                onClick={() => {
                  setCheckInMode('choose');
                  setIsCheckedIn(false);
                }}
                variant="outline"
                className="w-full min-h-[48px]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Options
              </Button>
            </>
          )}

          {/* Staff scanner mode: simplified with shared components */}
          {checkInMode === 'staff' && (
            <>
              {/* Prominent Scanner (continuous default ON) */}
              <QRScannerCard
                onScanSuccess={handleQRScanSuccess}
                disabled={loading}
                qrCodeRegionId="qr-reader-public-staff"
              />

              <MoreOptions>
                <ManualCheckInCard
                  onCheckIn={performCheckIn}
                  loading={loading}
                  disabled={false}
                />
              </MoreOptions>
            </>
          )}

        </div>
      </div>
      <CheckInResultOverlay result={checkInResult} onDismiss={() => setCheckInResult(null)} />
    </div>
  );
}

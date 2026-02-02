'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  QrCode, 
  CheckCircle, 
  X, 
  Camera, 
  Calendar, 
  Clock, 
  MapPin,
  Users,
  AlertCircle,
  Loader2,
  UserCheck,
  ArrowLeft,
  LogIn
} from 'lucide-react';
import { attendanceService } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { registrationsService, type EventRegistration } from '@/services/registrations.service';
import { membersService } from '@/services/members.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function SelfCheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [currentMember, setCurrentMember] = useState<any>(null);
  const scannerRef = useRef<QRScanner | null>(null);
  const qrCodeRegionId = 'qr-reader-self';
  const [continuousMode, setContinuousMode] = useState(false);

  // Check authentication and load member data
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const loadMemberData = async () => {
      try {
        const authData = localStorage.getItem('authData');
        if (authData) {
          const parsed = JSON.parse(authData);
          setUserRole(parsed.user?.role || '');
          
          // Load current member profile
          if (parsed.user?.id) {
            try {
              const memberResult = await membersService.getMe();
              if (memberResult) {
                setCurrentMember(memberResult);
              }
            } catch (error) {
              console.error('Error loading member data:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    };

    loadMemberData();
    checkCameraAvailability();
    
    // Check for eventId in URL parameters
    const eventId = searchParams.get('eventId');
    if (eventId) {
      loadEvent(eventId);
    }
  }, [router, searchParams]);

  const checkCameraAvailability = async () => {
    try {
      const available = await QRScanner.isCameraAvailable();
      setCameraAvailable(available);
    } catch (error) {
      console.error('Camera check failed:', error);
      setCameraAvailable(false);
    }
  };

  const loadEvent = async (eventId: string) => {
    try {
      setLoading(true);
      const result = await eventsService.getById(eventId);
      if (result.success && result.data) {
        setEvent(result.data);
        
        // Ensure member data is loaded before checking status
        let memberId = currentMember?.id;
        if (!memberId) {
          try {
            const memberResult = await membersService.getMe();
            if (memberResult?.id) {
              setCurrentMember(memberResult);
              memberId = memberResult.id;
            }
          } catch (error) {
            console.error('Error loading member:', error);
          }
        }
        
        // Only check status if we have a member ID
        if (memberId) {
          await checkRegistrationStatus(eventId, memberId);
          await checkCheckInStatus(eventId, memberId);
        }
      } else {
        toast.error('Event Not Found', {
          description: 'The event you are trying to access does not exist.',
        });
        router.push('/events');
      }
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Failed to Load Event', {
        description: error instanceof Error ? error.message : 'Could not load event details',
      });
      router.push('/events');
    } finally {
      setLoading(false);
    }
  };

  const checkRegistrationStatus = async (eventId: string, memberId?: string) => {
    // Use provided memberId or current member
    const memberIdToUse = memberId || currentMember?.id;
    
    if (!memberIdToUse) {
      // No member ID available, skip check
      return;
    }
    
    try {
      const result = await registrationsService.getRegistrations(eventId, {});
      if (result.success && result.data?.data) {
        const memberRegistration = result.data.data.find(
          (reg: EventRegistration) => reg.memberId === memberIdToUse
        );
        if (memberRegistration) {
          setIsRegistered(true);
          setRegistration(memberRegistration);
        }
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const checkCheckInStatus = async (eventId: string, memberId?: string) => {
    // Use provided memberId or current member
    const memberIdToUse = memberId || currentMember?.id;
    
    if (!memberIdToUse) {
      // No member ID available, skip check
      return;
    }
    
    try {
      // Check if member is already checked in
      const result = await attendanceService.getByEvent(eventId);
      if (result.success && result.data) {
        const attendance = result.data.find((a: any) => a.memberId === memberIdToUse);
        if (attendance) {
          setIsCheckedIn(true);
        }
      }
    } catch (error) {
      console.error('Error checking check-in status:', error);
    }
  };

  const startQRScanner = async () => {
    if (!cameraAvailable) {
      toast.error('Camera Not Available', {
        description: 'Please enable camera permissions to scan QR codes',
      });
      return;
    }

    // Set scanning state first so the DOM element is rendered
    setIsScanning(true);

    // Wait for the DOM element to be available
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if element exists
    const element = document.getElementById(qrCodeRegionId);
    if (!element) {
      setIsScanning(false);
      toast.error('Scanner Element Not Found', {
        description: 'Please try again',
      });
      return;
    }

    try {
      scannerRef.current = new QRScanner(
        qrCodeRegionId,
        handleQRScanSuccess,
        handleQRScanError,
        {
          continuousMode,
          fps: 10,
        }
      );

      await scannerRef.current.start();
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      setIsScanning(false);
      toast.error('Failed to Start Scanner', {
        description: error instanceof Error ? error.message : 'Could not access camera',
      });
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
      // Extract event data from QR code
      const eventData = qrUtils.extractEventData(decodedText);
      
      if (eventData && eventData.eventId) {
        await stopQRScanner();
        await loadEvent(eventData.eventId);
        return;
      }

      toast.error('Invalid QR Code', {
        description: 'Please scan a valid event QR code',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      toast.error('Scan Failed', {
        description: errorMessage,
      });
    }
  };

  const handleQRScanError = (errorMessage: string) => {
    // Only log non-continuous scanning errors
    if (
      !errorMessage.includes('No barcode or QR code detected') &&
      !errorMessage.includes('No MultiFormat Readers were able to detect the code')
    ) {
      console.error('QR scan error:', errorMessage);
    }
  };

  const handleSelfCheckIn = async () => {
    if (!event || !currentMember?.id) {
      toast.error('Missing Information', {
        description: 'Event or member information is missing',
      });
      return;
    }

    if (isCheckedIn) {
      toast.info('Already Checked In', {
        description: 'You have already checked in to this event',
      });
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
        toast.success('✅ Check-in Successful!', {
          description: 'You have been successfully checked in to this event',
          duration: 5000,
        });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to check in';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
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

  const handleRegister = async () => {
    if (!event || !currentMember) {
      toast.error('Missing Information', {
        description: 'Event or member information is missing',
      });
      return;
    }

    if (isRegistered) {
      toast.info('Already Registered', {
        description: 'You are already registered for this event',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await registrationsService.registerMember(event.id, {
        memberCommunityId: currentMember.communityId,
        lastName: currentMember.lastName,
        firstName: currentMember.firstName,
        middleName: currentMember.middleName || undefined,
        nickname: currentMember.nickname || undefined,
      });

      if (result.success && result.data) {
        setIsRegistered(true);
        setRegistration(result.data);
        setShowRegistrationDialog(false);
        toast.success('Registration Successful!', {
          description: 'You have been successfully registered for this event',
          duration: 5000,
        });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to register';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (Array.isArray(errorData.message)) {
          errorMessage = errorData.message.join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error('Registration Failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string): string => {
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

  if (loading && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!authService.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to check in or register for events</p>
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
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/events')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Self Check-In & Registration</h1>
              <p className="text-gray-600 mt-1">Scan an event QR code to check in or register</p>
            </div>
          </div>

          {/* QR Scanner Section */}
          {!event && (
            <Card className="bg-white border-purple-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-6 h-6 text-purple-600" />
                  Scan Event QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isScanning ? (
                  <div className="text-center py-8">
                    <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-4">
                      Click the button below to start scanning an event QR code
                    </p>
                    <Button
                      onClick={startQRScanner}
                      disabled={!cameraAvailable}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      size="lg"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start Scanning
                    </Button>
                    {!cameraAvailable && (
                      <p className="text-sm text-red-600 mt-2">
                        Camera not available. Please enable camera permissions.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div id={qrCodeRegionId} className="w-full min-h-[300px]" />
                    <div className="flex gap-2">
                      <Button
                        onClick={stopQRScanner}
                        variant="outline"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Stop Scanning
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Event Details and Actions */}
          {event && (
            <div className="space-y-6">
              {/* Event Information Card */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-purple-800">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Date</p>
                        <p className="text-base font-semibold text-gray-900">{formatDate(event.startDate)}</p>
                      </div>
                    </div>
                    {event.startTime && (
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Time</p>
                          <p className="text-base font-semibold text-gray-900">{formatTime(event.startTime)}</p>
                        </div>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Location</p>
                          <p className="text-base font-semibold text-gray-900">{event.location}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Status</p>
                        <Badge 
                          variant={event.status === 'UPCOMING' ? 'default' : event.status === 'ONGOING' ? 'default' : 'secondary'}
                          className={event.status === 'UPCOMING' ? 'bg-green-600' : event.status === 'ONGOING' ? 'bg-blue-600' : ''}
                        >
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registration Status */}
              {event.hasRegistration && (
                <Card className="bg-white border-blue-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Registration Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isRegistered ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                          <div>
                            <p className="font-semibold text-gray-900">Registered</p>
                            {registration?.paymentStatus && (
                              <div className="text-sm text-gray-600 mt-1">
                                Payment: <Badge variant={registration.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
                                  {registration.paymentStatus}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/event-registrations?eventId=${event.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Not Registered</p>
                          <p className="text-sm text-gray-600">Register now to secure your spot</p>
                        </div>
                        <Button
                          onClick={() => setShowRegistrationDialog(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Register Now
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Check-In Status */}
              <Card className="bg-white border-green-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Check-In Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {isCheckedIn ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-gray-900">Checked In</p>
                          <p className="text-sm text-gray-600">You have successfully checked in to this event</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Not Checked In</p>
                        <p className="text-sm text-gray-600">
                          {event.status === 'UPCOMING' 
                            ? 'Check-in will be available 2 hours before the event starts'
                            : 'Click the button below to check in'}
                        </p>
                      </div>
                      <Button
                        onClick={handleSelfCheckIn}
                        disabled={loading || event.status === 'COMPLETED' || event.status === 'CANCELLED'}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Checking In...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Check In Now
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scan Another Event */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <Button
                    onClick={() => {
                      setEvent(null);
                      setIsRegistered(false);
                      setRegistration(null);
                      setIsCheckedIn(false);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Scan Another Event QR Code
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Registration Dialog */}
          <Dialog open={showRegistrationDialog} onOpenChange={setShowRegistrationDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Register for Event</DialogTitle>
                <DialogDescription>
                  Register for {event?.title} on {event ? formatDate(event.startDate) : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {event?.hasRegistration && event.registrationFee && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Registration Fee:</span> ₱{parseFloat(event.registrationFee.toString()).toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowRegistrationDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegister}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Confirm Registration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

export default function SelfCheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <SelfCheckInContent />
    </Suspense>
  );
}

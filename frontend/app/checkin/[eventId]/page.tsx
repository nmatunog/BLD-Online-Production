'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  LogIn,
  UserPlus
} from 'lucide-react';
import { type Event } from '@/services/events.service';
import { type Member } from '@/services/members.service';
import { apiClient } from '@/services/api-client';
import { type ApiResponse } from '@/types/api.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';
import { Label } from '@/components/ui/label';

export default function PublicCheckInPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string;
  
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [communityId, setCommunityId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberData, setMemberData] = useState<any>(null);
  const [showMemberInput, setShowMemberInput] = useState(false);
  const scannerRef = useRef<QRScanner | null>(null);
  const qrCodeRegionId = 'qr-reader-public';
  const [continuousMode, setContinuousMode] = useState(false);

  useEffect(() => {
    checkCameraAvailability();
    
    if (eventId) {
      loadEvent(eventId);
    }
  }, [eventId]);

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

  const lookupMember = async (communityIdInput: string) => {
    if (!communityIdInput || !communityIdInput.trim()) {
      toast.error('Invalid Community ID', {
        description: 'Please enter a valid Community ID',
      });
      return;
    }

    const normalizedId = communityIdInput.trim().toUpperCase();
    setLoading(true);
    
    try {
      // Use public endpoint for unauthenticated access
      const response = await apiClient.get<ApiResponse<Member>>(`/members/public/community/${normalizedId}`);
      if (response.data.success && response.data.data) {
        const member = response.data.data;
        setMemberData(member);
        setMemberName(member.nickname 
          ? `${member.nickname} ${member.lastName}` 
          : `${member.firstName} ${member.lastName}`);
        setCommunityId(normalizedId);
        setShowMemberInput(false);
      } else {
        toast.error('Member Not Found', {
          description: `No member found with Community ID: ${normalizedId}`,
        });
        setMemberData(null);
        setMemberName('');
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        toast.error('Member Not Found', {
          description: `No member found with Community ID: ${normalizedId}`,
        });
      } else {
        toast.error('Lookup Failed', {
          description: error instanceof Error ? error.message : 'Could not find member',
        });
      }
      setMemberData(null);
      setMemberName('');
    } finally {
      setLoading(false);
    }
  };


  const startQRScanner = async () => {
    if (!cameraAvailable) {
      toast.error('Camera Not Available', {
        description: 'Please enable camera permissions to scan QR codes',
      });
      return;
    }

    setIsScanning(true);
    await new Promise(resolve => setTimeout(resolve, 100));

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
      // Check if it's a member QR code
      const memberData = qrUtils.extractMemberData(decodedText);
      
      if (memberData && memberData.communityId) {
        await stopQRScanner();
        await lookupMember(memberData.communityId);
        return;
      }

      toast.error('Invalid QR Code', {
        description: 'Please scan a valid member QR code',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      toast.error('Scan Failed', {
        description: errorMessage,
      });
    }
  };

  const handleQRScanError = (errorMessage: string) => {
    if (
      !errorMessage.includes('No barcode or QR code detected') &&
      !errorMessage.includes('No MultiFormat Readers were able to detect the code')
    ) {
      console.error('QR scan error:', errorMessage);
    }
  };

  const handleSelfCheckIn = async () => {
    if (!event || !memberData?.id) {
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
      // Use public check-in endpoint
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/attendance/public/check-in', {
        communityId: memberData.communityId,
        eventId: event.id,
      });

      if (response.data.success) {
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Event Check-In</h1>
            <Button
              variant="outline"
              onClick={() => router.push('/login')}
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
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

          {/* Member Identification Section */}
          {!memberData ? (
            <Card className="bg-white border-purple-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Identify Yourself</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showMemberInput ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <p className="text-gray-600 mb-4">
                        Scan your member QR code or enter your Community ID
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={startQRScanner}
                          disabled={!cameraAvailable || isScanning}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Scan QR Code
                        </Button>
                        <Button
                          onClick={() => setShowMemberInput(true)}
                          variant="outline"
                        >
                          Enter Community ID
                        </Button>
                      </div>
                    </div>
                    
                    {isScanning && (
                      <div className="space-y-4">
                        <div id={qrCodeRegionId} className="w-full min-h-[300px]" />
                        <Button
                          onClick={stopQRScanner}
                          variant="outline"
                          className="w-full"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Stop Scanning
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="communityId">Community ID</Label>
                      <Input
                        id="communityId"
                        value={communityId}
                        onChange={(e) => setCommunityId(e.target.value.toUpperCase())}
                        placeholder="e.g., CEB-ME1801"
                        className="mt-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            lookupMember(communityId);
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => lookupMember(communityId)}
                        disabled={loading || !communityId.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Looking up...
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Lookup
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowMemberInput(false);
                          setCommunityId('');
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Member Info Card */}
              <Card className="bg-white border-green-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Member Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{memberName}</p>
                      <p className="text-sm text-gray-600">Community ID: {communityId}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMemberData(null);
                        setMemberName('');
                        setCommunityId('');
                        setIsCheckedIn(false);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Registration */}
              {event.hasRegistration && (
                <Card className="bg-white border-blue-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Registration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Registration Available</p>
                        <p className="text-sm text-gray-600">Log in to register for this event</p>
                      </div>
                      <Button
                        onClick={() => router.push(`/login?redirect=/checkin/${event.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Login to Register
                      </Button>
                    </div>
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}

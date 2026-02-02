'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  QrCode, 
  Search, 
  ArrowLeft, 
  CheckCircle, 
  X, 
  Camera, 
  Calendar, 
  Clock, 
  MapPin,
  Users,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { attendanceService, type Attendance } from '@/services/attendance.service';
import { eventsService, type Event } from '@/services/events.service';
import { membersService } from '@/services/members.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';

function CheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isScanning, setIsScanning] = useState(false);
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [recentCheckIns, setRecentCheckIns] = useState<Attendance[]>([]);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [searchMode, setSearchMode] = useState<'id' | 'name'>('id');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; communityId: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [stats, setStats] = useState<{ total: number; qrCodeCount: number; manualCount: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scannerRef = useRef<QRScanner | null>(null);
  const qrCodeRegionId = 'qr-reader';
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ deviceId: string; label: string; kind: string }>>([]);

  // Check authentication
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const authData = localStorage.getItem('authData');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        setUserRole(parsed.user?.role || '');
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    }

    loadEvents();
    checkCameraAvailability();
    loadRecentCheckIns();

    // Check for eventId in URL parameters
    const eventId = searchParams.get('eventId');
    if (eventId) {
      setSelectedEvent(eventId);
      toast.info('Event pre-selected from QR code scan');
    }
  }, [router, searchParams]);

  const checkCameraAvailability = async () => {
    try {
      const available = await QRScanner.isCameraAvailable();
      setCameraAvailable(available);
      
      // Load available cameras
      if (available) {
        const cameras = await QRScanner.getAvailableCameras();
        setAvailableCameras(cameras);
      }
    } catch (error) {
      console.error('Error checking camera:', error);
      setCameraAvailable(false);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const result = await eventsService.getAll({
        status: 'UPCOMING',
        sortBy: 'startDate',
        sortOrder: 'asc',
        limit: 50,
      });

      if (result.success && result.data) {
        const eventList = Array.isArray(result.data.data) ? result.data.data : [];
        setEvents(eventList);
        
        // Auto-select first event or URL event
        const eventId = searchParams.get('eventId');
        if (eventId && eventList.some(e => e.id === eventId)) {
          setSelectedEvent(eventId);
        } else if (eventList.length > 0) {
          setSelectedEvent(eventList[0].id);
        }
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

  const startQRScanner = async () => {
    if (!cameraAvailable) {
      toast.error('Camera Not Available', {
        description: 'Please enable camera access or use manual check-in',
      });
      return;
    }

    if (!selectedEvent) {
      toast.error('Please Select an Event', {
        description: 'Select an event before starting QR scanner',
      });
      return;
    }

    setIsScanning(true);

    // Clean up any existing scanner
    if (scannerRef.current) {
      await scannerRef.current.stop();
    }

    // Wait for the element to be rendered
    setTimeout(async () => {
      const qrElement = document.getElementById(qrCodeRegionId);
      if (!qrElement) {
        toast.error('QR scanner element not found. Please try again.');
        setIsScanning(false);
        return;
      }

      try {
        const scanner = new QRScanner(
          qrCodeRegionId,
          handleQRScanSuccess,
          handleQRScanError,
          {
            fps: 20, // Higher FPS for faster scanning
            continuousMode: continuousMode, // Continue scanning after success
            facingMode: 'environment', // Prefer back camera
            showTorchButtonIfSupported: true,
          }
        );

        scannerRef.current = scanner;
        await scanner.start();

        // Load available cameras
        const cameras = await QRScanner.getAvailableCameras();
        setAvailableCameras(cameras);
      } catch (error) {
        console.error('Error starting QR scanner:', error);
        toast.error('Failed to Start Scanner', {
          description: 'Please try again or use manual check-in',
        });
        setIsScanning(false);
      }
    }, 100);
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    try {
      // First, check if it's an event QR code (JSON or URL format)
      const eventData = qrUtils.extractEventData(decodedText);
      if (eventData && eventData.eventId) {
        // Verify event exists
        const event = events.find(e => e.id === eventData.eventId);
        if (!event) {
          toast.error('Event Not Found', {
            description: 'The scanned event QR code is not valid or the event no longer exists.',
          });
          return;
        }

        setSelectedEvent(eventData.eventId);
        toast.success('Event Selected', {
          description: `${event.title} - You can now scan member QR codes to check them in.`,
          duration: 4000,
        });
        
        // Only stop scanning if not in continuous mode
        if (!continuousMode) {
          await stopQRScanner();
        }
        return;
      }

      // If not an event QR code, try to extract member data
      const memberData = qrUtils.extractMemberData(decodedText);

      if (!memberData || !memberData.communityId) {
        toast.error('Invalid QR Code', {
          description: 'Please scan a valid member QR code or event QR code',
        });
        return;
      }

      // Only stop scanning if not in continuous mode
      if (!continuousMode) {
        await stopQRScanner();
      }

      // Auto-check in the member
      await performCheckIn(memberData.communityId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      toast.error('Check-in Failed', {
        description: errorMessage,
      });
    }
  };

  const handleQRScanError = (errorMessage: string) => {
    // Only log errors that are not related to continuous scanning
    if (
      !errorMessage.includes('No barcode or QR code detected') &&
      !errorMessage.includes('No MultiFormat Readers were able to detect the code') &&
      !errorMessage.includes('Permission') &&
      !errorMessage.includes('NotAllowedError')
    ) {
      console.error('QR scan error:', errorMessage);
      // Don't show toast for continuous scanning errors
    }
  };

  const performCheckIn = async (communityId: string) => {
    // Validate inputs before sending request
    if (!selectedEvent) {
      toast.error('Please Select an Event', {
        description: 'Select an event before checking in',
      });
      return;
    }

    if (!communityId || !communityId.trim()) {
      toast.error('Invalid Community ID', {
        description: 'Please scan a valid member QR code or enter a Community ID',
      });
      return;
    }

    // Normalize community ID (uppercase, trim)
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
          description: `${displayName} (${member.communityId}) has been checked in`,
          duration: 5000,
        });

        // Clear manual input
        setManualCheckIn('');
        setSearchResults([]);
        setShowSearchResults(false);

        // Reload recent check-ins and stats
        loadRecentCheckIns();
        loadStats();
      }
    } catch (error: any) {
      // Extract validation errors from backend response
      let errorMessage = 'Failed to check in';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (Array.isArray(errorData.message)) {
          // Multiple validation errors
          errorMessage = errorData.message.join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error('Check-in Failed', {
        description: errorMessage,
        duration: 5000,
      });
      
      console.error('Check-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async () => {
    const input = manualCheckIn.trim().toUpperCase();
    
    if (!input) {
      toast.error('Please Enter Community ID', {
        description: 'Enter a Community ID to check in',
      });
      return;
    }

    // Validate format
    if (!/^[A-Z]{3}-[A-Z]{2,3}\d{2,3}\d{2}$/.test(input)) {
      toast.error('Invalid Community ID Format', {
        description: 'Format should be like: CEB-ME1801',
      });
      return;
    }

    await performCheckIn(input);
  };

  const handleSearchMembers = async () => {
    if (searchMode === 'id') {
      const input = searchLastName.trim().toUpperCase();
      if (!input) {
        toast.error('Please Enter Community ID', {
          description: 'Enter a Community ID to search',
        });
        return;
      }
      await performCheckIn(input);
      return;
    }

    // Name search
    if (!searchLastName.trim() && !searchFirstName.trim()) {
      toast.error('Please Enter Name', {
        description: 'Enter at least last name to search',
      });
      return;
    }

    setSearching(true);
    try {
      const result = await membersService.getAll({
        search: `${searchFirstName} ${searchLastName}`.trim(),
        limit: 10,
      });

      if (result.data && result.data.length > 0) {
        setSearchResults(
          result.data.map(m => ({
            id: m.id,
            name: m.nickname
              ? `${m.nickname} ${m.lastName}`
              : `${m.firstName} ${m.lastName}`,
            communityId: m.communityId,
          })),
        );
        setShowSearchResults(true);
      } else {
        toast.info('No Members Found', {
          description: 'Try a different search term',
        });
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search members';
      toast.error('Search Failed', {
        description: errorMessage,
      });
    } finally {
      setSearching(false);
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
            {userRole === 'MEMBER' && (
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

        {/* Event Selection - Highlighted */}
        <div className="bg-gradient-to-br from-red-50 via-white to-red-50 p-6 md:p-7 rounded-xl shadow-lg border-2 border-red-300 ring-4 ring-red-100/50">
          <label className="block text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
            Select Event
          </label>
          {loading && events.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
              <div className="text-sm font-medium text-gray-700">Loading events...</div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-red-300 rounded-lg bg-red-50/50">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <div className="text-base font-semibold text-gray-900 mb-1">No Events Available</div>
              <div className="text-sm text-gray-600">
                No upcoming events found for check-in
              </div>
            </div>
          ) : (
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-full h-16 border-2 border-red-500 bg-white text-lg font-bold hover:border-red-600 focus:border-red-600 focus:ring-4 focus:ring-red-300 transition-all shadow-md">
                <SelectValue placeholder="Choose an event to begin check-in..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-red-300 z-[100] shadow-xl">
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id} className="text-base py-3 cursor-pointer hover:bg-red-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{event.title}</span>
                      <span className="text-xs text-gray-600 mt-0.5">
                        {formatDate(event.startDate)} {event.startTime && formatTime(event.startTime)}
                        {event.location && ` • ${event.location}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedEvent && (
            <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-semibold text-red-900">
                  Event selected: {events.find(e => e.id === selectedEvent)?.title}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Check-in Methods */}
        {selectedEvent && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* QR Scanner */}
            <div className="bg-white p-5 md:p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
                <QrCode className="w-5 h-5 mr-2.5 text-purple-600" />
                QR Code Scanner
              </h3>
              <div className="space-y-4">
                {!isScanning ? (
                  <>
                    <Button
                      onClick={startQRScanner}
                      disabled={!cameraAvailable || loading}
                      className="w-full h-14 text-base font-semibold bg-white border-2 border-purple-500 text-purple-700 hover:border-purple-600 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start QR Scanner
                    </Button>
                    {!cameraAvailable && (
                      <div className="text-center p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-yellow-600" />
                        <div className="text-sm font-medium text-yellow-900 mb-1">Camera Not Available</div>
                        <div className="text-xs text-yellow-700">
                          Please enable camera access or use manual check-in instead.
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-3 text-center">
                      Point camera at member's QR code to scan
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative bg-white rounded-xl border-2 border-purple-300 overflow-hidden shadow-md">
                      <div id={qrCodeRegionId} className="w-full" style={{ aspectRatio: '1/1', maxWidth: '400px', margin: '0 auto' }}></div>
                      <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-semibold px-2 py-1 rounded">
                        Scanning...
                      </div>
                    </div>
                    
                    {/* Scanner Controls */}
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {/* Torch/Flashlight Button */}
                      <Button
                        onClick={async () => {
                          if (scannerRef.current) {
                            const toggled = await scannerRef.current.toggleTorch();
                            setTorchEnabled(toggled);
                          }
                        }}
                        variant="outline"
                        className="flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white border-gray-700"
                        title="Toggle Flashlight"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-sm">{torchEnabled ? 'ON' : 'OFF'}</span>
                      </Button>

                      {/* Camera Switch Button */}
                      {availableCameras.length > 1 && (
                        <Button
                          onClick={async () => {
                            if (scannerRef.current) {
                              await scannerRef.current.switchCamera();
                            }
                          }}
                          variant="outline"
                          className="flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white border-gray-700"
                          title="Switch Camera"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-sm">Switch</span>
                        </Button>
                      )}

                      {/* Continuous Mode Toggle */}
                      <Button
                        onClick={() => {
                          setContinuousMode(!continuousMode);
                          toast.info(continuousMode ? 'Single scan mode: Scanner will stop after each scan' : 'Continuous mode: Scanner will keep running');
                        }}
                        variant="outline"
                        className={`flex items-center justify-center px-4 py-2 transition-colors ${
                          continuousMode 
                            ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'
                        }`}
                        title={continuousMode ? 'Continuous scanning enabled' : 'Single scan mode'}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {continuousMode ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          )}
                        </svg>
                        <span className="text-sm">{continuousMode ? 'Continuous' : 'Single'}</span>
                      </Button>
                    </div>

                    {/* Status Info */}
                    <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <Camera className="w-5 h-5 text-purple-600 animate-pulse mr-2" />
                        <p className="text-purple-700 font-semibold">Scanning QR Code</p>
                      </div>
                      <p className="text-sm text-purple-600 mb-1">Point camera at member QR code</p>
                      <p className="text-xs text-gray-500">Scan member QR codes for quick check-in</p>
                    </div>

                    <Button
                      onClick={stopQRScanner}
                      variant="outline"
                      className="w-full h-12 text-base font-semibold border-2 border-purple-400 text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-all"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Stop Scanner
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Manual Check-in */}
            <div className="bg-white p-5 md:p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
                <Search className="w-5 h-5 mr-2.5 text-green-600" />
                Manual Check-In
              </h3>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Community ID
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="CEB-ME1801"
                      value={manualCheckIn}
                      onChange={(e) => setManualCheckIn(e.target.value.toUpperCase())}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleManualCheckIn();
                        }
                      }}
                      className="h-14 text-base font-mono border-2 border-gray-300 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                      disabled={loading}
                    />
                    <Button
                      onClick={handleManualCheckIn}
                      disabled={loading || !manualCheckIn.trim()}
                      className="h-14 px-6 text-base font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all min-w-[60px]"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter Community ID and press Enter or click check button
                  </p>
                </div>

                {/* Name Search */}
                <div className="space-y-2 pt-5 border-t-2 border-gray-200">
                  <label className="block text-sm font-semibold text-gray-900">
                    Search by Name
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        placeholder="First Name"
                        value={searchFirstName}
                        onChange={(e) => setSearchFirstName(e.target.value)}
                        className="h-12 text-base border-2 border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        disabled={loading || searching}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Last Name"
                        value={searchLastName}
                        onChange={(e) => setSearchLastName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchMembers();
                          }
                        }}
                        className="h-12 text-base border-2 border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                        disabled={loading || searching}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSearchMembers}
                    disabled={loading || searching || (!searchFirstName.trim() && !searchLastName.trim())}
                    className="w-full h-12 text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search Members
                  </Button>

                  {showSearchResults && searchResults.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Search Results ({searchResults.length}):</div>
                      <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                        {searchResults.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => {
                              setManualCheckIn(member.communityId);
                              setShowSearchResults(false);
                              performCheckIn(member.communityId);
                            }}
                            className="w-full text-left p-3 rounded-lg border-2 border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm hover:shadow"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                              <span className="text-xs text-gray-600 font-mono mt-1">
                                {member.communityId}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {selectedEvent && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-lg shadow-sm border-2 border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Check-ins</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border-2 border-purple-200 hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">QR Code</p>
                  <p className="text-3xl font-bold text-purple-700">{stats.qrCodeCount}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <QrCode className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border-2 border-green-200 hover:border-green-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Manual</p>
                  <p className="text-3xl font-bold text-green-700">{stats.manualCount}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Search className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Check-ins */}
        {selectedEvent && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200">
            <div className="p-5 border-b-2 border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2.5 text-gray-700" />
                  Recent Check-ins 
                  {recentCheckIns.length > 0 && (
                    <span className="ml-2 px-2.5 py-0.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full">
                      {recentCheckIns.length}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      loadRecentCheckIns();
                      loadStats();
                    }}
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
                    disabled={loading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    variant="outline"
                    size="sm"
                    className={`h-9 text-xs font-semibold ${
                      autoRefresh 
                        ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                    {autoRefresh ? 'Auto ON' : 'Auto OFF'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-5">
              {recentCheckIns.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-base font-semibold text-gray-700 mb-1">No check-ins yet</p>
                  <p className="text-sm text-gray-500">Start checking in members using QR scanner or manual entry above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCheckIns.map((checkIn) => {
                    const member = checkIn.member;
                    const displayName = member.nickname
                      ? `${member.nickname} ${member.lastName}`
                      : `${member.firstName} ${member.lastName}`;
                    
                    return (
                      <div
                        key={checkIn.id}
                        className="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold text-gray-900 mb-1">
                            {displayName}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                              {member.communityId}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatCheckInTime(checkIn.checkInTime)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <Badge 
                            className={`text-xs px-3 py-1 font-semibold ${
                              checkIn.method === 'QR_CODE' 
                                ? 'bg-red-100 text-red-800 border-2 border-red-200' 
                                : 'bg-green-100 text-green-800 border-2 border-green-200'
                            }`}
                          >
                            {checkIn.method === 'QR_CODE' ? 'QR Code' : 'Manual'}
                          </Badge>
                          {(isAdmin || userRole === 'MEMBER') && (
                            <button
                              onClick={() => handleRemoveCheckIn(checkIn.id, displayName)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border-2 border-transparent hover:border-red-200 transition-all"
                              disabled={loading}
                              title={isAdmin ? "Remove check-in" : "Remove my check-in"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
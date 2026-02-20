'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, Users, UserPlus, UserCheck, Heart, Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/get-error-message';
import { isEncounterEvent, isMarriageEncounter } from '@/lib/event-utils';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { eventsService, type Event } from '@/services/events.service';
import { registrationsService, type EventRegistration, type RegistrationQueryParams } from '@/services/registrations.service';
import { authService } from '@/services/auth.service';
import RegistrationSummary from '@/components/registrations/RegistrationSummary';
import RegistrationTable from '@/components/registrations/RegistrationTable';
import MemberRegistrationForm from '@/components/registrations/MemberRegistrationForm';
import NonMemberRegistrationForm from '@/components/registrations/NonMemberRegistrationForm';
import CoupleRegistrationForm from '@/components/registrations/CoupleRegistrationForm';
import PaymentStatusDialog from '@/components/registrations/PaymentStatusDialog';
import RoomAssignmentDialog from '@/components/registrations/RoomAssignmentDialog';

function EventRegistrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const [loading, setLoading] = useState(false); // Start as false, will be set to true when actually loading
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  // Forms and dialogs
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showNonMemberForm, setShowNonMemberForm] = useState(false);
  const [showCoupleForm, setShowCoupleForm] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');

  // Load user role (auth redirect handled by dashboard layout)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authDataStr = localStorage.getItem('authData');
      if (authDataStr) {
        try {
          const parsed = JSON.parse(authDataStr);
          setUserRole(parsed?.user?.role || '');
        } catch {
          // ignore
        }
      }
      setAuthLoading(false);
    }
  }, []);

  // Load event data - only depends on eventId and authLoading
  useEffect(() => {
    const loadEvent = async () => {
      // Check if eventId is missing
      if (!eventId) {
        console.warn('No eventId provided in URL');
        toast.error('Event ID Missing', {
          description: 'Please select an event from the events page.',
        });
        router.push('/events');
        setLoading(false);
        return;
      }

      // Wait for auth to complete
      if (authLoading) {
        return;
      }

      try {
        setLoading(true);
        console.log('Loading event:', eventId);
        
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout: Event loading took too long')), 10000);
        });
        
        const eventResult = await Promise.race([
          eventsService.getById(eventId),
          timeoutPromise,
        ]) as Awaited<ReturnType<typeof eventsService.getById>>;
        
        console.log('Event loaded:', eventResult);
        
        if (eventResult.success && eventResult.data) {
          const loadedEvent = eventResult.data;
          
          // For members, only allow viewing non-recurring events
          // Check userRole from localStorage directly to avoid dependency
          if (typeof window !== 'undefined') {
            try {
              const authDataStr = localStorage.getItem('authData');
              if (authDataStr) {
                const parsed = JSON.parse(authDataStr);
                const isMember = parsed?.user?.role === 'MEMBER';
                if (isMember && loadedEvent.isRecurring) {
                  toast.error('Access Restricted', {
                    description: 'Members can only view registrations for non-recurring events.',
                  });
                  router.push('/events');
                  setLoading(false);
                  return;
                }
              }
            } catch {
              // Ignore parsing errors
            }
          }
          
          setEvent(loadedEvent);
        } else {
          console.error('Event not found or invalid response:', eventResult);
          toast.error('Event Not Found', {
            description: eventResult.error || 'The event you are looking for does not exist.',
          });
          router.push('/events');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load event';
        console.error('Error loading event:', error);
        
        // Check if it's a network error
        const isNetworkError = errorMessage.includes('Network') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED');
        
        toast.error('Error Loading Event', {
          description: isNetworkError
            ? 'Unable to connect to the server. Please check your connection and try again.'
            : errorMessage,
        });
        
        // Don't redirect on network errors, let user try again
        if (!isNetworkError) {
          router.push('/events');
        }
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, authLoading]); // Removed router from dependencies as it's stable

  // Debounce search term to avoid excessive API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load registrations and summary (separate effect for filters)
  useEffect(() => {
    const loadRegistrations = async () => {
      if (!eventId || authLoading || !event) return;

      // Check if user is a member - members can't access registrations endpoint
      const isMember = userRole === 'MEMBER';
      if (isMember) {
        console.log('Member user - skipping registrations load');
        setRegistrations([]);
        setRegistrationsLoading(false);
        setSummaryLoading(false);
        return;
      }

      console.log('Loading registrations for event:', eventId);

      // Create initial summary immediately for faster UI rendering
      if (!summary) {
        setSummary({
          event: {
            id: eventId,
            title: event.title,
            maxParticipants: event.maxParticipants || null,
            registrationFee: event.registrationFee ? Number(event.registrationFee) : null,
          },
          summary: {
            totalRegistrations: 0,
            memberRegistrations: 0,
            nonMemberRegistrations: 0,
            coupleRegistrations: 0,
            pendingPayments: 0,
            paidPayments: 0,
            totalRevenue: 0,
            capacityUsed: null,
          },
        });
      }

      try {
        setRegistrationsLoading(true);
        setSummaryLoading(true);

        const createTimeoutPromise = (timeout: number) =>
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
          );

        const result = await Promise.race([
          registrationsService.getRegistrationsWithSummary(eventId, {
            search: debouncedSearchTerm || undefined,
            registrationType: filterType !== 'ALL' ? (filterType as 'MEMBER' | 'NON_MEMBER' | 'COUPLE') : undefined,
            paymentStatus: filterPaymentStatus !== 'ALL' ? (filterPaymentStatus as 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED') : undefined,
          }),
          createTimeoutPromise(8000),
        ]);

        if (result.success && result.data) {
          setRegistrations(result.data.data ?? []);
          if (result.data.summary) setSummary(result.data.summary);
        } else {
          setRegistrations([]);
        }
      } catch (error: unknown) {
        setRegistrations([]);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const is403 = typeof error === 'object' && error !== null && 'response' in error && (error as { response?: { status?: number } }).response?.status === 403;
        if (!is403) {
          toast.error(msg.includes('timeout') ? 'Request Timeout' : 'Error Loading Registrations', {
            description: msg.includes('timeout') ? 'Loading took too long. Please try again.' : msg,
          });
        }
      } finally {
        setRegistrationsLoading(false);
        setSummaryLoading(false);
      }
    };

    loadRegistrations();
  }, [eventId, authLoading, event?.id, userRole, debouncedSearchTerm, filterType, filterPaymentStatus]);

  const handleRefresh = async () => {
    if (!eventId) return;

    try {
      setRegistrationsLoading(true);
      setSummaryLoading(true);

      const result = await registrationsService.getRegistrationsWithSummary(eventId, {
        search: searchTerm || undefined,
        registrationType: filterType !== 'ALL' ? (filterType as 'MEMBER' | 'NON_MEMBER' | 'COUPLE') : undefined,
        paymentStatus: filterPaymentStatus !== 'ALL' ? (filterPaymentStatus as 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED') : undefined,
      });

      if (result.success && result.data) {
        setRegistrations(result.data.data ?? []);
        if (result.data.summary) setSummary(result.data.summary);
      }
    } catch (error) {
      toast.error('Error', {
        description: getErrorMessage(error, 'Failed to refresh data'),
      });
    } finally {
      setRegistrationsLoading(false);
      setSummaryLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <div className="text-2xl text-foreground">Authenticating...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
            <div className="text-2xl text-foreground mb-2">Loading Event...</div>
            <div className="text-sm text-gray-500">
              {eventId ? `Event ID: ${eventId.substring(0, 8)}...` : 'Please wait...'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              If this takes too long, check your connection
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <DashboardHeader />
        <div className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Card className="bg-white border border-red-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="text-red-600 mb-4">
                  <X className="w-16 h-16 mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Event ID Required</h2>
                <p className="text-gray-600 mb-6">Please select an event to view registrations.</p>
                <Button
                  onClick={() => router.push('/events')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Events
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <DashboardHeader />
        <div className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Card className="bg-white border border-red-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="text-red-600 mb-4">
                  <Loader2 className="w-16 h-16 mx-auto animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Event...</h2>
                <p className="text-gray-600">Please wait while we load the event details.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push('/events')}
                variant="outline"
                className="bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 h-12 text-lg px-6"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Events
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Event Registrations</h1>
                <p className="text-lg text-gray-600 mt-1">{event.title}</p>
                {event.encounterType && event.classNumber && (
                  <p className="text-base font-semibold text-purple-700 mt-1">
                    {event.encounterType} Class {event.classNumber}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Registration Summary */}
          {summary ? (
            <RegistrationSummary summary={summary} loading={summaryLoading} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-white border border-gray-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Action Buttons - Only show to admins */}
          {userRole !== 'MEMBER' && (
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="bg-gray-50 border-b border-gray-200 p-5">
                <CardTitle className="text-2xl font-semibold text-gray-800">Register Participants</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setShowMemberForm(true)}
                    className="h-12 text-lg px-6 bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-5 h-5 mr-2" />
                    Register Member
                  </Button>
                  <Button
                    onClick={() => setShowNonMemberForm(true)}
                    className="h-12 text-lg px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Register Non-Member
                  </Button>
                  {isMarriageEncounter(event) && (
                    <Button
                      onClick={() => setShowCoupleForm(true)}
                      className="h-12 text-lg px-6 bg-purple-600 hover:bg-purple-700"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      Register Couple
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="bg-gray-50 border-b border-gray-200 p-5">
              <CardTitle className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                <Filter className="w-6 h-6" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, email, phone, or Community ID..."
                      className="h-12 text-lg pl-10"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Registration Type</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="NON_MEMBER">Non-Member</SelectItem>
                      <SelectItem value="COUPLE">Couple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Payment Status</label>
                  <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="REFUNDED">Refunded</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registrations Table */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="bg-gray-50 border-b border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-semibold text-gray-800">
                  Registrations ({registrations.length})
                </CardTitle>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  className="h-10 text-base"
                  disabled={registrationsLoading}
                >
                  <Loader2 className={`w-4 h-4 mr-2 ${registrationsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <RegistrationTable
                registrations={registrations}
                loading={registrationsLoading}
                hasActiveFilters={filterType !== 'ALL' || filterPaymentStatus !== 'ALL' || !!debouncedSearchTerm}
                onUpdatePayment={userRole !== 'MEMBER' ? (reg) => {
                  setSelectedRegistration(reg);
                  setShowPaymentDialog(true);
                } : undefined}
                onAssignRoom={userRole !== 'MEMBER' ? (reg) => {
                  setSelectedRegistration(reg);
                  setShowRoomDialog(true);
                } : undefined}
                onDelete={userRole !== 'MEMBER' ? handleRefresh : undefined}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Forms and Dialogs */}
      {eventId && (
        <>
          <MemberRegistrationForm
            eventId={eventId}
            isOpen={showMemberForm}
            onClose={() => setShowMemberForm(false)}
            onSuccess={handleRefresh}
          />
          <NonMemberRegistrationForm
            eventId={eventId}
            isOpen={showNonMemberForm}
            onClose={() => setShowNonMemberForm(false)}
            onSuccess={handleRefresh}
            isEncounterEvent={isEncounterEvent(event)}
            isMarriageEncounter={isMarriageEncounter(event)}
          />
          {isMarriageEncounter(event) && (
            <CoupleRegistrationForm
              eventId={eventId}
              isOpen={showCoupleForm}
              onClose={() => setShowCoupleForm(false)}
              onSuccess={handleRefresh}
            />
          )}
          <PaymentStatusDialog
            registration={selectedRegistration}
            isOpen={showPaymentDialog}
            onClose={() => {
              setShowPaymentDialog(false);
              setSelectedRegistration(null);
            }}
            onSuccess={handleRefresh}
          />
          <RoomAssignmentDialog
            registration={selectedRegistration}
            isOpen={showRoomDialog}
            onClose={() => {
              setShowRoomDialog(false);
              setSelectedRegistration(null);
            }}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </div>
  );
}

export default function EventRegistrationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <EventRegistrationsContent />
    </Suspense>
  );
}

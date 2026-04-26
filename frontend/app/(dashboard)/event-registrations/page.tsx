'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar, Users, UserPlus, UserCheck, Heart, Search, Filter, X, Upload, UserCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/get-error-message';
import { isEncounterEvent, isMarriageEncounter } from '@/lib/event-utils';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { eventsService, type Event } from '@/services/events.service';
import {
  registrationsService,
  type EventRegistration,
  type RegistrationQueryParams,
  type EventCandidate,
  type CandidateSummary,
  type CandidateDuplicatePreview,
} from '@/services/registrations.service';
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
  const [candidateCsvFile, setCandidateCsvFile] = useState<File | null>(null);
  const [candidateImporting, setCandidateImporting] = useState(false);
  const [candidateDryRunResult, setCandidateDryRunResult] = useState<any | null>(null);
  const [candidateSummary, setCandidateSummary] = useState<CandidateSummary | null>(null);
  const [candidateList, setCandidateList] = useState<EventCandidate[]>([]);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('ALL');
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidatePageSize, setCandidatePageSize] = useState(25);
  const [candidateVisibleCount, setCandidateVisibleCount] = useState(25);
  const [candidateDuplicatePreview, setCandidateDuplicatePreview] = useState<CandidateDuplicatePreview | null>(null);
  const [candidateHarmonizing, setCandidateHarmonizing] = useState(false);
  const [showHarmonizeDialog, setShowHarmonizeDialog] = useState(false);
  const [selectedDuplicateSignature, setSelectedDuplicateSignature] = useState<string>('');
  const [selectedKeeperId, setSelectedKeeperId] = useState<string>('');
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimingCandidate, setClaimingCandidate] = useState<EventCandidate | null>(null);
  const [claimMobile, setClaimMobile] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const candidateLoadMoreRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!eventId || authLoading || !event || userRole === 'MEMBER') return;
    void loadCandidateData();
  }, [eventId, authLoading, event?.id, userRole, candidateStatusFilter]);

  useEffect(() => {
    const updateCandidatePageSize = () => {
      if (typeof window === 'undefined') return;
      // Estimate rows that fit comfortably on screen while keeping table responsive.
      const availableHeight = Math.max(window.innerHeight - 360, 420);
      const rowsPerScreen = Math.floor(availableHeight / 48);
      const nextSize = Math.min(60, Math.max(15, rowsPerScreen));
      setCandidatePageSize(nextSize);
    };

    updateCandidatePageSize();
    window.addEventListener('resize', updateCandidatePageSize);
    return () => window.removeEventListener('resize', updateCandidatePageSize);
  }, []);

  useEffect(() => {
    setCandidateVisibleCount(candidatePageSize);
  }, [candidateList, candidateStatusFilter, candidatePageSize]);

  useEffect(() => {
    if (!candidateLoadMoreRef.current || candidateLoading || candidateVisibleCount >= candidateList.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setCandidateVisibleCount((prev) => Math.min(prev + candidatePageSize, candidateList.length));
      },
      { root: null, rootMargin: '180px 0px', threshold: 0.1 },
    );

    observer.observe(candidateLoadMoreRef.current);
    return () => observer.disconnect();
  }, [candidateLoading, candidateList.length, candidateVisibleCount, candidatePageSize]);

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

  const loadCandidateData = async () => {
    if (!eventId || userRole === 'MEMBER') return;
    try {
      setCandidateLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        registrationsService.getCandidateSummary(eventId),
        registrationsService.listCandidates(eventId, {
          status: candidateStatusFilter !== 'ALL' ? (candidateStatusFilter as any) : undefined,
        }),
      ]);
      if (summaryRes.success && summaryRes.data) setCandidateSummary(summaryRes.data);
      if (listRes.success && listRes.data) setCandidateList(listRes.data);
      const duplicateRes = await registrationsService.getCandidateDuplicatePreview(eventId);
      if (duplicateRes.success && duplicateRes.data) setCandidateDuplicatePreview(duplicateRes.data);
    } catch (error) {
      toast.error('Error', {
        description: getErrorMessage(error, 'Failed to load candidate import data'),
      });
    } finally {
      setCandidateLoading(false);
    }
  };

  const handleImportCandidates = async (dryRun: boolean) => {
    if (!eventId) return;
    if (!candidateCsvFile) {
      toast.error('CSV file required', { description: 'Choose a CSV file first.' });
      return;
    }
    try {
      setCandidateImporting(true);
      const res = await registrationsService.importCandidatesCsv(eventId, candidateCsvFile, { dryRun });
      if (res.success) {
        setCandidateDryRunResult(res.data || null);
        toast.success(dryRun ? 'Dry run complete' : 'Candidates imported', {
          description: dryRun
            ? 'Validation finished. Review counts/errors below.'
            : 'Candidates are now available for claim and registration.',
        });
        await loadCandidateData();
      } else {
        toast.error('Import failed', { description: res.error || 'Unknown error' });
      }
    } catch (error) {
      toast.error('Import failed', { description: getErrorMessage(error, 'Failed to import candidates') });
    } finally {
      setCandidateImporting(false);
    }
  };

  const handleClaimCandidate = async (candidate: EventCandidate) => {
    setClaimingCandidate(candidate);
    setClaimMobile(candidate.cleanMobile || candidate.mobileNumber || '');
    setClaimEmail('');
    setShowClaimDialog(true);
  };

  const submitClaimCandidate = async () => {
    if (!eventId || !claimingCandidate) return;
    try {
      setClaimSubmitting(true);
      const res = await registrationsService.claimCandidate(eventId, {
        candidateClass: claimingCandidate.candidateClass,
        familyName: claimingCandidate.familyName,
        firstName: claimingCandidate.firstName,
        mobileNumber: claimMobile.trim() || undefined,
        email: claimEmail.trim() || undefined,
      });
      if (res.success && res.data) {
        toast.success('Candidate claimed and registered', {
          description: `Community ID: ${res.data.communityId}`,
        });
        if (res.data.userCreated && res.data.tempPassword) {
          toast.info('Temporary password generated', {
            description: `${claimingCandidate.firstName} ${claimingCandidate.familyName}: ${res.data.tempPassword}`,
            duration: 12000,
          });
        }
        setShowClaimDialog(false);
        setClaimingCandidate(null);
        await handleRefresh();
        await loadCandidateData();
      } else {
        toast.error('Claim failed', { description: res.error || 'Unknown error' });
      }
    } catch (error) {
      toast.error('Claim failed', { description: getErrorMessage(error, 'Failed to claim candidate') });
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleOpenHarmonizeDialog = async () => {
    if (!eventId) return;
    try {
      const res = await registrationsService.getCandidateDuplicatePreview(eventId);
      if (res.success && res.data) {
        setCandidateDuplicatePreview(res.data);
        const firstGroup = res.data.groups?.[0];
        setSelectedDuplicateSignature(firstGroup?.signature || '');
        setSelectedKeeperId(firstGroup?.rows?.[0]?.id || '');
        setShowHarmonizeDialog(true);
      } else {
        toast.error('Unable to load duplicates', { description: res.error || 'Unknown error' });
      }
    } catch (error) {
      toast.error('Unable to load duplicates', {
        description: getErrorMessage(error, 'Failed to load duplicate candidates'),
      });
    }
  };

  const selectedDuplicateGroup = candidateDuplicatePreview?.groups?.find(
    (g) => g.signature === selectedDuplicateSignature,
  );

  useEffect(() => {
    if (!selectedDuplicateGroup) return;
    const currentKeeperStillInGroup = selectedDuplicateGroup.rows.some((r) => r.id === selectedKeeperId);
    if (!currentKeeperStillInGroup) {
      setSelectedKeeperId(selectedDuplicateGroup.rows[0]?.id || '');
    }
  }, [selectedDuplicateGroup, selectedKeeperId]);

  const handleConfirmHarmonize = async () => {
    if (!eventId) return;
    if (!selectedDuplicateGroup) {
      toast.error('No duplicate group selected');
      return;
    }
    if (!selectedKeeperId) {
      toast.error('Select a record to keep first');
      return;
    }

    try {
      setCandidateHarmonizing(true);
      const deleteIds = selectedDuplicateGroup.rows
        .map((r) => r.id)
        .filter((id) => id !== selectedKeeperId);
      const res = await registrationsService.resolveCandidateDuplicate(eventId, {
        signature: selectedDuplicateGroup.signature,
        keeperId: selectedKeeperId,
        deleteIds,
      });
      if (res.success && res.data) {
        toast.success('Duplicate group resolved', {
          description: `Kept one row and removed ${res.data.removedRecords} duplicate rows.`,
        });
        const previewRes = await registrationsService.getCandidateDuplicatePreview(eventId);
        if (previewRes.success && previewRes.data) {
          setCandidateDuplicatePreview(previewRes.data);
          if (previewRes.data.groups.length === 0) {
            setShowHarmonizeDialog(false);
          } else {
            const nextGroup = previewRes.data.groups.find((g) => g.signature !== selectedDuplicateGroup.signature)
              || previewRes.data.groups[0];
            setSelectedDuplicateSignature(nextGroup.signature);
            setSelectedKeeperId(nextGroup.rows[0]?.id || '');
          }
        }
        await loadCandidateData();
      } else {
        toast.error('Resolve failed', { description: res.error || 'Unknown error' });
      }
    } catch (error) {
      toast.error('Resolve failed', {
        description: getErrorMessage(error, 'Failed to resolve duplicate candidates'),
      });
    } finally {
      setCandidateHarmonizing(false);
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
                    className="h-12 border-0 text-lg px-6 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                  >
                    <UserCheck className="w-5 h-5 mr-2" />
                    Register Member
                  </Button>
                  <Button
                    onClick={() => setShowNonMemberForm(true)}
                    className="h-12 border-0 text-lg px-6 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Register Non-Member
                  </Button>
                  {isMarriageEncounter(event) && (
                    <Button
                      onClick={() => setShowCoupleForm(true)}
                      className="h-12 border-0 text-lg px-6 bg-purple-600 text-white hover:bg-purple-700 hover:text-white"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      Register Couple
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Candidate CSV import + claim workflow */}
          {userRole !== 'MEMBER' && (
            <Card className="bg-white border border-indigo-100 shadow-sm">
              <CardHeader className="bg-indigo-50/60 border-b border-indigo-100 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-2xl font-semibold text-indigo-900">
                    Candidate Import & Claim
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenHarmonizeDialog}
                      disabled={candidateLoading || candidateHarmonizing}
                    >
                      Harmonize duplicates
                      {candidateDuplicatePreview && candidateDuplicatePreview.recordsToRemove > 0
                        ? ` (${candidateDuplicatePreview.recordsToRemove})`
                        : ''}
                    </Button>
                    <Select value={candidateStatusFilter} onValueChange={setCandidateStatusFilter}>
                      <SelectTrigger className="h-10 w-[170px] text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All statuses</SelectItem>
                        <SelectItem value="IMPORTED">Imported</SelectItem>
                        <SelectItem value="CLAIMED">Claimed</SelectItem>
                        <SelectItem value="REGISTERED">Registered</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadCandidateData} disabled={candidateLoading}>
                      <Loader2 className={`w-4 h-4 mr-2 ${candidateLoading ? 'animate-spin' : ''}`} />
                      Reload
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Upload Candidate CSV
                    </label>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setCandidateCsvFile(e.target.files?.[0] || null)}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Expected columns: Candidate Class, Family Name, First Name (+ optional Mobile/Clean Mobile).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleImportCandidates(true)}
                      disabled={candidateImporting || !candidateCsvFile}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Dry Run
                    </Button>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleImportCandidates(false)}
                      disabled={candidateImporting || !candidateCsvFile}
                    >
                      <Loader2 className={`w-4 h-4 mr-2 ${candidateImporting ? 'animate-spin' : 'hidden'}`} />
                      Import CSV
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="rounded-lg bg-gray-50 border p-3">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-xl font-semibold">{candidateSummary?.total ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs text-blue-700">Imported</p>
                    <p className="text-xl font-semibold text-blue-900">{candidateSummary?.imported ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs text-amber-700">Claimed</p>
                    <p className="text-xl font-semibold text-amber-900">{candidateSummary?.claimed ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs text-emerald-700">Registered</p>
                    <p className="text-xl font-semibold text-emerald-900">{candidateSummary?.registered ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                    <p className="text-xs text-rose-700">Rejected</p>
                    <p className="text-xl font-semibold text-rose-900">{candidateSummary?.rejected ?? 0}</p>
                  </div>
                </div>

                {candidateDryRunResult && (
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-3">
                    <p className="font-medium text-slate-900">Latest validation/import result</p>
                    <p className="text-slate-700 mt-1">
                      Rows: {candidateDryRunResult.totalRows ?? 0} · Valid: {candidateDryRunResult.validRows ?? candidateDryRunResult.importedRows ?? 0}
                      {' '}· Invalid: {candidateDryRunResult.invalidRows ?? 0}
                    </p>
                    {Array.isArray(candidateDryRunResult.errors) && candidateDryRunResult.errors.length > 0 && (
                      <div className="overflow-x-auto rounded-md border bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-rose-50">
                            <tr>
                              <th className="text-left px-2 py-1.5 font-semibold text-rose-800">Row</th>
                              <th className="text-left px-2 py-1.5 font-semibold text-rose-800">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidateDryRunResult.errors.slice(0, 20).map((err: { row?: number; reason?: string }, idx: number) => (
                              <tr key={`${err.row}-${idx}`} className="border-t">
                                <td className="px-2 py-1.5 text-gray-700">{err.row ?? '-'}</td>
                                <td className="px-2 py-1.5 text-gray-800">{err.reason ?? 'Validation error'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Candidate</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Class</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Mobile</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Status</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidateLoading ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Loading candidates…</td>
                        </tr>
                      ) : candidateList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No candidate rows yet.</td>
                        </tr>
                      ) : (
                        candidateList.slice(0, candidateVisibleCount).map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{c.firstName} {c.familyName}</div>
                              <div className="text-xs text-gray-500">{c.classShepherds || ''}</div>
                            </td>
                            <td className="px-3 py-2">{c.candidateClass}</td>
                            <td className="px-3 py-2">{c.cleanMobile || c.mobileNumber || '—'}</td>
                            <td className="px-3 py-2">{c.status}</td>
                            <td className="px-3 py-2 text-right">
                              {c.status !== 'REGISTERED' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  onClick={() => handleClaimCandidate(c)}
                                >
                                  <UserCheck2 className="w-4 h-4 mr-1" />
                                  Claim + Register
                                </Button>
                              ) : (
                                <span className="text-xs text-emerald-700 font-medium">Done</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {candidateList.length > 0 && (
                  <div className="space-y-2">
                    <div ref={candidateLoadMoreRef} className="h-4" />
                    <p className="text-xs text-gray-500">
                      Showing {Math.min(candidateVisibleCount, candidateList.length)} of {candidateList.length} rows.
                      {candidateVisibleCount < candidateList.length
                        ? ' Scroll to load more.'
                        : ' End of list.'}
                    </p>
                  </div>
                )}
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
          <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
            <DialogContent className="bg-white sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Claim Candidate and Register</DialogTitle>
                <DialogDescription>
                  {claimingCandidate
                    ? `Verify details for ${claimingCandidate.firstName} ${claimingCandidate.familyName} (${claimingCandidate.candidateClass}).`
                    : 'Enter details to claim this candidate.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number (optional)</label>
                  <Input
                    value={claimMobile}
                    onChange={(e) => setClaimMobile(e.target.value)}
                    placeholder="09XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <Input
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    placeholder="candidate@email.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Provide mobile or email for first-time login creation if candidate has none on file.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowClaimDialog(false)} disabled={claimSubmitting}>
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={submitClaimCandidate}
                  disabled={claimSubmitting || !claimingCandidate}
                >
                  <Loader2 className={`w-4 h-4 mr-2 ${claimSubmitting ? 'animate-spin' : 'hidden'}`} />
                  Claim + Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showHarmonizeDialog} onOpenChange={setShowHarmonizeDialog}>
            <DialogContent className="bg-white sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Resolve duplicate candidates</DialogTitle>
                <DialogDescription>
                  When fields conflict, choose which row to keep, then delete the rest.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-md border bg-slate-50 p-3">
                  <p>Duplicate groups: <span className="font-semibold">{candidateDuplicatePreview?.totalGroups ?? 0}</span></p>
                  <p>Duplicate records: <span className="font-semibold">{candidateDuplicatePreview?.duplicateRecords ?? 0}</span></p>
                  <p>Rows to remove: <span className="font-semibold">{candidateDuplicatePreview?.recordsToRemove ?? 0}</span></p>
                </div>
                {candidateDuplicatePreview?.groups?.length ? (
                  <div className="space-y-3">
                    <div className="rounded-md border p-2">
                      <label className="block text-xs text-gray-600 mb-1">Duplicate group</label>
                      <Select
                        value={selectedDuplicateSignature}
                        onValueChange={(sig) => {
                          setSelectedDuplicateSignature(sig);
                          const next = candidateDuplicatePreview.groups.find((g) => g.signature === sig);
                          setSelectedKeeperId(next?.rows?.[0]?.id || '');
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select duplicate group" />
                        </SelectTrigger>
                        <SelectContent>
                          {candidateDuplicatePreview.groups.map((group) => (
                            <SelectItem key={group.signature} value={group.signature}>
                              {group.firstName} {group.familyName} ({group.candidateClass}) · {group.count} rows
                              {group.hasConflicts ? ' · conflict' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDuplicateGroup && (
                      <div className="rounded-md border">
                        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-700">
                          <span className="font-semibold">{selectedDuplicateGroup.firstName} {selectedDuplicateGroup.familyName}</span>
                          {' '}({selectedDuplicateGroup.candidateClass}) · choose keeper row
                          {selectedDuplicateGroup.conflictFields.length > 0
                            ? ` · conflicts: ${selectedDuplicateGroup.conflictFields.join(', ')}`
                            : ''}
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {selectedDuplicateGroup.rows.map((row) => (
                            <label key={row.id} className="flex items-start gap-3 px-3 py-2 border-t first:border-t-0 cursor-pointer">
                              <input
                                type="radio"
                                name="keeper-row"
                                checked={selectedKeeperId === row.id}
                                onChange={() => setSelectedKeeperId(row.id)}
                                className="mt-1"
                              />
                              <div className="text-xs text-gray-700">
                                <div className="font-medium text-gray-900">Row ID: {row.id.slice(0, 8)}…</div>
                                <div>Status: {row.status} · Updated: {new Date(row.updatedAt).toLocaleString()}</div>
                                <div>Mobile: {row.cleanMobile || row.mobileNumber || '—'} · CMP-A: {row.cmpATaken || '—'}</div>
                                <div>Group: {row.classGroup || '—'} · Shepherds: {row.classShepherds || '—'}</div>
                                <div>Linked: Member {row.memberId ? 'Yes' : 'No'} · Registration {row.registrationId ? 'Yes' : 'No'}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600">No duplicates detected for this event.</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowHarmonizeDialog(false)}
                  disabled={candidateHarmonizing}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleConfirmHarmonize}
                  disabled={candidateHarmonizing || !selectedDuplicateGroup || selectedDuplicateGroup.rows.length <= 1 || !selectedKeeperId}
                >
                  <Loader2 className={`w-4 h-4 mr-2 ${candidateHarmonizing ? 'animate-spin' : 'hidden'}`} />
                  Keep selected, delete others
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

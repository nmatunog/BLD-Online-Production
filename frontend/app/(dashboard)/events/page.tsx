'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, Plus, Shield, List, History, Copy, Loader2, Calendar, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { eventsService, type Event, type EventQueryParams, type EventWithCreator, type EventAuditLogEntry, type DuplicateGroup } from '@/services/events.service';
import { attendanceService } from '@/services/attendance.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import EventCard from '@/components/events/EventCard';
import ClassShepherdAssignment from '@/components/events/ClassShepherdAssignment';
import EventUpdateScopeDialog from '@/components/events/EventUpdateScopeDialog';
import {
  isOngoingForDisplay,
  isCompletedPastWindow,
  isWithin7DaysOfEnd,
  isPastEventCategory,
} from '@/lib/event-checkin-window';
import { getErrorMessage } from '@/lib/get-error-message';

function isUnauthorizedError(error: unknown): boolean {
  const e = error as { response?: { status?: number } };
  return e?.response?.status === 401;
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

export default function EventsPage() {
  const router = useRouter();

  // Events list
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'startDate' | 'title' | 'createdAt'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Auth
  const [userRole, setUserRole] = useState<string>('');
  const [userMinistry, setUserMinistry] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myCheckInEventIds, setMyCheckInEventIds] = useState<Set<string>>(new Set<string>());

  // UI state
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedEventForQR, setSelectedEventForQR] = useState<Event | null>(null);
  const [showShepherdDialog, setShowShepherdDialog] = useState(false);
  const [selectedEventForShepherds, setSelectedEventForShepherds] = useState<Event | null>(null);
  const [showAdminTools, setShowAdminTools] = useState(false);

  // Super User tools
  const [showSuperAllDialog, setShowSuperAllDialog] = useState(false);
  const [superAllEvents, setSuperAllEvents] = useState<EventWithCreator[]>([]);
  const [superAllLoading, setSuperAllLoading] = useState(false);
  const [superAllDeletingId, setSuperAllDeletingId] = useState<string | null>(null);

  const [showAuditLogDialog, setShowAuditLogDialog] = useState(false);
  const [auditLogEntries, setAuditLogEntries] = useState<EventAuditLogEntry[]>([]);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesLoadError, setDuplicatesLoadError] = useState<string | null>(null);
  const [duplicateDeletingId, setDuplicateDeletingId] = useState<string | null>(null);
  const [correctAllLoading, setCorrectAllLoading] = useState(false);

  const [cwGenerating, setCwGenerating] = useState(false);
  const [lssGenerating, setLssGenerating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadEvents();
    }
  }, [authLoading, searchTerm, filterStatus, filterType, sortBy, sortOrder]);

  const checkAuth = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch('/api/users/profile', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUserRole(result.data.role);
          setUserMinistry(result.data.member?.ministry || null);
        }
      }

      // Load my check-ins
      const checkInsRes = await attendanceService.getMe();
      if (checkInsRes?.success && checkInsRes.data) {
        const ids = new Set(checkInsRes.data.map((c: any) => c.eventId));
        setMyCheckInEventIds(ids);
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        router.push('/signin');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: EventQueryParams = {
        search: searchTerm || undefined,
        status: filterStatus !== 'ALL' ? (filterStatus as any) : undefined,
        eventType: filterType !== 'ALL' ? filterType : undefined,
        sortBy,
        sortOrder,
        page: 1,
        limit: 100,
        collapseDuplicateDisplay: true,
      };

      const result = await eventsService.getAll(params);
      if (result?.success && result.data) {
        setEvents(Array.isArray(result.data.data) ? result.data.data : []);
      } else {
        setEvents([]);
        if (result && result.success === false) {
          toast.error('Could not load events', {
            description: result.error || result.message || 'Please try again.',
          });
        }
      }
    } catch (error: unknown) {
      if (isUnauthorizedError(error)) {
        router.push('/signin');
      } else {
        toast.error('Failed to Load Events', {
          description: getErrorMessage(error, 'Could not load events'),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    try {
      const dt = new Date(date);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(dt);
    } catch {
      return date;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getStatusBadge = (status: string): ReactElement => {
    const badges: Record<string, ReactElement> = {
      UPCOMING: <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full border border-blue-200">Upcoming</span>,
      ONGOING: <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">Ongoing</span>,
      COMPLETED: <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full border border-gray-200">Completed</span>,
      CANCELLED: <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full border border-red-200">Cancelled</span>,
    };
    return badges[status] || <span>{status}</span>;
  };

  const handleEdit = (event: Event) => {
    router.push(`/events/${event.id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    try {
      await eventsService.delete(id);
      toast.success('Event deleted successfully');
      loadEvents();
    } catch (error) {
      toast.error('Failed to delete event', { description: getErrorMessage(error, 'Delete operation failed') });
    }
  };

  const handleViewQR = (event: Event) => {
    setSelectedEventForQR(event);
    setShowQRDialog(true);
  };

  const handleGenerateQR = async (id: string) => {
    try {
      await eventsService.regenerateQRCode(id);
      toast.success('QR Code generated successfully');
      loadEvents();
    } catch (error) {
      toast.error('Failed to generate QR Code', { description: getErrorMessage(error, 'QR generation failed') });
    }
  };

  const handleToggleStatus = async (id: string) => {
    const event = events.find(e => e.id === id);
    if (!event) return;
    const newStatus = event.status === 'UPCOMING' ? 'COMPLETED' : 'UPCOMING';
    try {
      await eventsService.update(id, { status: newStatus });
      toast.success(`Event status updated to ${newStatus}`);
      loadEvents();
    } catch (error) {
      toast.error('Failed to update event status', { description: getErrorMessage(error, 'Status update failed') });
    }
  };

  const handleAssignShepherds = (event: Event) => {
    setSelectedEventForShepherds(event);
    setShowShepherdDialog(true);
  };

  // Admin Tools
  const loadSuperAllEvents = useCallback(async () => {
    setSuperAllLoading(true);
    try {
      const res = await eventsService.getAllForSuperUser();
      if (res?.success && res.data) {
        setSuperAllEvents(res.data.data || []);
      }
    } catch (e) {
      toast.error('Failed to load all events', { description: getErrorMessage(e, 'Could not load events list') });
    } finally {
      setSuperAllLoading(false);
    }
  }, []);

  const handleSuperDelete = async (eventId: string) => {
    if (!confirm('Remove this event? It will be deleted (or marked CANCELLED if it has check-ins/registrations).')) return;
    setSuperAllDeletingId(eventId);
    try {
      await eventsService.delete(eventId);
      toast.success('Event removed');
      loadSuperAllEvents();
      loadEvents();
    } catch (e) {
      toast.error('Delete failed', { description: getErrorMessage(e, 'Could not delete event') });
    } finally {
      setSuperAllDeletingId(null);
    }
  };

  const loadAuditLog = useCallback(async () => {
    setAuditLogLoading(true);
    try {
      const res = await eventsService.getAuditLog(50, 0);
      if (res?.success && res.data) {
        setAuditLogEntries(res.data.data || []);
        setAuditLogTotal(res.data.total || 0);
      }
    } catch (e) {
      toast.error('Failed to load audit log', { description: getErrorMessage(e, 'Could not load audit log') });
      setAuditLogEntries([]);
    } finally {
      setAuditLogLoading(false);
    }
  }, []);

  const handleRevert = async (auditLogId: string) => {
    setRevertingId(auditLogId);
    try {
      await eventsService.revertAuditEntry(auditLogId);
      toast.success('Reverted successfully');
      await loadAuditLog();
    } catch (e) {
      toast.error('Revert failed', { description: getErrorMessage(e, 'Could not revert change') });
    } finally {
      setRevertingId(null);
    }
  };

  const loadDuplicates = useCallback(async () => {
    setDuplicatesLoading(true);
    setDuplicatesLoadError(null);
    try {
      const res = await eventsService.findDuplicates();
      if (res?.success && res.data) {
        setDuplicateGroups(res.data.groups || []);
      }
    } catch (e) {
      const unauthorized = isUnauthorizedError(e);
      const description = unauthorized
        ? 'Your session is missing or expired. Sign in again, then open Find duplicates.'
        : getErrorMessage(e, 'Could not load duplicate groups.');
      toast.error('Failed to load duplicates', { description });
      setDuplicateGroups([]);
      setDuplicatesLoadError(description);
    } finally {
      setDuplicatesLoading(false);
    }
  }, []);

  const handleDuplicateDelete = async (eventId: string) => {
    if (!confirm('Remove this duplicate event? It will be deleted (or marked CANCELLED if it has check-ins/registrations).')) return;
    setDuplicateDeletingId(eventId);
    try {
      await eventsService.delete(eventId);
      toast.success('Duplicate removed');
      await loadDuplicates();
      loadEvents();
    } catch (e) {
      toast.error('Delete failed', { description: getErrorMessage(e, 'Could not delete duplicate') });
    } finally {
      setDuplicateDeletingId(null);
    }
  };

  const handleCorrectAll = async () => {
    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.events.length - 1, 0);
    if (
      !confirm(
        `Correct all duplicates? For each group the earliest-created event will be kept. ${totalDuplicates} duplicate event(s) will be removed. Any check-ins on duplicates will be merged into the kept event.`,
      )
    )
      return;
    setCorrectAllLoading(true);
    try {
      const res = await eventsService.correctAllDuplicates();
      if (res?.success && res.data) {
        toast.success(
          res.message ??
            `Corrected: ${res.data.eventsRemoved} duplicate(s) removed, ${res.data.attendancesMerged} check-in(s) kept.`,
        );
        await loadDuplicates();
        loadEvents();
      }
    } catch (e) {
      toast.error('Correct all failed', { description: getErrorMessage(e, 'Could not correct duplicates') });
    } finally {
      setCorrectAllLoading(false);
    }
  };

  const handleEnsureCommunityWorship = async () => {
    if (!confirm('Generate Community Worship series and occurrences? Creates CW series if missing, generates 24 weeks of Tuesday 19:00-21:00 Manila occurrences.')) {
      return;
    }
    setCwGenerating(true);
    try {
      const res = await eventsService.ensureCommunityWorshipSeries();
      if (res?.success && res.data) {
        toast.success(
          res.message ??
            `CW ${res.data.seriesCreated ? 'series created' : 'series exists'}, ${res.data.occurrencesGenerated} occurrences generated`,
        );
        await loadEvents();
      } else {
        toast.error('CW generation failed', { description: 'Please try again.' });
      }
    } catch (e) {
      toast.error('CW generation failed', { description: getErrorMessage(e, 'Could not generate CW series') });
    } finally {
      setCwGenerating(false);
    }
  };

  const handleEnsureLssShepherding = async () => {
    setLssGenerating(true);
    try {
      const year = new Date().getFullYear().toString();
      const res = await eventsService.ensureLssShepherdingTrack({ year, location: 'BLD Covenant Community Center', venue: 'Main Hall' });
      if (res?.success && res.data) {
        toast.success(`LSS Shepherding track created: ${res.data.eventsCreated} events`);
        await loadEvents();
      } else {
        toast.error('LSS Shepherding setup failed', { description: res.error || 'Please try again.' });
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Unknown error';
      toast.error('LSS Shepherding setup failed', { description: errorMsg });
    } finally {
      setLssGenerating(false);
    }
  };

  // Event grouping
  const { upcomingEvents, ongoingEvents, completedEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: Event[] = [];
    const ongoing: Event[] = [];
    const completed: Event[] = [];

    events.forEach((event) => {
      if (event.status === 'CANCELLED') {
        completed.push(event);
      } else if (isOngoingForDisplay(event, now)) {
        ongoing.push(event);
      } else if (isCompletedPastWindow(event, now) || event.status === 'COMPLETED') {
        completed.push(event);
      } else {
        upcoming.push(event);
      }
    });

    return { upcomingEvents: upcoming, ongoingEvents: ongoing, completedEvents: completed };
  }, [events]);

  const canEdit = ['SUPER_USER', 'ADMINISTRATOR', 'DCS'].includes(userRole);
  const canDelete = ['SUPER_USER', 'ADMINISTRATOR'].includes(userRole);
  const isSuperUser = userRole === 'SUPER_USER';

  if (authLoading) {
    return (
      <>
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Events</h1>
            <p className="text-gray-600 mt-1">Manage and view upcoming events</p>
          </div>
          <Link href="/events/new">
            <Button size="lg" className="h-12">
              <Plus className="w-5 h-5 mr-2" />
              Set up an event
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="ONGOING">Ongoing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="RECURRING">Recurring</SelectItem>
                  <SelectItem value="NON_RECURRING">Non-Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Admin Tools */}
        {canEdit && (
          <Card className="mb-6">
            <CardHeader className="cursor-pointer" onClick={() => setShowAdminTools(!showAdminTools)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Admin Tools
                </CardTitle>
                {showAdminTools ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardHeader>
            {showAdminTools && (
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {/* CW Setup */}
                  <Button
                    variant="outline"
                    onClick={handleEnsureCommunityWorship}
                    disabled={cwGenerating}
                    title="Ensure Community Worship series and generate 24 weeks"
                  >
                    {cwGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calendar className="mr-2 h-4 w-4" />
                    )}
                    CW Setup
                  </Button>

                  {/* LSS Shepherding */}
                  <Button
                    variant="outline"
                    onClick={handleEnsureLssShepherding}
                    disabled={lssGenerating}
                    title="Setup LSS Shepherding track"
                  >
                    {lssGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    LSS Shepherding
                  </Button>

                  {/* Super User Tools */}
                  {isSuperUser && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSuperAllDialog(true);
                          loadSuperAllEvents();
                        }}
                      >
                        <List className="mr-2 h-4 w-4" />
                        All Events
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAuditLogDialog(true);
                          loadAuditLog();
                        }}
                      >
                        <History className="mr-2 h-4 w-4" />
                        Audit Log
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDuplicatesDialog(true);
                          loadDuplicates();
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Find Duplicates
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Events List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : (
          <>
            {/* Ongoing */}
            {ongoingEvents.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Happening Now</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ongoingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEdit(event)}
                      onDelete={() => handleDelete(event.id)}
                      onGenerateQR={() => handleGenerateQR(event.id)}
                      onViewQR={() => handleViewQR(event)}
                      onToggleStatus={() => handleToggleStatus(event.id)}
                      onAssignShepherds={event.encounterType ? () => handleAssignShepherds(event) : undefined}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      userMinistry={userMinistry}
                      isCheckedIn={myCheckInEventIds.has(event.id)}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusBadge={getStatusBadge}
                      displayStatus="ONGOING"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEdit(event)}
                      onDelete={() => handleDelete(event.id)}
                      onGenerateQR={() => handleGenerateQR(event.id)}
                      onViewQR={() => handleViewQR(event)}
                      onToggleStatus={() => handleToggleStatus(event.id)}
                      onAssignShepherds={event.encounterType ? () => handleAssignShepherds(event) : undefined}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      userMinistry={userMinistry}
                      isCheckedIn={myCheckInEventIds.has(event.id)}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusBadge={getStatusBadge}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedEvents.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Completed</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedEvents.slice(0, 6).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEdit(event)}
                      onDelete={() => handleDelete(event.id)}
                      onGenerateQR={() => handleGenerateQR(event.id)}
                      onViewQR={() => handleViewQR(event)}
                      onToggleStatus={() => handleToggleStatus(event.id)}
                      onAssignShepherds={event.encounterType ? () => handleAssignShepherds(event) : undefined}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      userMinistry={userMinistry}
                      isCheckedIn={myCheckInEventIds.has(event.id)}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusBadge={getStatusBadge}
                      displayStatus={event.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED'}
                    />
                  ))}
                </div>
                {completedEvents.length > 6 && (
                  <p className="text-gray-600 mt-4 text-center">
                    Showing 6 of {completedEvents.length} completed events
                  </p>
                )}
              </div>
            )}

            {events.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No events found. Try adjusting your filters.</p>
              </div>
            )}
          </>
        )}

        {/* QR Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code for {selectedEventForQR?.title}</DialogTitle>
              <DialogDescription>Scan this code to check in to the event</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              {selectedEventForQR?.qrCodeUrl && (
                <img src={selectedEventForQR.qrCodeUrl} alt="Event QR Code" className="w-64 h-64" />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Shepherd Assignment Dialog */}
        {selectedEventForShepherds && (
          <ClassShepherdAssignment
            eventId={selectedEventForShepherds.id}
            eventCategory={selectedEventForShepherds.category}
            eventType={selectedEventForShepherds.eventType}
            isOpen={showShepherdDialog}
            onClose={() => {
              setShowShepherdDialog(false);
              setSelectedEventForShepherds(null);
            }}
          />
        )}

        {/* Super User: All events dialog */}
        <Dialog open={showSuperAllDialog} onOpenChange={setShowSuperAllDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                All Events (Super User – cleanup duplicates)
              </DialogTitle>
              <DialogDescription>
                Every event (recurring and non-recurring). Shows who created it and when. Use delete to remove duplicates.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              {superAllLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAllEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.title}</TableCell>
                        <TableCell>{event.category}</TableCell>
                        <TableCell>{formatDate(event.startDate)}</TableCell>
                        <TableCell>{event.isRecurring ? '🔄 Recurring' : 'One-off'}</TableCell>
                        <TableCell className="text-sm">
                          {event.createdBy?.member
                            ? `${event.createdBy.member.firstName} ${event.createdBy.member.lastName}`
                            : event.createdBy?.email || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(event.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSuperDelete(event.id)}
                            disabled={superAllDeletingId === event.id}
                          >
                            {superAllDeletingId === event.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Super User: Event audit log dialog */}
        <Dialog open={showAuditLogDialog} onOpenChange={setShowAuditLogDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Event Audit Log
              </DialogTitle>
              <DialogDescription>
                Track who created, edited, or deleted events. Revert changes if needed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md">
              {auditLogLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              entry.action === 'CREATE'
                                ? 'bg-green-100 text-green-800'
                                : entry.action === 'UPDATE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {entry.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{entry.eventId || 'N/A'}</TableCell>
                        <TableCell className="text-sm">
                          {entry.user?.member
                            ? `${entry.user.member.firstName} ${entry.user.member.lastName}`
                            : entry.userEmail || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(entry.performedAt)}</TableCell>
                        <TableCell>
                          {entry.action === 'DELETE' && !entry.restoredAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevert(entry.id)}
                              disabled={revertingId === entry.id}
                            >
                              {revertingId === entry.id ? 'Reverting...' : 'Revert'}
                            </Button>
                          )}
                          {entry.restoredAt && <span className="text-xs text-green-600">Restored</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Super User: Duplicates dialog */}
        <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Find Duplicate Events
              </DialogTitle>
              <DialogDescription>
                Events that appear to be duplicates. Remove extras to clean up the calendar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md p-4">
              {duplicatesLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : duplicatesLoadError ? (
                <div className="p-8 text-center">
                  <p className="text-red-600">{duplicatesLoadError}</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-600">No duplicates found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-semibold mb-2">Duplicate Group {idx + 1}</h4>
                      <div className="space-y-2">
                        {group.events.map((event) => (
                          <div key={event.id} className="flex items-center justify-between bg-white p-3 rounded border">
                            <div className="flex-1">
                              <p className="font-medium">{event.title}</p>
                              <p className="text-sm text-gray-600">
                                {event.category} | {formatDate(event.startDate)} | {event.isRecurring ? '🔄 Recurring' : 'One-off'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Created: {formatDate(event.createdAt)}
                                {event.createdBy && ` by ${event.createdBy.email || 'Unknown'}`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDuplicateDelete(event.id)}
                              disabled={duplicateDeletingId === event.id}
                            >
                              {duplicateDeletingId === event.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button onClick={handleCorrectAll} disabled={correctAllLoading} variant="default">
                      {correctAllLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Correcting...
                        </>
                      ) : (
                        'Correct All Duplicates'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

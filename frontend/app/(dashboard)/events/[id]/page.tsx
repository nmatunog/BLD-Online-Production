'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, Globe, Edit, Trash2, QrCode, XCircle, Users, DollarSign, CheckCircle, MoreVertical } from 'lucide-react';
import { eventsService, type Event } from '@/services/events.service';
import { attendanceService } from '@/services/attendance.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import EventUpdateScopeDialog from '@/components/events/EventUpdateScopeDialog';
import ClassShepherdAssignment from '@/components/events/ClassShepherdAssignment';
import { isEncounterEvent as checkEncounterEvent } from '@/lib/event-utils';
import { getErrorMessage } from '@/lib/get-error-message';

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [userMinistry, setUserMinistry] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Dialogs
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showShepherdDialog, setShowShepherdDialog] = useState(false);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadEvent();
    checkAuth();
  }, [eventId]);

  const checkAuth = async () => {
    try {
      const res = await attendanceService.getMe();
      if (res?.success && res.data) {
        setIsCheckedIn(res.data.some((c: any) => c.eventId === eventId));
      }
      // Get user profile for role/ministry
      const profileRes = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserRole(profile.data?.role || '');
        setUserMinistry(profile.data?.member?.ministry || null);
      }
    } catch (e) {
      // Silent fail
    }
  };

  const loadEvent = async () => {
    setLoading(true);
    try {
      const res = await eventsService.getById(eventId);
      if (res?.success && res.data) {
        setEvent(res.data);
      } else {
        toast.error('Event not found');
        router.push('/events');
      }
    } catch (e) {
      toast.error('Failed to load event', { description: getErrorMessage(e, 'Could not load event') });
      router.push('/events');
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
      UPCOMING: <Badge className="bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>,
      ONGOING: <Badge className="bg-green-100 text-green-800 border-green-200">Ongoing</Badge>,
      COMPLETED: <Badge className="bg-gray-100 text-gray-800 border-gray-200">Completed</Badge>,
      CANCELLED: <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const handleEdit = () => {
    const isSeriesBacked = event?.isRecurring || event?.recurrenceTemplateId;
    if (isSeriesBacked) {
      setShowScopeDialog(true);
    } else {
      router.push(`/events/${eventId}/edit`);
    }
  };

  const handleScopeSelected = (scope: 'OCCURRENCE' | 'SERIES_FUTURE') => {
    setShowScopeDialog(false);
    router.push(`/events/${eventId}/edit?scope=${scope}`);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await eventsService.delete(eventId);
      if (res?.success) {
        toast.success('Event deleted successfully');
        router.push('/events');
      } else {
        toast.error('Failed to delete event', { description: res.error });
      }
    } catch (e) {
      toast.error('Failed to delete event', { description: getErrorMessage(e, 'Delete operation failed') });
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    try {
      const res = await eventsService.cancel(eventId, cancellationReason);
      if (res?.success) {
        toast.success('Event cancelled successfully');
        setShowCancelDialog(false);
        setCancellationReason('');
        loadEvent();
      } else {
        toast.error('Failed to cancel event', { description: res.error });
      }
    } catch (e) {
      toast.error('Failed to cancel event', { description: getErrorMessage(e, 'Cancel operation failed') });
    }
  };

  const handleGenerateQR = async () => {
    try {
      const res = await eventsService.regenerateQRCode(eventId);
      if (res?.success) {
        toast.success('QR Code generated successfully');
        loadEvent();
      } else {
        toast.error('Failed to generate QR Code', { description: res.error });
      }
    } catch (e) {
      toast.error('Failed to generate QR Code', { description: getErrorMessage(e, 'QR generation failed') });
    }
  };

  if (loading) {
    return (
      <>
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <p>Loading event...</p>
        </div>
      </>
    );
  }

  if (!event) {
    return null;
  }

  const canEdit = ['SUPER_USER', 'ADMINISTRATOR', 'DCS'].includes(userRole) || (userMinistry && event.ministry === userMinistry);
  const canDelete = ['SUPER_USER', 'ADMINISTRATOR'].includes(userRole);
  const isEncounterEvent = checkEncounterEvent(event);

  return (
    <>
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Link href="/events">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
        </Link>

        {/* Event Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-3">{event.title}</CardTitle>
                <div className="flex flex-wrap gap-2 mb-4">
                  {getStatusBadge(event.status)}
                  {event.isRecurring && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200">🔄 Recurring</Badge>
                  )}
                  {event.ministry && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">{event.ministry}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {formatDate(event.startDate)}
                    {event.startDate !== event.endDate && ` – ${formatDate(event.endDate)}`}
                  </p>
                  {event.startTime && (
                    <p className="text-sm text-gray-600">
                      {formatTime(event.startTime)} – {formatTime(event.endTime)}
                    </p>
                  )}
                </div>
              </div>

              {/* Venue */}
              {event.venue && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                  <p className="font-semibold">{event.venue}</p>
                </div>
              )}

              {/* Location */}
              {event.location && event.location !== event.venue && (
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-gray-500 mt-0.5" />
                  <p className="text-gray-600">{event.location}</p>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-gray-700">{event.description}</p>
                </div>
              )}

              {/* Cancellation Notice */}
              {event.status === 'CANCELLED' && event.cancellationReason && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800 mb-1">Event Cancelled</p>
                      <p className="text-sm text-red-700">{event.cancellationReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Checked In Banner */}
              {isCheckedIn && (
                <div className="mt-4 bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-semibold text-green-800">You are already checked in</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {/* Check In */}
              <Link href={`/checkin/self-checkin?eventId=${eventId}`}>
                <Button disabled={isCheckedIn} variant={isCheckedIn ? 'secondary' : 'default'}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isCheckedIn ? 'Checked In' : 'Check In'}
                </Button>
              </Link>

              {/* QR Code */}
              {event.qrCodeUrl ? (
                <Button variant="outline" onClick={() => setShowQRDialog(true)}>
                  <QrCode className="w-4 h-4 mr-2" />
                  View QR Code
                </Button>
              ) : (
                canEdit && (
                  <Button variant="outline" onClick={handleGenerateQR}>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR
                  </Button>
                )
              )}

              {/* Registrations */}
              {event.hasRegistration && (
                <Link href={`/registrations/${eventId}`}>
                  <Button variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Registrations ({event._count?.registrations || 0})
                  </Button>
                </Link>
              )}

              {/* More Actions Dropdown */}
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <MoreVertical className="w-4 h-4 mr-2" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Event
                    </DropdownMenuItem>
                    {isEncounterEvent && (
                      <DropdownMenuItem onClick={() => setShowShepherdDialog(true)}>
                        <Users className="w-4 h-4 mr-2" />
                        Assign Shepherds
                      </DropdownMenuItem>
                    )}
                    {event.hasRegistration && (
                      <DropdownMenuItem asChild>
                        <Link href={`/accounting/${eventId}`} className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-2" />
                          Accounting
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowCancelDialog(true)} className="text-orange-600">
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel Event
                        </DropdownMenuItem>
                      </>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Event
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code for {event.title}</DialogTitle>
              <DialogDescription>Scan this code to check in to the event</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              {event.qrCodeUrl && (
                <img src={event.qrCodeUrl} alt="Event QR Code" className="w-64 h-64" />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Event Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Event</DialogTitle>
              <DialogDescription>
                Please provide a reason for cancelling this event. This will be visible to members.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="cancellation-reason">Cancellation Reason *</Label>
                <Input
                  id="cancellation-reason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Venue unavailable"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Close
              </Button>
              <Button onClick={handleCancel} variant="destructive">
                Cancel Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shepherd Assignment Dialog */}
        {isEncounterEvent && (
          <ClassShepherdAssignment
            eventId={eventId}
            eventCategory={event.category}
            eventType={event.eventType}
            isOpen={showShepherdDialog}
            onClose={() => setShowShepherdDialog(false)}
          />
        )}

        {/* Scope Selection Dialog */}
        <EventUpdateScopeDialog
          isOpen={showScopeDialog}
          onClose={() => setShowScopeDialog(false)}
          onSelectScope={handleScopeSelected}
          eventTitle={event.title}
        />
      </div>
    </>
  );
}

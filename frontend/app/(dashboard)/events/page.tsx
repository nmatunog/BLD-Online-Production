'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Calendar, Filter, X, Edit, Trash2, QrCode, Plus, ArrowLeft, Clock, MapPin, Users, Loader2, MessageSquare, Sparkles, RefreshCw, CheckCircle, Globe, FolderOpen, UserPlus, UserCheck } from 'lucide-react';
import { eventsService, type Event, type EventQueryParams } from '@/services/events.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import DashboardHeader from '@/components/layout/DashboardHeader';
import EventChatbot from '@/components/events/EventChatbot';
import EventCard from '@/components/events/EventCard';
import ClassShepherdAssignment from '@/components/events/ClassShepherdAssignment';
import { eventChatbotService } from '@/services/event-chatbot-service';
import { MINISTRIES_BY_APOSTOLATE } from '@/lib/member-constants';
import { attendanceService } from '@/services/attendance.service';
import {
  isOngoingForDisplay,
  isCompletedPastWindow,
  isWithin7DaysOfEnd,
  isPastEventCategory,
} from '@/lib/event-checkin-window';

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'startDate' | 'title' | 'createdAt'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [userRole, setUserRole] = useState<string>('');
  const [userMinistry, setUserMinistry] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [createMode, setCreateMode] = useState<'form' | 'chatbot'>('form');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedEventForQR, setSelectedEventForQR] = useState<Event | null>(null);
  const [showShepherdDialog, setShowShepherdDialog] = useState(false);
  const [selectedEventForShepherds, setSelectedEventForShepherds] = useState<Event | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedEventForCancel, setSelectedEventForCancel] = useState<Event | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  /** Admin/Super User: include all ministry-specific events (e.g. all WSC). Default: general + my ministry only. */
  const [includeAllMinistryEvents, setIncludeAllMinistryEvents] = useState(false);
  /** Current user's check-ins: set of event IDs (for "You are already Checked In" on cards) */
  const [myCheckInEventIds, setMyCheckInEventIds] = useState<Set<string>>(new Set());
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [pastEventsLoaded, setPastEventsLoaded] = useState(false);
  const [pastSelectValue, setPastSelectValue] = useState('');
  /** Past events user added via dropdown (so we show them in completed section even after 7 days) */
  const [addedPastEventIds, setAddedPastEventIds] = useState<Set<string>>(new Set());
  // Event categories from old system
  const eventCategories = [
    'Community Worship',
    'Word Sharing Circle',
    'Holy Mass',
    'Life in the Spirit Seminar Weekend',
    'LSS Shepherding',
    'Discipling Session',
    'Other Retreat or Recollection',
    'Marriage Encounter',
    'Singles Encounter',
    'Solo Parents Encounter',
    'Family Encounter',
    'Youth Encounter',
    'Growth Seminar',
    'Other Teachings and Seminars',
  ];

  // Categories that are always recurring (weekly)
  const recurringCategories = ['Community Worship', 'Word Sharing Circle'];

  // Normalize legacy "Corporate Worship" to "Community Worship" for display and filtering
  const categoryForDisplay = (category: string) =>
    category === 'Corporate Worship' || category === 'Corporate Worship (Weekly Recurring)'
      ? 'Community Worship'
      : category;
  const categoryMatchesFilter = (eventCategory: string, filter: string) =>
    filter === 'ALL' || eventCategory === filter || (filter === 'Community Worship' && (eventCategory === 'Corporate Worship' || eventCategory === 'Corporate Worship (Weekly Recurring)'));

  // Filter categories based on event type
  const getFilteredCategories = () => {
    if (createForm.eventType === 'RECURRING') {
      // For recurring events, show only recurring categories
      return eventCategories.filter(cat => recurringCategories.includes(cat));
    } else {
      // For non-recurring events, hide recurring categories
      return eventCategories.filter(cat => !recurringCategories.includes(cat));
    }
  };

  const weekDays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  const [createForm, setCreateForm] = useState({
    title: '',
    eventType: 'NON_RECURRING' as 'RECURRING' | 'NON_RECURRING',
    category: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    venue: '',
    status: 'UPCOMING' as 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED',
    hasRegistration: false,
    registrationFee: 0,
    maxParticipants: 0,
    // Encounter Event fields
    encounterType: '',
    classNumber: '',
    // Recurring event fields
    isRecurring: false,
    recurrencePattern: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurrenceDays: [] as string[],
    recurrenceInterval: 1,
    recurrenceEndDate: '',
    // Monthly recurrence fields
    monthlyType: '' as 'dayOfMonth' | 'dayOfWeek' | '',
    monthlyDayOfMonth: '',
    monthlyWeekOfMonth: '',
    monthlyDayOfWeek: '',
    ministry: '',
  });

  // Check authentication and permissions
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      
      if (!authService.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Get user role and member ministry from localStorage
      const authData = localStorage.getItem('authData');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          setUserRole(parsed.user?.role || '');
          setUserMinistry(parsed.member?.ministry ?? null);
        } catch (error) {
          console.error('Error parsing auth data:', error);
        }
      }
      
      setAuthLoading(false);
      loadEvents();
      // Load current user's check-ins for "You are already Checked In" on cards
      attendanceService.getMe().then((res) => {
        if (res.success && res.data && Array.isArray(res.data)) {
          const ids: string[] = res.data
            .map((a: { eventId?: string; event?: { id: string } }) => a.eventId ?? a.event?.id)
            .filter((id): id is string => typeof id === 'string');
          setMyCheckInEventIds(new Set<string>(ids));
        }
      }).catch(() => {});
    };

    checkAuth();

    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, [router]);

  const allowedRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR'];
  const isMember = userRole === 'MEMBER';
  const canAccess = !authLoading && (allowedRoles.includes(userRole) || isMember);
  const canCreate = !authLoading && allowedRoles.includes(userRole); // Only admins can create
  const canEdit = !authLoading && allowedRoles.includes(userRole); // Only admins can edit
  const canDelete = userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS';

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
        includeAllMinistryEvents: (userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') ? includeAllMinistryEvents : undefined,
      };

      const result = await eventsService.getAll(params);
      if (result.success && result.data) {
        setEvents(Array.isArray(result.data.data) ? result.data.data : []);
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEvents();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterStatus, filterType, includeAllMinistryEvents, userRole]);

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

  // Get unique values for filters (normalize legacy Corporate Worship → Community Worship)
  const uniqueTypes = useMemo(() => {
    const types = new Set(events.map(e => categoryForDisplay(e.category)).filter(Boolean));
    return Array.from(types).sort();
  }, [events]);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(event => {
        const title = event.title?.toLowerCase() || '';
        const location = event.location?.toLowerCase() || '';
        const venue = event.venue?.toLowerCase() || '';
        const description = event.description?.toLowerCase() || '';
        return title.includes(searchLower) || location.includes(searchLower) || venue.includes(searchLower) || description.includes(searchLower);
      });
    }

    // Apply status filter
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(event => event.status === filterStatus);
    }

    // Apply category filter (treat legacy Corporate Worship as Community Worship)
    if (filterType !== 'ALL') {
      filtered = filtered.filter(event => categoryMatchesFilter(event.category, filterType));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'startDate':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [events, searchTerm, filterStatus, filterType, sortBy, sortOrder]);

  // Group events: ongoing (in check-in window) first, then upcoming, then completed within 7 days. Hide completed past 7 days from main list.
  const groupedEvents = useMemo(() => {
    const grouped = {
      upcoming: [] as Event[],
      ongoing: [] as Event[],
      completed: [] as Event[],
      cancelled: [] as Event[],
    };

    filteredEvents.forEach(event => {
      if (event.status === 'CANCELLED') {
        grouped.cancelled.push(event);
        return;
      }
      const ongoingDisplay = isOngoingForDisplay(event, currentTime);
      const pastWindow = isCompletedPastWindow(event, currentTime);
      const within7 = isWithin7DaysOfEnd(event, currentTime);

      if (ongoingDisplay) {
        grouped.ongoing.push(event);
      } else if (pastWindow) {
        if (within7 || addedPastEventIds.has(event.id)) grouped.completed.push(event);
      } else {
        grouped.upcoming.push(event);
      }
    });

    return grouped;
  }, [filteredEvents, currentTime, addedPastEventIds]);

  // Format date for display
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

  // Format time for display
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

  // Get status badge variant - matching old system colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CANCELLED':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 px-3 py-1 text-xs font-semibold">
            CANCELLED
          </Badge>
        );
      case 'UPCOMING':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 text-base px-3 py-1 font-semibold border border-red-300">Upcoming</Badge>;
      case 'ONGOING':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 text-base px-3 py-1 font-semibold border border-orange-300">Ongoing</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-base px-3 py-1 font-semibold border border-green-300">Completed</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 text-base px-3 py-1 font-semibold border border-red-300">CANCELLED</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 text-base px-3 py-1 border border-gray-300">{status}</Badge>;
    }
  };

  const handleCancelEvent = (event: Event) => {
    setSelectedEventForCancel(event);
    setCancellationReason('');
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedEventForCancel) return;

    try {
      const result = await eventsService.cancel(
        selectedEventForCancel.id,
        cancellationReason.trim() || undefined,
      );

      if (result.success) {
        toast.success('Event Cancelled', {
          description: 'The event has been cancelled successfully.',
        });
        setShowCancelDialog(false);
        setSelectedEventForCancel(null);
        setCancellationReason('');
        loadEvents();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel event';
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await eventsService.delete(id);
      toast.success('Event Deleted', {
        description: 'The event has been deleted successfully.',
      });
      loadEvents();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete event';
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleViewQR = (event: Event) => {
    if (!event.qrCodeUrl) {
      toast.error('QR Code Not Available', {
        description: 'Please generate a QR code first.',
      });
      return;
    }
    setSelectedEventForQR(event);
    setShowQRDialog(true);
  };

  const handleRegenerateQR = async (id: string) => {
    try {
      await eventsService.regenerateQRCode(id);
      toast.success('QR Code Regenerated', {
        description: 'The QR code has been regenerated successfully.',
      });
      loadEvents();
      // If the QR dialog is open for this event, update it
      const updatedEvent = events.find(e => e.id === id);
      if (updatedEvent && selectedEventForQR?.id === id) {
        setSelectedEventForQR(updatedEvent);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate QR code';
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const handleDownloadQR = async () => {
    if (!selectedEventForQR?.qrCodeUrl) return;
    
    try {
      // Create canvas for combined image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas size (vertical layout - QR code on top)
      const qrSize = 400; // QR code size
      const padding = 50;
      const maxTextWidth = 600;
      const canvasWidth = qrSize + padding * 2;
      let canvasHeight = padding; // Start with top padding

      // Calculate text heights first
      ctx.font = 'bold 36px Arial, sans-serif';
      const titleHeight = 50;
      ctx.font = '20px Arial, sans-serif';
      const subtitleHeight = 30;
      ctx.font = '24px Arial, sans-serif';
      const detailLabelHeight = 35;
      ctx.font = '20px Arial, sans-serif';
      const detailValueHeight = 30;
      ctx.font = '16px Arial, sans-serif';
      const instructionHeight = 40;

      // Calculate total height needed
      canvasHeight += titleHeight + 20; // Title + spacing
      canvasHeight += subtitleHeight + 30; // Subtitle + spacing
      canvasHeight += qrSize + 30; // QR code + spacing
      canvasHeight += detailLabelHeight + detailValueHeight; // Event
      canvasHeight += detailLabelHeight + detailValueHeight; // Date
      if (selectedEventForQR.startTime) {
        canvasHeight += detailLabelHeight + detailValueHeight; // Time
      }
      canvasHeight += instructionHeight + padding; // Instruction + bottom padding
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      let currentY = padding;

      // Title
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Event QR Code', canvasWidth / 2, currentY);
      currentY += titleHeight + 20;

      // Subtitle
      ctx.fillStyle = '#6B7280';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText('Scan this QR code to check in to the event', canvasWidth / 2, currentY);
      currentY += subtitleHeight + 30;

      // Load QR code image
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => {
          // Draw QR code centered
          const qrX = (canvasWidth - qrSize) / 2;
          const qrY = currentY;
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
          
          // Add border around QR code
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 2;
          ctx.strokeRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
          
          resolve();
        };
        qrImage.onerror = reject;
        qrImage.src = selectedEventForQR.qrCodeUrl || '';
      });

      currentY += qrSize + 30;

      // Event information below QR code (centered)
      ctx.textAlign = 'center';
      const centerX = canvasWidth / 2;

      // Event Title
      ctx.fillStyle = '#111827';
      ctx.font = '24px Arial, sans-serif';
      ctx.fillText(`Event: ${selectedEventForQR.title}`, centerX, currentY);
      currentY += detailValueHeight + 15;

      // Date
      ctx.fillText(`Date: ${formatDate(selectedEventForQR.startDate)}`, centerX, currentY);
      currentY += detailValueHeight + 15;

      // Time (if available)
      if (selectedEventForQR.startTime) {
        ctx.fillText(`Time: ${formatTime(selectedEventForQR.startTime)}`, centerX, currentY);
        currentY += detailValueHeight + 15;
      }

      // Instruction text at bottom (in a box)
      const instructionY = canvasHeight - padding - instructionHeight;
      const instructionBoxHeight = instructionHeight + 20;
      const instructionBoxY = instructionY - 10;
      
      // Draw instruction box background
      ctx.fillStyle = '#F9FAFB';
      ctx.fillRect(padding, instructionBoxY, canvasWidth - padding * 2, instructionBoxHeight);
      
      // Draw instruction text
      ctx.fillStyle = '#6B7280';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('This QR code can be scanned for event check-in', centerX, instructionY + 5);

      // Convert canvas to image and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create image blob');
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `event-qr-${selectedEventForQR.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${selectedEventForQR.id}.png`;
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        toast.success('QR Code Downloaded', {
          description: 'The QR code with event details has been downloaded successfully.',
        });
      }, 'image/png');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast.error('Download Failed', {
        description: error instanceof Error ? error.message : 'Failed to download QR code with event details.',
      });
    }
  };

  const handleToggleStatus = async (id: string) => {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const newStatus = event.status === 'UPCOMING' ? 'COMPLETED' : 'UPCOMING';

    try {
      await eventsService.update(id, { status: newStatus });
      toast.success('Event Status Updated', {
        description: `Event status updated to ${newStatus}`,
      });
      loadEvents();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update event status';
      toast.error('Error', {
        description: errorMessage,
      });
    }
  };

  const resetForm = () => {
    setCreateForm({
      title: '',
      eventType: 'NON_RECURRING',
      category: '',
      description: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      venue: '',
      status: 'UPCOMING',
      hasRegistration: false,
      registrationFee: 0,
      maxParticipants: 0,
      encounterType: '',
      classNumber: '',
      isRecurring: false,
      recurrencePattern: 'weekly',
      recurrenceDays: [],
      recurrenceInterval: 1,
      recurrenceEndDate: '',
      monthlyType: '',
      monthlyDayOfMonth: '',
      monthlyWeekOfMonth: '',
      monthlyDayOfWeek: '',
      ministry: '',
    });
  };

  const populateFormFromEvent = (event: Event) => {
    const isRecurring = event.isRecurring || false;
    const eventType = isRecurring ? 'RECURRING' : 'NON_RECURRING';
    
    setCreateForm({
      title: event.title || '',
      eventType,
      category: event.category || '',
      description: event.description || '',
      startDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '',
      endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      venue: event.venue || '',
      status: event.status || 'UPCOMING',
      hasRegistration: event.hasRegistration || false,
      registrationFee: event.registrationFee || 0,
      maxParticipants: event.maxParticipants || 0,
      encounterType: event.encounterType || '',
      classNumber: event.classNumber ? event.classNumber.toString() : '',
      isRecurring,
      recurrencePattern: (event.recurrencePattern as 'daily' | 'weekly' | 'monthly') || 'weekly',
      recurrenceDays: event.recurrenceDays || [],
      recurrenceInterval: event.recurrenceInterval || 1,
      recurrenceEndDate: '',
      monthlyType: (event.monthlyType as 'dayOfMonth' | 'dayOfWeek' | '') || '',
      monthlyDayOfMonth: event.monthlyDayOfMonth ? event.monthlyDayOfMonth.toString() : '',
      monthlyWeekOfMonth: event.monthlyWeekOfMonth ? event.monthlyWeekOfMonth.toString() : '',
      monthlyDayOfWeek: event.monthlyDayOfWeek || '',
      ministry: event.ministry || '',
    });
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    populateFormFromEvent(event);
    setShowEditDialog(true);
  };

  const handleCreateEvent = async () => {
    // Basic field validation
    if (!createForm.title || !createForm.eventType || !createForm.category || !createForm.startDate || !createForm.endDate || !createForm.location) {
      toast.error('Missing Required Fields', {
        description: 'Please fill in all required fields (Title, Event Type, Category, Start Date, End Date, Location)',
      });
      return;
    }

    // Validate date and time combination
    const startDate = new Date(createForm.startDate);
    const endDate = new Date(createForm.endDate);
    
    // Combine date with time if time is provided
    let actualStartDateTime = new Date(startDate);
    let actualEndDateTime = new Date(endDate);

    if (createForm.startTime) {
      const [hours, minutes] = createForm.startTime.split(':').map(Number);
      actualStartDateTime = new Date(startDate);
      actualStartDateTime.setHours(hours, minutes, 0, 0);
    }

    if (createForm.endTime) {
      const [hours, minutes] = createForm.endTime.split(':').map(Number);
      actualEndDateTime = new Date(endDate);
      actualEndDateTime.setHours(hours, minutes, 0, 0);
    }

    // Validate that end date/time is after start date/time
    if (actualStartDateTime >= actualEndDateTime) {
      if (createForm.startDate === createForm.endDate && createForm.startTime && createForm.endTime) {
        toast.error('Invalid Times', {
          description: 'End time must be after start time when dates are the same.',
        });
      } else {
        toast.error('Invalid Date/Time', {
          description: 'End date/time must be after start date/time.',
        });
      }
      return;
    }

    // Validate recurring event fields
    if (createForm.eventType === 'RECURRING') {
      if (createForm.recurrencePattern === 'weekly' && createForm.recurrenceDays.length === 0) {
        toast.error('Missing Recurrence Days', {
          description: 'Please select at least one day of the week for weekly recurring events.',
        });
        return;
      }
    }

    try {
      // Check if this is an Encounter Event
      const isEncounterEvent = [
        'Marriage Encounter',
        'Singles Encounter',
        'Solo Parents Encounter',
        'Family Encounter',
        'Youth Encounter',
      ].includes(createForm.category);

      // Validate Encounter Event fields
      if (isEncounterEvent) {
        if (!createForm.encounterType) {
          toast.error('Encounter Type Required', {
            description: 'Please select an Encounter Type for Encounter Events.',
          });
          return;
        }
        if (!createForm.classNumber) {
          toast.error('Class Number Required', {
            description: 'Please enter a Class Number for Encounter Events.',
          });
          return;
        }
        const classNum = parseInt(createForm.classNumber, 10);
        if (isNaN(classNum) || classNum < 1 || classNum > 999) {
          toast.error('Invalid Class Number', {
            description: 'Class Number must be between 1 and 999.',
          });
          return;
        }
      }

      // Prepare event data with proper type conversions
      const eventData: any = {
        title: createForm.title.trim(),
        // Map eventType: 'RECURRING'/'NON_RECURRING' to actual event type string
        // For now, use category or a default value - backend expects a string
        eventType: createForm.category || 'GENERAL', // Use category as eventType, or default to 'GENERAL'
        category: createForm.category,
        description: createForm.description?.trim() || undefined,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        startTime: createForm.startTime?.trim() || undefined,
        endTime: createForm.endTime?.trim() || undefined,
        location: createForm.location.trim(),
        venue: createForm.venue?.trim() || undefined,
        status: createForm.status,
        hasRegistration: createForm.hasRegistration,
        ministry: createForm.ministry?.trim() || undefined,
      };

      // Add Encounter Event fields if applicable
      if (isEncounterEvent && createForm.encounterType && createForm.classNumber) {
        eventData.encounterType = createForm.encounterType;
        eventData.classNumber = parseInt(createForm.classNumber, 10);
      }

      // Add registration fields only if registration is enabled
      if (createForm.hasRegistration) {
        // Convert to numbers, ensure they're valid
        const fee = Number(createForm.registrationFee);
        const max = Number(createForm.maxParticipants);
        eventData.registrationFee = !isNaN(fee) && fee >= 0 ? fee : undefined;
        eventData.maxParticipants = !isNaN(max) && max > 0 ? max : undefined;
      } else {
        // Explicitly set to undefined if registration is disabled
        eventData.registrationFee = undefined;
        eventData.maxParticipants = undefined;
      }

      // Add recurring fields only if it's a recurring event
      if (createForm.eventType === 'RECURRING') {
        eventData.isRecurring = true;
        eventData.recurrencePattern = createForm.recurrencePattern;
        eventData.recurrenceDays = createForm.recurrenceDays || [];
        eventData.recurrenceInterval = createForm.recurrenceInterval || 1;
        
        // Monthly recurrence fields
        if (createForm.recurrencePattern === 'monthly') {
          if (createForm.monthlyType) {
            eventData.monthlyType = createForm.monthlyType;
            if (createForm.monthlyType === 'dayOfMonth' && createForm.monthlyDayOfMonth) {
              eventData.monthlyDayOfMonth = Number(createForm.monthlyDayOfMonth);
            }
            if (createForm.monthlyType === 'dayOfWeek') {
              if (createForm.monthlyWeekOfMonth) {
                eventData.monthlyWeekOfMonth = Number(createForm.monthlyWeekOfMonth);
              }
              if (createForm.monthlyDayOfWeek) {
                eventData.monthlyDayOfWeek = createForm.monthlyDayOfWeek;
              }
            }
          }
        }
      } else {
        eventData.isRecurring = false;
      }

      if (editingEvent) {
        // Update existing event
        const result = await eventsService.update(editingEvent.id, eventData);
        if (result.success) {
          toast.success('Event Updated', {
            description: 'The event has been updated successfully.',
          });
          setShowEditDialog(false);
          setEditingEvent(null);
          resetForm();
          loadEvents();
        }
      } else {
        // Create new event
        const result = await eventsService.create(eventData);
        if (result.success) {
          toast.success('Event Created', {
            description: 'The event has been created successfully.',
          });
          setShowCreateDialog(false);
          resetForm();
          loadEvents();
        }
      }
    } catch (error: any) {
      // Extract validation errors from backend response
      let errorMessage = 'Failed to save event';
      
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
      
      toast.error('Validation Error', {
        description: errorMessage,
        duration: 5000,
      });
      
      console.error('Event creation error:', error);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-rose-600" />
          <div className="text-2xl text-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Only show access denied after auth check is complete
  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-3xl font-bold mb-2 text-card-foreground">Access Denied</h2>
            <p className="text-xl text-muted-foreground mb-4">
              You don't have permission to access Events Management.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-6 py-6">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        {/* Date and Time Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 md:p-5 mb-6 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-white/20 p-3 rounded-lg mr-4">
                <Calendar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-red-100 mb-1">
                  Today's Date & Time
                </p>
                <p className="text-base md:text-xl font-bold truncate">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} at {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
              Events Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">Manage and organize your community events</p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            {canCreate && (
              <>
                <Button 
                  onClick={() => {
                    setCreateMode('form');
                    setShowCreateDialog(true);
                  }}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-2.5 rounded-lg hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2 text-sm md:text-base font-medium"
                >
                  <Plus className="w-5 h-5" />
                  <span>Create Event</span>
                </Button>
                <Button 
                  onClick={async () => {
                    setLoading(true);
                    await loadEvents();
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="bg-white border-2 border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2 text-sm md:text-base font-medium"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                <Button 
                  onClick={() => {
                    setCreateMode('chatbot');
                    setShowChatbot(true);
                  }}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-2.5 rounded-lg hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2 text-sm md:text-base font-medium"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>AI Assistant</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <Search className="w-4 h-4 mr-2" />
            Filters & Search
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Search className="w-4 h-4 mr-2" />
                Search Events
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or location..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
            </div>

            {/* Filter by Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                Filter by Status
              </label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="ONGOING">Ongoing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <FolderOpen className="w-4 h-4 mr-2" />
                Filter by Category
              </label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-white">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg max-h-[300px]">
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Admin/Super User: Include all ministry-specific events (e.g. all WSC) */}
            {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') && (
              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAllMinistryEvents}
                    onChange={(e) => setIncludeAllMinistryEvents(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700">View ministry-specific events (e.g. all WSC)</span>
                </label>
                <span className="text-xs text-gray-500">Default: general + your ministry only</span>
              </div>
            )}
          </div>
        </div>

        {/* Ongoing Events (in check-in window: 2hr before start → 2hr after end) — first card/section */}
        {groupedEvents.ongoing.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-orange-500 rounded-full mr-3"></span>
                <span className="bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">Ongoing Events</span>
                <span className="ml-3 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">{groupedEvents.ongoing.length}</span>
              </h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedEvents.ongoing.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={() => handleEditEvent(event)}
                  onDelete={() => handleDelete(event.id)}
                  onCancel={() => handleCancelEvent(event)}
                  onGenerateQR={() => handleRegenerateQR(event.id)}
                  onViewQR={() => handleViewQR(event)}
                  onToggleStatus={() => handleToggleStatus(event.id)}
                  onAssignShepherds={() => {
                    setSelectedEventForShepherds(event);
                    setShowShepherdDialog(true);
                  }}
                  onCreateRegistration={() => {
                    router.push(`/event-registrations?eventId=${event.id}`);
                  }}
                  onViewAccounting={() => {
                    router.push(`/accounting/${event.id}`);
                  }}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isMember={isMember}
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

        {/* Upcoming Events */}
        {groupedEvents.upcoming.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                <span className="bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">Upcoming Events</span>
                <span className="ml-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">{groupedEvents.upcoming.length}</span>
              </h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedEvents.upcoming.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={() => handleEditEvent(event)}
                  onDelete={() => handleDelete(event.id)}
                  onCancel={() => handleCancelEvent(event)}
                  onGenerateQR={() => handleRegenerateQR(event.id)}
                  onViewQR={() => handleViewQR(event)}
                  onToggleStatus={() => handleToggleStatus(event.id)}
                  onAssignShepherds={() => {
                    setSelectedEventForShepherds(event);
                    setShowShepherdDialog(true);
                  }}
                  onCreateRegistration={() => {
                    router.push(`/event-registrations?eventId=${event.id}`);
                  }}
                  onViewAccounting={() => {
                    router.push(`/accounting/${event.id}`);
                  }}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isMember={isMember}
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

        {/* Completed Events (within 7 days of end) */}
        {groupedEvents.completed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                <span className="bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">Completed Events</span>
                <span className="ml-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">{groupedEvents.completed.length}</span>
              </h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedEvents.completed.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={() => handleEditEvent(event)}
                  onDelete={() => handleDelete(event.id)}
                  onCancel={() => handleCancelEvent(event)}
                  onGenerateQR={() => handleRegenerateQR(event.id)}
                  onViewQR={() => handleViewQR(event)}
                  onToggleStatus={() => handleToggleStatus(event.id)}
                  onAssignShepherds={() => {
                    setSelectedEventForShepherds(event);
                    setShowShepherdDialog(true);
                  }}
                  onCreateRegistration={() => {
                    router.push(`/event-registrations?eventId=${event.id}`);
                  }}
                  onViewAccounting={() => {
                    router.push(`/accounting/${event.id}`);
                  }}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isMember={isMember}
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

        {/* Past events (Community Worship / Word Sharing Circle, past 10) */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <label className="text-sm font-medium text-gray-700 block mb-2">Past events (Community Worship / Word Sharing Circle)</label>
          <Select
            onOpenChange={(open) => open && loadPastEvents()}
            value={pastSelectValue || undefined}
            onValueChange={(v) => {
              if (v && v !== '_none') {
                const pastEvent = pastEvents.find((e) => e.id === v);
                if (pastEvent) {
                  setEvents((prev) => (prev.some((e) => e.id === v) ? prev : [pastEvent, ...prev]));
                  setAddedPastEventIds((prev) => new Set(prev).add(v));
                }
                setPastSelectValue('');
              }
            }}
          >
            <SelectTrigger className="w-full max-w-md bg-white">
              <SelectValue placeholder="View a past event (past 10)…" />
            </SelectTrigger>
            <SelectContent>
              {pastEvents.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title} — {formatDate(e.startDate)}
                </SelectItem>
              ))}
              {pastEventsLoaded && pastEvents.length === 0 && (
                <SelectItem value="_none" disabled>No past events found</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <Calendar className="w-20 h-20 mx-auto mb-4 text-gray-400" />
            <div className="text-2xl font-semibold text-gray-900 mb-2">No events found</div>
            <div className="text-lg text-gray-600">
              {searchTerm || filterStatus !== 'ALL' || filterType !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Start by creating your first event'}
            </div>
          </div>
        )}

        {/* Create Event Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl p-0">
            <DialogHeader className="bg-white border-b border-gray-200 p-6">
              <DialogTitle className="text-xl font-semibold text-gray-900">Create New Event</DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Fill in the details to create a new event
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6 px-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="create-title" className="text-base font-semibold text-gray-700">Title *</Label>
                  <Input
                    id="create-title"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Event Title"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-eventType" className="text-2xl font-bold text-gray-700">Event Type *</Label>
                  <Select
                    value={createForm.eventType}
                    onValueChange={(v) => {
                      const isRecurring = v === 'RECURRING';
                      // Clear category if switching event type and current category doesn't match
                      const currentCategoryMatches = isRecurring 
                        ? recurringCategories.includes(createForm.category)
                        : !recurringCategories.includes(createForm.category);
                      
                      setCreateForm({
                        ...createForm,
                        eventType: v as 'RECURRING' | 'NON_RECURRING',
                        isRecurring,
                        // Clear category if it doesn't match the new event type
                        category: currentCategoryMatches ? createForm.category : '',
                        // Set default recurrence pattern if switching to recurring
                        recurrencePattern: isRecurring ? (createForm.recurrencePattern || 'weekly') : createForm.recurrencePattern,
                        recurrenceInterval: isRecurring ? (createForm.recurrenceInterval || 1) : createForm.recurrenceInterval,
                        // Clear encounter fields if category is cleared
                        encounterType: currentCategoryMatches ? createForm.encounterType : '',
                        classNumber: currentCategoryMatches ? createForm.classNumber : '',
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                      <SelectItem value="NON_RECURRING">Non-Recurring</SelectItem>
                      <SelectItem value="RECURRING">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-category" className="text-2xl font-bold text-gray-700">Category *</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(v) => {
                      const isRecurringCategory = recurringCategories.includes(v);
                      const isEncounterCategory = [
                        'Marriage Encounter',
                        'Singles Encounter',
                        'Solo Parents Encounter',
                        'Family Encounter',
                        'Youth Encounter',
                      ].includes(v);
                      
                      setCreateForm({
                        ...createForm,
                        category: v,
                        // Auto-set to recurring if Community Worship or Word Sharing Circle
                        eventType: isRecurringCategory ? 'RECURRING' : createForm.eventType,
                        isRecurring: isRecurringCategory ? true : createForm.isRecurring,
                        recurrencePattern: isRecurringCategory ? 'weekly' : createForm.recurrencePattern,
                        recurrenceInterval: isRecurringCategory ? 1 : createForm.recurrenceInterval,
                        // Clear encounter fields if not an encounter category
                        encounterType: isEncounterCategory ? createForm.encounterType : '',
                        classNumber: isEncounterCategory ? createForm.classNumber : '',
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg max-h-[300px]">
                      {getFilteredCategories().map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                          {recurringCategories.includes(category) && ' (Weekly Recurring)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getFilteredCategories().length === 0 && (
                    <p className="text-sm text-gray-600">
                      {createForm.eventType === 'RECURRING' 
                        ? 'No recurring categories available. Please select "Non-Recurring" event type for other categories.'
                        : 'No non-recurring categories available. Please select "Recurring" event type for recurring categories.'}
                    </p>
                  )}
                </div>
                <div className={`space-y-3 ${createForm.category === 'Word Sharing Circle' ? 'md:col-span-2 p-3 rounded-lg bg-purple-50 border border-purple-200' : ''}`}>
                  <Label htmlFor="create-ministry" className={`font-bold text-gray-700 ${createForm.category === 'Word Sharing Circle' ? 'text-lg text-purple-800' : 'text-2xl'}`}>
                    {createForm.category === 'Word Sharing Circle' ? 'Ministry (required for WSC)' : 'Ministry (optional)'}
                  </Label>
                  <p className="text-sm text-gray-500">
                    {createForm.category === 'Word Sharing Circle'
                      ? 'Word Sharing Circle events are per ministry. Select the ministry for this WSC.'
                      : 'For ministry-specific events (e.g. Word Sharing Circle). Leave empty for general events.'}
                  </p>
                  <Select
                    value={createForm.ministry || 'NONE'}
                    onValueChange={(v) => setCreateForm({ ...createForm, ministry: v === 'NONE' ? '' : v })}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder={createForm.category === 'Word Sharing Circle' ? 'Select ministry...' : 'General (all members)'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg max-h-[300px]">
                      <SelectItem value="NONE">General (all members)</SelectItem>
                      {Object.values(MINISTRIES_BY_APOSTOLATE).flat().map((ministry) => (
                        <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-status" className="text-2xl font-bold text-gray-700">Status</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(v) => setCreateForm({ ...createForm, status: v as typeof createForm.status })}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                      <SelectItem value="UPCOMING">Upcoming</SelectItem>
                      <SelectItem value="ONGOING">Ongoing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-startDate" className="text-2xl font-bold text-gray-700">Start Date *</Label>
                  <Input
                    id="create-startDate"
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-endDate" className="text-2xl font-bold text-gray-700">End Date *</Label>
                  <Input
                    id="create-endDate"
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-startTime" className="text-2xl font-bold text-gray-700">Start Time</Label>
                  <Input
                    id="create-startTime"
                    type="time"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-endTime" className="text-2xl font-bold text-gray-700">End Time</Label>
                  <Input
                    id="create-endTime"
                    type="time"
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-location" className="text-2xl font-bold text-gray-700">Location *</Label>
                  <Input
                    id="create-location"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Event Location"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-venue" className="text-2xl font-bold text-gray-700">Venue</Label>
                  <Input
                    id="create-venue"
                    value={createForm.venue}
                    onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Specific venue or room"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="create-description" className="text-2xl font-bold text-gray-700">Description</Label>
                <textarea
                  id="create-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full min-h-[100px] p-3 text-lg border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Event description..."
                />
              </div>

              {/* Encounter Event Fields */}
              {['Marriage Encounter', 'Singles Encounter', 'Solo Parents Encounter', 'Family Encounter', 'Youth Encounter'].includes(createForm.category) && (
                <div className="space-y-4 border-t border-gray-200 pt-6 bg-red-50 p-4 rounded-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>👥</span>
                    <span>Encounter Class Information</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="create-encounterType" className="text-base font-semibold text-gray-700">
                        Encounter Type *
                      </Label>
                      <Select
                        value={createForm.encounterType}
                        onValueChange={(v) => setCreateForm({ ...createForm, encounterType: v })}
                      >
                        <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                          <SelectValue placeholder="Select encounter type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                          <SelectItem value="ME">Marriage Encounter (ME)</SelectItem>
                          <SelectItem value="SE">Singles Encounter (SE)</SelectItem>
                          <SelectItem value="SPE">Solo Parents Encounter (SPE)</SelectItem>
                          <SelectItem value="FE">Family Encounter (FE)</SelectItem>
                          <SelectItem value="YE">Youth Encounter (YE)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="create-classNumber" className="text-base font-semibold text-gray-700">
                        Class Number *
                      </Label>
                      <Input
                        id="create-classNumber"
                        type="number"
                        min="1"
                        max="999"
                        value={createForm.classNumber}
                        onChange={(e) => setCreateForm({ ...createForm, classNumber: e.target.value })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g., 18, 101"
                      />
                      <p className="text-sm text-gray-600">
                        Enter the class number for this encounter (e.g., 18 for ME Class 18)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recurring Event Fields */}
              {createForm.eventType === 'RECURRING' && (
                <div className="space-y-4 border-t border-gray-200 pt-6 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Recurrence Settings</h3>
                  
                  <div className="space-y-3">
                    <Label htmlFor="create-recurrencePattern" className="text-base font-semibold text-gray-700">Recurrence Pattern *</Label>
                    <Select
                      value={createForm.recurrencePattern}
                      onValueChange={(v) => setCreateForm({ ...createForm, recurrencePattern: v as 'daily' | 'weekly' | 'monthly' })}
                    >
                      <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createForm.recurrencePattern === 'weekly' && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">Days of Week *</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {weekDays.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`recurrence-${day.value}`}
                              checked={createForm.recurrenceDays.includes(day.value)}
                              onChange={(e) => {
                                const newDays = e.target.checked
                                  ? [...createForm.recurrenceDays, day.value]
                                  : createForm.recurrenceDays.filter((d) => d !== day.value);
                                setCreateForm({ ...createForm, recurrenceDays: newDays });
                              }}
                              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <Label htmlFor={`recurrence-${day.value}`} className="text-lg text-gray-700 cursor-pointer">
                              {day.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {createForm.recurrenceDays.length === 0 && (
                        <p className="text-sm text-red-600">Please select at least one day</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label htmlFor="create-recurrenceInterval" className="text-base font-semibold text-gray-700">Repeat Every</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="create-recurrenceInterval"
                        type="number"
                        min="1"
                        value={createForm.recurrenceInterval}
                        onChange={(e) => setCreateForm({ ...createForm, recurrenceInterval: parseInt(e.target.value) || 1 })}
                        className="h-12 text-base border border-gray-300 bg-white w-24 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                      <span className="text-lg text-gray-700">
                        {createForm.recurrencePattern === 'daily' ? 'day(s)' :
                         createForm.recurrencePattern === 'weekly' ? 'week(s)' :
                         'month(s)'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="create-recurrenceEndDate" className="text-base font-semibold text-gray-700">Recurrence End Date</Label>
                    <Input
                      id="create-recurrenceEndDate"
                      type="date"
                      value={createForm.recurrenceEndDate}
                      onChange={(e) => setCreateForm({ ...createForm, recurrenceEndDate: e.target.value })}
                      className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      min={createForm.startDate}
                    />
                    <p className="text-sm text-gray-600">Leave empty for no end date</p>
                  </div>
                </div>
              )}
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="create-hasRegistration"
                    checked={createForm.hasRegistration}
                    onChange={(e) => setCreateForm({ ...createForm, hasRegistration: e.target.checked })}
                    className="w-6 h-6"
                  />
                  <Label htmlFor="create-hasRegistration" className="text-base font-semibold cursor-pointer text-gray-700">
                    Requires Registration
                  </Label>
                </div>
                {createForm.hasRegistration && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="create-registrationFee" className="text-base font-semibold text-gray-700">Registration Fee</Label>
                      <Input
                        id="create-registrationFee"
                        type="number"
                        min="0"
                        value={createForm.registrationFee}
                        onChange={(e) => setCreateForm({ ...createForm, registrationFee: parseInt(e.target.value) || 0 })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="create-maxParticipants" className="text-base font-semibold text-gray-700">Max Participants</Label>
                      <Input
                        id="create-maxParticipants"
                        type="number"
                        min="1"
                        value={createForm.maxParticipants}
                        onChange={(e) => setCreateForm({ ...createForm, maxParticipants: parseInt(e.target.value) || 0 })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  size="lg"
                  className="text-base px-6 py-3 h-auto bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  size="lg"
                  className="text-base px-6 py-3 h-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
                  Create Event
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Event Dialog - Reuses same form structure */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingEvent(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl p-0">
            <DialogHeader className="bg-white border-b border-gray-200 p-6">
              <DialogTitle className="text-xl font-semibold text-gray-900">Edit Event</DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Update the event details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6 px-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="edit-title" className="text-base font-semibold text-gray-700">Title *</Label>
                  <Input
                    id="edit-title"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Event Title"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-eventType" className="text-base font-semibold text-gray-700">Event Type *</Label>
                  <Select
                    value={createForm.eventType}
                    onValueChange={(v) => {
                      const isRecurring = v === 'RECURRING';
                      const currentCategoryMatches = isRecurring 
                        ? recurringCategories.includes(createForm.category)
                        : !recurringCategories.includes(createForm.category);
                      
                      setCreateForm({
                        ...createForm,
                        eventType: v as 'RECURRING' | 'NON_RECURRING',
                        isRecurring,
                        category: currentCategoryMatches ? createForm.category : '',
                        recurrencePattern: isRecurring ? (createForm.recurrencePattern || 'weekly') : createForm.recurrencePattern,
                        recurrenceInterval: isRecurring ? (createForm.recurrenceInterval || 1) : createForm.recurrenceInterval,
                        encounterType: currentCategoryMatches ? createForm.encounterType : '',
                        classNumber: currentCategoryMatches ? createForm.classNumber : '',
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                      <SelectItem value="NON_RECURRING">Non-Recurring</SelectItem>
                      <SelectItem value="RECURRING">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-category" className="text-base font-semibold text-gray-700">Category *</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(v) => {
                      const isRecurringCategory = recurringCategories.includes(v);
                      const isEncounterCategory = [
                        'Marriage Encounter',
                        'Singles Encounter',
                        'Solo Parents Encounter',
                        'Family Encounter',
                        'Youth Encounter',
                      ].includes(v);
                      
                      setCreateForm({
                        ...createForm,
                        category: v,
                        eventType: isRecurringCategory ? 'RECURRING' : createForm.eventType,
                        isRecurring: isRecurringCategory ? true : createForm.isRecurring,
                        recurrencePattern: isRecurringCategory ? 'weekly' : createForm.recurrencePattern,
                        recurrenceInterval: isRecurringCategory ? 1 : createForm.recurrenceInterval,
                        encounterType: isEncounterCategory ? createForm.encounterType : '',
                        classNumber: isEncounterCategory ? createForm.classNumber : '',
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg max-h-[300px]">
                      {getFilteredCategories().map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                          {recurringCategories.includes(category) && ' (Weekly Recurring)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-ministry" className="text-base font-semibold text-gray-700">Ministry (optional)</Label>
                  <p className="text-xs text-gray-500">Ministry-specific events (e.g. WSC). Leave empty for general.</p>
                  <Select
                    value={createForm.ministry || 'NONE'}
                    onValueChange={(v) => setCreateForm({ ...createForm, ministry: v === 'NONE' ? '' : v })}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue placeholder="General (all members)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg max-h-[300px]">
                      <SelectItem value="NONE">General (all members)</SelectItem>
                      {Object.values(MINISTRIES_BY_APOSTOLATE).flat().map((ministry) => (
                        <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-status" className="text-base font-semibold text-gray-700">Status</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(v) => setCreateForm({ ...createForm, status: v as typeof createForm.status })}
                  >
                    <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                      <SelectItem value="UPCOMING">Upcoming</SelectItem>
                      <SelectItem value="ONGOING">Ongoing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-startDate" className="text-base font-semibold text-gray-700">Start Date *</Label>
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-endDate" className="text-base font-semibold text-gray-700">End Date *</Label>
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-startTime" className="text-base font-semibold text-gray-700">Start Time</Label>
                  <Input
                    id="edit-startTime"
                    type="time"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-endTime" className="text-base font-semibold text-gray-700">End Time</Label>
                  <Input
                    id="edit-endTime"
                    type="time"
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-location" className="text-base font-semibold text-gray-700">Location *</Label>
                  <Input
                    id="edit-location"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Event Location"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-venue" className="text-base font-semibold text-gray-700">Venue</Label>
                  <Input
                    id="edit-venue"
                    value={createForm.venue}
                    onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                    className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Specific venue or room"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="edit-description" className="text-base font-semibold text-gray-700">Description</Label>
                <textarea
                  id="edit-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full min-h-[100px] p-3 text-lg border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Event description..."
                />
              </div>

              {/* Encounter Event Fields */}
              {['Marriage Encounter', 'Singles Encounter', 'Solo Parents Encounter', 'Family Encounter', 'Youth Encounter'].includes(createForm.category) && (
                <div className="space-y-4 border-t border-gray-200 pt-6 bg-red-50 p-4 rounded-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>👥</span>
                    <span>Encounter Class Information</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="edit-encounterType" className="text-base font-semibold text-gray-700">
                        Encounter Type *
                      </Label>
                      <Select
                        value={createForm.encounterType}
                        onValueChange={(v) => setCreateForm({ ...createForm, encounterType: v })}
                      >
                        <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                          <SelectValue placeholder="Select encounter type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                          <SelectItem value="ME">Marriage Encounter (ME)</SelectItem>
                          <SelectItem value="SE">Singles Encounter (SE)</SelectItem>
                          <SelectItem value="SPE">Solo Parents Encounter (SPE)</SelectItem>
                          <SelectItem value="FE">Family Encounter (FE)</SelectItem>
                          <SelectItem value="YE">Youth Encounter (YE)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="edit-classNumber" className="text-base font-semibold text-gray-700">
                        Class Number *
                      </Label>
                      <Input
                        id="edit-classNumber"
                        type="number"
                        min="1"
                        max="999"
                        value={createForm.classNumber}
                        onChange={(e) => setCreateForm({ ...createForm, classNumber: e.target.value })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g., 18, 101"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Recurring Event Fields */}
              {createForm.eventType === 'RECURRING' && (
                <div className="space-y-4 border-t border-gray-200 pt-6 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Recurrence Settings</h3>
                  
                  <div className="space-y-3">
                    <Label htmlFor="edit-recurrencePattern" className="text-base font-semibold text-gray-700">Recurrence Pattern *</Label>
                    <Select
                      value={createForm.recurrencePattern}
                      onValueChange={(v) => setCreateForm({ ...createForm, recurrencePattern: v as 'daily' | 'weekly' | 'monthly' })}
                    >
                      <SelectTrigger className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-300 z-[100] shadow-lg">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createForm.recurrencePattern === 'weekly' && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-gray-700">Days of Week *</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {weekDays.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`edit-recurrence-${day.value}`}
                              checked={createForm.recurrenceDays.includes(day.value)}
                              onChange={(e) => {
                                const newDays = e.target.checked
                                  ? [...createForm.recurrenceDays, day.value]
                                  : createForm.recurrenceDays.filter((d) => d !== day.value);
                                setCreateForm({ ...createForm, recurrenceDays: newDays });
                              }}
                              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <Label htmlFor={`edit-recurrence-${day.value}`} className="text-lg text-gray-700 cursor-pointer">
                              {day.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label htmlFor="edit-recurrenceInterval" className="text-base font-semibold text-gray-700">Repeat Every</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="edit-recurrenceInterval"
                        type="number"
                        min="1"
                        value={createForm.recurrenceInterval}
                        onChange={(e) => setCreateForm({ ...createForm, recurrenceInterval: parseInt(e.target.value) || 1 })}
                        className="h-12 text-base border border-gray-300 bg-white w-24 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                      <span className="text-lg text-gray-700">
                        {createForm.recurrencePattern === 'daily' ? 'day(s)' :
                         createForm.recurrencePattern === 'weekly' ? 'week(s)' :
                         'month(s)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="edit-hasRegistration"
                    checked={createForm.hasRegistration}
                    onChange={(e) => setCreateForm({ ...createForm, hasRegistration: e.target.checked })}
                    className="w-6 h-6"
                  />
                  <Label htmlFor="edit-hasRegistration" className="text-base font-semibold cursor-pointer text-gray-700">
                    Requires Registration
                  </Label>
                </div>
                {createForm.hasRegistration && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="edit-registrationFee" className="text-base font-semibold text-gray-700">Registration Fee</Label>
                      <Input
                        id="edit-registrationFee"
                        type="number"
                        min="0"
                        value={createForm.registrationFee}
                        onChange={(e) => setCreateForm({ ...createForm, registrationFee: parseInt(e.target.value) || 0 })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="edit-maxParticipants" className="text-base font-semibold text-gray-700">Max Participants</Label>
                      <Input
                        id="edit-maxParticipants"
                        type="number"
                        min="1"
                        value={createForm.maxParticipants}
                        onChange={(e) => setCreateForm({ ...createForm, maxParticipants: parseInt(e.target.value) || 0 })}
                        className="h-12 text-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  size="lg"
                  className="text-base px-6 py-3 h-auto bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  size="lg"
                  className="text-base px-6 py-3 h-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
                  Update Event
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Event Chatbot */}
        {showChatbot && (
          <EventChatbot
            onClose={() => {
              setShowChatbot(false);
              eventChatbotService.reset();
            }}
            onSuccess={() => {
              setShowChatbot(false);
              loadEvents();
              eventChatbotService.reset();
            }}
          />
        )}

        {/* Class Shepherd Assignment Dialog */}
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

        {/* Cancel Event Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="max-w-md bg-white border border-gray-200 shadow-2xl">
            <DialogHeader className="bg-white">
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Cancel Event
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Are you sure you want to cancel this event? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedEventForCancel && (
              <div className="space-y-4 bg-white">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Event:</p>
                  <p className="text-base text-gray-800">{selectedEventForCancel.title}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {formatDate(selectedEventForCancel.startDate)}
                    {selectedEventForCancel.startTime && ` at ${formatTime(selectedEventForCancel.startTime)}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellationReason" className="text-sm font-semibold text-gray-700">
                    Reason for Cancellation (Optional)
                  </Label>
                  <textarea
                    id="cancellationReason"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Enter reason for cancellation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500">
                    {cancellationReason.length}/500 characters
                  </p>
                </div>
                <div className="flex gap-3 pt-4 bg-white">
                  <Button
                    onClick={handleConfirmCancel}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Cancel Event
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCancelDialog(false);
                      setSelectedEventForCancel(null);
                      setCancellationReason('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Keep Event
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* QR Code Display Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl pt-10 sm:pt-10">
            <DialogHeader className="bg-white pt-2">
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Event QR Code
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Scan this QR code to check in to the event
              </DialogDescription>
            </DialogHeader>
            {selectedEventForQR && (
              <div className="space-y-4 bg-white pt-2">
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block border border-gray-200 shadow-sm">
                    <img
                      src={selectedEventForQR.qrCodeUrl || ''}
                      alt={`QR Code for ${selectedEventForQR.title}`}
                      className="w-64 h-64 mx-auto object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-center bg-white">
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="font-semibold text-gray-900">Event:</span> <span className="text-gray-800">{selectedEventForQR.title}</span>
                  </p>
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="font-semibold text-gray-900">Date:</span> <span className="text-gray-800">{formatDate(selectedEventForQR.startDate)}</span>
                  </p>
                  {selectedEventForQR.startTime && (
                    <p className="text-sm text-gray-700 font-medium">
                      <span className="font-semibold text-gray-900">Time:</span> <span className="text-gray-800">{formatTime(selectedEventForQR.startTime)}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-4 bg-gray-50 px-3 py-2 rounded-lg">
                    This QR code can be scanned for event check-in
                  </p>
                  {/* Display the encoded URL for debugging and manual testing */}
                  <div className="mt-3 p-3 bg-gray-100 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-2">📋 Check-In URL (for testing):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white px-2 py-1.5 rounded border border-gray-300 text-gray-800 break-all">
                        {(() => {
                          // Try to extract URL from QR code data URL or display placeholder
                          // The actual URL is: http://[IP or localhost]:3000/checkin/[eventId]
                          const baseUrl = typeof window !== 'undefined' 
                            ? window.location.origin 
                            : (process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000');
                          return `${baseUrl}/checkin/${selectedEventForQR.id}`;
                        })()}
                      </code>
                      <Button
                        onClick={() => {
                          const baseUrl = typeof window !== 'undefined' 
                            ? window.location.origin 
                            : (process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000');
                          const url = `${baseUrl}/checkin/${selectedEventForQR.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success('URL Copied!', {
                            description: 'Paste this URL in your phone browser to test',
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 <strong>Tip:</strong> Copy this URL and paste it in your phone's browser to test without scanning
                    </p>
                  </div>
                </div>
                <div className="space-y-3 bg-white">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      💡 Members can scan this QR code to:
                    </p>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      <li>Check themselves in to this event</li>
                      <li>Register for this event (if registration is enabled)</li>
                    </ul>
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-600 font-medium mb-1">📱 For Phone Scanning:</p>
                      <p className="text-xs text-blue-600 mb-2">
                        If scanning from a phone, ensure your phone and computer are on the same Wi‑Fi network. 
                        The QR code URL may need your computer's IP address instead of localhost.
                      </p>
                      <p className="text-xs text-blue-600">
                        <strong>Tip:</strong> If the QR code opens Google search instead of the check-in page, 
                        regenerate the QR code after setting <code className="bg-blue-100 px-1 rounded">LOCAL_IP</code> 
                        in your backend <code className="bg-blue-100 px-1 rounded">.env</code> file.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownloadQR}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Download QR Code
                    </Button>
                    <Button
                      onClick={() => handleRegenerateQR(selectedEventForQR.id)}
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                  <Button
                    onClick={() => router.push(`/checkin/self-checkin?eventId=${selectedEventForQR.id}`)}
                    variant="outline"
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Test Self Check-In (Member View)
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}


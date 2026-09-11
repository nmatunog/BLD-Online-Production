'use client';

import { Calendar, Clock, MapPin, Globe, FolderOpen, Edit, Trash2, QrCode, CheckCircle, RotateCcw, Users, UserPlus, XCircle, DollarSign, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Event } from '@/services/events.service';
import { isEncounterEvent as checkEncounterEvent } from '@/lib/event-utils';

interface EventCardProps {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  onGenerateQR: () => void;
  onViewQR: () => void;
  onToggleStatus: () => void;
  onAssignShepherds?: () => void;
  onCreateRegistration?: () => void;
  onViewAccounting?: () => void;
  canEdit: boolean;
  canDelete: boolean;
  /** When true, show only View QR Code and Check In (link to self-check-in); hide admin buttons */
  isMember?: boolean;
  /** Current user's ministry; if matches event.ministry, admin buttons still shown for that event */
  userMinistry?: string | null;
  /** When true, show a prominent "You are already Checked In" banner */
  isCheckedIn?: boolean;
  formatDate: (date: string) => string;
  formatTime: (time: string | null) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  /** Display status from date logic (section). When set, badge uses this instead of event.status. */
  displayStatus?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
}

export default function EventCard({
  event,
  onEdit,
  onDelete,
  onCancel,
  onGenerateQR,
  onViewQR,
  onToggleStatus,
  onAssignShepherds,
  onCreateRegistration,
  onViewAccounting,
  canEdit,
  canDelete,
  isMember = false,
  userMinistry,
  isCheckedIn = false,
  formatDate,
  formatTime,
  getStatusBadge,
  displayStatus,
}: EventCardProps) {
  const isRecurring = event.isRecurring || event.eventType === 'RECURRING';
  const isInstance = false; // TODO: Check if this is a recurring instance

  /** Admins and event's concerned ministry see full buttons; members see only View QR + Check In */
  const canManageEvent = canEdit || !!(userMinistry && event.ministry && userMinistry === event.ministry);
  const showMemberOnlyActions = isMember && !canManageEvent;
  
  const isEncounterEvent = checkEncounterEvent(event);

  // Check if event has registrations
  const hasRegistrations = (event._count?.registrations || 0) > 0;
  
  // Show registration button only for non-recurring events with registration enabled
  const showRegistrationButton = !isRecurring && event.hasRegistration && onCreateRegistration && !hasRegistrations;

  return (
    <div className="group bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-xl hover:border-red-300 transition-all duration-300 transform hover:-translate-y-1 relative">
      {isCheckedIn && (
        <div className="absolute inset-x-0 top-0 rounded-t-xl bg-green-600 text-white font-semibold text-sm py-2 px-4 flex items-center justify-center gap-2 z-10 border-b-2 border-green-700 shadow-sm" aria-live="polite">
          <CheckCircle className="w-4 h-4 shrink-0" />
          You are already Checked In
        </div>
      )}
      <div className={`p-6 ${isCheckedIn ? 'pt-14' : ''}`}>
        {/* Event Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-red-700 transition-colors">
              {event.title}
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {isRecurring && (
                <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-red-100 to-red-50 text-red-800 rounded-full border border-red-200">
                  🔄 Recurring
                </span>
              )}
              {isInstance && (
                <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-green-100 to-green-50 text-green-800 rounded-full border border-green-200">
                  ✨ Instance
                </span>
              )}
              {event.ministry && (
                <span className="px-2.5 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full border border-purple-200" title="Ministry-specific event">
                  {event.ministry}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end ml-3">
            {getStatusBadge(displayStatus ?? event.status)}
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-2.5 mb-5 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center text-sm text-gray-700">
            <span className="w-5 h-5 mr-2.5 flex items-center justify-center bg-white rounded-full text-base">📅</span>
            <span className="font-medium">
              {formatDate(event.startDate)} {event.startTime && `at ${formatTime(event.startTime)}`}
            </span>
          </div>
          {event.venue && (
            <div className="flex items-center text-sm text-gray-700">
              <span className="w-5 h-5 mr-2.5 flex items-center justify-center bg-white rounded-full text-base">📍</span>
              <span className="font-medium">{event.venue}</span>
            </div>
          )}
          {event.location && event.location !== event.venue && (
            <div className="flex items-center text-sm text-gray-700">
              <span className="w-5 h-5 mr-2.5 flex items-center justify-center bg-white rounded-full text-base">🌍</span>
              <span className="font-medium">{event.location}</span>
            </div>
          )}
          {!event.venue && event.location && (
            <div className="flex items-center text-sm text-gray-700">
              <span className="w-5 h-5 mr-2.5 flex items-center justify-center bg-white rounded-full text-base">📍</span>
              <span className="font-medium">{event.location}</span>
            </div>
          )}
          {event.category && (
            <div className="flex items-center text-sm text-gray-700">
              <span className="w-5 h-5 mr-2.5 flex items-center justify-center bg-white rounded-full text-base">🏷️</span>
              <span className="font-medium">{event.category}</span>
            </div>
          )}
        </div>

        {/* Cancellation Notice */}
        {event.status === 'CANCELLED' && event.cancellationReason && (
          <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-lg p-3">
            <div className="flex items-start">
              <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-1">Event Cancelled</p>
                <p className="text-sm text-red-700">{event.cancellationReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
          {showMemberOnlyActions ? (
            <>
              {/* Member view: QR + Check In */}
              {event.qrCodeUrl && (
                <button
                  onClick={onViewQR}
                  className="text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-green-200 hover:border-green-300"
                >
                  📱 View QR Code
                </button>
              )}
              <Link href={`/checkin/self-checkin?eventId=${event.id}`}>
                <button
                  disabled={isCheckedIn}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm border ${
                    isCheckedIn
                      ? 'text-gray-500 bg-gray-100 border-gray-200 cursor-not-allowed'
                      : 'text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300'
                  }`}
                  title={isCheckedIn ? 'You are already checked in' : 'Go to Self Check-In'}
                >
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {isCheckedIn ? 'Checked In' : 'Check In'}
                </button>
              </Link>
            </>
          ) : (
            <>
              {/* Primary actions: Open, Check In */}
              <Link href={`/events/${event.id}`}>
                <button
                  className="text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200 hover:border-blue-300"
                >
                  Open
                </button>
              </Link>
              <Link href={`/checkin/self-checkin?eventId=${event.id}`}>
                <button
                  disabled={isCheckedIn}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm border ${
                    isCheckedIn
                      ? 'text-gray-500 bg-gray-100 border-gray-200 cursor-not-allowed'
                      : 'text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300'
                  }`}
                  title={isCheckedIn ? 'You are already checked in' : 'Go to Self Check-In'}
                >
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {isCheckedIn ? 'Checked In' : 'Check In'}
                </button>
              </Link>

              {/* Overflow menu for secondary actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300"
                    title="More actions"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {event.qrCodeUrl ? (
                    <DropdownMenuItem onClick={onViewQR}>
                      <QrCode className="w-4 h-4 mr-2" />
                      View QR Code
                    </DropdownMenuItem>
                  ) : (
                    canEdit && (
                      <DropdownMenuItem onClick={onGenerateQR}>
                        <QrCode className="w-4 h-4 mr-2" />
                        Generate QR
                      </DropdownMenuItem>
                    )
                  )}
                  {!isRecurring && event.hasRegistration && hasRegistrations && onCreateRegistration && (
                    <DropdownMenuItem onClick={onCreateRegistration}>
                      <Users className="w-4 h-4 mr-2" />
                      Registrations ({event._count?.registrations || 0})
                    </DropdownMenuItem>
                  )}
                  {showRegistrationButton && onCreateRegistration && (
                    <DropdownMenuItem onClick={onCreateRegistration}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create Registration
                    </DropdownMenuItem>
                  )}
                  {isEncounterEvent && canEdit && onAssignShepherds && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onAssignShepherds}>
                        <Users className="w-4 h-4 mr-2" />
                        Assign Shepherds
                      </DropdownMenuItem>
                    </>
                  )}
                  {onViewAccounting && (
                    <DropdownMenuItem asChild>
                      <Link href={`/accounting/${event.id}`} className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Accounting
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onToggleStatus}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {event.status === 'UPCOMING' ? 'Mark Complete' : 'Reactivate'}
                  </DropdownMenuItem>
                  {canEdit && onCancel && event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
                    <DropdownMenuItem onClick={onCancel} className="text-orange-600">
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Event
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


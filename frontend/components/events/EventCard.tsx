'use client';

import { Calendar, Clock, MapPin, Globe, FolderOpen, Edit, Trash2, QrCode, CheckCircle, RotateCcw, Users, UserPlus, XCircle, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/services/events.service';

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
  formatDate: (date: string) => string;
  formatTime: (time: string | null) => string;
  getStatusBadge: (status: string) => React.ReactNode;
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
  formatDate,
  formatTime,
  getStatusBadge,
}: EventCardProps) {
  const isRecurring = event.isRecurring || event.eventType === 'RECURRING';
  const isInstance = false; // TODO: Check if this is a recurring instance
  
  // Check if event is an Encounter Event
  const isEncounterEvent = () => {
    const encounterCategories = [
      'Marriage Encounter',
      'Singles Encounter',
      'Solo Parents Encounter',
      'Family Encounter',
      'Youth Encounter',
    ];
    const encounterTypes = ['ME', 'SE', 'SPE', 'FE', 'YE', 'ENCOUNTER'];
    
    return (
      encounterCategories.includes(event.category) ||
      encounterTypes.includes(event.eventType?.toUpperCase() || '') ||
      event.category?.toLowerCase().includes('encounter')
    );
  };

  // Check if event has registrations
  const hasRegistrations = (event._count?.registrations || 0) > 0;
  
  // Show registration button only for non-recurring events with registration enabled
  const showRegistrationButton = !isRecurring && event.hasRegistration && onCreateRegistration && !hasRegistrations;

  return (
    <div className="group bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-xl hover:border-red-300 transition-all duration-300 transform hover:-translate-y-1">
      <div className="p-6">
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
            {getStatusBadge(event.status)}
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
          <button
            onClick={onToggleStatus}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
              event.status === 'UPCOMING' 
                ? 'text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-300' 
                : 'text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300'
            }`}
            title={`Click to toggle status. Current: ${event.status}`}
          >
            {event.status === 'UPCOMING' ? (
              <>
                ✅ Mark Complete
              </>
            ) : (
              <>
                🔄 Reactivate
              </>
            )}
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-red-200 hover:border-red-300"
            >
              ✏️ Edit
            </button>
          )}
          {event.qrCodeUrl ? (
            <button
              onClick={onViewQR}
              className="text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-green-200 hover:border-green-300"
            >
              📱 View QR Code
            </button>
          ) : (
            canEdit && (
              <button
                onClick={onGenerateQR}
                className="text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300"
                title="Generate QR Code"
              >
                📱 Generate QR
              </button>
            )
          )}
          {isRecurring && (
            <span 
              className="text-gray-400 text-xs px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
              title="Registration not available for recurring events"
            >
              N/A (Recurring)
            </span>
          )}
          {showRegistrationButton && (
            <button
              onClick={onCreateRegistration}
              className="text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-cyan-200 hover:border-cyan-300"
              title="Create Event Registration"
            >
              <UserPlus className="w-3 h-3 inline mr-1" />
              Create Registration
            </button>
          )}
          {!isRecurring && event.hasRegistration && hasRegistrations && (
            <button
              onClick={onCreateRegistration}
              className="text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-cyan-200 hover:border-cyan-300"
              title="View Event Registrations"
            >
              👥 Registrations ({event._count?.registrations || 0})
            </button>
          )}
          {isEncounterEvent() && canEdit && onAssignShepherds && (
            <button
              onClick={onAssignShepherds}
              className="text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-red-200 hover:border-red-300"
              title="Assign Class Shepherds"
            >
              👥 Shepherds
            </button>
          )}
          {onViewAccounting && (
            <Link href={`/accounting/${event.id}`}>
              <button
                className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-emerald-200 hover:border-emerald-300"
                title="View Accounting"
              >
                <DollarSign className="w-3 h-3 inline mr-1" />
                Accounting
              </button>
            </Link>
          )}
          {canEdit && onCancel && event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
            <button
              onClick={onCancel}
              className="text-orange-600 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-orange-200 hover:border-orange-300"
              title="Cancel Event"
            >
              <XCircle className="w-3 h-3 inline mr-1" />
              Cancel
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-red-200 hover:border-red-300"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


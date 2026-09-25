'use client';

import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { formatEventWhenManila } from '@/lib/checkin-ux';
import { cn } from '@/lib/utils';

export interface EventPickerItem {
  id: string;
  title: string;
  startDate: string;
  startTime?: string | null;
  location?: string | null;
}

export interface EventPickerBarProps {
  events: EventPickerItem[];
  selectedEventId: string;
  onSelect: (eventId: string) => void;
  loading?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function EventPickerBar({
  events,
  selectedEventId,
  onSelect,
  loading = false,
  emptyLabel = 'No events available right now.',
  className = '',
}: EventPickerBarProps) {
  const [open, setOpen] = useState(false);
  const selected = events.find((event) => event.id === selectedEventId);

  if (loading && events.length === 0) {
    return (
      <div className={cn('rounded-2xl border-2 border-gray-300 bg-white p-4', className)}>
        <p className="text-[1.125rem] font-medium text-gray-900">Loading today’s events…</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn('rounded-2xl border-2 border-dashed border-gray-400 bg-white p-5 text-center', className)}>
        <p className="text-[1.25rem] font-semibold text-gray-900">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border-2 border-gray-300 bg-white p-4', className)}>
      <div className="flex items-start gap-3">
        <Calendar className="mt-1 h-6 w-6 shrink-0 text-rose-800" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[1.125rem] font-semibold text-gray-800">Event</p>
          <p className="text-[1.375rem] font-bold leading-tight text-gray-900">
            {selected?.title || 'Choose an event'}
          </p>
          {selected ? (
            <p className="mt-1 text-[1.125rem] font-medium text-gray-900">
              {formatEventWhenManila(selected.startDate, selected.startTime)}
              {selected.location ? ` · ${selected.location}` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-500 bg-white px-4 text-[1.125rem] font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
      >
        <Calendar className="h-5 w-5" aria-hidden />
        {open ? 'Hide events' : 'Change event'}
      </button>
      {open ? (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto" role="listbox" aria-label="Events">
          {events.map((event) => {
            const active = event.id === selectedEventId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(event.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2',
                    active
                      ? 'border-rose-800 bg-rose-50 text-rose-950'
                      : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
                  )}
                >
                  {active ? <Check className="mt-1 h-5 w-5 shrink-0" aria-hidden /> : <span className="mt-1 w-5" />}
                  <span>
                    <span className="block text-[1.125rem] font-bold">{event.title}</span>
                    <span className="mt-0.5 block text-[1.125rem] font-medium">
                      {formatEventWhenManila(event.startDate, event.startTime)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

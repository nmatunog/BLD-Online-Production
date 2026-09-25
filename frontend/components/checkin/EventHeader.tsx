/**
 * EventHeader - Unified event display with Manila-friendly date/time + location
 * Used across public, dashboard, and self check-in
 */

import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEventDateManila, formatEventTimeManila } from '@/lib/checkin-ux';

export interface EventHeaderProps {
  title: string;
  startDate: string;
  startTime?: string | null;
  location?: string | null;
  subtitle?: string;
  className?: string;
}

export function EventHeader({ 
  title, 
  startDate, 
  startTime, 
  location, 
  subtitle,
  className = ''
}: EventHeaderProps) {
  return (
    <Card className={`bg-white border-2 border-gray-300 shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[1.75rem] md:text-[2rem] font-bold leading-tight text-gray-900">{title}</CardTitle>
        {subtitle && <p className="text-[1.125rem] font-medium text-gray-800">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-6 h-6 text-rose-800 mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-[1.125rem] font-semibold text-gray-800">Date</p>
              <p className="text-[1.375rem] font-bold text-gray-900">{formatEventDateManila(startDate)}</p>
            </div>
          </div>
          {startTime && (
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-rose-800 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-[1.125rem] font-semibold text-gray-800">Time</p>
                <p className="text-[1.375rem] font-bold text-gray-900">{formatEventTimeManila(startTime)}</p>
              </div>
            </div>
          )}
          {location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-rose-800 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-[1.125rem] font-semibold text-gray-800">Location</p>
                <p className="text-[1.375rem] font-bold text-gray-900">{location}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

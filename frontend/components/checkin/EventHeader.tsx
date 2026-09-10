/**
 * EventHeader - Unified event display with Manila-friendly date/time + location
 * Used across public, dashboard, and self check-in
 */

import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface EventHeaderProps {
  title: string;
  startDate: string;
  startTime?: string | null;
  location?: string | null;
  subtitle?: string;
  className?: string;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
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
    <Card className={`bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-2xl text-purple-800">{title}</CardTitle>
        {subtitle && <p className="text-sm text-purple-600">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-600">Date</p>
              <p className="text-base font-semibold text-gray-900">{formatDate(startDate)}</p>
            </div>
          </div>
          {startTime && (
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-600">Time</p>
                <p className="text-base font-semibold text-gray-900">{formatTime(startTime)}</p>
              </div>
            </div>
          )}
          {location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-600">Location</p>
                <p className="text-base font-semibold text-gray-900">{location}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

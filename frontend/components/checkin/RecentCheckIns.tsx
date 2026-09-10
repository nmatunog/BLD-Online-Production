/**
 * RecentCheckIns - Recent check-ins list with undo/remove
 * Used in dashboard check-in to show live activity
 */

'use client';

import { Users, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface CheckIn {
  id: string;
  member: {
    communityId: string;
    firstName: string;
    lastName: string;
    nickname?: string | null;
  };
  checkInTime: string;
  method: 'QR_CODE' | 'MANUAL';
}

export interface RecentCheckInsProps {
  checkIns: CheckIn[];
  onRemove?: (id: string, memberName: string) => Promise<void>;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  loading?: boolean;
  canRemove?: boolean;
  className?: string;
}

function formatCheckInTime(timeString: string): string {
  try {
    const date = new Date(timeString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timeString;
  }
}

export function RecentCheckIns({
  checkIns,
  onRemove,
  onRefresh,
  autoRefresh = true,
  onToggleAutoRefresh,
  loading = false,
  canRemove = true,
  className = ''
}: RecentCheckInsProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 border-gray-200 ${className}`}>
      <div className="p-5 border-b-2 border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-gray-700" />
            Recent Check-ins
            {checkIns.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full">
                {checkIns.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                className="h-9 text-xs font-semibold border-gray-300 text-gray-700 hover:bg-gray-100"
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
            {onToggleAutoRefresh && (
              <Button
                onClick={onToggleAutoRefresh}
                variant="outline"
                size="sm"
                className={`h-9 text-xs font-semibold ${
                  autoRefresh
                    ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                {autoRefresh ? 'Auto ON' : 'Auto OFF'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        {checkIns.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-semibold text-gray-700 mb-1">No check-ins yet</p>
            <p className="text-sm text-gray-500">Start checking in members to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkIns.map((checkIn) => {
              const member = checkIn.member;
              const displayName = member.nickname
                ? `${member.nickname} ${member.lastName}`
                : `${member.firstName} ${member.lastName}`;

              return (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 mb-1">{displayName}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        {member.communityId}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatCheckInTime(checkIn.checkInTime)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge
                      className={`text-xs px-3 py-1 font-semibold ${
                        checkIn.method === 'QR_CODE'
                          ? 'bg-purple-100 text-purple-800 border-2 border-purple-200'
                          : 'bg-green-100 text-green-800 border-2 border-green-200'
                      }`}
                    >
                      {checkIn.method === 'QR_CODE' ? 'QR' : 'Manual'}
                    </Badge>
                    {canRemove && onRemove && (
                      <button
                        onClick={() => onRemove(checkIn.id, displayName)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border-2 border-transparent hover:border-red-200 transition"
                        disabled={loading}
                        title="Remove check-in"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CheckInStats - Live count display with breakdown by method
 * Used in dashboard check-in to show real-time stats
 */

'use client';

import { QrCode, Search, BarChart3 } from 'lucide-react';

export interface CheckInStatsProps {
  total: number;
  qrCodeCount: number;
  manualCount: number;
  loading?: boolean;
  className?: string;
}

export function CheckInStats({
  total,
  qrCodeCount,
  manualCount,
  loading = false,
  className = ''
}: CheckInStatsProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {/* Total */}
      <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-gray-300 transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Total Check-ins
            </p>
            <p className="text-3xl font-bold text-gray-900">{loading ? '...' : total}</p>
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-purple-200 hover:border-purple-300 transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
              QR Code
            </p>
            <p className="text-3xl font-bold text-purple-700">{loading ? '...' : qrCodeCount}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <QrCode className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Manual */}
      <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-green-200 hover:border-green-300 transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
              Manual
            </p>
            <p className="text-3xl font-bold text-green-700">{loading ? '...' : manualCount}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <Search className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserPlus, Heart, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { RegistrationSummary as RegistrationSummaryType } from '@/services/registrations.service';

interface RegistrationSummaryProps {
  summary: RegistrationSummaryType;
  loading?: boolean;
}

export default function RegistrationSummary({ summary, loading }: RegistrationSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { event, summary: stats } = summary;

  return (
    <div className="space-y-4">
      {/* Encounter Class Info */}
      {event.encounterType && event.classNumber && (
        <Card className="bg-purple-50 border-2 border-purple-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 text-white rounded-lg px-4 py-2 font-bold text-lg">
                {event.encounterType} {event.classNumber}
              </div>
              <div>
                <p className="text-sm text-purple-700 font-medium">Encounter Class</p>
                <p className="text-xs text-purple-600">
                  {event.encounterType === 'ME' ? 'Marriage Encounter' :
                   event.encounterType === 'SE' ? 'Singles Encounter' :
                   event.encounterType === 'SPE' ? 'Solo Parents Encounter' :
                   event.encounterType === 'FE' ? 'Family Encounter' :
                   event.encounterType === 'YE' ? 'Youth Encounter' :
                   event.encounterType} Class {event.classNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Registrations</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalRegistrations}</p>
                {event.maxParticipants && (
                  <p className="text-xs text-gray-500 mt-1">
                    Capacity: {stats.totalRegistrations} / {event.maxParticipants}
                  </p>
                )}
              </div>
              <Users className="w-10 h-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>

      {/* Member Registrations */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Members</p>
              <p className="text-3xl font-bold text-green-700">{stats.memberRegistrations}</p>
            </div>
            <UserCheck className="w-10 h-10 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Non-Member Registrations */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Non-Members</p>
              <p className="text-3xl font-bold text-blue-700">{stats.nonMemberRegistrations}</p>
            </div>
            <UserPlus className="w-10 h-10 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      {/* Couple Registrations */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Couples</p>
              <p className="text-3xl font-bold text-purple-700">{stats.coupleRegistrations}</p>
            </div>
            <Heart className="w-10 h-10 text-purple-600" />
          </div>
        </CardContent>
      </Card>

      {/* Payment Status Cards */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
              <p className="text-3xl font-bold text-yellow-700">{stats.pendingPayments}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
        </CardContent>
      </Card>

      {/* Paid Registrations */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Paid</p>
              <p className="text-3xl font-bold text-green-700">{stats.paidPayments}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Total Revenue */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-cyan-700">
                ₱{stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-cyan-600" />
          </div>
        </CardContent>
      </Card>

      {/* Capacity Used */}
      {stats.capacityUsed !== null && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Capacity Used</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.capacityUsed.toFixed(1)}%
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="transform -rotate-90 w-16 h-16">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(stats.capacityUsed / 100) * 175.9} 175.9`}
                    className="text-purple-600"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-gray-700">
                    {Math.round(stats.capacityUsed)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}


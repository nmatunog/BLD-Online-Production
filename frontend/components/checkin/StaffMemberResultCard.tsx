'use client';

import { CheckCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StaffMemberResult {
  id: string;
  name: string;
  communityId: string;
  photoUrl?: string | null;
}

export interface StaffMemberResultCardProps {
  member: StaffMemberResult;
  alreadyCheckedIn?: boolean;
  checkingIn?: boolean;
  onCheckIn: (communityId: string) => void;
  className?: string;
}

export function StaffMemberResultCard({
  member,
  alreadyCheckedIn = false,
  checkingIn = false,
  onCheckIn,
  className = '',
}: StaffMemberResultCardProps) {
  return (
    <article
      className={cn(
        'rounded-2xl border-2 bg-white p-4 shadow-sm',
        alreadyCheckedIn ? 'border-sky-700' : 'border-gray-300',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {member.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photoUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl object-cover border-2 border-gray-400"
          />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-gray-400 bg-gray-100 text-gray-800"
            aria-hidden
          >
            <User className="h-10 w-10" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="checkin-break text-[1.375rem] font-bold leading-tight text-gray-900">{member.name}</p>
          <p className="checkin-break mt-1 text-[1.375rem] font-mono font-semibold text-gray-900">{member.communityId}</p>
        </div>
      </div>
      {alreadyCheckedIn ? (
        <p
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-50 px-4 text-[1.125rem] font-semibold text-sky-950 border-2 border-sky-700"
          role="status"
        >
          <CheckCircle className="h-5 w-5" aria-hidden />
          Already checked in
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onCheckIn(member.communityId)}
          disabled={checkingIn}
          className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-[1.25rem] font-semibold text-white hover:bg-green-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800 focus-visible:ring-offset-2"
        >
          <CheckCircle className="h-6 w-6" aria-hidden />
          {checkingIn ? 'Checking in…' : 'Check In'}
        </button>
      )}
    </article>
  );
}

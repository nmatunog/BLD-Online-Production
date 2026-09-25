'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { generateStableMemberQR } from '@/lib/qr-service';
import { formatEventWhenManila, memberDisplayName } from '@/lib/checkin-ux';
import { cn } from '@/lib/utils';

export interface MemberIdQrPanelProps {
  member: {
    firstName?: string | null;
    lastName?: string | null;
    nickname?: string | null;
    communityId: string;
  };
  event?: {
    title: string;
    startDate: string;
    startTime?: string | null;
  } | null;
  primaryLabel?: string;
  primaryBusyLabel?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  alreadyCheckedIn?: boolean;
  className?: string;
}

export function MemberIdQrPanel({
  member,
  event,
  primaryLabel = 'Check In',
  primaryBusyLabel = 'Checking in…',
  onPrimaryAction,
  primaryDisabled = false,
  primaryBusy = false,
  alreadyCheckedIn = false,
  className = '',
}: MemberIdQrPanelProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const name = memberDisplayName(member);

  useEffect(() => {
    let cancelled = false;
    setQrError(false);
    setQrSrc(null);
    generateStableMemberQR(member.communityId, { width: 360, margin: 2 })
      .then((src) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [member.communityId]);

  return (
    <section className={cn('rounded-2xl border-2 border-gray-300 bg-white p-5 text-center', className)}>
      <div className="mx-auto flex min-h-[220px] w-full max-w-[280px] items-center justify-center rounded-2xl bg-white p-2">
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt={`QR code for ${member.communityId}`} className="h-auto w-full" />
        ) : qrError ? (
          <p className="text-[1.125rem] font-medium text-gray-900">QR code could not load. Show your Community ID instead.</p>
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-rose-800 motion-reduce:animate-none" aria-label="Loading QR code" />
        )}
      </div>
      <p className="mt-5 text-[1.875rem] font-bold leading-tight text-gray-900">{name || 'Member'}</p>
      <p className="mt-2 text-[1.375rem] font-mono font-bold text-gray-900">{member.communityId}</p>
      {event ? (
        <div className="mt-4">
          <p className="text-[1.375rem] font-semibold leading-snug text-gray-900">{event.title}</p>
          <p className="mt-1 text-[1.125rem] font-medium text-gray-900">
            {formatEventWhenManila(event.startDate, event.startTime)}
          </p>
        </div>
      ) : null}
      {alreadyCheckedIn ? (
        <p
          className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-[1.25rem] font-semibold text-white"
          role="status"
          aria-live="polite"
        >
          <CheckCircle className="h-6 w-6" aria-hidden />
          You are checked in
        </p>
      ) : onPrimaryAction ? (
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={primaryDisabled || primaryBusy}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-[1.25rem] font-semibold text-white hover:bg-green-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800 focus-visible:ring-offset-2"
        >
          <CheckCircle className="h-6 w-6" aria-hidden />
          {primaryBusy ? primaryBusyLabel : primaryLabel}
        </button>
      ) : null}
    </section>
  );
}

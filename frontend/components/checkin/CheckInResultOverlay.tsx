'use client';

import { useEffect } from 'react';
import { AlertCircle, Check, CheckCircle, X } from 'lucide-react';
import { CHECKIN_SUCCESS_DISMISS_MS, type CheckInResultState } from '@/lib/checkin-ux';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface CheckInResultOverlayProps {
  result: CheckInResultState | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function CheckInResultOverlay({
  result,
  onDismiss,
  autoDismissMs = CHECKIN_SUCCESS_DISMISS_MS,
}: CheckInResultOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!result || result.kind !== 'success') return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [result, onDismiss, autoDismissMs]);

  if (!result) return null;

  const isSuccess = result.kind === 'success';
  const isAlready = result.kind === 'already';
  const title = isSuccess ? 'Checked in' : isAlready ? 'Already checked in' : 'Could not check in';
  const live = isSuccess || isAlready ? 'polite' : 'assertive';
  const announcement = [title, result.name, result.communityId, result.message, result.hint]
    .filter(Boolean)
    .join('. ');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-result-title"
      onClick={onDismiss}
    >
      <p className="sr-only" aria-live={live} role="status">
        {announcement}
      </p>
      <div
        className={cn(
          'flex w-full max-w-md flex-col items-center rounded-2xl px-6 py-10 text-center shadow-xl',
          isSuccess && 'bg-green-700 text-white',
          isAlready && 'bg-sky-50 text-sky-950 border-4 border-sky-700',
          result.kind === 'error' && 'bg-red-50 text-red-950 border-4 border-red-800',
          !reducedMotion && 'animate-in fade-in zoom-in-95 duration-200',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {isSuccess ? (
          <CheckCircle className="mb-4 h-20 w-20 text-white" aria-hidden />
        ) : isAlready ? (
          <Check className="mb-4 h-16 w-16 text-sky-800" aria-hidden />
        ) : (
          <AlertCircle className="mb-4 h-16 w-16 text-red-800" aria-hidden />
        )}
        <h2
          id="checkin-result-title"
          className={cn(
            'text-[1.875rem] font-bold leading-tight',
            isSuccess ? 'text-white' : isAlready ? 'text-sky-950' : 'text-red-950',
          )}
        >
          {title}
        </h2>
        {result.name ? (
          <p className="mt-3 text-[1.375rem] font-semibold leading-snug">{result.name}</p>
        ) : null}
        {result.communityId ? (
          <p className="mt-1 text-[1.375rem] font-mono font-bold">{result.communityId}</p>
        ) : null}
        {result.kind === 'error' && result.message ? (
          <p className="mt-4 text-[1.125rem] font-medium text-red-950">{result.message}</p>
        ) : null}
        {result.hint ? (
          <p
            className={cn(
              'mt-3 text-[1.125rem] leading-relaxed',
              isSuccess ? 'text-green-50' : isAlready ? 'text-sky-950' : 'text-red-950',
            )}
          >
            {result.hint}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-[1.25rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isSuccess && 'bg-white text-green-800 hover:bg-green-50 focus-visible:ring-white',
            isAlready && 'bg-sky-800 text-white hover:bg-sky-900 focus-visible:ring-sky-900',
            result.kind === 'error' && 'bg-red-800 text-white hover:bg-red-900 focus-visible:ring-red-900',
          )}
        >
          <X className="h-5 w-5" aria-hidden />
          {result.kind === 'error' ? 'Try again' : 'Done'}
        </button>
      </div>
    </div>
  );
}

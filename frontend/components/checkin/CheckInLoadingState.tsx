import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CheckInLoadingState({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 py-8 text-[1.125rem] font-medium text-gray-900',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className="h-8 w-8 animate-spin text-rose-700 motion-reduce:animate-none" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

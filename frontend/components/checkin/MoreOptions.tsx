'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MoreOptionsProps {
  children: ReactNode;
  label?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function MoreOptions({
  children,
  label = 'More options',
  defaultOpen = false,
  className = '',
}: MoreOptionsProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-t-2 border-gray-300 pt-4', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-gray-400 bg-white px-4 text-[1.125rem] font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
      >
        {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        {open ? 'Hide more options' : label}
      </button>
      {open ? <div className="mt-4 space-y-4">{children}</div> : null}
    </div>
  );
}

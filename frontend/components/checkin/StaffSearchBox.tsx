'use client';

import type { FormEvent, Ref } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StaffSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  searching?: boolean;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

export function StaffSearchBox({
  value,
  onChange,
  onSearch,
  searching = false,
  disabled = false,
  inputRef,
  className = '',
}: StaffSearchBoxProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <label htmlFor="staff-checkin-search" className="block text-[1.125rem] font-semibold text-gray-900">
        Search by name
      </label>
      <input
        ref={inputRef}
        id="staff-checkin-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Name or Community ID"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-14 w-full rounded-xl border-2 border-gray-400 bg-white px-4 text-[1.25rem] text-gray-900 placeholder:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
      />
      <button
        type="submit"
        disabled={disabled || searching || !value.trim()}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 text-[1.25rem] font-semibold text-white hover:bg-rose-900 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-800 focus-visible:ring-offset-2"
      >
        <Search className="h-6 w-6" aria-hidden />
        {searching ? 'Searching…' : 'Search by name'}
      </button>
    </form>
  );
}

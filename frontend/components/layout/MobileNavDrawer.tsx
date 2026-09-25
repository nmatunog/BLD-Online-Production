'use client';

import type { ReactNode, RefObject } from 'react';
import Link from 'next/link';
import { LogOut, X, type LucideIcon } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { isNavItemActive, type DashboardNavItem } from '@/lib/nav-items';
import { cn } from '@/lib/utils';

export interface MobileNavDrawerItem extends DashboardNavItem {
  icon: LucideIcon;
}

export interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MobileNavDrawerItem[];
  pathname: string;
  displayName: string;
  communityId?: string | null;
  role?: string | null;
  onLogout: () => void;
  trigger?: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileNavDrawer({
  open,
  onOpenChange,
  items,
  pathname,
  displayName,
  communityId,
  role,
  onLogout,
  trigger,
  triggerRef,
}: MobileNavDrawerProps) {
  const returnFocusToTrigger = (event: Event) => {
    event.preventDefault();
    const button = triggerRef?.current;
    if (button) {
      button.focus();
      return;
    }
    const title = document.getElementById('dashboard-page-title');
    title?.focus();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side="left"
        id="mobile-nav-drawer"
        className="flex w-[min(100%,22rem)] flex-col bg-white p-0 motion-reduce:transition-none [&>button]:hidden"
        onCloseAutoFocus={returnFocusToTrigger}
      >
        <SheetHeader className="border-b-2 border-gray-300 p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="checkin-break text-[1.375rem] font-bold text-gray-900">Menu</SheetTitle>
              <SheetDescription className="checkin-break mt-1 text-[1.125rem] font-medium text-gray-800">
                {displayName}
                {role ? ` · ${role}` : ''}
              </SheetDescription>
              {communityId ? (
                <p className="checkin-break mt-1 text-[1.125rem] font-mono font-semibold text-gray-900">
                  ID: {communityId}
                </p>
              ) : null}
            </div>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl border-2 border-gray-400 px-3 text-[1.125rem] font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" aria-hidden />
                Close
              </button>
            </SheetClose>
          </div>
        </SheetHeader>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-xl px-4 text-[1.25rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2',
                      active
                        ? 'bg-rose-100 text-rose-900 ring-2 ring-rose-800'
                        : 'text-gray-900 hover:bg-gray-100',
                    )}
                  >
                    <Icon className="h-6 w-6 shrink-0" aria-hidden />
                    <span className="checkin-break">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t-2 border-gray-300 p-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onLogout();
            }}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-[1.25rem] font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
          >
            <LogOut className="h-6 w-6" aria-hidden />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

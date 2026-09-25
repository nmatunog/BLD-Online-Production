'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle, Home, Users, Calendar, FileText, BarChart3, User, Menu } from 'lucide-react';
import {
  CheckInResultOverlay,
  EventPickerBar,
  MemberIdQrPanel,
  MoreOptions,
  StaffMemberResultCard,
  StaffSearchBox,
} from '@/components/checkin';
import { MobileNavDrawer, type MobileNavDrawerItem } from '@/components/layout/MobileNavDrawer';
import { getVisibleNavItems } from '@/lib/nav-items';

const MOCK_EVENTS = [
  {
    id: 'cw-today',
    title: 'Community Worship',
    startDate: '2026-09-22T11:00:00.000Z',
    startTime: '19:00',
    location: 'BLD Center, Cebu',
  },
  {
    id: 'wsc',
    title: 'Word Sharing Circle — Formation',
    startDate: '2026-09-23T11:00:00.000Z',
    startTime: '19:30',
    location: 'Formation Room',
  },
];

const MOCK_MEMBER = {
  id: 'm1',
  name: 'Mai Santos',
  communityId: 'CEB-ME1801',
};

const NAV_ICONS = {
  home: Home,
  checkin: CheckCircle,
  members: Users,
  events: Calendar,
  registrations: FileText,
  reports: BarChart3,
  profile: User,
} as const;

function PreviewInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'staff';
  const [query, setQuery] = useState('Santos');
  const [menuOpen, setMenuOpen] = useState(view === 'nav');

  const navItems: MobileNavDrawerItem[] = useMemo(
    () =>
      getVisibleNavItems('ADMINISTRATOR').map((item) => ({
        ...item,
        icon: NAV_ICONS[item.iconKey],
      })),
    [],
  );

  const staffMain = (
    <div className="checkin-screen mx-auto max-w-xl space-y-5 p-4">
      <EventPickerBar events={MOCK_EVENTS} selectedEventId="cw-today" onSelect={() => undefined} />
      <StaffSearchBox value={query} onChange={setQuery} onSearch={() => undefined} />
      <button
        type="button"
        className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-rose-800 bg-white text-[1.25rem] font-semibold text-rose-900"
      >
        Scan QR
      </button>
      <StaffMemberResultCard member={MOCK_MEMBER} onCheckIn={() => undefined} />
      <MoreOptions>
        <p className="text-[1.125rem] font-medium text-gray-900">Candidate Quick Check-In is hidden here for Community Worship.</p>
      </MoreOptions>
    </div>
  );

  if (view === 'member') {
    return (
      <div className="min-h-screen bg-gray-100">
        <PreviewTopBar title="Self Check-In" onMenu={() => setMenuOpen(true)} />
        <div className="checkin-screen mx-auto max-w-xl p-4">
          <MemberIdQrPanel
            member={{ firstName: 'Mai', lastName: 'Santos', nickname: 'Mai', communityId: 'CEB-ME1801' }}
            event={MOCK_EVENTS[0]}
            onPrimaryAction={() => undefined}
          />
        </div>
      </div>
    );
  }

  if (view === 'desktop') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-lg">
          <div className="mx-auto max-w-7xl px-8 py-6">
            <h1 className="text-3xl font-bold text-rose-700">BLD Cebu Community Online Portal</h1>
            <p className="mt-1 text-base text-gray-600">Welcome, Mai Santos!</p>
            <nav className="mt-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
              {navItems.map((item) => (
                <span
                  key={item.href}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm ${
                    item.href === '/checkin' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </nav>
          </div>
        </header>
        <div className="p-8">
          <h1 className="mb-4 text-[1.875rem] font-bold text-gray-900">Check-In</h1>
          <div className="max-w-3xl">{staffMain}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PreviewTopBar title="Check-In" onMenu={() => setMenuOpen(true)} />
      {staffMain}
      {view === 'staff-success' ? (
        <CheckInResultOverlay
          result={{ kind: 'success', name: 'Mai Santos', communityId: 'CEB-ME1801' }}
          onDismiss={() => undefined}
          autoDismissMs={60_000}
        />
      ) : null}
      <div className="md:hidden">
        <MobileNavDrawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={navItems}
          pathname="/checkin"
          displayName="Mai Santos"
          communityId="CEB-ME1801"
          role="ADMINISTRATOR"
          onLogout={() => undefined}
        />
      </div>
    </div>
  );
}

function PreviewTopBar({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="bg-white shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-label="Menu"
          onClick={onMenu}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-gray-400"
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>
        <p className="text-[1.375rem] font-bold text-gray-900">{title}</p>
      </div>
    </header>
  );
}

export default function CheckInUxPreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-[1.125rem]">Loading preview…</p>}>
      <PreviewInner />
    </Suspense>
  );
}

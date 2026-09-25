/**
 * Role-aware dashboard navigation. Keep in sync with DashboardHeader.
 */

export type NavIconKey =
  | 'home'
  | 'checkin'
  | 'members'
  | 'events'
  | 'registrations'
  | 'reports'
  | 'profile';

export interface DashboardNavItem {
  href: string;
  label: string;
  iconKey: NavIconKey;
}

const ADMIN_ROLES = [
  'SUPER_USER',
  'ADMINISTRATOR',
  'DCS',
  'MINISTRY_COORDINATOR',
  'CLASS_SHEPHERD',
];

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function isMemberRole(role: string | null | undefined): boolean {
  return role === 'MEMBER';
}

export function getVisibleNavItems(role: string | null | undefined): DashboardNavItem[] {
  const member = isMemberRole(role);
  const admin = isAdminRole(role);

  const items: Array<DashboardNavItem & { show: boolean }> = [
    { href: '/dashboard', label: 'Dashboard', iconKey: 'home', show: true },
    {
      href: member ? '/checkin/self-checkin' : '/checkin',
      label: member ? 'Self Check-In' : 'Check-In',
      iconKey: 'checkin',
      show: true,
    },
    { href: '/members', label: 'Members', iconKey: 'members', show: admin },
    { href: '/events', label: 'Events', iconKey: 'events', show: true },
    {
      href: '/event-registrations',
      label: 'Registrations',
      iconKey: 'registrations',
      show: true,
    },
    { href: '/reports', label: 'Reports', iconKey: 'reports', show: admin },
    { href: '/profile', label: 'Profile', iconKey: 'profile', show: true },
  ];

  return items.filter((item) => item.show).map(({ show, ...item }) => {
    void show;
    return item;
  });
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  if (href === '/checkin') {
    return pathname === '/checkin' || (pathname.startsWith('/checkin/') && !pathname.startsWith('/checkin/self-checkin'));
  }
  if (href === '/checkin/self-checkin') {
    return pathname.startsWith('/checkin/self-checkin');
  }
  if (href === '/events') {
    return pathname === '/events' || pathname.startsWith('/events/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDashboardPageTitle(pathname: string): string {
  if (pathname.startsWith('/checkin/self-checkin')) return 'Self Check-In';
  if (pathname.startsWith('/candidate-checkin')) return 'Candidate Check-In';
  if (pathname.startsWith('/checkin')) return 'Check-In';
  if (pathname.startsWith('/members')) return 'Members';
  if (pathname.startsWith('/events/new')) return 'Set up an event';
  if (/^\/events\/[^/]+/.test(pathname)) return 'Event';
  if (pathname.startsWith('/events')) return 'Events';
  if (pathname.startsWith('/event-registrations')) return 'Registrations';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/accounting')) return 'Accounting';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  return 'BLD Cebu';
}

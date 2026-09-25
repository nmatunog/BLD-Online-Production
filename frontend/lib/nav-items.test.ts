import { describe, expect, it } from 'vitest';
import {
  getDashboardPageTitle,
  getVisibleNavItems,
  isNavItemActive,
} from './nav-items';

describe('getVisibleNavItems', () => {
  it('shows member check-in as Self Check-In and hides admin tools', () => {
    const items = getVisibleNavItems('MEMBER');
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/checkin/self-checkin');
    expect(hrefs).not.toContain('/checkin');
    expect(hrefs).not.toContain('/members');
    expect(hrefs).not.toContain('/reports');
    expect(hrefs).toContain('/events');
    expect(hrefs).toContain('/profile');
  });

  it('shows staff Check-In plus Members and Reports for admins', () => {
    const items = getVisibleNavItems('ADMINISTRATOR');
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/checkin');
    expect(hrefs).toContain('/members');
    expect(hrefs).toContain('/reports');
    expect(items.find((i) => i.href === '/checkin')?.label).toBe('Check-In');
  });
});

describe('isNavItemActive', () => {
  it('highlights the current check-in route without colliding with self check-in', () => {
    expect(isNavItemActive('/checkin', '/checkin')).toBe(true);
    expect(isNavItemActive('/checkin/self-checkin', '/checkin')).toBe(false);
    expect(isNavItemActive('/checkin/self-checkin', '/checkin/self-checkin')).toBe(true);
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavItemActive('/events/new', '/events')).toBe(true);
  });
});

describe('getDashboardPageTitle', () => {
  it('returns a visible page title for known routes', () => {
    expect(getDashboardPageTitle('/checkin')).toBe('Check-In');
    expect(getDashboardPageTitle('/checkin/self-checkin')).toBe('Self Check-In');
    expect(getDashboardPageTitle('/candidate-checkin')).toBe('Candidate Check-In');
    expect(getDashboardPageTitle('/events/new')).toBe('Set up an event');
    expect(getDashboardPageTitle('/events/abc')).toBe('Event');
    expect(getDashboardPageTitle('/dashboard')).toBe('Dashboard');
  });
});

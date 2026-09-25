import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Home, CheckCircle } from 'lucide-react';
import { MobileNavDrawer } from './MobileNavDrawer';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-current'?: 'page' | undefined;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('MobileNavDrawer', () => {
  it('lists role-based items, highlights the current page, and can close', () => {
    const onOpenChange = vi.fn();
    render(
      <MobileNavDrawer
        open
        onOpenChange={onOpenChange}
        pathname="/checkin"
        displayName="Nilo Admin"
        communityId="CEB-ME1801"
        role="ADMINISTRATOR"
        onLogout={vi.fn()}
        items={[
          { href: '/dashboard', label: 'Dashboard', iconKey: 'home', icon: Home },
          { href: '/checkin', label: 'Check-In', iconKey: 'checkin', icon: CheckCircle },
        ]}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    const current = screen.getByRole('link', { name: 'Check-In' });
    expect(current).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

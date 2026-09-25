import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, CheckCircle } from 'lucide-react';
import { MobileNavDrawer, type MobileNavDrawerItem } from './MobileNavDrawer';

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

const items: MobileNavDrawerItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconKey: 'home', icon: Home },
  { href: '/checkin', label: 'Check-In', iconKey: 'checkin', icon: CheckCircle },
];

function DrawerHarness({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <MobileNavDrawer
      open={open}
      onOpenChange={setOpen}
      pathname="/checkin"
      displayName="Nilo Admin"
      communityId="CEB-ME1801"
      role="ADMINISTRATOR"
      onLogout={vi.fn()}
      items={items}
      triggerRef={triggerRef}
      trigger={
        <button ref={triggerRef} type="button" aria-label="Menu">
          Menu
        </button>
      }
    />
  );
}

describe('MobileNavDrawer', () => {
  it('lists role-based items, highlights the current page, and can close', () => {
    const onOpenChange = vi.fn();
    const triggerRef = { current: document.createElement('button') };
    render(
      <MobileNavDrawer
        open
        onOpenChange={onOpenChange}
        pathname="/checkin"
        displayName="Nilo Admin"
        communityId="CEB-ME1801"
        role="ADMINISTRATOR"
        onLogout={vi.fn()}
        items={items}
        triggerRef={triggerRef}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    const current = screen.getByRole('link', { name: 'Check-In' });
    expect(current).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns focus to the Menu button after Escape', async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }));
    });
  });
});

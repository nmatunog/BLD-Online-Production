import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CheckInResultOverlay } from './CheckInResultOverlay';

describe('CheckInResultOverlay', () => {
  it('announces success and dismisses on Done', () => {
    const onDismiss = vi.fn();
    render(
      <CheckInResultOverlay
        result={{ kind: 'success', name: 'Mai Santos', communityId: 'CEB-ME1801' }}
        onDismiss={onDismiss}
        autoDismissMs={60_000}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
    expect(screen.getByText('Mai Santos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders a non-alarming already-checked-in state', () => {
    render(
      <CheckInResultOverlay
        result={{ kind: 'already', name: 'Mai Santos', communityId: 'CEB-ME1801' }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Already checked in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('renders an error with a plain-language Try again action', () => {
    render(
      <CheckInResultOverlay
        result={{ kind: 'error', message: 'Member not found', hint: 'Search by name instead.' }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Could not check in')).toBeInTheDocument();
    expect(screen.getByText('Search by name instead.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

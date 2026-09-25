import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StaffMemberResultCard } from './StaffMemberResultCard';

const member = {
  id: '1',
  name: 'Mai Santos',
  communityId: 'CEB-ME1801',
};

describe('StaffMemberResultCard', () => {
  it('shows large name, Community ID, and a Check In action', () => {
    const onCheckIn = vi.fn();
    render(<StaffMemberResultCard member={member} onCheckIn={onCheckIn} />);
    expect(screen.getByText('Mai Santos')).toBeInTheDocument();
    expect(screen.getByText('CEB-ME1801')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check In' }));
    expect(onCheckIn).toHaveBeenCalledWith('CEB-ME1801');
  });

  it('shows a calm already-checked-in state instead of Check In', () => {
    render(
      <StaffMemberResultCard member={member} alreadyCheckedIn onCheckIn={vi.fn()} />,
    );
    expect(screen.getByText('Already checked in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument();
  });
});

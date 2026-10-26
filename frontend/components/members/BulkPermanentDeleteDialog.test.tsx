import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BulkPermanentDeleteDialog } from './BulkPermanentDeleteDialog';

const members = [
  { id: 'm1', name: 'Ada Reyes', communityId: 'CEB-ME9902' },
  { id: 'm2', name: 'Ben Cruz', communityId: 'CEB-ME8802' },
];

describe('BulkPermanentDeleteDialog', () => {
  it('lists every name and community ID and requires DELETE before running', async () => {
    const onConfirm = vi.fn().mockResolvedValue({
      deletedCount: 2,
      communityIds: ['CEB-ME9902', 'CEB-ME8802'],
      results: [
        { memberId: 'm1', name: 'Ada Reyes', communityId: 'CEB-ME9902', status: 'deleted' },
        { memberId: 'm2', name: 'Ben Cruz', communityId: 'CEB-ME8802', status: 'deleted' },
      ],
    });
    const onCompleted = vi.fn();

    render(
      <BulkPermanentDeleteDialog
        open
        members={members}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCompleted={onCompleted}
      />,
    );

    expect(screen.getByText('Ada Reyes')).toBeInTheDocument();
    expect(screen.getByText('CEB-ME9902')).toBeInTheDocument();
    expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    expect(screen.getByText('CEB-ME8802')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Remove selected permanently' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), {
      target: { value: 'delete' },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), {
      target: { value: 'DELETE' },
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Removal complete')).toBeInTheDocument();
    expect(screen.getAllByText('Removed')).toHaveLength(2);
  });
});

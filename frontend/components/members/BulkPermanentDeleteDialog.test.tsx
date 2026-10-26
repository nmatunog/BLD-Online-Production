import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BulkPermanentDeleteDialog } from './BulkPermanentDeleteDialog';
import type { BulkPermanentDeleteResponse } from '@/services/members.service';

const MEMBER_1 = '11111111-1111-4111-8111-111111111111';
const MEMBER_2 = '22222222-2222-4222-8222-222222222222';

const members = [
  { id: MEMBER_1, name: 'Ada Reyes', communityId: 'CEB-ME9902' },
  { id: MEMBER_2, name: 'Ben Cruz', communityId: 'CEB-ME8802' },
];

const successResponse: BulkPermanentDeleteResponse = {
  deletedCount: 2,
  communityIds: ['CEB-ME9902', 'CEB-ME8802'],
  results: [
    { memberId: MEMBER_1, name: 'Ada Reyes', communityId: 'CEB-ME9902', status: 'deleted' },
    { memberId: MEMBER_2, name: 'Ben Cruz', communityId: 'CEB-ME8802', status: 'deleted' },
  ],
};

function typeDeleteAndGetConfirmButton() {
  fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), {
    target: { value: 'DELETE' },
  });
  return screen.getByRole('button', { name: 'Remove selected permanently' });
}

describe('BulkPermanentDeleteDialog', () => {
  it('lists every name and community ID and requires DELETE before running', async () => {
    const onConfirm = vi.fn().mockResolvedValue(successResponse);

    render(
      <BulkPermanentDeleteDialog
        open
        members={members}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCompleted={vi.fn()}
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

  it('single-flights a double click so only one POST runs', async () => {
    let resolvePost: (value: BulkPermanentDeleteResponse) => void = () => undefined;
    const post = vi.fn(
      () =>
        new Promise<BulkPermanentDeleteResponse>((resolve) => {
          resolvePost = resolve;
        }),
    );

    render(
      <BulkPermanentDeleteDialog
        open
        members={members}
        onOpenChange={vi.fn()}
        onConfirm={post}
        onCompleted={vi.fn()}
      />,
    );

    const confirmButton = typeDeleteAndGetConfirmButton();
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(post).toHaveBeenCalledTimes(1);
    resolvePost(successResponse);
    expect(await screen.findByText('Removal complete')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the server error message from getMemberApiErrorMessage', async () => {
    const onConfirm = vi.fn().mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'SUPER_USER accounts cannot be permanently deleted.' },
      },
      message: 'Request failed with status code 403',
    });

    render(
      <BulkPermanentDeleteDialog
        open
        members={members}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCompleted={vi.fn()}
      />,
    );

    fireEvent.click(typeDeleteAndGetConfirmButton());
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('SUPER_USER accounts cannot be permanently deleted.');
  });
});

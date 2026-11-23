import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { adminCreate, uploadMemberPhoto, issue } = vi.hoisted(() => ({
  adminCreate: vi.fn(),
  uploadMemberPhoto: vi.fn(),
  issue: vi.fn(),
}));

vi.mock('@/services/members.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/members.service')>();
  return {
    ...actual,
    membersService: { adminCreate, uploadMemberPhoto },
  };
});

vi.mock('@/services/member-cards.service', () => ({
  memberCardsService: { issue },
}));

// The real component opens the camera / runs background removal; a button is enough here.
vi.mock('@/components/IdPhotoUpload', () => ({
  IdPhotoUpload: ({ onPhotoProcessed }: { onPhotoProcessed: (url: string | null) => void }) => (
    <button type="button" onClick={() => onPhotoProcessed('data:image/jpeg;base64,AAAA')}>
      Fake photo
    </button>
  ),
}));

import { AddMemberDialog, MOBILE_HELP, NICKNAME_WARNING } from './AddMemberDialog';
import { AdminCreateDuplicateError, type Member } from '@/services/members.service';

function createdMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-new',
    userId: 'user-new',
    firstName: 'Test',
    lastName: 'Nomobile',
    communityId: 'CEB-ME9901',
    city: 'CEB',
    encounterType: 'ME',
    classNumber: 99,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    user: {
      id: 'user-new',
      email: null,
      phone: null,
      role: 'MEMBER',
      isActive: true,
      adminActivationRequired: true,
    },
    ...overrides,
  };
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequired() {
  fill(/First name/, 'Test');
  fill(/Last name/, 'Nomobile');
  fill(/Encounter type/, 'ME');
  fill(/Class number/, '99');
}

function renderDialog(onMemberAdded = vi.fn()) {
  render(<AddMemberDialog open onOpenChange={vi.fn()} onMemberAdded={onMemberAdded} />);
  return { onMemberAdded };
}

describe('AddMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminCreate.mockResolvedValue(createdMember());
    uploadMemberPhoto.mockResolvedValue('https://bld-idphotos.b-cdn.net/x.jpg');
    issue.mockResolvedValue({
      success: true,
      data: { issued: [{ cardId: 'c1', memberId: 'member-new', nfcUrl: 'u', token: 't' }], skipped: [] },
    });
  });

  it('requires first name, last name, encounter type and class', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Select an encounter type.')).toBeInTheDocument();
    expect(screen.getByText('Class number is required.')).toBeInTheDocument();
    expect(adminCreate).not.toHaveBeenCalled();
  });

  it('shows the nickname warning and the mobile help text', () => {
    renderDialog();
    expect(screen.getByText(NICKNAME_WARNING)).toBeInTheDocument();
    expect(screen.getByText(MOBILE_HELP)).toBeInTheDocument();
    fill(/Nickname/, 'Tess');
    expect(screen.queryByText(NICKNAME_WARNING)).not.toBeInTheDocument();
  });

  it('accepts a blank mobile and sends only the filled fields', async () => {
    renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(adminCreate).toHaveBeenCalledTimes(1));
    expect(adminCreate).toHaveBeenCalledWith({
      firstName: 'Test',
      lastName: 'Nomobile',
      encounterType: 'ME',
      classNumber: '99',
    });
    expect(await screen.findByText('Not activated — add a mobile in Edit to enable login')).toBeInTheDocument();
  });

  it('rejects a malformed mobile before calling the API', async () => {
    renderDialog();
    fillRequired();
    fill(/Mobile/, '0917123');
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText(/Mobile must be 11 digits starting with 09/)).toBeInTheDocument();
    expect(adminCreate).not.toHaveBeenCalled();
  });

  it('creates, then uploads the photo, then issues the card, in that order', async () => {
    adminCreate.mockResolvedValue(
      createdMember({
        user: { id: 'user-new', email: null, phone: '09171234567', role: 'MEMBER', isActive: true, adminActivationRequired: false },
      }),
    );
    const { onMemberAdded } = renderDialog();
    fillRequired();
    fill(/Mobile/, '0917 123 4567');
    fireEvent.click(screen.getByRole('button', { name: 'Fake photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText('ID card + QR issued')).toBeInTheDocument();
    expect(adminCreate.mock.calls[0][0].phone).toBe('09171234567');
    expect(uploadMemberPhoto).toHaveBeenCalledWith('member-new', 'data:image/jpeg;base64,AAAA');
    expect(issue).toHaveBeenCalledWith(['member-new']);
    const order = [adminCreate, uploadMemberPhoto, issue].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Photo saved')).toBeInTheDocument();
    expect(screen.getByText('Mobile set — member sets a password via Forgot Password')).toBeInTheDocument();
    expect(screen.getByText('CEB-ME9901')).toBeInTheDocument();
  });

  it('skips the card when the box is unchecked, and keeps the member if the photo fails', async () => {
    uploadMemberPhoto.mockRejectedValue(new Error('Photo is too small'));
    const { onMemberAdded } = renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Fake photo' }));
    fireEvent.click(screen.getByLabelText('Issue ID card + QR now'));
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText('Photo not saved: Photo is too small')).toBeInTheDocument();
    expect(screen.getByText('Retry from Edit / Cards.')).toBeInTheDocument();
    expect(issue).not.toHaveBeenCalled();
    expect(onMemberAdded).toHaveBeenCalledTimes(1);
  });

  it('shows a same-class duplicate prominently and resends with confirmNotDuplicate', async () => {
    adminCreate.mockRejectedValueOnce(
      new AdminCreateDuplicateError(
        {
          firstName: 'Test',
          lastName: 'Nomobile',
          nickname: 'Tess',
          encounterType: 'ME',
          classNumber: 99,
          communityId: 'CEB-ME9905',
        },
        true,
      ),
    );
    renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(
      await screen.findByText('Same name AND same class — very likely already registered'),
    ).toBeInTheDocument();
    expect(screen.getByText('CEB-ME9905')).toBeInTheDocument();
    expect(screen.getByText('Tess')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Different person — add anyway' }));
    await waitFor(() => expect(adminCreate).toHaveBeenCalledTimes(2));
    expect(adminCreate.mock.calls[1][0]).toMatchObject({ confirmNotDuplicate: true });
    expect(adminCreate.mock.calls[0][0].confirmNotDuplicate).toBeUndefined();
  });

  it('Cancel on the duplicate prompt returns to the form without creating', async () => {
    adminCreate.mockRejectedValueOnce(
      new AdminCreateDuplicateError({ firstName: 'Test', lastName: 'Nomobile', encounterType: 'SE', classNumber: 3 }, false),
    );
    renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('A member with this name is already registered')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText(/First name/)).toHaveValue('Test');
    expect(adminCreate).toHaveBeenCalledTimes(1);
  });

  it('Save & add another resets the form but keeps encounter, class, apostolate and ministry', async () => {
    renderDialog();
    fillRequired();
    fill(/Nickname/, 'Tess');
    fill(/Apostolate/, 'Evangelization Apostolate');
    fill(/^Ministry/, 'Praise Ministry');
    fill(/Email/, 'test@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save & add another' }));

    expect(await screen.findByText(/Added Test Nomobile/)).toBeInTheDocument();
    expect(adminCreate.mock.calls[0][0]).toMatchObject({
      apostolate: 'Evangelization Apostolate',
      ministry: 'Praise Ministry',
      email: 'test@example.com',
    });
    expect(screen.getByLabelText(/First name/)).toHaveValue('');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('');
    expect(screen.getByLabelText(/Nickname/)).toHaveValue('');
    expect(screen.getByLabelText(/Email/)).toHaveValue('');
    expect(screen.getByLabelText(/Encounter type/)).toHaveValue('ME');
    expect(screen.getByLabelText(/Class number/)).toHaveValue('99');
    expect(screen.getByLabelText(/Apostolate/)).toHaveValue('Evangelization Apostolate');
    expect(screen.getByLabelText(/^Ministry/)).toHaveValue('Praise Ministry');
  });

  it('disables submit while saving', async () => {
    let resolve: (m: Member) => void = () => undefined;
    adminCreate.mockReturnValueOnce(new Promise<Member>((r) => (resolve = r)));
    renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolve(createdMember());
    expect(await screen.findByText(/Added Test Nomobile/)).toBeInTheDocument();
  });

  it('shows a server error and keeps the form for correction', async () => {
    adminCreate.mockRejectedValueOnce(new Error('This email is already in use by another account.'));
    renderDialog();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This email is already in use by another account.');
    expect(screen.getByLabelText(/First name/)).toHaveValue('Test');
  });
});

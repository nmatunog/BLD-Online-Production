import { beforeEach, describe, expect, it, vi } from 'vitest';

const verify = vi.fn();
vi.mock('@/services/member-cards.service', () => ({
  memberCardsService: { verify: (token: string) => verify(token) },
}));

import { extractCardToken, resolveCardScan } from './card-scan';

const TOKEN = 'Abcdefghijklmnop_qrs-TUV';

describe('extractCardToken', () => {
  it('reads tokens from printed-card verify links', () => {
    expect(extractCardToken(`https://app.bldcebu.com/verify/${TOKEN}`)).toBe(TOKEN);
    expect(extractCardToken(`  https://app.bldcebu.com/verify/${TOKEN}/  `)).toBe(TOKEN);
    expect(extractCardToken(`/verify/${TOKEN}?src=qr`)).toBe(TOKEN);
  });

  it('ignores member IDs, event links and malformed tokens', () => {
    expect(extractCardToken('CEB-ME1801')).toBeNull();
    expect(extractCardToken('https://app.bldcebu.com/checkin/event-1')).toBeNull();
    expect(extractCardToken('https://app.bldcebu.com/verify/short')).toBeNull();
    expect(extractCardToken(`https://app.bldcebu.com/verify/${TOKEN}/extra`)).toBeNull();
    expect(extractCardToken('https://app.bldcebu.com/verify/%E0%A4%A')).toBeNull();
    expect(extractCardToken({ communityId: 'CEB-ME1801' })).toBeNull();
  });
});

describe('resolveCardScan', () => {
  beforeEach(() => verify.mockReset());

  it('maps a valid public card to the member ID', async () => {
    verify.mockResolvedValue({
      success: true,
      data: {
        view: 'public',
        status: 'VALID',
        member: { fullName: 'Juan Dela Cruz', memberId: 'CEB-ME1801', ministry: 'Music', photoUrl: null },
      },
    });
    await expect(resolveCardScan(TOKEN)).resolves.toEqual({
      kind: 'member',
      communityId: 'CEB-ME1801',
      name: 'Juan Dela Cruz',
    });
    expect(verify).toHaveBeenCalledWith(TOKEN);
  });

  it('maps a staff view and flags revoked cards', async () => {
    verify.mockResolvedValue({
      success: true,
      data: {
        view: 'staff',
        status: 'REVOKED',
        cardStatus: 'REVOKED',
        cardId: 'card-1',
        member: {
          id: 'm1',
          firstName: 'Ana',
          lastName: 'Cruz',
          nickname: null,
          communityId: 'CEB-ME1802',
          ministry: 'No ministry assigned',
          photoUrl: null,
        },
      },
    });
    await expect(resolveCardScan(TOKEN)).resolves.toEqual({
      kind: 'revoked',
      communityId: 'CEB-ME1802',
      name: 'Ana Cruz',
    });
  });

  it('returns not-found for unknown cards', async () => {
    verify.mockResolvedValue({ success: true, data: { view: 'public', status: 'NOT_FOUND', member: null } });
    await expect(resolveCardScan(TOKEN)).resolves.toEqual({ kind: 'not-found' });
    verify.mockResolvedValue({ success: false, error: 'nope' });
    await expect(resolveCardScan(TOKEN)).resolves.toEqual({ kind: 'not-found' });
  });
});

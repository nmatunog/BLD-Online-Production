import { resolveDisplayMinistry } from './member-card-ministry';

describe('resolveDisplayMinistry', () => {
  it('prefers Member.ministry when present', () => {
    expect(
      resolveDisplayMinistry({
        ministry: 'Worship',
        ministryHistory: [{ ministry: 'Music', endDate: null }],
        user: { ministry: 'Service' },
      }),
    ).toBe('Worship');
  });

  it('uses the current ministry history row when Member.ministry is empty', () => {
    expect(
      resolveDisplayMinistry({
        ministry: null,
        ministryHistory: [
          { ministry: 'Old Ministry', endDate: new Date('2026-01-01') },
          { ministry: 'Praise Ministry', endDate: null },
        ],
        user: { ministry: 'Service' },
      }),
    ).toBe('Praise Ministry');
  });

  it('falls back to user.ministry when member and current history are empty', () => {
    expect(
      resolveDisplayMinistry({
        ministry: '  ',
        ministryHistory: [{ ministry: 'Closed', endDate: '2026-03-01' }],
        user: { ministry: 'Intercessory' },
      }),
    ).toBe('Intercessory');
  });

  it('returns null when no source has a ministry', () => {
    expect(resolveDisplayMinistry({ ministry: null, ministryHistory: [], user: { ministry: null } })).toBeNull();
  });
});

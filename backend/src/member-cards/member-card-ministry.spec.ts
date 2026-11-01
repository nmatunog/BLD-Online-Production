import { NO_MINISTRY_ASSIGNED, resolveDisplayMinistry } from './member-card-ministry';

describe('resolveDisplayMinistry', () => {
  it('prefers the current ministry history row over Member.ministry', () => {
    expect(
      resolveDisplayMinistry({
        ministry: 'Worship',
        ministryHistory: [{ ministry: 'Music', endDate: null, startDate: '2026-02-01' }],
        user: { ministry: 'Service' },
      }),
    ).toBe('Music');
  });

  it('uses the latest startDate when several history rows are current', () => {
    expect(
      resolveDisplayMinistry({
        ministry: 'Worship',
        ministryHistory: [
          { ministry: 'Older Current', endDate: null, startDate: '2025-01-01' },
          { ministry: 'Newest Current', endDate: null, startDate: '2026-06-01' },
          { ministry: 'Closed', endDate: '2026-01-01', startDate: '2024-01-01' },
        ],
        user: { ministry: 'Service' },
      }),
    ).toBe('Newest Current');
  });

  it('falls back to Member.ministry when there is no current history row', () => {
    expect(
      resolveDisplayMinistry({
        ministry: 'Worship',
        ministryHistory: [{ ministry: 'Closed', endDate: '2026-03-01', startDate: '2025-01-01' }],
        user: { ministry: 'Service' },
      }),
    ).toBe('Worship');
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

  it('returns No ministry assigned when no source has a ministry', () => {
    expect(
      resolveDisplayMinistry({ ministry: null, ministryHistory: [], user: { ministry: null } }),
    ).toBe(NO_MINISTRY_ASSIGNED);
  });
});

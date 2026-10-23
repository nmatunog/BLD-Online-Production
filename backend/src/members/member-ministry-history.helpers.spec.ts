import { planMinistryHistorySync } from './member-ministry-history.helpers';

describe('planMinistryHistorySync', () => {
  const communityStart = '2026-01-06';
  const today = '2026-10-15';

  it('is a no-op when ministry and start date are unchanged', () => {
    expect(
      planMinistryHistorySync({
        existing: [],
        previousMinistry: 'Music Ministry',
        nextMinistry: 'Music Ministry',
        communityStart,
        today,
      }),
    ).toEqual({ create: [], update: [] });
  });

  it('materializes implicit current ministry when only the start date is set', () => {
    expect(
      planMinistryHistorySync({
        existing: [],
        previousMinistry: 'Music Ministry',
        nextMinistry: 'Music Ministry',
        requestedStart: '2026-03-01',
        communityStart,
        today,
      }),
    ).toEqual({
      create: [{ ministry: 'Music Ministry', startDate: '2026-03-01', endDate: null }],
      update: [],
    });
  });

  it('closes the implicit old ministry and opens the new one on first transfer', () => {
    expect(
      planMinistryHistorySync({
        existing: [],
        previousMinistry: 'Music Ministry',
        nextMinistry: 'Praise Ministry',
        requestedStart: '2026-06-02',
        communityStart,
        today,
      }),
    ).toEqual({
      create: [
        { ministry: 'Music Ministry', startDate: '2026-01-06', endDate: '2026-06-01' },
        { ministry: 'Praise Ministry', startDate: '2026-06-02', endDate: null },
      ],
      update: [],
    });
  });

  it('does not write an empty old range for a same-day ministry correction', () => {
    expect(
      planMinistryHistorySync({
        existing: [],
        previousMinistry: 'Music Ministry',
        nextMinistry: 'Praise Ministry',
        requestedStart: communityStart,
        communityStart,
        today,
      }),
    ).toEqual({
      create: [{ ministry: 'Praise Ministry', startDate: communityStart, endDate: null }],
      update: [],
    });
  });

  it('closes the open history row and opens the new ministry', () => {
    expect(
      planMinistryHistorySync({
        existing: [
          {
            id: 'h1',
            ministry: 'Music Ministry',
            startDate: '2026-01-06',
            endDate: null,
          },
        ],
        previousMinistry: 'Music Ministry',
        nextMinistry: 'Intercessory Ministry',
        requestedStart: '2026-10-15',
        communityStart,
        today,
      }),
    ).toEqual({
      create: [{ ministry: 'Intercessory Ministry', startDate: '2026-10-15', endDate: null }],
      update: [{ id: 'h1', endDate: '2026-10-14' }],
    });
  });

  it('defaults the transfer start to today when the admin does not pick a date', () => {
    const plan = planMinistryHistorySync({
      existing: [],
      previousMinistry: 'Word Ministry',
      nextMinistry: 'Teaching Ministry',
      communityStart,
      today,
    });
    expect(plan.create[1]).toEqual({
      ministry: 'Teaching Ministry',
      startDate: today,
      endDate: null,
    });
  });
});

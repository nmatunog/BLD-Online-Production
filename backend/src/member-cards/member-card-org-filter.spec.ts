import {
  apostolateForMinistry,
  matchesOrgFilter,
  NO_MINISTRY_FILTER,
  resolveCurrentApostolate,
} from './member-card-org-filter';

describe('member card apostolate/ministry filter', () => {
  it('maps a ministry to its apostolate, ignoring case and spaces', () => {
    expect(apostolateForMinistry('Praise Ministry')).toBe('Evangelization Apostolate');
    expect(apostolateForMinistry('  intercessory ministry ')).toBe('Formation Apostolate');
    expect(apostolateForMinistry('Unknown')).toBeNull();
    expect(apostolateForMinistry(null)).toBeNull();
  });

  it('uses the current ministry (open history row) to place a transferred member', () => {
    const transferred = {
      apostolate: 'Pastoral Apostolate',
      ministry: 'Youth Ministry',
      ministryHistory: [{ ministry: 'Praise Ministry', endDate: null, startDate: '2026-10-01' }],
    };
    expect(resolveCurrentApostolate(transferred)).toBe('Evangelization Apostolate');
    expect(matchesOrgFilter(transferred, { apostolate: 'Evangelization Apostolate' })).toBe(true);
    expect(matchesOrgFilter(transferred, { apostolate: 'Pastoral Apostolate' })).toBe(false);
    expect(matchesOrgFilter(transferred, { ministry: 'praise ministry' })).toBe(true);
    expect(matchesOrgFilter(transferred, { ministry: 'Youth Ministry' })).toBe(false);
  });

  it('falls back to Member.apostolate and user.ministry', () => {
    expect(resolveCurrentApostolate({ apostolate: 'mission apostolate' })).toBe('Mission Apostolate');
    expect(
      matchesOrgFilter({ user: { ministry: 'Word Ministry' } }, {
        apostolate: 'Formation Apostolate',
        ministry: 'Word Ministry',
      }),
    ).toBe(true);
  });

  it('can list members with no ministry', () => {
    expect(matchesOrgFilter({ ministry: null }, { ministry: NO_MINISTRY_FILTER })).toBe(true);
    expect(matchesOrgFilter({ ministry: 'Word Ministry' }, { ministry: NO_MINISTRY_FILTER })).toBe(false);
  });

  it('matches everyone when no filter is set', () => {
    expect(matchesOrgFilter({ ministry: null }, undefined)).toBe(true);
    expect(matchesOrgFilter({ ministry: null }, { apostolate: '', ministry: '  ' })).toBe(true);
  });
});

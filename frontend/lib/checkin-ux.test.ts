import { describe, expect, it } from 'vitest';
import {
  checkInErrorHint,
  formatEventDateManila,
  formatEventTimeManila,
  formatEventWhenManila,
  isAlreadyCheckedInMessage,
  looksLikeCommunityId,
  memberDisplayName,
  normalizeCommunityIdQuery,
  resultFromCheckInError,
  splitNameQuery,
} from './checkin-ux';

describe('looksLikeCommunityId', () => {
  it('accepts standard Community IDs', () => {
    expect(looksLikeCommunityId('CEB-ME1801')).toBe(true);
    expect(looksLikeCommunityId('ceb-se2203')).toBe(true);
  });

  it('rejects plain names', () => {
    expect(looksLikeCommunityId('Maria Santos')).toBe(false);
    expect(looksLikeCommunityId('Santos')).toBe(false);
    expect(looksLikeCommunityId('')).toBe(false);
  });
});

describe('normalizeCommunityIdQuery', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizeCommunityIdQuery('  ceb-me1801 ')).toBe('CEB-ME1801');
  });
});

describe('isAlreadyCheckedInMessage', () => {
  it('detects the backend 409 copy', () => {
    expect(isAlreadyCheckedInMessage('Member is already checked in to this event session')).toBe(
      true,
    );
    expect(isAlreadyCheckedInMessage('Check-in failed')).toBe(false);
  });
});

describe('memberDisplayName', () => {
  it('prefers nickname + last name', () => {
    expect(
      memberDisplayName({ firstName: 'Maria', lastName: 'Santos', nickname: 'Mai' }),
    ).toBe('Mai Santos');
  });

  it('falls back to first + last', () => {
    expect(memberDisplayName({ firstName: 'Maria', lastName: 'Santos' })).toBe('Maria Santos');
  });
});

describe('formatEventTimeManila', () => {
  it('formats 24h wall-clock as 12h', () => {
    expect(formatEventTimeManila('19:00')).toBe('7:00 PM');
    expect(formatEventTimeManila('09:30')).toBe('9:30 AM');
    expect(formatEventTimeManila(null)).toBe('');
  });
});

describe('formatEventDateManila', () => {
  it('formats an ISO date in Asia/Manila', () => {
    const formatted = formatEventDateManila('2026-09-22T11:00:00.000Z');
    expect(formatted).toMatch(/Sep/);
    expect(formatted).toMatch(/2026/);
  });
});

describe('formatEventWhenManila', () => {
  it('joins date and time', () => {
    const when = formatEventWhenManila('2026-09-22T11:00:00.000Z', '19:00');
    expect(when).toContain('7:00 PM');
    expect(when).toContain('·');
  });
});

describe('checkInErrorHint / resultFromCheckInError', () => {
  it('maps already-checked-in to a calm result', () => {
    const result = resultFromCheckInError(
      'Member is already checked in to this event session',
      'Mai Santos',
      'CEB-ME1801',
    );
    expect(result.kind).toBe('already');
    expect(result.name).toBe('Mai Santos');
    expect(checkInErrorHint(result.message || '')).toMatch(/already/i);
  });

  it('maps unknown errors to a try-again hint', () => {
    const result = resultFromCheckInError('Network down');
    expect(result.kind).toBe('error');
    expect(result.hint).toMatch(/Try again/);
  });
});

describe('splitNameQuery', () => {
  it('treats a single token as last name', () => {
    expect(splitNameQuery('Santos')).toEqual({ lastName: 'Santos' });
  });

  it('splits first and remaining last names', () => {
    expect(splitNameQuery('Maria dela Cruz')).toEqual({
      firstName: 'Maria',
      lastName: 'dela Cruz',
    });
  });
});

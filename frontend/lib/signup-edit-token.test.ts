// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getSignupEditToken, saveSignupEditToken } from './signup-edit-token';

describe('signup edit token storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores the token per member and reads it back', () => {
    saveSignupEditToken('member-1', 'tok-1');
    expect(getSignupEditToken('member-1')).toBe('tok-1');
    expect(getSignupEditToken('member-2')).toBeNull();
  });

  it('ignores missing values', () => {
    saveSignupEditToken('member-1', undefined);
    saveSignupEditToken('', 'tok');
    expect(getSignupEditToken('member-1')).toBeNull();
    expect(getSignupEditToken(null)).toBeNull();
  });
});

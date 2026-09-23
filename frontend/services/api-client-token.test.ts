import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  describeRefreshFailure,
  getAccessTokenExpiryMs,
  planFreshAccessToken,
  runEnsureFreshToken,
  SESSION_EXPIRED_MESSAGE,
  shouldRefreshAccessToken,
} from './api-client-token';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('SESSION_EXPIRED_MESSAGE', () => {
  it('tells the user to log in again', () => {
    expect(SESSION_EXPIRED_MESSAGE).toMatch(/session expired/i);
    expect(SESSION_EXPIRED_MESSAGE).toMatch(/log in again/i);
  });
});

describe('shouldRefreshAccessToken / near-expiry', () => {
  const nowMs = Date.UTC(2026, 8, 23, 7, 0, 0);

  it('refreshes when the access token is missing', () => {
    expect(shouldRefreshAccessToken(null, nowMs)).toBe(true);
    expect(shouldRefreshAccessToken('', nowMs)).toBe(true);
  });

  it('refreshes when the JWT cannot be decoded', () => {
    expect(shouldRefreshAccessToken('not-a-jwt', nowMs)).toBe(true);
    expect(getAccessTokenExpiryMs('abc.%%%')).toBeNull();
  });

  it('refreshes when the token is already expired', () => {
    const token = fakeJwt({ exp: Math.floor((nowMs - 1_000) / 1000) });
    expect(shouldRefreshAccessToken(token, nowMs)).toBe(true);
  });

  it('refreshes when expiry is inside the skew window', () => {
    const token = fakeJwt({
      exp: Math.floor((nowMs + ACCESS_TOKEN_REFRESH_SKEW_MS - 1_000) / 1000),
    });
    expect(shouldRefreshAccessToken(token, nowMs)).toBe(true);
  });

  it('keeps a token that is still valid beyond the skew window', () => {
    const token = fakeJwt({
      exp: Math.floor((nowMs + ACCESS_TOKEN_REFRESH_SKEW_MS + 30_000) / 1000),
    });
    expect(shouldRefreshAccessToken(token, nowMs)).toBe(false);
    expect(getAccessTokenExpiryMs(token)).toBe(
      Math.floor((nowMs + ACCESS_TOKEN_REFRESH_SKEW_MS + 30_000) / 1000) * 1000,
    );
  });
});

describe('planFreshAccessToken', () => {
  const nowMs = Date.UTC(2026, 8, 23, 7, 0, 0);
  const fresh = fakeJwt({ exp: Math.floor((nowMs + 10 * 60_000) / 1000) });
  const expired = fakeJwt({ exp: Math.floor((nowMs - 5_000) / 1000) });

  it('uses a still-valid access token', () => {
    expect(planFreshAccessToken(fresh, 'refresh', nowMs)).toEqual({
      action: 'use',
      accessToken: fresh,
    });
  });

  it('refreshes when the access token is expired or near expiry', () => {
    expect(planFreshAccessToken(expired, 'refresh-token', nowMs)).toEqual({
      action: 'refresh',
      refreshToken: 'refresh-token',
    });
    const nearExpiry = fakeJwt({
      exp: Math.floor((nowMs + ACCESS_TOKEN_REFRESH_SKEW_MS / 2) / 1000),
    });
    expect(planFreshAccessToken(nearExpiry, 'refresh-token', nowMs)).toEqual({
      action: 'refresh',
      refreshToken: 'refresh-token',
    });
  });

  it('marks the session expired when refresh cannot run', () => {
    expect(planFreshAccessToken(expired, null, nowMs)).toEqual({ action: 'expired' });
    expect(planFreshAccessToken(null, null, nowMs)).toEqual({ action: 'expired' });
  });
});

describe('runEnsureFreshToken', () => {
  const nowMs = Date.UTC(2026, 8, 23, 7, 0, 0);
  const fresh = fakeJwt({ exp: Math.floor((nowMs + 10 * 60_000) / 1000) });
  const expired = fakeJwt({ exp: Math.floor((nowMs - 5_000) / 1000) });

  it('returns the current token when it is still fresh', async () => {
    const refresh = async () => 'should-not-run';
    await expect(runEnsureFreshToken(fresh, 'refresh', refresh, nowMs)).resolves.toBe(fresh);
  });

  it('refreshes an expired or near-expiry token', async () => {
    const refresh = async (token: string) => {
      expect(token).toBe('refresh-token');
      return 'new-access';
    };
    await expect(runEnsureFreshToken(expired, 'refresh-token', refresh, nowMs)).resolves.toBe(
      'new-access',
    );
  });

  it('throws a clear session-expired error when refresh fails', async () => {
    await expect(runEnsureFreshToken(expired, 'refresh-token', async () => null, nowMs)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
    await expect(runEnsureFreshToken(expired, null, async () => 'nope', nowMs)).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE,
    );
  });
});

describe('describeRefreshFailure', () => {
  it('exposes axios status and body for logging', () => {
    expect(
      describeRefreshFailure({
        response: { status: 401, data: { message: 'Invalid refresh token' } },
        message: 'Request failed with status code 401',
      }),
    ).toEqual({ status: 401, body: { message: 'Invalid refresh token' } });
  });

  it('falls back to the error message when there is no response', () => {
    expect(describeRefreshFailure(new Error('Network Error'))).toEqual({
      status: null,
      body: 'Network Error',
    });
  });
});

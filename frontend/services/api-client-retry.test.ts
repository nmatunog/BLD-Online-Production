import { AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  buildRetriedRequestConfig,
  isAuthEndpointUrl,
  isCredentialAttemptUrl,
  shouldClearSessionOn401,
  toRelativeRequestUrl,
  type RetryableRequestConfig,
} from './api-client-retry';

describe('shouldClearSessionOn401', () => {
  it('does not clear session on failed login/register', () => {
    expect(
      shouldClearSessionOn401({
        isCredentialAttempt: true,
        alreadyRetried: false,
        refreshSucceeded: false,
      }),
    ).toBe(false);
  });

  it('does not clear session after a successful refresh', () => {
    expect(
      shouldClearSessionOn401({
        isCredentialAttempt: false,
        alreadyRetried: false,
        refreshSucceeded: true,
      }),
    ).toBe(false);
  });

  it('does not clear session when the retried request still returns 401', () => {
    expect(
      shouldClearSessionOn401({
        isCredentialAttempt: false,
        alreadyRetried: true,
        refreshSucceeded: true,
      }),
    ).toBe(false);
  });

  it('clears session when a protected call is unauthorized and refresh cannot run', () => {
    expect(
      shouldClearSessionOn401({
        isCredentialAttempt: false,
        alreadyRetried: false,
        refreshSucceeded: false,
      }),
    ).toBe(true);
  });
});

describe('auth URL helpers', () => {
  it('treats login and refresh as auth endpoints', () => {
    expect(isAuthEndpointUrl('/auth/login')).toBe(true);
    expect(isAuthEndpointUrl('/auth/refresh')).toBe(true);
    expect(isAuthEndpointUrl('/members/1/photo')).toBe(false);
  });

  it('does not treat refresh as a credential attempt', () => {
    expect(isCredentialAttemptUrl('/auth/refresh')).toBe(false);
    expect(isCredentialAttemptUrl('/auth/login')).toBe(true);
  });
});

describe('toRelativeRequestUrl', () => {
  it('keeps an already-relative member photo path', () => {
    expect(toRelativeRequestUrl('/members/member-1/photo', 'https://app.bldcebu.com/api/v1')).toBe(
      '/members/member-1/photo',
    );
  });

  it('strips an absolute URL that already includes baseURL', () => {
    expect(
      toRelativeRequestUrl(
        'https://app.bldcebu.com/api/v1/members/member-1/photo',
        'https://app.bldcebu.com/api/v1',
      ),
    ).toBe('/members/member-1/photo');
  });

  it('strips a path that accidentally includes the /api/v1 prefix', () => {
    expect(
      toRelativeRequestUrl('/api/v1/members/member-1/photo', 'https://app.bldcebu.com/api/v1'),
    ).toBe('/members/member-1/photo');
  });
});

describe('buildRetriedRequestConfig', () => {
  it('rebuilds a clean relative config instead of spreading a mutated axios config', () => {
    const photoDataUrl = 'data:image/jpeg;base64,abc123';
    const retried = buildRetriedRequestConfig(
      {
        method: 'POST',
        url: 'https://app.bldcebu.com/api/v1/members/member-1/photo',
        baseURL: 'https://app.bldcebu.com/api/v1',
        data: { photoDataUrl },
        timeout: 60_000,
        adapter: () => {
          throw new Error('stale adapter must not be reused');
        },
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired' },
      } as RetryableRequestConfig,
      'fresh-token',
    );

    expect(retried).toEqual(
      expect.objectContaining({
        method: 'post',
        url: '/members/member-1/photo',
        data: { photoDataUrl },
        timeout: 60_000,
        _retry: true,
      }),
    );
    expect(retried.baseURL).toBeUndefined();
    expect(retried.adapter).toBeUndefined();
    expect(retried.headers).toBeInstanceOf(AxiosHeaders);
    expect((retried.headers as AxiosHeaders).get('Authorization')).toBe('Bearer fresh-token');
    expect((retried.headers as AxiosHeaders).get('Content-Type')).toBe('application/json');
  });

  it('keeps JSON photo body and sets a fresh Authorization header', () => {
    const photoDataUrl = 'data:image/jpeg;base64,abc123';
    const retried = buildRetriedRequestConfig(
      {
        method: 'post',
        url: '/members/member-1/photo',
        data: { photoDataUrl },
        timeout: 60_000,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired' },
      },
      'fresh-token',
    );

    expect(retried._retry).toBe(true);
    expect(retried.data).toEqual({ photoDataUrl });
    expect(retried.timeout).toBe(60_000);
    expect(retried.headers).toBeInstanceOf(AxiosHeaders);
    expect((retried.headers as AxiosHeaders).get('Authorization')).toBe('Bearer fresh-token');
  });

  it('keeps an already-serialized JSON body intact', () => {
    const body = JSON.stringify({ photoDataUrl: 'data:image/jpeg;base64,xyz' });
    const retried = buildRetriedRequestConfig(
      {
        method: 'post',
        url: '/members/me/photo',
        data: body,
        timeout: 60_000,
      },
      'next-token',
    );

    expect(retried.data).toBe(body);
    expect((retried.headers as AxiosHeaders).get('Authorization')).toBe('Bearer next-token');
  });

  it('keeps FormData and drops Content-Type so the boundary can be reset', () => {
    const form = new FormData();
    form.append('file', new Blob(['fake-image']), 'photo.jpg');

    const retried = buildRetriedRequestConfig(
      {
        method: 'post',
        url: '/members/member-1/photo',
        data: form,
        timeout: 60_000,
        headers: {
          'Content-Type': 'multipart/form-data; boundary=stale',
          Authorization: 'Bearer expired',
        },
      },
      'fresh-token',
    );

    expect(retried.data).toBe(form);
    const headers = retried.headers as AxiosHeaders;
    expect(headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(headers.get('Content-Type')).toBeUndefined();
  });

  it('drops an already-aborted signal so the retry can proceed', () => {
    const controller = new AbortController();
    controller.abort();
    const retried = buildRetriedRequestConfig(
      {
        url: '/members/member-1/photo',
        data: { photoDataUrl: 'data:image/jpeg;base64,abc' },
        signal: controller.signal,
      },
      'fresh-token',
    );

    expect(retried.signal).toBeUndefined();
  });
});

import { AxiosHeaders, type AxiosRequestConfig } from 'axios';

export type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean };

export function isAuthEndpointUrl(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/login-by-qr')
  );
}

export function isCredentialAttemptUrl(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/login-by-qr')
  );
}

/**
 * After a silent refresh succeeds, keep the session even if the retried
 * request still fails (e.g. photo POST body/header retry glitch).
 */
export function shouldClearSessionOn401(options: {
  isCredentialAttempt: boolean;
  alreadyRetried: boolean;
  refreshSucceeded: boolean;
}): boolean {
  if (options.isCredentialAttempt) return false;
  if (options.alreadyRetried) return false;
  if (options.refreshSucceeded) return false;
  return true;
}

function cloneRequestHeaders(headers: RetryableRequestConfig['headers']): AxiosHeaders {
  if (headers instanceof AxiosHeaders) {
    return AxiosHeaders.from(headers);
  }
  return AxiosHeaders.from((headers ?? {}) as Record<string, string>);
}

export function buildRetriedRequestConfig(
  originalConfig: RetryableRequestConfig,
  accessToken: string,
): RetryableRequestConfig {
  const headers = cloneRequestHeaders(originalConfig.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const data = originalConfig.data;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    // Let the browser set the multipart boundary on retry.
    headers.delete('Content-Type');
  }

  const aborted =
    originalConfig.signal &&
    typeof originalConfig.signal === 'object' &&
    'aborted' in originalConfig.signal &&
    Boolean((originalConfig.signal as AbortSignal).aborted);

  return {
    ...originalConfig,
    _retry: true,
    headers,
    data,
    signal: aborted ? undefined : originalConfig.signal,
  };
}

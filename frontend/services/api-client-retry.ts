import { AxiosHeaders, type AxiosRequestConfig } from 'axios';

export type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean };

/**
 * Axios mutates `error.config.url` to an absolute href after a failed request.
 * Retrying with that plus `baseURL` double-joins and drops the original relative path.
 */
export function toRelativeRequestUrl(url?: string, baseURL?: string): string {
  if (!url) return '';

  let pathname = url;
  let search = '';

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      return url;
    }
  } else {
    const queryIndex = url.indexOf('?');
    if (queryIndex >= 0) {
      pathname = url.slice(0, queryIndex);
      search = url.slice(queryIndex);
    }
  }

  if (baseURL) {
    let basePath = baseURL;
    if (/^https?:\/\//i.test(baseURL)) {
      try {
        basePath = new URL(baseURL).pathname;
      } catch {
        // keep baseURL as a path prefix
      }
    }
    basePath = basePath.replace(/\/$/, '');
    if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
      pathname = pathname.slice(basePath.length) || '/';
    }
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  return `${pathname}${search}`;
}

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

export function buildRetriedRequestConfig(
  originalConfig: RetryableRequestConfig,
  accessToken: string,
): RetryableRequestConfig {
  const data = originalConfig.data;
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const headers = new AxiosHeaders();
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const aborted =
    originalConfig.signal &&
    typeof originalConfig.signal === 'object' &&
    'aborted' in originalConfig.signal &&
    Boolean((originalConfig.signal as AbortSignal).aborted);

  return {
    method: (originalConfig.method || 'get').toString().toLowerCase(),
    url: toRelativeRequestUrl(originalConfig.url, originalConfig.baseURL),
    data,
    timeout: originalConfig.timeout,
    params: originalConfig.params,
    headers,
    _retry: true,
    signal: aborted ? undefined : originalConfig.signal,
  };
}

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

export function isFormDataBody(data: unknown): boolean {
  return typeof FormData !== 'undefined' && typeof data === 'object' && data instanceof FormData;
}

/**
 * Auth + body headers for a live or retried request.
 * FormData must not keep Content-Type (boundary) or Content-Length (stale).
 */
export function prepareOutgoingRequestHeaders(
  headers: RetryableRequestConfig['headers'],
  options: { data?: unknown; accessToken?: string | null },
): AxiosHeaders {
  const next =
    headers instanceof AxiosHeaders
      ? AxiosHeaders.from(headers)
      : AxiosHeaders.from((headers ?? {}) as Record<string, string>);

  if (options.accessToken) {
    next.set('Authorization', `Bearer ${options.accessToken}`);
  }

  next.delete('Content-Length');
  next.delete('content-length');

  if (isFormDataBody(options.data)) {
    next.delete('Content-Type');
    next.delete('content-type');
  }

  return next;
}

export function buildRetriedRequestConfig(
  originalConfig: RetryableRequestConfig,
  accessToken: string,
): RetryableRequestConfig {
  const data = originalConfig.data;
  const headers = prepareOutgoingRequestHeaders(undefined, {
    data,
    accessToken,
  });
  if (!isFormDataBody(data)) {
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

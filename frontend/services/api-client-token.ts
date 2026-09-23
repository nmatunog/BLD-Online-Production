export const SESSION_EXPIRED_MESSAGE = 'Session expired — log in again';

/** Refresh when the access JWT is missing, expired, or within this window of expiry. */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

export type FreshTokenPlan =
  | { action: 'use'; accessToken: string }
  | { action: 'refresh'; refreshToken: string }
  | { action: 'expired' };

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const withPad = `${padded}${'='.repeat(padLength)}`;
  if (typeof atob === 'function') {
    return atob(withPad);
  }
  return Buffer.from(withPad, 'base64').toString('utf8');
}

export function decodeJwtPayload(token: string): { exp?: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = decodeBase64Url(parts[1]);
    const payload = JSON.parse(json) as { exp?: unknown };
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function getAccessTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    return null;
  }
  return payload.exp * 1000;
}

export function shouldRefreshAccessToken(
  token: string | null | undefined,
  nowMs: number = Date.now(),
  skewMs: number = ACCESS_TOKEN_REFRESH_SKEW_MS,
): boolean {
  if (!token) return true;
  const expMs = getAccessTokenExpiryMs(token);
  if (expMs == null) return true;
  return expMs - nowMs <= skewMs;
}

export function planFreshAccessToken(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
  nowMs: number = Date.now(),
  skewMs: number = ACCESS_TOKEN_REFRESH_SKEW_MS,
): FreshTokenPlan {
  if (!shouldRefreshAccessToken(accessToken, nowMs, skewMs) && accessToken) {
    return { action: 'use', accessToken };
  }
  if (refreshToken) {
    return { action: 'refresh', refreshToken };
  }
  return { action: 'expired' };
}

export function describeRefreshFailure(error: unknown): { status: number | null; body: unknown } {
  if (error && typeof error === 'object') {
    const axiosErr = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    return {
      status: typeof axiosErr.response?.status === 'number' ? axiosErr.response.status : null,
      body: axiosErr.response?.data ?? axiosErr.message ?? null,
    };
  }
  return { status: null, body: error ?? null };
}

export async function runEnsureFreshToken(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
  refresh: (token: string) => Promise<string | null>,
  nowMs: number = Date.now(),
): Promise<string> {
  const plan = planFreshAccessToken(accessToken, refreshToken, nowMs);
  if (plan.action === 'use') {
    return plan.accessToken;
  }
  if (plan.action === 'expired') {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  const next = await refresh(plan.refreshToken);
  if (!next) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  return next;
}

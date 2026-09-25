import { getApiUrl } from '@/lib/runtime-config';
import type { IdPhotoClientFailReason, IdPhotoClientFlow } from './id-photo';

export type IdPhotoClientEventPayload = {
  reason: IdPhotoClientFailReason;
  flow: IdPhotoClientFlow;
  width?: number;
  height?: number;
  mimeType?: string;
};

const REASON_COOLDOWN_MS = 4_000;
const MAX_EVENTS_PER_WINDOW = 6;
const WINDOW_MS = 60_000;

const recentAt: number[] = [];
const lastByKey = new Map<string, number>();

export function resetIdPhotoTelemetryForTests(): void {
  recentAt.length = 0;
  lastByKey.clear();
}

function shouldSend(reason: IdPhotoClientFailReason, flow: IdPhotoClientFlow, now: number): boolean {
  const key = `${flow}:${reason}`;
  const last = lastByKey.get(key) ?? 0;
  if (now - last < REASON_COOLDOWN_MS) return false;

  while (recentAt.length && now - recentAt[0] > WINDOW_MS) {
    recentAt.shift();
  }
  if (recentAt.length >= MAX_EVENTS_PER_WINDOW) return false;

  lastByKey.set(key, now);
  recentAt.push(now);
  return true;
}

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

export type ReportIdPhotoClientFailureDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  getToken?: () => string | null;
  getApiBase?: () => string;
};

/**
 * Lightweight, fail-silent client photo failure log.
 * No image bytes. Auth header is optional so signup works without a session.
 */
export function reportIdPhotoClientFailure(
  event: IdPhotoClientEventPayload,
  deps: ReportIdPhotoClientFailureDeps = {},
): void {
  try {
    const now = (deps.now ?? Date.now)();
    if (!shouldSend(event.reason, event.flow, now)) return;

    const fetchImpl = deps.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (!fetchImpl) return;

    const body = {
      reason: event.reason,
      flow: event.flow,
      width: Number.isFinite(event.width) ? Math.round(event.width as number) : undefined,
      height: Number.isFinite(event.height) ? Math.round(event.height as number) : undefined,
      mimeType: event.mimeType?.slice(0, 80) || undefined,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = (deps.getToken ?? readAccessToken)();
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${(deps.getApiBase ?? getApiUrl)()}/id-photo/client-events`;
    void fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // fail-silent
  }
}

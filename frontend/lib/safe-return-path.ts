const SAFE_PATH = /^\/[A-Za-z0-9/_?&=%.~\-]*$/;

/** Same-origin relative path only. Rejects protocol-relative and open redirects. */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the trimmed value
  }
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://') || value.includes('\\')) return null;
  if (value.includes('\n') || value.includes('\r') || value.includes('\t')) return null;
  if (!SAFE_PATH.test(value)) return null;
  if (value === '/login' || value.startsWith('/login?')) return null;
  return value;
}

export function loginUrlWithReturn(pathname: string | null | undefined): string {
  const next = sanitizeReturnPath(pathname);
  if (!next) return '/login';
  return `/login?next=${encodeURIComponent(next)}`;
}

export function postLoginPathFromSearch(search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const raw = new URLSearchParams(query).get('next');
  return sanitizeReturnPath(raw) ?? '/dashboard';
}

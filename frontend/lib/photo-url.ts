/** Append a cache-busting query so browsers refetch after a photo replace. */
export function withPhotoCacheBust(
  url: string | null | undefined,
  version?: string | number | null,
): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const token = version == null || version === '' ? Date.now() : version;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(token))}`;
}

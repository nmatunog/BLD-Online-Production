/** RFC 9110 hop-by-hop headers plus content-length (fetch recomputes it). */
export const HOP_BY_HOP_REQUEST_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'host',
] as const;

export function isHopByHopRequestHeader(name: string): boolean {
  return (HOP_BY_HOP_REQUEST_HEADERS as readonly string[]).includes(name.toLowerCase());
}

/**
 * Copy incoming request headers for the Railway upstream call.
 * Strips hop-by-hop headers and always re-applies Authorization when present.
 */
export function buildUpstreamHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  incoming.forEach((value, key) => {
    if (isHopByHopRequestHeader(key)) return;
    headers.set(key, value);
  });
  const authorization = incoming.get('authorization');
  if (authorization) {
    headers.set('Authorization', authorization);
  }
  return headers;
}

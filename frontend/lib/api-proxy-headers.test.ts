import { describe, expect, it } from 'vitest';
import { buildUpstreamHeaders, isHopByHopRequestHeader } from './api-proxy-headers';

describe('buildUpstreamHeaders', () => {
  it('strips hop-by-hop headers including content-length and host', () => {
    const incoming = new Headers({
      authorization: 'Bearer live-token',
      'content-type': 'multipart/form-data; boundary=abc',
      'content-length': '9999',
      connection: 'keep-alive',
      'keep-alive': 'timeout=5',
      'transfer-encoding': 'chunked',
      host: 'app.bldcebu.com',
      'x-custom': 'keep-me',
    });

    const upstream = buildUpstreamHeaders(incoming);

    expect(upstream.get('Authorization')).toBe('Bearer live-token');
    expect(upstream.get('content-type')).toBe('multipart/form-data; boundary=abc');
    expect(upstream.get('x-custom')).toBe('keep-me');
    expect(upstream.get('content-length')).toBeNull();
    expect(upstream.get('connection')).toBeNull();
    expect(upstream.get('keep-alive')).toBeNull();
    expect(upstream.get('transfer-encoding')).toBeNull();
    expect(upstream.get('host')).toBeNull();
  });

  it('re-applies Authorization even if it was listed on Connection', () => {
    const incoming = new Headers({
      Authorization: 'Bearer explicit',
      Connection: 'Authorization, keep-alive',
    });
    const upstream = buildUpstreamHeaders(incoming);
    expect(upstream.get('Authorization')).toBe('Bearer explicit');
  });

  it('recognizes hop-by-hop names case-insensitively', () => {
    expect(isHopByHopRequestHeader('Content-Length')).toBe(true);
    expect(isHopByHopRequestHeader('Proxy-Authorization')).toBe(true);
    expect(isHopByHopRequestHeader('authorization')).toBe(false);
    expect(isHopByHopRequestHeader('content-type')).toBe(false);
  });
});

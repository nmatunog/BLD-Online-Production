import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/[...path]/route';

describe('same-origin API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_BASE_URL;
  });

  it('passes binary downloads (ZIP) through byte-for-byte', async () => {
    process.env.API_BASE_URL = 'https://backend.example.com';
    // Includes bytes that are invalid UTF-8, which a text() round-trip would mangle.
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x80, 0x00, 0xc3]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(zipBytes, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="bld-id-print-pack-2026-11-01.zip"',
          'content-length': '999',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      new Request('https://app.bldcebu.com/api/v1/member-cards/print-pack', {
        method: 'POST',
        headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
        body: JSON.stringify({ memberIds: ['a'] }),
      }),
      { params: Promise.resolve({ path: ['member-cards', 'print-pack'] }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://backend.example.com/api/v1/member-cards/print-pack'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('bld-id-print-pack');
    expect(response.headers.get('content-length')).not.toBe('999');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(zipBytes);
  });
});

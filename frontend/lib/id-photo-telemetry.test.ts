import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportIdPhotoClientFailure, resetIdPhotoTelemetryForTests } from './id-photo-telemetry';

describe('reportIdPhotoClientFailure', () => {
  afterEach(() => {
    resetIdPhotoTelemetryForTests();
  });

  it('POSTs reason, flow, dimensions, and mime type without image bytes', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    reportIdPhotoClientFailure(
      { reason: 'too_small', flow: 'signup', width: 640, height: 480, mimeType: 'image/jpeg' },
      { fetchImpl, getToken: () => null, getApiBase: () => 'https://app.bldcebu.com/api/v1' },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://app.bldcebu.com/api/v1/id-photo/client-events');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      reason: 'too_small',
      flow: 'signup',
      width: 640,
      height: 480,
      mimeType: 'image/jpeg',
    });
    expect(JSON.stringify(body)).not.toMatch(/data:image|base64/);
  });

  it('includes a bearer token when the member is logged in', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    reportIdPhotoClientFailure(
      { reason: 'load_error', flow: 'profile' },
      { fetchImpl, getToken: () => 'jwt-token', getApiBase: () => 'http://localhost:3001/api/v1' },
    );
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-token');
  });

  it('rate-limits the same reason and stays fail-silent when fetch throws', () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const now = vi.fn().mockReturnValue(1_000_000);
    const deps = { fetchImpl, now, getToken: () => null, getApiBase: () => '/api/v1' };

    expect(() => {
      reportIdPhotoClientFailure({ reason: 'heic_decode', flow: 'signup' }, deps);
      reportIdPhotoClientFailure({ reason: 'heic_decode', flow: 'signup' }, deps);
    }).not.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('allows a different reason during the cooldown', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const now = () => 2_000_000;
    const deps = { fetchImpl, now, getToken: () => null, getApiBase: () => '/api/v1' };
    reportIdPhotoClientFailure({ reason: 'too_small', flow: 'admin' }, deps);
    reportIdPhotoClientFailure({ reason: 'camera_denied', flow: 'admin' }, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl, shouldUseSameOriginApi } from './runtime-config';

describe('shouldUseSameOriginApi', () => {
  it('matches production and Vercel hosts case-insensitively', () => {
    expect(shouldUseSameOriginApi('app.bldcebu.com')).toBe(true);
    expect(shouldUseSameOriginApi('app.BLDCebu.com')).toBe(true);
    expect(shouldUseSameOriginApi('bld-online-production.vercel.app')).toBe(true);
  });

  it('does not match localhost', () => {
    expect(shouldUseSameOriginApi('localhost')).toBe(false);
  });
});

describe('getApiBaseUrl', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow);
    } else {
      // @ts-expect-error restore missing window in node
      delete globalThis.window;
    }
  });

  it('uses same-origin on app.bldcebu.com even when Railway env is set', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://bld-online-production-production.up.railway.app');
    vi.stubGlobal('window', {
      location: { hostname: 'app.bldcebu.com', origin: 'https://app.bldcebu.com' },
    });
    expect(getApiBaseUrl()).toBe('https://app.bldcebu.com');
  });
});

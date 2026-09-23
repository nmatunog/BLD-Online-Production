import { isAllowedCorsOrigin } from './cors-origin';

describe('isAllowedCorsOrigin', () => {
  it('allows the production admin origin in lowercase', () => {
    expect(isAllowedCorsOrigin('https://app.bldcebu.com')).toBe(true);
  });

  it('allows mixed-case BLDCebu hosts', () => {
    expect(isAllowedCorsOrigin('https://app.BLDCebu.com')).toBe(true);
  });

  it('allows Vercel preview origins', () => {
    expect(isAllowedCorsOrigin('https://bld-online-production-git-main.vercel.app')).toBe(true);
  });

  it('allows extra configured origins case-insensitively', () => {
    expect(isAllowedCorsOrigin('https://custom.example', ['https://Custom.Example'])).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isAllowedCorsOrigin('https://evil.example')).toBe(false);
  });
});

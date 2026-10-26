import { describe, expect, it } from 'vitest';
import {
  loginUrlWithReturn,
  postLoginPathFromSearch,
  sanitizeReturnPath,
} from './safe-return-path';

describe('sanitizeReturnPath', () => {
  it('allows the NFC verify path and rejects open redirects', () => {
    expect(sanitizeReturnPath('/verify/abcTOKEN_-123')).toBe('/verify/abcTOKEN_-123');
    expect(sanitizeReturnPath('/cards')).toBe('/cards');
    expect(sanitizeReturnPath('https://evil.example/phish')).toBeNull();
    expect(sanitizeReturnPath('//evil.example')).toBeNull();
    expect(sanitizeReturnPath('/login')).toBeNull();
    expect(sanitizeReturnPath('/verify/abc\nmore')).toBeNull();
  });

  it('builds login return URLs and reads them back', () => {
    expect(loginUrlWithReturn('/verify/tok')).toBe('/login?next=%2Fverify%2Ftok');
    expect(postLoginPathFromSearch('?next=%2Fverify%2Ftok')).toBe('/verify/tok');
    expect(postLoginPathFromSearch('')).toBe('/dashboard');
  });
});

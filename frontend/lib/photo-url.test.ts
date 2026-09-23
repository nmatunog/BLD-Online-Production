import { afterEach, describe, expect, it, vi } from 'vitest';
import { withPhotoCacheBust } from './photo-url';

describe('withPhotoCacheBust', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for missing urls', () => {
    expect(withPhotoCacheBust(null)).toBe('');
    expect(withPhotoCacheBust(undefined)).toBe('');
    expect(withPhotoCacheBust('')).toBe('');
  });

  it('leaves data URLs unchanged', () => {
    const dataUrl = 'data:image/jpeg;base64,YQ==';
    expect(withPhotoCacheBust(dataUrl, 99)).toBe(dataUrl);
  });

  it('appends a version query string', () => {
    expect(withPhotoCacheBust('https://bld-idphotos.b-cdn.net/member-photos/CEB-YE2301.jpg', '2026-09-23')).toBe(
      'https://bld-idphotos.b-cdn.net/member-photos/CEB-YE2301.jpg?v=2026-09-23',
    );
  });

  it('uses & when the url already has a query', () => {
    expect(withPhotoCacheBust('https://cdn.example/p.jpg?x=1', 7)).toBe('https://cdn.example/p.jpg?x=1&v=7');
  });

  it('falls back to Date.now when no version is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T13:00:00.000Z'));
    expect(withPhotoCacheBust('https://cdn.example/p.jpg')).toBe(
      `https://cdn.example/p.jpg?v=${Date.parse('2026-09-23T13:00:00.000Z')}`,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { printPackErrorMessage, printPackFilename } from './member-cards.service';

describe('print pack download helpers', () => {
  it('reads the server file name and falls back safely', () => {
    expect(printPackFilename('attachment; filename="bld-id-print-pack-2026-11-01.zip"')).toBe(
      'bld-id-print-pack-2026-11-01.zip',
    );
    expect(printPackFilename('')).toBe('bld-id-print-pack.zip');
    expect(printPackFilename('attachment; filename="../../evil.exe"')).toBe('bld-id-print-pack.zip');
  });

  it('decodes the server message from a binary error body', async () => {
    const body = new TextEncoder().encode(
      JSON.stringify({ message: 'A print pack can hold up to 50 members. Select fewer.' }),
    ).buffer;
    await expect(printPackErrorMessage({ response: { data: body } })).resolves.toBe(
      'A print pack can hold up to 50 members. Select fewer.',
    );
    await expect(
      printPackErrorMessage({ response: { data: { message: ['memberIds must be UUIDs'] } } }),
    ).resolves.toBe('memberIds must be UUIDs');
    await expect(printPackErrorMessage(new Error('Network Error'))).resolves.toBe('Network Error');
    await expect(printPackErrorMessage(null)).resolves.toBe('Could not build the print pack');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NFC_UNSUPPORTED_MESSAGE,
  NFC_VERIFY_MISMATCH,
  NFC_WRITE_FAILED,
  buildNdefUriMessage,
  createNdefReader,
  isWebNfcSupported,
  lockNfcTag,
  nfcUrlsMatch,
  readNdefUri,
  writeAndVerifyNdefUri,
  writeNdefUri,
  type NdefReaderLike,
} from './nfc-writer';

class MockNdefReader implements NdefReaderLike {
  written: unknown = null;
  locked = false;
  failWrite = false;
  failLock = false;
  readUrl: string | null = 'https://app.bldcebu.com/verify/tok';
  onreading: ((event: { message: { records: Array<{ recordType: string; data?: string }> } }) => void) | null =
    null;
  onreadingerror: ((event: Event) => void) | null = null;

  async write(message: unknown): Promise<void> {
    if (this.failWrite) throw new Error('internal NFC error containing https://secret');
    this.written = message;
  }

  async scan(): Promise<void> {
    queueMicrotask(() => {
      this.onreading?.({
        message: { records: [{ recordType: 'url', data: this.readUrl || '' }] },
      });
    });
  }

  async makeReadOnly(): Promise<void> {
    if (this.failLock) throw new Error('lock failed');
    this.locked = true;
  }
}

describe('nfc-writer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('feature-detects Web NFC', () => {
    expect(isWebNfcSupported({})).toBe(false);
    expect(isWebNfcSupported({ NDEFReader: MockNdefReader })).toBe(true);
    expect(() => createNdefReader({})).toThrow(NFC_UNSUPPORTED_MESSAGE);
  });

  it('writes an NDEF URI record and verifies the read-back', async () => {
    const reader = new MockNdefReader();
    const url = 'https://app.bldcebu.com/verify/tok';
    const result = await writeAndVerifyNdefUri(reader, url);
    expect(reader.written).toEqual(buildNdefUriMessage(url));
    expect(result.verified).toBe(true);
    expect(result.readUrl).toBe(url);
  });

  it('rejects a mismatched read-back without echoing the token in write failures', async () => {
    const reader = new MockNdefReader();
    reader.readUrl = 'https://app.bldcebu.com/verify/OTHER';
    await expect(writeAndVerifyNdefUri(reader, 'https://app.bldcebu.com/verify/tok')).rejects.toThrow(
      NFC_VERIFY_MISMATCH,
    );

    reader.failWrite = true;
    await expect(writeNdefUri(reader, 'https://app.bldcebu.com/verify/secretTOKEN')).rejects.toThrow(
      NFC_WRITE_FAILED,
    );
    try {
      await writeNdefUri(reader, 'https://app.bldcebu.com/verify/secretTOKEN');
    } catch (error) {
      expect(String(error)).not.toContain('secretTOKEN');
    }
  });

  it('locks the tag with makeReadOnly', async () => {
    const reader = new MockNdefReader();
    await lockNfcTag(reader);
    expect(reader.locked).toBe(true);
  });

  it('compares NFC URLs without trailing slashes', () => {
    expect(
      nfcUrlsMatch('https://app.bldcebu.com/verify/a', 'https://app.bldcebu.com/verify/a/'),
    ).toBe(true);
    expect(nfcUrlsMatch('https://app.bldcebu.com/verify/a', 'https://app.bldcebu.com/verify/b')).toBe(
      false,
    );
  });

  it('times out a hung read', async () => {
    vi.useFakeTimers();
    const reader: NdefReaderLike = {
      write: async () => undefined,
      scan: async () => new Promise(() => undefined),
      onreading: null,
      onreadingerror: null,
    };
    const pending = readNdefUri(reader, undefined, 1000);
    const assertion = expect(pending).rejects.toThrow(/Could not read the card back/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

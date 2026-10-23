/**
 * Web NFC helpers for encoding NTAG215/216 member cards.
 * Chrome on Android + HTTPS only. Never log the token or URL.
 */

export const NFC_UNSUPPORTED_MESSAGE =
  'This device cannot write NFC cards in the browser (iPhone and most computers). Copy the URL and write it with NFC Tools as one URI / URL record.';

export const NFC_WRITE_FAILED =
  'Could not write the card. Hold the phone still on the card and try again.';

export const NFC_VERIFY_MISMATCH =
  'The card did not match. Do not lock it. Write again.';

export const NFC_VERIFY_FAILED =
  'Could not read the card back. Hold the phone still and tap again.';

export const NFC_LOCK_FAILED =
  'The URL is on the card, but locking failed. You can lock it later. Locking is permanent.';

export const NFC_LOCK_CONFIRM =
  'Lock this card so nobody can change the link? This cannot be undone.';

export type NdefRecordLike = {
  recordType?: string;
  data?: BufferSource | string | null;
  encoding?: string;
};

export type NdefMessageLike = {
  records: NdefRecordLike[];
};

export type NdefReaderLike = {
  write: (message: unknown, options?: { signal?: AbortSignal }) => Promise<void>;
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  makeReadOnly?: (options?: { signal?: AbortSignal }) => Promise<void>;
  onreading: ((event: { message: NdefMessageLike }) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
};

export type NdefReaderCtor = new () => NdefReaderLike;

export function isWebNfcSupported(globalObj: { NDEFReader?: NdefReaderCtor } = globalThis): boolean {
  return typeof globalObj.NDEFReader === 'function';
}

export function createNdefReader(
  globalObj: { NDEFReader?: NdefReaderCtor } = globalThis,
): NdefReaderLike {
  if (typeof globalObj.NDEFReader !== 'function') {
    throw new Error(NFC_UNSUPPORTED_MESSAGE);
  }
  return new globalObj.NDEFReader();
}

export function buildNdefUriMessage(url: string): { records: Array<{ recordType: 'url'; data: string }> } {
  return { records: [{ recordType: 'url', data: url }] };
}

export function normalizeNfcUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function decodeNdefUrl(record: NdefRecordLike): string | null {
  const type = record.recordType || '';
  if (type !== 'url' && type !== 'absolute-url') {
    return null;
  }
  if (typeof record.data === 'string') {
    return record.data.trim() || null;
  }
  if (!record.data) return null;
  try {
    const decoder = new TextDecoder(record.encoding || 'utf-8');
    const text = decoder.decode(record.data as BufferSource).trim();
    return text || null;
  } catch {
    return null;
  }
}

export function readUrlFromNdefMessage(message: NdefMessageLike): string | null {
  for (const record of message.records || []) {
    const url = decodeNdefUrl(record);
    if (url) return url;
  }
  return null;
}

export function nfcUrlsMatch(expected: string, actual: string | null | undefined): boolean {
  if (!actual) return false;
  return normalizeNfcUrl(expected) === normalizeNfcUrl(actual);
}

export async function writeNdefUri(
  reader: NdefReaderLike,
  url: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await reader.write(buildNdefUriMessage(url), signal ? { signal } : undefined);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error(NFC_WRITE_FAILED);
  }
}

export async function readNdefUri(
  reader: NdefReaderLike,
  signal?: AbortSignal,
  timeoutMs = 30_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(NFC_VERIFY_FAILED));
      }
    }, timeoutMs);

    const finish = (err?: Error, url?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(url as string);
    };

    reader.onreading = (event) => {
      const url = readUrlFromNdefMessage(event.message);
      if (!url) {
        finish(new Error(NFC_VERIFY_FAILED));
        return;
      }
      finish(undefined, url);
    };
    reader.onreadingerror = () => {
      finish(new Error(NFC_VERIFY_FAILED));
    };

    reader.scan(signal ? { signal } : undefined).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') {
        finish(error);
        return;
      }
      finish(new Error(NFC_VERIFY_FAILED));
    });
  });
}

export async function writeAndVerifyNdefUri(
  reader: NdefReaderLike,
  url: string,
  signal?: AbortSignal,
): Promise<{ verified: true; readUrl: string }> {
  await writeNdefUri(reader, url, signal);
  const readUrl = await readNdefUri(reader, signal);
  if (!nfcUrlsMatch(url, readUrl)) {
    throw new Error(NFC_VERIFY_MISMATCH);
  }
  return { verified: true, readUrl };
}

export async function lockNfcTag(reader: NdefReaderLike, signal?: AbortSignal): Promise<void> {
  if (typeof reader.makeReadOnly !== 'function') {
    throw new Error(NFC_LOCK_FAILED);
  }
  try {
    await reader.makeReadOnly(signal ? { signal } : undefined);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error(NFC_LOCK_FAILED);
  }
}

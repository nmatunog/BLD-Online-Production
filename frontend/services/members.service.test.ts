import { describe, expect, it } from 'vitest';
import { PHOTO_UPLOAD_TIMEOUT_MS } from './members.service';

describe('PHOTO_UPLOAD_TIMEOUT_MS', () => {
  it('is at least 60s so rembg/normalize is not aborted by the 10s axios default', () => {
    expect(PHOTO_UPLOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });
});

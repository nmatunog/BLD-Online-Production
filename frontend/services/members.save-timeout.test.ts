import { describe, expect, it } from 'vitest';
import {
  MEMBER_SAVE_TIMEOUT_MS,
  memberSaveTimeoutMs,
  PHOTO_UPLOAD_TIMEOUT_MS,
} from './members.service';

describe('memberSaveTimeoutMs', () => {
  it('gives ordinary profile saves more than the 10s default', () => {
    expect(MEMBER_SAVE_TIMEOUT_MS).toBeGreaterThan(10_000);
    expect(memberSaveTimeoutMs({ photoUrl: undefined })).toBe(MEMBER_SAVE_TIMEOUT_MS);
    expect(memberSaveTimeoutMs({ photoUrl: 'https://bld-idphotos.b-cdn.net/a.jpg' })).toBe(
      MEMBER_SAVE_TIMEOUT_MS,
    );
  });

  it('waits as long as a photo upload when the save carries a new photo', () => {
    expect(memberSaveTimeoutMs({ photoUrl: 'data:image/jpeg;base64,AAAA' })).toBe(
      PHOTO_UPLOAD_TIMEOUT_MS,
    );
  });
});

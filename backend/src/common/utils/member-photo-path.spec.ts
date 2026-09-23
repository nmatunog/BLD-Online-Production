import { buildMemberPhotoStoragePath } from './member-photo-path';

describe('buildMemberPhotoStoragePath', () => {
  it('versions the object key so a replacement is a new CDN URL', () => {
    expect(buildMemberPhotoStoragePath('CEB-YE2301', 'image/jpeg', 1_700_000_000_000)).toBe(
      'member-photos/CEB-YE2301-1700000000000.jpg',
    );
  });

  it('uses png when the stored type is PNG', () => {
    expect(buildMemberPhotoStoragePath('CEB-ME1002', 'image/png', 42)).toBe(
      'member-photos/CEB-ME1002-42.png',
    );
  });

  it('strips unsafe characters from the community id', () => {
    expect(buildMemberPhotoStoragePath('../CEB YE/2301', 'image/jpeg', 9)).toBe(
      'member-photos/CEBYE2301-9.jpg',
    );
  });

  it('returns a different path on each timestamp', () => {
    const a = buildMemberPhotoStoragePath('CEB-YE2301', 'image/jpeg', 1);
    const b = buildMemberPhotoStoragePath('CEB-YE2301', 'image/jpeg', 2);
    expect(a).not.toBe(b);
  });
});

import { describe, expect, it } from 'vitest';
import {
  adminCardStatusLabel,
  buildNfcUrl,
  canVerifyMemberCards,
  doorMemberName,
  isCardAdminRole,
  isValidDoorCard,
  printerMemberName,
  resolveMemberMinistry,
} from './nfc-card';

describe('nfc-card helpers', () => {
  it('builds the production NFC URI', () => {
    expect(buildNfcUrl('tok_1')).toBe('https://app.bldcebu.com/verify/tok_1');
  });

  it('uses legal name for the printer and nickname at the door', () => {
    const member = {
      id: '1',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      nickname: 'Jun',
      communityId: 'CEB-ME01-0001',
      ministry: 'Worship',
      photoUrl: null,
    };
    expect(printerMemberName(member)).toBe('Juan Dela Cruz');
    expect(doorMemberName(member)).toBe('Jun Dela Cruz');
  });

  it('maps admin and door statuses', () => {
    expect(adminCardStatusLabel('ACTIVE', null)).toBe('Issued');
    expect(adminCardStatusLabel('ACTIVE', '2026-10-23')).toBe('Encoded');
    expect(adminCardStatusLabel('ENCODED', null)).toBe('Encoded');
    expect(adminCardStatusLabel('REVOKED', null)).toBe('Revoked');
    expect(isValidDoorCard('ACTIVE')).toBe(true);
    expect(isValidDoorCard('REVOKED')).toBe(false);
  });

  it('resolves ministry from member, then current history, then user', () => {
    expect(
      resolveMemberMinistry({
        ministry: 'Worship',
        ministryHistory: [{ ministry: 'Music', endDate: null }],
        user: { ministry: 'Service' },
      }),
    ).toBe('Worship');
    expect(
      resolveMemberMinistry({
        ministry: null,
        ministryHistory: [{ ministry: 'Praise Ministry', endDate: null }],
        user: { ministry: 'Service' },
      }),
    ).toBe('Praise Ministry');
    expect(
      resolveMemberMinistry({
        ministry: '  ',
        ministryHistory: [{ ministry: 'Closed', endDate: '2026-01-01' }],
        user: { ministry: 'Intercessory' },
      }),
    ).toBe('Intercessory');
    expect(resolveMemberMinistry({ ministry: null })).toBeNull();
  });

  it('limits card admin tools to privileged admins', () => {
    expect(isCardAdminRole('ADMINISTRATOR')).toBe(true);
    expect(isCardAdminRole('MINISTRY_COORDINATOR')).toBe(false);
    expect(canVerifyMemberCards('SUPER_USER')).toBe(true);
    expect(canVerifyMemberCards('ADMINISTRATOR')).toBe(true);
    expect(canVerifyMemberCards('DCS')).toBe(true);
    expect(canVerifyMemberCards('MINISTRY_COORDINATOR')).toBe(true);
    expect(canVerifyMemberCards('CLASS_SHEPHERD')).toBe(true);
    expect(canVerifyMemberCards('MEMBER')).toBe(false);
  });
});

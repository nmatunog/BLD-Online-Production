import { MemberCardStatus } from '@prisma/client';
import {
  assessPrintReadiness,
  isValidPrintMemberId,
  matchesPrintReadyFilter,
} from './member-card-readiness';

describe('print readiness', () => {
  const readyMember = {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    communityId: 'CEB-ME1801',
    photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
    cards: [
      {
        status: MemberCardStatus.ACTIVE,
        tokenHash: 'abc',
        tokenEncrypted: 'enc',
      },
    ],
  };

  it('accepts CEB-XX0000 and existing community ID shapes', () => {
    expect(isValidPrintMemberId('CEB-XX0000')).toBe(true);
    expect(isValidPrintMemberId('CEB-ME1801')).toBe(true);
    expect(isValidPrintMemberId('ceb-ye2301')).toBe(true);
    expect(isValidPrintMemberId('CEB-SPE1502')).toBe(true);
    expect(isValidPrintMemberId('CEB-ME01-0001')).toBe(true);
    expect(isValidPrintMemberId('CEB-ME10001')).toBe(true);
    expect(isValidPrintMemberId('MAN-ME1801')).toBe(false);
    expect(isValidPrintMemberId('CEB-ME180123')).toBe(false);
    expect(isValidPrintMemberId('ME1801')).toBe(false);
    expect(isValidPrintMemberId('member-uuid')).toBe(false);
    expect(isValidPrintMemberId('')).toBe(false);
  });

  it('is ready when photo, names, valid member ID, and an issued card token are present', () => {
    expect(assessPrintReadiness(readyMember)).toEqual({ ready: true, missing: [] });
    expect(
      assessPrintReadiness({
        ...readyMember,
        communityId: 'CEB-ME01-0001',
        cards: [{ status: MemberCardStatus.ENCODED, tokenHash: 'abc', tokenEncrypted: 'enc' }],
      }),
    ).toEqual({ ready: true, missing: [] });
  });

  it('does not require ministry, blood type, emergency contact, or signature', () => {
    const result = assessPrintReadiness({
      ...readyMember,
      ministry: null,
      bloodType: null,
      emergencyContactName: null,
      signatureUrl: null,
    } as typeof readyMember);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('lists each missing print field', () => {
    expect(assessPrintReadiness({}).missing).toEqual([
      'photo',
      'firstName',
      'lastName',
      'memberId',
      'card',
    ]);
    expect(
      assessPrintReadiness({
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        communityId: 'not-an-id',
        photoUrl: 'https://example.com/p.jpg',
        cards: [{ status: MemberCardStatus.REVOKED, tokenHash: 'abc', tokenEncrypted: 'enc' }],
      }).missing,
    ).toEqual(['memberId', 'card']);
    expect(
      assessPrintReadiness({
        ...readyMember,
        cards: [{ status: MemberCardStatus.ACTIVE, tokenHash: '', tokenEncrypted: '' }],
      }).missing,
    ).toEqual(['card']);
  });

  it('filters READY / MISSING / ALL', () => {
    expect(matchesPrintReadyFilter(true, 'READY')).toBe(true);
    expect(matchesPrintReadyFilter(false, 'READY')).toBe(false);
    expect(matchesPrintReadyFilter(false, 'MISSING')).toBe(true);
    expect(matchesPrintReadyFilter(true, 'MISSING')).toBe(false);
    expect(matchesPrintReadyFilter(false, 'ALL')).toBe(true);
    expect(matchesPrintReadyFilter(true, undefined)).toBe(true);
  });
});

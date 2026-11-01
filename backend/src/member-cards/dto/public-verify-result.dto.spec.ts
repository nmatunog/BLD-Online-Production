import { toPublicVerifyResult, publicVerifyJson } from './public-verify-result.dto';

const SENSITIVE = {
  id: 'member-internal-id',
  userId: 'user-internal-id',
  email: 'hidden@example.com',
  phone: '09170000000',
  address: '123 Hidden St',
  city: 'Cebu',
  dateOfBirth: '1990-01-01',
  bloodType: 'O+',
  emergencyContactName: 'Ana',
  emergencyContactPhone: '09171111111',
};

describe('public verify DTO allowlist', () => {
  it('exposes only photo, full name, member ID, ministry, and status', () => {
    const result = toPublicVerifyResult({
      status: 'ACTIVE',
      member: {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        communityId: 'CEB-ME1801',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        ministry: null,
        ministryHistory: [{ ministry: 'Worship', endDate: null, startDate: '2026-01-01' }],
        user: { ministry: 'Service' },
        ...SENSITIVE,
      },
    });

    expect(result).toEqual({
      view: 'public',
      status: 'VALID',
      member: {
        fullName: 'Juan Dela Cruz',
        memberId: 'CEB-ME1801',
        ministry: 'Worship',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
      },
    });

    const json = JSON.stringify(publicVerifyJson(result));
    expect(json).not.toMatch(
      /hidden@example.com|09170000000|123 Hidden St|1990-01-01|O\+|Ana|09171111111|member-internal-id|user-internal-id/,
    );
    expect(Object.keys(result)).toEqual(['view', 'status', 'member']);
    expect(Object.keys(result.member ?? {})).toEqual([
      'fullName',
      'memberId',
      'ministry',
      'photoUrl',
    ]);
  });

  it('returns not found without a member payload', () => {
    const result = toPublicVerifyResult({
      status: 'NOT_FOUND',
      member: { firstName: 'Juan', lastName: 'Dela Cruz', ...SENSITIVE },
    });
    expect(result).toEqual({ view: 'public', status: 'NOT_FOUND', member: null });
    expect(JSON.stringify(publicVerifyJson(result))).not.toMatch(/Juan|hidden@example.com/);
  });

  it('keeps identity on REVOKED but still strips private fields', () => {
    const result = toPublicVerifyResult({
      status: 'REVOKED',
      member: {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        communityId: 'CEB-ME1801',
        photoUrl: null,
        ministry: 'Worship',
        ...SENSITIVE,
      },
    });
    expect(result.status).toBe('REVOKED');
    expect(result.member?.fullName).toBe('Juan Dela Cruz');
    expect(JSON.stringify(publicVerifyJson(result))).not.toMatch(/O\+|09170000000|member-internal-id/);
  });
});

import { describe, expect, it } from 'vitest';
import { MISSING_PRINT_LABELS } from './id-print';

describe('ID print missing labels', () => {
  it('names the readiness gaps seniors will see', () => {
    expect(MISSING_PRINT_LABELS).toEqual({
      photo: 'No photo',
      firstName: 'No first name',
      lastName: 'No last name',
      memberId: 'Invalid member ID',
      card: 'No issued card',
    });
  });
});

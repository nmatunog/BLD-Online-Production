import { describe, expect, it } from 'vitest';
import { extractPossibleDuplicate } from './signup-duplicate';

describe('extractPossibleDuplicate', () => {
  it('reads the possible-duplicate notice', () => {
    expect(
      extractPossibleDuplicate({
        response: {
          status: 409,
          data: {
            code: 'POSSIBLE_DUPLICATE',
            message: 'A member with this first and last name is already registered.',
            possibleDuplicate: { firstName: 'Juan', lastName: 'Dela Cruz', encounterType: 'ME', classNumber: 10 },
          },
        },
      }),
    ).toEqual({ firstName: 'Juan', lastName: 'Dela Cruz', encounterType: 'ME', classNumber: 10 });
  });

  it('ignores other errors, including the old "account already exists" shape', () => {
    expect(extractPossibleDuplicate(new Error('network'))).toBeNull();
    expect(extractPossibleDuplicate({ response: { data: { message: 'This mobile number is already registered' } } })).toBeNull();
    expect(extractPossibleDuplicate({ response: { data: { existing: { memberId: 'x' } } } })).toBeNull();
    expect(extractPossibleDuplicate({ response: { data: { code: 'POSSIBLE_DUPLICATE' } } })).toBeNull();
  });
});

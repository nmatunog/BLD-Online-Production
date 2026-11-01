/** Same first + last name already registered (409 POSSIBLE_DUPLICATE from /auth/signup). */
export type PossibleDuplicate = {
  firstName: string;
  lastName: string;
  encounterType?: string;
  classNumber?: number;
};

/**
 * Read the possible-duplicate notice from a signup error. It is a notice, not a block:
 * the page asks "Is that you?" and can resubmit with confirmNotDuplicate.
 */
export function extractPossibleDuplicate(error: unknown): PossibleDuplicate | null {
  const data = (error as { response?: { status?: number; data?: unknown } })?.response?.data as
    | { code?: string; possibleDuplicate?: Partial<PossibleDuplicate> }
    | undefined;
  if (!data || data.code !== 'POSSIBLE_DUPLICATE') return null;
  const match = data.possibleDuplicate;
  if (!match?.firstName || !match?.lastName) return null;
  return {
    firstName: match.firstName,
    lastName: match.lastName,
    encounterType: match.encounterType,
    classNumber: match.classNumber,
  };
}

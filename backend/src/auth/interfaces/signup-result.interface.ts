export interface SignupResult {
  memberId: string;
  communityId: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  encounterType: string;
  classNumber: number;
  isExistingMember: boolean;
  photoUrl?: string | null;
  qrCodeUrl?: string | null;
  message: string;
  /**
   * Returned only to the phone that just signed up. Proves it is the same person when they
   * fix their details later (PUT /auth/signup). Valid for SIGNUP_EDIT_TOKEN_TTL.
   */
  editToken?: string;
}

/** Public last-name suggestion: enough to recognise yourself, no IDs. */
export interface SignupSuggestion {
  firstName: string;
  lastName: string;
  nickname: string | null;
  encounterType: string;
  classNumber: number;
}

export interface SignupConflictPayload {
  message: string;
  existing: SignupResult;
}

export interface SignupResult {
  memberId: string;
  communityId: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  encounterType: string;
  classNumber: number;
  isExistingMember: boolean;
  message: string;
}

export interface SignupSuggestion {
  memberId: string;
  communityId: string;
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

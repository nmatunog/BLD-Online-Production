export interface SignupResult {
  memberId: string;
  communityId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  ministry: string;
  apostolate: string;
  encounterType: string;
  classNumber: number;
  isExistingMember: boolean;
  message: string;
}

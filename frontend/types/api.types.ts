export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    /** Present when role is MINISTRY_COORDINATOR — ministry they coordinate */
    ministry?: string | null;
  };
  member?: {
    nickname: string | null;
    lastName: string;
    firstName: string;
    communityId?: string;
    /** Member profile ministry — used for ministry-aligned staff access */
    ministry?: string | null;
    apostolate?: string | null;
  };
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginByQrRequest {
  communityId: string;
  password: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  nickname?: string;
  city: string;
  encounterType: string;
  classNumber: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RequestPasswordResetRequest {
  lastName: string;
  phone: string;
  encounterNumber: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface SignupRequest {
  phone: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  encounterType: string;
  classNumber: string;
  dateOfBirth: string;
  apostolate: string;
  ministry: string;
  city?: string;
}

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


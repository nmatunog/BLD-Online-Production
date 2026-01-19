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
  };
  member?: {
    nickname: string | null;
    lastName: string;
    firstName: string;
    communityId?: string;
  };
}

export interface LoginRequest {
  email?: string;
  phone?: string;
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
  email?: string;
  phone?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}


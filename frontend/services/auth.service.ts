import { apiClient } from './api-client';
import type {
  ApiResponse,
  AuthResult,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
} from '@/types/api.types';

export class AuthService {
  async login(data: LoginRequest): Promise<AuthResult> {
    const response = await apiClient.post<ApiResponse<AuthResult>>(
      '/auth/login',
      data,
    );
    if (response.data.success && response.data.data) {
      apiClient.setToken(response.data.data.accessToken);
      apiClient.setRefreshToken(response.data.data.refreshToken);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Login failed');
  }

  async register(data: RegisterRequest): Promise<AuthResult> {
    const response = await apiClient.post<ApiResponse<AuthResult>>(
      '/auth/register',
      data,
    );
    if (response.data.success && response.data.data) {
      apiClient.setToken(response.data.data.accessToken);
      apiClient.setRefreshToken(response.data.data.refreshToken);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Registration failed');
  }

  async refreshToken(data: RefreshTokenRequest): Promise<AuthResult> {
    const response = await apiClient.post<ApiResponse<AuthResult>>(
      '/auth/refresh',
      data,
    );
    if (response.data.success && response.data.data) {
      apiClient.setToken(response.data.data.accessToken);
      apiClient.setRefreshToken(response.data.data.refreshToken);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Token refresh failed');
  }

  async requestPasswordReset(
    data: RequestPasswordResetRequest,
  ): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/password/reset/request',
      data,
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Password reset request failed');
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/password/reset',
      data,
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Password reset failed');
  }

  logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

export const authService = new AuthService();


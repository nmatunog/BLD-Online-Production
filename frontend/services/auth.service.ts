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
import { AxiosError } from 'axios';

export class AuthService {
  async login(data: LoginRequest): Promise<AuthResult> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResult>>(
        '/auth/login',
        data,
      );
      if (response.data.success && response.data.data) {
        apiClient.setToken(response.data.data.accessToken);
        apiClient.setRefreshToken(response.data.data.refreshToken);
        
        // Store auth data in localStorage for dashboard access
        if (typeof window !== 'undefined') {
          const authDataToStore = {
            user: response.data.data.user,
            member: response.data.data.member || null,
          };
          console.log('Storing auth data:', authDataToStore); // Debug log
          localStorage.setItem('authData', JSON.stringify(authDataToStore));
        }
        
        return response.data.data;
      }
      throw new Error(response.data.error || 'Login failed');
    } catch (error) {
      // Re-throw with original error for better error parsing
      throw error;
    }
  }

  async register(data: RegisterRequest): Promise<AuthResult> {
    try {
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
    } catch (error) {
      // Re-throw with original error for better error parsing
      throw error;
    }
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
  ): Promise<{ message: string; resetLink?: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string; resetLink?: string }>>(
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
    localStorage.removeItem('authData');
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


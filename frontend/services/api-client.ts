import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiUrl } from '@/lib/runtime-config';

// Log API URL for debugging (only in development)
// This will be logged when ApiClient is instantiated

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    const apiBaseUrl = getApiUrl();
    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Log request in development
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Log successful response in development
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('✅ API Response:', response.config.method?.toUpperCase(), response.config.url, response.status);
        }
        return response;
      },
      async (error: AxiosError) => {
        const reqUrl = String(error.config?.url || '');
        // Wrong password / invalid credentials — expected; do not spam the console like a system failure
        const isBenignAuth401 =
          error.response?.status === 401 &&
          (reqUrl.includes('/auth/login') ||
            reqUrl.includes('/auth/register') ||
            reqUrl.includes('/auth/login-by-qr'));

        // Enhanced error logging
        if (typeof window !== 'undefined') {
          if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
            const currentApiUrl = getApiUrl();
            console.error('❌ Network Error: Cannot connect to backend at', currentApiUrl);
            console.error('💡 Make sure the backend server is running');
          } else if (!isBenignAuth401) {
            console.error('❌ API Error:', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status || error.message);
            
            // Log validation errors if available
            if (error.response?.status === 400 && error.response?.data) {
              const errorData = error.response.data as any;
              if (errorData.message) {
                const messages = Array.isArray(errorData.message) ? errorData.message : [errorData.message];
                console.error('📋 Validation Errors:', messages);
                // Log each validation error detail if available
                if (Array.isArray(errorData.message)) {
                  errorData.message.forEach((msg: any, idx: number) => {
                    if (typeof msg === 'object' && msg.constraints) {
                      console.error(`   ${idx + 1}. ${Object.values(msg.constraints).join(', ')}`);
                    } else {
                      console.error(`   ${idx + 1}. ${msg}`);
                    }
                  });
                }
              }
              if (errorData.error) {
                console.error('📋 Error Details:', errorData.error);
              }
              // Log the full error response for debugging
              console.error('📋 Full Error Response:', JSON.stringify(errorData, null, 2));
            }
          }
        }
        
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const originalConfig = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
          const url = String(originalConfig?.url || '');

          // Never try to refresh if we are already refreshing, or if this 401 came from auth endpoints.
          const isAuthEndpoint =
            url.includes('/auth/login') ||
            url.includes('/auth/register') ||
            url.includes('/auth/refresh') ||
            url.includes('/auth/login-by-qr');

          // Failed sign-in / sign-up (wrong password, etc.): do NOT wipe an existing session or redirect.
          const isCredentialAttempt =
            url.includes('/auth/login') ||
            url.includes('/auth/register') ||
            url.includes('/auth/login-by-qr');

          const currentPath = window.location.pathname;
          const isOnAuthPage = currentPath.includes('/login') || currentPath.includes('/register') || currentPath.includes('/reset-password');

          // Attempt one silent refresh + retry to avoid "random logouts" when access token expires.
          if (!isAuthEndpoint && originalConfig && !originalConfig._retry) {
            originalConfig._retry = true;
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              try {
                const newAccessToken = await this.refreshAccessToken(refreshToken);
                if (newAccessToken) {
                  originalConfig.headers = originalConfig.headers || {};
                  (originalConfig.headers as any).Authorization = `Bearer ${newAccessToken}`;
                  return this.client.request(originalConfig);
                }
              } catch {
                // Fall through to logout below
              }
            }
          }

          // Only clear session when a protected API call was unauthorized — not when login/register returned 401.
          if (!isCredentialAttempt) {
            this.clearToken();
            localStorage.removeItem('authData');
            if (!isOnAuthPage) {
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      },
    );
  }

  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        // Use a separate axios instance to avoid interceptor loops
        const baseURL = getApiUrl();
        const res = await axios.post(
          `${baseURL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
        );
        const data = (res?.data as any)?.data;
        const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
        const nextRefresh = typeof data?.refreshToken === 'string' ? data.refreshToken : null;
        if (accessToken) {
          this.setToken(accessToken);
          if (nextRefresh) this.setRefreshToken(nextRefresh);
          return accessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refreshToken', token);
  }

  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();


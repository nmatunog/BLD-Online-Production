import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiUrl } from '@/lib/runtime-config';

// Log API URL for debugging (only in development)
// This will be logged when ApiClient is instantiated

class ApiClient {
  private client: AxiosInstance;

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
        // Enhanced error logging
        if (typeof window !== 'undefined') {
          if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
            const currentApiUrl = getApiUrl();
            console.error('❌ Network Error: Cannot connect to backend at', currentApiUrl);
            console.error('💡 Make sure the backend server is running');
          } else {
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
        
        if (error.response?.status === 401) {
          // Handle token refresh or redirect to login
          // Don't redirect if we're already on the login page (to avoid clearing error messages)
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Only redirect if not already on login/register pages
            if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
              this.clearToken();
              window.location.href = '/login';
            } else {
              // Just clear the token, don't redirect
              this.clearToken();
            }
          }
        }
        return Promise.reject(error);
      },
    );
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


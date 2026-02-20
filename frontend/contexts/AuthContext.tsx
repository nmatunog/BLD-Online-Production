'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  member?: {
    nickname: string | null;
    lastName: string;
    firstName: string;
    communityId?: string;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUserFromStorage(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const authData = localStorage.getItem('authData');
  if (!authData) return null;
  try {
    const parsed = JSON.parse(authData);
    return {
      id: parsed.user?.id ?? '',
      email: parsed.user?.email ?? null,
      phone: parsed.user?.phone ?? null,
      role: parsed.user?.role ?? '',
      member: parsed.member ?? undefined,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace('/login');
      setLoading(false);
      return;
    }
    const userData = loadUserFromStorage();
    if (!userData) {
      const token = authService.getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUserState({
            id: payload.sub ?? '',
            email: payload.email ?? null,
            phone: payload.phone ?? null,
            role: payload.role ?? '',
          });
        } catch {
          authService.logout();
          return;
        }
      }
    } else {
      setUserState(userData);
    }
    setLoading(false);
  }, [router]);

  const value: AuthContextValue = { user, loading, setUser };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/** Optional hook: returns context or null if outside provider (for components used in both dashboard and other routes). */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

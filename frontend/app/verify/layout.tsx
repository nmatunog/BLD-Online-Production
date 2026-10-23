'use client';

import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function VerifyAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-slate-100"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-3 text-gray-700">
          <Loader2 className="h-12 w-12 animate-spin" aria-hidden />
          <p className="text-xl font-semibold">Opening card…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VerifyAuthGate>{children}</VerifyAuthGate>
    </AuthProvider>
  );
}

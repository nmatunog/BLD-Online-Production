'use client';

import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" role="status" aria-live="polite" aria-label="Loading">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <Loader2 className="w-10 h-10 animate-spin" aria-hidden />
          <p className="text-lg font-medium">Loading…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </AuthProvider>
  );
}

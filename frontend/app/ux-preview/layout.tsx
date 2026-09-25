import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Check-in UX preview',
  robots: { index: false, follow: false },
};

export default function UxPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  return children;
}

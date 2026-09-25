import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check-in UX preview',
  robots: { index: false, follow: false },
};

export default function UxPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}

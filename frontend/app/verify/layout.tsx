import type { Metadata } from 'next';
import { VerifyClientLayout } from './verify-client-layout';

export const metadata: Metadata = {
  title: 'Member ID',
  robots: { index: false, follow: false, nocache: true },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <VerifyClientLayout>{children}</VerifyClientLayout>;
}

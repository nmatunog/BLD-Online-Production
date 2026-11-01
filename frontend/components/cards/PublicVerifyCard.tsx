import type { ReactNode } from 'react';
import { withPhotoCacheBust } from '@/lib/photo-url';

export type PublicVerifyCardProps = {
  status: 'VALID' | 'REVOKED';
  fullName: string;
  memberId: string;
  ministry: string;
  photoUrl: string | null;
  /** Extra actions under the card, e.g. "Set my password" for the card holder. */
  children?: ReactNode;
};

export function PublicVerifyCard({
  status,
  fullName,
  memberId,
  ministry,
  photoUrl,
  children,
}: PublicVerifyCardProps) {
  const photo = photoUrl ? withPhotoCacheBust(photoUrl, memberId) : '';
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-slate-100 px-4 py-8">
      {status === 'REVOKED' ? (
        <p
          role="alert"
          className="rounded-3xl bg-red-600 px-4 py-8 text-center text-5xl font-black tracking-wide text-white"
        >
          REVOKED
        </p>
      ) : (
        <p className="rounded-3xl bg-emerald-600 px-4 py-8 text-center text-5xl font-black tracking-wide text-white">
          VALID
        </p>
      )}

      <div className="mt-8 flex flex-col items-center text-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-64 w-64 rounded-3xl border-4 border-white object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-slate-300 text-5xl font-black text-slate-700">
            {initials || '—'}
          </div>
        )}
        <h1 className="mt-6 text-4xl font-black leading-tight text-gray-900">{fullName || '—'}</h1>
        <p className="mt-3 text-2xl font-bold text-gray-800">{memberId}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-700">{ministry}</p>
      </div>
      {children}
    </main>
  );
}

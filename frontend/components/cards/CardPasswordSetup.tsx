'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { memberCardsService } from '@/services/member-cards.service';
import { getErrorMessage } from '@/lib/get-error-message';

type Stage = 'closed' | 'form' | 'done';

/**
 * "Is this your card?" — the card holder sets or resets their own password.
 * Holding the card (its secret link) is the proof; last name is a second check.
 */
export function CardPasswordSetup({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>('closed');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!lastName.trim()) return setError('Enter your last name.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setSaving(true);
    try {
      const response = await memberCardsService.setPasswordWithCard(token, lastName.trim(), password);
      if (!response.success) {
        setError(response.error || response.message || 'Could not save your password.');
        return;
      }
      setDoneMessage(response.data?.message || 'Password saved.');
      setStage('done');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your password.'));
    } finally {
      setSaving(false);
    }
  };

  if (stage === 'done') {
    return (
      <div className="mt-8 rounded-3xl bg-emerald-50 p-5 text-center" role="status">
        <p className="text-2xl font-bold text-emerald-900">Password saved</p>
        <p className="mt-2 text-lg text-emerald-900">{doneMessage}</p>
        <Link
          href="/login"
          className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-700 text-xl font-bold text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (stage === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setStage('form')}
        className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-400 bg-white text-xl font-bold text-slate-800"
      >
        <KeyRound className="h-6 w-6" aria-hidden />
        This is my card — set my password
      </button>
    );
  }

  const field = 'mt-1 min-h-14 w-full rounded-2xl border-2 border-gray-300 bg-white px-4 text-xl';
  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-white p-5 shadow" noValidate>
      <p className="text-xl font-bold text-gray-900">Set or reset your password</p>
      <p className="text-base text-gray-700">
        Only do this with your own card. Staff accounts: ask an administrator.
      </p>
      <label className="block text-lg font-semibold text-gray-800">
        Your last name
        <input
          className={field}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          autoCapitalize="words"
        />
      </label>
      <label className="block text-lg font-semibold text-gray-800">
        New password
        <input
          className={field}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
        />
      </label>
      <label className="block text-lg font-semibold text-gray-800">
        Type it again
        <input
          className={field}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error ? (
        <p role="alert" className="text-lg font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="min-h-14 w-full rounded-2xl bg-slate-800 text-xl font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save password'}
      </button>
      <button
        type="button"
        onClick={() => setStage('closed')}
        className="min-h-12 w-full text-lg font-semibold text-gray-700 underline"
      >
        Cancel
      </button>
    </form>
  );
}

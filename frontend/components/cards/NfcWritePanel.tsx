'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Lock, Smartphone, X } from 'lucide-react';
import { memberCardsService, type WriteReadyCard } from '@/services/member-cards.service';
import { doorMemberName, printerMemberName, PRINTER_NFC_HELP } from '@/lib/nfc-card';
import {
  NFC_LOCK_CONFIRM,
  NFC_UNSUPPORTED_MESSAGE,
  createNdefReader,
  isWebNfcSupported,
  lockNfcTag,
  nfcUrlsMatch,
  readNdefUri,
  writeNdefUri,
} from '@/lib/nfc-writer';
import { getErrorMessage } from '@/lib/get-error-message';

export type WriteTarget = {
  memberId: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  communityId: string;
};

type WriteStep = 'prepare' | 'write' | 'verify' | 'lock' | 'done' | 'error';

export function NfcWritePanel({
  target,
  indexLabel,
  onFinished,
  onCancel,
}: {
  target: WriteTarget;
  indexLabel?: string;
  onFinished: (result: 'success' | 'failed' | 'skipped') => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<WriteStep>('prepare');
  const [message, setMessage] = useState('Preparing the card token…');
  const [ready, setReady] = useState<WriteReadyCard | null>(null);
  const [nfcSupported] = useState(() => isWebNfcSupported());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const displayName = doorMemberName({
    id: target.memberId,
    firstName: target.firstName,
    lastName: target.lastName,
    nickname: target.nickname ?? null,
    communityId: target.communityId,
    ministry: null,
    photoUrl: null,
  });
  const legalName = printerMemberName(target);

  const stopScan = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await memberCardsService.issueForWrite(target.memberId);
        if (cancelled) return;
        if (!result.success || !result.data) {
          setStep('error');
          setMessage(result.error || 'Could not prepare this card.');
          return;
        }
        setReady(result.data);
        setStep(nfcSupported ? 'write' : 'write');
        setMessage(
          nfcSupported
            ? `Tap the blank card for ${displayName}.`
            : NFC_UNSUPPORTED_MESSAGE,
        );
      } catch (error) {
        if (cancelled) return;
        setStep('error');
        setMessage(getErrorMessage(error, 'Could not prepare this card.'));
      }
    })();
    return () => {
      cancelled = true;
      stopScan();
    };
  }, [target.memberId, displayName, nfcSupported]);

  const copyUrl = useCallback(async () => {
    if (!ready?.nfcUrl) return;
    try {
      await navigator.clipboard.writeText(ready.nfcUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage('Copy failed. Select the URL and copy it yourself.');
    }
  }, [ready?.nfcUrl]);

  const markEncoded = async () => {
    if (!ready) return;
    await memberCardsService.markEncoded(ready.cardId);
  };

  const handleWrite = async () => {
    if (!ready) return;
    setBusy(true);
    setMessage('Hold the phone on the card…');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reader = createNdefReader();
      await writeNdefUri(reader, ready.nfcUrl, controller.signal);
      setStep('verify');
      setMessage('Written. Tap the same card again to verify.');
    } catch (error) {
      setStep('error');
      setMessage(getErrorMessage(error, 'Could not write the card.'));
    } finally {
      setBusy(false);
      stopScan();
    }
  };

  const handleVerify = async () => {
    if (!ready) return;
    setBusy(true);
    setMessage('Hold the phone on the card to read it…');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reader = createNdefReader();
      const readUrl = await readNdefUri(reader, controller.signal);
      if (!nfcUrlsMatch(ready.nfcUrl, readUrl)) {
        setStep('error');
        setMessage('The card did not match. Do not lock it. Write again.');
        return;
      }
      await markEncoded();
      setStep('lock');
      setMessage('Verified. Lock this card so the link cannot be changed?');
    } catch (error) {
      setStep('error');
      setMessage(getErrorMessage(error, 'Could not verify the card.'));
    } finally {
      setBusy(false);
      stopScan();
    }
  };

  const handleLock = async () => {
    if (!window.confirm(NFC_LOCK_CONFIRM)) return;
    setBusy(true);
    setMessage('Tap the card one more time to lock it…');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reader = createNdefReader();
      await lockNfcTag(reader, controller.signal);
      setStep('done');
      setMessage('Card locked. Encoding complete.');
    } catch (error) {
      setStep('done');
      setMessage(
        getErrorMessage(
          error,
          'The URL is on the card. Locking failed — you can lock it later.',
        ),
      );
    } finally {
      setBusy(false);
      stopScan();
    }
  };

  const handleManualEncoded = async () => {
    setBusy(true);
    try {
      await markEncoded();
      setStep('done');
      setMessage('Marked encoded. Remember to lock the tag in NFC Tools.');
    } catch (error) {
      setStep('error');
      setMessage(getErrorMessage(error, 'Could not mark the card encoded.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="flex max-h-[95dvh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {indexLabel ? (
              <p className="text-base font-semibold text-rose-700">{indexLabel}</p>
            ) : null}
            <h2 className="text-3xl font-black leading-tight text-gray-900">
              Tap card for {displayName}
            </h2>
            <p className="mt-1 text-lg text-gray-700">
              {legalName} · {target.communityId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScan();
              onCancel();
            }}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-gray-300"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl bg-slate-100 p-4 text-lg leading-snug text-slate-800">
          {message}
        </div>

        {!nfcSupported && ready ? (
          <div className="space-y-4">
            <p className="text-base text-gray-700">{PRINTER_NFC_HELP}</p>
            <div className="break-all rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-base font-medium">
              {ready.nfcUrl}
            </div>
            <button
              type="button"
              onClick={copyUrl}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 text-xl font-bold text-white"
            >
              <Copy className="h-6 w-6" />
              {copied ? 'Copied' : 'Copy NFC URL'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleManualEncoded}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white disabled:opacity-60"
            >
              I wrote and verified the URL
            </button>
          </div>
        ) : null}

        {nfcSupported && step === 'write' ? (
          <button
            type="button"
            disabled={busy || !ready}
            onClick={handleWrite}
            className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-rose-700 text-2xl font-black text-white disabled:opacity-60"
          >
            <Smartphone className="h-8 w-8" />
            {busy ? 'Writing…' : 'Write to card'}
          </button>
        ) : null}

        {nfcSupported && step === 'verify' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleVerify}
            className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 text-2xl font-black text-white disabled:opacity-60"
          >
            <Smartphone className="h-8 w-8" />
            {busy ? 'Reading…' : 'Tap again to verify'}
          </button>
        ) : null}

        {nfcSupported && step === 'lock' ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleLock}
              className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-amber-600 text-xl font-black text-white disabled:opacity-60"
            >
              <Lock className="h-7 w-7" />
              Lock card (permanent)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('done');
                setMessage('Card encoded. You can lock it later.');
              }}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-gray-400 text-xl font-bold"
            >
              Skip lock
            </button>
          </div>
        ) : null}

        {step === 'done' ? (
          <button
            type="button"
            onClick={() => onFinished('success')}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-2xl font-black text-white"
          >
            <CheckCircle2 className="h-8 w-8" />
            Done
          </button>
        ) : null}

        {step === 'error' ? (
          <div className="space-y-3">
            {nfcSupported ? (
              <button
                type="button"
                onClick={() => {
                  setStep('write');
                  setMessage(`Tap the blank card for ${displayName}.`);
                }}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-rose-700 text-xl font-bold text-white"
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onFinished('failed')}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-gray-400 text-xl font-bold"
            >
              Skip this member
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

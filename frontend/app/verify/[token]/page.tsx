'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PublicVerifyCard } from '@/components/cards/PublicVerifyCard';
import { useAuth } from '@/contexts/AuthContext';
import { memberCardsService, type VerifyResult } from '@/services/member-cards.service';
import { eventsService, type Event } from '@/services/events.service';
import { isInCheckInWindowManila, sortEventsNearestFirst } from '@/lib/event-checkin-window';
import { canVerifyMemberCards, doorMemberName, type PublicCardMember } from '@/lib/nfc-card';
import { withPhotoCacheBust } from '@/lib/photo-url';
import { getErrorMessage } from '@/lib/get-error-message';
import { resultFromCheckInError, type CheckInResultState } from '@/lib/checkin-ux';

type LoadState = 'loading' | 'ready' | 'error';

function isStaffMember(
  member: VerifyResult['member'] | undefined,
): member is PublicCardMember {
  return !!member && 'firstName' in member && 'communityId' in member;
}

function publicFields(result: VerifyResult | null): {
  fullName: string;
  memberId: string;
  ministry: string;
  photoUrl: string | null;
} {
  const member = result?.member;
  if (!member) {
    return { fullName: '', memberId: '', ministry: 'No ministry assigned', photoUrl: null };
  }
  if ('fullName' in member && 'memberId' in member) {
    return {
      fullName: member.fullName,
      memberId: member.memberId,
      ministry: member.ministry || 'No ministry assigned',
      photoUrl: member.photoUrl,
    };
  }
  if (isStaffMember(member)) {
    return {
      fullName: `${member.firstName} ${member.lastName}`.trim(),
      memberId: member.communityId,
      ministry: member.ministry || 'No ministry assigned',
      photoUrl: member.photoUrl,
    };
  }
  return { fullName: '', memberId: '', ministry: 'No ministry assigned', photoUrl: null };
}

export default function VerifyCardPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token || '');
  const { user } = useAuth();
  const staff = canVerifyMemberCards(user?.role);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResultState | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const response = await memberCardsService.verify(token);
      if (!response.success || !response.data) {
        setError(response.error || 'not found');
        setLoadState('error');
        return;
      }
      setResult(response.data);
      setLoadState('ready');
    } catch (err) {
      setError(getErrorMessage(err, 'not found'));
      setLoadState('error');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!staff || (result?.status !== 'ACTIVE' && result?.status !== 'VALID')) return;
    let cancelled = false;
    (async () => {
      try {
        const [upcoming, ongoing] = await Promise.all([
          eventsService.getAll({ status: 'UPCOMING', sortBy: 'startDate', sortOrder: 'asc', limit: 50 }),
          eventsService.getAll({ status: 'ONGOING', sortBy: 'startDate', sortOrder: 'asc', limit: 50 }),
        ]);
        const upcomingList = Array.isArray(upcoming.data?.data) ? upcoming.data.data : [];
        const ongoingList = Array.isArray(ongoing.data?.data) ? ongoing.data.data : [];
        const merged = [...upcomingList, ...ongoingList];
        const now = new Date();
        const inWindow = sortEventsNearestFirst(
          merged.filter((event) => isInCheckInWindowManila(event, now)),
          now,
        );
        if (cancelled) return;
        setEvents(inWindow);
        if (inWindow.length > 0) setSelectedEventId(inWindow[0].id);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff, result?.status]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const handleCheckIn = async () => {
    const member = result?.member;
    if (!selectedEventId || !isStaffMember(member)) return;
    setCheckingIn(true);
    setCheckInResult(null);
    try {
      const response = await memberCardsService.checkIn(token, selectedEventId);
      if (response.success) {
        setCheckInResult({
          kind: 'success',
          name: doorMemberName(member),
          communityId: member.communityId,
          message: 'Checked in',
        });
      } else {
        setCheckInResult(
          resultFromCheckInError(
            response.error || response.message || 'Check-in failed',
            doorMemberName(member),
            member.communityId,
          ),
        );
      }
    } catch (err) {
      setCheckInResult(
        resultFromCheckInError(
          getErrorMessage(err, 'Check-in failed'),
          doorMemberName(member),
          member.communityId,
        ),
      );
    } finally {
      setCheckingIn(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100">
        <Loader2 className="h-14 w-14 animate-spin text-rose-700" aria-label="Loading" />
      </main>
    );
  }

  const status = result?.status ?? 'NOT_FOUND';
  if (loadState === 'error' || status === 'NOT_FOUND' || !result?.member) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5">
        <p className="rounded-3xl bg-red-600 px-4 py-6 text-center text-3xl font-black text-white">
          not found
        </p>
        <p className="mt-4 text-center text-xl text-gray-700">{error || 'This card is not on file.'}</p>
      </main>
    );
  }

  if (!staff) {
    const publicMember = publicFields(result);
    return (
      <PublicVerifyCard
        status={status === 'REVOKED' ? 'REVOKED' : 'VALID'}
        fullName={publicMember.fullName}
        memberId={publicMember.memberId}
        ministry={publicMember.ministry}
        photoUrl={publicMember.photoUrl}
      />
    );
  }

  const member = isStaffMember(result.member) ? result.member : null;
  const active = (status === 'ACTIVE' || status === 'VALID') && member;
  const photo = member?.photoUrl ? withPhotoCacheBust(member.photoUrl, member.id) : '';

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-slate-100 px-4 py-6">
      <p
        className={`rounded-3xl px-4 py-5 text-center text-4xl font-black tracking-wide text-white ${
          active ? 'bg-emerald-600' : 'bg-red-600'
        }`}
      >
        {status === 'REVOKED' ? 'REVOKED' : status}
      </p>

      {member ? (
        <div className="mt-6 flex flex-col items-center text-center">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-64 w-64 rounded-3xl border-4 border-white object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-slate-300 text-5xl font-black text-slate-700">
              {(member.firstName[0] || '') + (member.lastName[0] || '')}
            </div>
          )}
          <h1 className="mt-5 text-4xl font-black leading-tight text-gray-900">
            {doorMemberName(member)}
          </h1>
          <p className="mt-2 text-2xl font-bold text-gray-800">{member.communityId}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-700">
            {member.ministry || 'No ministry assigned'}
          </p>
        </div>
      ) : (
        <p className="mt-8 text-center text-2xl font-semibold text-gray-700">
          This card is not on file.
        </p>
      )}

      {active && events.length > 0 ? (
        <section className="mt-8 space-y-3">
          {events.length > 1 ? (
            <label className="block text-left text-lg font-semibold text-gray-800">
              Event
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="mt-2 min-h-14 w-full rounded-2xl border-2 border-gray-400 bg-white px-3 text-lg"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-center text-lg font-semibold text-gray-800">
              {selectedEvent?.title}
            </p>
          )}
          <button
            type="button"
            disabled={checkingIn || !selectedEventId}
            onClick={handleCheckIn}
            className="flex min-h-20 w-full items-center justify-center rounded-3xl bg-emerald-600 text-3xl font-black text-white disabled:opacity-60"
          >
            {checkingIn ? 'Checking in…' : 'Check in'}
          </button>
        </section>
      ) : null}

      {checkInResult ? (
        <div
          className={`mt-5 rounded-3xl px-4 py-5 text-center text-2xl font-black text-white ${
            checkInResult.kind === 'error' ? 'bg-red-600' : 'bg-emerald-700'
          }`}
        >
          {checkInResult.kind === 'already' ? 'Already checked in' : checkInResult.message}
        </div>
      ) : null}

      <Link
        href="/checkin"
        className="mt-auto pt-8 text-center text-lg font-semibold text-rose-800 underline"
      >
        Open check-in desk
      </Link>
    </main>
  );
}

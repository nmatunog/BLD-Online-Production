'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  LogOut,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { SIGNUP_ENCOUNTER_TYPES } from '@/lib/member-constants';
import { parseAuthError } from '@/utils/error-handler';
import type { SignupResult, SignupSuggestion } from '@/types/api.types';

const STEPS = ['Your name', 'Encounter'] as const;

const fieldClass =
  'mt-2 h-14 w-full text-xl md:text-2xl px-4 rounded-xl border-2 border-gray-300 focus-visible:ring-emerald-600';
const labelClass = 'text-lg md:text-xl font-semibold text-gray-800';

function extractExistingFromError(error: unknown): SignupResult | null {
  const ax = error as AxiosError<{
    message?: string | { message?: string; existing?: SignupResult };
    existing?: SignupResult;
  }>;
  const data = ax.response?.data;
  if (!data) return null;

  if (data.existing) return data.existing;

  if (data.message && typeof data.message === 'object' && 'existing' in data.message) {
    return (data.message as { existing?: SignupResult }).existing ?? null;
  }

  return null;
}

function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [encounterType, setEncounterType] = useState('');
  const [classNumber, setClassNumber] = useState('');

  const [suggestions, setSuggestions] = useState<SignupSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  const canContinueStep0 = lastName.trim().length > 0 && firstName.trim().length > 0;
  const canSubmit =
    canContinueStep0 && encounterType.length > 0 && classNumber.trim().length > 0;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!suggestBoxRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const resetForm = () => {
    setResult(null);
    setIsExisting(false);
    setIsEditing(false);
    setStep(0);
    setLastName('');
    setFirstName('');
    setNickname('');
    setEncounterType('');
    setClassNumber('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const applySuggestion = (s: SignupSuggestion) => {
    setLastName(s.lastName);
    setFirstName(s.firstName);
    setNickname(s.nickname || '');
    setEncounterType(s.encounterType);
    setClassNumber(String(s.classNumber));
    setSuggestions([]);
    setShowSuggestions(false);
    setIsExisting(true);
    setIsEditing(false);
    setResult({
      memberId: s.memberId,
      communityId: s.communityId,
      firstName: s.firstName,
      lastName: s.lastName,
      nickname: s.nickname,
      encounterType: s.encounterType,
      classNumber: s.classNumber,
      isExistingMember: true,
      message: 'Your account already exists',
    });
    toast.error('Your account already exists', {
      description: `Community ID: ${s.communityId}`,
      duration: 5000,
    });
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);

    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    suggestTimer.current = setTimeout(async () => {
      try {
        const matches = await authService.suggestSignup(q);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 350);
  };

  const handleCopyCommunityId = async () => {
    if (!result?.communityId) return;
    try {
      await navigator.clipboard.writeText(result.communityId);
      toast.success('Community ID copied');
    } catch {
      toast.error('Could not copy — please write it down');
    }
  };

  const showExistingAccount = (existing: SignupResult) => {
    setResult(existing);
    setIsExisting(true);
    setIsEditing(false);
    setLastName(existing.lastName);
    setFirstName(existing.firstName);
    setNickname(existing.nickname || '');
    setEncounterType(existing.encounterType);
    setClassNumber(String(existing.classNumber));
    toast.error('Your account already exists', {
      description: `Community ID: ${existing.communityId}`,
      duration: 5000,
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Please complete the required fields');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || undefined,
        encounterType,
        classNumber: classNumber.trim(),
        city: 'Cebu',
      });
      setResult(data);
      setIsExisting(false);
      setIsEditing(false);
    } catch (error) {
      const existing = extractExistingFromError(error);
      if (existing) {
        showExistingAccount(existing);
      } else {
        const parsed = parseAuthError(error);
        toast.error(parsed.title, { description: parsed.message, duration: 6000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!result || !canSubmit) {
      toast.error('Please complete the required fields');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.updateSignup({
        memberId: result.memberId,
        communityId: result.communityId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || undefined,
        encounterType,
        classNumber: classNumber.trim(),
      });
      setResult(data);
      setIsExisting(true);
      setIsEditing(false);
      toast.success('Details saved');
    } catch (error) {
      const existing = extractExistingFromError(error);
      if (existing && existing.memberId !== result.memberId) {
        showExistingAccount(existing);
      } else {
        const parsed = parseAuthError(error);
        toast.error(parsed.title, { description: parsed.message, duration: 6000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ——— Existing account / success screen ———
  if (result) {
    const borderClass = isExisting ? 'border-amber-300' : 'border-green-200';
    const titleColor = isExisting ? 'text-amber-900' : 'text-green-800';
    const badgeBg = isExisting ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-600';
    const idBox = isExisting
      ? 'bg-amber-50 border-amber-200'
      : 'bg-green-50 border-green-200';
    const idLabel = isExisting ? 'text-amber-800' : 'text-green-700';
    const idValue = isExisting ? 'text-amber-950' : 'text-green-900';

    return (
      <Card
        className={`w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 ${borderClass} overflow-hidden`}
      >
        <div className="text-center mb-6">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${badgeBg}`}
          >
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${titleColor} mb-2`}>
            {isExisting
              ? 'Your account already exists'
              : 'You are signed up!'}
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            {isExisting
              ? 'We found your Community ID. You can edit details, save, exit, or sign up another member.'
              : result.message}
          </p>
        </div>

        <div className={`rounded-xl border-2 p-4 mb-6 text-center ${idBox}`}>
          <p className={`text-base uppercase tracking-wide font-semibold mb-2 ${idLabel}`}>
            Your Community ID
          </p>
          <p className={`text-2xl sm:text-3xl font-mono font-bold break-all ${idValue}`}>
            {result.communityId}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-12 text-lg w-full sm:w-auto"
            onClick={handleCopyCommunityId}
          >
            <ClipboardCopy className="w-5 h-5 mr-2" />
            Copy ID
          </Button>
        </div>

        {isEditing ? (
          <div className="space-y-4 mb-6 text-left">
            <div>
              <Label htmlFor="editLastName" className={labelClass}>
                Last name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="editLastName"
                className={fieldClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editFirstName" className={labelClass}>
                First name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="editFirstName"
                className={fieldClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editNickname" className={labelClass}>
                Nickname
              </Label>
              <Input
                id="editNickname"
                className={fieldClass}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div>
              <Label className={labelClass}>
                Encounter type <span className="text-red-600">*</span>
              </Label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEncounterType(value)}
                    className={`w-full min-h-12 rounded-xl border-2 px-3 py-2 text-left text-lg font-semibold ${
                      encounterType === value
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="editClass" className={labelClass}>
                Class number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="editClass"
                className={fieldClass}
                inputMode="numeric"
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <p className="text-sm text-gray-500">
              Saving updates your name details. Community ID stays the same.
            </p>
          </div>
        ) : (
          <div className="text-base sm:text-lg text-gray-700 space-y-2 mb-6 text-left">
            <p>
              <span className="font-semibold">Last name:</span> {result.lastName}
            </p>
            <p>
              <span className="font-semibold">First name:</span> {result.firstName}
            </p>
            <p>
              <span className="font-semibold">Nickname:</span>{' '}
              {result.nickname || '—'}
            </p>
            <p>
              <span className="font-semibold">Encounter:</span>{' '}
              {result.encounterType} {result.classNumber}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {isEditing ? (
            <Button
              type="button"
              className="w-full h-14 text-lg bg-emerald-700 hover:bg-emerald-800"
              disabled={isLoading || !canSubmit}
              onClick={handleSaveEdit}
            >
              {isLoading ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full h-14 text-lg bg-emerald-700 hover:bg-emerald-800"
              onClick={() => setIsEditing(true)}
            >
              Edit details
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-lg"
            onClick={resetForm}
          >
            Sign up another member
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-lg"
            onClick={() => router.push('/login')}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Exit
          </Button>
        </div>
      </Card>
    );
  }

  // ——— Signup wizard ———
  return (
    <Card className="w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 border-emerald-200 overflow-hidden">
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-emerald-100 text-emerald-700">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-800 leading-tight">
          Initial Signup Form
        </h1>
        <p className="text-base sm:text-lg text-gray-600 mt-2">
          Get your Community ID — no password needed
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 text-base font-semibold px-3 py-2 rounded-full ${
              i === step
                ? 'bg-emerald-100 text-emerald-900'
                : i < step
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm">
              {i + 1}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div ref={suggestBoxRef} className="relative">
            <Label htmlFor="lastName" className={labelClass}>
              Last name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="lastName"
              className={fieldClass}
              value={lastName}
              onChange={(e) => handleLastNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              autoCapitalize="words"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border-2 border-emerald-200 bg-white shadow-lg">
                <p className="px-3 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50">
                  Possible matches — tap if this is you
                </p>
                {suggestions.map((s) => (
                  <button
                    key={s.memberId}
                    type="button"
                    className="w-full text-left px-4 py-3 border-t border-gray-100 hover:bg-emerald-50 text-base sm:text-lg"
                    onClick={() => applySuggestion(s)}
                  >
                    <span className="font-semibold">
                      {s.lastName}, {s.firstName}
                      {s.nickname ? ` (“${s.nickname}”)` : ''}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {s.encounterType} {s.classNumber} · {s.communityId}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {lastName.trim().length > 0 && lastName.trim().length < 3 && (
              <p className="mt-1 text-sm text-gray-500">
                Type 3+ letters to look for existing members
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="firstName" className={labelClass}>
              First name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="firstName"
              className={fieldClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              autoCapitalize="words"
            />
          </div>
          <div>
            <Label htmlFor="nickname" className={labelClass}>
              Nickname{' '}
              <span className="text-gray-500 font-normal text-base">(optional)</span>
            </Label>
            <Input
              id="nickname"
              className={fieldClass}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoCapitalize="words"
              placeholder="What friends call you"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <Label className={labelClass}>
              Encounter type <span className="text-red-600">*</span>
            </Label>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEncounterType(value)}
                  className={`w-full min-h-14 rounded-xl border-2 px-4 py-3 text-left text-lg sm:text-xl font-semibold transition ${
                    encounterType === value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="classNumber" className={labelClass}>
              Class number <span className="text-red-600">*</span>
            </Label>
            <Input
              id="classNumber"
              className={fieldClass}
              inputMode="numeric"
              placeholder="e.g. 18"
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <p className="text-base text-gray-500">
            Location defaults to Cebu. Mobile, ministry, and login come later.
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-14 text-lg px-5"
            onClick={() => setStep((s) => s - 1)}
            disabled={isLoading}
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back
          </Button>
        ) : null}

        {step === 0 ? (
          <Button
            type="button"
            className="ml-auto h-14 text-lg px-6 bg-emerald-700 hover:bg-emerald-800"
            disabled={!canContinueStep0}
            onClick={() => setStep(1)}
          >
            Next
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            className="ml-auto h-14 text-lg px-6 bg-emerald-700 hover:bg-emerald-800"
            disabled={isLoading || !canSubmit}
            onClick={handleSubmit}
          >
            {isLoading ? 'Saving…' : 'Get Community ID'}
          </Button>
        )}
      </div>

      <p className="text-center text-base text-gray-500 mt-6 leading-relaxed">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden flex items-start sm:items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8">
            <CardHeader>
              <CardTitle className="text-2xl">Loading…</CardTitle>
              <CardDescription className="text-lg">Preparing signup form</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}

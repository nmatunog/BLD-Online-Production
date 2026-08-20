'use client';

import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  LogOut,
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

/** BLD logo color peg extracted from brand mark */
const BLD = {
  red: '#D00008',
  redDark: '#A80006',
  redSoft: '#FCE8E9',
  redMuted: '#F5D0D2',
  ink: '#1A1A1A',
} as const;

const STEPS = ['Your name', 'Encounter'] as const;

const fieldClass =
  'mt-2 h-14 w-full text-xl md:text-2xl px-4 rounded-xl border-2 border-gray-300 focus-visible:border-[#D00008] focus-visible:ring-[#D00008]';
const labelClass = 'text-lg md:text-xl font-semibold text-gray-900';
const primaryBtn =
  'h-14 text-lg px-6 text-white bg-[#D00008] hover:bg-[#A80006] disabled:opacity-50';
const outlineBtn =
  'h-14 text-lg border-2 border-[#D00008]/40 text-[#D00008] hover:bg-[#FCE8E9]';

function BrandLogo({ size = 88 }: { size?: number }) {
  return (
    <Image
      src="/bld-logo.png"
      alt="BLD Cebu"
      width={size}
      height={size}
      priority
      className="mx-auto object-contain"
    />
  );
}

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

  if (result) {
    return (
      <Card className="w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 border-[#D00008]/25 overflow-hidden">
        <div className="h-1.5 w-full absolute top-0 left-0 right-0 bg-[#D00008]" />
        <div className="text-center mb-6 pt-2">
          <BrandLogo size={72} />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#D00008] mt-4 mb-2">
            {isExisting ? 'Your account already exists' : 'You are signed up!'}
          </h1>
          <p className="text-base sm:text-lg text-gray-700">
            {isExisting
              ? 'We found your Community ID. You can edit details, save, exit, or sign up another member.'
              : result.message}
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#D00008]/30 bg-[#FCE8E9] p-4 mb-6 text-center">
          <p className="text-base uppercase tracking-wide font-semibold mb-2 text-[#A80006]">
            Your Community ID
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-bold break-all text-[#1A1A1A]">
            {result.communityId}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-12 text-lg w-full sm:w-auto border-[#D00008] text-[#D00008]"
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
                Last name <span className="text-[#D00008]">*</span>
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
                First name <span className="text-[#D00008]">*</span>
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
                Encounter type <span className="text-[#D00008]">*</span>
              </Label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEncounterType(value)}
                    className={`w-full min-h-12 rounded-xl border-2 px-3 py-2 text-left text-lg font-semibold ${
                      encounterType === value
                        ? 'border-[#D00008] bg-[#FCE8E9] text-[#A80006]'
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
                Class number <span className="text-[#D00008]">*</span>
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
          <div className="text-base sm:text-lg text-gray-800 space-y-2 mb-6 text-left">
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
              className={`w-full ${primaryBtn}`}
              disabled={isLoading || !canSubmit}
              onClick={handleSaveEdit}
            >
              {isLoading ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <Button
              type="button"
              className={`w-full ${primaryBtn}`}
              onClick={() => setIsEditing(true)}
            >
              Edit details
            </Button>
          )}

          <Button type="button" variant="outline" className={`w-full ${outlineBtn}`} onClick={resetForm}>
            Sign up another member
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-lg border-gray-300 text-gray-700"
            onClick={() => router.push('/login')}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Exit
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 border-[#D00008]/20 overflow-hidden">
      <div className="h-1.5 w-full absolute top-0 left-0 right-0 bg-[#D00008]" />

      <div className="text-center mb-5 pt-2">
        <BrandLogo size={96} />
        <h1 className="text-2xl sm:text-3xl font-bold text-[#D00008] leading-tight mt-3">
          Initial Signup Form
        </h1>
        <p className="text-base sm:text-lg text-gray-700 mt-2">
          BLD Cebu Community Online Portal
        </p>
        <p className="text-base text-gray-600 mt-1">
          Get your Community ID — no password needed
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 text-base font-semibold px-3 py-2 rounded-full ${
              i === step
                ? 'bg-[#FCE8E9] text-[#A80006]'
                : i < step
                  ? 'bg-[#FCE8E9]/70 text-[#D00008]'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                i === step ? 'bg-[#D00008] text-white' : 'bg-white/80'
              }`}
            >
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
              Last name <span className="text-[#D00008]">*</span>
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
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border-2 border-[#D00008]/30 bg-white shadow-lg">
                <p className="px-3 py-2 text-sm font-semibold text-[#A80006] bg-[#FCE8E9]">
                  Possible matches — tap if this is you
                </p>
                {suggestions.map((s) => (
                  <button
                    key={s.memberId}
                    type="button"
                    className="w-full text-left px-4 py-3 border-t border-gray-100 hover:bg-[#FCE8E9] text-base sm:text-lg"
                    onClick={() => applySuggestion(s)}
                  >
                    <span className="font-semibold text-gray-900">
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
              First name <span className="text-[#D00008]">*</span>
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
              Encounter type <span className="text-[#D00008]">*</span>
            </Label>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEncounterType(value)}
                  className={`w-full min-h-14 rounded-xl border-2 px-4 py-3 text-left text-lg sm:text-xl font-semibold transition ${
                    encounterType === value
                      ? 'border-[#D00008] bg-[#FCE8E9] text-[#A80006]'
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
              Class number <span className="text-[#D00008]">*</span>
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
            className={`px-5 ${outlineBtn}`}
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
            className={`ml-auto ${primaryBtn}`}
            disabled={!canContinueStep0}
            onClick={() => setStep(1)}
          >
            Next
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            className={`ml-auto ${primaryBtn}`}
            disabled={isLoading || !canSubmit}
            onClick={handleSubmit}
          >
            {isLoading ? 'Saving…' : 'Get Community ID'}
          </Button>
        )}
      </div>

      <p className="text-center text-base text-gray-600 mt-6 leading-relaxed">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#D00008] hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div
      className="min-h-dvh w-full overflow-x-hidden flex items-start sm:items-center justify-center p-3 sm:p-6"
      style={{
        background: `linear-gradient(165deg, #ffffff 0%, ${BLD.redSoft} 45%, #ffffff 100%)`,
      }}
    >
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8 border-[#D00008]/20">
            <CardHeader>
              <CardTitle className="text-2xl text-[#D00008]">Loading…</CardTitle>
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

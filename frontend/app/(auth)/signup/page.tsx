'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { SIGNUP_ENCOUNTER_TYPES } from '@/lib/member-constants';
import { parseAuthError } from '@/utils/error-handler';
import type { SignupResult } from '@/types/api.types';

const STEPS = ['Your name', 'Encounter'] as const;

const fieldClass =
  'mt-2 h-14 w-full text-xl md:text-2xl px-4 rounded-xl border-2 border-gray-300 focus-visible:ring-emerald-600';
const labelClass = 'text-lg md:text-xl font-semibold text-gray-800';

function SignupForm() {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [encounterType, setEncounterType] = useState('');
  const [classNumber, setClassNumber] = useState('');

  const canContinueStep0 = lastName.trim().length > 0 && firstName.trim().length > 0;
  const canSubmit =
    canContinueStep0 && encounterType.length > 0 && classNumber.trim().length > 0;

  const handleCopyCommunityId = async () => {
    if (!result?.communityId) return;
    try {
      await navigator.clipboard.writeText(result.communityId);
      toast.success('Community ID copied');
    } catch {
      toast.error('Could not copy — please write it down');
    }
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
    } catch (error) {
      const parsed = parseAuthError(error);
      toast.error(parsed.title, { description: parsed.message, duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  if (result) {
    return (
      <Card className="w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 border-green-200 overflow-hidden">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-green-100 text-green-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-green-800 mb-2">
            {result.isExistingMember ? 'Signup confirmed' : 'You are signed up!'}
          </h1>
          <p className="text-base sm:text-lg text-gray-600">{result.message}</p>
        </div>

        <div className="rounded-xl bg-green-50 border-2 border-green-200 p-4 mb-6 text-center">
          <p className="text-base uppercase tracking-wide text-green-700 font-semibold mb-2">
            Your Community ID
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-green-900 break-all">
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

        <div className="text-base sm:text-lg text-gray-700 space-y-2 mb-6">
          <p>
            <span className="font-semibold">Name:</span>{' '}
            {result.firstName}
            {result.nickname ? ` (“${result.nickname}”)` : ''} {result.lastName}
          </p>
          <p>
            <span className="font-semibold">Encounter:</span>{' '}
            {result.encounterType} {result.classNumber}
          </p>
        </div>

        <p className="text-base text-gray-500 mb-6">
          Write down your Community ID. Mobile number, ministry, and login can be completed later.
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/login" className="w-full">
            <Button className="w-full h-14 text-lg bg-green-700 hover:bg-green-800">
              Go to sign in
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 text-lg"
            onClick={() => {
              setResult(null);
              setStep(0);
              setLastName('');
              setFirstName('');
              setNickname('');
              setEncounterType('');
              setClassNumber('');
            }}
          >
            Sign up another member
          </Button>
        </div>
      </Card>
    );
  }

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
          <div>
            <Label htmlFor="lastName" className={labelClass}>
              Last name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="lastName"
              className={fieldClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              autoCapitalize="words"
            />
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
              Nickname <span className="text-gray-500 font-normal text-base">(optional)</span>
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

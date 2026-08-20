'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Phone,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authService } from '@/services/auth.service';
import {
  APOSTOLATES,
  MINISTRIES_BY_APOSTOLATE,
  SIGNUP_ENCOUNTER_TYPES,
} from '@/lib/member-constants';
import { parseAuthError } from '@/utils/error-handler';
import type { SignupResult } from '@/types/api.types';

const STEPS = ['Ministry', 'About you', 'Contact'] as const;

function SignupForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);

  const [apostolate, setApostolate] = useState(
    () => searchParams.get('apostolate') || '',
  );
  const [ministry, setMinistry] = useState(
    () => searchParams.get('ministry') || '',
  );
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [encounterType, setEncounterType] = useState('');
  const [classNumber, setClassNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');

  const ministries = useMemo(
    () => (apostolate ? MINISTRIES_BY_APOSTOLATE[apostolate] || [] : []),
    [apostolate],
  );

  const canContinueStep0 = apostolate && ministry;
  const canContinueStep1 =
    lastName.trim() &&
    firstName.trim() &&
    encounterType &&
    classNumber.trim() &&
    dateOfBirth;

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
    if (!phone.trim()) {
      toast.error('Mobile number is required');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.signup({
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        encounterType,
        classNumber: classNumber.trim(),
        dateOfBirth,
        apostolate,
        ministry,
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
      <Card className="p-8 rounded-2xl shadow-xl max-w-lg w-full relative z-10 bg-white border-2 border-green-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-green-100 text-green-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">
            {result.isExistingMember ? 'Registration confirmed' : 'You are registered!'}
          </h1>
          <p className="text-sm text-gray-600">{result.message}</p>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-6 text-center">
          <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-1">
            Your Community ID
          </p>
          <p className="text-2xl font-mono font-bold text-green-900 break-all">
            {result.communityId}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleCopyCommunityId}
          >
            <ClipboardCopy className="w-4 h-4 mr-2" />
            Copy ID
          </Button>
        </div>

        <div className="text-sm text-gray-600 space-y-2 mb-6">
          <p>
            <span className="font-medium">Name:</span>{' '}
            {result.firstName} {result.middleName ? `${result.middleName} ` : ''}
            {result.lastName}
          </p>
          <p>
            <span className="font-medium">Ministry:</span> {result.ministry}
          </p>
          <p>
            <span className="font-medium">Encounter:</span>{' '}
            {result.encounterType} {result.classNumber}
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          You are active for attendance right away. App login (PIN or password) can be set up later
          with your ministry coordinator.
        </p>

        <div className="flex flex-col gap-2">
          <Link href="/login">
            <Button className="w-full bg-green-700 hover:bg-green-800">
              Go to sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline" className="w-full">
              Register another member
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8 rounded-2xl shadow-xl max-w-lg w-full relative z-10 bg-white border-2 border-emerald-200">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-emerald-100 text-emerald-700">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-emerald-800">Member Registration</h1>
        <p className="text-sm text-gray-600 mt-1">
          Register for attendance — no password needed
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              i === step
                ? 'bg-emerald-100 text-emerald-800'
                : i < step
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span>{i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="apostolate">Apostolate</Label>
            <Select
              value={apostolate}
              onValueChange={(v) => {
                setApostolate(v);
                setMinistry('');
              }}
            >
              <SelectTrigger id="apostolate" className="mt-1">
                <SelectValue placeholder="Select apostolate" />
              </SelectTrigger>
              <SelectContent>
                {APOSTOLATES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ministry">Ministry</Label>
            <Select
              value={ministry}
              onValueChange={setMinistry}
              disabled={!apostolate}
            >
              <SelectTrigger id="ministry" className="mt-1">
                <SelectValue placeholder={apostolate ? 'Select ministry' : 'Choose apostolate first'} />
              </SelectTrigger>
              <SelectContent>
                {ministries.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              className="mt-1"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              className="mt-1"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <Label htmlFor="middleName">Middle name (optional)</Label>
            <Input
              id="middleName"
              className="mt-1"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </div>
          <div>
            <Label>Encounter</Label>
            <Select value={encounterType} onValueChange={setEncounterType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select encounter type" />
              </SelectTrigger>
              <SelectContent>
                {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="classNumber">Class number</Label>
            <Input
              id="classNumber"
              className="mt-1"
              inputMode="numeric"
              placeholder="e.g. 18"
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              className="mt-1"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 border p-3 text-sm space-y-1">
            <p>
              <span className="text-gray-500">Ministry:</span> {ministry}
            </p>
            <p>
              <span className="text-gray-500">Name:</span> {firstName} {lastName}
            </p>
            <p>
              <span className="text-gray-500">Encounter:</span> {encounterType} {classNumber}
            </p>
          </div>
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                className="pl-10"
                placeholder="09XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Used later to set up app login with your coordinator
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-6">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}
        {step < 2 ? (
          <Button
            type="button"
            className="ml-auto bg-emerald-700 hover:bg-emerald-800"
            disabled={
              (step === 0 && !canContinueStep0) ||
              (step === 1 && !canContinueStep1)
            }
            onClick={() => setStep((s) => s + 1)}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            className="ml-auto bg-emerald-700 hover:bg-emerald-800"
            disabled={isLoading || !phone.trim()}
            onClick={handleSubmit}
          >
            {isLoading ? 'Registering…' : 'Complete registration'}
          </Button>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Need full account with password?{' '}
        <Link href="/register" className="text-emerald-700 font-medium hover:underline">
          Staff registration
        </Link>
        {' · '}
        <Link href="/login" className="text-emerald-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <Suspense
        fallback={
          <Card className="p-8 max-w-lg w-full">
            <CardHeader>
              <CardTitle>Loading…</CardTitle>
              <CardDescription>Preparing registration form</CardDescription>
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

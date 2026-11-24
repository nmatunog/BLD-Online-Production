'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IdPhotoUpload } from '@/components/IdPhotoUpload';
import {
  APOSTOLATES,
  CIVIL_STATUSES,
  ENCOUNTER_TYPES,
  GENDERS,
  getMinistriesForApostolate,
} from '@/lib/member-constants';
import {
  AdminCreateDuplicateError,
  getMemberApiErrorMessage,
  membersService,
  type AdminCreateMemberRequest,
  type Member,
} from '@/services/members.service';
import { memberCardsService } from '@/services/member-cards.service';

export const NICKNAME_WARNING = 'Nickname prints on the ID card';
export const MOBILE_HELP =
  "Leave blank if unknown — they get an ID + QR now but can't log in until an admin adds a mobile.";

export type AddMemberForm = {
  firstName: string;
  lastName: string;
  middleName: string;
  nickname: string;
  encounterType: string;
  classNumber: string;
  gender: string;
  civilStatus: string;
  apostolate: string;
  ministry: string;
  email: string;
  phone: string;
  issueCard: boolean;
};

export const EMPTY_ADD_MEMBER_FORM: AddMemberForm = {
  firstName: '',
  lastName: '',
  middleName: '',
  nickname: '',
  encounterType: '',
  classNumber: '',
  gender: '',
  civilStatus: '',
  apostolate: '',
  ministry: '',
  email: '',
  phone: '',
  issueCard: true,
};

type FieldErrors = Partial<Record<keyof AddMemberForm, string>>;

type StepStatus = { state: 'skipped' | 'done' | 'failed'; message?: string };

export type AddMemberResult = {
  member: Member;
  name: string;
  loginLocked: boolean;
  photo: StepStatus;
  card: StepStatus;
};

/** Strip spaces and dashes a user may type in a mobile number. */
function cleanPhone(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

export function validateAddMemberForm(form: AddMemberForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!form.encounterType) errors.encounterType = 'Select an encounter type.';
  const cls = form.classNumber.trim();
  if (!cls) {
    errors.classNumber = 'Class number is required.';
  } else if (!/^\d{1,3}$/.test(cls) || Number(cls) < 1) {
    errors.classNumber = 'Class number must be 1 to 999.';
  }
  const phone = cleanPhone(form.phone);
  if (phone && !/^09\d{9}$/.test(phone)) {
    errors.phone = 'Mobile must be 11 digits starting with 09 (e.g., 09209648523).';
  }
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (form.ministry && !form.apostolate) errors.ministry = 'Select an apostolate first.';
  return errors;
}

/** Only send fields that have a value; the API treats missing as "not provided". */
export function toAdminCreateRequest(form: AddMemberForm, confirmNotDuplicate: boolean): AdminCreateMemberRequest {
  const optional = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };
  const request: AdminCreateMemberRequest = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    encounterType: form.encounterType,
    classNumber: form.classNumber.trim(),
    middleName: optional(form.middleName),
    nickname: optional(form.nickname),
    gender: optional(form.gender),
    civilStatus: optional(form.civilStatus),
    apostolate: optional(form.apostolate),
    ministry: optional(form.ministry),
    email: optional(form.email),
    phone: optional(cleanPhone(form.phone)),
  };
  if (confirmNotDuplicate) request.confirmNotDuplicate = true;
  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => value !== undefined),
  ) as AdminCreateMemberRequest;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after each member is created (even if the photo or card step failed). */
  onMemberAdded: (member: Member) => void;
};

const selectClass =
  'flex h-11 w-full rounded-md border border-input bg-white px-3 text-base text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50';

export function AddMemberDialog({ open, onOpenChange, onMemberAdded }: Props) {
  const [form, setForm] = useState<AddMemberForm>(EMPTY_ADD_MEMBER_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<AdminCreateDuplicateError | null>(null);
  const [pendingAddAnother, setPendingAddAnother] = useState(false);
  const [result, setResult] = useState<AddMemberResult | null>(null);
  const [showForm, setShowForm] = useState(true);
  const inFlightRef = useRef(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inFlightRef.current = false;
    setForm(EMPTY_ADD_MEMBER_FORM);
    setErrors({});
    setPhotoDataUrl(null);
    setPhotoKey((key) => key + 1);
    setSubmitting(false);
    setSubmitError(null);
    setDuplicate(null);
    setResult(null);
    setShowForm(true);
  }, [open]);

  const set = <K extends keyof AddMemberForm>(key: K, value: AddMemberForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const ministries = form.apostolate ? getMinistriesForApostolate(form.apostolate) : [];

  const resetForAnother = () => {
    setForm((prev) => ({
      ...EMPTY_ADD_MEMBER_FORM,
      encounterType: prev.encounterType,
      classNumber: prev.classNumber,
      apostolate: prev.apostolate,
      ministry: prev.ministry,
      issueCard: prev.issueCard,
    }));
    setErrors({});
    setPhotoDataUrl(null);
    setPhotoKey((key) => key + 1);
    setShowForm(true);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  };

  const submit = async (addAnother: boolean, confirmNotDuplicate = false) => {
    if (inFlightRef.current) return;
    const nextErrors = validateAddMemberForm(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    inFlightRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setDuplicate(null);
    try {
      let member: Member;
      try {
        member = await membersService.adminCreate(toAdminCreateRequest(form, confirmNotDuplicate));
      } catch (err) {
        if (err instanceof AdminCreateDuplicateError) {
          setDuplicate(err);
          setPendingAddAnother(addAnother);
          return;
        }
        setSubmitError(err instanceof Error ? err.message : 'Failed to add member');
        return;
      }

      // The member exists from here on; photo / card failures never undo it.
      onMemberAdded(member);

      let photo: StepStatus = { state: 'skipped' };
      if (photoDataUrl) {
        try {
          await membersService.uploadMemberPhoto(member.id, photoDataUrl);
          photo = { state: 'done' };
        } catch (err) {
          photo = { state: 'failed', message: err instanceof Error ? err.message : 'Photo upload failed' };
        }
      }

      let card: StepStatus = { state: 'skipped' };
      if (form.issueCard) {
        try {
          const issued = await memberCardsService.issue([member.id]);
          const data = issued.data;
          if (issued.success && data?.issued?.some((row) => row.memberId === member.id)) {
            card = { state: 'done' };
          } else {
            const reason = data?.skipped?.find((row) => row.memberId === member.id)?.reason;
            card = { state: 'failed', message: reason || issued.error || 'Card was not issued' };
          }
        } catch (err) {
          card = { state: 'failed', message: getMemberApiErrorMessage(err, 'Card issue failed') };
        }
      }

      const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
      setResult({
        member,
        name,
        loginLocked: member.user?.adminActivationRequired === true || !member.user?.phone,
        photo,
        card,
      });
      if (addAnother) {
        resetForAnother();
      } else {
        setShowForm(false);
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (inFlightRef.current) return;
    onOpenChange(next);
  };

  const fieldError = (key: keyof AddMemberForm) =>
    errors[key] ? (
      <p id={`add-member-${key}-error`} className="mt-1 text-sm text-red-700" role="alert">
        {errors[key]}
      </p>
    ) : null;

  const describedBy = (key: keyof AddMemberForm, extra?: string) =>
    [errors[key] ? `add-member-${key}-error` : null, extra].filter(Boolean).join(' ') || undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto bg-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Add member</DialogTitle>
          <DialogDescription className="text-base text-gray-700">
            Creates the member with a Community ID and QR code right away. Only first name, last name,
            encounter type and class are required.
          </DialogDescription>
        </DialogHeader>

        {result ? <ResultPanel result={result} /> : null}

        {duplicate ? (
          <div
            role="alertdialog"
            aria-labelledby="add-member-dup-title"
            className={`rounded-lg border-2 p-4 ${
              duplicate.sameClass ? 'border-red-600 bg-red-50' : 'border-amber-500 bg-amber-50'
            }`}
          >
            <p id="add-member-dup-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              {duplicate.sameClass
                ? 'Same name AND same class — very likely already registered'
                : 'A member with this name is already registered'}
            </p>
            <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-base text-gray-900">
              <dt className="font-medium">Name</dt>
              <dd>
                {duplicate.possibleDuplicate.firstName} {duplicate.possibleDuplicate.lastName}
              </dd>
              <dt className="font-medium">Nickname</dt>
              <dd>{duplicate.possibleDuplicate.nickname || '—'}</dd>
              <dt className="font-medium">Community ID</dt>
              <dd className="font-mono">{duplicate.possibleDuplicate.communityId || '—'}</dd>
              <dt className="font-medium">Encounter</dt>
              <dd>
                {duplicate.possibleDuplicate.encounterType ?? '—'} {duplicate.possibleDuplicate.classNumber ?? ''}
              </dd>
            </dl>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-11 bg-purple-700 text-white hover:bg-purple-800"
                disabled={submitting}
                onClick={() => submit(pendingAddAnother, true)}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Different person — add anyway
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={submitting}
                onClick={() => setDuplicate(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {showForm && !duplicate ? (
          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
          >
            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={submitting}>
              <legend className="sr-only">Name</legend>
              <div>
                <Label htmlFor="add-member-firstName">First name *</Label>
                <Input
                  id="add-member-firstName"
                  ref={firstFieldRef}
                  className="h-11 text-base"
                  value={form.firstName}
                  aria-required
                  aria-invalid={!!errors.firstName}
                  aria-describedby={describedBy('firstName')}
                  onChange={(e) => set('firstName', e.target.value)}
                />
                {fieldError('firstName')}
              </div>
              <div>
                <Label htmlFor="add-member-lastName">Last name *</Label>
                <Input
                  id="add-member-lastName"
                  className="h-11 text-base"
                  value={form.lastName}
                  aria-required
                  aria-invalid={!!errors.lastName}
                  aria-describedby={describedBy('lastName')}
                  onChange={(e) => set('lastName', e.target.value)}
                />
                {fieldError('lastName')}
              </div>
              <div>
                <Label htmlFor="add-member-middleName">Middle name</Label>
                <Input
                  id="add-member-middleName"
                  className="h-11 text-base"
                  value={form.middleName}
                  onChange={(e) => set('middleName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="add-member-nickname">Nickname</Label>
                <Input
                  id="add-member-nickname"
                  className="h-11 text-base"
                  value={form.nickname}
                  aria-describedby={!form.nickname.trim() ? 'add-member-nickname-hint' : undefined}
                  onChange={(e) => set('nickname', e.target.value)}
                />
                {!form.nickname.trim() ? (
                  <p id="add-member-nickname-hint" className="mt-1 text-sm text-amber-700">
                    {NICKNAME_WARNING}
                  </p>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={submitting}>
              <legend className="sr-only">Encounter</legend>
              <div>
                <Label htmlFor="add-member-encounterType">Encounter type *</Label>
                <select
                  id="add-member-encounterType"
                  className={selectClass}
                  value={form.encounterType}
                  aria-required
                  aria-invalid={!!errors.encounterType}
                  aria-describedby={describedBy('encounterType')}
                  onChange={(e) => set('encounterType', e.target.value)}
                >
                  <option value="">Select…</option>
                  {ENCOUNTER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {fieldError('encounterType')}
              </div>
              <div>
                <Label htmlFor="add-member-classNumber">Class number *</Label>
                <Input
                  id="add-member-classNumber"
                  className="h-11 text-base"
                  inputMode="numeric"
                  maxLength={3}
                  value={form.classNumber}
                  aria-required
                  aria-invalid={!!errors.classNumber}
                  aria-describedby={describedBy('classNumber')}
                  onChange={(e) => set('classNumber', e.target.value.replace(/\D/g, ''))}
                />
                {fieldError('classNumber')}
              </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={submitting}>
              <legend className="sr-only">Details</legend>
              <div>
                <Label htmlFor="add-member-gender">Gender</Label>
                <select
                  id="add-member-gender"
                  className={selectClass}
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="add-member-civilStatus">Civil status</Label>
                <select
                  id="add-member-civilStatus"
                  className={selectClass}
                  value={form.civilStatus}
                  onChange={(e) => set('civilStatus', e.target.value)}
                >
                  <option value="">—</option>
                  {CIVIL_STATUSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="add-member-apostolate">Apostolate</Label>
                <select
                  id="add-member-apostolate"
                  className={selectClass}
                  value={form.apostolate}
                  onChange={(e) => {
                    const apostolate = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      apostolate,
                      ministry: getMinistriesForApostolate(apostolate).includes(prev.ministry) ? prev.ministry : '',
                    }));
                  }}
                >
                  <option value="">—</option>
                  {APOSTOLATES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="add-member-ministry">Ministry</Label>
                <select
                  id="add-member-ministry"
                  className={selectClass}
                  value={form.ministry}
                  disabled={!form.apostolate}
                  aria-invalid={!!errors.ministry}
                  aria-describedby={describedBy('ministry')}
                  onChange={(e) => set('ministry', e.target.value)}
                >
                  <option value="">{form.apostolate ? '—' : 'Select an apostolate first'}</option>
                  {ministries.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {fieldError('ministry')}
              </div>
              <div>
                <Label htmlFor="add-member-email">Email</Label>
                <Input
                  id="add-member-email"
                  type="email"
                  className="h-11 text-base"
                  autoComplete="off"
                  value={form.email}
                  aria-invalid={!!errors.email}
                  aria-describedby={describedBy('email')}
                  onChange={(e) => set('email', e.target.value)}
                />
                {fieldError('email')}
              </div>
              <div>
                <Label htmlFor="add-member-phone">Mobile (optional)</Label>
                <Input
                  id="add-member-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="09XXXXXXXXX"
                  className="h-11 text-base"
                  autoComplete="off"
                  value={form.phone}
                  aria-invalid={!!errors.phone}
                  aria-describedby={describedBy('phone', 'add-member-phone-help')}
                  onChange={(e) => set('phone', e.target.value)}
                />
                <p id="add-member-phone-help" className="mt-1 text-sm text-gray-600">
                  {MOBILE_HELP}
                </p>
                {fieldError('phone')}
              </div>
            </fieldset>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">ID photo (optional)</p>
              <IdPhotoUpload
                key={photoKey}
                flow="admin"
                accentColor="#7c3aed"
                onPhotoProcessed={(dataUrl) => setPhotoDataUrl(dataUrl)}
              />
            </div>

            <label className="flex min-h-11 items-center gap-3 text-base text-gray-900">
              <input
                type="checkbox"
                className="h-5 w-5 accent-purple-700"
                checked={form.issueCard}
                disabled={submitting}
                onChange={(e) => set('issueCard', e.target.checked)}
              />
              Issue ID card + QR now
            </label>

            {submitError ? (
              <p className="rounded-md bg-red-50 p-3 text-base text-red-800" role="alert">
                {submitError}
              </p>
            ) : null}

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-purple-700 text-purple-800"
                disabled={submitting}
                onClick={() => submit(true)}
              >
                Save &amp; add another
              </Button>
              <Button
                type="submit"
                className="min-h-11 bg-purple-700 text-white hover:bg-purple-800"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {submitting ? 'Saving…' : 'Add member'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {!showForm && !duplicate ? (
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={resetForAnother}>
              Add another
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-purple-700 text-white hover:bg-purple-800"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatusLine({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  const Icon = ok === false ? XCircle : ok ? CheckCircle2 : AlertTriangle;
  const color = ok === false ? 'text-red-700' : ok ? 'text-green-700' : 'text-amber-700';
  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function ResultPanel({ result }: { result: AddMemberResult }) {
  const retry = result.photo.state === 'failed' || result.card.state === 'failed';
  return (
    <section
      aria-live="polite"
      aria-label="Member added"
      className="rounded-lg border border-green-300 bg-green-50 p-4 text-base text-gray-900"
    >
      <p className="font-semibold">
        Added {result.name} — <span className="font-mono">{result.member.communityId}</span>
      </p>
      <ul className="mt-2 space-y-1">
        <StatusLine ok={result.loginLocked ? null : true}>
          {result.loginLocked
            ? 'Not activated — add a mobile in Edit to enable login'
            : 'Mobile set — member sets a password via Forgot Password'}
        </StatusLine>
        <StatusLine ok={result.photo.state === 'done' ? true : result.photo.state === 'failed' ? false : null}>
          {result.photo.state === 'done'
            ? 'Photo saved'
            : result.photo.state === 'failed'
              ? `Photo not saved: ${result.photo.message}`
              : 'No photo yet'}
        </StatusLine>
        <StatusLine ok={result.card.state === 'done' ? true : result.card.state === 'failed' ? false : null}>
          {result.card.state === 'done'
            ? 'ID card + QR issued'
            : result.card.state === 'failed'
              ? `Card not issued: ${result.card.message}`
              : 'Card not issued yet'}
        </StatusLine>
      </ul>
      {retry ? <p className="mt-2 font-medium text-red-800">Retry from Edit / Cards.</p> : null}
    </section>
  );
}

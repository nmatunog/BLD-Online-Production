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
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
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
import { SIGNUP_ENCOUNTER_TYPES } from '@/lib/member-constants';
import { parseAuthError } from '@/utils/error-handler';
import type { SignupResult, SignupSuggestion } from '@/types/api.types';
import { IdPhotoUpload } from '@/components/IdPhotoUpload';
import { generateStableMemberQR } from '@/lib/qr-service';
import { MemberIdCard } from '@/components/MemberIdCard';
import { deviceMemory } from '@/lib/device-memory';

/** BLD logo color peg extracted from brand mark */
const BLD = {
  red: '#D00008',
  redDark: '#A80006',
  redSoft: '#FCE8E9',
  redMuted: '#F5D0D2',
  ink: '#1A1A1A',
} as const;

const STEPS = ['Your name', 'Encounter', 'ID Photo'] as const;

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

function hasValidPhoto(photoUrl: string | null | undefined): boolean {
  if (!photoUrl) return false;
  const trimmed = photoUrl.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('data:image/') || trimmed.startsWith('http');
}

function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  // Accept 09xxxxxxxxx OR legacy +63/639 formats
  if (trimmed.length === 11 && trimmed.startsWith('09')) return true;
  if (trimmed.startsWith('+63') && trimmed.length >= 12) return true;
  if (trimmed.startsWith('639') && trimmed.length >= 11) return true;
  return false;
}

/**
 * Convert phone from +63XXXXXXXXXX / 63XXXXXXXXXX / 0XXXXXXXXXX to 09XXXXXXXXX
 * for pre-filling the input field.
 */
function normalizePhoneForInput(phone: string): string | null {
  const trimmed = phone.trim();
  
  // Already in 09XXXXXXXXX format
  if (trimmed.length === 11 && trimmed.startsWith('09')) {
    return trimmed;
  }
  
  // +63XXXXXXXXXX -> 09XXXXXXXXX
  if (trimmed.startsWith('+63')) {
    const digits = trimmed.slice(3);
    if (digits.length === 10) {
      return '0' + digits;
    }
  }
  
  // 63XXXXXXXXXX -> 09XXXXXXXXX
  if (trimmed.startsWith('63') && !trimmed.startsWith('639')) {
    const digits = trimmed.slice(2);
    if (digits.length === 10) {
      return '0' + digits;
    }
  }
  
  // 639XXXXXXXXX -> 09XXXXXXXXX
  if (trimmed.startsWith('639')) {
    const digits = trimmed.slice(2);
    if (digits.length === 10) {
      return digits;
    }
  }
  
  return null;
}

interface MemberAudit {
  profileGaps: string[]; // Name, encounter, class, photo - shown on edit card
  needsPhoto: boolean;
  needsPhone: boolean;
  needsEncounter: boolean;
  needsClass: boolean;
  needsFirstName: boolean;
  needsLastName: boolean;
}

function auditMemberFields(member: {
  firstName?: string;
  lastName?: string;
  encounterType?: string;
  classNumber?: number | string;
  photoUrl?: string | null;
  phone?: string | null;
}): MemberAudit {
  const profileGaps: string[] = [];
  
  const needsFirstName = !member.firstName?.trim();
  const needsLastName = !member.lastName?.trim();
  const needsEncounter = !member.encounterType?.trim();
  const needsClass = !member.classNumber || String(member.classNumber).trim() === '';
  const needsPhoto = !hasValidPhoto(member.photoUrl);
  const needsPhone = !isValidPhoneNumber(member.phone);
  
  if (needsFirstName) profileGaps.push('first name');
  if (needsLastName) profileGaps.push('last name');
  if (needsEncounter) profileGaps.push('encounter type');
  if (needsClass) profileGaps.push('class number');
  if (needsPhoto) profileGaps.push('ID photo');
  // Do NOT add phone to profileGaps - it's collected on login-setup screen
  
  return {
    profileGaps,
    needsPhoto,
    needsPhone,
    needsEncounter,
    needsClass,
    needsFirstName,
    needsLastName,
  };
}

function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showLoginSetup, setShowLoginSetup] = useState(false);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [encounterType, setEncounterType] = useState('');
  const [classNumber, setClassNumber] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [profileGaps, setProfileGaps] = useState<string[]>([]);

  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);

  const [suggestions, setSuggestions] = useState<SignupSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  const canContinueStep0 = lastName.trim().length > 0 && firstName.trim().length > 0;
  
  // Profile fields required for both new and existing members
  const canSaveProfile =
    canContinueStep0 &&
    encounterType.length > 0 &&
    classNumber.trim().length > 0;
  
  // New member submission requires phone
  const canSubmitNew =
    canSaveProfile &&
    signupPhone.trim().length === 11 &&
    signupPhone.startsWith('09');
  
  const hasIdPhoto = !!idPhoto;

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
    setShowLoginSetup(false);
    setStep(0);
    setLastName('');
    setFirstName('');
    setNickname('');
    setEncounterType('');
    setClassNumber('');
    setSignupPhone('');
    setIdPhoto(null);
    setOriginalPhotoUrl(null);
    setLoginPhone('');
    setLoginPassword('');
    setShowPassword(false);
    setNeedsPhone(false);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const applySuggestion = async (s: SignupSuggestion) => {
    setLastName(s.lastName);
    setFirstName(s.firstName);
    setNickname(s.nickname || '');
    setEncounterType(s.encounterType);
    setClassNumber(String(s.classNumber));
    setSuggestions([]);
    setShowSuggestions(false);
    setIsExisting(true);
    
    const resultData = {
      memberId: s.memberId,
      communityId: s.communityId,
      firstName: s.firstName,
      lastName: s.lastName,
      nickname: s.nickname,
      encounterType: s.encounterType,
      classNumber: s.classNumber,
      isExistingMember: true,
      message: 'Your account already exists',
    };
    setResult(resultData);
    
    deviceMemory.rememberMember({
      communityId: s.communityId,
      memberId: s.memberId,
      firstName: s.firstName,
      lastName: s.lastName,
      nickname: s.nickname,
      role: 'MEMBER',
    });
    
    let photoUrl: string | null = null;
    let phone: string | null = null;
    
    try {
      const { apiClient } = await import('@/services/api-client');
      const response = await apiClient.get<{ 
        success: boolean; 
        data: { 
          photoUrl?: string | null;
          user?: { phone?: string | null };
        } 
      }>(`/members/public/community/${s.communityId}`);
      
      if (response.data.success) {
        photoUrl = response.data.data?.photoUrl || null;
        phone = response.data.data?.user?.phone || null;
      }
    } catch (error) {
      console.error('Failed to fetch member details:', error);
      // Continue with null photo/phone
    }
    
    setIdPhoto(photoUrl);
    setOriginalPhotoUrl(photoUrl);
    
    // Convert phone to 09XXXXXXXXX format if present
    if (phone) {
      const normalized = normalizePhoneForInput(phone);
      if (normalized) {
        setSignupPhone(normalized);
      }
    }
    
    // Audit profile fields (name, encounter, class, photo)
    const audit = auditMemberFields({
      firstName: s.firstName,
      lastName: s.lastName,
      encounterType: s.encounterType,
      classNumber: s.classNumber,
      photoUrl,
      phone,
    });
    
    setProfileGaps(audit.profileGaps);
    setNeedsPhone(audit.needsPhone);
    
    if (audit.profileGaps.length > 0) {
      // Has profile gaps - enter edit mode with banner
      setIsEditing(true);
      
      toast.info('Profile Incomplete', {
        description: `We still need: ${audit.profileGaps.join(', ')}. Please complete these required fields.`,
        duration: 7000,
      });
    } else if (audit.needsPhone) {
      // Only phone is missing - skip edit mode, go straight to login-setup
      setIsEditing(false);
      setShowLoginSetup(true);
      
      toast.info('Mobile Number Required', {
        description: 'Please enter your Philippine mobile number (09xxxxxxxxx) to complete your profile.',
        duration: 6000,
      });
    } else {
      // All fields present
      setIsEditing(false);
      
      toast.success('Your account loaded', {
        description: `Community ID: ${s.communityId}. You can now edit details or set up login.`,
        duration: 5000,
      });
    }
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

  const handlePrintId = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Generate stable QR code for check-in
  // The QR encodes only the Community ID (e.g., "CEB-ME1802") so it's stable for printing.
  // The check-in scanner at /checkin/[eventId] uses qrUtils.extractMemberData() which
  // accepts plain Community ID strings, then looks up the member and checks them in.
  useEffect(() => {
    if (result?.communityId) {
      generateStableMemberQR(result.communityId, { width: 300, margin: 1 })
        .then(setQrCode)
        .catch(console.error);
    }
  }, [result?.communityId]);

  const showExistingAccount = async (existing: SignupResult) => {
    setResult(existing);
    setIsExisting(true);
    setLastName(existing.lastName);
    setFirstName(existing.firstName);
    setNickname(existing.nickname || '');
    setEncounterType(existing.encounterType);
    setClassNumber(String(existing.classNumber));
    
    const photoUrl = existing.photoUrl || null;
    setIdPhoto(photoUrl);
    setOriginalPhotoUrl(photoUrl);
    
    deviceMemory.rememberMember({
      communityId: existing.communityId,
      memberId: existing.memberId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      nickname: existing.nickname,
      role: 'MEMBER',
    });
    
    // Fetch real phone data from public endpoint
    let phone: string | null = null;
    try {
      const { apiClient } = await import('@/services/api-client');
      const response = await apiClient.get<{ 
        success: boolean; 
        data: { user?: { phone?: string | null } }
      }>(`/members/public/community/${existing.communityId}`);
      
      if (response.data.success) {
        phone = response.data.data?.user?.phone || null;
      }
    } catch (error) {
      console.error('Failed to fetch member phone:', error);
    }
    
    // Convert phone to 09XXXXXXXXX format if present
    if (phone) {
      const normalized = normalizePhoneForInput(phone);
      if (normalized) {
        setSignupPhone(normalized);
      }
    }
    
    // Audit profile fields (name, encounter, class, photo)
    const audit = auditMemberFields({
      firstName: existing.firstName,
      lastName: existing.lastName,
      encounterType: existing.encounterType,
      classNumber: existing.classNumber,
      photoUrl,
      phone,
    });
    
    setProfileGaps(audit.profileGaps);
    setNeedsPhone(audit.needsPhone);
    
    if (audit.profileGaps.length > 0) {
      // Has profile gaps - enter edit mode with banner
      setIsEditing(true);
      
      toast.info('Profile Incomplete', {
        description: `We still need: ${audit.profileGaps.join(', ')}. Please complete these required fields.`,
        duration: 7000,
      });
    } else if (audit.needsPhone) {
      // Only phone is missing - skip edit mode, go straight to login-setup
      setIsEditing(false);
      setShowLoginSetup(true);
      
      toast.info('Mobile Number Required', {
        description: 'Please enter your Philippine mobile number (09xxxxxxxxx) to complete your profile.',
        duration: 6000,
      });
    } else {
      // All fields present
      setIsEditing(false);
      
      toast.success('Your account loaded', {
        description: `Community ID: ${existing.communityId}. You can now edit details or set up login.`,
        duration: 5000,
      });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmitNew || !idPhoto) {
      toast.error(
        !idPhoto ? 'ID photo is required' : 'Please complete the required fields',
        {
          description: !idPhoto
            ? 'Take or upload a face photo for your Community ID card.'
            : !signupPhone.trim()
              ? 'Philippine mobile number is required'
              : signupPhone.trim().length !== 11 || !signupPhone.startsWith('09')
                ? 'Phone must be 11 digits starting with 09'
                : undefined,
        },
      );
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
        phone: signupPhone.trim(),
        idPhoto,
      });
      setResult(data);
      setIsExisting(false);
      setIsEditing(false);
      setNeedsPhone(false);
      setOriginalPhotoUrl(data.photoUrl || null);
      
      deviceMemory.rememberMember({
        communityId: data.communityId,
        memberId: data.memberId,
        firstName: data.firstName,
        lastName: data.lastName,
        nickname: data.nickname,
        role: 'MEMBER',
      });
      
      setShowLoginSetup(true);
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
    if (!result) return;
    
    // Validate only profile fields (name, encounter, class, photo) - NOT phone
    const currentAudit = auditMemberFields({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      encounterType: encounterType.trim(),
      classNumber: classNumber.trim(),
      photoUrl: idPhoto,
      phone: '09999999999', // Dummy phone to skip phone validation here
    });
    
    if (currentAudit.profileGaps.length > 0) {
      toast.error('Required fields missing', {
        description: `Please complete: ${currentAudit.profileGaps.join(', ')}`,
        duration: 6000,
      });
      return;
    }
    
    if (!canSaveProfile || !idPhoto) {
      toast.error(
        !idPhoto ? 'ID photo is required' : 'Please complete the required fields',
        {
          description: !idPhoto
            ? 'Take or upload a face photo with a plain light or white wall background for your Community ID card.'
            : undefined,
        },
      );
      return;
    }

    setIsLoading(true);
    try {
      const isNewPhoto = idPhoto.startsWith('data:image/');
      const data = await authService.updateSignup({
        memberId: result.memberId,
        communityId: result.communityId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || undefined,
        encounterType,
        classNumber: classNumber.trim(),
        idPhoto: isNewPhoto ? idPhoto : undefined,
        // Do NOT send phone here - it's collected on login-setup screen
      });
      setResult(data);
      setIsExisting(true);
      setIsEditing(false);
      setProfileGaps([]);
      if (data.photoUrl) {
        setIdPhoto(data.photoUrl);
        setOriginalPhotoUrl(data.photoUrl);
      }
      toast.success('Details saved');
      
      // After successful save, check if phone is still missing
      if (needsPhone) {
        setShowLoginSetup(true);
      }
    } catch (error) {
      const existing = extractExistingFromError(error);
      if (existing && existing.memberId !== result.memberId) {
        await showExistingAccount(existing);
      } else {
        const parsed = parseAuthError(error);
        toast.error(parsed.title, { description: parsed.message, duration: 6000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSetupSubmit = async () => {
    if (!result) return;

    const trimmedPhone = loginPhone.trim();
    const trimmedPassword = loginPassword.trim();

    if (needsPhone && !trimmedPhone) {
      toast.error('Mobile number required', {
        description: 'You must enter a Philippine mobile number to complete your profile',
      });
      return;
    }

    if (needsPhone && trimmedPhone) {
      if (trimmedPhone.length !== 11 || !trimmedPhone.startsWith('09')) {
        toast.error('Invalid phone format', {
          description: 'Phone must be 11 digits starting with 09 (e.g., 09209648523)',
        });
        return;
      }
    }

    if (trimmedPassword && needsPhone && !trimmedPhone) {
      toast.error('Mobile number required', {
        description: 'You must enter a mobile number when setting a password',
      });
      return;
    }

    if (!needsPhone && !trimmedPassword) {
      setShowLoginSetup(false);
      toast.success('Setup complete', {
        description: 'You can set a password later via Forgot Password',
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.updateSignup({
        memberId: result.memberId,
        communityId: result.communityId,
        firstName: result.firstName,
        lastName: result.lastName,
        nickname: result.nickname || undefined,
        encounterType: result.encounterType,
        classNumber: String(result.classNumber),
        phone: needsPhone ? trimmedPhone : undefined,
        password: trimmedPassword || undefined,
      });

      toast.success('Login setup saved', {
        description: trimmedPhone
          ? `You can now log in with ${trimmedPhone}${trimmedPassword ? ' and your password' : ' (set password later via Forgot Password)'}`
          : trimmedPassword
            ? 'Password saved. Use Forgot Password to update it later.'
            : 'Details saved',
      });

      setShowLoginSetup(false);
      setLoginPhone('');
      setLoginPassword('');
      setShowPassword(false);
      setNeedsPhone(false);
    } catch (error) {
      const parsed = parseAuthError(error);
      toast.error(parsed.title, { description: parsed.message, duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipLoginSetup = () => {
    setShowLoginSetup(false);
    setLoginPhone('');
    setLoginPassword('');
    setShowPassword(false);
  };

  if (result) {
    if (showLoginSetup) {
      return (
        <Card className="w-full max-w-md mx-auto p-5 sm:p-8 rounded-2xl shadow-xl relative z-10 bg-white border-2 border-[#D00008]/25 overflow-hidden">
          <div className="h-1.5 w-full absolute top-0 left-0 right-0 bg-[#D00008]" />
          <div className="text-center mb-6 pt-2">
            <BrandLogo size={72} />
            <h1 className="text-2xl sm:text-3xl font-bold text-[#D00008] mt-4 mb-2">
              {needsPhone ? 'Complete Your Profile' : 'Set a Password (Optional)'}
            </h1>
            <p className="text-base sm:text-lg text-gray-700">
              {needsPhone
                ? 'Enter your Philippine mobile number (required) and optionally set a password.'
                : 'You can set a password now or skip and set it later via Forgot Password.'}
            </p>
          </div>

          <div className="space-y-5 mb-6">
            {needsPhone && (
              <div>
                <Label htmlFor="loginPhone" className={labelClass}>
                  Philippine Mobile Number <span className="text-[#D00008]">*</span>
                </Label>
                <Input
                  id="loginPhone"
                  type="tel"
                  className={fieldClass}
                  placeholder="09209648523"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  inputMode="tel"
                  maxLength={11}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Format: 09 followed by 9 digits. This will be your login ID.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="loginPassword" className={labelClass}>
                Password <span className="text-gray-500 font-normal text-base">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={fieldClass}
                  placeholder="Choose a password (6+ characters)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {loginPassword.trim()
                  ? needsPhone ? 'Password is optional' : 'You can change this later via Forgot Password'
                  : 'Skip password now and set it later via Forgot Password'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className={`w-full ${primaryBtn}`}
              disabled={isLoading || (needsPhone && !loginPhone.trim())}
              onClick={handleLoginSetupSubmit}
            >
              {isLoading ? 'Saving…' : needsPhone ? 'Save' : loginPassword.trim() ? 'Set Password' : 'Skip'}
            </Button>

            {!needsPhone && (
              <Button
                type="button"
                variant="outline"
                className={`w-full ${outlineBtn}`}
                onClick={handleSkipLoginSetup}
                disabled={isLoading}
              >
                Skip for now
              </Button>
            )}
          </div>

          <p className="text-center text-sm text-gray-600 mt-4">
            {needsPhone
              ? 'Mobile number is required. Password can be set later via Forgot Password.'
              : 'You can set a password later. Your Community ID is ready for attendance and QR check-in.'}
          </p>
        </Card>
      );
    }

    if (showPrintView) {
      return (
        <div className="print-view-container">
          <div className="no-print">
            <Button
              type="button"
              variant="outline"
              className="mb-4"
              onClick={() => setShowPrintView(false)}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Result
            </Button>
          </div>
          <MemberIdCard
            communityId={result.communityId}
            firstName={result.firstName}
            lastName={result.lastName}
            nickname={result.nickname || undefined}
            photoUrl={idPhoto}
          />
        </div>
      );
    }

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
          <p className="text-base uppercase tracking-wide font-semibold mb-3 text-[#A80006]">
            Your Community ID
          </p>
          {qrCode && (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="Community ID QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg"
              />
            </div>
          )}
          <p className="text-2xl sm:text-3xl font-mono font-bold break-all text-[#1A1A1A] mb-4">
            {result.communityId}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-12 text-lg w-full sm:w-auto border-[#D00008] text-[#D00008]"
            onClick={handleCopyCommunityId}
          >
            <ClipboardCopy className="w-5 h-5 mr-2" />
            Copy ID
          </Button>
        </div>

        {/* Device memory status */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800 text-center">
            {deviceMemory.getDisplayText()}
            {' · '}
            <button
              type="button"
              onClick={() => {
                deviceMemory.clearRememberedMember();
                toast.success('Device cleared', {
                  description: 'This phone no longer remembers your identity',
                });
                router.push('/signup');
              }}
              className="text-blue-700 underline font-semibold hover:text-blue-900"
            >
              Not you?
            </button>
          </p>
        </div>

        {isEditing ? (
          <div className="space-y-4 mb-6 text-left">
            {profileGaps.length > 0 && (
              <div className="mb-4 rounded-xl border-2 border-[#D00008]/30 bg-[#FCE8E9] p-4">
                <p className="text-base font-semibold text-[#A80006] mb-2">
                  Profile Incomplete
                </p>
                <p className="text-sm text-gray-700">
                  We still need: <strong>{profileGaps.join(', ')}</strong>
                </p>
              </div>
            )}
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
              <Label htmlFor="editEncounter" className={labelClass}>
                Encounter type <span className="text-[#D00008]">*</span>
              </Label>
              <Select value={encounterType} onValueChange={setEncounterType}>
                <SelectTrigger
                  id="editEncounter"
                  className="mt-2 h-14 w-full text-lg rounded-xl border-2 border-gray-300 focus:border-[#D00008] focus:ring-[#D00008]"
                >
                  <SelectValue placeholder="Select encounter" />
                </SelectTrigger>
                <SelectContent>
                  {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-lg">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <IdPhotoUpload
              onPhotoProcessed={setIdPhoto}
              currentPhoto={idPhoto}
              accentColor={BLD.red}
              required
            />
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
            {idPhoto && (
              <div className="pt-2">
                <p className="font-semibold mb-2">ID photo:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={idPhoto}
                  alt="ID photo"
                  className="w-24 h-24 rounded-xl object-cover border-2 border-[#D00008]"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {isEditing ? (
            <Button
              type="button"
              className={`w-full ${primaryBtn}`}
              disabled={isLoading || !canSaveProfile || !hasIdPhoto}
              onClick={handleSaveEdit}
            >
              {isLoading ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className={`w-full ${primaryBtn}`}
                onClick={handlePrintId}
              >
                <Printer className="w-5 h-5 mr-2" />
                Print ID Card
              </Button>
              <Button
                type="button"
                className={`w-full ${primaryBtn}`}
                onClick={() => setIsEditing(true)}
              >
                Edit details
              </Button>
              <Button
                type="button"
                className={`w-full ${outlineBtn}`}
                onClick={() => setShowLoginSetup(true)}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Set up login
              </Button>
            </>
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

      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6">
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
            <Label htmlFor="wizardEncounter" className={labelClass}>
              Encounter type <span className="text-[#D00008]">*</span>
            </Label>
            <Select value={encounterType} onValueChange={setEncounterType}>
              <SelectTrigger
                id="wizardEncounter"
                className="mt-3 h-14 w-full text-lg sm:text-xl rounded-xl border-2 border-gray-300 focus:border-[#D00008] focus:ring-[#D00008]"
              >
                <SelectValue placeholder="Select encounter" />
              </SelectTrigger>
              <SelectContent>
                {SIGNUP_ENCOUNTER_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-lg sm:text-xl">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div>
            <Label htmlFor="signupPhone" className={labelClass}>
              Philippine Mobile Number <span className="text-[#D00008]">*</span>
            </Label>
            <Input
              id="signupPhone"
              type="tel"
              className={fieldClass}
              inputMode="tel"
              placeholder="09209648523"
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={11}
            />
            <p className="text-sm text-gray-500 mt-1">
              Format: 09 followed by 9 digits. This will be your login ID.
            </p>
          </div>
          <p className="text-base text-gray-500">
            Location defaults to Cebu. Password can be set after signup.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {profileGaps.includes('ID photo') && (
            <div className="mb-4 rounded-xl border-2 border-[#D00008]/30 bg-[#FCE8E9] p-4">
              <p className="text-base font-semibold text-[#A80006] mb-2">
                ID Photo Required
              </p>
              <p className="text-sm text-gray-700">
                Your profile is missing an ID photo. Please take or upload a photo with a <strong>plain light or white wall background</strong>. This photo will appear on your Community ID card.
              </p>
            </div>
          )}
          <IdPhotoUpload
            onPhotoProcessed={setIdPhoto}
            currentPhoto={idPhoto}
            accentColor={BLD.red}
            required
          />
          {!idPhoto && (
            <p className="text-sm text-[#D00008]">
              Take or upload a photo to continue. Use a plain light or white wall background for best results.
            </p>
          )}
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
        ) : step === 1 ? (
          <Button
            type="button"
            className={`ml-auto ${primaryBtn}`}
            disabled={!canSubmitNew}
            onClick={() => setStep(2)}
          >
            Next
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            className={`ml-auto ${primaryBtn}`}
            disabled={isLoading || !canSubmitNew || !hasIdPhoto}
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

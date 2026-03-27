'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { User, Phone, Hash, ArrowLeft, ArrowRight, Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { normalizePhoneNumber } from '@/utils/phone.util';

const verifyIdentitySchema = z.object({
  lastName: z.string().min(2, 'Last name is required'),
  phone: z.string().min(10, 'Mobile number is required'),
  encounterNumber: z
    .string()
    .regex(/^\d{1,3}$/, 'Encounter number must be numeric (e.g., 18 or 101)'),
});

const setPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type VerifyIdentityValues = z.infer<typeof verifyIdentitySchema>;
type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyIdentityValues>({
    resolver: zodResolver(verifyIdentitySchema),
    defaultValues: {
      lastName: '',
      phone: '',
      encounterNumber: '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onVerifyIdentity = async (data: VerifyIdentityValues) => {
    setIsVerifying(true);
    try {
      const normalizedPhone = normalizePhoneNumber(data.phone);
      if (!normalizedPhone) {
        toast.error('Invalid mobile number', {
          description: 'Please enter a valid Philippine mobile number.',
        });
        return;
      }

      const result = await authService.requestPasswordReset({
        lastName: data.lastName.trim(),
        phone: normalizedPhone,
        encounterNumber: data.encounterNumber.trim(),
      });
      if (result.resetToken) {
        setVerifiedToken(result.resetToken);
        toast.success('Identity verified', {
          description: 'Enter your new password below.',
        });
      } else {
        toast.error('Verification failed', {
          description: 'Could not verify identity. Please check your details and try again.',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify identity';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const onResetPassword = async (data: SetPasswordValues) => {
    if (!verifiedToken) return;
    setIsResetting(true);
    try {
      await authService.resetPassword({
        token: verifiedToken,
        password: data.password,
      });
      setIsSuccess(true);
      toast.success('Password updated', {
        description: 'You can now log in with your new password.',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl border-2 border-purple-100">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Forgot Password
          </CardTitle>
          <CardDescription className="text-lg">
            {isSuccess
              ? 'Password reset complete'
              : verifiedToken
                ? 'Set your new password'
                : 'Verify using last name, mobile number, and encounter number'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Password changed successfully</h3>
                <p className="text-sm text-gray-600">Please sign in using your new password.</p>
              </div>
              <Link href="/login">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </div>
          ) : !verifiedToken ? (
            <form onSubmit={handleSubmit(onVerifyIdentity)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-base font-semibold">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Your last name"
                    className="pl-10 h-12 text-lg"
                    {...register('lastName')}
                    disabled={isVerifying}
                  />
                </div>
                {errors.lastName && <p className="text-sm text-red-600">{errors.lastName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base font-semibold">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09XXXXXXXXX"
                    className="pl-10 h-12 text-lg"
                    {...register('phone')}
                    disabled={isVerifying}
                  />
                </div>
                {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="encounterNumber" className="text-base font-semibold">Encounter Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="encounterNumber"
                    type="text"
                    placeholder="e.g. 18 or 101"
                    className="pl-10 h-12 text-lg"
                    {...register('encounterNumber')}
                    disabled={isVerifying}
                  />
                </div>
                {errors.encounterNumber && <p className="text-sm text-red-600">{errors.encounterNumber.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg"
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Identity
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitPassword(onResetPassword)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-semibold">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    className="pl-10 pr-10 h-12 text-lg"
                    {...registerPassword('password')}
                    disabled={isResetting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordErrors.password && <p className="text-sm text-red-600">{passwordErrors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-base font-semibold">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    className="pl-10 pr-10 h-12 text-lg"
                    {...registerPassword('confirmPassword')}
                    disabled={isResetting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg"
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    Save New Password
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setVerifiedToken(null);
                    resetPasswordForm();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Start Over
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


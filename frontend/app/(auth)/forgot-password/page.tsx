'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Phone, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';

const forgotPasswordSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
}).refine((data) => {
  const hasEmail = data.email && data.email.trim().length > 0;
  const hasPhone = data.phone && data.phone.trim().length > 0;
  return hasEmail || hasPhone;
}, {
  message: 'Either email or phone is required',
  path: ['email'],
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
      phone: '',
    },
  });

  const emailValue = watch('email');
  const phoneValue = watch('phone');

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      const requestData: { email?: string; phone?: string } = {};
      
      if (authMethod === 'email' && data.email) {
        requestData.email = data.email.trim();
      } else if (authMethod === 'phone' && data.phone) {
        requestData.phone = data.phone.trim();
      }

      const result = await authService.requestPasswordReset(requestData);
      setIsSubmitted(true);
      
      // If reset link is provided (dev mode), store it
      if (result.resetLink) {
        setResetLink(result.resetLink);
        toast.success('Password Reset Link Generated', {
          description: 'A password reset link has been generated. Click the link below to reset your password.',
        });
      } else {
        toast.success('Password Reset Requested', {
          description: 'If an account exists with that email or phone, a password reset link has been sent.',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request password reset';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
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
            Enter your email or phone number to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubmitted ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Auth Method Toggle */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('email');
                    setValue('phone', '');
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMethod === 'email'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('phone');
                    setValue('email', '');
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMethod === 'phone'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone
                </button>
              </div>

              {/* Email Input */}
              {authMethod === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-semibold">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      className="pl-10 h-12 text-lg"
                      {...register('email')}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
              )}

              {/* Phone Input */}
              {authMethod === 'phone' && (
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-semibold">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="09XX XXX XXXX"
                      className="pl-10 h-12 text-lg"
                      {...register('phone')}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link
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
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {resetLink ? 'Password Reset Link Generated' : `Check Your ${authMethod === 'email' ? 'Email' : 'Phone'}`}
                </h3>
                {resetLink ? (
                  <>
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-yellow-800 font-semibold mb-1">
                        ⚠️ Development Mode
                      </p>
                      <p className="text-xs text-yellow-700">
                        Email/SMS is not configured. The reset link is shown below instead of being sent.
                      </p>
                    </div>
                    <p className="text-gray-600 mb-4">
                      A password reset link has been generated. Click the link below to reset your password.
                    </p>
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
                      <p className="text-xs text-gray-600 mb-2 font-semibold">Reset Link:</p>
                      <a
                        href={resetLink}
                        className="text-sm text-purple-600 hover:text-purple-800 break-all underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {resetLink}
                      </a>
                    </div>
                    <p className="text-xs text-gray-500">
                      This link will expire in 15 minutes.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">
                      If an account exists with that {authMethod === 'email' ? 'email' : 'phone number'}, 
                      a password reset link has been sent.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Please check your {authMethod === 'email' ? 'inbox' : 'messages'} and follow the instructions 
                      to reset your password.
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-3">
                {resetLink && (
                  <Link href={resetLink}>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white">
                      Go to Reset Password Page
                    </Button>
                  </Link>
                )}
                <Button
                  onClick={() => {
                    setIsSubmitted(false);
                    setResetLink(null);
                    setValue('email', '');
                    setValue('phone', '');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Request Another Link
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Phone, LogIn } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const emailValue = watch('email');
  const phoneValue = watch('phone');
  const passwordValue = watch('password');

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await authService.login({
        email: data.email || undefined,
        phone: data.phone || undefined,
        password: data.password,
      });

      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23000000\" fill-opacity=\"0.1\"%3E%3Cpath d=\"M30 0l15 15-15 15-15-15z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      
      <Card className="p-8 rounded-2xl shadow-xl max-w-md w-full relative z-10 bg-white border-2 border-gray-400 shadow-gray-200">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gray-100 text-gray-600">
            <LogIn className="w-8 h-8" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2 text-red-700">
            BLD Cebu Community Online Portal
          </h1>
          
          <div className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-red-800 border border-gray-300">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
            </svg>
            Welcome Back
          </div>
          
          <p className="text-sm mt-3 text-red-600">
            Sign in to access your dashboard and manage events
          </p>
        </div>

        {/* Authentication Method Choice */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setAuthMethod('email')}
              className={`w-full border-2 rounded-xl p-3 sm:p-4 lg:p-5 text-left transition shadow-sm hover:shadow-md focus:outline-none ${
                authMethod === 'email'
                  ? 'border-red-400 bg-gray-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 flex-shrink-0 ${
                  authMethod === 'email' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <Mail size={20} className="text-red-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base sm:text-lg truncate text-gray-800">
                    Sign in with Email
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 line-clamp-2">Use your email address and a password</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod('phone')}
              className={`w-full border-2 rounded-xl p-3 sm:p-4 lg:p-5 text-left transition shadow-sm hover:shadow-md focus:outline-none ${
                authMethod === 'phone'
                  ? 'border-red-400 bg-gray-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 flex-shrink-0 ${
                  authMethod === 'phone' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <Phone size={20} className="text-red-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base sm:text-lg truncate text-gray-800">
                    Sign in with Mobile
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 line-clamp-2">Use your mobile number and a password</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authMethod === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium text-gray-800">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className={`pl-10 pr-10 py-3 text-lg ${
                    errors.email ? 'border-red-500' : 'border-gray-400'
                  }`}
                  {...register('email')}
                  disabled={isLoading}
                />
                {emailValue && !errors.email && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base font-medium text-gray-800">
                Mobile Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  className={`pl-10 pr-10 py-3 text-lg ${
                    errors.phone ? 'border-red-500' : 'border-gray-400'
                  }`}
                  {...register('phone')}
                  disabled={isLoading}
                />
                {phoneValue && !errors.phone && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base font-medium text-gray-800">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className={`pl-10 pr-10 py-3 text-lg ${
                  errors.password ? 'border-red-500' : 'border-gray-400'
                }`}
                {...register('password')}
                disabled={isLoading}
              />
              {passwordValue && !errors.password && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-red-600 hover:text-red-800 hover:underline">
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-800 hover:bg-red-900 text-white py-4 px-5 text-lg rounded-xl shadow-lg hover:shadow-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              'Sign In'
            )}
          </Button>

          <div className="text-center text-sm">
            Don't have an account?{' '}
            <Link href="/register" className="text-red-600 hover:text-red-800 hover:underline font-medium">
              Create Account
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

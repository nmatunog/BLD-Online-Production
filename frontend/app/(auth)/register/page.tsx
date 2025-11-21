'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Phone, UserPlus } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const registerSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional().or(z.literal('')),
  nickname: z.string().optional().or(z.literal('')),
  city: z.string().min(1, 'City is required'),
  encounterType: z.string().min(1, 'Encounter type is required'),
  classNumber: z.string().min(1, 'Class number is required').regex(/^\d+$/, 'Class number must be numeric'),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const emailValue = watch('email');
  const phoneValue = watch('phone');
  const passwordValue = watch('password');

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      await authService.register({
        email: data.email || undefined,
        phone: data.phone || undefined,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || undefined,
        nickname: data.nickname || undefined,
        city: data.city,
        encounterType: data.encounterType,
        classNumber: data.classNumber,
      });

      toast.success('Registration successful! Redirecting...');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>
      
      <Card className="p-8 rounded-2xl shadow-xl max-w-2xl w-full relative z-10 bg-white border-2 border-purple-200 shadow-purple-100">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-purple-100 text-purple-600">
            <UserPlus className="w-8 h-8" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2 text-purple-700">
            BLD Cebu Community Online Portal
          </h1>
          
          <div className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-purple-50 text-purple-800 border border-purple-200">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Account
          </div>
          
          <p className="text-sm mt-3 text-purple-600">
            Create your Account using your email or mobile number
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
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 flex-shrink-0 ${
                  authMethod === 'email' ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                  <Mail size={20} className="text-purple-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base sm:text-lg truncate text-purple-800">
                    Sign up with Email
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
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 flex-shrink-0 ${
                  authMethod === 'phone' ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                  <Phone size={20} className="text-purple-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base sm:text-lg truncate text-purple-800">
                    Sign up with Mobile
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 line-clamp-2">Use your mobile number and a password</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-base font-medium text-gray-800">
                First Name *
              </Label>
              <Input
                id="firstName"
                {...register('firstName')}
                disabled={isLoading}
                className="py-3 text-lg"
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-base font-medium text-gray-800">
                Last Name *
              </Label>
              <Input
                id="lastName"
                {...register('lastName')}
                disabled={isLoading}
                className="py-3 text-lg"
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="middleName" className="text-base font-medium text-gray-800">
                Middle Name
              </Label>
              <Input
                id="middleName"
                {...register('middleName')}
                disabled={isLoading}
                className="py-3 text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-base font-medium text-gray-800">
                Nickname
              </Label>
              <Input
                id="nickname"
                {...register('nickname')}
                disabled={isLoading}
                className="py-3 text-lg"
              />
            </div>
          </div>

          {authMethod === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium text-gray-800">
                Email Address *
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className={`pl-10 pr-10 py-3 text-lg ${
                    errors.email ? 'border-red-500' : 'border-purple-300'
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
                Mobile Number *
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  className={`pl-10 pr-10 py-3 text-lg ${
                    errors.phone ? 'border-red-500' : 'border-purple-300'
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-medium text-gray-800">
                Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`pl-10 pr-10 py-3 text-lg ${
                    errors.password ? 'border-red-500' : 'border-purple-300'
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base font-medium text-gray-800">
                Confirm Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`pl-10 py-3 text-lg ${
                    errors.confirmPassword ? 'border-red-500' : 'border-purple-300'
                  }`}
                  {...register('confirmPassword')}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-base font-medium text-gray-800">
                City *
              </Label>
              <Input
                id="city"
                placeholder="CEB"
                className="py-3 text-lg"
                {...register('city')}
                disabled={isLoading}
              />
              {errors.city && (
                <p className="text-sm text-red-600">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="encounterType" className="text-base font-medium text-gray-800">
                Encounter Type *
              </Label>
              <Input
                id="encounterType"
                placeholder="ME, SE, SPE, YE"
                className="py-3 text-lg"
                {...register('encounterType')}
                disabled={isLoading}
              />
              {errors.encounterType && (
                <p className="text-sm text-red-600">{errors.encounterType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="classNumber" className="text-base font-medium text-gray-800">
                Class Number *
              </Label>
              <Input
                id="classNumber"
                type="text"
                placeholder="18"
                className="py-3 text-lg"
                {...register('classNumber')}
                disabled={isLoading}
              />
              {errors.classNumber && (
                <p className="text-sm text-red-600">{errors.classNumber.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 px-5 text-lg rounded-xl shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Account
              </>
            )}
          </Button>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-600 hover:text-purple-800 hover:underline font-medium">
              Sign In
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

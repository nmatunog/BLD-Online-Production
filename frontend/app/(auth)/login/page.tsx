'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Phone, LogIn, MessageSquare, Sparkles } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import ChatbotSignUp, { ChatbotSignUpHandle } from '@/components/chatbot/ChatbotSignUp';
import { normalizePhoneNumber } from '@/utils/phone.util';
import { parseAuthError } from '@/utils/error-handler';
import { ThemeToggle } from '@/components/theme-toggle';

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, 'Email or mobile number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const chatbotRef = useRef<ChatbotSignUpHandle>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrPhone: '',
      password: '',
    },
  });

  const emailOrPhoneValue = watch('emailOrPhone');
  const passwordValue = watch('password');

  // Auto-open chatbot in sign-in mode on page load - DISABLED for faster loading
  // useEffect(() => {
  //   // Prevent immediate re-open if the user intentionally closes it within the first render
  //   const timer = setTimeout(() => {
  //     setShowChatbotPromo(false);
  //     chatbotRef.current?.open();
  //   }, 200); // small delay to avoid layout shift
  //   return () => clearTimeout(timer);
  // }, []);

  // Helper function to detect if input is email or phone
  const detectInputType = (value: string): 'email' | 'phone' | null => {
    if (!value || value.trim().length === 0) return null;
    
    // Check if it looks like an email (contains @)
    if (value.includes('@')) {
      return 'email';
    }
    
    // Check if it looks like a phone number (contains digits)
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      return 'phone';
    }
    
    // Default to phone for mobile-first approach
    return 'phone';
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      // Detect if input is email or phone
      const inputType = detectInputType(data.emailOrPhone);
      
      if (!inputType) {
        toast.error('Input Required', {
          description: 'Please enter your email address or mobile number',
        });
        setIsLoading(false);
        return;
      }

      // Prepare login data based on detected input type
      const loginData: { email?: string; phone?: string; password: string } = {
        password: data.password,
      };

      if (inputType === 'email') {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.emailOrPhone.trim())) {
          toast.error('Invalid Email', {
            description: 'Please enter a valid email address',
          });
          setIsLoading(false);
          return;
        }
        loginData.email = data.emailOrPhone.trim();
      } else {
        // Normalize phone number
        const normalizedPhone = normalizePhoneNumber(data.emailOrPhone);
        if (!normalizedPhone) {
          toast.error('Invalid Mobile Number', {
            description: 'Please enter a valid Philippine mobile number (e.g., 09123456789)',
          });
          setIsLoading(false);
          return;
        }
        loginData.phone = normalizedPhone;
      }
      
      await authService.login(loginData);

      toast.success('✅ Logged in successfully!', {
        description: 'Redirecting to your dashboard...',
      });
      router.push('/dashboard');
    } catch (error) {
      const parsedError = parseAuthError(error);
      
      // Show error toast with title and message - use longer duration
      toast.error(parsedError.title, {
        description: parsedError.message,
        duration: 8000, // Increased to 8 seconds for better visibility
      });
      
      console.error('Login error:', error);
      console.error('Parsed error:', parsedError);
      
      // Log full error details for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Error response:', axiosError.response?.data);
        console.error('Error status:', axiosError.response?.status);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* Theme Toggle - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M30 0l15 15-15 15-15-15z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="w-full max-w-md mx-auto relative z-10 flex flex-col items-center justify-center min-h-0 max-h-[100dvh] py-4">
        <Card className="w-full rounded-xl shadow-xl bg-white border-2 border-gray-400 p-4 sm:p-5 max-h-[calc(100dvh-2rem)] flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0 rounded-lg pr-1 -mr-1">
            {/* Header - compact */}
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 bg-gray-100 text-gray-600">
                <LogIn className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1 text-red-700 leading-tight">
                BLD Cebu Community Online Portal
              </h1>
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-red-800 border border-gray-300">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                </svg>
                Welcome Back
              </div>
              <p className="text-xs mt-1.5 text-red-600">
                Sign in to access your dashboard
              </p>
            </div>

            {/* Assistant button - compact */}
            <div className="mb-3 sm:mb-4">
              <Button
                type="button"
                onClick={() => chatbotRef.current?.open()}
                className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] border-0"
              >
                <span className="absolute inset-0 rounded-lg bg-white/20 animate-pulse" aria-hidden />
                <MessageSquare className="w-4 h-4 mr-1.5 relative z-10 inline-block animate-bounce" style={{ animationDuration: '1.5s' }} />
                <span className="relative z-10">Sign in or Sign up with Assistant</span>
                <Sparkles className="w-4 h-4 ml-1.5 relative z-10 inline-block animate-pulse" style={{ animationDuration: '2s' }} />
              </Button>
              <p className="text-[10px] text-center text-gray-500 mt-1">
                Step-by-step guide
              </p>
            </div>

            {/* Login form - compact */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 sm:space-y-3">
              <div className="space-y-1">
                <Label htmlFor="emailOrPhone" className="text-sm font-medium text-gray-800">
                  Email or Mobile Number
                </Label>
                <div className="relative">
                  {detectInputType(emailOrPhoneValue) === 'email' ? (
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  ) : (
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  )}
                  <Input
                    id="emailOrPhone"
                    type="text"
                    placeholder="Email or mobile number"
                    className={`pl-9 pr-9 py-2 text-base ${
                      errors.emailOrPhone ? 'border-red-500' : 'border-gray-400'
                    }`}
                    {...register('emailOrPhone')}
                    disabled={isLoading}
                  />
                  {emailOrPhoneValue && !errors.emailOrPhone && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {errors.emailOrPhone && (
                  <p className="text-xs text-red-600">{errors.emailOrPhone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium text-gray-800">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className={`pl-9 pr-9 py-2 text-base ${
                      errors.password ? 'border-red-500' : 'border-gray-400'
                    }`}
                    {...register('password')}
                    disabled={isLoading}
                  />
                  {passwordValue && !errors.password && (
                    <div className="absolute right-9 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-red-600 hover:text-red-800 hover:underline">
                  Forgot your password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-800 hover:bg-red-900 text-white py-2.5 px-4 text-base font-bold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center text-xs">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-red-600 hover:text-red-800 hover:underline font-medium">
                  Create Account
                </Link>
              </div>
            </form>
          </div>
        </Card>
      </div>
      
      {/* Chatbot Component - Always Available */}
      <ChatbotSignUp ref={chatbotRef} />
    </div>
  );
}

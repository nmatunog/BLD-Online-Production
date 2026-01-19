'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Phone, LogIn, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showChatbotPromo, setShowChatbotPromo] = useState(true);
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

  // Auto-open chatbot in sign-in mode on page load
  useEffect(() => {
    // Prevent immediate re-open if the user intentionally closes it within the first render
    const timer = setTimeout(() => {
      setShowChatbotPromo(false);
      chatbotRef.current?.open();
    }, 200); // small delay to avoid layout shift
    return () => clearTimeout(timer);
  }, []);

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
      
      // Show error toast with title and message
      toast.error(parsedError.title, {
        description: parsedError.message,
        duration: 5000,
      });
      
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
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
      ></div>
      
      <div className="w-full max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Prominent Chatbot Assistant Banner - Signup and Signin */}
        {showChatbotPromo && (
          <Card className="border-4 border-blue-500 shadow-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 animate-pulse">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-5 md:gap-4">
                <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-blue-600 p-4 md:p-4 rounded-full">
                      <MessageSquare className="w-10 h-10 md:w-8 md:h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Sparkles className="w-6 h-6 md:w-5 md:h-5 text-blue-600 animate-bounce flex-shrink-0" />
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                        Let the assistant guide you (Sign in or Sign up)
                      </h2>
                    </div>
                    <p className="text-base md:text-base text-gray-700 leading-relaxed">
                      Start with the assistant to sign in if you have an account, or create one if you’re new. It collects what’s needed and guides you step-by-step.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setShowChatbotPromo(false);
                    chatbotRef.current?.open();
                  }}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-5 md:px-8 md:py-6 text-lg md:text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 w-full md:w-auto touch-manipulation min-h-[56px] md:min-h-[auto]"
                >
                  <MessageSquare className="w-6 h-6 md:w-5 md:h-5 mr-2" />
                  Start with Assistant
                  <ArrowRight className="w-6 h-6 md:w-5 md:h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alternative: Floating Prominent Button - Mobile Optimized */}
        {!showChatbotPromo && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce px-4 w-full max-w-sm md:max-w-none">
            <Button
              onClick={() => chatbotRef.current?.open()}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 py-4 md:px-6 md:py-4 text-base md:text-lg font-bold shadow-2xl rounded-full w-full md:w-auto touch-manipulation min-h-[56px]"
            >
              <MessageSquare className="w-6 h-6 md:w-5 md:h-5 mr-2" />
              <span className="text-base md:text-lg">Sign in or Sign up with Assistant</span>
              <Sparkles className="w-6 h-6 md:w-5 md:h-5 ml-2" />
            </Button>
          </div>
        )}
      
      <Card className="p-8 rounded-2xl shadow-xl max-w-md w-full mx-auto bg-white border-2 border-gray-400 shadow-gray-200">
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

        {/* Unified Login Input */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailOrPhone" className="text-base font-medium text-gray-800">
              Email or Mobile Number
            </Label>
            <div className="relative">
              {/* Show appropriate icon based on detected input type */}
              {detectInputType(emailOrPhoneValue) === 'email' ? (
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              ) : (
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              )}
              <Input
                id="emailOrPhone"
                type="text"
                placeholder="Enter your email or mobile number"
                className={`pl-10 pr-10 py-3 text-lg ${
                  errors.emailOrPhone ? 'border-red-500' : 'border-gray-400'
                }`}
                {...register('emailOrPhone')}
                disabled={isLoading}
              />
              {emailOrPhoneValue && !errors.emailOrPhone && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {errors.emailOrPhone && (
              <p className="text-sm text-red-600">{errors.emailOrPhone.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              You can sign in using either your registered email address or mobile number
            </p>
          </div>

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
      
      {/* Chatbot Component - Always Available */}
      <ChatbotSignUp ref={chatbotRef} />
    </div>
  );
}

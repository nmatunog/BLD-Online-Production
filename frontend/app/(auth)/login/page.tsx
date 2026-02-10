'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LogIn,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  CheckCircle2,
  QrCode,
  ArrowLeft,
  Mail,
  Phone,
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import ChatbotSignUp, { ChatbotSignUpHandle } from '@/components/chatbot/ChatbotSignUp';
import { normalizePhoneNumber } from '@/utils/phone.util';
import { parseAuthError } from '@/utils/error-handler';
import { ThemeToggle } from '@/components/theme-toggle';
import { QRScanner, qrUtils } from '@/lib/qr-scanner-service';

const QR_LOGIN_REGION_ID = 'qr-reader-login';

export default function LoginPage() {
  const router = useRouter();
  const chatbotRef = useRef<ChatbotSignUpHandle>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sign in via member QR (inside manual section)
  const [qrLoginStep, setQrLoginStep] = useState<'idle' | 'scanning' | 'password'>('idle');
  const [qrScannedCommunityId, setQrScannedCommunityId] = useState<string | null>(null);
  const [qrScannedName, setQrScannedName] = useState<string | null>(null);
  const [qrLoginPassword, setQrLoginPassword] = useState('');
  const [qrLoginShowPassword, setQrLoginShowPassword] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const qrScannerRef = useRef<QRScanner | null>(null);

  useEffect(() => {
    if (qrLoginStep !== 'scanning') return;
    let mounted = true;
    QRScanner.isCameraAvailable()
      .then((available) => {
        if (mounted) setCameraAvailable(available);
      })
      .catch(() => {
        if (mounted) setCameraAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, [qrLoginStep]);

  useEffect(() => {
    if (qrLoginStep !== 'scanning') return;
    const start = async () => {
      await new Promise((r) => setTimeout(r, 100));
      const element = document.getElementById(QR_LOGIN_REGION_ID);
      if (!element) return;
      try {
        qrScannerRef.current = new QRScanner(
          QR_LOGIN_REGION_ID,
          handleQrScanSuccess,
          () => {},
          { continuousMode: false, scanCooldown: 2000 }
        );
        await qrScannerRef.current.start();
      } catch (err) {
        console.error('QR scanner start failed:', err);
        toast.error('Camera error', { description: 'Could not start camera. Check permissions.' });
        setQrLoginStep('idle');
      }
    };
    start();
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
        qrScannerRef.current = null;
      }
    };
  }, [qrLoginStep]);

  const handleQrScanSuccess = (decodedText: string) => {
    const memberData = qrUtils.extractMemberData(decodedText);
    if (!memberData?.communityId) {
      toast.error('Invalid QR code', { description: 'Please scan your member QR code.' });
      return;
    }
    if (qrScannerRef.current) {
      qrScannerRef.current.stop().catch(() => {});
      qrScannerRef.current = null;
    }
    setQrScannedCommunityId(memberData.communityId);
    setQrScannedName(memberData.name ?? null);
    setQrLoginStep('password');
    setQrLoginPassword('');
  };

  const resetQrLogin = () => {
    setQrLoginStep('idle');
    setQrScannedCommunityId(null);
    setQrScannedName(null);
    setQrLoginPassword('');
    if (qrScannerRef.current) {
      qrScannerRef.current.stop().catch(() => {});
      qrScannerRef.current = null;
    }
  };

  const submitQrLogin = async () => {
    if (!qrScannedCommunityId || !qrLoginPassword.trim()) {
      toast.error('Password required', { description: 'Enter your account password.' });
      return;
    }
    if (qrLoginPassword.length < 6) {
      toast.error('Invalid password', { description: 'Password must be at least 6 characters.' });
      return;
    }
    setIsLoading(true);
    try {
      await authService.loginByQr({ communityId: qrScannedCommunityId, password: qrLoginPassword });
      toast.success('Signed in successfully', { description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    } catch (error) {
      const parsed = parseAuthError(error);
      toast.error(parsed.title, { description: parsed.message, duration: 8000 });
    } finally {
      setIsLoading(false);
    }
  };

  const detectInputType = (value: string): 'email' | 'phone' | null => {
    if (!value || value.trim().length === 0) return null;
    if (value.includes('@')) return 'email';
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length >= 10) return 'phone';
    return 'phone';
  };

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputType = detectInputType(identifier);
    if (!inputType) {
      toast.error('Input required', { description: 'Please enter your email or mobile number.' });
      return;
    }

    const loginData: { email?: string; phone?: string; password: string } = { password };
    if (inputType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier.trim())) {
        toast.error('Invalid email', { description: 'Please enter a valid email address.' });
        return;
      }
      loginData.email = identifier.trim();
    } else {
      const normalizedPhone = normalizePhoneNumber(identifier);
      if (!normalizedPhone) {
        toast.error('Invalid mobile number', {
          description: 'Please enter a valid Philippine mobile number (e.g., 09123456789).',
        });
        return;
      }
      loginData.phone = normalizedPhone;
    }

    if (password.length < 6) {
      toast.error('Invalid password', { description: 'Password must be at least 6 characters.' });
      return;
    }

    setIsLoading(true);
    try {
      await authService.login(loginData);
      toast.success('Signed in successfully', { description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    } catch (error) {
      const parsed = parseAuthError(error);
      toast.error(parsed.title, { description: parsed.message, duration: 8000 });
    } finally {
      setIsLoading(false);
    }
  };

  const identifierValid =
    identifier.trim().length > 0 &&
    (detectInputType(identifier) === 'email'
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
      : normalizePhoneNumber(identifier) != null);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-slate-800 relative">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 overflow-y-auto max-h-[98vh] border border-slate-100 flex flex-col relative">
        {/* Watermark logo - background for sign-in card */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-no-repeat bg-center opacity-[0.08] dark:opacity-[0.06]"
            style={{
              backgroundImage: 'url(/logo-watermark.png)',
              backgroundSize: 'min(72%, 260px)',
            }}
          />
        </div>
        {/* Compact Header */}
        <div className="relative z-10 pt-8 pb-6 px-6 text-center flex-shrink-0">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 rounded-2xl mb-4 text-red-600 shadow-sm border border-red-100">
            <LogIn size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            BLD Cebu Community
            <span className="block text-red-700">Online Portal</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Connecting our community, simply.</p>
        </div>

        <div className="relative z-10 px-6 pb-8">
          {/* PRIMARY ACTION: Assistant */}
          <button
            type="button"
            onClick={() => chatbotRef.current?.open()}
            className="w-full flex flex-col items-center justify-center p-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg shadow-indigo-200 group active:scale-[0.98] cursor-pointer touch-manipulation"
          >
            <div className="p-3 bg-white/20 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Sparkles size={32} />
            </div>
            <span className="text-xl font-bold text-center leading-tight">
              Sign in or Sign up with Assistant
            </span>
            <span className="text-indigo-100 text-xs mt-2 font-medium italic">
              &quot;Click here for the easiest way to get started&quot;
            </span>
          </button>

          {/* SECONDARY: Manual Login (collapsible) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setIsManualOpen(!isManualOpen)}
              className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <div className="flex-grow border-t border-slate-100" />
              <span className="flex-shrink px-2 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1">
                Manual Login {isManualOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
              <div className="flex-grow border-t border-slate-100" />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isManualOpen ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'
              }`}
            >
              {/* QR flow: scanning or password step */}
              {qrLoginStep === 'scanning' && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-center text-slate-600">
                    Scan your member QR code (e.g. from profile or ID)
                  </p>
                  <div
                    id={QR_LOGIN_REGION_ID}
                    className="rounded-xl overflow-hidden min-h-[200px] bg-slate-100"
                  />
                  {!cameraAvailable && (
                    <p className="text-xs text-center text-amber-600">Checking camera…</p>
                  )}
                  <button
                    type="button"
                    onClick={resetQrLogin}
                    className="w-full flex items-center justify-center gap-2 py-3 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl"
                  >
                    <ArrowLeft size={18} />
                    Back to sign in
                  </button>
                </div>
              )}

              {qrLoginStep === 'password' && qrScannedCommunityId && (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-center text-slate-600">
                    Member: <span className="font-mono font-semibold">{qrScannedCommunityId}</span>
                    {qrScannedName && (
                      <span className="block text-xs text-slate-500 mt-0.5">{qrScannedName}</span>
                    )}
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type={qrLoginShowPassword ? 'text' : 'password'}
                        value={qrLoginPassword}
                        onChange={(e) => setQrLoginPassword(e.target.value)}
                        placeholder="Enter your account password"
                        className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-red-600 outline-none transition-all"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setQrLoginShowPassword(!qrLoginShowPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {qrLoginShowPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetQrLogin}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                    >
                      <ArrowLeft size={18} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={submitQrLogin}
                      disabled={isLoading || qrLoginPassword.length < 6}
                      className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Sign In'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Manual form (email/phone + password) and QR entry - only when QR step is idle */}
              {qrLoginStep === 'idle' && (
                <>
                  <form onSubmit={handleManualSignIn} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">
                        Email or Mobile
                      </label>
                      <div className="relative">
                        {detectInputType(identifier) === 'email' ? (
                          <Mail
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                        ) : (
                          <Smartphone
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                        )}
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="Email or mobile number"
                          className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-red-600 outline-none transition-all"
                          disabled={isLoading}
                        />
                        {identifierValid && (
                          <CheckCircle2
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"
                            size={18}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5 ml-1">
                        <label className="text-xs font-bold text-slate-600">Password</label>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-bold text-red-700 hover:underline"
                        >
                          Forgot?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-red-600 outline-none transition-all"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Sign In Manually'
                      )}
                    </button>
                  </form>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setQrLoginStep('scanning')}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer touch-manipulation"
                    >
                      <QrCode size={18} />
                      Sign in with member QR code
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-slate-500 text-sm font-medium">
              New to the portal?{' '}
              <Link href="/register" className="text-red-700 font-bold hover:underline">
                Create Account
              </Link>
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-[11px] font-medium transition-colors"
            >
              <Info size={14} />
              <span>Need help logging in?</span>
            </Link>
          </div>
        </div>
      </div>

      <ChatbotSignUp ref={chatbotRef} />
    </div>
  );
}

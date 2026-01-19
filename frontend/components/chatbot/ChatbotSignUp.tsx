'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { MessageSquare, X, LogIn, ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { chatbotService } from '@/services/chatbot-service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { parseAuthError } from '@/utils/error-handler';
import { normalizePhoneNumber } from '@/utils/phone.util';

type ChatMode = 'welcome' | 'signup' | 'signin';

export interface ChatbotSignUpHandle {
  open: (mode?: Exclude<ChatMode, 'welcome'>) => void;
  close: () => void;
}

interface ChatbotSignUpProps {
  onClose?: () => void;
  onSuccess?: (data: unknown) => void;
}

const ChatbotSignUp = forwardRef<ChatbotSignUpHandle, ChatbotSignUpProps>(
  ({ onClose, onSuccess }, ref) => {
  const router = useRouter();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot'; content: string; timestamp: Date }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationAuthMethod, setRegistrationAuthMethod] = useState<'email' | 'phone' | null>(null);
  const [authComplete, setAuthComplete] = useState(false);
  const [mode, setMode] = useState<ChatMode>('welcome');
  const [signinStep, setSigninStep] = useState<'askIdentifier' | 'askPassword' | 'complete'>('askIdentifier');
  const [signinData, setSigninData] = useState<{ identifier?: string; password?: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      if (mode === 'signup') {
        const greeting = chatbotService.getGreeting();
        setMessages([greeting]);
      } else if (mode === 'signin') {
        setMessages([
          {
            role: 'bot',
            content: '👋 Great! I can help you sign in.\n\nPlease enter your email or mobile number to continue.',
            timestamp: new Date(),
          },
        ]);
        setSigninStep('askIdentifier');
      } else {
        setMessages([
          {
            role: 'bot',
            content: 'Welcome! Do you already have an account?',
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [isOpen, messages.length, mode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (userInput: string) => {
    if (isProcessing || registrationComplete || authComplete) return;

    setIsProcessing(true);

    const userMessage = {
      role: 'user' as const,
      content: userInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsTyping(true);

    try {
      if (mode === 'signin') {
        await handleSigninFlow(userInput);
      } else {
        const response = await chatbotService.processMessage(userInput);

        setIsTyping(false);

        setMessages((prev) => [...prev, response]);

        if (response.registrationComplete && response.registrationData) {
          setIsProcessing(false);
          await completeRegistration(response.registrationData);
          return;
        }
      }
    } catch (error) {
      setIsTyping(false);
      console.error('Error processing message:', error);
      const errorMessage = {
        role: 'bot' as const,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSigninFlow = async (userInput: string) => {
    if (signinStep === 'askIdentifier') {
      const value = userInput.trim();
      if (!value) {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            content: 'Please enter your email or mobile number to continue.',
            timestamp: new Date(),
          },
        ]);
        return;
      }
      setSigninData((prev) => ({ ...prev, identifier: value }));
      setSigninStep('askPassword');
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: 'Got it. Please enter your password.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (signinStep === 'askPassword') {
      const password = userInput;
      setSigninData((prev) => ({ ...prev, password }));
      setSigninStep('complete');
      await completeSignin(signinData.identifier || '', password);
      return;
    }
  };

  const completeSignin = async (identifier: string, password: string) => {
    try {
      const loginData: { email?: string; phone?: string; password: string } = { password };

      if (identifier.includes('@')) {
        loginData.email = identifier.trim();
      } else {
        const normalizedPhone = normalizePhoneNumber(identifier);
        if (!normalizedPhone) {
          throw new Error('Invalid mobile number. Please enter a valid Philippine mobile number.');
        }
        loginData.phone = normalizedPhone;
      }

      await authService.login(loginData);

      setAuthComplete(true);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: '✅ Signed in successfully! Redirecting you to your dashboard...',
          timestamp: new Date(),
        },
      ]);

      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (error) {
      setSigninStep('askPassword');
      setIsTyping(false);
      const parsedError = parseAuthError(error);
      toast.error(parsedError.title, { description: parsedError.message });
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: `❌ Sign-in failed: ${parsedError.message}\n\nPlease try again or type "restart" to start over.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const completeRegistration = async (registrationData: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    suffix: string | null;
    nickname: string;
    encounterType: string;
    location: string;
    encounterNumber: string;
    email: string | null;
    phone: string | null;
    password: string | null;
  }) => {
    setIsProcessing(true);

    try {
      const result = await authService.register({
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        middleName: registrationData.middleName || undefined,
        suffix: registrationData.suffix || undefined,
        nickname: registrationData.nickname,
        city: registrationData.location,
        encounterType: registrationData.encounterType,
        classNumber: registrationData.encounterNumber,
        email: registrationData.email || undefined,
        phone: registrationData.phone || undefined,
        password: registrationData.password || '',
      });

      setRegistrationComplete(true);
      const authMethod = registrationData.phone ? 'phone' : 'email';
      const authMethodDisplay = registrationData.phone ? 'mobile number' : 'email';
      setRegistrationAuthMethod(authMethod);
      
      const successMessage = {
        role: 'bot' as const,
        content: `🎉 Registration complete! You can now log in using your ${authMethodDisplay}.\n\nClick the button below to go to the sign-in page.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);

      toast.success('✅ Registration successful!', {
        description: 'Your account has been created. You can now log in!',
      });

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Error completing registration:', error);

      const parsedError = parseAuthError(error);
      const errorText = parsedError.message;

      // Show toast notification
      toast.error(parsedError.title, {
        description: parsedError.message,
        duration: 6000,
      });

      const isDuplicateError =
        parsedError.type === 'email' ||
        parsedError.type === 'phone' ||
        errorText.toLowerCase().includes('already registered') ||
        errorText.toLowerCase().includes('duplicate') ||
        errorText.toLowerCase().includes('already exists');

      if (isDuplicateError) {
        chatbotService.resetEmailPhone();

        let errorContent = '';
        let nextStep = 'collectingEmailOrPhone';

        if (parsedError.type === 'email' || errorText.toLowerCase().includes('email')) {
          errorContent = `❌ This email address is already registered.\n\nPlease provide a different email address, or type 'mobile' to use a mobile number instead.`;
          nextStep = 'collectingEmail';
        } else if (parsedError.type === 'phone' || errorText.toLowerCase().includes('mobile') || errorText.toLowerCase().includes('phone')) {
          errorContent = `❌ This mobile number is already registered.\n\nPlease provide a different mobile number, or type 'email' to use an email address instead.`;
          nextStep = 'collectingPhone';
        } else {
          errorContent = `❌ An account with this information already exists.\n\nPlease provide a different email or mobile number.`;
        }

        const errorMsg = {
          role: 'bot' as const,
          content: errorContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        const errorMsg = {
          role: 'bot' as const,
          content: `❌ Sorry, I couldn't complete your registration.\n\n${errorText}\n\nPlease try again or contact support if the problem persists.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    chatbotService.reset();
    setRegistrationComplete(false);
    setRegistrationAuthMethod(null);
    setAuthComplete(false);
    setSigninData({});
    setSigninStep('askIdentifier');
    setMode('welcome');
    setMessages([]);
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  useImperativeHandle(ref, () => ({
    open: (newMode?: Exclude<ChatMode, 'welcome'>) => {
      chatbotService.reset();
      setRegistrationComplete(false);
      setRegistrationAuthMethod(null);
      setAuthComplete(false);
      setSigninData({});
      setSigninStep('askIdentifier');
      setMode(newMode || 'welcome');
      setMessages([]);
      setIsOpen(true);
    },
    close: () => handleClose(),
  }), []);

  const progress = chatbotService.getProgress();

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-20 w-20 shadow-2xl bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
          title="Start assistant"
          aria-label="Open chatbot assistant"
        >
          <MessageSquare className="h-10 w-10" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 md:top-auto z-50 flex items-center justify-center p-0 md:p-4 overflow-hidden">
      {/* Mobile: Full screen overlay with backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 md:hidden"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Chat Container - Mobile: Full screen, Desktop: Fixed size with max-height */}
      <div
        ref={chatContainerRef}
        className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:w-[500px] md:max-w-[90vw] md:h-[85vh] md:max-h-[700px] flex flex-col border-0 md:border-2 border-gray-300 relative overflow-hidden"
      >
        {/* Header - Light mode, larger touch targets */}
        <div className="bg-blue-600 text-white px-6 py-5 md:px-4 md:py-4 rounded-t-none md:rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-2">
            <h3 className="font-bold text-2xl md:text-xl">
              {mode === 'signin' ? 'BLD Sign-In Assistant' : mode === 'signup' ? 'BLD Sign-Up Assistant' : 'BLD Assistant'}
            </h3>
            {mode === 'signup' && progress.completed > 0 && (
              <span className="text-lg md:text-base bg-blue-500 px-3 py-1.5 md:px-2 md:py-1 rounded-md font-semibold">
                {progress.completed}/{progress.total}
              </span>
            )}
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="hover:bg-blue-500 h-12 w-12 md:h-10 md:w-10 touch-manipulation"
            aria-label="Close chatbot"
          >
            <X className="h-7 w-7 md:h-5 md:w-5" />
          </Button>
        </div>

        {/* Progress Bar - Larger, more visible */}
        {progress.completed > 0 && (
          <div className="px-6 md:px-4 pt-3 md:pt-2 pb-2 md:pb-1 bg-gray-50 border-b-2 border-gray-200">
            <div className="w-full bg-gray-200 rounded-full h-4 md:h-3">
              <div
                className="bg-blue-600 h-4 md:h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages - Larger padding, better spacing */}
        <div className="flex-1 overflow-y-auto px-4 md:px-4 py-4 md:py-4 space-y-4 md:space-y-2 bg-white min-h-0">
          {mode === 'welcome' ? (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg} />
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setMode('signin');
                    setMessages([
                      {
                        role: 'bot',
                        content: '👋 Great! I can help you sign in.\n\nPlease enter your email or mobile number to continue.',
                        timestamp: new Date(),
                      },
                    ]);
                    setSigninStep('askIdentifier');
                    setSigninData({});
                  }}
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Yes, I have an account
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-blue-600 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setMode('signup');
                    const greeting = chatbotService.getGreeting();
                    setMessages([greeting]);
                  }}
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  No, create an account
                </Button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg} />
              ))}

              {isTyping && (
                <div className="flex items-center space-x-3 md:space-x-2 text-gray-600 py-2">
                  <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Registration Complete Button */}
        {registrationComplete && (
          <div className="px-4 pb-4 pt-2 border-t-2 border-gray-200 bg-green-50">
            <Button
              onClick={() => {
                const method = registrationAuthMethod === 'phone' ? 'mobile' : 'email';
                router.push(`/login?method=${method}`);
                setIsOpen(false);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 md:py-3 text-lg md:text-base font-bold shadow-lg"
              size="lg"
            >
              <LogIn className="h-6 w-6 md:h-5 md:w-5 mr-2" />
              Go to Sign In Page
              <ArrowRight className="h-6 w-6 md:h-5 md:w-5 ml-2" />
            </Button>
            <p className="text-center text-sm md:text-xs text-gray-600 mt-2">
              {registrationAuthMethod === 'phone' 
                ? 'Mobile sign-in will be automatically selected'
                : 'Email sign-in will be automatically selected'}
            </p>
          </div>
        )}

        {/* Input - Larger, more accessible */}
        {!registrationComplete && !authComplete && mode !== 'welcome' && (
          <ChatInput
            onSend={handleSendMessage}
            disabled={isProcessing || registrationComplete || authComplete}
            placeholder={mode === 'signin' && signinStep === 'askPassword' ? 'Enter your password' : 'Type your message...'}
          />
        )}
      </div>
    </div>
  );
  }
);

ChatbotSignUp.displayName = 'ChatbotSignUp';

export default ChatbotSignUp;


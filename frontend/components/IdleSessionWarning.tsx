'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';

/**
 * Shows a warning and then logs the user out after a period of inactivity.
 *
 * Example behaviour:
 * - After 25 minutes of no activity → show warning toast ("You will be logged out in 5 minutes")
 * - If still inactive after 5 more minutes → auto-logout
 * - Any mouse / keyboard / touch activity cancels the warning and resets the timer
 */
export default function IdleSessionWarning() {
  const IDLE_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes
  const WARNING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes before logout

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warningShown, setWarningShown] = useState(false);

  const clearTimers = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  const startTimers = useCallback(() => {
    if (typeof window === 'undefined') return;

    clearTimers();
    setWarningShown(false);

    // Only apply on authenticated app pages, not on auth screens
    const path = window.location.pathname || '';
    if (path.includes('/login') || path.includes('/register') || path.includes('/reset-password')) {
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      setWarningShown(true);
      const toastId = toast.warning('You will be logged out soon due to inactivity.', {
        description: 'Click "Stay signed in" to continue your session.',
        action: {
          label: 'Stay signed in',
          onClick: () => {
            // Any interaction counts as activity; reset timers
            startTimers();
          },
        },
        duration: WARNING_WINDOW_MS,
      });

      logoutTimerRef.current = setTimeout(() => {
        toast.dismiss(toastId);
        authService.logout();
      }, WARNING_WINDOW_MS);
    }, IDLE_THRESHOLD_MS);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivity = () => {
      // If the user interacts after warning, just reset everything
      startTimers();
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        startTimers();
      }
    });

    startTimers();

    return () => {
      clearTimers();
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', () => {
        startTimers();
      });
    };
  }, [startTimers]);

  return null;
}


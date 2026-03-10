'use client';

import { useEffect } from 'react';

/**
 * In production, if the user loads the site over HTTP, redirect to HTTPS
 * so they never see certificate/security warnings from being on an insecure URL.
 * Skips redirect on localhost for local development.
 */
export default function RedirectToHttps() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalhost && protocol === 'http:') {
      const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
      window.location.replace(httpsUrl);
    }
  }, []);
  return null;
}

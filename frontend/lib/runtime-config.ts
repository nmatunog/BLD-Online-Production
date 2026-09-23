// Runtime configuration - detects backend URL based on environment
// This works at runtime without needing build-time environment variables

/** Browser on Vercel / bldcebu.com should use the same-origin /api/v1 proxy (no CORS). */
export function shouldUseSameOriginApi(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith('.vercel.app') ||
    host === 'bldcebu.com' ||
    host.endsWith('.bldcebu.com')
  );
}

function envApiBaseUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '');
  }
  return undefined;
}

export function getApiBaseUrl(): string {
  // Browser first: production hostnames always hit the Next proxy, even if
  // NEXT_PUBLIC_API_BASE_URL points at Railway (avoids CORS on 502s).
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return envApiBaseUrl() || 'http://localhost:3001';
    }

    if (shouldUseSameOriginApi(hostname)) {
      return window.location.origin;
    }
  }

  const fromEnv = envApiBaseUrl();
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname.includes('.run.app')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const servicePart = parts[0];
        const backendServicePart = servicePart.replace(/frontend/g, 'backend');
        const domain = parts.slice(1).join('.');
        return `https://${backendServicePart}.${domain}`;
      }
    }

    if (hostname.includes('.web.app') || hostname.includes('.firebaseapp.com')) {
      const metaTag = document.querySelector('meta[name="api-base-url"]');
      if (metaTag) {
        return metaTag.getAttribute('content') || 'http://localhost:3001';
      }
    }
  }

  return 'http://localhost:3001';
}

export function getApiUrl(): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/v1`;
}

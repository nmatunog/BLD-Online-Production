// Runtime configuration - detects backend URL based on environment
// This works at runtime without needing build-time environment variables

export function getApiBaseUrl(): string {
  // 1. Check environment variables (build-time, if available)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '');
  }

  // 2. Runtime detection (works in browser)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If we're on localhost, use localhost backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }

    // If we're on a Cloud Run domain (e.g., *.run.app), construct backend URL
    // Cloud Run services follow pattern: service-name-hash-region.run.app
    // We need to replace 'frontend' with 'backend' in the service name
    if (hostname.includes('.run.app')) {
      // Extract the project number and construct backend URL
      // Frontend: bld-portal-frontend-XXXXX-as.a.run.app
      // Backend:  bld-portal-backend-XXXXX-as.a.run.app
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const servicePart = parts[0]; // e.g., "bld-portal-frontend-XXXXX-as"
        // Replace 'frontend' with 'backend' in the service name
        const backendServicePart = servicePart.replace(/frontend/g, 'backend');
        const domain = parts.slice(1).join('.'); // e.g., "a.run.app"
        return `https://${backendServicePart}.${domain}`;
      }
    }

    // If we're on Vercel (vercel.app) or custom domain, use environment variable
    // For Railway backend, we need to set NEXT_PUBLIC_API_BASE_URL
    if (hostname.includes('.vercel.app') || hostname.includes('BLDCebu.com') || hostname.includes('app.BLDCebu.com')) {
      // Environment variable should be set for these domains
      // Fallback handled by environment variable check at top
    }
    
    // If we're on Firebase Hosting (web.app), we need to get backend from env or use a known URL
    if (hostname.includes('.web.app') || hostname.includes('.firebaseapp.com')) {
      // Try to get from a meta tag or fallback
      const metaTag = document.querySelector('meta[name="api-base-url"]');
      if (metaTag) {
        return metaTag.getAttribute('content') || 'http://localhost:4000';
      }
    }
  }

  // 3. Fallback to localhost (development)
  return 'http://localhost:4000';
}

export function getApiUrl(): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/v1`;
}

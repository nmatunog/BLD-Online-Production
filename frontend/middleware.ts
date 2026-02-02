import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const csp =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://m.stripe.network https://js.stripe.com https://*.vercel.app; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  "connect-src 'self' https://*.railway.app https://*.vercel.app https://m.stripe.network https://api.stripe.com; " +
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

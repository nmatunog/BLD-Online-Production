import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const csp =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://m.stripe.network https://js.stripe.com https://secured-pixel.com https://*.vercel.app https://vercel.live https://*.vercel.live; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  "connect-src 'self' http://localhost:3000 http://localhost:3001 http://localhost:4000 http://127.0.0.1:3000 http://127.0.0.1:3001 http://127.0.0.1:4000 https://*.railway.app https://*.vercel.app https://vercel.live https://*.vercel.live https://m.stripe.network https://api.stripe.com; " +
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://vercel.live https://*.vercel.live";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

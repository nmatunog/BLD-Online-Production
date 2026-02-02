import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://m.stripe.network https://js.stripe.com https://secured-pixel.com https://*.vercel.app https://vercel.live https://*.vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' http://localhost:3000 http://localhost:3001 http://localhost:4000 http://127.0.0.1:3000 http://127.0.0.1:3001 http://127.0.0.1:4000 https://*.railway.app https://*.vercel.app https://vercel.live https://*.vercel.live https://m.stripe.network https://api.stripe.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

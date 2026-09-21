/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@tensorflow/tfjs',
    '@tensorflow/tfjs-core',
    '@tensorflow/tfjs-converter',
    '@tensorflow/tfjs-backend-cpu',
    '@tensorflow/tfjs-backend-webgl',
    '@tensorflow-models/blazeface',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://m.stripe.network https://js.stripe.com https://secured-pixel.com https://*.vercel.app https://vercel.live https://*.vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' blob: http://localhost:3000 http://localhost:3001 http://localhost:4000 http://127.0.0.1:3000 http://127.0.0.1:3001 http://127.0.0.1:4000 https://*.railway.app https://*.vercel.app https://vercel.live https://*.vercel.live https://m.stripe.network https://api.stripe.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://vercel.live https://*.vercel.live",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

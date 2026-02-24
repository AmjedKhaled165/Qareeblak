import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚡ PERFORMANCE OPTIMIZATIONS

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Compression
  compress: true,

  // Production source maps (disable for faster builds)
  productionBrowserSourceMaps: false,

  // React strict mode for catching bugs
  reactStrictMode: true,

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
    // Reduce JavaScript sent to client
    optimizeCss: true,
  },

  // API rewrites
  async rewrites() {
    return [
      {
        source: '/api/halan/:path*',
        destination: 'http://localhost:5000/api/halan/:path*',
      },
    ];
  },

  // Headers for better caching (CSP DISABLED for debugging)
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ⚠️ CSP COMPLETELY DISABLED - Temporary fix for debugging
      // If the admin dashboard works now, the issue was CSP blocking.
      // Re-enable with proper configuration after confirming.
    ];
  },
};

export default nextConfig;

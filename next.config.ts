import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/halan/:path*',
        destination: 'http://localhost:5000/api/halan/:path*',
      },
    ];
  },
};

export default nextConfig;

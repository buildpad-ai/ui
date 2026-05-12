import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: '/docs', destination: '/docs/index.html' },
        { source: '/docs/:path*', destination: '/docs/:path*/index.html' },
      ],
    };
  },
};

export default nextConfig;

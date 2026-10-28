import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // llms.txt convention looks at the site root; the files live with the docs.
  async rewrites() {
    return [
      { source: '/llms.txt', destination: '/docs/llms.txt' },
      { source: '/llms-full.txt', destination: '/docs/llms-full.txt' },
    ];
  },
};

export default nextConfig;

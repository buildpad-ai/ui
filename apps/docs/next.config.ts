import type { NextConfig } from 'next';
import nextra from 'nextra';

const withNextra = nextra({});

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/docs',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default withNextra(nextConfig);

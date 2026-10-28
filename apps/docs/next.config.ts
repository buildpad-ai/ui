import type { NextConfig } from 'next';
import nextra from 'nextra';

const withNextra = nextra({});

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/docs',
  trailingSlash: true,
  images: { unoptimized: true },
  // The styleguide's component gallery imports the shipped Mantine theme
  // from packages/cli/templates/lib/theme.ts, outside this app.
  experimental: { externalDir: true },
};

export default withNextra(nextConfig);

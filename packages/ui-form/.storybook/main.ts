import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import path from 'path';

const __dirname = import.meta.dirname;

/**
 * DaaS API Proxy
 *
 * In local development, /api/* requests are proxied to the Storybook Host
 * app (apps/storybook-host) running on localhost:3000.
 *
 * The host app handles authentication (DaaS URL + token stored in an
 * encrypted httpOnly cookie) and proxies requests to the DaaS backend.
 *
 * In production (deployed to Amplify), the built Storybook is served from
 * the same origin as the host app — no proxy needed.
 *
 * To get started:
 *   1. pnpm dev:host          — start the host app
 *   2. Visit http://localhost:3000 and enter your DaaS URL + token
 *   3. pnpm storybook:form    — start this Storybook
 */

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    // Live-DaaS stories last, so a component's sidebar reads Docs, Default,
    // …, Live DaaS (Storybook lists a title's stories in file-load order).
    '../src/**/!(*.daas).stories.@(js|jsx|mjs|ts|tsx)',
    '../src/**/*.daas.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  docs: {},
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        if (prop.parent) {
          return !prop.parent.fileName.includes('node_modules') ||
                 prop.parent.fileName.includes('@mantine') ||
                 prop.parent.fileName.includes('@buildpad');
        }
        return true;
      },
    },
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          // Map ALL workspace packages to source (required for cyclic deps)
          '@buildpad/types': path.resolve(__dirname, '../../types/src'),
          '@buildpad/services': path.resolve(__dirname, '../../services/src'),
          '@buildpad/hooks': path.resolve(__dirname, '../../hooks/src'),
          '@buildpad/utils': path.resolve(__dirname, '../../utils/src'),
          '@buildpad/ui-interfaces': path.resolve(__dirname, '../../ui-interfaces/src'),
          '@buildpad/ui-table': path.resolve(__dirname, '../../ui-table/src'),
          '@buildpad/ui-collections': path.resolve(__dirname, '../../ui-collections/src'),
          '@buildpad/ui-form': path.resolve(__dirname, '../../ui-form/src'),
        },
      },
      server: {
        // Proxy /api/* to the Storybook Host app (handles auth + DaaS proxy)
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
    });
  },
};

export default config;

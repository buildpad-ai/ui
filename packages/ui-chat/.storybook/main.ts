import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import path from 'path';

const __dirname = import.meta.dirname;

/**
 * The chat stories run against a scripted backend (src/_mockBackend.ts), so
 * unlike the DaaS modules there is no /api proxy to the Storybook Host.
 */
/**
 * The AI SDK imports @opentelemetry/api, and the Next.js framework's mocks alias
 * it to Next's precompiled CommonJS copy, which reads `__dirname` and crashes in
 * the browser. Its alias is added by a plugin's config hook (after this file's),
 * so swap the replacement once the config is resolved.
 */
const openTelemetryEsm = {
  name: 'ui-chat:opentelemetry-esm',
  configResolved(resolved: { resolve: { alias: Array<{ find: string | RegExp; replacement: string }> } }) {
    const entry = resolved.resolve.alias.find((item) => item.find === '@opentelemetry/api');
    if (entry) entry.replacement = path.resolve(__dirname, '../../../node_modules/@opentelemetry/api/build/esm/index.js');
  },
};

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs', '@storybook/addon-a11y'],
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
      plugins: [openTelemetryEsm],
      resolve: {
        alias: {
          '@buildpad/types': path.resolve(__dirname, '../../types/src'),
          '@buildpad/services': path.resolve(__dirname, '../../services/src'),
          '@buildpad/hooks': path.resolve(__dirname, '../../hooks/src'),
          '@buildpad/utils': path.resolve(__dirname, '../../utils/src'),
          '@buildpad/ui-chat': path.resolve(__dirname, '../src'),
        },
      },
    });
  },
};

export default config;

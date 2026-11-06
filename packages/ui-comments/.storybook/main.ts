import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import path from 'path';

const __dirname = import.meta.dirname;

/**
 * The comments stories run against an in-memory adapter (src/_mockAdapter.ts),
 * so unlike the DaaS modules there is no /api proxy to the Storybook Host.
 */
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
      resolve: {
        alias: {
          '@buildpad/types': path.resolve(__dirname, '../../types/src'),
          '@buildpad/services': path.resolve(__dirname, '../../services/src'),
          '@buildpad/hooks': path.resolve(__dirname, '../../hooks/src'),
          '@buildpad/utils': path.resolve(__dirname, '../../utils/src'),
          '@buildpad/ui-comments': path.resolve(__dirname, '../src'),
        },
      },
    });
  },
};

export default config;

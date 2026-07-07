import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';
import path from 'path';

const __dirname = import.meta.dirname;

/**
 * DaaS API Proxy
 *
 * In local development, /api/* requests are proxied to the Storybook Host
 * app (apps/storybook-host) running on localhost:3000.
 */

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
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
          '@buildpad/types': path.resolve(__dirname, '../../types/src'),
          '@buildpad/services': path.resolve(__dirname, '../../services/src'),
          '@buildpad/hooks': path.resolve(__dirname, '../../hooks/src'),
          '@buildpad/utils': path.resolve(__dirname, '../../utils/src'),
          '@buildpad/ui-form': path.resolve(__dirname, '../../ui-form/src'),
          '@buildpad/ui-table': path.resolve(__dirname, '../../ui-table/src'),
          '@buildpad/ui-collections': path.resolve(__dirname, '../../ui-collections/src'),
          '@buildpad/ui-interfaces': path.resolve(__dirname, '../../ui-interfaces/src'),
          '@buildpad/ui-forms': path.resolve(__dirname, '../src'),
        },
        // Force a SINGLE instance of React, Mantine and Tiptap/ProseMirror.
        // The builder aliases `@buildpad/ui-interfaces` / `-collections` to their
        // src (which live OUTSIDE this Storybook root), so Vite would serve their
        // `@mantine/core` imports raw while the app's copy is pre-bundled — two
        // `MantineContext` instances, which is why `@mantine/tiptap` reports
        // "MantineProvider was not found". `dedupe` + `optimizeDeps.include`
        // (below) collapse them to one pre-bundled copy so every interface
        // (rich text, code, all Mantine inputs) renders.
        dedupe: [
          'react',
          'react-dom',
          '@mantine/core',
          '@mantine/hooks',
          '@mantine/dates',
          '@mantine/notifications',
          '@mantine/tiptap',
          '@tiptap/react',
          '@tiptap/core',
          '@tiptap/pm',
        ],
      },
      // Pre-bundle the shared context singletons so the outside-root aliased
      // workspace sources and the app share ONE copy (fixes raw-vs-prebundled
      // duplication for Mantine/Tiptap; see the dedupe note above).
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react/jsx-runtime',
          '@mantine/core',
          '@mantine/hooks',
          '@mantine/dates',
          '@mantine/notifications',
          '@mantine/tiptap',
          '@tiptap/react',
          '@tiptap/core',
          '@tiptap/starter-kit',
          '@tiptap/pm/state',
          '@tiptap/pm/view',
          '@tiptap/pm/model',
        ],
      },
      server: {
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

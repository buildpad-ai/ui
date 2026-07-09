import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

const __dirname = import.meta.dirname;
const rootModules = resolve(__dirname, '../../node_modules');

/**
 * Alias the `@buildpad/*` workspace packages to their `src` entry points so
 * the tests exercise the live source (not a possibly-stale `dist`), and pin
 * react/react-dom to the root install so renderHook doesn't end up with two
 * React copies (hooks package + root) that break `useState`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@buildpad/types': resolve(__dirname, '../types/src'),
      '@buildpad/services': resolve(__dirname, '../services/src'),
      '@buildpad/utils': resolve(__dirname, '../utils/src'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
    },
  },
});

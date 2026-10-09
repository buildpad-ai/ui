import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const __dirname = import.meta.dirname;
const rootModules = resolve(__dirname, '../../node_modules');

/**
 * Alias the `@buildpad/*` workspace packages to their `src` entry points so
 * the tests exercise the live source (not a possibly-stale `dist`), and pin
 * react/react-dom to the root install to avoid a dual-React-copy crash.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      // Measure this package's own source only. Without an include, the v8
      // provider counts whatever build output happens to sit in the package
      // directory (storybook-static/, dist/), so the floors below fail for
      // reasons that have nothing to do with the source.
      include: ['src/**'],
      // Floors just under the coverage measured when they were added
      // (59.03 / 74.8 / 43.52 / 59.03, stories and fixtures included); raise
      // them as tests are added.
      thresholds: { statements: 58, branches: 73, functions: 42, lines: 58 },
    },
  },
  resolve: {
    alias: {
      '@buildpad/types': resolve(__dirname, '../types/src'),
      '@buildpad/services': resolve(__dirname, '../services/src'),
      '@buildpad/hooks': resolve(__dirname, '../hooks/src'),
      '@buildpad/utils': resolve(__dirname, '../utils/src'),
      // Deep subpath alias must precede the package alias — Vite matches these
      // in order.
      '@buildpad/ui-interfaces/upload': resolve(__dirname, '../ui-interfaces/src/upload'),
      '@buildpad/ui-interfaces': resolve(__dirname, '../ui-interfaces/src'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
    },
    // Aliased ui-interfaces sources must share ONE Mantine (and React) copy
    // with the tests — a second pnpm-keyed instance crashes with a null
    // dispatcher ("Cannot read properties of null (reading 'useContext')").
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/notifications'],
  },
});

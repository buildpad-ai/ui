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
    testTimeout: 20000,
    // The kit imports its stylesheet; the tests only need the import to resolve.
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      exclude: [
        'src/**/*.stories.tsx',
        'src/_mockAdapter.ts',
        'src/css.d.ts',
        '.storybook/**',
        'tests/**',
        'dist/**',
        'storybook-static/**',
        '*.config.ts',
      ],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
  resolve: {
    alias: {
      '@buildpad/services': resolve(__dirname, '../services/src'),
      '@buildpad/utils': resolve(__dirname, '../utils/src'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
  },
});

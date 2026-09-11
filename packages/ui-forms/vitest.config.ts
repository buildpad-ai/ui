import { defineConfig } from 'vitest/config';
import path from 'node:path';

const __dirname = import.meta.dirname;

/**
 * Alias the `@buildpad/*` workspace packages to their `src` entry points so the
 * tests exercise the live source (not a possibly-stale `dist`).
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
    },
  },
  resolve: {
    alias: {
      '@buildpad/types': path.resolve(__dirname, '../types/src'),
      '@buildpad/utils': path.resolve(__dirname, '../utils/src'),
      '@buildpad/ui-form': path.resolve(__dirname, '../ui-form/src'),
    },
  },
});

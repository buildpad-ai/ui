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
      // Floors just under the coverage measured when they were added
      // (4.5 / 46.51 / 21.87 / 4.5); raise them as tests are added.
      thresholds: { statements: 4, branches: 45, functions: 20, lines: 4 },
    },
  },
  resolve: {
    alias: [
      { find: '@buildpad/types', replacement: path.resolve(__dirname, '../types/src') },
      { find: '@buildpad/utils', replacement: path.resolve(__dirname, '../utils/src') },
      { find: '@buildpad/ui-form', replacement: path.resolve(__dirname, '../ui-form/src') },
      // The deep path FormPreview imports (the package exports it from dist).
      {
        find: /^@buildpad\/ui-collections\/CollectionForm$/,
        replacement: path.resolve(__dirname, '../ui-collections/src/CollectionForm.tsx'),
      },
    ],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      // Floors just under the coverage measured when they were added
      // (92.13 / 76.68 / 79.31 / 92.13); raise them as tests are added.
      thresholds: { statements: 91, branches: 75, functions: 78, lines: 91 },
    },
  },
});

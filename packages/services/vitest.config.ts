import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      // Floors just under the coverage measured when they were added
      // (67.27 / 96.2 / 85.05 / 67.27); raise them as tests are added.
      thresholds: { statements: 66, branches: 95, functions: 84, lines: 66 },
    },
  },
});

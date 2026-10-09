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
      // Measure this package's own source only. Without an include, the v8
      // provider counts whatever build output happens to sit in the package
      // directory (storybook-static/, dist/), so the floors below fail for
      // reasons that have nothing to do with the source.
      include: ['src/**'],
      // Floors just under the coverage measured when they were added
      // (92.13 / 76.68 / 79.31 / 92.13); raise them as tests are added.
      thresholds: { statements: 91, branches: 75, functions: 78, lines: 91 },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
      // (67.27 / 96.2 / 85.05 / 67.27); raise them as tests are added.
      thresholds: { statements: 66, branches: 95, functions: 84, lines: 66 },
    },
  },
});

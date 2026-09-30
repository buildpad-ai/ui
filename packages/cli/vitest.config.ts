import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      // 2 pre-existing i18n-locales failures (Windows path separators) are
      // unrelated noise that shouldn't block the lcov report from being
      // written for SonarQube.
      reportOnFailure: true,
      // Floors just under the coverage measured when they were added
      // (41.61 / 69.8 / 64.74 / 41.61); raise them as tests are added.
      thresholds: { statements: 40, branches: 68, functions: 63, lines: 40 },
    },
  },
});

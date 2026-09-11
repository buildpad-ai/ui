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
    },
  },
});

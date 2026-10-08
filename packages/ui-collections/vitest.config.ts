import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const rootModules = resolve(__dirname, '../../node_modules');

export default defineConfig({
  resolve: {
    alias: {
      // Workspace packages whose package.json main points at an unbuilt dist/ —
      // resolve to source so vi.mock can intercept without a build step.
      '@buildpad/ui-form': resolve(__dirname, '../ui-form/src/index.ts'),
      '@buildpad/utils': resolve(__dirname, '../utils/src/index.ts'),
      '@buildpad/types': resolve(__dirname, '../types/src/index.ts'),
      // Deep services modules first: the barrel alias below would otherwise
      // also match `@buildpad/services/<x>` (aliases match path prefixes).
      '@buildpad/services/relational-ui-context': resolve(__dirname, '../services/src/relational-ui-context.tsx'),
      '@buildpad/services': resolve(__dirname, '../services/src/index.ts'),
      '@buildpad/ui-table': resolve(__dirname, '../ui-table/src/index.ts'),
      '@mantine/core': resolve(__dirname, 'tests/__mocks__/@mantine/core.tsx'),
      '@tabler/icons-react': resolve(__dirname, 'tests/__mocks__/@tabler/icons-react.tsx'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // A pre-existing bulk-actions-bar failure is unrelated noise that
      // shouldn't block the lcov report from being written for SonarQube.
      reportOnFailure: true,
      // Floors just under the coverage measured when they were added
      // (25.76 / 76.31 / 52.45 / 25.76); raise them as tests are added.
      thresholds: { statements: 24, branches: 75, functions: 51, lines: 24 },
    },
  },
});

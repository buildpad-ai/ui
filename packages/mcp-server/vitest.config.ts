import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// registry.ts reads this build-time-injected constant (see tsup.config.ts) —
// inject the same value here so it isn't `undefined` under vitest.
const registryPath = join(__dirname, '../registry.json');
const registryContent = readFileSync(registryPath, 'utf-8');

export default defineConfig({
  define: {
    EMBEDDED_REGISTRY: JSON.stringify(registryContent),
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/versioning.ts', 'src/index.ts', 'src/sources.ts', 'src/bundle-sources.ts', 'src/upgrade.ts'],
      reportOnFailure: true,
      // Floors just under the measured coverage (77.48 / 89.32 / 98.36 / 77.48
      // after the source-loading and upgrade-tool tests); raise them as tests
      // are added.
      thresholds: { statements: 76, branches: 87, functions: 97, lines: 76 },
    },
  },
});

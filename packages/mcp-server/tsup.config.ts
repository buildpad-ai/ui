import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read registry.json at build time to embed it
const registryPath = join(__dirname, '../registry.json');
const registryContent = readFileSync(registryPath, 'utf-8');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  noExternal: ['@modelcontextprotocol/sdk'],  // Bundle this dependency
  define: {
    'EMBEDDED_REGISTRY': JSON.stringify(registryContent),
  },
});

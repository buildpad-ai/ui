import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleRegistrySources } from './src/bundle-sources';

// Read registry.json at build time to embed it
const registryPath = join(__dirname, '../registry.json');
const registryContent = readFileSync(registryPath, 'utf-8');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  // Kept for local debugging; package.json "files" leaves the map out of the
  // published tarball.
  sourcemap: true,
  clean: true,
  shims: true,
  noExternal: ['@modelcontextprotocol/sdk'],  // Bundle this dependency
  define: {
    'EMBEDDED_REGISTRY': JSON.stringify(registryContent),
  },
  onSuccess: async () => {
    // Ship every source the embedded registry references, so the source tools
    // work from an npm install. Throws, and so fails the build, when a file is
    // missing or its hash differs from the registry's sourceSha256.
    const { files, bytes } = bundleRegistrySources({
      registry: JSON.parse(registryContent),
      packagesRoot: join(__dirname, '..'),
      outDir: join(__dirname, 'dist/sources'),
    });
    console.log(
      `✓ Bundled ${files} registry sources (${(bytes / 1024).toFixed(0)} kB) → dist/sources, sha256 verified`
    );
  },
});

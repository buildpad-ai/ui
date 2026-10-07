import { defineConfig } from 'tsup';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { bundleRegistrySources } from './src/bundle-sources';

// Read registry.json at build time to embed it
const registryPath = join(__dirname, '../registry.json');
const registryContent = readFileSync(registryPath, 'utf-8');

export default defineConfig(() => {
  // Clean dist/ here, once per tsup run, instead of with `clean: true`. With
  // `clean`, tsup's declaration build (a parallel worker) deletes every
  // *.d.ts under dist/ when it starts. That includes registry sources that
  // onSuccess has already copied into dist/sources, such as
  // cli/templates/types/modules.d.ts, so the package would ship without them.
  rmSync(join(__dirname, 'dist'), { recursive: true, force: true });

  return {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    // Kept for local debugging; package.json "files" leaves the map out of the
    // published tarball.
    sourcemap: true,
    clean: false,
    shims: true,
    noExternal: ['@modelcontextprotocol/sdk'],  // Bundle this dependency
    define: {
      'EMBEDDED_REGISTRY': JSON.stringify(registryContent),
    },
    onSuccess: async () => {
      // Ship every source the embedded registry references, so the source
      // tools work from an npm install. Throws, and so fails the build, when a
      // file is missing or its hash differs from the registry's sourceSha256.
      const { files, bytes } = bundleRegistrySources({
        registry: JSON.parse(registryContent),
        packagesRoot: join(__dirname, '..'),
        outDir: join(__dirname, 'dist/sources'),
      });
      console.log(
        `✓ Bundled ${files} registry sources (${(bytes / 1024).toFixed(0)} kB) → dist/sources, sha256 verified`
      );
    },
  };
});

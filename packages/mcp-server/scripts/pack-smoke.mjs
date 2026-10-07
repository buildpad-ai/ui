#!/usr/bin/env node
/**
 * Pack-and-install smoke test for @buildpad/mcp. Run it after `pnpm build`:
 *
 *   node packages/mcp-server/scripts/pack-smoke.mjs
 *
 * Unit tests import the server from src/ inside the monorepo, where sources
 * are read from packages/. That layout hid the bug this guards against: an
 * npm install has no packages/ tree, so every source tool came back empty.
 * This script tests the real artifact instead:
 *
 * 1. `npm pack` the package into a temp directory outside the repository.
 * 2. Check the tarball: every source registry.json references is under
 *    dist/sources, and no sourcemap is included.
 * 3. Install the tarball into a fresh temp project, plus a decoy
 *    node_modules/@buildpad tree that the old resolver would have read.
 * 4. Start the installed bin over stdio and call get_component (input),
 *    copy_component (collection-form with includeLib, and the external-oauth
 *    lib module) and resources/read. Every returned file must be non-empty
 *    and hash to the registry's sourceSha256.
 *
 * Exits non-zero on the first failure. Set KEEP_SMOKE_DIR=1 to keep the temp
 * directory for inspection.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Real paths on both sides, so a symlinked checkout or temp dir compares correctly.
const repoRoot = fs.realpathSync(path.resolve(pkgDir, '../..'));
const registry = JSON.parse(fs.readFileSync(path.join(pkgDir, '../registry.json'), 'utf-8'));
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

const hashSource = (text) =>
  createHash('sha256').update(text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')).digest('hex');

let failures = 0;
function check(ok, message) {
  if (ok) {
    console.log(`  ✓ ${message}`);
  } else {
    failures++;
    console.error(`  ✗ ${message}`);
  }
  return ok;
}

// Every registry source with its expected hash.
const bySource = new Map();
for (const entry of [...registry.components, ...Object.values(registry.lib)]) {
  for (const f of entry.files ?? []) bySource.set(f.source, f.sourceSha256);
}

/**
 * The registry hash for a returned file. Targets are looked up per entry:
 * two lib modules can write the same target from different sources
 * (api-routes and external-oauth both ship app/api/auth/callback/route.ts).
 */
function expectedHash(entryName, target) {
  const entry = registry.components.find(c => c.name === entryName) ?? registry.lib[entryName];
  return entry?.files?.find(f => f.target === target)?.sourceSha256;
}

/** files: [{ path, content, module? }]; `entryName` is used when `module` is absent. */
function matchesRegistry(files, label, entryName) {
  const bad = files.filter(f =>
    !f.content || hashSource(f.content) !== expectedHash(f.module ?? entryName, f.path));
  check(files.length > 0 && bad.length === 0,
    `${label}: ${files.length} file(s), all non-empty and matching registry sourceSha256` +
    (bad.length ? ` (mismatched: ${bad.slice(0, 5).map(f => f.path).join(', ')})` : ''));
}

// ─── 1. Pack outside the repository ──────────────────────────────

/** True when `child` is `parent` or inside it. Both must be real paths. */
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

// Check before creating anything, so a refused run leaves nothing behind.
const tmpBase = fs.realpathSync(process.env.SMOKE_TMPDIR ?? os.tmpdir());
if (isInside(repoRoot, tmpBase)) {
  console.error(`Temp directory ${tmpBase} is inside the repository; set SMOKE_TMPDIR to a directory outside it.`);
  process.exit(1);
}
const work = fs.mkdtempSync(path.join(tmpBase, 'buildpad-mcp-smoke-'));

let server;
function cleanup() {
  server?.kill();
  if (process.env.KEEP_SMOKE_DIR) console.log(`\nKept ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
}

try {
  console.log(`@buildpad/mcp pack smoke test (work dir ${work})\n`);
  console.log('Tarball');
  const [pack] = JSON.parse(execFileSync(npm, ['pack', '--json', '--pack-destination', work], {
    cwd: pkgDir,
    encoding: 'utf-8',
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'inherit'],
  }));
  console.log(`  ${pack.filename}: ${pack.size} bytes packed, ${pack.unpackedSize} unpacked, ${pack.entryCount} files`);
  const packed = new Set(pack.files.map(f => f.path));
  const missingFromTarball = [...bySource.keys()].filter(s => !packed.has(`dist/sources/${s}`));
  check(missingFromTarball.length === 0,
    `every registry source (${bySource.size}) is in dist/sources` +
    (missingFromTarball.length ? ` — missing: ${missingFromTarball.slice(0, 5).join(', ')}` : ''));
  check(!pack.files.some(f => f.path.endsWith('.map')), 'no sourcemaps in the tarball');
  check(packed.has('dist/index.js') && packed.has('README.md'), 'dist/index.js and README.md are included');

  // ─── 2. Install into a fresh project ───────────────────────────

  console.log('\nInstall');
  const project = path.join(work, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'mcp-smoke', private: true }));
  execFileSync(npm, ['install', '--no-audit', '--no-fund', '--ignore-scripts', path.join(work, pack.filename)], {
    cwd: project,
    shell: isWindows,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const installed = path.join(project, 'node_modules', '@buildpad', 'mcp');
  const badInstalled = [...bySource].filter(([source, expected]) => {
    const file = path.join(installed, 'dist', 'sources', source);
    return !fs.existsSync(file) || hashSource(fs.readFileSync(file, 'utf-8')) !== expected;
  });
  check(badInstalled.length === 0, `installed dist/sources: ${bySource.size} files match the registry`);

  // The old resolver read <prefix>/node_modules/@buildpad/<pkg>/src/...; plant
  // a decoy there (and a registry.json, the monorepo marker) to prove it is
  // never consulted.
  const decoy = path.join(project, 'node_modules', '@buildpad', 'ui-interfaces', 'src', 'input', 'Input.tsx');
  fs.mkdirSync(path.dirname(decoy), { recursive: true });
  fs.writeFileSync(decoy, 'export const DECOY = true;\n');
  fs.writeFileSync(path.join(project, 'node_modules', '@buildpad', 'registry.json'), '{}');

  // ─── 3. Drive the installed bin over stdio ─────────────────────

  console.log('\nServer (stdio)');
  const bin = isWindows
    ? [process.execPath, [path.join(installed, 'dist', 'index.js')]]
    : [path.join(project, 'node_modules', '.bin', 'buildpad-mcp'), []];
  server = spawn(bin[0], bin[1], { cwd: project, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  server.stderr.on('data', d => { stderr += d; });

  const pending = new Map();
  let buffer = '';
  server.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        waiter(msg);
      }
    }
  });
  // Rejects if the server exits while a request is outstanding. Handled here
  // so the deliberate kill at the end is not an unhandled rejection.
  const exited = new Promise((_, reject) => {
    server.on('exit', code => reject(new Error(`server exited (${code}); stderr:\n${stderr}`)));
  });
  exited.catch(() => {});

  let nextId = 1;
  const send = (message) => server.stdin.write(`${JSON.stringify(message)}\n`);
  const request = (method, params) => {
    const id = nextId++;
    const reply = new Promise((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => reject(new Error(`${method} timed out; server stderr:\n${stderr}`)), 30_000).unref();
    });
    send({ jsonrpc: '2.0', id, method, params });
    return Promise.race([reply, exited]);
  };
  const callTool = async (name, args) => {
    const msg = await request('tools/call', { name, arguments: args });
    if (msg.error) throw new Error(`${name}: ${msg.error.message}`);
    return msg.result;
  };

  const init = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'buildpad-mcp-pack-smoke', version: '0.0.0' },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  check(init.result?.serverInfo?.name === 'buildpad-mcp-server',
    `initialize: ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version}`);

  // The embedded registry is the one these hashes come from.
  const listed = JSON.parse((await callTool('list_components', {})).content[0].text);
  const listedInput = listed.find(c => c.name === 'input');
  check(!!listedInput && listedInput.files[0].sourceSha256 === expectedHash('input', listedInput.files[0].target),
    'embedded registry matches packages/registry.json');

  // get_component input
  const gc = await callTool('get_component', { name: 'input' });
  const gcBody = gc.isError ? {} : JSON.parse(gc.content[0].text);
  check(!gc.isError, 'get_component input: no isError');
  matchesRegistry(Object.entries(gcBody.allSources ?? {}).map(([p, content]) => ({ path: p, content })),
    'get_component input allSources', 'input');
  check(!!gcBody.source && !gcBody.source.includes('DECOY'), 'get_component input: primary source is the bundled file, not the decoy');

  // copy_component collection-form with lib
  const cc = await callTool('copy_component', { name: 'collection-form', includeLib: true });
  const ccBody = cc.isError ? {} : JSON.parse(cc.content[0].text);
  check(!cc.isError, 'copy_component collection-form: no isError');
  matchesRegistry(ccBody.files ?? [], 'copy_component collection-form files', 'collection-form');
  matchesRegistry(ccBody.libFiles ?? [], 'copy_component collection-form libFiles');

  // copy_component on a lib module with dependencies
  const lib = await callTool('copy_component', { name: 'external-oauth' });
  const libBody = lib.isError ? {} : JSON.parse(lib.content[0].text);
  check(!lib.isError, 'copy_component external-oauth: no isError');
  matchesRegistry(libBody.files ?? [], 'copy_component external-oauth files (with its lib dependencies)');

  // resources/read
  const rr = await request('resources/read', { uri: 'buildpad://components/input' });
  const text = rr.result?.contents?.[0]?.text ?? '';
  check(!rr.error && hashSource(text) === registry.components.find(c => c.name === 'input').files[0].sourceSha256,
    `resources/read buildpad://components/input: ${text.length} chars matching the registry` +
    (rr.error ? ` (error: ${rr.error.message})` : ''));
} catch (err) {
  failures++;
  console.error(`\n✗ ${err.stack ?? err}`);
} finally {
  cleanup();
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll pack smoke checks passed.');

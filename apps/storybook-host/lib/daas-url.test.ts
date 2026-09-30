/**
 * Unit tests for the DaaS URL validator (SSRF guard).
 *
 * Run from the repo root (no extra deps — uses node:test via tsx):
 *   pnpm exec tsx --test apps/storybook-host/lib/daas-url.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDaaSTargetUrl,
  hostMatchesAllowList,
  isNonPublicIp,
  parseAllowedHosts,
  validateDaaSUrl,
  type DaaSUrlOptions,
} from './daas-url';

const prod: DaaSUrlOptions = {
  nodeEnv: 'production',
  allowedHosts: ['*.buildpad-daas.xtremax.com'],
};
const dev: DaaSUrlOptions = { ...prod, nodeEnv: 'development' };

function ok(input: unknown, opts: DaaSUrlOptions = prod): string {
  const r = validateDaaSUrl(input, opts);
  assert.equal(r.ok, true, `expected ${String(input)} to be accepted: ${!r.ok ? r.error : ''}`);
  return (r as { ok: true; url: string }).url;
}

function rejected(input: unknown, opts: DaaSUrlOptions = prod): string {
  const r = validateDaaSUrl(input, opts);
  assert.equal(r.ok, false, `expected ${String(input)} to be rejected`);
  return (r as { ok: false; error: string }).error;
}

describe('validateDaaSUrl', () => {
  it('accepts allowed https hosts and normalises', () => {
    assert.equal(ok('https://acme.buildpad-daas.xtremax.com'), 'https://acme.buildpad-daas.xtremax.com');
    assert.equal(ok('https://acme.buildpad-daas.xtremax.com/'), 'https://acme.buildpad-daas.xtremax.com');
    assert.equal(ok('  https://ACME.Buildpad-DaaS.xtremax.com//  '), 'https://acme.buildpad-daas.xtremax.com');
    assert.equal(ok('https://a.b.buildpad-daas.xtremax.com:8443/daas/'), 'https://a.b.buildpad-daas.xtremax.com:8443/daas');
  });

  it('strips search and hash (no path truncation tricks)', () => {
    assert.equal(ok('https://acme.buildpad-daas.xtremax.com/?'), 'https://acme.buildpad-daas.xtremax.com');
    assert.equal(ok('https://acme.buildpad-daas.xtremax.com#'), 'https://acme.buildpad-daas.xtremax.com');
    assert.equal(ok('https://acme.buildpad-daas.xtremax.com/x?a=1#frag'), 'https://acme.buildpad-daas.xtremax.com/x');
  });

  it('rejects non-string / empty / malformed input', () => {
    rejected(undefined);
    rejected(123);
    rejected('');
    rejected('not a url');
    rejected('acme.buildpad-daas.xtremax.com');
    rejected(`https://acme.buildpad-daas.xtremax.com/${'a'.repeat(3000)}`);
  });

  it('requires https', () => {
    rejected('http://acme.buildpad-daas.xtremax.com');
    rejected('http://acme.buildpad-daas.xtremax.com', dev);
    rejected('ftp://acme.buildpad-daas.xtremax.com');
    rejected('file:///etc/passwd');
    rejected('javascript:alert(1)');
  });

  it('rejects credentials in the URL', () => {
    rejected('https://user:pass@acme.buildpad-daas.xtremax.com');
    rejected('https://user@acme.buildpad-daas.xtremax.com');
  });

  it('rejects hosts outside the allow-list', () => {
    assert.match(rejected('https://evil.example.com'), /not allowed/);
    rejected('https://buildpad-daas.xtremax.com'); // apex does not match *.
    rejected('https://evilbuildpad-daas.xtremax.com');
    rejected('https://acme.buildpad-daas.xtremax.com.evil.com');
    rejected('https://acme.buildpad-daas.xtremax.com.'); // trailing dot
  });

  it('rejects private / loopback / link-local IP literals', () => {
    for (const u of [
      'https://169.254.169.254',
      'https://127.0.0.1',
      'https://2130706433', // 127.0.0.1 in decimal
      'https://0x7f.1', // 127.0.0.1 in hex shorthand
      'https://10.0.0.1',
      'https://172.16.5.4',
      'https://192.168.1.1',
      'https://0.0.0.0',
      'https://[::1]',
      'https://[::]',
      'https://[fe80::1]',
      'https://[fd00::1]',
      'https://[::ffff:169.254.169.254]',
      'https://[::ffff:127.0.0.1]',
    ]) {
      rejected(u);
      // Even if someone allow-lists the IP explicitly.
      const host = new URL(u).hostname;
      rejected(u, { nodeEnv: 'production', allowedHosts: [host] });
    }
  });

  it('wildcards never match IP literals; exact public IPs can be allow-listed', () => {
    rejected('https://8.8.8.8', { nodeEnv: 'production', allowedHosts: ['*.8.8'] });
    assert.equal(ok('https://8.8.8.8', { nodeEnv: 'production', allowedHosts: ['8.8.8.8'] }), 'https://8.8.8.8');
  });

  it('allows localhost only outside production', () => {
    assert.equal(ok('http://localhost:8055', dev), 'http://localhost:8055');
    assert.equal(ok('http://127.0.0.1:8055/', dev), 'http://127.0.0.1:8055');
    assert.equal(ok('https://localhost:8055', dev), 'https://localhost:8055');
    rejected('http://localhost:8055', prod);
    rejected('https://localhost:8055', prod);
    rejected('http://localhost.evil.com', dev);
    rejected('http://10.0.0.1', dev);
  });

  it('honours a custom allow-list with exact and wildcard entries', () => {
    const opts: DaaSUrlOptions = {
      nodeEnv: 'production',
      allowedHosts: parseAllowedHosts('daas.example.org, *.corp.example.net'),
    };
    ok('https://daas.example.org', opts);
    ok('https://x.corp.example.net', opts);
    rejected('https://sub.daas.example.org', opts);
    rejected('https://acme.buildpad-daas.xtremax.com', opts);
  });
});

describe('parseAllowedHosts', () => {
  it('defaults when unset or blank', () => {
    assert.deepEqual(parseAllowedHosts(undefined), ['*.buildpad-daas.xtremax.com']);
    assert.deepEqual(parseAllowedHosts(' , '), ['*.buildpad-daas.xtremax.com']);
  });
  it('trims, lower-cases and drops empties', () => {
    assert.deepEqual(parseAllowedHosts(' A.com ,, *.B.org. '), ['a.com', '*.b.org']);
  });
});

describe('hostMatchesAllowList', () => {
  it('matches exact and wildcard entries', () => {
    assert.equal(hostMatchesAllowList('a.example.com', ['*.example.com']), true);
    assert.equal(hostMatchesAllowList('example.com', ['*.example.com']), false);
    assert.equal(hostMatchesAllowList('example.com', ['example.com']), true);
    assert.equal(hostMatchesAllowList('badexample.com', ['*.example.com']), false);
  });
});

describe('isNonPublicIp', () => {
  it('classifies addresses', () => {
    assert.equal(isNonPublicIp('100.64.0.1'), true);
    assert.equal(isNonPublicIp('172.32.0.1'), false);
    assert.equal(isNonPublicIp('1.1.1.1'), false);
    assert.equal(isNonPublicIp('[2606:4700::1111]'), false);
    assert.equal(isNonPublicIp('[64:ff9b::a9fe:a9fe]'), true);
    assert.equal(isNonPublicIp('example.com'), false);
  });
});

describe('buildDaaSTargetUrl', () => {
  const base = 'https://acme.buildpad-daas.xtremax.com/daas';
  it('appends path and search under the base', () => {
    assert.equal(
      buildDaaSTargetUrl(base, '/api/items/posts', '?limit=1')?.href,
      'https://acme.buildpad-daas.xtremax.com/daas/api/items/posts?limit=1'
    );
  });
  it('never leaves the base origin', () => {
    assert.equal(
      buildDaaSTargetUrl(base, '/api/../../x')?.origin,
      'https://acme.buildpad-daas.xtremax.com'
    );
    const origin = 'https://acme.buildpad-daas.xtremax.com';
    assert.equal(buildDaaSTargetUrl(origin, '@evil.com/api'), null);
    assert.equal(buildDaaSTargetUrl(origin, '.evil.com/api'), null);
    assert.equal(buildDaaSTargetUrl(origin, '/api/x%3F%23y')?.href, `${origin}/api/x%3F%23y`);
  });
});

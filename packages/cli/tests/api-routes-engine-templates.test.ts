/**
 * api-routes on each backend: what the registry installs, and the templates
 * run as the app would run them.
 *
 * On an Engine project the browser can reach the Engine only through the app's
 * own /api routes (it accepts no cookie session and no credentialed
 * cross-origin request), so `api-routes-engine` points DaaSProviderWrapper at
 * the same origin and adds the proxies the hooks call. A Supabase project keeps
 * api-routes, which calls DaaS directly. Both get a Buildpad-First login page
 * and an assets route that passes Content-Disposition through.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Registry } from '../src/resolver.js';
import { libForBackend } from '../src/utils/project-backend.js';

const fake = vi.hoisted(() => ({ token: 'user-access-token' as string | null }));

vi.mock('@/lib/api/auth-headers', () => ({
  getAuthHeaders: async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (fake.token) headers['Authorization'] = `Bearer ${fake.token}`;
    return headers;
  },
  getDaasUrl: () => 'https://engine.test',
}));
vi.mock('@/lib/api/forward', async () => import('../templates/lib/api-forward'));

const CLI_ROOT = path.resolve(__dirname, '..');
const PACKAGES_ROOT = path.resolve(CLI_ROOT, '..');
const registry = JSON.parse(
  fs.readFileSync(path.join(PACKAGES_ROOT, 'registry.template.json'), 'utf8')
) as Registry;
const template = (source: string) => fs.readFileSync(path.join(PACKAGES_ROOT, source), 'utf8');

const apiRoutes = registry.lib['api-routes'];
const apiRoutesEngine = registry.lib['api-routes-engine'];
const sourceFor = (mod: typeof apiRoutes, target: string) => {
  const file = mod.files?.find(f => f.target === target);
  if (!file) throw new Error(`${mod.name} installs nothing at ${target}`);
  return file.source;
};

/** The starter's Buildpad-First check (every generated project's CLAUDE.md). */
const BUILDPAD_FIRST = /from '@mantine\/form'|<TextInput|<NumberInput|<Select |<Switch |<Checkbox |<DatePicker|<Dropzone/;

describe('registry: api-routes and its Engine variant', () => {
  test('api-routes names api-routes-engine, an Engine module that replaces it', () => {
    expect(apiRoutes.engineVariant).toBe('api-routes-engine');
    expect(apiRoutesEngine.backend).toBe('engine');
    expect(apiRoutesEngine.replaces).toEqual(['api-routes']);
  });

  test('api-routes-engine installs every api-routes target, plus the Engine-only proxies', () => {
    const supabase = new Set(apiRoutes.files!.map(f => f.target));
    const engine = new Set(apiRoutesEngine.files!.map(f => f.target));
    for (const target of supabase) expect(engine).toContain(target);
    expect([...engine].filter(t => !supabase.has(t)).sort()).toEqual([
      'app/api/files/signed-url/route.ts',
      'app/api/permissions/[collection]/route.ts',
      'app/api/users/me/route.ts',
      'lib/api/forward.ts',
    ]);
    for (const file of apiRoutesEngine.files!) expect(fs.existsSync(path.join(PACKAGES_ROOT, file.source))).toBe(true);
  });

  test('both variants pull in the same lib modules and components (input for the login page)', () => {
    expect(apiRoutesEngine.internalDependencies).toEqual(apiRoutes.internalDependencies);
    expect(apiRoutesEngine.registryDependencies).toEqual(apiRoutes.registryDependencies);
    expect(apiRoutes.registryDependencies).toContain('input');
  });

  test('only the provider wrapper, the assets route and the login page differ on shared targets', () => {
    const differing = apiRoutes.files!
      .filter(f => sourceFor(apiRoutesEngine, f.target) !== f.source)
      .map(f => f.target)
      .sort();
    expect(differing).toEqual([
      'app/[lang]/login/page.tsx',
      'app/api/assets/[id]/route.ts',
      'components/DaaSProviderWrapper.tsx',
    ]);
  });

  test('every module that depends on api-routes resolves on both backends', () => {
    const dependents = Object.values(registry.lib).filter(m =>
      m.internalDependencies?.some(d => d === 'api-routes' || d === 'api-routes-engine')
    );
    expect(dependents.map(m => m.name)).toEqual(expect.arrayContaining(['files-routes', 'users-routes', 'external-oauth-engine']));
    for (const mod of dependents) {
      for (const dep of mod.internalDependencies!) {
        if (!dep.startsWith('api-routes')) continue;
        if (mod.backend !== 'engine') expect(libForBackend(dep, registry, 'supabase')).toBe('api-routes');
        expect(libForBackend(dep, registry, 'engine')).toBe('api-routes-engine');
      }
    }
  });

  test('external-oauth-engine depends on api-routes-engine and replaces its callback', () => {
    const oauth = registry.lib['external-oauth-engine'];
    expect(oauth.internalDependencies).toContain('api-routes-engine');
    expect(oauth.replaces).toEqual(expect.arrayContaining(['external-oauth', 'api-routes', 'api-routes-engine']));
  });
});

describe('DaaSProviderWrapper', () => {
  test('Engine: same origin, so the hooks call the app’s /api proxy routes', () => {
    const src = template(sourceFor(apiRoutesEngine, 'components/DaaSProviderWrapper.tsx'));
    expect(src).toMatch(/^\s+url: "",$/m);
    expect(src).not.toContain('NEXT_PUBLIC_BUILDPAD_DAAS_URL');
  });

  test('Supabase: DaaS directly, as before', () => {
    const src = template(sourceFor(apiRoutes, 'components/DaaSProviderWrapper.tsx'));
    expect(src).toContain('url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? ""');
  });

  test('the two differ only in the URL and the comments that explain it', () => {
    const strip = (s: string) =>
      s.replace(/^\/\*\*[\s\S]*?\*\/\n/, '').replace(/^\s*\/\/.*\n/gm, '').replace(/^\s+url: .*\n/m, '');
    expect(strip(template(sourceFor(apiRoutesEngine, 'components/DaaSProviderWrapper.tsx')))).toBe(
      strip(template(sourceFor(apiRoutes, 'components/DaaSProviderWrapper.tsx')))
    );
  });
});

describe('login page', () => {
  const engine = template(sourceFor(apiRoutesEngine, 'app/[lang]/login/page.tsx'));
  const supabase = template(sourceFor(apiRoutes, 'app/[lang]/login/page.tsx'));

  test.each([
    ['Engine', engine],
    ['Supabase', supabase],
  ])('%s: Buildpad Input with plain state validation, no Mantine form inputs', (_label, src) => {
    expect(src).not.toMatch(BUILDPAD_FIRST);
    expect(src).not.toMatch(/<PasswordInput|useForm\(/);
    expect(src).toContain(`import { Input } from '@/components/ui/input';`);
    expect(src).toMatch(/<Input[\s\S]*?masked[\s\S]*?\/>/);
    expect(src).toContain('error={errors.email}');
    expect(src).toContain('error={errors.password}');
  });

  test('Engine has no password-recovery link; Supabase keeps it', () => {
    expect(engine).not.toContain('app.login.forgotPassword');
    expect(supabase).toContain('app.login.forgotPassword');
  });

  test('the two differ only in the password-recovery link', () => {
    const strip = (s: string) =>
      s
        .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')
        .replace(/^\s+Anchor,\n/m, '')
        .replace(/\n\s+<Group justify="flex-end" mt=\{-5\}>[\s\S]*?<\/Group>\n/, '\n')
        .replace(/\n\s+\{\/\* No "forgot password" link[\s\S]*?\*\/\}\n/, '\n');
    expect(strip(engine)).toBe(strip(supabase));
  });
});

// ── The routes, run against a fake Engine ─────────────────────────────

interface Call { url: string; method: string; headers: Record<string, string>; body: string | null }
let calls: Call[];
let answer: () => Response;

beforeEach(() => {
  fake.token = 'user-access-token';
  calls = [];
  answer = () => Response.json({ data: { ok: true } });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = init.body == null ? null
      : typeof init.body === 'string' ? init.body
      : Buffer.from(init.body as ArrayBuffer).toString('utf8');
    calls.push({ url, method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) }, body });
    return answer();
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(new URL(url, 'http://localhost:3000'), init);
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

describe('assets route', () => {
  const engineRoute = () => import('../templates/api/daas-assets-id-engine-route');
  const supabaseRoute = () => import('../templates/api/daas-assets-id-route');
  const fileAnswer = () =>
    new Response('PNG', {
      headers: {
        'content-type': 'image/png',
        'content-disposition': 'attachment; filename="report.png"',
        'content-length': '3',
        etag: '"abc"',
        'last-modified': 'Mon, 02 Nov 2026 00:00:00 GMT',
        'cache-control': 'private, max-age=60',
      },
    });

  test('Engine: forwards to /api/files/assets/:id with the user’s token', async () => {
    answer = fileAnswer;
    const { GET } = await engineRoute();

    const res = await GET(request('/api/assets/f1?key=thumb'), params({ id: 'f1' }));

    expect(calls[0].url).toBe('https://engine.test/api/files/assets/f1?key=thumb');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer user-access-token' });
    expect(await res.text()).toBe('PNG');
  });

  test('Supabase: forwards to DaaS /api/assets/:id, as before', async () => {
    answer = fileAnswer;
    const { GET } = await supabaseRoute();

    await GET(request('/api/assets/f1'), params({ id: 'f1' }));

    expect(calls[0].url).toBe('https://engine.test/api/assets/f1');
  });

  test.each([
    ['Engine', engineRoute],
    ['Supabase', supabaseRoute],
  ])('%s: passes the download headers through, so Download saves with the filename', async (_label, load) => {
    answer = fileAnswer;
    const { GET } = await load();

    const res = await GET(request('/api/assets/f1'), params({ id: 'f1' }));

    expect(res.headers.get('content-disposition')).toBe('attachment; filename="report.png"');
    expect(res.headers.get('content-length')).toBe('3');
    expect(res.headers.get('etag')).toBe('"abc"');
    expect(res.headers.get('last-modified')).toBe('Mon, 02 Nov 2026 00:00:00 GMT');
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});

describe('forwardToEngine', () => {
  test('sends the user’s token and the scope header, and passes the Engine’s answer back', async () => {
    answer = () => Response.json({ errors: [{ message: 'nope' }] }, { status: 403 });
    const { forwardToEngine } = await import('../templates/lib/api-forward');

    const res = await forwardToEngine(
      request('/api/x?fields=id', { headers: { 'x-resource-uri': 'tenant/1' } }),
      '/api/x'
    );

    expect(calls[0]).toMatchObject({
      url: 'https://engine.test/api/x?fields=id',
      method: 'GET',
      body: null,
      headers: { Authorization: 'Bearer user-access-token', 'X-Resource-Uri': 'tenant/1' },
    });
    expect(calls[0].headers['Content-Type']).toBeUndefined();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ errors: [{ message: 'nope' }] });
  });

  test('forwards a multipart body with its own content type', async () => {
    const { forwardToEngine } = await import('../templates/lib/api-forward');

    await forwardToEngine(
      request('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
        body: '--xyz--',
      }),
      '/api/files'
    );

    expect(calls[0].headers['Content-Type']).toBe('multipart/form-data; boundary=xyz');
    expect(calls[0].body).toBe('--xyz--');
  });

  test('204 stays empty; an unreachable Engine is a 502', async () => {
    const { forwardToEngine } = await import('../templates/lib/api-forward');
    answer = () => new Response(null, { status: 204 });
    expect((await forwardToEngine(request('/api/x', { method: 'DELETE' }), '/api/x')).status).toBe(204);

    answer = () => { throw new Error('connect ECONNREFUSED'); };
    const res = await forwardToEngine(request('/api/x'), '/api/x');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ errors: [{ message: 'connect ECONNREFUSED' }] });
  });
});

describe('Engine-only proxy routes', () => {
  test('GET /api/users/me forwards ?fields=', async () => {
    const { GET } = await import('../templates/api/daas-users-me-engine-route');

    await GET(request('/api/users/me?fields=id,email'));

    expect(calls[0].url).toBe('https://engine.test/api/users/me?fields=id%2Cemail');
  });

  test('PATCH /api/users/me drops password fields', async () => {
    const { PATCH } = await import('../templates/api/daas-users-me-engine-route');

    await PATCH(request('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ first_name: 'Ana', password: 'x', current_password: 'y' }),
    }));

    expect(calls[0].method).toBe('PATCH');
    expect(JSON.parse(calls[0].body!)).toEqual({ first_name: 'Ana' });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
  });

  test('GET /api/files/signed-url makes the Engine’s relative URL absolute', async () => {
    answer = () => Response.json({ data: { url: '/api/files/assets/f1?token=t', expires: 60 } });
    const { GET } = await import('../templates/api/daas-files-signed-url-engine-route');

    const res = await GET(request('/api/files/signed-url?id=f1&expires=60'));

    expect(calls[0].url).toBe('https://engine.test/api/files/signed-url?id=f1&expires=60');
    expect(await res.json()).toEqual({ data: { url: 'https://engine.test/api/files/assets/f1?token=t', expires: 60 } });
  });

  test('GET /api/files/signed-url keeps a full S3 URL, and passes an error through', async () => {
    const { GET } = await import('../templates/api/daas-files-signed-url-engine-route');
    answer = () => Response.json({ data: { url: 'https://s3.test/f1?sig=1' } });
    expect(await (await GET(request('/api/files/signed-url?id=f1'))).json()).toEqual({ data: { url: 'https://s3.test/f1?sig=1' } });

    answer = () => Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 });
    expect((await GET(request('/api/files/signed-url?id=f1'))).status).toBe(403);
  });

  test('POST and DELETE /api/files/signed-url forward the body', async () => {
    const { POST, DELETE } = await import('../templates/api/daas-files-signed-url-engine-route');
    const json = { 'content-type': 'application/json' };

    await POST(request('/api/files/signed-url', { method: 'POST', headers: json, body: '{"type":"image/png"}' }));
    await DELETE(request('/api/files/signed-url', { method: 'DELETE', headers: json, body: '{"upload_token":"u"}' }));

    expect(calls.map(c => [c.method, c.url, c.body])).toEqual([
      ['POST', 'https://engine.test/api/files/signed-url', '{"type":"image/png"}'],
      ['DELETE', 'https://engine.test/api/files/signed-url', '{"upload_token":"u"}'],
    ]);
  });

  test('GET /api/permissions/[collection] forwards to the collection, encoded', async () => {
    answer = () => Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 });
    const { GET } = await import('../templates/api/daas-permissions-collection-engine-route');

    const res = await GET(request('/api/permissions/daas_files'), params({ collection: 'daas files' }));

    expect(calls[0].url).toBe('https://engine.test/api/permissions/daas%20files');
    // usePermissions reads a 403 as "no extra rules" — it must reach the hook as a 403.
    expect(res.status).toBe(403);
  });
});

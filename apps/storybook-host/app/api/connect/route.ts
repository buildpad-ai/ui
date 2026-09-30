/**
 * POST /api/connect
 *
 * Receives DaaS URL + static token, validates the URL against the SSRF
 * allow-list (lib/daas-url.ts), validates the connection by calling
 * /api/users/me, then stores the config in an encrypted cookie.
 *
 * CSRF hardening: only `application/json` bodies are accepted (a cross-site
 * HTML form cannot send that without a CORS preflight), and a present
 * Origin header must match this host.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CookieSecretError, setDaaSConfig } from '@/lib/cookie';
import { buildDaaSTargetUrl, validateDaaSUrl } from '@/lib/daas-url';
import { isJsonContentType, originMatchesHost } from '@/lib/request-guards';

const MAX_TOKEN_LENGTH = 4096;
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function POST(request: NextRequest) {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }

  if (!originMatchesHost(request)) {
    return NextResponse.json(
      { error: 'Cross-origin requests are not allowed' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, token } = (body ?? {}) as { url?: unknown; token?: unknown };

  if (!url || !token) {
    return NextResponse.json(
      { error: 'DaaS URL and token are required' },
      { status: 400 }
    );
  }
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || /[\r\n]/.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const validated = validateDaaSUrl(url);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const cleanUrl = validated.url;

  const testUrl = buildDaaSTargetUrl(cleanUrl, '/api/users/me');
  if (!testUrl) {
    return NextResponse.json({ error: 'Invalid DaaS URL' }, { status: 400 });
  }

  // Test connection by fetching the current user. Never follow redirects:
  // a redirect could point at an internal address.
  let testResponse: Response;
  try {
    testResponse = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('[DaaS connect] Upstream request failed:', error);
    return NextResponse.json(
      { error: 'Could not reach the DaaS server. Check the URL and try again.' },
      { status: 502 }
    );
  }

  if (testResponse.status >= 300 && testResponse.status < 400) {
    return NextResponse.json(
      {
        error: `Connection failed (${testResponse.status}): the DaaS server responded with a redirect. Use the final DaaS URL directly.`,
      },
      { status: 400 }
    );
  }

  if (!testResponse.ok) {
    // Do not echo the upstream body back to the client.
    const hint =
      testResponse.status === 401 || testResponse.status === 403
        ? ' Check your static token.'
        : '';
    return NextResponse.json(
      { error: `Connection failed (${testResponse.status}).${hint}` },
      { status: 400 }
    );
  }

  let userData: { data?: unknown } & Record<string, unknown>;
  try {
    userData = await testResponse.json();
  } catch {
    return NextResponse.json(
      { error: 'Connection failed: the server did not return a DaaS user response.' },
      { status: 400 }
    );
  }

  try {
    // Save config to encrypted httpOnly cookie
    await setDaaSConfig({ url: cleanUrl, token });
  } catch (error) {
    console.error('[DaaS connect] Failed to store config:', error);
    return NextResponse.json(
      {
        error:
          error instanceof CookieSecretError
            ? 'Server is not configured to store DaaS credentials (COOKIE_SECRET).'
            : 'Failed to store DaaS connection',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    user: userData?.data || userData,
  });
}

/**
 * DaaS Catch-All Proxy Route
 *
 * Proxies any /api/* request to the configured DaaS backend.
 * Reads the DaaS URL and token from an encrypted httpOnly cookie
 * set by the /api/connect endpoint.
 *
 * This is the key piece that eliminates CORS issues — the browser
 * talks to the same origin and this server-side route forwards
 * the request with the Bearer token.
 *
 * SSRF guard: the stored URL is re-validated against the allow-list on
 * every request (lib/daas-url.ts), the upstream URL is built from the raw
 * request path and checked to stay on the validated origin, and upstream redirects
 * are never followed or relayed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearDaaSConfig, CookieSecretError, getDaaSConfig } from '@/lib/cookie';
import { buildDaaSTargetUrl, validateDaaSUrl } from '@/lib/daas-url';

type RouteParams = { params: Promise<{ path: string[] }> };

const UPSTREAM_TIMEOUT_MS = 30_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ errors: [{ message }] }, { status });
}

async function proxyToDaaS(
  request: NextRequest,
  { params }: RouteParams
) {
  let config;
  try {
    config = await getDaaSConfig();
  } catch (error) {
    if (error instanceof CookieSecretError) {
      console.error('[DaaS Proxy]', error.message);
      return errorResponse('DaaS proxy is not configured on this server.', 500);
    }
    throw error;
  }

  if (!config) {
    return errorResponse(
      'Not connected to DaaS. Configure your connection at the settings page.',
      401
    );
  }

  // Re-validate the stored URL on every request (the allow-list may have
  // changed since the cookie was issued).
  const validated = validateDaaSUrl(config.url);
  if (!validated.ok) {
    await clearDaaSConfig();
    return errorResponse(
      `Stored DaaS connection is no longer allowed: ${validated.error} Please reconnect.`,
      401
    );
  }

  // Use the raw (still percent-encoded, already dot-normalised) request
  // pathname rather than re-joining decoded params, so an encoded `?`, `#`
  // or `/` in a segment can't change the upstream URL's structure.
  const { path } = await params;
  const daasPath = request.nextUrl.pathname;
  if (!path?.length || !daasPath.startsWith('/api/')) {
    return errorResponse('Invalid path', 400);
  }
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = buildDaaSTargetUrl(
    validated.url,
    daasPath,
    searchParams ? `?${searchParams}` : ''
  );
  if (!targetUrl) {
    return errorResponse('Invalid path', 400);
  }

  // Build headers — inject Bearer token
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
  };

  // Forward content-type if present
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Build fetch options. Never follow redirects: a redirect could point at
  // an internal address.
  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };

  // Forward body for non-GET/HEAD requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) {
        fetchOptions.body = body;
      }
    } catch {
      // No body — that's fine
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    if (
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400)
    ) {
      // Don't relay Location (or the body) — just fail.
      await response.body?.cancel().catch(() => {});
      return errorResponse(
        'DaaS upstream responded with a redirect, which the proxy does not follow.',
        502
      );
    }

    const responseBody = await response.arrayBuffer();

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
        ...(response.headers.get('Cache-Control') && {
          'Cache-Control': response.headers.get('Cache-Control')!,
        }),
      },
    });
  } catch (error) {
    console.error('[DaaS Proxy] Error:', error);
    return errorResponse('Proxy request to DaaS failed.', 502);
  }
}

export const GET = proxyToDaaS;
export const POST = proxyToDaaS;
export const PATCH = proxyToDaaS;
export const PUT = proxyToDaaS;
export const DELETE = proxyToDaaS;

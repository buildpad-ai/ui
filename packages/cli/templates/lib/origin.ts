/**
 * Public Origin Resolution
 *
 * Behind a reverse proxy or serverless platform (AWS Amplify, CloudFront,
 * Vercel, a container behind an ALB), the Next.js server process listens on
 * `localhost`. `request.url` and `request.nextUrl.origin` therefore describe
 * the *process*, not the address the browser actually used — so anything
 * built from them (redirect targets, OAuth `redirect_uri`s, post-logout URIs)
 * points at `http://localhost:3000` and breaks.
 *
 * `NextResponse.redirect()` always emits an absolute `Location` header
 * computed server-side; it is never resolved client-side by the browser.
 * Every redirect target must therefore be built from the resolved public
 * origin below, never from `request.url`.
 *
 * ## Configuration
 *
 * Set `NEXT_PUBLIC_HOST_ORIGIN` (or the server-only `HOST_ORIGIN`) to the
 * app's public origin — e.g. `https://app.example.com`. This is STRONGLY
 * RECOMMENDED in production: without it this helper falls back to the
 * `x-forwarded-host` / `host` request headers, which are supplied by the
 * client and can be spoofed unless the proxy in front of the app overwrites
 * them. A spoofed host becomes the target of a redirect (an open redirect)
 * and the `post_logout_redirect_uri` handed to the IdP.
 *
 * `NEXT_PUBLIC_` is not about exposing a secret here — the origin is public
 * by definition. The prefix guarantees the value is inlined into the Edge
 * bundle, so the helper also works when called from `middleware.ts`.
 *
 * @buildpad/origin: lib/origin
 * @buildpad/version: 1.0.0
 */

import type { NextRequest } from 'next/server';

/**
 * Hostnames that mean "this process", never "the app's public address".
 * A chain of proxies that forwards one of these is telling us nothing
 * useful, so we fall through to the request's own origin instead.
 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/**
 * `X-Forwarded-*` headers accumulate one comma-separated entry per hop
 * (e.g. `x-forwarded-host: app.example.com, internal.amplify`). The first
 * entry is the one the client actually addressed.
 */
function firstHop(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

/** Strip the port so `localhost:3000` and `[::1]:3000` compare correctly. */
function hostname(host: string): string {
  const withoutPort = host.startsWith('[')
    ? (host.match(/^\[[^\]]*\]/)?.[0] ?? host) // IPv6 literal: [::1]:3000
    : (host.split(':')[0] ?? host);
  return withoutPort.toLowerCase();
}

/**
 * Resolve the app's real public origin, without a trailing slash.
 *
 * Order of preference:
 *   1. `HOST_ORIGIN` / `NEXT_PUBLIC_HOST_ORIGIN` — explicit and trustworthy.
 *   2. `x-forwarded-host` / `host` — correct behind a proxy that sets them,
 *      but client-supplied; ignored when it names a loopback address.
 *   3. `request.nextUrl.origin` — right for local dev and any deployment
 *      that is not behind a proxy.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.HOST_ORIGIN ?? process.env.NEXT_PUBLIC_HOST_ORIGIN;
  if (configured) {
    try {
      // `new URL().origin` validates the scheme and drops any path/trailing slash.
      return new URL(configured).origin;
    } catch {
      console.warn(
        `[origin] Ignoring invalid HOST_ORIGIN/NEXT_PUBLIC_HOST_ORIGIN: '${configured}'. ` +
          'Expected a full origin such as https://app.example.com'
      );
    }
  }

  const host =
    firstHop(request.headers.get('x-forwarded-host')) ?? firstHop(request.headers.get('host'));

  if (host && !LOOPBACK_HOSTNAMES.has(hostname(host))) {
    // Fall back to the request's own protocol rather than assuming https —
    // assuming it breaks dev servers bound to a LAN IP or 127.0.0.1.
    const proto =
      firstHop(request.headers.get('x-forwarded-proto')) ??
      request.nextUrl.protocol.replace(/:$/, '');
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

/**
 * Build an absolute URL on the app's own public origin.
 *
 * Use this instead of `new URL(path, request.url)` for every redirect that
 * stays inside the app.
 */
export function publicUrl(request: NextRequest, path: string): URL {
  return new URL(path, publicOrigin(request));
}

/**
 * Constrain a caller-supplied redirect target to a path on this app.
 *
 * `?next=https://evil.example` would otherwise resolve to an absolute URL on
 * someone else's origin and turn any redirect into an open redirect. Only
 * same-origin absolute *paths* are accepted; anything else yields `fallback`.
 */
export function safeRelativePath(path: string | null | undefined, fallback = '/'): string {
  if (!path) return fallback;
  // Must be an absolute path, and must not be scheme-relative. Browsers
  // normalise a leading backslash to a slash, so `/\evil.example` is
  // `//evil.example` in disguise — reject both second characters.
  if (!path.startsWith('/')) return fallback;
  if (path[1] === '/' || path[1] === '\\') return fallback;
  return path;
}

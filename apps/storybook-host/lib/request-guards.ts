/**
 * CSRF guards for state-changing host-app routes (/api/connect, /api/disconnect).
 */

import type { NextRequest } from 'next/server';

/** True when the Content-Type media type is exactly application/json. */
export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(';')[0].trim().toLowerCase() === 'application/json';
}

/** Hosts this request may legitimately originate from. */
function requestHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const first = value?.split(',')[0]?.trim().toLowerCase();
    if (first) hosts.add(first);
  };
  add(request.headers.get('host'));
  add(request.headers.get('x-forwarded-host'));
  add(request.nextUrl.host);
  return hosts;
}

/**
 * If an Origin header is present it must match this request's host.
 * Requests without Origin (non-browser clients) pass; `Origin: null` fails.
 */
export function originMatchesHost(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    return requestHosts(request).has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

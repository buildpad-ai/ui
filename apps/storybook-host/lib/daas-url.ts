/**
 * DaaS URL validation (SSRF guard).
 *
 * The host app makes server-side requests to a DaaS URL chosen by the
 * visitor. Without restrictions that turns the app into an open proxy that
 * can reach internal addresses (cloud metadata, localhost, RFC1918, ...).
 * Every URL the server fetches — at connect time AND on every proxied
 * request (the cookie value is re-validated) — must pass
 * `validateDaaSUrl`.
 *
 * Rules:
 *  - must parse with `new URL`
 *  - scheme must be `https:`; `http:` is allowed only for localhost when
 *    NODE_ENV !== 'production'
 *  - no username/password in the URL
 *  - search and hash are dropped; result is `origin + pathname` with no
 *    trailing slash
 *  - hostname must match the allow-list (`DAAS_ALLOWED_HOSTS`, comma
 *    separated, exact hosts or `*.suffix` wildcards; default
 *    `*.buildpad-daas.xtremax.com`)
 *  - IP-literal hostnames in private / loopback / link-local / reserved
 *    ranges are always rejected (wildcards never match IP literals)
 *  - localhost is accepted only outside production
 *
 * This module is pure (no Next.js imports) so it can be unit tested with
 * `node:test` — see `daas-url.test.ts`.
 */

export const DEFAULT_DAAS_ALLOWED_HOSTS = ['*.buildpad-daas.xtremax.com'];

export interface DaaSUrlOptions {
  /** Allow-list entries. Defaults to `DAAS_ALLOWED_HOSTS` / the default list. */
  allowedHosts?: string[];
  /** Defaults to `process.env.NODE_ENV`. */
  nodeEnv?: string;
}

export type DaaSUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const MAX_URL_LENGTH = 2048;
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Parse a comma-separated allow-list (e.g. the `DAAS_ALLOWED_HOSTS` env var). */
export function parseAllowedHosts(raw: string | undefined | null): string[] {
  if (!raw || !raw.trim()) return [...DEFAULT_DAAS_ALLOWED_HOSTS];
  const entries = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);
  return entries.length > 0 ? entries : [...DEFAULT_DAAS_ALLOWED_HOSTS];
}

/** Allow-list from the environment (read on every call so tests / runtime changes apply). */
export function getAllowedHosts(): string[] {
  return parseAllowedHosts(process.env.DAAS_ALLOWED_HOSTS);
}

/**
 * Does `hostname` (already lower-cased by the URL parser) match one entry?
 * `*.example.com` matches any subdomain of example.com (at least one extra
 * label) but not example.com itself. Wildcards never match IP literals.
 */
export function hostMatchesAllowList(
  hostname: string,
  allowedHosts: string[]
): boolean {
  const host = hostname.toLowerCase();
  const isIp = isIpLiteral(host);
  return allowedHosts.some((raw) => {
    const entry = raw.trim().toLowerCase();
    if (!entry) return false;
    if (entry.startsWith('*.')) {
      if (isIp) return false;
      const suffix = entry.slice(1); // ".example.com"
      return host.length > suffix.length && host.endsWith(suffix);
    }
    return host === entry;
  });
}

// ---------------------------------------------------------------------------
// IP literal helpers
// ---------------------------------------------------------------------------

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIpv4(host: string): number[] | null {
  const m = IPV4_RE.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

/** Expand an IPv6 literal (without brackets) to 8 16-bit groups. */
function parseIpv6(host: string): number[] | null {
  let addr = host;
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1);
  if (!addr.includes(':')) return null;
  // Strip zone id (not produced by WHATWG URL, but be defensive).
  addr = addr.split('%')[0];

  // Embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1).
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  const v4 = parseIpv4(tail);
  if (v4) {
    addr =
      addr.slice(0, lastColon + 1) +
      ((v4[0] << 8) | v4[1]).toString(16) +
      ':' +
      ((v4[2] << 8) | v4[3]).toString(16);
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));
  return nums.every((n) => !Number.isNaN(n)) ? nums : null;
}

export function isIpLiteral(hostname: string): boolean {
  return parseIpv4(hostname) !== null || parseIpv6(hostname) !== null;
}

function isNonPublicIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this" network
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast + reserved + broadcast
  );
}

function isNonPublicIpv6(g: number[]): boolean {
  const allZeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (allZeroPrefix(8)) return true; // ::
  if (allZeroPrefix(7) && g[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) — judge the embedded IPv4.
  if (allZeroPrefix(5) && (g[5] === 0xffff || g[5] === 0)) {
    return isNonPublicIpv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  // NAT64 64:ff9b::/96 — embedded IPv4
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isNonPublicIpv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // discard-only
  return false;
}

/** True for IP literals in private, loopback, link-local or otherwise non-public ranges. */
export function isNonPublicIp(hostname: string): boolean {
  const v4 = parseIpv4(hostname);
  if (v4) return isNonPublicIpv4(v4);
  const v6 = parseIpv6(hostname);
  if (v6) return isNonPublicIpv6(v6);
  return false;
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate and normalise a user-supplied DaaS base URL.
 * On success `url` is `origin + pathname` (no trailing slash, no query/hash).
 */
export function validateDaaSUrl(
  input: unknown,
  options: DaaSUrlOptions = {}
): DaaSUrlResult {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const allowedHosts = options.allowedHosts ?? getAllowedHosts();

  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'DaaS URL is required.' };
  }
  const raw = input.trim();
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'DaaS URL is too long.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      error: 'DaaS URL is not a valid URL (expected e.g. https://xxx.buildpad-daas.xtremax.com).',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = LOCALHOST_NAMES.has(hostname);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'DaaS URL must use https://.' };
  }
  if (parsed.protocol === 'http:' && (isProduction || !isLocalhost)) {
    return {
      ok: false,
      error: isProduction
        ? 'DaaS URL must use https://.'
        : 'DaaS URL must use https:// (http:// is only allowed for localhost in development).',
    };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'DaaS URL must not contain a username or password.' };
  }
  if (!hostname || hostname.endsWith('.')) {
    return { ok: false, error: 'DaaS URL has an invalid hostname.' };
  }

  if (isLocalhost) {
    if (isProduction) {
      return { ok: false, error: `DaaS host "${hostname}" is not allowed.` };
    }
    // Local development convenience: localhost bypasses the allow-list.
  } else {
    if (isNonPublicIp(hostname)) {
      return {
        ok: false,
        error: `DaaS host "${hostname}" is a private, loopback or link-local address and is not allowed.`,
      };
    }
    if (!hostMatchesAllowList(hostname, allowedHosts)) {
      return {
        ok: false,
        error: `DaaS host "${hostname}" is not allowed. Allowed hosts: ${allowedHosts.join(', ')}.`,
      };
    }
  }

  const pathname = parsed.pathname.replace(/\/+$/, ''); // NOSONAR: single anchored quantifier, linear
  return { ok: true, url: `${parsed.origin}${pathname}` };
}

/**
 * Build the upstream URL for `path` (must start with `/`) under a validated
 * base, and confirm the result did not escape the base origin.
 */
export function buildDaaSTargetUrl(
  base: string,
  path: string,
  search?: string
): URL | null {
  if (!path.startsWith('/')) return null;
  let baseUrl: URL;
  let target: URL;
  try {
    baseUrl = new URL(base);
    target = new URL(`${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, '')}${path}`); // NOSONAR: linear
  } catch {
    return null;
  }
  if (target.origin !== baseUrl.origin) return null;
  target.search = search ?? '';
  target.hash = '';
  return target;
}

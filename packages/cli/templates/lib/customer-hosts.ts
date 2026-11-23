/**
 * Customer hosts: which customer each host name stands for.
 *
 * THE APP OWNS THIS FILE. The CLI writes it once and never overwrites it
 * (not even `buildpad add --overwrite` or `upgrade`).
 *
 * A customer's host is exactly one DNS label in front of the app's customer
 * domain: `<slug>.<CUSTOMER_HOST_SUFFIX>`. The label is the customer's slug.
 * The Engine maps no host name to a tenant, so this map is the only place it
 * is decided; a customer not in it answers 404 at its host.
 *
 * The map is not committed. It is the server variable
 * `BUILDPAD_CUSTOMER_HOSTS`, JSON `{ "<slug>": "<tenant id>" }`, which the
 * Platform writes on each Amplify branch: Development's customers on `main`,
 * Production's on `production`. A member updates it, and redeploys the app,
 * with "Update and redeploy" on the Platform's Customers page; a new customer
 * is served from that deployment on. The value holds slugs and tenant ids
 * only. It is server-only: never give it a `NEXT_PUBLIC_` name, and never
 * import this file from a 'use client' module.
 *
 * On Amplify Hosting a server variable reaches the running app only through
 * `.env.production`, so `amplify.yml` writes it there before `next build`,
 * beside `BUILDPAD_ONBOARDING_KEY` (`buildpad add` adds this line when it
 * finds the file):
 *
 *   - '[ -z "$BUILDPAD_CUSTOMER_HOSTS" ] || echo "BUILDPAD_CUSTOMER_HOSTS=$BUILDPAD_CUSTOMER_HOSTS" >> .env.production'
 *
 * Locally, put a value in `.env.local` to try `<slug>.localhost`.
 *
 * The value is parsed once, when the server loads this module. A key that is
 * not one DNS label, or a value that is not a non-empty string, is dropped. A
 * missing, empty or unparsable value is the empty map (every customer host
 * answers 404), logged once, without the value.
 *
 * Used by `lib/oauth/tenant.ts` (external-oauth-engine-customers).
 *
 * @buildpad/origin: lib/customer-hosts
 * @buildpad/version: 1.1.0
 */

/** The customer domain, without a scheme, port or leading dot, e.g. `lms.apps.buildpad.ai`. Empty: no customer host. */
export const CUSTOMER_HOST_SUFFIX = '';

/** One DNS label: letters and digits, inner hyphens, at most 63 characters. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const VARIABLE = 'BUILDPAD_CUSTOMER_HOSTS';

/** Logged once per reason, never with the value. */
const warned = new Set<string>();
function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`Customer hosts: ${VARIABLE} ${reason}; no customer host is served.`);
}

/**
 * The slug → tenant id map in a `BUILDPAD_CUSTOMER_HOSTS` value. Keys are
 * lower-cased; a key that is not one DNS label, or a value that is not a
 * non-empty string, is dropped. Missing, empty or unparsable: the empty map.
 */
export function parseCustomerHosts(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = Object.create(null);
  if (raw === undefined || raw.trim() === '') {
    warnOnce('is not set');
    return map;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnOnce('is not JSON');
    return map;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnOnce('is not a JSON object');
    return map;
  }
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const slug = key.toLowerCase();
    if (!LABEL.test(slug) || typeof value !== 'string' || value.trim() === '') continue;
    map[slug] = value.trim();
  }
  return map;
}

// Read on the server at run time: a literal `process.env` read of a name
// without `NEXT_PUBLIC_`, which Next.js never sends to the browser.
const TENANT_IDS: Readonly<Record<string, string>> = parseCustomerHosts(process.env.BUILDPAD_CUSTOMER_HOSTS);

/** The customer's tenant id for a host's slug, or null when the slug is not a customer. */
export function tenantIdForSlug(slug: string): string | null {
  const key = slug.toLowerCase();
  return Object.prototype.hasOwnProperty.call(TENANT_IDS, key) ? TENANT_IDS[key] : null;
}

/** slug → the customer's tenant id and name (the variable carries no name, so the slug stands in). */
export const CUSTOMER_HOSTS: Readonly<Record<string, { tenantId: string; name: string }>> = Object.fromEntries(
  Object.entries(TENANT_IDS).map(([slug, tenantId]) => [slug, { tenantId, name: slug }])
);

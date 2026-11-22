/**
 * The tenant a sign-in request names, from its host (customer tenants)
 *
 * On an Engine project with customer tenants (`.buildpad/project.json`
 * `"tenancy": "customer-tenants"`), XAppHub sign-in signs a person in to the
 * customer whose host the request came to:
 *
 * - `<slug>.<customer domain>`, slug in `lib/customer-hosts.ts` → `customer`:
 *   that customer's tenant id is sent as `X-Tenant-Id`.
 * - `<label>.<customer domain>`, label not in the map → `unknown`: 404, and
 *   no sign-in starts.
 * - any other host (the app's own domain, the hosting's default domain,
 *   `localhost`) → `bare`: the Blueprint (`NEXT_PUBLIC_BUILDPAD_TENANT_ID`),
 *   for the developers' own sign-in, as before.
 * - in development only, `<slug>.localhost` stands for the customer's host.
 *
 * The host is the first `x-forwarded-host` entry, else `host`, lower-cased,
 * port dropped. The tenant is never read from `state`, a query parameter or
 * a cookie. A forged host changes only which tenant the person's OWN sign-in
 * targets: the Engine accepts the XAppHub token only in a tenant that trusts
 * the app's client, which the Platform turns on per customer once a project
 * Admin confirms this behaviour.
 *
 * Installed by the `external-oauth-engine-customers` lib module.
 *
 * @buildpad/origin: lib/oauth/tenant
 * @buildpad/version: 1.0.0
 */

import type { NextRequest } from 'next/server';
import { CUSTOMER_HOSTS, CUSTOMER_HOST_SUFFIX } from '@/lib/customer-hosts';
import { publicOrigin } from '@/lib/origin';

export type RequestTenant =
  | { kind: 'bare' }
  | { kind: 'customer'; slug: string; tenantId: string }
  | { kind: 'unknown'; slug: string };

/** Exactly one DNS label. */
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUFFIX = CUSTOMER_HOST_SUFFIX.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
const CUSTOMER = SUFFIX ? new RegExp(`^(${LABEL})\\.${escapeRegExp(SUFFIX)}$`) : null;
const DEV = new RegExp(`^(${LABEL})\\.localhost$`);

/** The host the client addressed: the first `x-forwarded-host` entry, else `host`. */
export function requestHost(headers: Pick<Headers, 'get'>): string | null {
  const first = (value: string | null) => value?.split(',')[0]?.trim() || null;
  return first(headers.get('x-forwarded-host')) ?? first(headers.get('host'));
}

/** Lower case, port dropped; null for an IPv6 literal or a trailing dot. */
export function hostnameOf(host: string | null): string | null {
  const value = host?.trim().toLowerCase();
  if (!value || value.startsWith('[')) return null;
  const name = value.split(':')[0];
  return name && !name.endsWith('.') ? name : null;
}

/** The tenant the request's host names. */
export function tenantForRequest(headers: Pick<Headers, 'get'>): RequestTenant {
  const name = hostnameOf(requestHost(headers));
  if (!name) return { kind: 'bare' };
  const match =
    CUSTOMER?.exec(name) ?? (process.env.NODE_ENV !== 'production' ? DEV.exec(name) : null);
  if (!match) return { kind: 'bare' };
  const slug = match[1];
  const entry = Object.prototype.hasOwnProperty.call(CUSTOMER_HOSTS, slug) ? CUSTOMER_HOSTS[slug] : undefined;
  return entry?.tenantId ? { kind: 'customer', slug, tenantId: entry.tenantId } : { kind: 'unknown', slug };
}

/**
 * The origin the sign-in runs on: the `redirect_uri` XAppHub sends the person
 * back to, the same value at the code exchange, and every redirect after it.
 *
 * On a customer's host, the request's own origin, rebuilt from the checked
 * host name (`https://<slug>.<customer domain>`, never the header's own text
 * or a port; `<slug>.localhost:<port>` over the request's protocol in
 * development), so the person comes back to that customer's host. XAppHub
 * accepts it only once it is registered there; the Platform's Connectors page
 * lists each customer's URL. On the bare host, `publicOrigin()` as before.
 */
export function signInOrigin(request: NextRequest, tenant: RequestTenant): string {
  if (tenant.kind !== 'customer') return publicOrigin(request);
  const host = requestHost(request.headers)!.trim().toLowerCase();
  const name = hostnameOf(host)!;
  if (name.endsWith('.localhost')) return new URL(`${request.nextUrl.protocol}//${host}`).origin;
  return `https://${name}`;
}

/**
 * Customer hosts: which customer each host name stands for.
 *
 * THE APP OWNS THIS FILE. The CLI writes it once, empty, and never
 * overwrites it (not even `buildpad add --overwrite` or `upgrade`).
 *
 * A customer's host is exactly one DNS label in front of the app's customer
 * domain: `<slug>.<CUSTOMER_HOST_SUFFIX>`. The label is the customer's slug.
 * Fill both values from the project's customers on the Platform
 * (`get_project_detail` → `customers[]`: `slug`, `id`, `name`), one line per
 * customer, and deploy. A customer not listed here answers 404 at its host;
 * the Engine maps no host name to a tenant, so this map is the only place it
 * is decided.
 *
 * An app that already keeps this map elsewhere (for example
 * `config/customer-hosts.ts`, as the skills' customer-tenants guide writes it)
 * keeps ONE copy: replace this file's body with
 *
 *   export { CUSTOMER_HOST_SUFFIX, CUSTOMER_HOSTS } from '@/config/customer-hosts';
 *
 * Used by `lib/oauth/tenant.ts` (external-oauth-engine-customers).
 *
 * @buildpad/origin: lib/customer-hosts
 * @buildpad/version: 1.0.0
 */

/** The customer domain, without a scheme, port or leading dot, e.g. `lms.apps.buildpad.ai`. Empty: no customer host. */
export const CUSTOMER_HOST_SUFFIX = '';

/** slug → the customer's tenant id (`customers[].id`) and name. */
export const CUSTOMER_HOSTS: Readonly<Record<string, { tenantId: string; name: string }>> = {
  // acme: { tenantId: '<customers[].id>', name: 'Acme' },
};

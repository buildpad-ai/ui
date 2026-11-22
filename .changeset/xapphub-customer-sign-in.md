---
"@buildpad/cli": minor
---

XAppHub sign-in at each customer's host for Engine projects with customer tenants. When `.buildpad/project.json` says `"backend": "engine"` and `"tenancy": "customer-tenants"`, `buildpad add external-oauth` (and `add external-oauth-engine`, `add --with-api`) now installs the new lib module `external-oauth-engine-customers`. It signs each person in to the customer whose host the request came to, `<slug>.<customer domain>`, and no longer sends everyone to the Blueprint tenant:

- `lib/oauth/tenant.ts` resolves the host (first `x-forwarded-host` entry, else `host`; lower case, port dropped) against the app's slug map `lib/customer-hosts.ts`. The CLI writes that map once, empty, and never overwrites it. Fill it from `get_project_detail` `customers[]`, or re-export the app's existing map (for example `config/customer-hosts.ts`).
- The sign-in start route answers 404 for a customer host that is not in the map, before any redirect. `redirect_uri` is the customer host's own origin, so the person comes back to that host. The bare host keeps today's origin.
- The callback resolves the host again, never from `state` or the query. It sends the customer's tenant id as `X-Tenant-Id`, the Blueprint (`NEXT_PUBLIC_BUILDPAD_TENANT_ID`) on the bare host, and answers 404 on an unknown customer host.

**Before you install it:** a `customer-tenants` app needs the project's XAppHub sign-in at customers confirmed on the Platform first. A project Admin confirms it on the Customers page, and `get_project_detail` then reports `externalSignIn.customers.reached: true`. Until then each customer's Engine does not trust the app's XAppHub client and refuses the sign-in. Each customer's callback URL must also be registered in XAppHub; the Platform's Connectors page lists them.

The `scope` mode, and a project whose `project.json` has no `tenancy` member, install `external-oauth-engine` with exactly the same files as before. `upgrade` does not switch modules: on a customer-tenants project that still has `external-oauth-engine`, it prints the `add` command that switches. Registry files can now be marked `adoptOnce`, which means written once and never overwritten by `add --overwrite` or `upgrade`.

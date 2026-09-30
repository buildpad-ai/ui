---
"@buildpad/services": minor
"@buildpad/cli": minor
---

More fail-closed fixes in `auth/enforcer` and `auth/session`, found while adding tests for them.

- Only an explicit `true` grants: `check_permission` results and `admin_access` values such as `'false'`, `1` or `{}` used to count as granted/admin (in `enforcePermission`, `getUserPermissions`, `getPermissionFilters` and `isAdmin()`, which also returned the raw value).
- `getUserPermissions` and `getPermissionFilters` ignored errors from the admin and policy lookups.
- `getPermissionFilters` returned `undefined` — read by callers as "no filter", full access — for a permission row without a `permissions` key; any malformed row now denies.
- `getAccessibleFields` passed a non-array RPC result through, so a bare `'*'` string granted every field.
- An empty `Bearer ` token is rejected before any lookup.
- The deny-all filter is now `id IS NULL AND id IS NOT NULL`. The old `id = '__DENY_ALL__'` made PostgREST answer 400 instead of an empty result on uuid and integer `id` columns.

Known gap, not changed here: `daas_users.status` is only checked for static tokens, so a suspended user keeps a cookie/JWT session until it expires.

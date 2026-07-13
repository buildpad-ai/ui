---
'@buildpad/ui-users': minor
'@buildpad/hooks': minor
'@buildpad/types': minor
'@buildpad/cli': minor
'@buildpad/mcp': minor
---

New users-management module: `@buildpad/ui-users` package with the full RBAC
admin surface — `UsersManager`/`UserDetail` (role assignment, status, static
token, direct policy attachment), `RolesManager`/`RoleDetail` (hierarchy,
scope-assignment rules, membership management, policy attachment), and
`PoliciesManager`/`PolicyDetail` (access flags + per-collection permissions
matrix via `system-permissions`). Adds `useUsers`/`useRoles`/`usePolicies`/
`useAccess` hooks and `parseDaaSError` to `@buildpad/hooks`, `User`/`Role`/
`Policy`/`Access` types to `@buildpad/types`, and the `users-management`
component + `users-routes` lib module (six page templates) to the registry.
Ships a Playwright e2e suite (`playwright.users.config.ts`, `test:users:*`
scripts) with an API-tier module-flow + RBAC-matrix spec and a Storybook-tier
smoke spec, verified against a live DaaS4 instance.

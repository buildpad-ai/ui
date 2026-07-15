# @buildpad/mcp

## 1.8.1

## 1.8.0

## 1.7.0

### Minor Changes

- 90dc795: New users-management module: `@buildpad/ui-users` package with the full RBAC
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

## 1.6.0

## 1.5.0

## 1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Minor Changes

- Renamed from `@buildpad/mcp-server` to `@buildpad/mcp`.
- npm publishing support.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- The MCP server now reports its version from `package.json` instead of a hardcoded string.

## 0.2.0

### Minor Changes

- **`get_package_versions`** — returns the `packages` map from the registry (`{ "@buildpad/ui-interfaces": { version, changelogUrl }, … }`).

- **`list_outdated({ projectPath })`** — mirrors `npx buildpad outdated --json`. Returns a structured list of components with available updates, including `currentVersion`, `latestVersion`, `lastChangedIn`, and `sourcePackage`.

- **`get_component_changelog({ component, sinceVersion? })`** — fetches the CHANGELOG.md slice for a component or source package since the given version (or since the installed version when omitted).

- **`get_upgrade_plan({ projectPath, components? })`** — read-only. Returns a per-component plan with `{ version, breaking, modifiedLocally, recommendedAction, diffPreview }`. Reads `buildpad.json` from `projectPath` and compares disk file hashes against recorded checksums to determine `modifiedLocally`.

- **`apply_upgrade({ projectPath, component, strategy })`** — invokes the same code path as `npx buildpad upgrade`. Strategy must be one of `overwrite`, `new-file`, or `three-way`. Validates `projectPath` before writing. Documented as a write tool.

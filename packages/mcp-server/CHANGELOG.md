# @buildpad/mcp

## 2.1.0

## 2.0.0

### Major Changes

- 2d8b838: Versioning and upgrade redesign: content-based staleness, pinned fetches, manifest v3.

  **Breaking: `buildpad.json` moves to schema v3.** Run `npx buildpad migrate` once
  after upgrading the CLI. An older CLI refuses to read a v3 manifest rather than
  silently dropping fields it does not understand.

  The CLI used to decide that a component was stale by comparing version numbers
  (`installed.version >= component.lastChangedIn`). That made correctness depend on
  `lastChangedIn`, which the registry build derives from full git history plus the
  tags present at build time — so a missing tag, a shallow clone, or a release-PR
  step done in the wrong order produced wrong answers. It now compares content.

  ### What changed

  - **Staleness is a hash comparison.** The registry has always recorded each
    file's `sourceSha256`; the manifest now records the same hash at install time.
    A file is stale when the two differ, or when a previous upgrade left it
    unwritten. No version, tag, or git history is consulted, so the same inputs
    give the same answer on any machine on any day.

  - **Every remote fetch is pinned to `v<cli version>`,** not to `main`. Between
    `1.10.0` and `1.11.1`, 119 source files changed on `main` while the registry
    still declared `1.10.0` — so `add` copied post-release content and recorded it
    under the previous release, and `upgrade --three-way` then merged against an
    ancestor older than what was actually installed. `npx @buildpad/cli@X.Y.Z` now
    resolves the same bytes on any day. `--ref <git-ref>` (or `BUILDPAD_REF`)
    overrides it for development, and whatever a fetch resolved to is recorded.

  - **The diff3 base is exact.** Each file records the ref it was fetched from,
    and `upgrade` fetches the base from that ref instead of guessing a tag from a
    version number. When the ref is unreachable the CLI writes a `.new` file and
    marks the entry `pending` rather than merging against the wrong ancestor.

  - **A partial upgrade is no longer recorded as complete.** Skipping a file or
    writing a `.new` keeps the file's old upstream hash and marks it `pending`, so
    `outdated` keeps reporting it. Previously the component version was advanced
    regardless and the skipped file never surfaced again.

  - **No prompt when upstream did not move.** A locally-modified file whose
    upstream hash is unchanged is left alone. It used to be offered for overwrite
    with byte-identical content whenever any sibling file in the component changed.

  - **Files removed upstream are kept and reported,** not deleted — they are the
    consumer's code — and are dropped from tracking so they stop reporting stale.

  - **`outdated` reports per file** (`changed upstream`, `pending`, `new file`,
    `removed upstream`) and hints when the CLI itself is behind npm's `latest`,
    since a pinned CLI is otherwise honestly "up to date" against its own registry
    forever. The npm check is advisory and skipped when npm is unreachable.

  - **`buildpad migrate` converts v2 to v3** by fetching the registry at
    `v<recorded version>` and copying out the real upstream hashes. Where that tag
    is unreachable it falls back to the current hashes and marks the files
    `pending`, so a guessed baseline cannot pass unnoticed.

  ### Release pipeline

  - `publish.yml` regenerates `registry.json` inside the changesets `version` step,
    so the bot's commit carries a registry that matches the bumped versions. This
    was a manual step in the release PR; forgetting it failed `registry:check`,
    and doing it before the bump wrote wrong `lastChangedIn` values.
  - Each publish now pushes one plain `v<version>` tag. Without it a release is
    unreachable to the pinned CLI. `scripts/backfill-release-tags.sh` creates the
    tags for the 17 historical releases.
  - The "quick publish (skip changesets)" procedure is removed. It is how
    `@buildpad/cli@1.11.0` reached npm with no tag, no changelog, and no commit.

  ### Other

  - Repository URLs point at `buildpad-ai/ui`; fetches no longer rely on the
    GitHub rename redirect from `microbuild-ui/ui`.
  - The CLI's duplicate `inferSourcePackage` is removed — it had already drifted
    from the registry generator's copy (missing `ui-forms/` and `ui-users/`). The
    CLI reads `sourcePackage` from the registry.
  - `lastChangedIn` remains in the registry as display data; no decision reads it.
    The "never release below 1.1.0" version floor is no longer needed.

## 1.11.1

## 1.10.0

### Minor Changes

- 5981327: Add first-class support for **Module-Level Access** — application capability
  flags that are not tied to a collection — and retire the superseded
  `custom_permissions` approach.

  DaaS has two independent permission dimensions. Record-Level Access
  (`daas_permissions`) covers collection CRUD; Module-Level Access
  (`daas_policies.module_access`, keyed by the `daas_module_access_keys` registry)
  covers named capabilities like `reports:export`. The platform has shipped the
  second dimension, but this repo had no support for it at all — so every
  `hasModuleAccess(...)` call the agent skills instruct agents to write was a
  runtime error.

  **New API**

  - `@buildpad/types` — `ModuleAccessKey`, `ModuleAccessMap`,
    `MODULE_ACCESS_KEY_PATTERN`, `RESERVED_MODULE_ACCESS_NAMESPACES`, and
    `Policy.module_access`.
  - `@buildpad/services` — `PermissionsService.hasModuleAccess()` / `.moduleAccess`
    / `.ensureLoaded()`, plus `ModuleAccessKeysService` for registry CRUD (via the
    generic items API — DaaS exposes no dedicated route) and `buildModuleAccessTree`.
  - `@buildpad/hooks` — `usePermissions()` now returns `moduleAccess` and
    `hasModuleAccess`; new `useModuleAccess(key)`, `useModuleAccessMap()`, and
    `useModuleAccessKeys()`.
  - `@buildpad/ui-users` — `ModuleAccessPanel` (mounted as the "Module-Level
    Access" tab of `PolicyDetail`, beside the renamed "Record-Level Access" tab)
    and `ModuleAccessKeysManager` for the registry.
  - `@buildpad/cli` — `lib/module-access/enforce.ts` server guard
    (`enforceModuleAccess` → `ModuleAccessError(403)`) and the
    `/module-access-keys` page; both registered.
  - `@buildpad/mcp` — new `get_module_access_pattern` tool; `get_rbac_pattern`
    now returns a `moduleAccess` section pointing at it, so agents stop reaching
    for role-name checks on non-CRUD gates.

  **`hasModuleAccess` fails closed.** It returns `false` while loading and on
  error — deliberately unlike `canPerform`, which is optimistic. A capability flag
  gates something the user is presumed _not_ to have, so an unresolved state must
  never render the gated control. Render a skeleton while `loading` if flicker
  matters.

  **Permission caches are now scope-keyed.** DaaS resolves `/permissions/me`
  against the active Resource URI, so `PermissionsService`'s 30s cache keys on the
  `daas_resource_uri` cookie and `usePermissions` refetches when it changes.
  Without this a tenant switch served the previous tenant's permissions.

  **Removed:** `cli/templates/lib/permissions/custom.ts` and
  `cli/templates/components/CustomPermissionsEditor.tsx`. These implemented the
  superseded `custom_permissions` design and were non-functional against current
  DaaS — the column and the `/api/permissions/me/custom` endpoint they depend on
  do not exist. They were never in the registry, so `buildpad add` could not
  install them; no project can have them via tooling. Projects that copied them by
  hand should migrate to Module-Level Access (keys must be lowercased to satisfy
  the platform key format).

## 1.9.3

## 1.9.2

## 1.9.1

## 1.9.0

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

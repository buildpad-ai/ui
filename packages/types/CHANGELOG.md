# @buildpad/types

## 3.1.0

### Minor Changes

- 45feba0: Data layer for a Cron Jobs admin module: types, data hooks, form logic and translations. No components yet.

  - **Types** (`@buildpad/types`, `cron.ts`): `CronJobRecord` (a `daas_cron_jobs` row), `CronRunRecord` (a `daas_cron_history` row), `CronJobStatus`, `CronRunStatus` and `CronTriggeredBy` with their value lists, the create and update bodies (`CronJobInput`, `CronJobPatch`), `CronRunResult`, and the list shapes (`CronListResult<T>`, `CronRunListResult`). The two collection names are constants (`CRON_COLLECTIONS`); gate on `CRON_JOBS_COLLECTION` (`daas_cron_jobs`), the one name both backends check for every cron route, the history routes included.
  - On a `CronJobRecord` only `id` and `name` are certain: both backends drop a column the caller's grant withholds, `code` above all.
  - **Hooks** (`@buildpad/hooks`): `useCronJobs` (list with search and status, get, create, update, delete, clone, run) and `useCronRuns` (the runs of every job, or of one, paged by `page` or `offset`). They work against both backends through `apiRequest`, with no proxy routes: list counts are read from `count`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, run counts from `meta.total`/`limit`/`offset`, `data: null` is an empty page, and the paging parameters are always sent.
  - Every method rejects with a `DaaSRequestError`. An id that is not a valid one is `notFound` on both backends (one answers 404, the other 400 `INVALID_ID`). The refusals the Next.js routes answer as a 500 are read as what they mean: a save, a delete or a run on a job that is gone is `notFound`, a save the caller's row rule refuses is `forbidden`, and code that does not compile is `invalid`.
  - `runJob` resolves when the run has ended, to `{ historyId, skipped, message }`. `skipped` is `true` when the job was already running and nothing ran; a run whose code failed still resolves, and its outcome is the history row's status.
  - `updateJob` sends a cleared description as `null`, which both backends store as no description, and `createJob` leaves a blank one out. `cloneJob` does not send a blank name.
  - **Form logic** (`@buildpad/utils`, `cron.ts`): `changedCronJobFields` builds a save from the fields the user changed, so a status changed elsewhere is not overwritten and an emptied description is sent; `cronTimezoneOptions` adds a stored timezone outside the 26 UTC offsets (`CRON_TIMEZONE_OPTIONS`) as its own option and `displayCronTimezone` labels it; `cronJobToForm` and `withheldCronJobFields` read a job answered without some of its columns; `normalizeCronTimeoutMs` and `normalizeCronMemoryLimitMb` keep a decimal out of the two integer columns; `findCronJobFormProblem` returns what refuses a save, with a code to translate; `cronJobInputFromForm` builds a create; `parseCronLogLine` takes a `[time] [LEVEL] message` log entry apart, also when the message spans several lines. `DEFAULT_CRON_CODE` and `CRON_FORM_DEFAULTS` are what a new job starts with; the default code logs the run's context and returns, which runs on both backends.
  - **Translations** (`@buildpad/utils`): a `cron` namespace with English defaults and the Indonesian catalog.

  `buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.

## 3.0.0

### Minor Changes

- 42ab7ff: Data layer for a Workflows admin module: types, data hooks, editor logic and translations. No components yet.

  - **Types** (`@buildpad/types`, `workflow.ts`): `WorkflowDefinitionRecord`, `WorkflowAssignmentRecord`, `WorkflowInstanceRecord`, `WorkflowHistoryRecord`, the `workflow_json` document (`WorkflowJson`, `WorkflowJsonState`, `WorkflowJsonCommand` with `module_access_keys`, `sourceHandle` and `targetHandle`, `WorkflowJsonAction`), the create and update bodies, and `WorkflowListResult<T>`. The four collection names are constants (`WORKFLOW_COLLECTIONS`: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance`, `daas_wf_history`); gate on these, they are the names the API enforces. The older, narrower `WorkflowAssignment`, `WorkflowState` and `WorkflowInstance` types of `@buildpad/hooks`, and the workflow button's own types, are unchanged.
  - **Hooks** (`@buildpad/hooks`): `useWorkflowDefinitions` (list, load every page for a picker, get, create, update, delete), `useWorkflowAssignments` (list, get, create, update, delete) and `useWorkflowInstances` (list, get, full transition history). They work against both backends: list counts are read from `count`/`totalCount`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, `data: null` is an empty page, and `page` and `limit` are always sent.
  - `WorkflowDefinitionRecord.workflow_json` is optional: both backends drop a field the caller's grant withholds, and the hooks do not put an empty machine in its place. `updateDefinition` sends a cleared description as an empty string, which both backends store (the Go engine ignores a `null` there).
  - **Typed errors** (`@buildpad/hooks`): every method of these hooks rejects with a `DaaSRequestError` whose `kind` is `notFound`, `forbidden`, `mfaRequired`, `unauthenticated`, `invalid` or `failure`, with the status, the backend's error code, and the readable message from `parseDaaSError`. A failed load is never an empty list, and a get never resolves without a record. `toDaaSRequestError`, `readDaaSListResponse`, `buildDaaSListQuery`, `readDaaSRecord` and `useDaaSRequest` are exported for other data hooks.
  - **Editor logic** (`@buildpad/utils`): `buildWorkflowCommand` and `buildWorkflowState` build what a dialog saves on top of the stored object, so keys the form has no field for (a command's `module_access_keys`) and the stored key order survive; `findWorkflowCommandProblem`, `findWorkflowStateProblem` and `findWorkflowDefinitionProblem` return what refuses a save, with a code to translate; `applyWorkflowStateSave` and `applyWorkflowCommandSave` apply a dialog's result to the document; `normalizeWorkflowJson` gives every command its `actions` and `policies` arrays; `isWorkflowFilterRule` and `parseWorkflowFilterRule` accept only an object of conditions (or none) as an assignment's filter rule. `clampPage` and `pageAfterRemoval` keep a paged list off a page that no longer exists after a delete.
  - **Translations** (`@buildpad/utils`): a `workflows` namespace with English defaults and the Indonesian catalog.

  `buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.

## 2.6.0

## 2.5.0

## 2.4.0

### Minor Changes

- eec0a9e: Fix the bugs and code smells reported by a SonarQube scan.

  Most of the changes are refactors with no change in behavior: unused imports, variables and callbacks removed; `Number.parseInt`/`Number.isNaN`, `RegExp#exec`, `Set` lookups and `??=` used where they apply; `node:` imports for Node built-ins (including the CLI's `lib/oauth/pkce.ts` template); and the two most complex functions, the MCP server's tool dispatcher and the CLI's `upgrade`, split into smaller functions. The changes you can see:

  - **`generateToken`** (`@buildpad/ui-users`) throws when `crypto.getRandomValues` is unavailable, instead of falling back to the predictable `Math.random()`.
  - **Keyboard access:** the header context-menu items in `CollectionList`, and the inline "all / none" and "reset" links in `SystemPermissions`, now respond to Enter and Space.
  - **Editable rows keep their input:** removing a scope-pattern row in `RoleDetail` or a condition row in `ConditionsEditor` no longer moves the cursor into another row's field.
  - **No more `[object Object]`:** an object value renders as JSON in `CollectionList`'s choice, uuid and collection-item-dropdown cells and in `formatFieldValue`. `ListM2M` builds no item link for an object key, `ListO2M` substitutes `null` for an object in a filter template, and `AutocompleteAPI` no longer gives every result the same value when `textPath` or `valuePath` resolves to an object.
  - **Sorting:** the `Tags` interface sorts alphabetically with `localeCompare`, so mixed-case and accented tags sort correctly.
  - **Relation hooks** use `isExistingItem` instead of the deprecated `isValidPrimaryKey`.
  - **Errors:** three failure paths log the caught error before they show their failure message.
  - **MCP server:** importing the module no longer starts the stdio server (`node dist/index.js` still does), and the tool handler is exported as `handleCallToolRequest`.

  Also adds tests, and `test:coverage` scripts with lcov output for SonarQube.

## 2.3.0

## 2.2.0

## 2.1.0

## 2.0.0

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

### Patch Changes

- Released in lockstep; no functional changes.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.

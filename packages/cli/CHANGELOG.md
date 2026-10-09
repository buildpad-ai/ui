# @buildpad/cli

## 3.2.0

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

- 0578a05: The Cron Jobs module is installable: the `cron-management` registry component and the `cron-routes` lib module. `buildpad add cron-routes` installs the whole feature.

  **Registry and CLI**

  - `cron-management` (category `admin`, not part of `add --all`): the 20 source files of `@buildpad/ui-cron` under `components/ui/cron-management/`; depends on the `types`, `hooks`, `services` and `utils` lib modules and on the `vtable` and `input-code` components (`input-code` is the built-in code editor). No new npm dependency.
  - `cron-routes`: two pages under `app/[lang]/(authenticated)/` — `/cron` (`CronJobsManager`) and `/cron/[id]` (`CronJobDetail`; `/cron/new` creates) — and one sidebar entry, Cron Jobs (`IconClock`), in the Automation section the workflow routes use. The app dictionary gains `app.nav.cron`; an existing app gets it from `buildpad upgrade i18n`, and the sidebar shows the English label until then.
  - The editor does not navigate, so the installed detail page moves to `/cron/<id>` of the stored job in `onCreated`, as the reference admin UI does. After a save of an existing job it stays on the editor.
  - `@buildpad/ui-cron` imports are rewritten to `@/components/ui/cron-management` (subpaths kebab-cased).
  - `@buildpad/mcp` embeds the same registry, so `list_components`, `list_lib_modules` and `copy_component` serve both entries.

  Docs: the Cron Jobs Module Recipe page (install, the two routes, component props, the `renderCodeEditor` slot with an example of a syntax-highlighting editor, permissions on `daas_cron_jobs`, both backends, prerequisites).

## 3.0.0

### Major Changes

- 37df067: `collection-form`, `collection-list`, `list-m2a`'s `JunctionItemForm` and the relation hooks read interface ids through the interface manifest's predicates instead of their own id lists. Each accepts exactly the ids it accepted before:

  - `CollectionForm` and `CollectionList`: their two copies of `NON_FLAT_RELATIONAL_SPECIALS` + `NON_FLAT_RELATIONAL_INTERFACES` became one utils helper, `isNonFlatRelationalField()` (an m2a/m2m/o2m special, or the list-o2m/list-m2m/list-m2a interfaces); the two `selfPersistingInterfaces` sets became `isSelfPersistingInterface()` (files); the alias-field presentation check became `isRenderedPresentationInterface()` (presentation-divider, presentation-notice).
  - `JunctionItemForm` keeps any `presentation-*` alias field through `isPresentationLikeInterface()`.
  - `useRelationO2M`, `useRelationM2M` and `useRelationM2A` check the field through `isRelationListInterface()` (`one-to-many` is still accepted by `useRelationO2M`).

  These files import the predicates from the utils barrel (`@/lib/buildpad/utils`), so they need the 3.0 utils lib, which the 3.0 `buildpad upgrade` brings along with them.

  The `hooks` lib module now declares `utils` in its `internalDependencies` (registry metadata only; no file moves). Its sources import `@buildpad/utils` directly, and until now `utils` was reachable only through `services`. Installing `hooks` behaves the same, because `services` already pulled `utils` in.

- 9544e24: Add the interface manifest, `lib/buildpad/interface-manifest.ts`: one data table of field-interface identity, with an entry per interface id (aliases, registry component, component export name, compatible field types, group, behaviour flags, form-builder picker descriptor, loading class). The interface tables that were kept by hand are derived from it, under their old names and with their old values. How stored records render does not change.

  - `getFieldInterface` resolves the legacy alias ids (`textarea`, `wysiwyg`, the xtremax workflow ids, …) through `normalizeInterfaceId()`; they are no longer extra `case` labels. The switch first sees the id with only the registry aliases resolved (as in 2.6), so a `case` a project added for a legacy id or its own variant is still reached; only an id no case names falls back to its manifest renderer id. `REGISTRY_INTERFACE_ALIASES`, the concealing set, `CHOICE_INTERFACES`, `PROVISIONABLE_INTERFACES` and `isPresentationField` are derived from the manifest.
  - The utils barrel exports the manifest and its helpers (`INTERFACE_MANIFEST`, `normalizeInterfaceId`, `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`, `isNonFlatRelationalInterface`, `isSelfPersistingInterface`, `isRelationListInterface`, …), and the field-level `isNonFlatRelationalField(field)` (an m2a/m2m/o2m special or a list-o2m/m2m/m2a interface).
  - `InterfaceGroup` gains `'system'`, the registry group of `system-permissions` (a `Record<InterfaceGroup, …>` needs a `system` key). The `InterfaceType` literals the mapper never returns (`textarea`, `number`, `uuid`, `list-m2o`) are marked `@deprecated` and kept.
  - `interface-registry`, `define-interface` and `load-interfaces` are deprecated: nothing populates that registry and VForm never reads it. They stay exported. With the new `'system'` group, `InterfaceRegistry.getGrouped(true)` returns 8 groups (it used to drop `system` interfaces) and `getInterfacesForApi` names that group "System".

  Upgrade with the 3.0 CLI, which upgrades an entry's dependencies with it; see docs/MIGRATION-3.0.md.

- 60ae923: Break the ui-form → ui-interfaces → ui-collections → ui-form package cycle with a relational UI context.

  - New lib file `lib/buildpad/services/relational-ui-context.tsx` (`@buildpad/services/relational-ui-context`): `RelationalUIProvider`, `useRelationalUI`, `mergeRelationalUI`, `missingRelationalUI` and structural slot types for `CollectionForm`, `CollectionList` and `FormRenderer` (VForm). Nested providers merge; `defaults` only fill slots nothing above supplies. Also re-exported from the services barrel.
  - `ListO2M`, `ListM2M`, `ListM2A` and `JunctionItemForm` no longer import `@buildpad/ui-collections` / `@buildpad/ui-form`. They take those components from a new optional `components` prop, then the relational provider, and render each in its own Suspense boundary (new `components/ui/list-m2a/relational-slots.tsx`). With no provider they render a translated alert (`interfaces.relationalUI`, en + id) and hide the create / select / edit actions whose dialog component is missing; listing, removing and reordering still work.
  - `CollectionForm` supplies `{ CollectionForm, CollectionList (React.lazy), FormRenderer: VForm }` to the fields it renders; `VForm` supplies `{ FormRenderer: VForm }`. Both only fill slots a provider above did not choose. `collection-form` now declares `collection-list` as a registry dependency.
  - New `CollectionsRelationalProvider` (exported from `collection-form`) for standalone relational interfaces and standalone `VForm`s with relational fields. The CLI's `/content` layout template and `FormPreview`'s offline VForm use it.
  - Standalone `<ListO2M>` / `<ListM2M>` / `<ListM2A>` and plain `<VForm>`s with relational fields must now be wrapped in a provider (or given `components`) to create, select or edit related items. See docs/MIGRATION-3.0.md.
  - Monorepo: `@buildpad/ui-interfaces` drops its peer/dev dependencies on `@buildpad/ui-collections` and `@buildpad/ui-form`; the root build is utils first, then `pnpm -r build`; `packages/ui-collections/dist` is no longer committed; `pnpm graph:check` allows no package cycle.

- 0620c1b: The scaffolded authenticated route-group layout (`app/[lang]/(authenticated)/layout.tsx`, lib module `api-routes`) wraps every authenticated page in `CollectionsRelationalProvider` (imported from `@/components/ui/collections-relational-provider`, which loads the form components on demand), so standalone `ListO2M` / `ListM2M` / `ListM2A` and plain `VForm`s with relational fields work on any authenticated page. `api-routes` therefore declares `collection-form` as a registry dependency. `add --with-api` (and `bootstrap`) now install the components the API lib modules declare, and `add <lib>` also installs the components of lib modules it pulls in that are not installed yet (e.g. `add external-oauth` → `api-routes` → `collection-form`). A 2.6 project with `api-routes` but without `collection-form` must run `buildpad add collection-form` after upgrading. docs/MIGRATION-3.0.md also says to use a plain `buildpad upgrade` for the 3.0 upgrade: `upgrade <name>` does not co-upgrade dependencies yet.
- bd52d96: `buildpad upgrade` brings the dependencies of what it upgrades.

  The new source of an entry imports the new source of the entries it depends on, so upgrading one entry alone could leave a project that does not compile (3.0's `list-o2m` imports a services file and a `list-m2a` file that 2.6 does not have). `upgrade` now follows the registry's dependency lists (`internalDependencies`, `registryDependencies`) from every entry it upgrades, through components and lib modules alike:

  - An installed, out-of-date dependency is upgraded in the same run. Edited files go through `--strategy` as usual; nothing is overwritten silently.
  - A dependency the project does not have is installed and added to `components/ui/index.ts`. Until now only missing lib modules were installed, so a 2.6 project with `api-routes` but no `collection-form` had to run `add` by hand.
  - Up-to-date dependencies, and out-of-date entries nothing selected depends on, are left alone. `--force` re-syncs the selected entries only.

  The run lists what it brings along, and which entry needs it, before it writes anything. This applies to named entries, `--package`, a bare `upgrade` and `--all`; `--design` stays scoped to the design-system module. The new `--no-deps` flag upgrades only the selected entries, as before. `upgrade <name>` for a component the project does not have now installs it properly (it used to write the files without listing the component as installed).

  MCP: `get_upgrade_plan` and `apply_upgrade` follow the same rule. A named entry's plan includes its outdated component dependencies as well as lib modules, and lists `staleComponentDependencies` and `missingDependencies`. `apply_upgrade` names every dependency on the command line and runs the CLI with `--no-deps`, so the entries it checked (nothing newer than the server is moved backwards) are the entries the CLI touches; its result adds `componentDependencies` and `missingDependencies`. The option is now `includeDependencies`; `includeLibDependencies` is still accepted.

- 5147727: VForm loads heavy interface components on demand and no longer imports the components barrel.

  - New `vform` file `components/ui/vform/components/interface-components.tsx`: `EAGER_INTERFACE_COMPONENTS` (the light controls, imported statically, each from its own file) and `LAZY_INTERFACE_COMPONENTS` (`RichTextHTML`, `RichTextMarkdown`, `InputBlockEditor`, `SelectIcon`, `Map`, `AutocompleteAPI`, `CollectionItemDropdown`, `File`, `FileImage`, `Files`, `ListO2M`, `ListM2M`, `ListM2A`, each behind `React.lazy(() => import(…))`). A form bundles only the eager table; before, `FormFieldInterface` imported `@/components/ui` and with it every installed component.
  - `FormFieldInterface` reads the interface manifest instead of its own tables: the component name comes from the new `getRenderedInterfaceEntry(type)` (an entry id or a deprecated type literal), the csv normalisation from the `csvMultiValue` flag. While a lazy component loads, the field shows a skeleton of the manifest's `fallbackHeight` in its own Suspense boundary. A `client-only` component (the block editor) is not rendered until the page has hydrated; VForm now loads `input-block-editor.tsx` directly, not the `next/dynamic` wrapper.
  - A component the tables do not name is looked up on demand in the components barrel, as before: `SystemPermissions` (which `vform` does not install) and a project's own interfaces (`my-widget` → `MyWidget`) keep rendering, and an unknown one still shows the "Interface component not found" alert. A failed component load is reported by the field's error boundary.
  - `FormGroupField` imports the three group interfaces from their own files.
  - `@buildpad/utils` exports `getRenderedInterfaceEntry` (also from the consumer utils barrel).
  - Monorepo: `@buildpad/ui-interfaces` gains the subpath exports `./input-hash`, `./select-dropdown-m2o`, `./select-multiple-dropdown` and `./select-multiple-checkbox-tree`, so each interface can be imported by the path its registry component installs under.

  How stored records render does not change: every interface id resolves to the same component with the same props. Tests that render a lazy interface through VForm must now wait for it (`findBy…`). Upgrade the whole project (`buildpad upgrade`) with the 3.0 CLI; see docs/MIGRATION-3.0.md.

### Minor Changes

- bf82134: Sanitize stored block-editor content before rendering it.

  `InputBlockEditor` passed a stored value straight to EditorJS, which assigns paragraph, header, quote, list, checklist and table strings to `innerHTML` without sanitizing them — its sanitizer only runs on save and paste. A value saved with `<img src=x onerror=…>` in a paragraph therefore ran script for whoever opened the item, read-only views included.

  Every string in a block's data now goes through DOMPurify, limited to the inline markup the editor's own tools produce (bold, italic, underline, inline code, links, marks, line breaks). `javascript:` links and event handlers are removed. Code blocks are left alone: they render as plain text, and markup is their content.

  The component gains a `dompurify` dependency; `buildpad add input-block-editor` and `buildpad fix` install it.

- dbbf3e1: Dependency security upgrades.

  `pnpm audit --prod` reported 125 advisories (3 critical, 58 high); it now reports none apart from one documented exception.

  - The CLI installs `@tiptap/*` ^3.31.4 (was ^3.13.0), `axios` ^1.20.0 (was ^1.6.0), `@mapbox/mapbox-gl-draw` ^1.5.2 and `dompurify` ^3.4.16 for the components that use them.
  - `@buildpad/mcp` moves to `@modelcontextprotocol/sdk` 1.x (was 0.5).
  - `maplibre-gl` stays on 5.x: its critical attribution XSS (GHSA-jrc7-96c5-q579) is fixed only in v6, which needs bundler worker setup in every app. Until then the map interface sanitizes basemap `attribution` with DOMPurify, the only way untrusted HTML reaches maplibre. `buildpad add map-with-real-map` now installs `dompurify`.

- 78f5d65: `parseDaaSError` reads a top-level `{ "message": "…" }` body.

  It knew `{ errors: [{ message }] }` and `{ error }` only. Both backends answer some refusals as `{ message }` — the workflow-transition 403, and the Go engine's transition envelope when it carries no `errors` — and those reached the user as the raw `API error: 403 - {"message":"…"}` string. `message` is read last, so a body that also has `errors` or `error` gives the same text as before.

- eddcba0: Permission filters fail closed.

  `filter-to-query` translated DaaS permission filters into Supabase queries by dropping whatever it could not express: an unknown operator, a relational path such as `{ owner: { id: { _eq: "$CURRENT_USER" } } }`, an `_in` whose value was not an array (every `_in: "$CURRENT_ROLES"`), or a dynamic variable it did not resolve. The query then ran without that restriction and returned every row — and static-token users run through the service-role client, so RLS did not catch it.

  Any filter the translator cannot enforce faithfully now throws `UnsupportedPermissionFilterError` (a 403 `PermissionError`). `getPermissionFilters` turns that into its deny-all filter; `applyFilterToQuery` throws it to the caller. Values inside `.or()` and `in.(…)` strings are quoted and escaped, closing a PostgREST filter-string injection.

  `$CURRENT_ROLES`, `$CURRENT_POLICIES` and `$NOW` are now resolved; `$CURRENT_USER.<field>`, `$NOW(<offset>)` and `$FOLLOW` deny.

  Behaviour changes to check against your permissions:

  - A filter that "worked" because part of it was silently dropped now denies.
  - `_contains` / `_ncontains` are substring matches, as the permission editor describes them. They were translated to array containment, which errors on text columns. `_nicontains`, `_istarts_with`, `_nistarts_with`, `_iends_with`, `_niends_with` and `_regex` are new.
  - `_empty` / `_nempty` match NULL or `''` (previously NULL only).
  - `_null` / `_nnull` require a boolean; `_eq: null` throws (use `_null`); an empty `_or: []` denies.
  - `$CURRENT_ROLE` for a user with no role denies (it resolved to `null`).

- b4030ca: More fail-closed fixes in `auth/enforcer` and `auth/session`, found while adding tests for them.

  - Only an explicit `true` grants: `check_permission` results and `admin_access` values such as `'false'`, `1` or `{}` used to count as granted/admin (in `enforcePermission`, `getUserPermissions`, `getPermissionFilters` and `isAdmin()`, which also returned the raw value).
  - `getUserPermissions` and `getPermissionFilters` ignored errors from the admin and policy lookups.
  - `getPermissionFilters` returned `undefined` — read by callers as "no filter", full access — for a permission row without a `permissions` key; any malformed row now denies.
  - `getAccessibleFields` passed a non-array RPC result through, so a bare `'*'` string granted every field.
  - An empty `Bearer ` token is rejected before any lookup.
  - The deny-all filter is now `id IS NULL AND id IS NOT NULL`. The old `id = '__DENY_ALL__'` made PostgREST answer 400 instead of an empty result on uuid and integer `id` columns.

  Known gap, not changed here: `daas_users.status` is only checked for static tokens, so a suspended user keeps a cookie/JWT session until it expires.

- cdb8c96: Fix three interface bugs the revived test suites caught.

  - **Tags**: pressing Enter split the typed tag on the letters E, n, t, e and r ("lowercase tag" became `low`, `cas`, `ag`). Mantine builds a regex character class from `splitChars`, and `'Enter'` was listed there as if it were a key name. Only `,` splits now; Enter still commits the tag.
  - **Color**: a color could not be typed into the hex field of a controlled form. The field was bound to `value`, which only changes on a complete, valid hex, so every keystroke was discarded. The field now keeps its own draft, re-syncs when `value` changes, and drops an unfinished draft on blur.
  - **Toggle**: with `showStateLabels`, the description and error text rendered twice.

- 3fd3c13: New Workflows module: the `@buildpad/ui-workflows` package, the `workflow-management` registry component and the `workflows-routes` lib module. `buildpad add workflows-routes` installs the whole feature.

  - **Definitions** (`WorkflowsManager`, `WorkflowDetail`): the list with search, paging and permission-gated create, edit and delete; the editor with the name, the description and the state machine drawn as a diagram. States and commands are edited in dialogs (`WorkflowStateModal`, `WorkflowCommandModal`: target state, policies, module access keys kept as stored, actions with JSON parameters) or on the canvas (drag a state, draw a connection, move an edge, delete with the menu or the keyboard). `WorkflowDiagram` is exported on its own for a read-only diagram on another page.
  - **Assignments** (`WorkflowAssignmentsManager`, `WorkflowAssignmentDetail`): which workflow the items of which collection get, with an optional filter rule edited as JSON.
  - **Instances** (`WorkflowInstancesManager`, `WorkflowInstanceDetail`): read-only list and detail with the current state, the diagram and the whole transition history.
  - A command is also added from a state's menu (Add Command), so the editor can be worked with the keyboard: a connection can only be drawn with a pointer. An action's Parameters must be a JSON object; the Go engine refuses a definition that stores anything else there.
  - A definition answered without `workflow_json` (the caller's read grant withholds the field) shows a notice in place of the diagram. It is not drawn as an empty machine and the document is never sent, so a save cannot replace the stored one.
  - Navigation is by callback props (`onWorkflowClick`, `onCreateWorkflow`, `onAssignmentClick`, `onCreateAssignment`, `onInstanceClick`, `onBack`, `onSaved`). A detail component keeps `id="new"` after a create, so the page must navigate in `onSaved`; the installed pages do.
  - Permissions are checked on the collections the API enforces: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance` and `daas_wf_history`. Not-found, access-denied and load-error states are drawn as such, never as an empty list.
  - Both backends are supported through the `useWorkflowDefinitions`, `useWorkflowAssignments` and `useWorkflowInstances` hooks.
  - Strings come from the `workflows` namespace (English and Indonesian); every component takes a `translations` override.

  **New npm dependency: `@xyflow/react`** (React Flow 12, MIT) draws the diagram. `add` and `upgrade` install it pinned to `^12.9.3`, and `fix` knows it. `WorkflowDiagram` imports `@xyflow/react/dist/style.css` itself. React Flow shows an attribution on the canvas; `hideAttribution` removes it, which its authors ask organisations to pair with supporting the project.

  **Registry and CLI**

  - `workflow-management` (category `workflow`, not part of `add --all`): 22 files under `components/ui/workflow-management/`; depends on the `types`, `hooks`, `services` and `utils` lib modules and on the `vtable` component.
  - `workflows-routes`: six pages under `app/[lang]/(authenticated)/` (`/workflows`, `/workflows/[id]`, `/workflow-assignments`, `/workflow-assignments/[id]`, `/workflow-instances`, `/workflow-instances/[id]`) and three sidebar entries in a new Automation section. The app dictionary gains `app.nav.workflows`, `app.nav.workflowAssignments`, `app.nav.workflowInstances` and `app.nav.automation`; an existing app gets them from `buildpad upgrade i18n`, and the sidebar shows the English labels until then.
  - `@buildpad/ui-workflows` imports are rewritten to `@/components/ui/workflow-management` (subpaths kebab-cased).
  - `buildpad add` installs a component's missing npm dependencies before it validates the project. It validated first, and validation exits on a type error, so adding a component whose npm package the app did not have yet (here `@xyflow/react`) ended with `TS2307: Cannot find module` and exit code 1, without installing the package or printing the install command. Modules whose dependencies `bootstrap` already installs were not affected.
  - `@buildpad/mcp` embeds the same registry, so `list_components`, `list_lib_modules` and `copy_component` serve both entries.

  **Utils additions the editor uses** (`@buildpad/utils`): the diagram gestures as functions from one document to the next (`removeWorkflowState`, `removeWorkflowCommand`, `moveWorkflowState`, `reconnectWorkflowCommand`), `findWorkflowConnectionProblem` (no command out of an end state, back to its own state, or to something that is no state), the end-state check of `findWorkflowStateProblem` (an end state cannot be given to a state that has commands), and `splitRichText` for strings that carry `<tag>…</tag>` markers.

  Storybook: `pnpm storybook:workflows` (port 6013), built with the others by `pnpm build:storybook`. Docs: the Workflows Module Recipe page.

- fdef931: The workflow button works as a form field again.

  - **Item id**: `VForm` hands every interface the record's key as `primaryKey`, but `WorkflowButton` read only `itemId`. Inside a form the button therefore got no id, treated every existing item as new, and showed the placeholder with no current state and no transitions. It now accepts `primaryKey` as well; `itemId` wins when both are given. Only the `workflow-button` component changes — `vform` is untouched.
  - **Failed transitions**: a transition the server refused (or that failed) was only logged to the console, so the button went back to the old state without a word. `useWorkflow().executeTransition` still rejects, and now also puts the failure in `errorMessage`, which the button shows. The next transition or refetch clears it. With the built-in fetch client the text is the HTTP status line (`HTTP error! status: 403`); the response body is not read yet.
  - **Instance lookup**: `useWorkflow` looked the instance up by `item_id` alone, so item 5 of one collection could show the workflow of item 5 of another. The lookup now filters by `collection` too. Lookups by `translationId` are unchanged.

- 42ab7ff: Data layer for a Workflows admin module: types, data hooks, editor logic and translations. No components yet.

  - **Types** (`@buildpad/types`, `workflow.ts`): `WorkflowDefinitionRecord`, `WorkflowAssignmentRecord`, `WorkflowInstanceRecord`, `WorkflowHistoryRecord`, the `workflow_json` document (`WorkflowJson`, `WorkflowJsonState`, `WorkflowJsonCommand` with `module_access_keys`, `sourceHandle` and `targetHandle`, `WorkflowJsonAction`), the create and update bodies, and `WorkflowListResult<T>`. The four collection names are constants (`WORKFLOW_COLLECTIONS`: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance`, `daas_wf_history`); gate on these, they are the names the API enforces. The older, narrower `WorkflowAssignment`, `WorkflowState` and `WorkflowInstance` types of `@buildpad/hooks`, and the workflow button's own types, are unchanged.
  - **Hooks** (`@buildpad/hooks`): `useWorkflowDefinitions` (list, load every page for a picker, get, create, update, delete), `useWorkflowAssignments` (list, get, create, update, delete) and `useWorkflowInstances` (list, get, full transition history). They work against both backends: list counts are read from `count`/`totalCount`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, `data: null` is an empty page, and `page` and `limit` are always sent.
  - `WorkflowDefinitionRecord.workflow_json` is optional: both backends drop a field the caller's grant withholds, and the hooks do not put an empty machine in its place. `updateDefinition` sends a cleared description as an empty string, which both backends store (the Go engine ignores a `null` there).
  - **Typed errors** (`@buildpad/hooks`): every method of these hooks rejects with a `DaaSRequestError` whose `kind` is `notFound`, `forbidden`, `mfaRequired`, `unauthenticated`, `invalid` or `failure`, with the status, the backend's error code, and the readable message from `parseDaaSError`. A failed load is never an empty list, and a get never resolves without a record. `toDaaSRequestError`, `readDaaSListResponse`, `buildDaaSListQuery`, `readDaaSRecord` and `useDaaSRequest` are exported for other data hooks.
  - **Editor logic** (`@buildpad/utils`): `buildWorkflowCommand` and `buildWorkflowState` build what a dialog saves on top of the stored object, so keys the form has no field for (a command's `module_access_keys`) and the stored key order survive; `findWorkflowCommandProblem`, `findWorkflowStateProblem` and `findWorkflowDefinitionProblem` return what refuses a save, with a code to translate; `applyWorkflowStateSave` and `applyWorkflowCommandSave` apply a dialog's result to the document; `normalizeWorkflowJson` gives every command its `actions` and `policies` arrays; `isWorkflowFilterRule` and `parseWorkflowFilterRule` accept only an object of conditions (or none) as an assignment's filter rule. `clampPage` and `pageAfterRemoval` keep a paged list off a page that no longer exists after a delete.
  - **Translations** (`@buildpad/utils`): a `workflows` namespace with English defaults and the Indonesian catalog.

  `buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.

### Patch Changes

- c25670f: Installing a registry entry on its own now installs everything its files import.

  - `add users-management` installs `vtable`: the users, roles and policies tables import it, so a project without it failed to compile.
  - `add content-routes` installs `content-layout`, `content-navigation`, `collection-list` and `collection-form`, which its pages import.
  - `api-routes` depends on the `hooks` lib module: `components/DaaSProviderWrapper.tsx` imports `@/lib/buildpad/hooks`. A project that already has `api-routes` but not `hooks` gets it from `buildpad upgrade api-routes` (or `upgrade --all`, or `add hooks`); a plain `buildpad upgrade` does not install it, because no file of `api-routes` changed.
  - `@buildpad/mcp` embeds the same registry: `list_lib_modules` now lists `hooks` under `api-routes`, `copy_component` for `api-routes` (and for `external-oauth`, which depends on it) also returns the `hooks` files, and the `users-management` and `content-routes` entries list their new dependencies.

  The generated `components/ui/index.ts` no longer fails to compile when two installed components export the same name. With both `file-manager` and `users-management` installed, `DeleteConfirmModal` and `DeleteConfirmModalProps` were ambiguous under `export *` (TS2308), which broke `tsc` and `next build`. The barrel now re-exports each such name from the first component that provides it (alphabetical), and `add` lists them; import the other one by path, e.g. `@/components/ui/users-management`.

  Two gaps remain, because fixing them means moving a file to another entry: the `api-routes` logout route imports `@/lib/oauth/config` (install `external-oauth`, as `add --with-api` and `bootstrap` do), and the `services` module's `lib/module-access/enforce.ts` imports `@/lib/supabase/server` (install `supabase-auth`).

- 782bac3: `validate` and `fix` find files with tinyglobby instead of fast-glob. fast-glob brought in `braces`, which has an unpatched denial-of-service advisory (GHSA-vfj7-8cjw-p6xm), into every project that installs the CLI. Patterns are now relative to the directory being searched, so a project path with Windows backslashes is no longer read as glob escapes.
- 5c406c5: Safer installs and import rewriting.

  - **`add` no longer overwrites your edits.** When an installed component was outdated, `add` refreshed it in place if it looked unmodified, but it checked the wrong file: the path without `src/` in `srcDir` projects, and the `.ts` path for files it writes as `.tsx` (VForm's `types.ts`, `utils/*.ts`, `index.ts`, `list-m2a/render-template.ts`, …). An edited file then looked missing, and `add` replaced it. It now checks the file it actually wrote, and keeps any copy you changed.
  - **`validate` and `fix` find every leftover `@buildpad/*` import.** They used to look only for `from '@buildpad/…'` on one line, under `components/` and `lib/buildpad/`. They now also find dynamic `import()` (with webpack/Vite magic comments, import attributes or a template literal too), side-effect imports, `require()`, multi-line imports and imports after a `/* … */` comment on the same line, in every folder the CLI installs into (`app/`, `lib/`, `middleware.ts`, `types/`, …). They take those folders from the targets `buildpad.json` records, and ignore any target that is not a relative path inside the project (`../x`, `/x`, `**/x`, …), which `validate` reports as an `UNSAFE_TARGET` warning. Imports of the published `@buildpad/cli` and `@buildpad/mcp` packages in your own code are not reported.
  - **`fix` no longer renames your relative imports.** It rewrote VForm's `./FormFieldInterface` to `./form-field-interface`, and a file of yours that imports `./MyPanel` to `./my-panel`. It now changes only the `@buildpad/*` imports, in every file, and lists any import it cannot rewrite.
  - **Imports the CLI cannot place now fail the install.** A `@buildpad/*` import with no install target used to be copied unchanged and failed later in your build. `add` and `upgrade` now stop with an error that names the file, the line and the import.
  - Import rewriting now covers side-effect imports, `require()`, `declare module`, and `import()` of any package path. This includes `import('@buildpad/ui-interfaces/<name>')`, which lazily loaded interfaces need. Some package paths were mapped to files the registry never installs, and now map to the installed file: `@buildpad/utils/<module>`, `@buildpad/ui-table/<module>`, `@buildpad/ui-forms`, and PascalCase paths in `ui-collections`, `ui-files`, `ui-users` and `ui-interfaces/<name>/<Entry>`. No shipped file uses these paths today, so the files installed into your project do not change.

- 2b128f2: `upgrade`, `add` and `migrate` no longer end silently when they need to ask a question and there is no terminal (CI, a pipe, the MCP server's `apply_upgrade`).

  - The "Install missing dependencies automatically?" question was left pending: the process ended at it with exit code 0, before the command's summary and without saying how to install the packages. Without a terminal the CLI now lists the missing packages, prints the install command for the project's package manager and carries on. Nothing is installed unless `--yes` (or `bootstrap`) asks for it. A cancelled prompt counts as "no".
  - `upgrade` with the default `prompt` strategy did the same at the first locally-modified file, with files already written and `buildpad.json` not saved. Without a terminal it now acts as `--strategy=new-file`: your file is kept, the new version is written as `<file>.new`, and the entry stays pending. An explicit `--strategy` is honoured as before.

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

### Minor Changes

- b799724: Internationalization, phase 2.

  **Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

  **CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

  **Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages. A dictionary slot counts as a plural entry only when every key is a CLDR category, so overriding `interfaces.selectRadio.other` no longer drops that namespace's sibling strings.

- b272d96: List managers persist search, filters, sort, and page in the URL by default.

  `UsersManager`, `RolesManager`, `PoliciesManager`, and `FileManager` now mirror
  their settled list state into the query string (`?search=…&role=…&status=…`,
  `?folder=…`, `?sort=-email&page=2`) via a new `useUrlListParams` hook in
  `@buildpad/hooks` — so a filtered view is shareable, reload-safe, and
  observable by URL-level integrations such as the micro-frontend bridge.
  Writes ride the managers' existing 300 ms search debounce, so there is no
  extra work per keystroke; browser Back/Forward and programmatic rewrites
  (dispatch the exported `URL_STATE_EVENT`) flow back into component state.

  **Next.js App Router apps must register a URL writer.** The hook has no
  framework imports (it must keep rendering in Storybook), so it writes through
  whatever the app registers with `registerUrlStateWriter`. The updated
  `DaaSProviderWrapper` template registers `router.replace`; without it the hook
  falls back to native `history.replaceState`, which the App Router ignores
  (`useSearchParams` never updates) and re-asserts its own URL over (observed on
  Next 16) — the parameters silently vanish. If you have customised
  `DaaSProviderWrapper`, add the registration by hand; in development the hook
  warns once when it detects Next.js and no writer. Consumers on `@/lib/buildpad/hooks`
  get the new exports from the regenerated barrel (`useUrlListParams`,
  `useHydrated`, `readUrlParam`, `readUrlIntParam`, `registerUrlStateWriter`,
  `URL_STATE_EVENT`).

  The managers are client-gated (`useHydrated`) while URL persistence is on:
  seeding state from the URL in `useState` initialisers would otherwise render
  differently on the server and the client, a hydration mismatch on every deep
  link. Until hydration they render the same loading shell they showed before
  their first fetch, so nothing meaningful is lost from server output.

  Two url-synced lists on one page (`urlParamPrefix`) merge additively even
  through an asynchronous router writer: the hook merges into the query it last
  asked to be written, not into a `location.search` that has not caught up yet.

  Defaults stay off the URL entirely; deep-linked `?folder=` ids rebuild their
  breadcrumb via the new `useFolders().fetchFolder`. Opt out per instance with
  `urlParams={false}` (embedded surfaces), or namespace with
  `urlParamPrefix="users-"` when two lists share a page.

## 2.2.0

## 2.1.0

### Patch Changes

- 5bec3a1: CLI: install `@tiptap/core` alongside `rich-text-markdown`, fixing a build-blocking TypeScript error.

  `rich-text-markdown.tsx` declares a module augmentation (`declare module '@tiptap/core' { ... }`) to add the `markdown` property to TipTap's `Storage` type, but `@tiptap/core` was never listed as a direct dependency for the component — only pulled in transitively via `@tiptap/react`/`@tiptap/starter-kit`. A transitive dependency isn't enough for TypeScript to resolve the module for augmentation, so every project that installed `rich-text-markdown` (including via `bootstrap`, which installs all components) failed `next build` with:

  ```
  error TS2664: Invalid module name in augmentation, module '@tiptap/core' cannot be found.
  error TS2339: Property 'markdown' does not exist on type 'Storage'.
  ```

  `@tiptap/core` is now registered as a direct dependency of `rich-text-markdown` in the registry, pinned in the CLI's `DEPENDENCY_VERSIONS` map, and recognized by `fix`'s known-package list. That last part matters on its own: without it, `buildpad fix` would emit `declare module '@tiptap/core';` as an untyped-package stub, which replaces the real module and breaks the very augmentation this fixes.

  Note `@tiptap/core` is a _peer_ dependency of `@tiptap/react`, not a transitive one, so whether it reaches `node_modules` at all depends on the package manager's auto-peer-install and hoisting behaviour — it was never something the app could rely on.

  The same component also imports `@tabler/icons-react` (for `IconCode`/`IconEdit`/`IconPhoto`/`IconTable`/`IconHeading`) without declaring it; that is registered now too.

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

### Patch Changes

- 56c14ae: CLI: fix a broken relative import the transformer never rewrote, and an implicit-`any` in the external-OAuth callback template.

  `normalizeImportPaths` only rewrote relative imports whose _first_ path
  segment was PascalCase (e.g. `../Upload/Upload` → `./upload`). A sibling
  import like `../select-icon/SelectIcon` — where the folder is already
  kebab-case but the filename is still PascalCase — never matched, so it
  shipped unrewritten even though `select-icon` is delivered as the flat
  sibling `components/ui/select-icon.tsx`, not a `select-icon/SelectIcon.tsx`
  directory. This broke every component that imports from `select-icon`:
  `select-dropdown`, `select-multiple-checkbox`, `select-multiple-dropdown`,
  and `select-radio` all shipped a `TS2307: Cannot find module
'../select-icon/SelectIcon'` on a fresh install. Both the static
  `from '../select-icon/SelectIcon'` and dynamic
  `import('../select-icon/SelectIcon')` forms are now flattened to
  `./select-icon`.

  `auth-callback-oauth-route.ts` (installed by the `external-oauth` lib
  module) left `setAll(cookiesToSet)` without the parameter type its sibling
  templates (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`) already
  carry, producing three `TS7006`/`TS7031` implicit-`any` errors under strict
  mode.

- f4473b4: Fix `buildpad upgrade --all` (and bare `--force`) silently skipping installed lib modules.

  `--all` only populated `targetComponents`, never `targetLibModules`, so lib-module files
  (`lib/buildpad/utils/index.ts`, `lib/buildpad/types/index.ts`, `design-system`, etc.) were
  never re-synced no matter what flags were passed — only named components were. This is why
  running `upgrade --all --force` after a barrel-export fix landed upstream did not pick up
  the fix: the export lives in a lib module, and `--all` never even attempted to touch it.

  `--all` and bare `--force` now also resolve `targetLibModules` from `config.installedLib`,
  matching how `--design` and the default (no-flag) outdated-detection path already do.

- 89f532b: CLI: deliver `conceal.ts`, close the stranded utils exports, and make the registry hash platform-independent.

  `utils/src/conceal.ts` was never registered as a `utils` lib file, so `buildpad add/upgrade utils` had no way to deliver it. Five registry-delivered files already imported it — `InputHash`, `SystemToken`, `FormFieldInterface`, `CollectionForm` and `FormField` — and failed to build in consumer projects. It is now registered as `lib/buildpad/conceal.ts` and re-exported from the utils barrel.

  The barrel had also drifted across three separate commits, not one. Alongside conceal's members it now re-exports `getDefaultValuesFromFields`, `resolveChoiceLabel`, `parseChoiceValues`, `splitCsvValue`, `InterfaceChoice`, `MISSING_FIELD_MARKER`, the auto-generation helpers, and the `interface-types` / `interface-registry` / `define-interface` modules — all of which ship to consumers but had no reachable export path.

  Also fixed, because the drift was undetectable rather than unlucky:

  - `computeFileSha256` now hashes line-ending-normalised content, and a `.gitattributes` pins `eol=lf`. Hashing raw bytes made the registry platform-dependent: generated on a CRLF checkout, its hashes could never match an LF checkout, so `pnpm registry:check` failed permanently and its output was pure noise. `registry:check` now passes.
  - CI runs build, typecheck and unit tests _before_ the registry check. Fail-fast meant the red check aborted the job before any of them ran.
  - `collectUndeclaredImports` now scans `registry.lib`, resolving relative imports in target space. It previously covered components only, which is why a barrel could re-export a module that was not a registry file at all.
  - `@buildpad/cli` is now a known package folder, so `cli/templates/*` files are no longer exempt from the version guard.
  - `build-registry.mjs` only self-executes when invoked directly. The previous guard was always true, so importing it — as the test suite does — rewrote the checked-in `registry.json`.
  - `buildpad upgrade <lib>` no longer reports "up to date" when a registered file is missing on disk. A module that gains a file could not be delivered by version comparison alone, because the version cannot move until a release.
  - `buildpad add` no longer rewrites existing lib files when a module gains one. Adding a file made the "already installed" check fail, and every consumer's customised copies were silently overwritten.
  - The CLI now verifies fetched sources against the registry's `sourceSha256` and warns on mismatch. The field was written but never read.
  - `useModuleAccessKeys` and `module-access-keys` are registered and exported, and the types barrel re-exports `module-access`. `buildpad add users-management` previously produced a project that could not build.

- c1ac731: CLI: stop CloudFront from caching authenticated pages, and fix every redirect and OAuth `redirect_uri` that was built from the server's internal address.

  Two template defects surfaced in production behind AWS Amplify/CloudFront:

  - `middleware.ts` never set `Cache-Control`, so CloudFront (and any shared cache) stored authenticated pages for a year with no `Vary: Cookie` — one signed-in user's response could be served to a different visitor. It now sets `Cache-Control: private, no-store, must-revalidate` on every response.
  - Redirect targets were built from `request.url` / `request.nextUrl.origin`, which behind a reverse proxy resolves to the compute process's own `localhost:3000` rather than the app's real public address. `NextResponse.redirect()` always emits an absolute `Location` header computed server-side — it is never resolved client-side by the browser — so every affected redirect sent users to `https://localhost:3000/...`.

  **New shared module: `lib/origin.ts`** (installed by `supabase-auth`, on which `api-routes` and `external-oauth` both depend). It exports:

  - `publicOrigin(request)` — resolves the app's real public origin, preferring `NEXT_PUBLIC_HOST_ORIGIN` / `HOST_ORIGIN`, then the first hop of `x-forwarded-host` / `host` (ignoring loopback addresses), then `request.nextUrl.origin`. The protocol falls back to the request's own rather than assuming `https`, so dev servers bound to a LAN IP or `127.0.0.1` keep working.
  - `publicUrl(request, path)` and `safeRelativePath(path)`.

  Set `NEXT_PUBLIC_HOST_ORIGIN` to your app's public origin (e.g. `https://app.example.com`) in production. Without it the resolution falls back to request headers, which are client-supplied unless your proxy overwrites them.

  All redirect and `redirect_uri` construction now goes through it:

  - `api/auth/logout` (`GET` and `POST`) — redirects and the IdP `post_logout_redirect_uri`.
  - `api/auth/callback` (both the Supabase-native and `external-oauth` versions) — every error redirect, plus the `redirect_uri` sent during token exchange.
  - `api/auth/oauth/[provider]` — the `redirect_uri` sent to the IdP's authorize endpoint. This one must byte-match the value the callback route sends and the URI registered with the provider, so external OAuth sign-in was broken behind a proxy in exactly the same way logout was.
  - `lib/supabase/middleware.ts` — the unauthenticated-user redirect to `/login`, which fires on every protected page load.

  Also fixes an open redirect in both callback routes: `?next=` (and the OAuth flow's `returnTo`) were resolved against a URL base, so `?next=https://evil.example` produced a redirect off-site. They are now constrained to absolute paths on the app's own origin.

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

### Patch Changes

- c9c8473: `buildpad upgrade` now installs npm dependencies that a new component or lib-module version introduces. Previously it copied the new source but never checked the registry-declared `dependencies`, so an upgrade could leave the app with unresolvable imports (e.g. rich-text-markdown 1.8.0 added `@tiptap/extension-table`, `tiptap-markdown` and `marked`). Missing deps are now detected after upgrading, pinned to their tested ranges, and installed with the package manager the app's lockfile implies — with confirmation, or automatically under `--yes`; `--dry-run` lists what would be installed. The dependency pin map moved to a shared util used by both `add` and `upgrade`, and gained pins for `@tiptap/extension-table`, `tiptap-markdown` and `marked`.

## 1.8.0

## 1.7.0

### Minor Changes

- 6db435b: `add` no longer silently keeps stale copies of already-installed components.
  When a requested component or a transitive `registryDependencies` entry is
  installed at a version older than the registry's `lastChangedIn` for it:

  - **Unmodified copy** (every recorded file matches its install-time sha256, or
    is missing from disk) → refreshed in place automatically, with an info line.
    This makes one-step installs like `add users-routes` pick up updated
    dependencies (e.g. `system-permissions`) instead of leaving the old copy.
  - **Locally edited copy** → kept untouched, with a warning that names the
    versions and points at `npx buildpad upgrade <name>` (three-way merge).
    A direct interactive `add <name>` additionally offers an explicit
    discard-and-overwrite prompt.

  Up-to-date and pre-tracking (v1 / no install record) components keep the
  previous skip behavior. Lib modules are unchanged (they already self-heal on
  missing files); content-stale lib modules remain a `buildpad upgrade` concern.

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

### Minor Changes

- Add the `form-builder` component and `forms-routes` module scaffolds for the new Dynamic Form Builder (`/forms`, `/forms/new`, `/forms/[id]`, `/forms/[id]/fill`), standardized on "form" terminology with breadcrumbs and improved empty/creation UX. The `AuthenticatedShell` header now derives a breadcrumb from the route for pages not in the sidebar nav.

## 1.5.0

### Minor Changes

- 94604c9: Add a packaged Files management module so consumers don't have to hand-build the `/files` Studio experience.

  - New `@buildpad/ui-files` package: `FileManager` (drag-and-drop upload, import-from-URL, folders, grid/list views, search, bulk delete) and `FileDetail` (metadata edit + image/video/audio/PDF preview), shipped as the `file-manager` registry component.
  - New `useFolders` hook and `tags`/`location` support on `useFiles` file metadata.
  - New CLI scaffolds: `files-routes` (the `/files` and `/files/[id]` pages) plus `/api/files/import`, `/api/folders`, and `/api/folders/[id]` proxy routes.

- 94604c9: Bring the Files module to feature parity with the DaaS Studio.

  - **RBAC gating**: `FileManager`/`FileDetail` accept a `filesCollection` prop (default `daas_files`) and gate upload, new folder, delete, and edit via `usePermissions` (admin bypass; optimistic while loading).
  - **List view**: select-all header checkbox and a per-row actions menu (Edit / Download / Delete); file cards show a category badge with an image-error fallback; upload progress bar.
  - **File detail**: two-column layout adding a read-only info panel (`FileInfoPanel` — id+copy, MIME, size, dimensions, duration, storage, timestamps), move-to-folder selector, focal-point X/Y for images, replace-file, open-in-new-tab, and signed-URL download.
  - **Folder rename** UI (reuses the folder dialog).
  - **Data layer**: `useFiles` gains `replaceFile` and `getDownloadUrl`, `updateFile` accepts focal point, and the file view-model carries `storage`/`duration`/`focal_point_*`.
  - New `/api/files/[id]/download` proxy route template.

## 1.4.1

## 1.4.0

### Minor Changes

- Bootstrap now renders `AuthenticatedShell` by default: the generated `app/(authenticated)/layout.tsx` wraps pages in the app shell, and the home page is scaffolded at `app/(authenticated)/page.tsx` so `/` shows the header + sidebar after login.
- `api-routes` now depends on `design-system`, so the shell component is always present when the auth layout is installed.

## 1.3.1

### Patch Changes

- Fix scaffolded `app/layout.tsx` not importing `@mantine/dates/styles.css` — the `datetime` calendar rendered unstyled/inline. `@mantine/dates` + `dayjs` are now always installed.

## 1.3.0

### Minor Changes

- Add `buildpad upgrade --design` and make the design foundation a registry-tracked `design-system` lib module (design tokens, globals, theme, ColorSchemeToggle, AuthenticatedShell). `init`/`bootstrap` install it tracked; `outdated` reports it; three-way merge preserves local token edits.
- Generalize `upgrade` to handle lib modules (not just components), with an adoption path for projects that predate tracking.
- Fix bootstrap gap: install the `external-oauth` module during `--with-api`/`--all` so the api-routes auth handlers can resolve `@/lib/oauth/*` (previously `next dev` failed with "Can't resolve '@/lib/oauth/config'").
- build-registry now stamps lib modules with version/lastChangedIn; registry.json is bundled into the CLI for offline `init`.

## 1.2.0

### Minor Changes

- Ship a generic `AuthenticatedShell` app-shell template (`.bp-*` design-token styles) in the scaffold, alongside the schema-driven `ContentLayout`.
- Fix `buildpad init`/`bootstrap` producing a project that fails `next dev` with "Cannot resolve '@supabase/ssr'": the minimal scaffold now declares the always-installed auth layer (`@supabase/ssr`, `@supabase/supabase-js`, `jose`).
- npm publishing support with remote GitHub-raw registry resolver (auto-detects local vs published).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `buildpad --version` now reads the version from `package.json` instead of a hardcoded string, so it can no longer drift from the published version.

## 0.2.0

### Minor Changes

- **`upgrade` command** — safely update installed components to the latest registry version. Per-file behaviour is driven by `--strategy`:

  - `overwrite` — replace file in-place (also the effect of `--yes`)
  - `new-file` — write upstream version as `<file>.new`, leave the original untouched
  - `three-way` — attempt a `diff3` merge; falls back to `.new` on conflict or when the base cannot be fetched offline
  - `prompt` (default TTY) — ask per file: skip / overwrite / write .new

- **`changelog` command** — print the CHANGELOG.md slice for a package or component since the installed version. Accepts either a package name (`@buildpad/ui-interfaces`) or a component name (`input`).

- **`migrate` command** — one-shot migration for v1 `buildpad.json` manifests. Re-fetches and re-transforms each installed component and lib module at its recorded version, computes SHA-256 checksums, and writes them into the v2 `components` / `lib` maps without touching any consumer file. Idempotent.

- **`buildpad.json` schema v2** — the manifest now tracks:

  - `schemaVersion: 2`
  - `components: Record<string, ComponentInstall>` with per-file `sha256` checksums
  - `lib: Record<string, ComponentInstall>` (same structure for lib modules)
  - `packageVersions: Record<string, string>` — one entry per source package

- **Stable origin header** — removed the volatile `@buildpad-date` field from the injected file header. Date-of-installation is now recorded only in `buildpad.json` (`installedAt`). This makes SHA-256 hashes reproducible: two identical installs on different days produce identical checksums.

- **`status` command** — now compares the SHA-256 of every installed file on disk (minus origin header) against the value recorded in `buildpad.json`. Reports `[pristine]` or `[modified]` per file.

- **`outdated` command** — upgraded to per-package semver comparison using the `packages` map in registry v2. Skips components whose files are byte-identical to the registry even when the package version bumped (`lastChangedIn` gating).

- **`add` command** — now records `files[].sha256` (hash of transformed content minus origin header) and updates `packageVersions` on every install.

- **Registry v2 resolver additions** — `fetchSourceAtVersion`, `buildPackageTag`, `buildVersionedSourceUrl`, `CHANGELOG_BASE_URL` for fetching historical source and changelog slices.

### Patch Changes

- `transformer.ts` gains `stripOriginHeader` and `hashTransformed` helpers. Hashing rule: strip header block → normalise CRLF→LF → trim trailing whitespace + single trailing newline → SHA-256.
- `three-way-merge.ts` wraps `node-diff3` with CRLF normalisation and standard git conflict markers (`<<<<<<< HEAD` / `=======` / `>>>>>>> upstream`).
- `checksum.ts` gains `inferSourcePackage` (maps registry path prefix → `@buildpad/*` package name) and `resolvePackageVersion` (per-package version lookup with graceful fallback).
- `validate.ts` now checks that every recorded `files[].sha256` is a valid 64-character hex string and warns when `packageVersions` is missing entries for installed components.

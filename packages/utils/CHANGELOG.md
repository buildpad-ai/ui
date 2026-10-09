# @buildpad/utils

## 3.2.0

### Minor Changes

- 1fc676e: Workflows module: four fixes that were made in `@buildpad/ui-cron` first.

  **A second click on Create no longer makes a second record** (`WorkflowDetail`, `WorkflowAssignmentDetail`)

  - After a successful create the component goes on as the editor of the record it created: the title and the breadcrumb are the record's, the button reads Save Changes and waits for an edit, and a further Save is an update of that record. It kept `id="new"` and an enabled Create button, so a host that did not navigate in `onSaved` (or was slow to) created a duplicate on the next click.
  - `onSaved` is called as before: with the stored record after a create and after an update. A host no longer has to navigate after a create to stay correct; navigate so the URL names the record (a reload of `/…/new` opens an empty form). A host that compares its own `id` with `'new'` inside `onSaved` sees `'new'` for every save until it navigates.
  - A user who may create but not update gets the record it created read-only.
  - `WorkflowAssignmentDetail` keeps a collection typed while the save was in flight; the answer replaced it with the collection that was sent.
  - A save (or a create) answered after the host gave the component another `id` is no longer drawn over that record. `onSaved` is still called with the record that was saved.

  **No write control, and no open form, until the permissions are known** (`WorkflowsManager`, `WorkflowAssignmentsManager`, `WorkflowDetail`, `WorkflowAssignmentDetail`)

  - The gates were optimistic while the permissions request ran: for its length a reader was shown Add Workflow / New Assignment, full row menus, Save, an editable form and an editable diagram, and `/…/new` opened its form before turning into access-denied. These controls are now drawn when the permissions are known. Meanwhile the editors are covered by their loading overlay and take no edit, the diagram has no edit control (so neither dialog can open), and a new record's form is neither opened nor refused.
  - Reading does not wait: the lists and the records load at once, and are not loaded again when the permissions arrive.
  - A later refresh of the permissions (a renewed token, another scope) keeps the controls and the open form as they were until its answer is in.
  - The Cancel / Back button keeps its wording: it reads Back only for `readOnly` or once the permissions say the user may not save.
  - `WorkflowInstancesManager` and `WorkflowInstanceDetail` have no permission gate and are unchanged.

  **A search or a page-size change on a later page is one request** (`WorkflowsManager`, `WorkflowAssignmentsManager`, `WorkflowInstancesManager`)

  - On page 2 or later, typing a search, clearing one or picking another page size sent two requests: the new filter for the old page, then the same filter for page 1. The first answer was dropped, so nothing showed on screen, but a backend that refuses a page past the end of the list answered it with an error. The list now sends the one request for page 1. A page restored from the URL is kept as before.

  **The footer names one row in the singular** (`@buildpad/utils` `workflows` namespace, the three lists)

  - A list of one read "Showing 1 of 1 workflows" / "assignments" / "instances". `workflowsManager.itemsLabel`, `assignmentsManager.itemsLabel` and `instancesManager.itemsLabel` are now plural forms (`{ one: 'workflow', other: 'workflows' }`), as the namespace's `count` entries are, and the footer picks the form the locale's plural rules give the TOTAL: "Showing 1 of 1 workflow", "Showing 1 of 26 workflows". Indonesian nouns have one form: `{ other: 'alur kerja' }`.
  - An override of one of these three keys (a `translations` prop, a provider dictionary) is now typed as plural forms. A dictionary that still holds one string there keeps working: the footer shows the string as it is.

### Patch Changes

- @buildpad/types@3.2.0

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

### Patch Changes

- Updated dependencies [45feba0]
  - @buildpad/types@3.1.0

## 3.0.0

### Major Changes

- 9544e24: Add the interface manifest, `lib/buildpad/interface-manifest.ts`: one data table of field-interface identity, with an entry per interface id (aliases, registry component, component export name, compatible field types, group, behaviour flags, form-builder picker descriptor, loading class). The interface tables that were kept by hand are derived from it, under their old names and with their old values. How stored records render does not change.

  - `getFieldInterface` resolves the legacy alias ids (`textarea`, `wysiwyg`, the xtremax workflow ids, …) through `normalizeInterfaceId()`; they are no longer extra `case` labels. The switch first sees the id with only the registry aliases resolved (as in 2.6), so a `case` a project added for a legacy id or its own variant is still reached; only an id no case names falls back to its manifest renderer id. `REGISTRY_INTERFACE_ALIASES`, the concealing set, `CHOICE_INTERFACES`, `PROVISIONABLE_INTERFACES` and `isPresentationField` are derived from the manifest.
  - The utils barrel exports the manifest and its helpers (`INTERFACE_MANIFEST`, `normalizeInterfaceId`, `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`, `isNonFlatRelationalInterface`, `isSelfPersistingInterface`, `isRelationListInterface`, …), and the field-level `isNonFlatRelationalField(field)` (an m2a/m2m/o2m special or a list-o2m/m2m/m2a interface).
  - `InterfaceGroup` gains `'system'`, the registry group of `system-permissions` (a `Record<InterfaceGroup, …>` needs a `system` key). The `InterfaceType` literals the mapper never returns (`textarea`, `number`, `uuid`, `list-m2o`) are marked `@deprecated` and kept.
  - `interface-registry`, `define-interface` and `load-interfaces` are deprecated: nothing populates that registry and VForm never reads it. They stay exported. With the new `'system'` group, `InterfaceRegistry.getGrouped(true)` returns 8 groups (it used to drop `system` interfaces) and `getInterfacesForApi` names that group "System".

  Upgrade with the 3.0 CLI, which upgrades an entry's dependencies with it; see docs/MIGRATION-3.0.md.

- 443b901: The relational missing-provider alert (`interfaces.relationalUI.missingProvider.message`, en + id) no longer tells developers to render the field inside a VForm: a plain VForm supplies only itself (the form renderer), not CollectionForm / CollectionList. It now points to CollectionForm, `CollectionsRelationalProvider` (around the field or the VForm) or the `components` prop, and names the form-renderer slot "VForm". `ListO2M`, `ListM2M` and `ListM2A` only report components for actions the field would otherwise offer (enable flags, create / select / update permissions, unique and singleton guards), so users without those permissions no longer see the alert. Docs and JSDoc now say what a VForm supplies.
- 60ae923: Break the ui-form → ui-interfaces → ui-collections → ui-form package cycle with a relational UI context.

  - New lib file `lib/buildpad/services/relational-ui-context.tsx` (`@buildpad/services/relational-ui-context`): `RelationalUIProvider`, `useRelationalUI`, `mergeRelationalUI`, `missingRelationalUI` and structural slot types for `CollectionForm`, `CollectionList` and `FormRenderer` (VForm). Nested providers merge; `defaults` only fill slots nothing above supplies. Also re-exported from the services barrel.
  - `ListO2M`, `ListM2M`, `ListM2A` and `JunctionItemForm` no longer import `@buildpad/ui-collections` / `@buildpad/ui-form`. They take those components from a new optional `components` prop, then the relational provider, and render each in its own Suspense boundary (new `components/ui/list-m2a/relational-slots.tsx`). With no provider they render a translated alert (`interfaces.relationalUI`, en + id) and hide the create / select / edit actions whose dialog component is missing; listing, removing and reordering still work.
  - `CollectionForm` supplies `{ CollectionForm, CollectionList (React.lazy), FormRenderer: VForm }` to the fields it renders; `VForm` supplies `{ FormRenderer: VForm }`. Both only fill slots a provider above did not choose. `collection-form` now declares `collection-list` as a registry dependency.
  - New `CollectionsRelationalProvider` (exported from `collection-form`) for standalone relational interfaces and standalone `VForm`s with relational fields. The CLI's `/content` layout template and `FormPreview`'s offline VForm use it.
  - Standalone `<ListO2M>` / `<ListM2M>` / `<ListM2A>` and plain `<VForm>`s with relational fields must now be wrapped in a provider (or given `components`) to create, select or edit related items. See docs/MIGRATION-3.0.md.
  - Monorepo: `@buildpad/ui-interfaces` drops its peer/dev dependencies on `@buildpad/ui-collections` and `@buildpad/ui-form`; the root build is utils first, then `pnpm -r build`; `packages/ui-collections/dist` is no longer committed; `pnpm graph:check` allows no package cycle.

- 5147727: VForm loads heavy interface components on demand and no longer imports the components barrel.

  - New `vform` file `components/ui/vform/components/interface-components.tsx`: `EAGER_INTERFACE_COMPONENTS` (the light controls, imported statically, each from its own file) and `LAZY_INTERFACE_COMPONENTS` (`RichTextHTML`, `RichTextMarkdown`, `InputBlockEditor`, `SelectIcon`, `Map`, `AutocompleteAPI`, `CollectionItemDropdown`, `File`, `FileImage`, `Files`, `ListO2M`, `ListM2M`, `ListM2A`, each behind `React.lazy(() => import(…))`). A form bundles only the eager table; before, `FormFieldInterface` imported `@/components/ui` and with it every installed component.
  - `FormFieldInterface` reads the interface manifest instead of its own tables: the component name comes from the new `getRenderedInterfaceEntry(type)` (an entry id or a deprecated type literal), the csv normalisation from the `csvMultiValue` flag. While a lazy component loads, the field shows a skeleton of the manifest's `fallbackHeight` in its own Suspense boundary. A `client-only` component (the block editor) is not rendered until the page has hydrated; VForm now loads `input-block-editor.tsx` directly, not the `next/dynamic` wrapper.
  - A component the tables do not name is looked up on demand in the components barrel, as before: `SystemPermissions` (which `vform` does not install) and a project's own interfaces (`my-widget` → `MyWidget`) keep rendering, and an unknown one still shows the "Interface component not found" alert. A failed component load is reported by the field's error boundary.
  - `FormGroupField` imports the three group interfaces from their own files.
  - `@buildpad/utils` exports `getRenderedInterfaceEntry` (also from the consumer utils barrel).
  - Monorepo: `@buildpad/ui-interfaces` gains the subpath exports `./input-hash`, `./select-dropdown-m2o`, `./select-multiple-dropdown` and `./select-multiple-checkbox-tree`, so each interface can be imported by the path its registry component installs under.

  How stored records render does not change: every interface id resolves to the same component with the same props. Tests that render a lazy interface through VForm must now wait for it (`findBy…`). Upgrade the whole project (`buildpad upgrade`) with the 3.0 CLI; see docs/MIGRATION-3.0.md.

### Minor Changes

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

- 42ab7ff: Data layer for a Workflows admin module: types, data hooks, editor logic and translations. No components yet.

  - **Types** (`@buildpad/types`, `workflow.ts`): `WorkflowDefinitionRecord`, `WorkflowAssignmentRecord`, `WorkflowInstanceRecord`, `WorkflowHistoryRecord`, the `workflow_json` document (`WorkflowJson`, `WorkflowJsonState`, `WorkflowJsonCommand` with `module_access_keys`, `sourceHandle` and `targetHandle`, `WorkflowJsonAction`), the create and update bodies, and `WorkflowListResult<T>`. The four collection names are constants (`WORKFLOW_COLLECTIONS`: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance`, `daas_wf_history`); gate on these, they are the names the API enforces. The older, narrower `WorkflowAssignment`, `WorkflowState` and `WorkflowInstance` types of `@buildpad/hooks`, and the workflow button's own types, are unchanged.
  - **Hooks** (`@buildpad/hooks`): `useWorkflowDefinitions` (list, load every page for a picker, get, create, update, delete), `useWorkflowAssignments` (list, get, create, update, delete) and `useWorkflowInstances` (list, get, full transition history). They work against both backends: list counts are read from `count`/`totalCount`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, `data: null` is an empty page, and `page` and `limit` are always sent.
  - `WorkflowDefinitionRecord.workflow_json` is optional: both backends drop a field the caller's grant withholds, and the hooks do not put an empty machine in its place. `updateDefinition` sends a cleared description as an empty string, which both backends store (the Go engine ignores a `null` there).
  - **Typed errors** (`@buildpad/hooks`): every method of these hooks rejects with a `DaaSRequestError` whose `kind` is `notFound`, `forbidden`, `mfaRequired`, `unauthenticated`, `invalid` or `failure`, with the status, the backend's error code, and the readable message from `parseDaaSError`. A failed load is never an empty list, and a get never resolves without a record. `toDaaSRequestError`, `readDaaSListResponse`, `buildDaaSListQuery`, `readDaaSRecord` and `useDaaSRequest` are exported for other data hooks.
  - **Editor logic** (`@buildpad/utils`): `buildWorkflowCommand` and `buildWorkflowState` build what a dialog saves on top of the stored object, so keys the form has no field for (a command's `module_access_keys`) and the stored key order survive; `findWorkflowCommandProblem`, `findWorkflowStateProblem` and `findWorkflowDefinitionProblem` return what refuses a save, with a code to translate; `applyWorkflowStateSave` and `applyWorkflowCommandSave` apply a dialog's result to the document; `normalizeWorkflowJson` gives every command its `actions` and `policies` arrays; `isWorkflowFilterRule` and `parseWorkflowFilterRule` accept only an object of conditions (or none) as an assignment's filter rule. `clampPage` and `pageAfterRemoval` keep a paged list off a page that no longer exists after a delete.
  - **Translations** (`@buildpad/utils`): a `workflows` namespace with English defaults and the Indonesian catalog.

  `buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.

### Patch Changes

- Updated dependencies [42ab7ff]
  - @buildpad/types@3.0.0

## 2.6.0

### Minor Changes

- aa26d2b: Resolve the registry's interface ids to the interfaces they name.

  `registry.json` and the DaaS `/api/interfaces` catalog name three interfaces differently from the ids the renderer resolves: `input-tags`, `input-map` and `input-map-gl`. A field saved with one of those fell through to the type-based fallback, so a `json` column configured as tags rendered as a JSON code editor, a map column did the same, and the interface's own options — presets, `allowCustom` and the rest — were dropped without a word.

  All three resolve now, through one exported table that `tests/interface-catalog.test.ts` reads as well. That test used to keep its own copy of the same list, which is how the renderer came to have no entry for `input-tags` at all.

  `Tags` also guards its initial value. A field whose array/string cast is not wired up, such as a `csv` column mid-migration, hands the interface a raw string, and `value.map` threw and took the surrounding form down with it. A non-array value now renders an empty tag list.

### Patch Changes

- @buildpad/types@2.6.0

## 2.5.0

### Patch Changes

- @buildpad/types@2.5.0

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

### Patch Changes

- Updated dependencies [eec0a9e]
  - @buildpad/types@2.4.0

## 2.3.0

### Minor Changes

- b799724: Internationalization, phase 2.

  **Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

  **CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

  **Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages. A dictionary slot counts as a plural entry only when every key is a CLDR category, so overriding `interfaces.selectRadio.other` no longer drops that namespace's sibling strings.

### Patch Changes

- @buildpad/types@2.3.0

## 2.2.0

### Patch Changes

- @buildpad/types@2.2.0

## 2.1.0

### Patch Changes

- @buildpad/types@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/types@2.0.0

## 1.11.1

### Patch Changes

- 585362e: Batch of low/medium audit fixes across the relational stack.

  - All four relation item hooks (M2A, M2O, MultipleM2M, O2M) guard loadItems with a per-call request id, so an out-of-order response from a superseded call can no longer overwrite state with stale data.
  - ListO2M: editing a staged-created ($temp\_) row merges into its changeset.create entry instead of staging an update the backend can't resolve.
  - ListM2MInterface: the render-prop placeholder resolves {{field}} templates via the shared renderTemplate instead of printing the raw template string.
  - useRelationM2MItems requests the resolved junction PK field instead of a literal "id".
  - field-interface-mapper reads M2A allowed collections from snake_case `allowed_collections` (real DaaS storage) with camelCase fallback.
  - CollectionForm passes the loaded item's initial data (not schema defaults) as VForm initialValues.
  - ListM2M: header comment now documents that only junction-level operations are local-first; related-item edits persist immediately.

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

- c67c651: CollectionForm: seed create-mode form data from each field's own schema `default_value`, and parse that default properly.

  Create mode only ever seeded initial form data from the `defaultValues` prop and permission presets, so a field's column-level default (e.g. `status DEFAULT 'active'`) never reached the create payload — the database applied it server-side instead, and nothing the user saw reflected it. It is now seeded from the field's own schema.

  **Precedence.** The schema default is the _weakest_ signal and is merged last, underneath both a permission preset and an explicit `defaultValues` prop. Presets are how a role forces a value on create (`status`, `owner`, `tenant_id`), so a column default must never beat one.

  **Only fields the user can write and can see are seeded.** Everything in `formData` is sent on create, so seeding a field outside the role's write permission would put that field in the payload for the role to be rejected on, and seeding a condition-hidden field would persist a value the user was never shown. Write permission is checked in its own right rather than via the `meta.readonly` flag alone, because a form definition's per-field config is overlaid afterwards and can reset `readonly` to false.

  **Reuse.** The seeding calls the shared `getDefaultValuesFromFields`, which moves to `@buildpad/utils` beside the parser it wraps; `@buildpad/ui-form` re-exports it under the same name for its existing consumers. VForm already derived the same map for display, so keeping a second copy in CollectionForm meant the value the form showed and the value it submitted came from two rules that could drift.

  **`handleFormUpdate` replaces rather than merges.** VForm always emits the complete model, including when it drops a key because the value returned to the field's initial/default. Merging kept the dropped key at its stale value, so re-selecting a field's own default visibly snapped the control back to the previous choice and submitted that instead. This became reachable precisely because the cast fix below makes the parsed default compare equal to what the user picked.

  `getFieldDefault` is rewritten around an actual SQL-literal parse instead of substring tests, fixing a set of defects that this seeding would otherwise have written to rows:

  - **Cast suffixes.** Postgres appends the column type to a literal default, and the type name is not just words: it carries length/precision (`character varying(255)`, `numeric(10,2)`), array dimensions (`text[]`), schema qualification (`public.status_enum`), quoted identifiers (`"OrderStatus"`) and multi-word spellings, and casts can chain. Everything the old `[\w\s]` match missed was returned as raw SQL text.
  - **Parentheses.** The generated-default guard tested for a bare `(` anywhere, which discarded every parameterized cast _and_ every ordinary literal whose text contains a parenthesis (`'Acme (US)'`). It now recognises a function call as an identifier followed by `(`, and a quoted literal is read first so a parenthesis inside the text is never syntax.
  - **Keyword defaults.** `CURRENT_DATE`, `CURRENT_USER`, `LOCALTIMESTAMP`, lower-cased `current_timestamp` and `NULL` carry no parentheses, so nothing caught them and they were returned as literal strings. They are generated defaults and now yield `undefined`.
  - **Quote escaping.** `''` is SQL's escape for an embedded quote; `'It''s'` returned `It''s`.
  - **Falsy defaults.** Only `null`/`undefined` mean "no default" — `0`, `false` and `''` are real defaults that a falsy test dropped, so a column defaulting to `false` behaved differently from its sibling defaulting to `true`.
  - **Already-parsed defaults.** `default_value` is typed `unknown`; some backends return it parsed. `String()` turned `{}` into `"[object Object]"` and `[]` into the number `0`.
  - **Type-directed parsing.** The parse now consults the field's declared type instead of guessing from the shape of the text: a `json`/`jsonb` default is parsed into a value rather than left as the string `"{}"`, a numeric column yields a number even when the literal is quoted (`'-1'::integer`), and a string column keeps its string — `'007'` stayed `007` instead of becoming `7`. An integer beyond the safe range is left as text rather than silently shifted.

  `FormField` and `FormFieldInterface` route the column default through the same parser instead of handing the raw SQL text to the rendered control.

- ddbc1bd: CollectionList: resolve select/radio/multi-select values to their configured choice label (S8.3).

  `fieldTypeRenderCell` had no case for a choice-authoring field's `meta.options.choices` — a scalar select-dropdown/radio field showed its raw stored value (e.g. `"draft"` instead of the configured label `"Draft"`), and an array/csv-stored multi-select value fell through to the generic JSON-badge case, showing a content-less `"JSON"` badge instead of the selected labels. Now resolves scalar and array values through the field's choices, falling back to the raw value only when no configured choice matches.

  The resolution dispatches on the field's **interface**, a different axis from the column type the rest of `fieldTypeRenderCell` switches on, so it runs ahead of the type chain rather than inside it: `select-dropdown` is declared for `integer`, `bigInteger`, `float` and `decimal` as well as `string`, and from inside the chain a numeric choice field never reached it — the numeric branch re-formatted the value through `toLocaleString()`, so a choice valued `1000` rendered as `"1,000"`: neither its label nor its stored value. A field is treated as a choice field only when its interface is one of `CHOICE_INTERFACES`, so a non-choice field that happens to carry `options.choices` keeps its own rendering, and an unresolvable `json` payload keeps its JSON badge.

  `@buildpad/utils` gains `resolveChoiceLabel`, `parseChoiceValues` and `splitCsvValue`. Matching a stored value against a choice, and reading the three shapes a multi-select is persisted in (a real array, a JSON array still encoded as a string, and csv), are shared rules rather than list-rendering details — the form and the list have to agree on what a stored value means. `resolveChoiceLabel` matches exactly before falling back to a stringified comparison, so a value stored as `1` resolves to the choice authored as `1` and not to an earlier one authored as `"1"`.

- 50a4057: Concealed and hashed fields: one contract, and the three states told apart correctly.

  DaaS never returns a stored secret. Its read transformer sends a run of asterisks when a value exists, `null` when the column is empty, and omits write-only columns entirely — three states the UI has to distinguish. That rule was re-derived in four places with three different spellings (`/^\*+$/` twice, a truthy-length test that could not tell a mask from a real password, and a hardcoded ten-character literal), so `@buildpad/utils` now owns it: `CONCEALED_PLACEHOLDER`, `isConcealedValue`, `isConcealedField` and `concealingInterface`. The mask is a display only; nothing compares against its width, which the server chooses.

  **`FormFieldInterface`** decides the whole thing in one place, from the field, the resolved interface and the primary key it already receives:

  - An explicit `null` from a `conceal` field passes through. The server distinguishes its own empty state, so re-masking a just-cleared token stranded it as "still set" forever — that is the bug this change set out to fix.
  - A `hash` field keeps its mask on `null`. That path is not the server's: a hash column is never round-tripped on read, so the only producer of `null` is the leaf itself when the user types and then erases. Treating it as "no credential" flipped the padlock open and told the operator the account had no password while the stored hash was untouched.
  - A record that does not exist yet gets no mask. Create forms were showing a closed padlock and "Value securely stored", and users saved accounts with no credential at all.
  - A secret field rendered by a text interface gets no mask either, and is normalised back to `null` rather than `undefined` — a literal row of asterisks in a text box is something the user can submit as their password.

  **`FormField`** forwards the omitted signal for secret fields, and does so _ahead_ of the column default. A DDL default on a secret column is not the secret: taking that branch first rendered the literal default as "Value securely stored" and would have submitted it as the credential.

  **`InputHash`** resets its local value when the incoming value is the mask, not only on `null`/`undefined`. The mask is the steady state for a stored credential, so the old condition could never fire for the case it existed to handle — typed plaintext survived Discard, stayed visible, and was re-submitted on the next save. `isHashed` is also now a string test, so a non-string value cannot silently report "no credential stored".

  **`SystemToken`** accepts and forwards `aria-label`. `FormField` renders the visible label itself and withholds `label` from the leaf, so without this the token input had no accessible name at all — an axe `label` failure on the one field this work is about. Its empty-state placeholder no longer names the Generate control when that control is hidden (disabled or read-only), and says "No token set" instead of rendering a blank box. Clearing a token after generating one now also clears the fresh-token flag, which otherwise left the credential input as `type="text"`.

  **`CollectionForm`** drops concealed values from a Save-as-Copy payload. `formData` holds the server's mask verbatim, so copying a row wrote the literal asterisks into the new row's secret column — a guessable static token, or a password hashed from `**********`.

  The accessible name is now declared _after_ the `meta.options` spread, alongside the lock props, because admin-authored options JSON reaches the leaf unfiltered and an `aria-label` key in it silently erased the name.

  The per-field `data-testid` broadcast is not included. `FormField` already emits `data-field={field.field}` on every field wrapper and the Playwright suite already selects on it, so it duplicated a working hook; being derived from the field name alone it was also not unique once a nested `CollectionForm` was open (ListO2M, ListM2M, and JunctionItemForm which mounts two forms at once). Sub-element ids can be scoped within `[data-field]`.

  Registry: the `vform` component now declares `input-hash` and `system-token`, which `FormFieldInterface` maps but which were missing from its 35 interface dependencies, so `buildpad add vform` produced a form that fell through to "Interface component not found" for both. `input-hash` and `system-token` declare their new `utils` dependency.

- 577eda9: interface-catalog: add the missing `select-multiple-checkbox-tree` entry (S4.4/S8.4).

  `PROVISIONABLE_INTERFACES` had no entry for the checkbox-tree interface even though `select-multiple-checkbox-tree` is a real, resolvable interface id (`field-interface-mapper.ts` already has a `case` for it), `registry.json` already publishes it, and the component already ships from `@buildpad/ui-interfaces`. The catalog is what drives both in-repo pickers — `AddFieldModal` (via `provisionableInterfacesForType`) and `FieldPalette` (via `CATALOG_GROUPS`) — so until now a form author simply could not create a checkbox-tree field. It is also added to `CHOICE_INTERFACES` so the choices editor and the zero-choices save guard (`interfaceRequiresChoices`) treat it like the other choice-authoring interfaces.

  Both halves are new, and two limits are worth knowing rather than rediscovering later:

  - **The builder can only author a flat tree.** `ChoicesInput` is a `label=value` per-line textarea whose `Choice` is `{ text, value }`, while `TreeChoice` carries `children`. A tree field created through the form builder is therefore a single-level list; nested trees still have to come from DaaS-authored or hand-written `meta.options.choices`. `valueCombining` likewise has no editor and stays `'all'`.
  - **`types` mirrors `registry.json`, not the leaf's standalone capability.** That distinction is now documented in the catalog's module docstring.

  Supporting fixes so the new entry is actually sound end to end:

  - **`@buildpad/ui-interfaces`** — `SelectMultipleCheckboxTree` gained the `type` + normalize + re-serialize trio its two multi-select siblings already had. It is registered for `types: ['json', 'csv']` and the registry ships it standalone (`internalDependencies: []`), so a CLI-installed consumer renders it with no pipeline in front of it; a raw comma-string previously produced substring-matched reads via `String.includes`, character-spread writes, and a `TypeError: currentValue.filter is not a function` on the first uncheck. Tokens parsed out of a csv string are also mapped back to the declared choice value's type, so numeric choices on a csv column match instead of silently appending duplicates. A `null` value (the initial state of a nullable column) no longer crashes on mount, and the component now accepts a forwarded `aria-label` instead of announcing every tree field as "Tree selection".
  - **`@buildpad/ui-forms`** — `FormPreview.stories.tsx` had its own stale copy of `CHOICE_INTERFACES`, which would have rendered the new entry as "Choices option configured incorrectly" in the story that exists to prove every catalogued interface renders; it now imports the shared set. `FieldPalette` gained the `IconListTree` mapping `registry.json` already names, instead of falling back to the glyph already used by rich text.
  - **Tests** — the catalog is now pinned against `registry.json` in both directions, so a missing entry or a drifted `types` fails instead of shipping silently; the renderer-resolution check covers every declared type rather than only `types[0]`; and `csv` compatibility, previously unasserted, is now exhaustive.
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/types@1.9.3

## 1.9.2

### Patch Changes

- @buildpad/types@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/types@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/types@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/types@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/types@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/types@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- @buildpad/types@1.4.1

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

### Patch Changes

- `getExplicitInterface`: the explicit `"input"` interface no longer hardcodes `type: "string"`, so the field's actual type (`integer`, `decimal`, …) reaches the `Input` component and numeric fields render as number inputs. Field options can still override `type`.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.

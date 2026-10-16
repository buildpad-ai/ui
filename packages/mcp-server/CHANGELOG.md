# @buildpad/mcp

## 3.3.0

## 3.2.0

## 3.1.0

### Minor Changes

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

- dbbf3e1: Dependency security upgrades.

  `pnpm audit --prod` reported 125 advisories (3 critical, 58 high); it now reports none apart from one documented exception.

  - The CLI installs `@tiptap/*` ^3.31.4 (was ^3.13.0), `axios` ^1.20.0 (was ^1.6.0), `@mapbox/mapbox-gl-draw` ^1.5.2 and `dompurify` ^3.4.16 for the components that use them.
  - `@buildpad/mcp` moves to `@modelcontextprotocol/sdk` 1.x (was 0.5).
  - `maplibre-gl` stays on 5.x: its critical attribution XSS (GHSA-jrc7-96c5-q579) is fixed only in v6, which needs bundler worker setup in every app. Until then the map interface sanitizes basemap `attribution` with DOMPurify, the only way untrusted HTML reaches maplibre. `buildpad add map-with-real-map` now installs `dompurify`.

- f54f245: The MCP server's source tools now work from npm, and its upgrade tools cover lib modules and run the matching CLI.

  **Sources ship in the package.** Before this release, `get_component`, `copy_component` and `resources/read` looked for sources two directories above `dist/`. Under `npx` that directory is `node_modules/@buildpad/`, so for every npm user these tools returned `"Source code not available"`, empty `allSources` or empty file lists, with no error. The build now copies every file that the embedded registry references into `dist/sources/`. It fails if a copy's hash differs from the registry's `sourceSha256`. The server reads `packages/` when it runs from a monorepo checkout, and `dist/sources/` otherwise. It never reads `node_modules/@buildpad`. The tarball grows from about 374 kB to about 865 kB (3.7 MB unpacked). The sourcemap is no longer published.

  **Missing sources are errors.** A file that cannot be read now gives `isError: true` with a `missingSources` list (for `resources/read`, an MCP error with `missingSources` in its `data`). It no longer gives placeholder text or an empty list. `copy_component` with `includeLib` now also includes the lib modules that the component's lib dependencies need, as `buildpad add` does, and it reports `registryDependencies`.

  **Upgrade tools:**

  - `list_outdated` and `get_upgrade_plan` now report lib modules (`kind: "lib"`) and installed entries with no record, as well as components. `latestRelease` is now the registry's release. Before, it echoed the project's own release. Entries installed from a newer release are flagged `aheadOfRegistry`.
  - `get_upgrade_plan` now looks for component files where the CLI writes them: a `.ts` or `.tsx` target is on disk as `.tsx` (or `.jsx` when `tsx` is off). Before, `.ts` targets always showed as `missing`. Lib-module files use their target path unchanged, under `src/` for `srcDir` projects. Each file also reports its on-disk `path`. A file on disk with no install hash is now `untracked`, and its entry gets `recommendedAction: "overwrite-untracked"`, because the CLI overwrites such files whatever the strategy. A recorded target outside the project root, or a path that is not a regular file, is now `invalid-target` and is not read (its entry gets `recommendedAction: "review-invalid-targets"`). Before, such a target was read and hashed, and a directory failed the whole plan. Naming a component also plans the outdated lib modules it depends on. `components` must now be an array of names. Before, a string such as `"input"` was accepted and matched entries by substring.
  - `apply_upgrade` now runs `npx --yes @buildpad/cli@<MCP version> upgrade`. Before, it ran whichever CLI was latest. It accepts only the strategies `overwrite`, `new-file` and `three-way`, and only lowercase registry names, which it passes after `--`. It adds the outdated lib modules that named components depend on (turn this off with `includeLibDependencies: false`). It refuses to run if the project, a named entry or a lib module it would add was installed from a newer release than the MCP, because that would downgrade it. `projectPath` must now be an absolute path; relative paths are rejected. Before, `"."` worked only because it resolved against the server's working directory. A CLI run that cannot start, exits non-zero or times out now returns `isError: true`; before, only the JSON body said `success: false`. The timeout is now 120 s, up from 60 s, to allow npx to download the pinned CLI.

  **Guidance text:** the tools no longer say that `@buildpad/cli` is not on npm, or tell users to clone the repository and pass `--project` (an option the CLI does not have). They now show `npx @buildpad/cli add <name>` and `--cwd`.

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

### Patch Changes

- c25670f: Installing a registry entry on its own now installs everything its files import.

  - `add users-management` installs `vtable`: the users, roles and policies tables import it, so a project without it failed to compile.
  - `add content-routes` installs `content-layout`, `content-navigation`, `collection-list` and `collection-form`, which its pages import.
  - `api-routes` depends on the `hooks` lib module: `components/DaaSProviderWrapper.tsx` imports `@/lib/buildpad/hooks`. A project that already has `api-routes` but not `hooks` gets it from `buildpad upgrade api-routes` (or `upgrade --all`, or `add hooks`); a plain `buildpad upgrade` does not install it, because no file of `api-routes` changed.
  - `@buildpad/mcp` embeds the same registry: `list_lib_modules` now lists `hooks` under `api-routes`, `copy_component` for `api-routes` (and for `external-oauth`, which depends on it) also returns the `hooks` files, and the `users-management` and `content-routes` entries list their new dependencies.

  The generated `components/ui/index.ts` no longer fails to compile when two installed components export the same name. With both `file-manager` and `users-management` installed, `DeleteConfirmModal` and `DeleteConfirmModalProps` were ambiguous under `export *` (TS2308), which broke `tsc` and `next build`. The barrel now re-exports each such name from the first component that provides it (alphabetical), and `add` lists them; import the other one by path, e.g. `@/components/ui/users-management`.

  Two gaps remain, because fixing them means moving a file to another entry: the `api-routes` logout route imports `@/lib/oauth/config` (install `external-oauth`, as `add --with-api` and `bootstrap` do), and the `services` module's `lib/module-access/enforce.ts` imports `@/lib/supabase/server` (install `supabase-auth`).

## 2.6.0

### Patch Changes

- 720399e: MCP server: start when it is launched through a bin shim.

  `npx -y @buildpad/mcp@latest` exited straight away with no output, which a client reports as `CONNECTION_CLOSED`. The check that decides whether the module is being run or imported compared `import.meta.url` with `process.argv[1]` as strings, and npx and pnpm expose a package's `bin` as a symlink: the two name the same file by different paths, so the server concluded it had been imported and did nothing.

  It now compares the resolved real paths, which sees through the symlink, and falls back to the old comparison if either path cannot be resolved — a wrong answer there is the same silent, unexplained exit.

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

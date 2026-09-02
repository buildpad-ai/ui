# Buildpad CLI - Agent Reference

> **For AI Agents**: This document provides complete information about the Buildpad CLI structure, component locations, and how to help users add components.

## Quick Reference

### Registry Location
```
packages/registry.json     # Master registry with all components, dependencies, and file mappings
```

### Key Commands
```bash
buildpad list                    # List all components with categories
buildpad list --json             # JSON output for programmatic use
buildpad list --category input   # Filter by category
buildpad info <component>        # Get full details about a component
buildpad info <component> --json # JSON output
buildpad tree <component>        # Show dependency tree
buildpad add <component>         # Add component to project
buildpad add --all               # Add all components (non-interactive)
buildpad diff <component>        # Preview changes before adding
buildpad bootstrap               # Full setup: init + add --all + deps + validate
buildpad bootstrap --cwd <path>  # Bootstrap in a specific directory
buildpad bootstrap --locales en,id --default-locale en  # Locales for app/[lang] (default: en)
buildpad add i18n                # Locale routing module (lib/i18n, LanguageSwitcher) on its own
buildpad migrate i18n            # Move a pre-2.3 app onto app/[lang] routing
buildpad status                  # Show installed components
buildpad status --json           # JSON output for scripting
buildpad validate                # Validate installation (imports, SSR, missing files)
buildpad validate --json         # JSON output for CI/CD
buildpad fix                     # Auto-fix common issues
buildpad outdated                # Check for component AND lib-module updates (incl. design-system)
buildpad upgrade --all           # Upgrade all components with safe per-file checksums
buildpad upgrade --design        # Upgrade only the design-system module (tokens, globals, theme, app shell)
buildpad upgrade --three-way     # 3-way merge (diff3) for conflict resolution on modified files
buildpad upgrade --force         # Re-sync components even when already at latest version
buildpad upgrade <comp> --dry-run # Preview upgrade without writing files
buildpad changelog <pkg>         # View changelog between installed and latest versions
buildpad changelog <pkg> --since # Filter changelog by version
buildpad migrate                 # Migrate buildpad.json from schema v1 to v2
```

## Component Locations

### Source Packages (for reading code)
| Package | Path | Contains |
|---------|------|----------|
| **ui-interfaces** | `packages/ui-interfaces/src/` | 31 interface components (input, select, datetime, etc.) |
| **ui-form** | `packages/ui-form/src/` | VForm dynamic form component with permission enforcement |
| **ui-table** | `packages/ui-table/src/` | VTable dynamic table component with DaaS playground |
| **ui-collections** | `packages/ui-collections/src/` | CollectionForm, CollectionList, ContentLayout, ContentNavigation, FilterPanel, SaveOptions |
| **types** | `packages/types/src/` | TypeScript type definitions |
| **services** | `packages/services/src/` | API services (FieldsService, CollectionsService, DaaSProvider, etc.) |
| **hooks** | `packages/hooks/src/` | React hooks (useAuth, usePermissions, useRelationM2M, useRelationMultipleM2M, useFieldMetadata, etc.) |
| **utils** | `packages/utils/src/` | Utility functions (field-interface-mapper) |

### Component-to-File Mapping

#### High-Level Components (Collection category)
| Component | Source Path | Description |
|-----------|-------------|-------------|
| `vform` | `packages/ui-form/src/VForm.tsx` | Dynamic form - renders all 40+ interface types |
| `vtable` | `packages/ui-table/src/VTable.tsx` | Dynamic table with sorting, selection, drag-drop |
| `collection-form` | `packages/ui-collections/src/CollectionForm.tsx` | CRUD wrapper with data fetching (uses VForm) |
| `collection-list` | `packages/ui-collections/src/CollectionList.tsx` | Dynamic table with pagination |
| `content-layout` | `packages/ui-collections/src/ContentLayout.tsx` | Shell layout with sidebar and main content |
| `content-navigation` | `packages/ui-collections/src/ContentNavigation.tsx` | Hierarchical collection navigation |
| `filter-panel` | `packages/ui-collections/src/FilterPanel.tsx` | Field-type-aware filter builder |
| `save-options` | `packages/ui-collections/src/SaveOptions.tsx` | Save action dropdown menu |

#### Basic Interface Components (ui-interfaces)
| Component | Source Path | Category |
|-----------|-------------|----------|
| `input` | `packages/ui-interfaces/src/input/Input.tsx` | input |
| `textarea` | `packages/ui-interfaces/src/textarea/Textarea.tsx` | input |
| `input-code` | `packages/ui-interfaces/src/input-code/InputCode.tsx` | input |
| `boolean` | `packages/ui-interfaces/src/boolean/Boolean.tsx` | boolean |
| `toggle` | `packages/ui-interfaces/src/toggle/Toggle.tsx` | boolean |
| `datetime` | `packages/ui-interfaces/src/datetime/DateTime.tsx` | datetime |
| `select-dropdown` | `packages/ui-interfaces/src/select-dropdown/SelectDropdown.tsx` | selection |
| `select-radio` | `packages/ui-interfaces/src/select-radio/SelectRadio.tsx` | selection |
| `select-icon` | `packages/ui-interfaces/src/select-icon/SelectIcon.tsx` | selection |
| `tags` | `packages/ui-interfaces/src/tags/Tags.tsx` | input |
| `color` | `packages/ui-interfaces/src/color/Color.tsx` | selection |
| `slider` | `packages/ui-interfaces/src/slider/Slider.tsx` | input |
| `file` | `packages/ui-interfaces/src/file/File.tsx` | media |
| `file-image` | `packages/ui-interfaces/src/file-image/FileImage.tsx` | media |
| `files` | `packages/ui-interfaces/src/files/Files.tsx` | media |
| `divider` | `packages/ui-interfaces/src/divider/Divider.tsx` | layout |
| `notice` | `packages/ui-interfaces/src/notice/Notice.tsx` | layout |
| `group-detail` | `packages/ui-interfaces/src/group-detail/GroupDetail.tsx` | layout |
| `list-m2m` | `packages/ui-interfaces/src/list-m2m/ListM2M.tsx` | relational |
| `select-dropdown-m2o` | `packages/ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx` | relational |
| `list-o2m` | `packages/ui-interfaces/src/list-o2m/ListO2M.tsx` | relational |
| `list-m2a` | `packages/ui-interfaces/src/list-m2a/ListM2A.tsx` | relational |

## Understanding Dependencies

### Types of Dependencies

1. **`dependencies`** - External npm packages (e.g., `@mantine/core`, `dayjs`)
2. **`internalDependencies`** - Lib modules (`types`, `services`, `hooks`, `utils`)
3. **`registryDependencies`** - Other Buildpad components

### VForm Dependency Tree (Most Complex)
```
vform
├── internalDependencies:
│   ├── types      → lib/buildpad/types/
│   ├── services   → lib/buildpad/services/
│   ├── hooks      → lib/buildpad/hooks/
│   └── utils      → lib/buildpad/utils/
│
└── registryDependencies (32 components):
    ├── input, textarea, input-code, input-block-editor
    ├── boolean, toggle
    ├── datetime
    ├── select-dropdown, select-radio, select-icon
    ├── select-multiple-checkbox, select-multiple-dropdown, select-multiple-checkbox-tree
    ├── color, tags, slider
    ├── autocomplete-api, collection-item-dropdown
    ├── file, file-image, files, upload
    ├── list-m2m, select-dropdown-m2o, list-o2m, list-m2a
    ├── divider, notice, group-detail
    ├── rich-text-html, rich-text-markdown
    ├── map, workflow-button
    └── (each has its own dependencies)
```

### CollectionForm Dependency Tree
```
collection-form
├── internalDependencies:
│   ├── types
│   └── services
│
└── registryDependencies:
    └── vform (includes all 32 interface components)
```

## Common Agent Tasks

### Task 1: User wants to add VForm
```bash
# Best approach - let CLI handle all dependencies
buildpad add vform

# This will automatically:
# 1. Install lib modules: types, services, hooks, utils
# 2. Install all 32 interface components
# 3. Transform imports to local paths
# 4. List missing npm dependencies
```

### Task 2: User wants CollectionForm
```bash
# This adds CollectionForm + VForm + all dependencies
buildpad add collection-form
```

### Task 3: User wants specific components
```bash
# Add individual components
buildpad add input select-dropdown datetime

# Add by category
buildpad add --category selection
```

### Task 4: Check what's installed
```bash
buildpad status
buildpad status --json
```

### Task 5: Find a component's source
```bash
# Get detailed info including source path
buildpad info input
buildpad info vform
```

### Task 6: Validate installation
```bash
# Check for common issues (untransformed imports, missing files, SSR problems)
buildpad validate

# JSON output for CI/CD integration
buildpad validate --json

# Run in specific directory
buildpad validate --cwd /path/to/project
```

### Task 7: Full project bootstrap (recommended for AI agents)
```bash
# Single command: init + add --all + install deps + validate
buildpad bootstrap --cwd /path/to/project

# Skip dependency installation
buildpad bootstrap --skip-deps --cwd /path/to/project

# Skip validation step
buildpad bootstrap --skip-validate --cwd /path/to/project
```

Bootstrap installs everything non-interactively, including:
- All 40+ UI components
- Lib modules (types, services, hooks, utils)
- **Design system** (`design-system` module): `app/design-tokens.css`, `app/globals.css`,
  `lib/theme.ts`, and the app shell (`ColorSchemeToggle`, `AuthenticatedShell`) — tracked in
  `buildpad.json` so `upgrade --design` can refresh it later
- API proxy routes (fields, items, relations, files)
- Auth proxy routes (login, logout, user, callback) + login page
- Supabase auth utilities and middleware
- **OAuth helpers** (`external-oauth` module): `lib/oauth/*` (config, pkce, validate) + OAuth
  provider route and login buttons — required because the auth routes import `@/lib/oauth/*`
- **Locale routing** (`i18n` module): `lib/i18n/*` and `components/LanguageSwitcher.tsx`; every
  page lives under `app/[lang]/` — see [Locale routing](#locale-routing-applang)
- npm dependencies via `pnpm install` (incl. `@supabase/ssr`, `@supabase/supabase-js`, `jose`,
  `negotiator`, `@formatjs/intl-localematcher`, `server-only`)

The validate command checks for:
- **Untransformed imports** - `@buildpad/*` imports that weren't converted to local paths
- **Missing lib files** - Required utility modules not present
- **Missing CSS files** - CSS required by rich text/block editors
- **SSR issues** - Components exported without SSR-safe wrappers
- **Missing API routes** - DaaS integration routes

### Task 8: Check for component updates
```bash
# See which installed FILES changed upstream since they were installed
buildpad outdated
buildpad outdated --json
```

`outdated` compares content, not versions: each file's registry `sourceSha256`
against the hash recorded in `buildpad.json` at install time. A lockstep release
that leaves a component's files byte-identical produces no report for it, and a
file a previous `upgrade` left unwritten (`state: "pending"`) keeps reporting
until it is actually written. The output names the file and the reason —
`changed upstream`, `pending`, `new file`, or `removed upstream`.

Because the CLI fetches its sources from the release tag matching its own
version, "up to date" means "up to date with the release this CLI ships
against". `outdated` also checks npm's `latest` dist-tag and prints a hint when
the CLI itself is behind; that check is advisory and is skipped silently when
npm is unreachable.

### Task 9: Upgrade components safely
```bash
# Upgrade all components (silent overwrite for pristine, prompt for modified)
buildpad upgrade --all

# Upgrade specific components
buildpad upgrade input vform

# Preview what would change
buildpad upgrade --all --dry-run

# 3-way merge (diff3) for conflict resolution
buildpad upgrade --all --three-way

# Write .new files for modified files (keep originals)
buildpad upgrade --all --strategy=new-file

# Re-sync every file even when its upstream content is unchanged (bypasses
# the staleness gate, still honours --strategy). Default target is all
# installed components.
buildpad upgrade --force --three-way

# Read unreleased sources from a branch instead of the pinned release tag
buildpad upgrade --all --ref main

# Upgrade ONLY the design system (tokens, globals, theme, app shell)
buildpad upgrade --design
buildpad upgrade --design --three-way   # merge local token edits instead of overwriting
```

`upgrade` handles **lib modules** (not just components). The `design-system` module —
scaffolded by `init` and tracked in `buildpad.json` — is refreshed with `--design`, or
automatically when you run a bare `buildpad upgrade` and its files changed upstream. Because design-token
files are meant to be customized, modified files are three-way merged (or written as `.new`),
never silently clobbered. You can also name it explicitly: `buildpad upgrade design-system`.
If a project has the design files but no tracking record (installed before this feature),
`upgrade --design` adopts and records the module.

### Task 10: View changelogs
```bash
# See what changed between installed and latest version
buildpad changelog @buildpad/ui-interfaces

# Filter by version
buildpad changelog @buildpad/ui-form --since=1.3.0

# Changelog for a specific component (resolves to its source package)
buildpad changelog input
```

### Task 11: Migrate config schema
```bash
# Bring buildpad.json up to schema v3 (required for content-based updates)
buildpad migrate

# Preview migration
buildpad migrate --dry-run
```

**v2 → v3.** A v2 manifest records the hash of each file the CLI *wrote*, but
never the upstream hash it came from — so there is nothing for v3 to compare
against. `migrate` fetches `registry.json` at `v<recorded version>` (the release
the component was installed from) and copies each file's real `sourceSha256` out
of it, recording that tag as the file's `ref`.

Where that tag is unreachable, the file takes the *current* upstream hash and is
marked `pending` instead. That is deliberate: a pending file keeps showing up in
`outdated` until a real `upgrade` writes it, so a guessed baseline can never pass
unnoticed. Follow up with:

```bash
buildpad upgrade --three-way   # write the pending files, merging local edits
buildpad status                # confirm files are pristine
```

**v1 → v3.** A v1 manifest has no per-file records at all, so `migrate` re-derives
the local hashes by transforming the current sources the way `add` would, and
baselines everything to the current release.

### Task 12: Check if config needs migration
```bash
# Any command warns when the manifest is older than the CLI's schema
buildpad status

# If you see "Run 'npx buildpad migrate'", run it
buildpad migrate
```

A CLI refuses to run against a manifest written by a *newer* CLI rather than
silently dropping fields it does not understand — upgrade the CLI in that case.

## Registry Schema

The `packages/registry.json` follows this structure:

```typescript
interface Registry {
  schemaVersion: number;    // 2
  generatedAt: string;      // ISO-8601 timestamp
  version: string;          // Global version string
  name: string;
  description: string;
  
  meta: {
    model: "copy-own";
    framework: "react";
    uiLibrary: "mantine-v8";
    typescript: true;
  };
  
  aliases: {
    "@/lib/buildpad": "./lib/buildpad";
    "@/components/ui": "./components/ui";
  };
  
  dependencies: {
    core: string[];    // @mantine/core, react, etc.
    icons: string[];   // @tabler/icons-react
    dates: string[];   // dayjs, @mantine/dates
    // ...
  };
  
  packages: {
    [packageName: string]: {
      version: string;          // semver from package.json
      changelogUrl: string;     // relative path to CHANGELOG.md
    }
  };
  
  lib: {
    types: LibModule;    // Core types
    services: LibModule; // API services  
    hooks: LibModule;    // React hooks
    utils: LibModule;    // Utility functions
  };
  
  components: ComponentEntry[];  // 40+ components
  categories: CategoryEntry[];   // 10 categories
}

interface ComponentEntry {
  name: string;               // e.g., "input", "vform"
  title: string;              // e.g., "Input", "VForm"
  description: string;
  category: string;           // e.g., "input", "collection"
  sourcePackage: string;      // e.g., "@buildpad/ui-interfaces"
  version: string;            // inherited from sourcePackage
  lastChangedIn?: string;     // DISPLAY ONLY since manifest v3 — no CLI decision reads it
  files: FileMapping[];       // source → target mappings
  dependencies: string[];     // npm packages
  internalDependencies: string[];    // lib modules
  registryDependencies?: string[];   // other components
}

interface FileMapping {
  source: string;             // e.g., "ui-interfaces/src/input/Input.tsx"
  target: string;             // e.g., "components/ui/input.tsx"
  sourceSha256?: string;      // SHA256 of untransformed source — the value
                              // `outdated` compares against buildpad.json
}
```

## Manifest Schema (`buildpad.json`, v3)

The consumer-side manifest. `add`, `upgrade`, and `migrate` write it; `outdated`,
`status`, and `validate` read it.

```typescript
interface Manifest {
  schemaVersion: 3;
  release: string;            // lockstep release last synced to, e.g. "2.0.0"
  model: "copy-own";
  tsx: boolean;
  srcDir: boolean;
  aliases: { components: string; lib: string };
  installedComponents: string[];
  installedLib: string[];
  components: Record<string, Install>;
  lib: Record<string, Install>;
}

interface Install {
  release: string;            // display only — staleness is decided per file
  ref: string;                // git ref the files were fetched from
  sourcePackage: string;      // e.g. "@buildpad/ui-interfaces"
  installedAt: string;        // ISO-8601
  files: FileRecord[];
}

interface FileRecord {
  target: string;             // e.g. "components/ui/input.tsx"
  sourceSha256: string;       // registry hash of the UNTRANSFORMED upstream
                              // source at install time → detects UPSTREAM change
  sha256: string;             // hash of the TRANSFORMED bytes the CLI wrote,
                              // origin header stripped → detects LOCAL change
  ref: string;                // git ref this file came from — the exact diff3
                              // base for the next upgrade. "local" in a
                              // monorepo checkout; "url:<base>" under
                              // BUILDPAD_REGISTRY_URL
  state: "clean" | "pending"; // "pending" = the last upgrade did not write it
}
```

### Why two hashes

They answer independent questions. `sourceSha256` says whether **upstream**
moved; `sha256` says whether the **consumer** edited the file. Keeping them
separate is what lets `upgrade` apply this matrix:

| Upstream changed | Local modified | Action |
|---|---|---|
| no | no | nothing |
| no | yes | nothing — no prompt |
| yes | no | overwrite, silent |
| yes | yes | diff3 against `ref`, else the chosen `--strategy` |
| added upstream | – | add |
| removed upstream | – | keep on disk, warn, stop tracking |

The row that matters most in practice is "upstream unchanged, locally modified".
Before v3 the CLI had no way to see it, so editing one file in a component meant
being prompted to overwrite it every time any *sibling* file changed upstream.

### Why `ref` is per file

`upgrade` needs the common ancestor for a three-way merge. Deriving it from a
version number required guessing a tag name, which failed whenever the guess was
wrong (`@buildpad/cli` and `@buildpad/mcp` were untagged at several releases) or
whenever the install came from `main` between releases. Recording where the bytes
actually came from removes the guess. When a recorded ref is unreachable the CLI
writes a `.new` file and marks the entry `pending` — it never merges against a
substitute ancestor.

## Troubleshooting

### "Component not found" Error
1. Check exact name with `buildpad list`
2. Names are case-insensitive
3. Common aliases:
   - `select` → use `select-dropdown`
   - `m2m` → use `list-m2m`
   - `form` → use `vform` or `collection-form`

### "buildpad.json not found"
```bash
buildpad init --yes  # Initialize with defaults
```

### Missing Dependencies After Add
The CLI lists missing npm packages at the end:
```bash
# Install shown dependencies
pnpm add @mantine/core @mantine/hooks dayjs
```

### Checking Source Code
To read a component's source code before adding:
```bash
# The source is in packages/
cat packages/ui-interfaces/src/input/Input.tsx
cat packages/ui-form/src/VForm.tsx
```

### "buildpad.json is schema v1/v2" Warning
```bash
# Migrate to v3 to enable content-based update detection
buildpad migrate
# Or with preview
buildpad migrate --dry-run
```

Until this is done, `outdated` cannot determine staleness for those entries and
says so rather than guessing.

### "Component is locally modified" During Upgrade
```bash
# Preview the diff before deciding
buildpad diff <component>

# Upgrade with .new file strategy (preserves original)
buildpad upgrade <component> --strategy=new-file

# Force overwrite (back up first!)
buildpad upgrade <component> --yes
```

## Bootstrap Command (Recommended for AI Agents)

The `bootstrap` command combines `init` + `add --all` + `pnpm install` + `validate` into a single atomic command. This is the recommended approach for AI agents and CI/CD pipelines.

```bash
# Full project setup in one command (non-interactive, no prompts)
buildpad bootstrap --cwd /path/to/project

# Skip dependency installation (if you want to install manually)
buildpad bootstrap --skip-deps --cwd /path/to/project

# Skip validation step
buildpad bootstrap --skip-validate --cwd /path/to/project
```

**What bootstrap does:**
1. Creates `buildpad.json` and project skeleton (package.json, tsconfig, etc.)
2. Copies all 40+ UI components to `components/ui/`
3. Copies types, services, hooks to `lib/buildpad/`
4. Copies API proxy routes (items, fields, relations, files)
5. Copies auth proxy routes (login, logout, user, callback) and login page
6. Copies Supabase auth utilities and middleware
7. Runs `pnpm install` to resolve all dependencies
8. Validates the installation

**Auth Routes Installed:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Login via Supabase Auth (server-side, no CORS) |
| `/api/auth/logout` | POST | Sign out and clear session cookies |
| `/api/auth/user` | GET | Get current user profile |
| `/api/auth/callback` | GET | Handle OAuth/email-confirm redirects |
| `/app/[lang]/login/page.tsx` | — | Login page using proxy pattern (locale-prefixed) |

**Key advantage:** Bootstrap works in non-empty directories (unlike `create-next-app`).

## Locale routing (`app/[lang]`)

Every app scaffolded by `init`/`bootstrap` is locale-prefixed: `/` redirects to `/<locale>`
(negotiated from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the default), unknown
locales 404, and `/api/*` is never prefixed. The pieces, all tracked in `buildpad.json`:

| Piece | Module | What it does |
|-------|--------|--------------|
| `lib/i18n/config.ts` | `i18n` | `locales`, `defaultLocale`, `localeMeta`, `hasLocale`, `stripLocale`, `localeHref` — the only place locale codes are declared |
| `lib/i18n/negotiate.ts` | `i18n` | `negotiateLocale(request)` for middleware (Negotiator + `@formatjs/intl-localematcher`) |
| `lib/i18n/dictionaries.ts` + `dictionaries/<code>.json` | `i18n` | Server-only loader; `app.*` strings for your pages, `buildpad.*` overrides for Buildpad components |
| `lib/i18n/provider.tsx` | `i18n` | `I18nProvider` / `useI18n()` (`t`, `formatDate`, `formatNumber`); also mounts `BuildpadI18nProvider` from `lib/buildpad/services` so copied components render in the locale |
| `lib/i18n/navigation.ts` | `i18n` | `useLocaleRouter()` (drop-in `useRouter` that prefixes the locale), `useLocaleHref()`, `useSwitchLocale()` |
| `lib/i18n/content.ts` | `i18n` | `pickTranslation`, `translationsQuery`, `localeListQuery` for DaaS content translations |
| `components/LanguageSwitcher.tsx` | `i18n` | Locale select; rendered by `AuthenticatedShell`'s header and the login page (hidden with one locale) |
| `app/[lang]/layout.tsx` | scaffolded by `init` | `generateStaticParams`, `notFound()`, `<html lang dir>`, `DirectionProvider`, `I18nProvider` — there must be no `app/layout.tsx` beside it |
| `middleware.ts`, `lib/supabase/middleware.ts` | `supabase-auth` | Locale redirect before the session refresh; route gating on the prefix-stripped path |

`supabase-auth`, `design-system` and `api-routes` declare `i18n` as an internal dependency, so
`add api-routes` / `upgrade --design` install it when missing. Route modules write nav entries
with `labelKey`/`sectionKey` dictionary paths (`app.nav.users`, `app.nav.administration`).

```bash
# Scaffold with two locales (dictionaries/id.json is seeded from en.json — translate it)
buildpad bootstrap --locales en,id --default-locale en --cwd /path/to/project

# Existing app scaffolded before locale routing: move it under app/[lang]
buildpad migrate i18n --cwd .              # add --locales en,id to configure locales too
buildpad upgrade --all --three-way --cwd . # pulls the locale-aware middleware, login, shell, pages
```

`migrate i18n` installs the `i18n` module, writes the new root layout to `app/[lang]/layout.tsx`
(your previous `app/layout.tsx` is kept as `app/[lang]/layout.pre-i18n.tsx` for a manual merge),
moves every other route entry under `app/[lang]/` (API routes, CSS and metadata files stay), and
retargets the manifest so `upgrade` follows the moved files. Your own pages then need
`useLocaleRouter()` instead of `useRouter()` and `localeHref` for literal `href="/…"` links — the
command prints the grep to find them.

Locale edits made by `--locales` live in marker-delimited blocks (`// buildpad:locales`,
`// buildpad:locale-meta-start`, `// buildpad:dictionary-loaders-start`); they show as local
modifications to `lib/i18n/config.ts` and `lib/i18n/dictionaries.ts`, which `upgrade` three-way
merges. Adding a locale by hand means editing those blocks and creating `dictionaries/<code>.json`.

`validate` reports `DUPLICATE_ROOT_LAYOUT` (both `app/layout.tsx` and `app/[lang]/layout.tsx`),
`MISSING_I18N_MODULE` (a module that imports `lib/i18n` without it) and `MISSING_LANG_LAYOUT`.

## For Humans: Quick Start

```bash
# 1. Initialize in your project
cd your-nextjs-app
npx @buildpad/cli init

# 2. Add components
npx @buildpad/cli add input select-dropdown datetime

# 3. Or add the full form system
npx @buildpad/cli add collection-form

# 4. Or bootstrap everything at once
npx @buildpad/cli bootstrap

# 5. Install npm dependencies (shown at end, or done by bootstrap)
pnpm add @mantine/core @mantine/hooks @tabler/icons-react
```

See [QUICKSTART.md](../QUICKSTART.md) for complete setup guide.

## Testing the CLI Locally

For pre-commit testing of the CLI versioning/upgrade infrastructure, follow the 13-step guide at [docs/TESTING.md](TESTING.md#cli-local-testing-guide-pre-commit).

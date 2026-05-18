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
buildpad status                  # Show installed components
buildpad status --json           # JSON output for scripting
buildpad validate                # Validate installation (imports, SSR, missing files)
buildpad validate --json         # JSON output for CI/CD
buildpad fix                     # Auto-fix common issues
buildpad outdated                # Check for component updates
buildpad upgrade --all           # Upgrade all components with safe per-file checksums
buildpad upgrade --three-way     # 3-way merge (diff3) for conflict resolution on modified files
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
- API proxy routes (fields, items, relations, files)
- Auth proxy routes (login, logout, user, callback) + login page
- Supabase auth utilities and middleware
- npm dependencies via `pnpm install`

The validate command checks for:
- **Untransformed imports** - `@buildpad/*` imports that weren't converted to local paths
- **Missing lib files** - Required utility modules not present
- **Missing CSS files** - CSS required by rich text/block editors
- **SSR issues** - Components exported without SSR-safe wrappers
- **Missing API routes** - DaaS integration routes

### Task 8: Check for component updates
```bash
# See which installed components have newer versions
buildpad outdated
buildpad outdated --json
```

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
```

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
# Migrate buildpad.json from v1 to v2 (enables per-file update tracking)
buildpad migrate

# Preview migration
buildpad migrate --dry-run
```

### Task 12: Check if config needs migration
```bash
# status command will prompt if schemaVersion is missing
buildpad status

# If you see "Run 'npx buildpad migrate' to enable safe updates", run migrate
buildpad migrate
```

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
  lastChangedIn?: string;     // semver of last actual file change (for outdated optimization)
  files: FileMapping[];       // source → target mappings
  dependencies: string[];     // npm packages
  internalDependencies: string[];    // lib modules
  registryDependencies?: string[];   // other components
}

interface FileMapping {
  source: string;             // e.g., "ui-interfaces/src/input/Input.tsx"
  target: string;             // e.g., "components/ui/input.tsx"
  sourceSha256?: string;      // SHA256 of untransformed source (registry v2)
}
```

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

### "Schema v1 detected" Warning
```bash
# Migrate to v2 to enable safe per-file updates
buildpad migrate
# Or with preview
buildpad migrate --dry-run
```

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
| `/app/login/page.tsx` | — | Login page using proxy pattern |

**Key advantage:** Bootstrap works in non-empty directories (unlike `create-next-app`).

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

# Buildpad UI Packages

A pnpm workspace containing reusable components distributed via Copy & Own model.

## 📚 Documentation

| Document                                     | Description                            |
| -------------------------------------------- | -------------------------------------- |
| [QUICKSTART.md](QUICKSTART.md)               | Setup guide for MCP Server & CLI       |
| [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md)     | Complete documentation index           |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture diagrams           |
| [docs/CLI.md](docs/CLI.md)                   | CLI commands & agent reference         |
| [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) | Distribution methods + Amplify hosting |
| [docs/TESTING.md](docs/TESTING.md)           | Playwright E2E testing guide           |
| [docs/PUBLISHING.md](docs/PUBLISHING.md)     | npm publishing & release workflow      |
| [docs/WINDOWS.md](docs/WINDOWS.md)           | Windows development guide              |

## 🏗️ Structure

```
buildpad-ui/
├── pnpm-workspace.yaml     # Workspace configuration (packages/* + apps/*)
├── package.json            # Root scripts
├── docs/                   # Documentation
│   ├── DOCS_INDEX.md       # Documentation index
│   ├── ARCHITECTURE.md     # System architecture
│   ├── CLI.md              # CLI commands & agent reference
│   ├── COMPONENT_MAP.md    # Quick component lookup table
│   ├── DESIGN_SYSTEM.md    # Token-based theming architecture
│   ├── DISTRIBUTION.md     # Distribution guide
│   ├── PUBLISHING.md       # npm publishing & release workflow
│   ├── TESTING.md          # Playwright E2E testing guide
│   ├── WINDOWS.md          # Windows setup
├── apps/                   # Standalone applications
│   └── storybook-host/     # Next.js auth proxy & Storybook host (Amplify)
│       ├── app/api/        # DaaS proxy routes (connect, disconnect, status, catch-all)
│       ├── lib/cookie.ts   # AES-256-GCM encrypted credential storage
│       └── public/storybook/ # Built Storybooks served at /storybook/*
├── tests/                  # Playwright E2E tests
│   ├── auth.setup.ts       # Authentication setup
│   ├── ui-form/            # VForm component tests
│   └── ui-table/           # VTable component tests
├── scripts/               # Build & maintenance scripts
│   └── build-registry.mjs  # Registry generator (registry.template.json → registry.json)
└── packages/               # Component library (source of truth)
    ├── registry.json              # Component registry (auto-generated)
    ├── registry.template.json     # Registry template (hand-edited source)
    ├── cli/                # CLI tool for developers (@buildpad/cli)
    ├── mcp-server/         # MCP server for AI agents (@buildpad/mcp)
    ├── ui-interfaces/      # Field interface components (Storybook port 6005)
    ├── ui-form/            # VForm dynamic form component (Storybook port 6006)
    ├── ui-table/           # VTable dynamic table component (Storybook port 6007)
    ├── ui-collections/     # Collection Form & List (Storybook port 6005)
    ├── types/              # Shared TypeScript types
    ├── services/           # Shared service classes
    ├── hooks/              # Shared React hooks
    └── utils/              # Utility functions (field mapper, etc.)
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Setup

```bash
# Clone both repositories into this workspace
# (or use git submodules)

# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

```bash
# Run Storybook for UI component development
pnpm --filter @buildpad/ui-interfaces storybook

# Build shared packages first
pnpm --filter './packages/**' build
```

## 📦 Shared Packages

### @buildpad/types

Shared TypeScript type definitions following DaaS conventions.

**Key Types:**

- `PrimaryKey`, `AnyItem`, `Filter`, `Query` - Core data types
- `Field`, `FieldMeta`, `Collection`, `CollectionMeta` - Schema types
- `DaaSFile`, `FileUpload`, `Folder` - File system types
- `M2MRelationInfo`, `M2ORelationInfo`, `O2MRelationInfo` - Relation types
- `Permission`, `Accountability` - Access control types

**Usage:**

```tsx
import type { Field, Collection, Query, PrimaryKey } from "@buildpad/types";
import {
  getFileCategory,
  formatFileSize,
  getAssetUrl,
} from "@buildpad/types";
```

### @buildpad/services

Service classes for DaaS API configuration and authentication.

**Available Services:**

- `FieldsService` - Read field definitions
- `CollectionsService` - Read collection metadata
- `PermissionsService` - Field-level permissions

**API Request Utilities:**

- `apiRequest` - Make API requests (supports both proxy and direct DaaS modes)
- `buildApiUrl` - Build URL for API requests respecting DaaS configuration
- `getApiHeaders` - Get headers with auth token when in direct mode

**DaaS Context (for Storybook/Testing):**

- `DaaSProvider` - React provider for direct DaaS API access with authentication state
- `useDaaSContext` - Hook to access DaaS config, user info, and auth helpers
- `setGlobalDaaSConfig` - Set global config for non-React contexts

**Authentication Module (`@buildpad/services/auth`):**

- `configureAuth` / `createAuthenticatedClient` / `getCurrentUser` - Session management
- `enforcePermission` / `getAccessibleFields` / `filterFields` - Permission enforcement
- `applyFilterToQuery` / `resolveFilterDynamicValues` - Filter-to-query conversion
- Cookie-based sessions for browser requests (automatic)
- Static tokens for programmatic access (DaaS-style)
- JWT Bearer tokens for API clients with Supabase Auth

**Usage:**

```tsx
import { FieldsService } from "@buildpad/services";

const fieldsService = new FieldsService();
const fields = await fieldsService.readAll("products");
```

**Direct DaaS Mode (Storybook/Testing):**

```tsx
import { DaaSProvider } from "@buildpad/services";

// Wrap components to enable direct DaaS API access
<DaaSProvider
  config={{
    url: "https://xxx.buildpad-daas.xtremax.com",
    token: "your-token",
  }}
>
  <VForm collection="articles" />
</DaaSProvider>;
```

### @buildpad/hooks

React hooks for managing authentication, permissions, DaaS relationships, selection, presets, and workflows.

**Authentication Hooks (DaaS-compatible):**

- `useAuth` - Authentication state (user, isAdmin, isAuthenticated) and methods (refresh, logout, checkPermission)
- `usePermissions` - Field-level and action-level permission checking (canPerform, getAccessibleFields, isFieldAccessible)
- `useDaaSContext` / `DaaSProvider` - DaaS configuration context for direct API access

**Relation Hooks:**

- `useRelationM2M` / `useRelationM2MItems` - Many-to-Many relationships
- `useRelationM2O` / `useRelationM2OItem` - Many-to-One relationships
- `useRelationO2M` / `useRelationO2MItems` - One-to-Many relationships
- `useRelationM2A` / `useRelationM2AItems` - Many-to-Any (polymorphic) relationships
- `useFiles` - File upload and management

**Selection & Preset Hooks:**

- `useSelection` - Item selection management
- `usePreset` - Collection presets (filters, search, layout)

**Navigation & State Hooks:**

- `useEditsGuard` / `useHasEdits` - Unsaved changes navigation guard
- `useClipboard` - Clipboard operations with notifications
- `useLocalStorage` - Persistent localStorage state

**Workflow & Versioning Hooks:**

- `useVersions` - Content version management (create, save, delete versions)
- `useWorkflowAssignment` - Check if collection has workflow assignment
- `useWorkflowVersioning` - Workflow + versioning integration (edit modes, state tracking)

**Usage:**

```tsx
import { useAuth, usePermissions, useRelationM2M } from "@buildpad/hooks";

// Authentication
function UserProfile() {
  const { user, isAdmin, isAuthenticated, loading } = useAuth();

  if (!isAuthenticated) return <LoginButton />;
  return <div>Welcome, {user.first_name}!</div>;
}

// Permissions
function ArticleEditor({ articleId }) {
  const { canPerform, getAccessibleFields } = usePermissions({
    collections: ["articles"],
  });

  if (!canPerform("articles", "update")) return <Alert>No edit access</Alert>;
  const fields = getAccessibleFields("articles", "update");
  // ...
}

// Relations
function ProductTags({ productId }: { productId: string }) {
  const { relationInfo, loading } = useRelationM2M("products", "tags");
  // Manage M2M relationships...
}
```

### @buildpad/utils

Utility functions for field interface mapping and validation. The field interface mapper is the core logic that VForm uses to determine which UI component to render for each field type.

**Key Functions:**

- `getFieldInterface` - Map field types to UI interface components (40+ types)
- `isFieldReadOnly` - Determine read-only status based on context
- `getFieldValidation` - Extract validation rules from field schema
- `formatFieldValue` - Format values for display
- `isPresentationField` - Check for presentation-only fields (divider, notice)
- `getFieldDisplayName` - Resolve translated display name for a field (locale matching with fallback)
- `formatFieldTitle` - Convert snake_case field names to Title Case

**Usage:**

```tsx
import { getFieldInterface, isFieldReadOnly, getFieldDisplayName } from "@buildpad/utils";

const interfaceConfig = getFieldInterface(field);
// Returns: { type: 'input', props: { type: 'string' } }
// or: { type: 'select-dropdown', props: { choices: [...] } }
// or: { type: 'list-m2m', props: { relationInfo: {...} } }

const readOnly = isFieldReadOnly(field, "edit");
// Returns: true for auto-increment PKs, UUID PKs, etc.

const displayName = getFieldDisplayName(field, 'zh-CN');
// Returns: translated name if meta.translations has a match, else Title Case
```

**CLI Installation:**
When you add components via CLI, the field-interface-mapper is automatically included in `lib/buildpad/` allowing VForm and CollectionForm to correctly render all 40+ interface types.

### @buildpad/ui-interfaces

DaaS-compatible field interface components built with Mantine v8.

**Core Components:**
| Component | Description |
|-----------|-------------|
| `Boolean` | Switch toggle |
| `Toggle` | Enhanced toggle with icons and state labels |
| `DateTime` | Date/time picker |
| `Input` | Single-line text input |
| `Textarea` | Multi-line text input |
| `InputCode` | Monospace code editor with line numbers |

**Selection Components:**
| Component | Description |
|-----------|-------------|
| `SelectDropdown` | Dropdown select with search |
| `SelectRadio` | Radio button selection |
| `SelectMultipleCheckbox` | Checkbox group with "other" option |
| `SelectMultipleCheckboxTree` | Tree-based hierarchical multi-select |
| `SelectMultipleDropdown` | Dropdown-based multi-select with search |
| `SelectIcon` | Icon picker with categorized Tabler icons |
| `Tags` | Tag input with presets and custom tags |
| `AutocompleteAPI` | External API-backed autocomplete |
| `CollectionItemDropdown` | Collection item selector dropdown |

**Layout Components:**
| Component | Description |
|-----------|-----------|
| `Divider` | Horizontal/vertical divider with title support |
| `Notice` | Alert/notice component (info, success, warning, danger) |
| `Slider` | Range slider with numeric type support |
| `GroupDetail` | Collapsible form section |

**Rich Text Components:** _(require additional dependencies)_
| Component | Description |
|-----------|-----------|
| `RichTextHtml` | WYSIWYG HTML editor (requires @tiptap packages) |
| `RichTextMarkdown` | Markdown editor with live preview |
| `InputBlockEditor` | Block-based editor using EditorJS (SSR-safe with dynamic import) |
| `InputCode` | Monospace code editor with syntax highlighting |

**Media Components:**
| Component | Description |
|-----------|-----------|
| `File` | Single file with DaaS Files API integration |
| `FileImage` | Image file picker with preview, lightbox, and crop |
| `Files` | Multiple files interface (M2M relationship with junction table support) |
| `Upload` | Low-level drag-and-drop file upload zone |
| `Color` | Color picker with RGB/HSL support, presets, opacity |
| `Map` | Interactive map placeholder for coordinates |
| `MapWithRealMap` | Full MapLibre GL JS map with drawing tools |

**Relational Components:**
| Component | Description |
|-----------|-----------|
| `ListM2M` | Many-to-Many list with hooks integration |
| `ListM2O` | Many-to-One selector with hooks integration |
| `ListO2M` | One-to-Many list with hooks integration |
| `ListM2A` | Many-to-Any polymorphic list with hooks integration |
| `ListM2MInterface` | Many-to-Many (render-prop variant) |
| `ListM2OInterface` | Many-to-One (render-prop variant) |
| `ListO2MInterface` | One-to-Many (render-prop variant) |

**Workflow Components:**
| Component | Description |
|-----------|-------------|
| `WorkflowButton` | Workflow state button with transitions, policy-based commands, and revision comparison |

**Usage:**

```tsx
import {
  Boolean, DateTime, SelectDropdown, Color, Notice, Tags, WorkflowButton
} from '@buildpad/ui-interfaces';

// Basic components
<DateTime value={date} onChange={setDate} type="datetime" label="Pick a date" />
<Color value={color} onChange={setColor} label="Brand Color" opacity />
<Notice type="success" title="Saved">Your changes have been saved.</Notice>
<Tags value={tags} onChange={setTags} presets={['React', 'Vue', 'Angular']} />

// Workflow state management
<WorkflowButton
  itemId="article-123"
  collection="articles"
  canCompare={true}
  onChange={(value) => console.log('New state:', value)}
  onTransition={() => console.log('Transition complete')}
/>
```

### @buildpad/ui-form

Dynamic form component system inspired by DaaS v-form, with comprehensive Storybook documentation and built-in permission enforcement.

**Components:**
| Component | Description |
|-----------|-------------|
| `VForm` | Main dynamic form component that renders fields based on collection schema |
| `FormField` | Individual field wrapper with label, validation, and interface rendering |
| `FormFieldLabel` | Label component with required indicator and tooltip |
| `FormFieldInterface` | Dynamic interface component loader |

**Features:**

- 🎯 Dynamic field rendering based on schema
- 📝 40+ interface types (input, textarea, boolean, datetime, select, etc.)
- 🔐 **Permission enforcement** - Filter fields based on user permissions (DaaS-compatible)
- ✅ Validation error display with field-level messages
- 📱 Responsive grid layout (full, half, fill widths)
- 🔄 Change tracking and dirty state management
- 📊 Field groups and hierarchical organization
- 🎭 Create vs Edit mode with proper state handling
- 🔒 Read-only and disabled field support

**Storybook Stories:**

- **Basic Stories** (`VForm.stories.tsx`) - Mocked data examples covering all interface types, layouts, validation, and states
- **DaaS Playground** (`VForm.daas.stories.tsx`) - Connect to a real DaaS instance and test with actual collection schemas

**Usage:**

```tsx
import { VForm } from "@buildpad/ui-form";
import { DaaSProvider } from "@buildpad/services";

// Basic usage
function MyForm() {
  const [values, setValues] = useState({});

  return (
    <VForm
      collection="articles"
      modelValue={values}
      onUpdate={setValues}
      validationErrors={errors}
      primaryKey="+" // '+' for create mode
    />
  );
}

// With permission enforcement
function ProtectedForm() {
  return (
    <DaaSProvider
      config={{ url: "https://xxx.buildpad-daas.xtremax.com", token: "xxx" }}
    >
      <VForm
        collection="articles"
        modelValue={values}
        onUpdate={setValues}
        enforcePermissions={true}
        action="update" // 'create' | 'update' | 'read'
        onPermissionsLoaded={(fields) => console.log("Accessible:", fields)}
      />
    </DaaSProvider>
  );
}
```

**Testing:**

```bash
# Run Storybook for VForm development
pnpm storybook:form

# Run isolated component tests
pnpm test:storybook

# Run DaaS integration tests
pnpm test:e2e
```

### @buildpad/ui-collections

Dynamic collection components for forms, tables, navigation, and layouts. Inspired by DaaS's content module.

**Components:**
| Component | Description |
|-----------|-------------|
| `CollectionForm` | CRUD form wrapper with data fetching - uses VForm for rendering all 40+ interface types |
| `CollectionList` | Dynamic table with pagination, search, selection, bulk actions |
| `ContentLayout` | Shell layout with sidebar navigation and main content area |
| `ContentNavigation` | Hierarchical sidebar navigation for collections with search and bookmarks |
| `FilterPanel` | Field-type-aware filter builder for collection queries |
| `SaveOptions` | Dropdown menu with save actions (save & stay, save & add new, etc.) |

**Architecture:**

- **CollectionForm** = Data layer (fetch fields, load/save items, CRUD operations)
- **VForm** = Presentation layer (renders fields with proper interfaces from @buildpad/ui-interfaces)
- **ContentLayout** + **ContentNavigation** = Complete content module shell (like DaaS)
- **FilterPanel** = Visual filter builder producing DaaS-compatible filter objects

When you install `collection-form` via CLI, VForm and all 32 dependent interface components are automatically included.

**Storybook:**

```bash
pnpm storybook:collections  # Port 6005
```

**Usage:**

```tsx
import {
  CollectionForm,
  CollectionList,
  ContentLayout,
  ContentNavigation,
  FilterPanel,
  SaveOptions
} from '@buildpad/ui-collections';

// Complete content module
<ContentLayout
  title="Products"
  navigation={<ContentNavigation collections={collections} onNavigate={setCollection} />}
>
  <CollectionList collection="products" filter={filter} />
</ContentLayout>

// Form with save options
<CollectionForm collection="products" id={id} />
<SaveOptions onSaveAndStay={handleSave} onSaveAndAddNew={handleSaveAndNew} />

// Filter builder
<FilterPanel fields={fields} value={filter} onChange={setFilter} />
```

### @buildpad/ui-table

Dynamic table component inspired by DaaS v-table, built with Mantine v8 and @dnd-kit.

**Components:**
| Component | Description |
|-----------|-------------|
| `VTable` | Main dynamic table component |
| `TableHeader` | Header row with sorting, resize handles, select all |
| `TableRow` | Data row with selection, drag handle, custom cells |

**Features:**

- 📊 Column sorting (ascending/descending toggle)
- ↔️ Column resizing via drag handles
- ✅ Row selection (single/radio or multiple/checkbox)
- 🔀 Manual row sorting via drag-and-drop (@dnd-kit)
- ⏳ Loading/empty states with skeletons
- 📌 Fixed/sticky header option
- 🎨 Inline (bordered) styling option
- 🎯 Custom cell rendering
- 🔧 Row actions slot
- ⌨️ Keyboard navigation for clickable rows
- 🌙 Dark mode support

**Usage:**

```tsx
import { VTable } from "@buildpad/ui-table";

<VTable
  headers={[
    { text: "Name", value: "name", sortable: true, width: 200 },
    { text: "Email", value: "email", sortable: true, width: 250 },
    { text: "Status", value: "status", sortable: true, width: 100 },
  ]}
  items={users}
  itemKey="id"
  showSelect="multiple"
  showResize
  sort={{ by: "name", desc: false }}
  onSortChange={setSort}
  onUpdate={setSelectedUsers}
/>;
```

**Storybook Stories:**

- **Basic Stories** (`VTable.stories.tsx`) - Mocked data examples covering all features (sorting, selection, resizing, drag-and-drop, etc.)
- **DaaS Playground** (`VTable.daas.stories.tsx`) - Connect to a real DaaS instance and test with actual collection data

**Testing:**

```bash
# Run Storybook for VTable development
pnpm storybook:table

# Run Playwright tests against VTable Storybook
SKIP_WEBSERVER=true STORYBOOK_TABLE_URL=http://localhost:6007 \
  npx playwright test tests/ui-table --project=storybook-table
```

## 🤖 Distribution & AI Tools

Buildpad includes two powerful distribution tools:

### MCP Server - For AI Agents

Expose Buildpad components to AI assistants like VS Code Copilot.

The MCP server is published on npm as [`@buildpad/mcp`](https://www.npmjs.com/package/@buildpad/mcp).

```json
// Add to VS Code settings.json or .vscode/mcp.json:
{
  "mcp": {
    "servers": {
      "buildpad": {
        "command": "npx",
        "args": ["@buildpad/mcp@latest"]
      }
    }
  }
}
```

```bash
# Use with Copilot:
# "Show me how to use the Input component from Buildpad"
# "Generate a CollectionForm for products"
# "Get RBAC pattern for own_items on articles collection"
```

**Available MCP Tools:**

- `list_components` - Discover all components by category
- `get_component` - Read source code and metadata
- `list_packages` - List all available packages with exports
- `get_install_command` - Get CLI install commands
- `get_copy_own_info` - Explain the Copy & Own distribution model
- `copy_component` - Get full source for manual copy
- `generate_form` / `generate_interface` - Code generation
- `get_usage_example` - Usage examples with local imports
- `get_rbac_pattern` - Generate RBAC setup sequences (own_items, role_hierarchy, public_read, multi_tenant, full_crud, read_only)

### CLI Tool - For Developers

Copy components directly to your project (like shadcn/ui).

The CLI is published on npm as [`@buildpad/cli`](https://www.npmjs.com/package/@buildpad/cli).

```bash
# Use in any project (no local build needed)
npx @buildpad/cli@latest init
npx @buildpad/cli@latest add input select-dropdown
npx @buildpad/cli@latest list
npx @buildpad/cli@latest add --category selection
npx @buildpad/cli@latest add --all

# Bootstrap entire project in one command (recommended for AI agents)
npx @buildpad/cli@latest bootstrap

# Check for component updates
npx @buildpad/cli@latest outdated

# Upgrade installed components with safe merge
npx @buildpad/cli@latest upgrade --all

# View changelogs
npx @buildpad/cli@latest changelog @buildpad/ui-interfaces
```

**What `bootstrap` does:**

1. Creates `buildpad.json` and project skeleton
2. Copies all 40+ UI components to `components/ui/`
3. Copies types, services, hooks to `lib/buildpad/`
4. Copies API proxy routes (fields, items, relations, files)
5. Copies auth proxy routes (login, logout, user, callback) + login page
6. Copies Supabase auth utilities and middleware
7. Runs `pnpm install` to resolve all dependencies
8. Validates the installation

**Benefits:**

- ✅ Source code remains private
- ✅ AI agents can discover and use components
- ✅ Developers get full control over copied code
- ✅ Published on npm (`@buildpad/cli`, `@buildpad/mcp`)

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup guide.

## 🔄 Versioning & Updates

Buildpad uses a **per-file checksum** system so updates only touch files you haven't customized:

| Command | Description |
|---------|-------------|
| `buildpad outdated` | Check which installed components have newer versions |
| `buildpad upgrade` | Upgrade components — silent overwrite for pristine files, interactive prompt for modified files |
| `buildpad upgrade --three-way` | 3-way merge (diff3) for conflict resolution on modified files |
| `buildpad upgrade --force` | Re-sync components even when already at the latest version (honours `--strategy`) |
| `buildpad changelog <pkg>` | View changelog slices between installed and latest versions |
| `buildpad migrate` | Migrate `buildpad.json` from schema v1 to v2 (enables per-file update tracking) |

**How it works:** Each component file copied to your project has an SHA256 checksum recorded in `buildpad.json`. On upgrade, pristine files (disk matches recorded hash) are silently overwritten. Customized files trigger an interactive prompt with skip/overwrite/.new/three-way merge options. Components carry per-package semver (e.g. `@buildpad/ui-interfaces@1.4.2`), so `outdated` only flags files from packages that actually changed. See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the versioning and release workflow.

## 🔧 Workspace Commands

| Command                      | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `pnpm install`               | Install all dependencies                         |
| `pnpm build`                 | Build all packages and apps                      |
| `pnpm build:mcp`             | Build MCP server for AI agents                   |
| `pnpm build:cli`             | Build CLI tool                                   |
| `pnpm dev`                   | Run all apps in dev mode                         |
| `pnpm mcp:dev`               | Run MCP server in watch mode                     |
| `pnpm cli`                   | Run CLI tool locally                             |
| `pnpm cli validate`          | Validate Buildpad installation in a project    |
| `pnpm cli upgrade`           | Upgrade installed components in a test project   |
| `pnpm cli changelog`         | View changelog for a package                      |
| `pnpm cli migrate`           | Migrate buildpad.json from v1 to v2 schema        |
| `pnpm storybook:interfaces`             | Run Storybook for ui-interfaces (port 6005)      |
| `pnpm storybook:form`        | Run VForm Storybook (port 6006)                  |
| `pnpm storybook:table`       | Run VTable Storybook (port 6007)                 |
| `pnpm storybook:collections` | Run Collections Storybook (port 6005)            |
| `pnpm build:storybook`       | Build all 4 Storybooks to host app's public dir  |
| `pnpm dev:host`              | Start Storybook host app in dev mode (port 3000) |
| `pnpm build:host`            | Build the Storybook host app for production      |
| `pnpm start:host`            | Start production Storybook host app              |
| `pnpm lint`                  | Lint all projects                                |
| `pnpm clean`                 | Remove node_modules and build artifacts          |
| `pnpm test:e2e`              | Run Playwright E2E tests against DaaS            |
| `pnpm test:storybook`        | Run Playwright tests against VForm Storybook     |
| `pnpm test:storybook:table`  | Run Playwright tests against VTable Storybook    |

## 📋 Storybook

All Storybooks use **Storybook 10** with `@storybook/nextjs-vite`.

```bash
# Run individual Storybooks
pnpm storybook:interfaces     # ui-interfaces (port 6005)
pnpm storybook:form           # VForm (port 6006)
pnpm storybook:table          # VTable (port 6007)
pnpm storybook:collections    # Collections (port 6005)

# Build all Storybooks for hosting
pnpm build:storybook
```

### DaaS Playground (Live API Testing)

The DaaS Playground uses a **Next.js host app** (`apps/storybook-host`) as an authentication proxy, avoiding CORS issues:

```bash
# Terminal 1: Start the host app (DaaS auth proxy)
pnpm dev:host

# Terminal 2: Start Storybook
pnpm storybook:form
```

1. Open `http://localhost:3000` and connect with your DaaS URL + static token
2. Navigate to DaaS Playground stories in any Storybook (VForm, VTable, CollectionForm, CollectionList)
3. Select a collection and test with real fields and data

Credentials are stored in an AES-256-GCM encrypted httpOnly cookie. All `/api/*` requests from Storybook are proxied through the host app.

## 🧪 Testing

Buildpad uses a **two-tier testing strategy** for comprehensive validation:

### Tier 1: Storybook Tests (Isolated Component Testing)

```bash
# Start VForm Storybook and run Playwright tests
pnpm storybook:form          # Start Storybook on port 6006
pnpm test:storybook          # Run Playwright against Storybook
```

**Advantages:**

- ✅ **No Authentication Required** - Test components with mocked data
- ✅ **Fast Feedback** - Isolated component testing without backend dependencies
- ✅ **All Interface Types** - Test any field configuration without database setup
- ✅ **DaaS Playground** - Connect to real DaaS API and test with actual schemas

**Test Files:**

- `tests/ui-form/vform-storybook.spec.ts` - VForm tests against Storybook stories
- `tests/ui-table/vtable-storybook.spec.ts` - VTable tests against Storybook stories (22 tests)
- `packages/ui-form/src/VForm.stories.tsx` - VForm basic stories with mocked data
- `packages/ui-form/src/VForm.daas.stories.tsx` - VForm DaaS playground for real API testing
- `packages/ui-table/src/VTable.stories.tsx` - VTable basic stories with mocked data
- `packages/ui-table/src/VTable.daas.stories.tsx` - VTable DaaS playground for real API testing

### Tier 2: DaaS E2E Tests (Full Integration Testing)

```bash
# Run against hosted DaaS (requires auth)
pnpm test:e2e                # Run all E2E tests
pnpm test:e2e:ui             # Interactive Playwright UI
```

**Advantages:**

- ✅ **Real API** - Actual Supabase backend integration
- ✅ **Authentication** - Test with real users and roles
- ✅ **Permissions** - Verify field-level access control
- ✅ **Full Workflow** - End-to-end form submission and validation

**Test Files:**

- `tests/ui-form/vform-daas.spec.ts` - Integration tests with DaaS app
- `tests/ui-form/vform.spec.ts` - Complete E2E workflow tests
- `tests/auth.setup.ts` - Authentication setup for admin user
- `tests/helpers/seed-test-data.ts` - Test data seeding utilities

**Playwright Configuration:**

- `playwright.config.ts` - Dual-mode setup (Storybook + DaaS)
- Auto-starts Storybook for component tests
- Uses admin authentication for DaaS E2E tests

See [docs/TESTING.md](docs/TESTING.md) for complete testing guide and best practices.

## Adding New Shared Components

1. Add component to `packages/ui-interfaces/src/<component-name>/`
2. Export from `packages/ui-interfaces/src/index.ts`
3. Update `packages/ui-interfaces/package.json` exports if needed
4. Run `pnpm install` to update workspace links

## 🔄 Dependency Management

- Shared dependencies go in the relevant package's `package.json`
- Use `workspace:*` protocol for internal packages
- Peer dependencies for Mantine, React in shared packages

## RAD Platform Integration

Buildpad integrates with the **buildpad-copilot** RAD (Rapid Application Development) platform for AI-assisted development.

### Setup with buildpad-copilot

```bash
# Clone the RAD platform boilerplate
git clone https://github.com/your-org/buildpad-copilot.git my-new-app
cd my-new-app

# The .vscode/mcp.json is pre-configured for Buildpad MCP server
# Just update the path to your buildpad-ui installation
```

### What buildpad-copilot provides:

- **Custom Agents**: `@architect`, `@planner`, `@scaffold`, `@implement`, `@reviewer`, `@tester`, `@database`
- **Prompt Templates**: `/create-project`, `/create-feature`, `/add-buildpad`, etc.
- **Project Templates**: minimal, standard, enterprise
- **VS Code Configuration**: MCP servers, settings, launch configs

See [buildpad-copilot](https://github.com/your-org/buildpad-copilot) for full documentation.

## 🎯 Architecture (DaaS-Inspired)

This workspace follows patterns from [DaaS](https://daas.io/):

| DaaS Package        | Buildpad Equivalent        | Purpose                        |
| ------------------- | ---------------------------- | ------------------------------ |
| `@daas/types`       | `@buildpad/types`          | Shared TypeScript types        |
| `@daas/composables` | `@buildpad/hooks`          | Reusable React hooks           |
| `@daas/utils`       | `@buildpad/services`       | Utility services               |
| Vue interfaces      | `@buildpad/ui-interfaces`  | Field interface components     |
| `v-form` component  | `@buildpad/ui-form`        | Dynamic form component (VForm) |
| Collection views    | `@buildpad/ui-collections` | Dynamic form/list components   |

**Key Principles:**

1. **Copy & Own** - Components are copied to projects as source files
2. **Separation of concerns** - Types, services, hooks, and UI in separate packages
3. **Internal workspace** - Packages use `workspace:*` for cross-package dependencies
4. **Peer dependencies** - React/Mantine as peer deps in shared packages
5. **API abstraction** - Services abstract API calls for portability

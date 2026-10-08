# @buildpad/mcp

Model Context Protocol (MCP) server for Buildpad components. Enables AI agents like VS Code Copilot to discover, understand, and generate code using the **Copy & Own** distribution model.

[![npm version](https://img.shields.io/npm/v/@buildpad/mcp)](https://www.npmjs.com/package/@buildpad/mcp)

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard that enables AI assistants to securely access external data sources and tools. This MCP server exposes the Buildpad component library to AI agents.

## Copy & Own Model

Buildpad uses the **Copy & Own** distribution model (similar to shadcn/ui):

- ✅ Components are copied as source code to your project
- ✅ Full customization - components become your application code
- ✅ No external package dependencies for component code
- ✅ No breaking changes from upstream updates
- ✅ Works offline after installation

## Features

- 📦 **Component Discovery** - List all available Buildpad components
- 📖 **Source Code Access** - Read component and lib-module source code. The sources ship inside the package, so this works offline
- 🛠️ **Code Generation** - Generate components, forms, and interfaces
- 🔧 **CLI Integration** - Get CLI commands to install components
- ⬆️ **Upgrades** - Find outdated components and lib modules in a project, plan the upgrade, and run it with the matching CLI
- 📚 **Usage Examples** - Get real-world usage examples with local imports

## Where the sources come from

Each release of `@buildpad/mcp` contains two things from the same commit:

- the component registry (`registry.json`), embedded in `dist/index.js`
- every source file that registry lists, in `dist/sources/<source path>`

The build checks each bundled file against the registry's `sourceSha256` and fails on a mismatch. So `get_component`, `copy_component` and `resources/read` return the exact bytes of that release, with no network access.

If you run the server from a monorepo checkout (`packages/mcp-server/dist`), it reads `packages/` directly instead. It never reads other packages under `node_modules/@buildpad`.

If a file cannot be read, the tool returns `isError: true` with a `missingSources` list. `resources/read` returns an MCP error with `missingSources` in its `data`. A tool never returns an empty file list or placeholder text in place of the source.

Sources are returned as published. They import `@buildpad/*` packages, which are not on npm. `npx @buildpad/cli add <name>` rewrites those imports to your project's paths. If you copy the files by hand, you must rewrite the imports yourself.

## Installation

### For VS Code Copilot (Recommended — via npx)

The MCP server is published on npm. No local build required.

Add to your VS Code `settings.json` or `.vscode/mcp.json`:

```json
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

Reload VS Code window.

### For VS Code Copilot (Local build)

For development within the monorepo:

1. Build the MCP server:

```bash
pnpm build:mcp
```

2. Add to your VS Code `settings.json` or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "buildpad": {
        "command": "node",
        "args": [
          "/absolute/path/to/buildpad-ui/packages/mcp-server/dist/index.js"
        ]
      }
    }
  }
}
```

3. Reload VS Code window

### For Other AI Agents

Use any MCP-compatible client:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/buildpad-ui/packages/mcp-server/dist/index.js"],
});

const client = new Client({
  name: "my-app",
  version: "1.0.0",
}, {
  capabilities: {},
});

await client.connect(transport);
```

## Available Resources

### Packages

- `buildpad://packages/@buildpad/types` - TypeScript type definitions
- `buildpad://packages/@buildpad/services` - CRUD service classes
- `buildpad://packages/@buildpad/hooks` - React hooks for relations
- `buildpad://packages/@buildpad/ui-interfaces` - Field interface components
- `buildpad://packages/@buildpad/ui-collections` - Dynamic collection components

### Components

Each resource returns the primary (first) source file of a component. A lib-module name (for example `buildpad://components/utils`) also works.

- `buildpad://components/input` - Text input component
- `buildpad://components/select-dropdown` - Dropdown select
- `buildpad://components/datetime` - Date/time picker
- `buildpad://components/file-image` - Image upload
- `buildpad://components/collection-form` - Dynamic form
- ... and many more (component titles such as `Input` also match)

## Available Tools

### `list_components`

List all available components with descriptions and categories.

### `get_component`

Get detailed information and source code for a specific component or lib module. `source` is the primary file, and `allSources` maps each target path to its content.

```json
{
  "name": "Input"
}
```

### `list_packages`

List all Buildpad packages with their exports.

### `get_install_command`

Get the CLI command to install components. Essential for AI agents to help users add components.

```json
{
  "components": ["input", "select-dropdown", "datetime"]
}
```

Or install by category:

```json
{
  "category": "selection"
}
```

### `get_copy_own_info`

Get detailed information about the Copy & Own distribution model.

### `copy_component`

Get complete source code and file structure to manually copy a component into your project (shadcn-style). Returns the full implementation code, target paths, and required dependencies.

```json
{
  "name": "datetime",
  "includeLib": true
}
```

Returns:
- Full component source code
- Target file paths
- Required lib modules (types, services, hooks, utils, ...), including the lib modules those depend on
- Peer dependencies to install, and the other components it uses (`registryDependencies`)
- Copy instructions

The CLI (`npx @buildpad/cli add datetime`) is the recommended way to install: it also rewrites the `@buildpad/*` imports and records the files for later upgrades.

### `generate_form`

Generate a CollectionForm component with specified configuration.

```json
{
  "collection": "products",
  "fields": ["title", "description", "price"],
  "mode": "create"
}
```

### `generate_interface`

Generate a field interface component.

```json
{
  "type": "input",
  "field": "title",
  "props": {
    "placeholder": "Enter title",
    "required": true
  }
}
```

### `get_usage_example`

Get real-world usage examples for a component (with local imports).

```json
{
  "component": "SelectDropdown"
}
```

### `get_rbac_pattern`

Get RBAC (Role-Based Access Control) setup patterns for DaaS applications. Returns step-by-step MCP tool call sequences to set up roles, policies, access, and permissions.

```json
{
  "pattern": "own_items",
  "collections": ["articles", "categories"],
  "roleName": "Editor"
}
```

**Available patterns:**
| Pattern | Description |
|---------|-------------|
| `own_items` | Users manage their own records, read others' published items |
| `role_hierarchy` | Admin > Editor > Viewer cascading permissions |
| `public_read` | Public read + authenticated write |
| `multi_tenant` | Organization-level data isolation |
| `full_crud` | Unrestricted CRUD access |
| `read_only` | Read-only access |

**Dynamic variables supported:** `$CURRENT_USER`, `$CURRENT_USER.<field>`, `$CURRENT_ROLE`, `$CURRENT_ROLES`, `$CURRENT_POLICIES`, `$NOW`

Covers collection CRUD only. Every response also carries a `moduleAccess` reminder pointing at the tool below.

### `get_module_access_pattern`

Get the **Module-Level Access** setup sequence — application capability flags that are *not* tied to a collection.

DaaS has two independent permission dimensions:

| Dimension | Stored on | Controls |
|---|---|---|
| Record-Level Access | `daas_permissions` rows | Which collections a user can CRUD, with which fields and filters |
| Module-Level Access | `daas_policies.module_access` (JSONB) | Whether a user holds a named application capability |

Use this for any gate collection permissions cannot express: showing a button, page, section, or nav item to some users, or restricting a workflow transition. **Never gate on role names** (`user.role === 'manager'`) — this is the sanctioned mechanism.

```json
{
  "keys": [{ "key": "reports:export", "display_name": "Export Reports" }],
  "folder": "Reporting",
  "policyName": "Manager Policy"
}
```

Returns the `module_access_keys` + `policies` tool calls to register and grant the keys, plus three guard patterns:

| Guard | Where | What |
|---|---|---|
| Client | React component | `usePermissions().hasModuleAccess('reports:export')` — UX only; **fails closed** while loading |
| Server | API route | `enforceModuleAccess('reports:export')` → `ModuleAccessError(403)` — the security boundary |
| Workflow | Command JSON | `module_access_keys: ["reports:export"]`, OR'd with `policies` |

**Key rules:** format `^[a-z][a-z0-9_:./-]*$`, globally unique, convention `<domain>:<capability>`. The `system:` and `workflow:` namespaces are reserved by the platform. Keys are OR-merged across every policy a user holds; admins hold every key. Resolution respects the active scope (Resource URI).

Registry management UI ships in the `users-management` component (`ModuleAccessKeysManager`, mounted at `/module-access-keys`); per-policy granting is the "Module-Level Access" tab of `PolicyDetail`.

### `list_outdated`

List the installed components **and lib modules** (utils, services, hooks, ...) whose upstream source changed. The tool reads the project's `buildpad.json` and compares each recorded `sourceSha256` with this server's registry. Each entry includes `kind` (`component` or `lib`), `staleFiles`, `installedRelease`, and `latestRelease` (the release this server ships). Entries that were installed from a newer release than this server are flagged `aheadOfRegistry`.

```json
{
  "projectPath": "/absolute/path/to/your-project"
}
```

### `get_upgrade_plan`

A read-only dry run. For each installed component and lib module, it shows the stale files and the status of each file on disk:

- `pristine`: the file matches the hash recorded at install.
- `modified`: the file has local edits.
- `missing`: the file is not on disk.
- `untracked`: the file is on disk, but `buildpad.json` has no install hash for it. The CLI overwrites such files whatever the strategy.
- `invalid-target`: the recorded target is outside the project root, or the path is not a regular file (for example, a directory). The tool does not read it.

Files are looked up where the CLI writes them: under `src/` when `srcDir` is set, and component `.ts` files as `.tsx`. The plan also gives a `recommendedAction`: `up-to-date`, `safe-overwrite`, `prompt-or-three-way`, `overwrite-untracked` (back up local edits first), `review-invalid-targets` (correct `buildpad.json` or the file first) or `update-mcp`. If you name an entry, the plan also includes the outdated components and lib modules it depends on. Each entry lists them (`staleLibDependencies`, `staleComponentDependencies`) and the dependencies the project does not have (`missingDependencies`), which `apply_upgrade` installs.

### `apply_upgrade`

⚠️ Writes to the project. This tool runs `npx --yes @buildpad/cli@<this server's version> upgrade --cwd <projectPath> --strategy <strategy> -- <names>`. The CLI is pinned to the server's own version, so it applies the same registry that `get_upgrade_plan` reported.

```json
{
  "projectPath": "/absolute/path/to/your-project",
  "components": ["input"],
  "strategy": "three-way"
}
```

- Omit `components` to upgrade everything installed (`--all`). This is the safest choice.
- If you name entries, what they depend on comes along: outdated components and lib modules are upgraded and missing ones are installed, because the upgraded code imports them. The tool names every one of them on the command line and passes `--no-deps`, so the CLI touches exactly the entries the tool checked. The result lists them as `libDependencies`, `componentDependencies` and `missingDependencies`. To upgrade only the named entries, set `includeDependencies: false` (the project may then not compile). `includeLibDependencies` is the earlier name of this option and is still accepted.
- `projectPath` must be an absolute path. Relative paths are rejected.
- `strategy` must be `overwrite`, `new-file` (the default) or `three-way`. The CLI's interactive `prompt` strategy cannot be answered through MCP.
- Names must be registry names: lowercase letters, digits and dashes, not starting with a dash. They are passed after `--`, with no shell.
- The tool refuses to run if the project, a named entry or a lib module it would add was installed from a newer release than this server, because that would downgrade it. Update the server instead (`npx -y @buildpad/mcp@latest`). If only an added dependency is newer, you can also set `includeDependencies: false`.
- If the CLI cannot start, exits with a non-zero code or times out (120 s), the result has `isError: true`. The JSON body still gives `success: false`, `exitCode`, `stdout` and `stderr`.

## Usage with Copilot

Once configured, you can ask Copilot:

- "How do I install Buildpad components?" (uses `get_copy_own_info`)
- "Add the Input and SelectDropdown components to my project" (uses `get_install_command`)
- "Show me how to use the Input component" (uses `get_usage_example`)
- "Generate a form for a products collection" (uses `generate_form`)
- "List all available selection components" (uses `list_components`)
- "Show me the source code for CollectionForm" (uses `get_component`)
- "Set up RBAC with own_items pattern for articles" (uses `get_rbac_pattern`)
- "Generate role hierarchy for Admin, Editor, Viewer" (uses `get_rbac_pattern`)

The AI agent will provide CLI commands that you can run to install components.

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Tests
pnpm test

# After a build: pack the package, install it in a temp project and check
# that the source tools return the registry's bytes over stdio
pnpm smoke:pack
```

## Architecture

```
┌─────────────────────────────────────────┐
│      AI Agent (VS Code Copilot, etc.)   │
└────────────────┬────────────────────────┘
                 │ MCP Protocol
┌────────────────▼────────────────────────┐
│       @buildpad/mcp                   │
│  ┌──────────────────────────────────┐   │
│  │  Resource Handlers               │   │
│  │  - List components               │   │
│  │  - Read component source         │   │
│  │  - Get documentation             │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Tool Handlers                   │   │
│  │  - get_install_command           │   │
│  │  - get_copy_own_info             │   │
│  │  - generate_form                 │   │
│  │  - generate_interface            │   │
│  │  - get_usage_example             │   │
│  │  - get_rbac_pattern              │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Component Registry (embedded)   │   │
│  │  - Metadata & Categories         │   │
│  │  - Dependencies                  │   │
│  │  - File mappings                 │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  dist/sources (bundled)          │   │
│  │  - Every registry source file    │   │
│  │  - sha256-checked at build time  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         @buildpad/cli (npm)           │
│  npx @buildpad/cli@latest add <comp>  │
│  - Fetches source from GitHub CDN       │
│  - Transforms imports                   │
│  - Resolves dependencies                │
│  - Copies to user project               │
└─────────────────────────────────────────┘
```

## License

MIT

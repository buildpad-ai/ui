# Quick Start: Using MCP Server & CLI

This guide will help you set up and use the Buildpad UI Packages distribution tools.

## 🤖 Setup MCP Server for VS Code Copilot

### Option A: Use via npx (Recommended)

The MCP server is published on npm as `@buildpad/mcp`. No local build required.

1. **Open VS Code Settings:**

   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Preferences: Open User Settings (JSON)"

2. **Add MCP server configuration:**

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

3. **Reload VS Code** (`Cmd+Shift+P` → "Developer: Reload Window")

### Option B: Use from local build (Development)

For development or when working within the monorepo:

```bash
cd /path/to/buildpad-ui
pnpm build:mcp
```

Then configure VS Code:

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

**Important:** Replace `/absolute/path/to/buildpad-ui` with the actual absolute path to your Buildpad directory.

Reload VS Code for the changes to take effect (`Cmd+Shift+P` → "Developer: Reload Window").

### Step 4: Test with Copilot

Ask Copilot:

- "List all Buildpad components"
- "Show me how to use the Input component from Buildpad"
- "Generate a CollectionForm for a products collection"
- "Create a form with Input, SelectDropdown, and DateTime fields"

## 🛠️ Setup CLI Tool

### Option 1: Use via npx (Recommended)

The CLI is published on npm as `@buildpad/cli`. No local build required.

```bash
# Initialize in your project
npx @buildpad/cli@latest init

# Add components
npx @buildpad/cli@latest add input select-dropdown

# List available components
npx @buildpad/cli@latest list

# Bootstrap everything at once
npx @buildpad/cli@latest bootstrap

# Show component details
npx @buildpad/cli@latest info vform

# Dependency tree visualization
npx @buildpad/cli@latest tree collection-form

# Check for updates
npx @buildpad/cli@latest outdated

# Upgrade components (safe per-file checksums)
npx @buildpad/cli@latest upgrade --all

# 3-way merge for customized files
npx @buildpad/cli@latest upgrade --three-way

# View changelogs
npx @buildpad/cli@latest changelog @buildpad/ui-interfaces
```

### Option 2: Use from Workspace (Development)

```bash
cd /path/to/buildpad-ui
pnpm build:cli

# Create an alias for convenience
alias buildpad='node /path/to/buildpad-ui/packages/cli/dist/index.js'

# Or use the pnpm script
pnpm cli list
pnpm cli init
```

### Option 3: Install Globally

```bash
cd /path/to/buildpad-ui/packages/cli
pnpm build
pnpm install -g .

# Now you can use it anywhere
buildpad --help
```

## 📝 Using the CLI

### Initialize a Project

```bash
cd your-nextjs-app
buildpad init
```

This will:
- Create `buildpad.json` config
- Set up component directory structure
- Check for required dependencies

### Bootstrap a Project (Recommended for AI Agents)

The `bootstrap` command combines init + add --all + install deps + validate into a single non-interactive command.

```bash
# Full project setup in one command
buildpad bootstrap --cwd /path/to/project

# Skip dependency installation
buildpad bootstrap --skip-deps --cwd /path/to/project

# Skip validation step
buildpad bootstrap --skip-validate --cwd /path/to/project
```

**What bootstrap installs:**
- `buildpad.json` configuration + Next.js skeleton
- 40+ UI components in `components/ui/`
- Types, services, hooks in `lib/buildpad/`
- API proxy routes (fields, items, relations, files)
- Auth proxy routes (login, logout, user, OAuth callback) + login page
- Supabase auth utilities and middleware
- npm dependencies via `pnpm install`

**Auth Routes Installed:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Login via Supabase Auth (server-side, no CORS) |
| `/api/auth/logout` | POST | Sign out and clear session cookies |
| `/api/auth/user` | GET | Get current user profile |
| `/api/auth/callback` | GET | Handle OAuth/email-confirm redirects |
| `/app/login/page.tsx` | — | Login page using proxy pattern |

**Key advantage:** Bootstrap works in non-empty directories and requires no user interaction.

### Add Components

```bash
# Add single component
buildpad add input

# Add multiple components
buildpad add input select-dropdown datetime

# Add collection-form (includes VForm + all 32 interface components)
buildpad add collection-form

# Add all components from a category
buildpad add --category selection

# Interactive selection
buildpad add
```

**Note:** When you add `collection-form`, it automatically includes:
- **VForm** - Dynamic form component that renders any field type
- **32 interface components** - All field types (input, select, datetime, M2M, M2O, etc.)
- **Lib modules** - types, services, hooks, and field-interface-mapper utilities

### List Available Components

```bash
# List all
buildpad list

# Filter by category
buildpad list --category input

# JSON output
buildpad list --json
```

### View Component Details

```bash
# Detailed info about a component
buildpad info vform
buildpad info input

# JSON output
buildpad info vform --json
```

### Show Dependency Tree

```bash
# Visualize dependency tree
buildpad tree collection-form
buildpad tree vform
```

### Preview Changes Before Adding

```bash
# Diff between registry and local version
buildpad diff input
```

### Check Installed Components

```bash
# View installed components and their origins
buildpad status

# JSON output for scripting
buildpad status --json
```

The status command shows:
- Which components are installed
- Their versions and installation dates
- Origin tracking for updates

### Validate Installation

```bash
# Check for common issues
buildpad validate

# JSON output for CI/CD
buildpad validate --json

# Run in specific directory
buildpad validate --cwd /path/to/project
```

The validate command checks for:
- **Untransformed imports** - `@buildpad/*` imports that weren't converted
- **Missing lib files** - Required utility modules not installed
- **Missing CSS files** - CSS required by rich text/block editors
- **SSR issues** - Components exported without SSR-safe wrappers
- **Missing API routes** - DaaS integration routes not created

### Auto-Fix Issues

```bash
# Auto-fix common issues found by validate
buildpad fix
```

The fix command auto-repairs:
- Untransformed `@buildpad/*` imports
- Broken relative imports
- Missing CSS files
- SSR-unsafe exports
- Duplicate exports

### Check for Component Updates

```bash
# Check which installed components have newer versions
buildpad outdated
```

### Upgrade Components (Safe Per-File Checksums)

Buildpad tracks checksums of every copied file. Upgrades silently overwrite files you haven't modified and prompt when you have:

```bash
# Upgrade all outdated components
buildpad upgrade --all

# Upgrade specific components
buildpad upgrade input select-dropdown

# Preview changes without writing files
buildpad upgrade --all --dry-run

# 3-way merge (diff3) for conflict resolution on modified files
buildpad upgrade --all --three-way

# Write .new files for modified files (keep originals untouched)
buildpad upgrade --all --strategy=new-file

# Re-sync components already at the latest version (e.g. right after migrate)
buildpad upgrade --force --three-way
```

### View Changelogs

```bash
# View what changed between your installed version and latest
buildpad changelog @buildpad/ui-interfaces

# Filter by version
buildpad changelog @buildpad/ui-form --since=1.3.0

# View changelog for a specific component
buildpad changelog input
```

### Migrate Config Schema

```bash
# Migrate buildpad.json from v1 to v2 (enables per-file update tracking)
buildpad migrate

# Preview migration without writing files
buildpad migrate --dry-run
```

`migrate` baselines every component to the current registry version, so `outdated`/`upgrade` will report everything up to date right after. To re-sync a freshly-migrated project to current source, run `buildpad upgrade --force --three-way`, then `buildpad status` to confirm.

## 🧪 Testing the Setup

### Test MCP Server

1. Test via npx (if published):
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | npx @buildpad/mcp@latest
   # Press Ctrl+C to exit
   ```

2. Or build and test locally:
   ```bash
   pnpm build:mcp
   node packages/mcp-server/dist/index.js
   # Press Ctrl+C to exit
   ```

3. Check VS Code Output panel:
   - Open Output panel (`Cmd+Shift+U` or `Ctrl+Shift+U`)
   - Select "MCP" from the dropdown to see server logs

### Test CLI

1. Build the CLI:
   ```bash
   pnpm build:cli
   ```

2. Test list command:
   ```bash
   node packages/cli/dist/index.js list
   ```

3. Test in a sample project:
   ```bash
   # Create a test directory
   mkdir -p /tmp/test-buildpad
   cd /tmp/test-buildpad
   npm init -y
   
   # Initialize Buildpad
   node /path/to/buildpad-ui/packages/cli/dist/index.js init --yes
   
   # Or bootstrap everything at once
   node /path/to/buildpad-ui/packages/cli/dist/index.js bootstrap --cwd .
   
   # Check generated files
   ls -la
   cat buildpad.json
   ```

## 🔄 Development Workflow

### When Making Changes to Components

```bash
# 1. Edit components in packages/ui-interfaces or packages/ui-collections
vim packages/ui-interfaces/src/input/index.tsx

# 2. Rebuild packages (if needed)
pnpm --filter @buildpad/ui-interfaces build

# 3. Rebuild MCP server (to pick up registry changes)
pnpm build:mcp

# 4. Rebuild CLI (to pick up registry changes)
pnpm build:cli

# 5. Test changes
pnpm cli list
```

### When Adding New Components

1. Create the component in `packages/ui-interfaces/src/`
2. Add metadata to `packages/mcp-server/src/registry.ts`
3. Add to CLI registry in `packages/cli/src/commands/add.ts` and `list.ts`
4. Rebuild both tools:
   ```bash
   pnpm build:mcp && pnpm build:cli
   ```

## 🧪 Testing

Buildpad uses Playwright for E2E testing with a two-tier strategy.

### Storybook Component Tests (Recommended for development)

```bash
# Terminal 1: Start VForm or VTable Storybook
pnpm storybook:interfaces    # Interfaces on port 6005
pnpm storybook:form          # VForm on port 6006
pnpm storybook:table         # VTable on port 6007
pnpm storybook:collections   # Collections on port 6008

# Terminal 2: Run Playwright tests
pnpm test:storybook          # Run VForm Storybook tests
pnpm test:storybook:table    # Run VTable Storybook tests

# Or run VTable tests manually
SKIP_WEBSERVER=true STORYBOOK_TABLE_URL=http://localhost:6007 \\
  npx playwright test tests/ui-table --project=storybook-table
```

Storybook tests:
- ✅ **Isolated** - No authentication required
- ✅ **Fast** - Test components with mocked data
- ✅ **All interface types** - Test any field configuration
- ✅ **DaaS Playground** - Connect to real DaaS and test live schemas

**All Storybooks have DaaS Playground stories** — VForm, VTable, CollectionForm, and CollectionList all support connecting to a live DaaS instance for real-data testing.

**DaaS Playground with Storybook Host (Recommended):**

The DaaS Playground uses a Next.js host app (`apps/storybook-host`) as an authentication proxy. This avoids CORS issues in both development and production.

```bash
# Terminal 1: Start the host app (authentication proxy)
pnpm dev:host

# Terminal 2: Start Storybook (proxies API requests to host app)
pnpm storybook:form
```

Then open the host app at `http://localhost:3000`, enter your DaaS URL and static token to connect. All Storybook API requests are proxied through the host app with credentials stored in an encrypted cookie.

**DaaS Playground Features:**
- **Authentication Display**: Shows current user info and admin status
- **Permission Enforcement**: Test field-level permissions (create/update/read actions)
- **Encrypted Credential Storage**: AES-256-GCM encrypted httpOnly cookies
- **Real-time Testing**: Test with actual collection schemas and data

**DaaS Playground Usage:**
1. Start the host app: `pnpm dev:host`
2. Open `http://localhost:3000` and connect to your DaaS instance
3. Start Storybook: `pnpm storybook:form`
4. Navigate to "Forms/VForm DaaS Playground" → "Playground" story
5. Select a collection from the dropdown
6. Enable "Enforce Field Permissions" to test permission filtering
7. Test VForm with real fields including relational interfaces

### DaaS E2E Tests (Full integration testing)

```bash
# Prerequisites:
# 1. Configure .env.local with DaaS credentials
# 2. Install Playwright browsers
pnpm exec playwright install chromium

# Run E2E tests against DaaS
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# Test specific suite
pnpm test:e2e tests/ui-form/vform.spec.ts
```

DaaS tests:
- ✅ **Real API** - Actual Supabase backend
- ✅ **Authentication** - Test with real users/roles
- ✅ **Permissions** - Verify field-level access
- ✅ **Data Seeding** - Automated test data creation/cleanup

**Test Organization:**
```
tests/
├── auth.setup.ts               # Auth setup (runs once)
├── helpers/
│   └── seed-test-data.ts       # Test data seeding utilities
├── ui-form/
│   ├── vform-storybook.spec.ts # VForm Storybook component tests
│   ├── vform-daas.spec.ts      # VForm DaaS integration tests
│   └── vform.spec.ts           # VForm full E2E workflow tests
└── ui-table/
    └── vtable-storybook.spec.ts # VTable Storybook component tests (22 tests)

playwright.config.ts            # 4 projects: setup, chromium, storybook, storybook-table
```

See [docs/TESTING.md](./docs/TESTING.md) for complete testing guide and best practices.

## 🐛 Troubleshooting

### MCP Server Issues

**VS Code doesn't show Buildpad MCP:**
- Check absolute path in settings.json
- Ensure server is built: `pnpm build:mcp`
- Check Output panel for MCP errors
- Reload VS Code window

**"Module not found" errors:**
- Run `pnpm install` in workspace root
- Rebuild: `pnpm build:mcp`

### CLI Issues

**"buildpad.json not found":**
- Run `buildpad init` first
- Check current directory

**Component not found:**
- Verify name with `buildpad list`
- Check registry is up to date

**TypeScript errors after adding component:**
- Install peer dependencies
- Check tsconfig path aliases
- Restart TypeScript server

## 📚 Next Steps

1. **For AI Development:**
   - Configure VS Code with MCP server (`npx @buildpad/mcp@latest`)
   - Ask Copilot to generate forms and components
   - Use `get_rbac_pattern` MCP tool for RBAC setup
   - Let AI discover and use your component library

2. **For Team Development:**
   - Share CLI: `npx @buildpad/cli@latest init`
   - Document custom components
   - See [docs/PUBLISHING.md](./docs/PUBLISHING.md) for release workflow

3. **For Production:**
   - Packages are published on npm: `@buildpad/cli`, `@buildpad/mcp`
   - See [docs/PUBLISHING.md](./docs/PUBLISHING.md) for versioning and release workflow
   - Use changesets for version management

## 📖 Additional Resources

- [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md) - Complete distribution guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture diagrams
- [docs/TESTING.md](./docs/TESTING.md) - Playwright E2E testing guide- [docs/PUBLISHING.md](./docs/PUBLISHING.md) - npm publishing & release workflow- [packages/mcp-server/README.md](./packages/mcp-server/README.md) - MCP server docs
- [packages/cli/README.md](./packages/cli/README.md) - CLI documentation
- [packages/ui-form/README.md](./packages/ui-form/README.md) - VForm component docs
- [Model Context Protocol](https://modelcontextprotocol.io) - Official MCP docs

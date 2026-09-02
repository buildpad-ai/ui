# Distribution

Buildpad UI Packages is a code distribution system. It defines a schema for components and a CLI to distribute them.

- **Schema**: A flat-file structure (`registry.json`) that defines the components, their dependencies, and properties
- **CLI**: A command-line tool to distribute and install components with cross-framework support

You can use the schema to distribute your components to other projects or have AI generate new components based on existing schema.

## Quick Start

```bash
# 1. Initialize in your project
npx @buildpad/cli init

# 2. Add components
npx @buildpad/cli add input select-dropdown datetime

# 3. Or bootstrap everything at once (recommended for AI agents)
npx @buildpad/cli bootstrap

# 4. Use in your code
import { Input } from '@/components/ui/input'
```

## How It Works

### 1. CLI Tool

The CLI copies component source code directly into your project with imports transformed to local paths.

```bash
# Initialize in your project
npx @buildpad/cli init

# Add components
npx @buildpad/cli add input select-dropdown datetime

# List available components
npx @buildpad/cli list

# Add by category
npx @buildpad/cli add --category selection

# Preview changes before adding
npx @buildpad/cli diff input
```

### 2. Project Structure

When you add components, they're copied to your project:

```
your-project/
├── app/
│   ├── api/
│   │   ├── auth/                        # Auth proxy routes (installed by CLI)
│   │   │   ├── login/route.ts           # POST - Supabase login
│   │   │   ├── logout/route.ts          # POST - Sign out
│   │   │   ├── user/route.ts            # GET - Current user info
│   │   │   └── callback/route.ts        # GET - OAuth callback
│   │   ├── fields/[collection]/route.ts # Fields proxy
│   │   ├── items/[collection]/route.ts  # Items proxy
│   │   └── ...
│   └── [lang]/                          # Every page is locale-prefixed (/en/…, /id/…)
│       ├── layout.tsx                   # Root layout: <html lang dir>, I18nProvider
│       ├── login/page.tsx               # Login page template
│       └── (authenticated)/…            # App shell + route modules
├── src/
│   ├── components/
│   │   └── ui/                      # UI components
│   │       ├── input.tsx
│   │       ├── select-dropdown.tsx
│   │       ├── datetime.tsx
│   │       └── vform/               # VForm component (when using collection-form)
│   │           ├── VForm.tsx
│   │           ├── components/
│   │           └── utils/
│   └── lib/
│       ├── buildpad/              # Lib modules (auto-resolved)
│       │   ├── utils.ts
│       │   ├── field-interface-mapper.ts
│       │   ├── types/
│       │   ├── services/
│       │   └── hooks/
│       ├── api/auth-headers.ts      # Auth header utilities
│       ├── i18n/                    # Locale config, dictionaries, I18nProvider, useLocaleRouter
│       │   ├── config.ts
│       │   ├── dictionaries/en.json
│       │   └── provider.tsx
│       └── supabase/                # Supabase client utilities
│           ├── server.ts
│           └── client.ts
├── middleware.ts                     # Locale redirect + auth session refresh
└── buildpad.json                  # Configuration
```

### 3. Import Transformation

```tsx
// Original (in source)
import { useRelationM2M } from '@buildpad/hooks';
import type { M2MItem } from '@buildpad/types';

// Transformed (in your project)
import { useRelationM2M } from '@/lib/buildpad/hooks';
import type { M2MItem } from '@/lib/buildpad/types';
```

## AI-Ready

The design of Buildpad makes it easy for AI tools to work with your code. Its open code and consistent API allow AI models to read, understand, and generate new components.

### MCP Server

The MCP (Model Context Protocol) server exposes Buildpad components to AI assistants like VS Code Copilot.

The MCP server is published as [`@buildpad/mcp`](https://www.npmjs.com/package/@buildpad/mcp) on npm.

**Configure VS Code (Recommended — via npx):**

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

**Configure VS Code (Local build — for development):**

```bash
# Build the MCP server
pnpm build:mcp
```

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

**Usage with Copilot:**

- "List all Buildpad components"
- "Show me how to use the Input component"
- "Generate a CollectionForm for products"
- "Get the install command for input and datetime"

## Alternative Distribution Methods

### Workspace Protocol (Monorepo)

For projects within the same monorepo:

```json
{
  "dependencies": {
    "@buildpad/types": "workspace:*",
    "@buildpad/services": "workspace:*",
    "@buildpad/hooks": "workspace:*",
    "@buildpad/ui-interfaces": "workspace:*",
    "@buildpad/ui-collections": "workspace:*"
  }
}
```

### Git Dependencies

For external projects without publishing:

```json
{
  "dependencies": {
    "@buildpad/types": "github:yourorg/buildpad#packages/types"
  }
}
```

### GitHub Packages (Private Registry)

For private distribution, you can publish to GitHub's private npm registry.
Note: The CLI and MCP server are already published publicly at `@buildpad/cli` and `@buildpad/mcp` on npmjs.com.

```bash
# Create .npmrc
echo "@buildpad:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc

# Publish
pnpm --filter @buildpad/types publish
```

## Comparison

| Method | Use Case | Best For |
|--------|----------|----------|
| **CLI (npx)** | Copy components as source | Teams that customize |
| **MCP Server (npx)** | AI-assisted development | VS Code Copilot users |
| **Workspace** | Monorepo development | Internal teams |
| **Git/npm** | Traditional package install | External distribution |

## Development

### Building

```bash
# Build CLI
pnpm build:cli

# Build MCP server
pnpm build:mcp

# Build all packages
pnpm build:packages
```

### Testing the CLI

```bash
# Initialize and add components
npx @buildpad/cli init
npx @buildpad/cli add input
npx @buildpad/cli list
```

### Testing the MCP Server

```bash
# Build and configure VS Code
pnpm build:mcp

# Reload VS Code after config changes
```

## Updating Components

Re-add a component with the overwrite flag:

```bash
npx @buildpad/cli add input --overwrite
```

Or manually edit the copied component in your project. Since you own the code, you can modify it however you need.

## Troubleshooting

### MCP Server Not Showing in VS Code

1. Check VS Code settings.json config
2. Verify absolute path to `index.js`
3. Ensure MCP server is built: `pnpm build:mcp`
4. Reload VS Code window
5. Check Output panel for MCP errors

### CLI Component Not Found

1. Check component name: `npx @buildpad/cli list`
2. Verify registry is up to date

### Type Errors After Install

1. Install peer dependencies: `pnpm add @mantine/core react`
2. Check tsconfig path aliases match `buildpad.json`
3. Restart TypeScript server in VS Code

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [pnpm Workspace Guide](https://pnpm.io/workspaces)
- [shadcn/ui (inspiration)](https://ui.shadcn.com)

## Hosting Storybook on AWS Amplify

All four Storybooks are served by a **Next.js host app** (`apps/storybook-host`) that also provides a DaaS authentication proxy. The host app is deployed as a single Amplify application.

All Storybooks use **Storybook 10** with `@storybook/nextjs-vite`.

### What Gets Deployed

| Path | Package | Content |
|------|---------|---------|
| `/` | storybook-host | Landing page with DaaS connection form + Storybook links |
| `/storybook/interfaces/` | `@buildpad/ui-interfaces` | 40+ field interface components |
| `/storybook/form/` | `@buildpad/ui-form` | VForm dynamic form component |
| `/storybook/table/` | `@buildpad/ui-table` | VTable dynamic table component |
| `/storybook/collections/` | `@buildpad/ui-collections` | CollectionForm, CollectionList, ContentLayout, ContentNavigation, FilterPanel, SaveOptions |
| `/api/connect` | storybook-host | Store DaaS credentials (encrypted cookie) |
| `/api/status` | storybook-host | Check connection status |
| `/api/[...path]` | storybook-host | Catch-all proxy to DaaS backend |

### Architecture

The host app solves the CORS problem that arises when Storybooks (static HTML) try to make API requests to a DaaS backend on a different origin:

- **Development**: Storybook's Vite dev server proxies `/api/*` to the host app on `localhost:3000`
- **Production**: Storybooks are served from `public/storybook/` inside the host app (same origin)

DaaS credentials (URL + static token) are stored in an **AES-256-GCM encrypted httpOnly cookie**. The catch-all proxy route reads the cookie and forwards requests to DaaS with `Authorization: Bearer <token>`.

### Setup

1. **Connect repo:** AWS Amplify Console → **Host web app** → GitHub → select repo, branch `main`
2. **Build settings:** Amplify auto-detects [amplify.yml](../amplify.yml) — no manual config needed
3. **Environment variable (required):** Add `COOKIE_SECRET` in Amplify Console → Environment variables (any random string for encryption key)
4. **Deploy:** Click **Save and deploy** → get a CDN URL like `https://main.d1234abcdef.amplifyapp.com`

The build pipeline:
1. Installs pnpm via corepack
2. Runs `pnpm install --frozen-lockfile`
3. Builds all 4 Storybooks into `apps/storybook-host/public/storybook/`
4. Builds the Next.js host app (Amplify handles deployment natively)

### Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `COOKIE_SECRET` | Any random string (encryption key) | Yes (for production) |

No DaaS URL/token env vars are needed — users enter credentials at runtime through the landing page UI.

### Local Preview

```bash
# Build all Storybooks + host app
pnpm build:storybook
pnpm build:host

# Start production mode
pnpm start:host
```

Or in development mode:

```bash
# Terminal 1: Start the host app
pnpm dev:host

# Terminal 2: Start any Storybook
pnpm storybook:form
```

### Build Image & Node Version

Use **Amazon Linux 2023** (default). If builds fail due to Node version, add a `.nvmrc` file with `20`.

### Custom Domain

Amplify Console → Domain management → **Add domain** → follow DNS verification. Free SSL included.

### Amplify Troubleshooting

- **Out of memory:** Increase compute to **Large** (7 GB) or add `export NODE_OPTIONS="--max-old-space-size=4096"` to preBuild
- **pnpm not found:** Ensure preBuild has `corepack enable && corepack prepare pnpm@10.17.0 --activate`
- **Blank page:** Verify `baseDirectory: apps/storybook-host` in `amplify.yml`
- **DaaS proxy not working:** Ensure `COOKIE_SECRET` env var is set in Amplify Console

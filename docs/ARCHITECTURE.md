# Buildpad UI Packages Distribution Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Distribution Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────┐      ┌──────────────────────────┐    │
│  │   MCP Server             │      │   CLI Tool               │    │
│  │   (AI Agents)            │      │   (Developers)           │    │
│  ├──────────────────────────┤      ├──────────────────────────┤    │
│  │ - List components        │      │ - buildpad init        │    │
│  │ - Read source code       │      │ - buildpad add         │    │
│  │ - Generate examples      │      │ - buildpad bootstrap   │    │
│  │ - Code generation        │      │ - buildpad list        │    │
│  │ - RBAC patterns          │      │ - buildpad outdated    │    │
│  │ - Upgrade plans          │      │ - buildpad upgrade     │    │
│  │ - Changelog slices       │      │ - buildpad changelog   │    │
│  └──────────┬───────────────┘      └──────────┬───────────────┘    │
│             │                                  │                     │
│             └──────────────┬───────────────────┘                     │
│                            │                                         │
│                            ▼                                         │
│                   ┌────────────────┐                                │
│                   │    Registry    │                                │
│                   │   (Metadata)   │                                │
│                   └────────────────┘                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Source Layer                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   types/    │  │  services/  │  │   hooks/    │                │
│  │   (Base)    │  │(CRUD+DaaS)  │  │(Auth+Rels)  │                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                │                 │                        │
│         │          DaaSProvider       useAuth                       │
│         │          apiRequest         usePermissions                │
│         │                             useFieldMetadata              │
│         └────────────────┼─────────────────┘                        │
│                          │                                          │
│                          ▼                                          │
│         ┌────────────────────────────────────┐                     │
│         │    ui-interfaces/                  │                     │
│         │    (40+ Components)                │                     │
│         │  - Input, Select, DateTime, etc.   │                     │
│         │  - Rich Text (Block, HTML, MD)     │                     │
│         │  - Relational (M2O, O2M, M2M, M2A) │                     │
│         └────────────────┬───────────────────┘                     │
│                          │                                          │
│                          ▼                                          │
│         ┌────────────────────────────────────┐                     │
│         │    ui-form/                        │                     │
│         │  - VForm (with permission filter)  │                     │
│         │  - FormField, FormFieldLabel       │                     │
│         │  - Field processing utilities      │                     │
│         └────────────────┬───────────────────┘                     │
│                          │                                          │
│                          ▼                                          │
│         ┌────────────────────────────────────┐                     │
│         │    ui-collections/                 │                     │
│         │  - CollectionForm                  │                     │
│         │  - CollectionList                  │                     │
│         │  - ContentLayout                   │                     │
│         │  - ContentNavigation               │                     │
│         │  - FilterPanel                     │                     │
│         │  - SaveOptions                     │                     │
│         └────────────────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Consumer Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│       ┌─────────────────────────┐   ┌───────────────────────┐      │
│       │   Projects (CLI)        │   │   AI Assistant        │      │
│       ├─────────────────────────┤   ├───────────────────────┤      │
│       │ your-nextjs-app         │   │ Via MCP:              │      │
│       │ your-react-project      │   │ - Discover            │      │
│       │ any-frontend-app        │   │ - Generate            │      │
│       │                         │   │ - Assist              │      │
│       │ Via CLI (Copy & Own):   │   │                       │      │
│       │ - Copy source files     │   │ Via VS Code Copilot:  │      │
│       │ - Transform imports     │   │ - Read components     │      │
│       │ - Full customization    │   │ - Generate code       │      │
│       └─────────────────────────┘   └───────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Testing Layer                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│       ┌─────────────────────────────────────────────────────┐      │
│       │   Playwright E2E Tests (Two-Tier Strategy)          │      │
│       ├─────────────────────────────────────────────────────┤      │
│       │ tests/                                              │      │
│       │   ├── auth.setup.ts    (Authentication setup)       │      │
│       │   ├── ui-form/                                      │      │
│       │   │   ├── vform-storybook.spec.ts (Storybook tests) │      │
│       │   │   ├── vform-daas.spec.ts (DaaS integration)     │      │
│       │   │   └── vform.spec.ts (Full E2E workflow)         │      │
│       │   └── ui-table/                                     │      │
│       │       └── vtable-storybook.spec.ts (22 tests)       │      │
│       │                                                     │      │
│       │ Tier 1: Storybook (isolated, no auth, with proxy)   │      │
│       │ Tier 2: DaaS E2E (real API, auth, permissions)      │      │
│       └─────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Storybook Host Architecture

The `apps/storybook-host` Next.js app serves as both a DaaS authentication proxy and a Storybook hosting server. This solves CORS issues in both development and production (AWS Amplify).

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Storybook Host (Next.js)                          │
│                    apps/storybook-host                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Landing Page (/)                                             │    │
│  │  • DaaS connection form (URL + static token)                  │    │
│  │  • Storybook navigation grid                                 │    │
│  │  • Connection status display                                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  API Routes                                                    │    │
│  │  POST /api/connect     → Validate & store DaaS credentials    │    │
│  │  POST /api/disconnect  → Clear credentials                    │    │
│  │  GET  /api/status      → Check connection status              │    │
│  │  *    /api/[...path]   → Catch-all proxy to DaaS backend     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Credential Storage (lib/cookie.ts)                           │    │
│  │  • AES-256-GCM encrypted httpOnly cookie                      │    │
│  │  • Key derived from COOKIE_SECRET env var via SHA-256         │    │
│  │  • 30-day expiry, SameSite=Lax                                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Static Storybooks (public/storybook/)                        │    │
│  │  /storybook/interfaces/   ← ui-interfaces (40+ components)   │    │
│  │  /storybook/form/         ← ui-form (VForm)                  │    │
│  │  /storybook/table/        ← ui-table (VTable)                │    │
│  │  /storybook/collections/  ← ui-collections (CRUD)            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Storybook → Host → DaaS Request Flow

```
  Development Mode                         Production Mode (Amplify)
  ┌─────────────┐                          ┌─────────────┐
  │  Storybook   │                          │  Storybook   │
  │  (port 6006) │                          │  /storybook/ │
  └──────┬───────┘                          └──────┬───────┘
         │ fetch('/api/collections')                │ fetch('/api/collections')
         │                                         │
         ▼                                         ▼
  ┌─────────────────┐                       ┌─────────────────┐
  │  Vite Dev Proxy  │                       │  Same-Origin     │
  │  /api → :3000    │                       │  (Next.js app)   │
  └──────┬───────────┘                       └──────┬───────────┘
         │                                         │
         ▼                                         ▼
  ┌─────────────────────────────────────────────────────┐
  │  Next.js Host App (apps/storybook-host)             │
  │  /api/[...path]/route.ts                            │
  │  1. Read encrypted cookie → {url, token}            │
  │  2. Proxy to ${url}/api/${path}                     │
  │  3. Add Authorization: Bearer ${token}              │
  └──────────────────┬──────────────────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────────────────┐
  │  DaaS Backend                                       │
  │  https://xxx.buildpad-daas.xtremax.com            │
  └─────────────────────────────────────────────────────┘
```

## Deployment Architecture (AWS Amplify)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AWS Amplify Deployment                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Build Pipeline (amplify.yml):                                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ 1. corepack enable → pnpm install                           │     │
│  │ 2. bash scripts/build-storybooks.sh                         │     │
│  │    → Build 4 Storybooks to apps/storybook-host/public/      │     │
│  │ 3. cd apps/storybook-host && npx next build                 │     │
│  │    → Build Next.js host app (Amplify handles natively)      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  Artifacts: apps/storybook-host/.next/**/*                            │
│                                                                        │
│  Routes Served:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ /                       → Landing page (connect + nav)      │     │
│  │ /storybook/interfaces/  → ui-interfaces Storybook           │     │
│  │ /storybook/form/        → ui-form Storybook                 │     │
│  │ /storybook/table/       → ui-table Storybook                │     │
│  │ /storybook/collections/ → ui-collections Storybook          │     │
│  │ /api/connect            → Store DaaS credentials            │     │
│  │ /api/status             → Check connection                  │     │
│  │ /api/[...path]          → Proxy to DaaS backend             │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  Environment Variables:                                               │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ COOKIE_SECRET  → Encryption key for credential cookie        │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Distribution Flow

### Flow 1: AI-Assisted Development (MCP)

```
┌──────────────┐
│  VS Code     │
│  Copilot     │
└──────┬───────┘
       │
       │ Request components
       ▼
┌──────────────────────┐
│   MCP Server         │
│   (stdio protocol)   │
└──────┬───────────────┘
       │
       │ Read registry
       │ Load source files
       ▼
┌──────────────────────┐
│   Component          │
│   Registry           │
└──────┬───────────────┘
       │
       │ Return metadata
       │ and source code
       ▼
┌──────────────────────┐
│   Copilot generates  │
│   code using         │
│   Buildpad         │
└──────────────────────┘
```

### Flow 2: Developer Workflow (CLI)

```
┌──────────────────┐
│   Developer      │
│   $ buildpad   │
│     add input    │
└──────┬───────────┘
       │
       │ Execute command
       ▼
┌──────────────────────┐
│   CLI Tool           │
│   (commander.js)     │
└──────┬───────────────┘
       │
       │ Check config
       │ Query registry
       ▼
┌──────────────────────┐
│   Component          │
│   Registry           │
└──────┬───────────────┘
       │
       │ Locate source
       │ Copy files
       ▼
┌──────────────────────┐
│   User's Project     │
│   src/components/ui/ │
│   ├── input/         │
│   │   └── index.tsx  │
└──────────────────────┘
```

### Flow 3: Project Integration (Copy & Own)

```
┌──────────────────┐
│   Developer      │
│   $ npx          │
│   @buildpad/cli│
│   add input      │
└──────┬───────────┘
       │
       │ CLI copies files
       ▼
┌──────────────────────┐
│   your-project/      │
│   src/components/ui/ │
│   └── input.tsx      │
└──────┬───────────────┘
       │
       │ Local imports
       │ @/components/ui/input
       ▼
┌──────────────────────┐
│   Your Application   │
│   import { Input }   │
│   from '@/components │
│   /ui/input'         │
└──────────────────────┘
```

## Component Registry Structure (v2)

The registry is **auto-generated** from `registry.template.json` via `scripts/build-registry.mjs`. Never hand-edit `registry.json`.

```
registry.json (schemaVersion: 2)
├── meta
│   ├── model: "copy-own"
│   ├── framework: "react"
│   └── uiLibrary: "mantine-v8"
├── packages (per-package semver map)
│   ├── @buildpad/ui-interfaces: { version: "1.4.2", changelogUrl }
│   ├── @buildpad/ui-form:       { version: "0.9.1", changelogUrl }
│   ├── @buildpad/hooks:         { version: "1.2.0", changelogUrl }
│   └── … 5 more
├── lib
│   ├── types:    { files: [{ source, target, sourceSha256 }] }
│   ├── services: { … }
│   ├── hooks:    { … }
│   └── utils:    { … }
├── components[] (40+ components)
│   └── {
│       name: "input",
│       sourcePackage: "@buildpad/ui-interfaces",
│       version: "1.4.2",
│       lastChangedIn: "1.4.0",
│       files: [{ source, target, sourceSha256 }],
│       dependencies: ["@mantine/core", …],
│       internalDependencies: ["types", "utils"],
│       registryDependencies: ["textarea"]
│   }
└── categories[]
```

## Build Process

```
Source Code Changes           Registry Template
       │                      (hand-edited)
       ▼                             │
┌──────────────────┐                 │
│  packages/       │                 │
│  - types/        │                 │
│  - services/     │                 │
│  - hooks/        │                 │
│  - ui-*/         │                 │
└──────┬───────────┘                 │
       │                             │
       │ $ pnpm build:registry       │
       │ ┌───────────────────────────┘
       │ ▼
       │ scripts/build-registry.mjs
       │ ├── Read package.json for semver
       │ ├── Compute SHA256 per file
       │ ├── Merge with template
       │ └── Write registry.json (schemaVersion 2)
       │
       │ $ pnpm build:packages
       ▼
┌──────────────────┐
│  Built packages  │
│  (dist/)         │
└──────┬───────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ $ pnpm       │  │ $ pnpm       │
│ build:mcp    │  │ build:cli    │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ MCP Server   │  │ CLI Tool     │
│ dist/        │  │ dist/        │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ├─────────────────┘
       │
       ▼
┌──────────────────────┐
│  Ready for           │
│  Distribution        │
└──────────────────────┘
```

## Data Flow Example

### Example: Adding Input Component via CLI

```
1. User Action
   $ buildpad add input

2. CLI Execution
   ├── Load config: buildpad.json
   ├── Query registry: registry.ts
   └── Find component: { name: 'Input', path: '...' }

3. File Operations
   ├── Source: packages/ui-interfaces/src/input/index.tsx
   ├── Target: project/src/components/ui/input/index.tsx
   └── Copy files + check dependencies

4. Dependency Check
   ├── Component needs: @mantine/core, react
   ├── Check package.json
   └── Warn if missing

5. Success
   ├── Component copied
   ├── Ready to import
   └── Developer customizes as needed
```

### Example: AI Code Generation via MCP

```
1. User Prompt to Copilot
   "Generate a form with Input and SelectDropdown"

2. Copilot MCP Request
   ├── Tool: list_components
   └── Response: [{ name: 'Input', ... }, { name: 'SelectDropdown', ... }]

3. Copilot MCP Request
   ├── Tool: get_usage_example
   ├── Args: { component: 'Input' }
   └── Response: <example code>

4. Copilot Generates
   import { Input, SelectDropdown } from '@buildpad/ui-interfaces';
   
   function MyForm() {
     const [name, setName] = useState('');
     const [status, setStatus] = useState('');
     
     return (
       <>
         <Input field="name" value={name} onChange={setName} />
         <SelectDropdown field="status" value={status} onChange={setStatus} />
       </>
     );
   }

5. User Reviews & Uses
```

## Deployment Scenarios

### Scenario 1: Project Setup (Copy & Own)

```
┌──────────────────────────────────┐
│  Buildpad (packages/)          │
│  ├── registry.json               │
│  ├── cli/                        │
│  ├── types/                      │
│  ├── services/                   │
│  ├── hooks/                      │
│  └── ui-interfaces/              │
└────────────────┬─────────────────┘
                 │
                 │ $ npx @buildpad/cli add
                 │ Copies source files
                 ▼
         ┌───────────────┐
         │  Your Project │
         │  (Next.js,    │
         │   React, etc.)│
         │  Own the code │
         └───────────────┘
```

### Scenario 2: New Project Bootstrap

```
┌──────────────────────────────────┐
│  New Next.js Project             │
│  $ npx create-next-app@latest    │
└────────────────┬─────────────────┘
                 │
                 │ Initialize Buildpad
                 │ $ npx @buildpad/cli init
                 ▼
         ┌───────────────┐
         │  Add components│
         │  $ npx         │
         │  @buildpad/  │
         │  cli add input │
         └───────┬───────┘
                 │
                 │ Copies to src/
                 ▼
         ┌───────────────┐
         │  Ready to use │
         │  Full control │
         └───────────────┘
```

### Scenario 3: AI-Enhanced Development

```
┌──────────────────────────────────┐
│  Buildpad Repo                 │
│  └── packages/mcp-server/        │
└────────────────┬─────────────────┘
                 │
                 │ MCP protocol
                 │ (stdio)
                 ▼
         ┌───────────────┐
         │ VS Code      │
         │ Copilot      │
         └───────┬───────┘
                 │
                 │ Helps developer
                 │ Generate code
                 ▼
         ┌───────────────┐
         │   Developer   │
         │   Uses AI to  │
         │   build faster│
         └───────────────┘
```

## Security Model

```
┌─────────────────────────────────────┐
│         Private Source Code          │
│         (Not Published)              │
└──────────────┬──────────────────────┘
               │
               ├─── Access Method 1 ───┐
               │                        │
               ▼                        ▼
        ┌──────────┐            ┌──────────┐
        │   MCP    │            │   CLI    │
        │  Server  │            │   Tool   │
        └────┬─────┘            └────┬─────┘
             │                       │
             │ Local only            │ Copies files
             │ No network            │ to user project
             ▼                       ▼
        ┌──────────┐            ┌──────────┐
        │   AI     │            │   User   │
        │ Assistant│            │  Project │
        └──────────┘            └──────────┘
        
        User controls            User owns
        via config               the code
```

## Authentication Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DaaS Authentication Flow                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Authentication Methods (DaaS-Compatible):                            │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 1. Cookie-Based Sessions - For browser requests (automatic)   │    │
│  │ 2. Static Tokens - For programmatic access (DaaS-style)   │    │
│  │ 3. JWT Bearer Tokens - For API clients with Supabase Auth     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Client-Side Hooks:                                                    │
│  ┌────────────────────┐   ┌────────────────────┐                     │
│  │ useAuth            │   │ usePermissions     │                     │
│  │ - user             │   │ - canPerform       │                     │
│  │ - isAdmin          │   │ - getAccessibleFld │                     │
│  │ - isAuthenticated  │   │ - isFieldAccessble │                     │
│  │ - checkPermission  │   │ - filterFields     │                     │
│  └─────────┬──────────┘   └─────────┬──────────┘                     │
│            │                        │                                  │
│            └──────────┬─────────────┘                                  │
│                       ▼                                                │
│           ┌─────────────────────┐                                     │
│           │ DaaSProvider        │                                     │
│           │ - config (url/token)│                                     │
│           │ - user              │                                     │
│           │ - isDirectMode      │                                     │
│           │ - buildUrl          │                                     │
│           │ - getHeaders        │                                     │
│           └─────────┬───────────┘                                     │
│                     │                                                  │
│                     ▼                                                  │
│           ┌─────────────────────┐                                     │
│           │ API Endpoints       │                                     │
│           │ /api/users/me       │                                     │
│           │ /api/permissions/me │                                     │
│           │ /api/auth/login     │                                     │
│           │ /api/auth/logout    │                                     │
│           │ /api/auth/user      │                                     │
│           │ /api/auth/callback  │                                     │
│           └─────────────────────┘                                     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Permission Enforcement Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    VForm Permission Filtering                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐                                                  │
│  │ VForm Component │                                                  │
│  │ enforcePerms=T  │                                                  │
│  │ action="update" │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│           │ 1. Fetch permissions                                       │
│           ▼                                                            │
│  ┌─────────────────────────────────┐                                  │
│  │ GET /api/permissions/{coll}    │                                  │
│  │   ?action=update               │                                  │
│  └────────┬────────────────────────┘                                  │
│           │                                                            │
│           │ 2. Response: { fields: ['title', 'content'] }             │
│           ▼                                                            │
│  ┌─────────────────────────────────┐                                  │
│  │ Filter fields array            │                                  │
│  │ - All fields: [id, title,      │                                  │
│  │   content, status, author]     │                                  │
│  │ - Accessible: [title, content] │                                  │
│  │ - Filtered: 2 fields shown     │                                  │
│  └────────┬────────────────────────┘                                  │
│           │                                                            │
│           │ 3. Render only accessible fields                          │
│           ▼                                                            │
│  ┌─────────────────────────────────┐                                  │
│  │ FormField: title               │                                  │
│  │ FormField: content             │                                  │
│  │ (id, status, author hidden)    │                                  │
│  └─────────────────────────────────┘                                  │
│                                                                        │
│  Note: Admin users (admin_access=true) bypass filtering               │
│        and see all fields regardless of permissions.                  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

**Legend:**
- `┌─┐` Boxes represent systems/components
- `│ ▼` Arrows show data/control flow
- `├──┤` Represents dependencies/relationships

## Auth Proxy Routes Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Auth Proxy Routes (installed by CLI)                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Browser (same-origin)                                                │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  Login Page (/app/login/page.tsx)                          │      │
│  │  → POST /api/auth/login (same-origin, no CORS)            │      │
│  └────────────────────┬───────────────────────────────────────┘      │
│                       │                                               │
│                       ▼                                               │
│  Next.js API Routes (Server-Side)                                    │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ /api/auth/login    → Supabase signInWithPassword          │      │
│  │ /api/auth/logout   → Supabase signOut + clear cookies     │      │
│  │ /api/auth/user     → DaaS /api/users/me (or fallback)    │      │
│  │ /api/auth/callback → OAuth code exchange + redirect       │      │
│  └────────────────────┬───────────────────────────────────────┘      │
│                       │                                               │
│                       ▼                                               │
│  Supabase Auth (Server-Side, no CORS issues)                         │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ @supabase/ssr createClient() → server-side cookies        │      │
│  │ Session management with Next.js middleware                 │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                        │
│  Pattern: Browser → Next.js API Route → Supabase Auth (server-side)  │
│  Benefit: No CORS, cookie-based sessions, server-side token mgmt    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Bootstrap Flow (CLI)

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Bootstrap Command Flow                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  $ buildpad bootstrap --cwd /path/to/project                       │
│                                                                        │
│  Step 1: Init                                                         │
│  ┌─────────────────────────────────────────┐                         │
│  │ • buildpad.json                       │                         │
│  │ • package.json + tsconfig               │                         │
│  │ • Next.js skeleton (layout, page)       │                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 2: Add All Components (non-interactive)                        │
│  ┌─────────────────────────────────────────┐                         │
│  │ • 40+ UI components → components/ui/    │                         │
│  │ • types, services, hooks → lib/buildpad/│                       │
│  │ • API proxy routes → app/api/            │                         │
│  │ • Auth routes → app/api/auth/            │                         │
│  │ • Login page → app/login/page.tsx        │                         │
│  │ • Supabase utilities → lib/supabase/     │                         │
│  │ • Middleware → middleware.ts              │                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 3: Install Dependencies                                        │
│  ┌─────────────────────────────────────────┐                         │
│  │ • pnpm install (auto-detects pkg mgr)   │                         │
│  │ • Mantine, TipTap, Supabase, etc.       │                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 4: Validate                                                     │
│  ┌─────────────────────────────────────────┐                         │
│  │ • Check untransformed imports           │                         │
│  │ • Check missing lib/CSS files           │                         │
│  │ • Check SSR issues                      │                         │
│  │ • Separate TS errors (non-fatal)        │                         │
│  └─────────────────────────────────────────┘                         │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Upgrade Flow

The CLI tracks per-file SHA256 checksums so upgrades only overwrite files the consumer hasn't customized:

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Upgrade Flow (buildpad upgrade)                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  $ buildpad upgrade --all                                           │
│                                                                        │
│  Step 1: Compare (per-component)                                       │
│  ┌─────────────────────────────────────────┐                         │
│  │ • installed.version                     │                         │
│  │ • registry.packages[sourcePackage].version                        │
│  │ • Skip if installed >= lastChangedIn   │                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 2: Fetch fresh source (per file)                                 │
│  ┌─────────────────────────────────────────┐                         │
│  │ • Fetch from GitHub raw CDN at registry │                         │
│  │   version (or local registry in monorepo)                         │
│  │ • Transform imports per consumer alias cfg                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 3: Per-file decision                                              │
│  ┌─────────────────────────────────────────┐                         │
│  │ disk_sha == recorded_sha?               │                         │
│  │   YES → Silent overwrite                │                         │
│  │   NO  → Prompt: [s]kip [o]verwrite      │                         │
│  │          [w]rite .new [3]way-merge      │                         │
│  └─────────────────────┬───────────────────┘                         │
│                        ▼                                              │
│  Step 4: Record new state                                               │
│  ┌─────────────────────────────────────────┐                         │
│  │ • Update component.version              │                         │
│  │ • Update file.sha256 for overwritten files                         │
│  │ • Update packageVersions map            │                         │
│  └─────────────────────────────────────────┘                         │
│                                                                        │
│  Three-Way Merge (--three-way):                                        │
│  ┌─────────────────────────────────────────┐                         │
│  │ base = source at installed-version     │                         │
│  │ (fetched from GitHub raw at prior tag)  │                         │
│  │ ours = consumer's modified file         │                         │
│  │ theirs = fresh source at latest version │                         │
│  │ → diff3(ours, base, theirs)             │                         │
│  │ → On network failure: fall back to .new │                         │
│  └─────────────────────────────────────────┘                         │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

**`--force`:** skips the Step 1 version check, so components already at `lastChangedIn` are still processed. Steps 2–4 are unchanged — per-file decisions and `--strategy` handling still apply, so local edits are merged rather than clobbered. This is the intended path for re-syncing a freshly-migrated (pre-v2) project, whose components are all baselined to the current version and would otherwise be skipped.

**Lib modules:** the same flow applies to lib modules tracked in `config.lib` (with per-file checksums and a registry `lastChangedIn`), not just components. The **`design-system`** module (design tokens, globals, theme, app shell) is the primary case: `buildpad upgrade --design` scopes to it, a bare `buildpad upgrade` includes it when behind, and `buildpad outdated` reports it. Build-registry stamps each lib module with `version`/`lastChangedIn` (CLI-owned templates resolve to `@buildpad/cli`).

## MCP RBAC Pattern Tool

```
┌──────────────────────────────────────────────────────────────────────┐
│              get_rbac_pattern MCP Tool                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Available Patterns:                                                  │
│  ┌─────────────────────────────────────────┐                         │
│  │ own_items       → Users manage own data │                         │
│  │ role_hierarchy  → Admin>Editor>Viewer   │                         │
│  │ public_read     → Public read + auth write │                      │
│  │ multi_tenant    → Org-level isolation   │                         │
│  │ full_crud       → Unrestricted CRUD     │                         │
│  │ read_only       → Read-only access      │                         │
│  └─────────────────────────────────────────┘                         │
│                                                                        │
│  Returns: Step-by-step MCP tool call sequences                       │
│  ┌─────────────────────────────────────────┐                         │
│  │ 1. Create role(s)                       │                         │
│  │ 2. Create policy/policies               │                         │
│  │ 3. Create access entries                │                         │
│  │ 4. Create permissions per collection    │                         │
│  └─────────────────────────────────────────┘                         │
│                                                                        │
│  Dynamic Variables:                                                   │
│  $CURRENT_USER, $CURRENT_ROLE, $CURRENT_ROLES,                      │
│  $CURRENT_POLICIES, $NOW                                             │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Testing Architecture

### Playwright E2E Test Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Test Execution Flow                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐                                                 │
│  │ $ pnpm test:e2e  │                                                 │
│  └────────┬─────────┘                                                 │
│           │                                                            │
│           │ 1. Run setup project                                       │
│           ▼                                                            │
│  ┌──────────────────┐      ┌──────────────────────────┐              │
│  │ auth.setup.ts    │ ───► │ DaaS App                 │              │
│  │ (Authenticate)   │      │ http://localhost:3000    │              │
│  └────────┬─────────┘      │ /auth/login              │              │
│           │                └──────────────────────────┘              │
│           │ 2. Save auth state                                        │
│           ▼                                                            │
│  ┌──────────────────────────┐                                        │
│  │ playwright/.auth/        │                                        │
│  │   └── admin.json         │                                        │
│  │   (Stored credentials)   │                                        │
│  └────────┬─────────────────┘                                        │
│           │                                                            │
│           │ 3. Run test files with stored auth                        │
│           ▼                                                            │
│  ┌──────────────────────────┐      ┌──────────────────────────┐     │
│  │ tests/ui-form/           │      │ DaaS App                 │     │
│  │   └── vform.spec.ts      │ ───► │ /users, /users/new       │     │
│  │   (19 tests)             │      │ /users/{id}              │     │
│  └────────┬─────────────────┘      └──────────────────────────┘     │
│           │                                                            │
│           │ 4. Generate reports                                        │
│           ▼                                                            │
│  ┌──────────────────────────┐                                        │
│  │ playwright-report/       │                                        │
│  │ test-results/            │                                        │
│  │   (Screenshots, traces)  │                                        │
│  └──────────────────────────┘                                        │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Test Data Management

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Test Data Lifecycle                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  test.beforeEach                                                       │
│  ┌─────────────────────────┐                                         │
│  │ createTestUser(page)    │                                         │
│  │ ├── Navigate to /users  │                                         │
│  │ ├── page.evaluate()     │ ──► POST /api/users                     │
│  │ └── Return user ID      │     (Creates in Supabase)               │
│  └─────────────────────────┘                                         │
│                                                                        │
│  test                                                                  │
│  ┌─────────────────────────┐                                         │
│  │ Use testUserId          │                                         │
│  │ Navigate to /users/{id} │                                         │
│  │ Interact with form      │                                         │
│  │ Assert behaviors        │                                         │
│  └─────────────────────────┘                                         │
│                                                                        │
│  test.afterEach                                                        │
│  ┌─────────────────────────┐                                         │
│  │ deleteTestUser(page)    │                                         │
│  │ └── page.evaluate()     │ ──► DELETE /api/users/{id}              │
│  │     (Cleanup)           │     (Removes from Supabase)             │
│  └─────────────────────────┘                                         │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### VForm Component Integration

```
┌──────────────────────────────────────────────────────────────────────┐
│              VForm Integration with DaaS                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────┐                                             │
│  │ @buildpad/ui-form │                                             │
│  │ ┌─────────────────┐ │                                             │
│  │ │ VForm.tsx       │ │                                             │
│  │ │ FormField.tsx   │ │                                             │
│  │ │ utilities/      │ │                                             │
│  │ └─────────────────┘ │                                             │
│  └──────────┬──────────┘                                             │
│             │                                                          │
│             │ Pattern reused by                                        │
│             ▼                                                          │
│  ┌─────────────────────────────────────┐                             │
│  │ nextjs-supabase-daas               │                             │
│  │ ┌─────────────────────────────────┐│                             │
│  │ │ DynamicForm.tsx                 ││                             │
│  │ │ (data-testid="dynamic-form")    ││                             │
│  │ ├─────────────────────────────────┤│                             │
│  │ │ - Loads fields from /api/fields ││                             │
│  │ │ - Tracks edits (DaaS pattern)│                             │
│  │ │ - Shows dirty indicator         ││                             │
│  │ │ - Renders FormField components  ││                             │
│  │ └─────────────────────────────────┘│                             │
│  └─────────────────────────────────────┘                             │
│             │                                                          │
│             │ Tested by                                                │
│             ▼                                                          │
│  ┌─────────────────────────────────────┐                             │
│  │ tests/ui-form/vform.spec.ts        │                             │
│  │ ├── Field Rendering (4 tests)      │                             │
│  │ ├── Field Types (4 tests)          │                             │
│  │ ├── State Management (2 tests)     │                             │
│  │ ├── Create Mode (4 tests)          │                             │
│  │ ├── Validation (2 tests)           │                             │
│  │ └── Layout (2 tests)               │                             │
│  └─────────────────────────────────────┘                             │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

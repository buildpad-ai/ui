# @buildpad/cli

A CLI for adding Buildpad components to your project.

[![npm version](https://img.shields.io/npm/v/@buildpad/cli)](https://www.npmjs.com/package/@buildpad/cli)

## Usage

Use the `init` command to set up a new project and the `add` command to add components.

```bash
npx @buildpad/cli init
npx @buildpad/cli add input select-dropdown
```

## init

Use the `init` command to initialize configuration and dependencies for a new project.

The `init` command creates a `buildpad.json` file, sets up directory structure, and checks for required dependencies.

```bash
npx @buildpad/cli init
```

### Options

```
Usage: buildpad init [options]

initialize your project and install dependencies

Options:
  -y, --yes       skip confirmation prompt (default: false)
  -c, --cwd <cwd> the working directory (defaults to current directory)
  -h, --help      display help for command
```

## add

Use the `add` command to add components to your project.

```bash
npx @buildpad/cli add [component]
```

### Options

```
Usage: buildpad add [options] [components...]

add components to your project

Arguments:
  components         name of components to add

Options:
  -a, --all          add all available components (default: false)
  --with-api         also add API routes and Supabase auth templates
  --category <name>  add all components from a category
  -o, --overwrite    overwrite existing files (default: false)
  -n, --dry-run      preview changes without modifying files
  --cwd <cwd>        the working directory (defaults to current directory)
  -h, --help         display help for command
```

### Examples

```bash
# Add specific components
npx @buildpad/cli add input
npx @buildpad/cli add input select-dropdown datetime

# Add collection-form (includes VForm + all 32 interface components)
npx @buildpad/cli add collection-form

# Add all components from a category
npx @buildpad/cli add --category selection

# Add all components
npx @buildpad/cli add --all
```

## list

Use the `list` command to view all available components.

```bash
npx @buildpad/cli list
```

### Options

```
Usage: buildpad list [options]

list available components

Options:
  --category <name>  filter by category
  --json             output as JSON
  -h, --help         display help for command
```

## bootstrap

Use the `bootstrap` command for full project setup in a single non-interactive command. Recommended for AI agents and CI/CD pipelines.

```bash
npx @buildpad/cli bootstrap
```

### Options

```
Usage: buildpad bootstrap [options]

Full project setup: init + add --all + install deps + validate (single command for AI agents)

Options:
  --cwd <cwd>          the working directory (defaults to current directory)
  --skip-deps          skip npm dependency installation
  --skip-validate      skip post-install validation
  --locales <codes>    locales for app/[lang], comma-separated (e.g. en,id); default: en
  --default-locale <code>  default locale (must be in --locales); default: the first one
  -h, --help           display help for command
```

### What Bootstrap Does

1. Creates `buildpad.json` and project skeleton (package.json, tsconfig, the `app/[lang]` root layout and home page, design tokens, locale routing in `lib/i18n/`)
2. Copies all 40+ UI components to `components/ui/`
3. Copies types, services, hooks to `lib/buildpad/`
4. Copies API proxy routes (fields, items, relations, files)
5. Copies auth proxy routes (login, logout, user, callback) + login page
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

## validate

Use the `validate` command to check your Buildpad installation for common issues.

```bash
npx @buildpad/cli validate
```

### Options

```
Usage: buildpad validate [options]

validate Buildpad installation (check imports, missing files, SSR issues)

Options:
  --json           output as JSON for CI/CD
  --cwd <cwd>      the working directory (defaults to current directory)
  -h, --help       display help for command
```

### What It Checks

- **Untransformed imports** - `@buildpad/*` imports that weren't converted to local paths
- **Missing lib files** - Required utility modules not present (types, services, hooks, utils)
- **Missing CSS files** - CSS required by rich text editors (RichTextHTML.css, InputBlockEditor.css)
- **SSR issues** - Components like InputBlockEditor exported without SSR-safe wrappers
- **Missing API routes** - DaaS integration routes for fields, items, permissions

### Example Output

```
✗ Found 2 error(s):

  ✗ src/components/ui/input.tsx:5
    Untransformed import: import { Field } from '@buildpad/types';

  ✗ lib/buildpad/interface-registry.ts
    Missing required file for utils module

⚠ Found 1 warning(s):

  ⚠ components/ui/index.ts
    InputBlockEditor exported directly may cause SSR errors. Use input-block-editor-wrapper instead.

💡 Suggestions:

  1. Fix 2 untransformed import(s) by running: pnpm cli add --all --overwrite --cwd .
  2. Update components/ui/index.ts to export InputBlockEditor from './input-block-editor-wrapper'
```

## diff

Use the `diff` command to preview changes before adding a component.

```bash
npx @buildpad/cli diff [component]
```

### Options

```
Usage: buildpad diff [options] <component>

preview changes before adding a component

Options:
  --cwd <cwd>      the working directory (defaults to current directory)
  -h, --help       display help for command
```

## status

Use the `status` command to view all installed Buildpad components and their origins.

```bash
npx @buildpad/cli status
```

### Options

```
Usage: buildpad status [options]

show installed Buildpad components and their origins

Options:
  --json           output as JSON
  --cwd <cwd>      the working directory (defaults to current directory)
  -h, --help       display help for command
```

### Example Output

```
📦 Buildpad Status

Config file: buildpad.json
Lib modules: types, hooks, services
Components:  input, select-dropdown, list-m2m

Installed Files:

  @buildpad/ui-interfaces/input
    └─ src/components/ui/input.tsx
       v1.0.0 (2026-01-12)

  @buildpad/lib/hooks
    └─ src/lib/buildpad/hooks/useRelationM2M.ts
       v1.0.0 (2026-01-12)

Total: 15 files from Buildpad
```

## buildpad.json

The `buildpad.json` file holds configuration for your project. We use it to understand how your project is set up and how to generate components customized for your project.

You can create a `buildpad.json` file by running the `init` command.

```json
{
  "$schema": "https://buildpad.dev/schema.json",
  "model": "copy-own",
  "tsx": true,
  "srcDir": true,
  "aliases": {
    "components": "@/components/ui",
    "lib": "@/lib/buildpad"
  },
  "installedLib": [],
  "installedComponents": []
}
```

### tsx

Choose between TypeScript or JavaScript components.

Setting this option to `false` allows components to be added as JavaScript with the `.jsx` file extension.

```json
{
  "tsx": true | false
}
```

### srcDir

Whether your project uses the `src/` directory structure.

```json
{
  "srcDir": true | false
}
```

### aliases

The CLI uses these values to place generated components in the correct location.

```json
{
  "aliases": {
    "components": "@/components/ui",
    "lib": "@/lib/buildpad"
  }
}
```

Path aliases have to be set up in your `tsconfig.json` or `jsconfig.json` file:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### installedLib and installedComponents

These arrays track what has been installed. The CLI uses them to avoid reinstalling dependencies.

## What Gets Copied

When you add a component, the CLI:

1. **Copies the component source** to your components directory
2. **Copies required lib modules** (types, services, hooks) if needed
3. **Transforms imports** from `@buildpad/*` to local paths
4. **Reports missing dependencies** that need to be installed

### Example: Adding `list-m2m`

```bash
npx @buildpad/cli add list-m2m
```

This copies:
- `components/ui/list-m2m.tsx` - The component
- `lib/buildpad/types/` - Type definitions
- `lib/buildpad/services/` - CRUD services
- `lib/buildpad/hooks/` - React hooks

### Import Transformation

Original (in source):
```tsx
import { useRelationM2M } from '@buildpad/hooks';
import type { M2MItem } from '@buildpad/types';
```

Transformed (in your project):
```tsx
import { useRelationM2M } from '@/lib/buildpad/hooks';
import type { M2MItem } from '@/lib/buildpad/types';
```

## Component Categories

| Category | Components |
|----------|------------|
| `input` | Input, Textarea, InputCode, InputBlockEditor, Tags |
| `selection` | SelectDropdown, SelectRadio, SelectMultipleCheckbox, SelectIcon, AutocompleteAPI, CollectionItemDropdown |
| `datetime` | DateTime |
| `boolean` | Boolean, Toggle |
| `media` | FileInterface, FileImage, Files, Upload, Color |
| `relational` | ListM2M, ListM2O, ListO2M, ListM2A |
| `layout` | Divider, Notice, GroupDetail, Slider |
| `rich-text` | RichTextHtml, RichTextMarkdown |
| `collection` | VForm, CollectionForm, CollectionList |

### VForm and CollectionForm

When you add `collection-form`, it automatically includes:
- **VForm** - Dynamic form component that renders any field type
- **32 interface components** - All field types (input, select, datetime, M2M, M2O, etc.)
- **Lib modules** - types, services, hooks, and field-interface-mapper utilities

This is because `collection-form` has `registryDependencies: ["vform"]` and VForm has dependencies on all interface components.

## Peer Dependencies

Components require these external packages:

**Core (always needed):**
```bash
pnpm add @mantine/core @mantine/hooks react react-dom
```

**Component-specific:**
```bash
# DateTime component
pnpm add @mantine/dates dayjs

# Icon components
pnpm add @tabler/icons-react

# File upload
pnpm add @mantine/dropzone

# CollectionForm notifications
pnpm add @mantine/notifications

# Rich text editor
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

**Utils (optional, for cn() helper):**
```bash
pnpm add clsx tailwind-merge
```

## Project Structure After Installation

```
your-project/
├── app/
│   ├── api/
│   │   ├── auth/                        # Auth proxy routes
│   │   │   ├── login/route.ts           # POST - Supabase login
│   │   │   ├── logout/route.ts          # POST - Sign out
│   │   │   ├── user/route.ts            # GET - Current user info
│   │   │   └── callback/route.ts        # GET - OAuth callback
│   │   ├── fields/[collection]/route.ts # Fields proxy
│   │   ├── items/[collection]/route.ts  # Items proxy
│   │   └── ...
│   └── login/page.tsx                   # Login page template
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── input.tsx
│   │       ├── select-dropdown.tsx
│   │       └── datetime.tsx
│   └── lib/
│       ├── buildpad/
│       │   ├── utils.ts
│       │   ├── types/
│       │   │   ├── index.ts
│       │   │   ├── core.ts
│       │   │   ├── file.ts
│       │   │   └── relations.ts
│       │   ├── services/
│       │   │   ├── index.ts
│       │   │   ├── api-request.ts
│       │   │   ├── items.ts
│       │   │   ├── fields.ts
│       │   │   └── collections.ts
│       │   └── hooks/
│       │       ├── index.ts
│       │       ├── useRelationM2M.ts
│       │       ├── useRelationM2O.ts
│       │       └── ...
│       ├── api/auth-headers.ts          # Auth header utilities
│       └── supabase/                    # Supabase client utilities
│           ├── server.ts
│           └── client.ts
├── middleware.ts                         # Auth middleware
├── buildpad.json
└── package.json
```

## CLI Commands Reference

```bash
# Initialize project
buildpad init [--yes] [--cwd <path>] [--locales en,id] [--default-locale en]

# Bootstrap full project (init + add all + deps + validate)
buildpad bootstrap [--cwd <path>] [--skip-deps] [--skip-validate] [--locales en,id] [--default-locale en]

# Move an app scaffolded before 2.3 onto locale-prefixed app/[lang] routing
buildpad migrate i18n [--cwd <path>] [--locales en,id] [--dry-run]

# Add components
buildpad add [components...] [--all] [--category <name>] [--overwrite] [--cwd <path>]

# List components
buildpad list [--category <name>] [--json]

# Preview changes
buildpad diff <component> [--cwd <path>]

# Validate installation
buildpad validate [--json] [--cwd <path>]

# Check installed components
buildpad status [--json] [--cwd <path>]

# Component info and dependency tree
buildpad info <component> [--json]
buildpad tree <component> [--json] [--depth <n>]

# Auto-fix common issues
buildpad fix [--dry-run] [--yes] [--cwd <path>]

# Check for component updates
buildpad outdated [--json] [--cwd <path>]
```

## Troubleshooting

### "Registry file not found"

Make sure you're running the CLI from within the Buildpad workspace or have the registry properly configured.

### "buildpad.json not found"

Run `npx @buildpad/cli init` first to initialize your project.

### Import errors after adding components

Ensure your `tsconfig.json` has the correct path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Development

Build the CLI:

```bash
cd packages/cli
pnpm build
```

Run in development:

```bash
pnpm dev
```

Test locally:

```bash
node dist/index.js init
node dist/index.js add input
```

## License

MIT

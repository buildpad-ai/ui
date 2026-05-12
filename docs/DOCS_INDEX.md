# Buildpad UI Packages Documentation Index

Complete guide to Buildpad UI Packages and distribution tools.

## 📚 Documentation Overview

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](../README.md) | Workspace overview and quick start | All users |
| [QUICKSTART.md](../QUICKSTART.md) | Setup guide for MCP & CLI | New users |
| [CLI.md](CLI.md) | CLI commands & agent reference | AI agents & developers |
| [COMPONENT_MAP.md](COMPONENT_MAP.md) | Quick component lookup table | AI agents & developers |
| [DISTRIBUTION.md](DISTRIBUTION.md) | Complete distribution guide + Amplify hosting | DevOps/Teams |
| [PUBLISHING.md](PUBLISHING.md) | npm publishing & release workflow | DevOps/Maintainers |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagrams | Technical users |
| [TESTING.md](TESTING.md) | Playwright E2E testing guide | Developers |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Token-based theming architecture | Designers, Developers |

## 🤖 For AI Agents

These documents are optimized for AI agent consumption:

| Document | Use Case |
|----------|----------|
| [CLI.md](CLI.md) | Complete CLI command reference, component locations, dependency trees |
| [COMPONENT_MAP.md](COMPONENT_MAP.md) | Quick lookup table for finding component source files |
| [registry.json](../packages/registry.json) | Master registry with all component metadata (JSON) |

### Quick Agent Commands
```bash
buildpad list --json          # Get all components as JSON
buildpad info <component>     # Detailed component info
buildpad tree <component>     # Show dependency tree
buildpad add <component>      # Add component with all dependencies
buildpad bootstrap            # Full setup: init + add --all + deps + validate
buildpad validate             # Check for common installation issues
buildpad validate --json      # JSON output for CI/CD
```

## 🎯 Quick Navigation

### Getting Started
- [Installation](../README.md#-quick-start) - Install dependencies and build
- [Quick Start](../QUICKSTART.md) - Set up MCP server or CLI
- [Packages Overview](../packages/README.md) - Available packages

### For Developers
- [CLI Tool Guide](../packages/cli/README.md) - Use CLI to add components
- [CLI Command Reference](CLI.md) - All CLI commands with examples
- [Component Map](COMPONENT_MAP.md) - Find component source files
- [Usage Examples](../packages/README.md#quick-start) - Code examples

### For AI Development
- [MCP Server Setup](../QUICKSTART.md#-setup-mcp-server-for-vs-code-copilot) - VS Code Copilot integration
- [MCP Documentation](../packages/mcp-server/README.md) - MCP server details (`@buildpad/mcp` on npm)
- [Available Tools](../packages/mcp-server/README.md#available-tools) - AI tools reference

### For Teams
- [Distribution Methods](DISTRIBUTION.md#distribution-methods) - How to distribute
- [Comparison Matrix](DISTRIBUTION.md#comparison-matrix) - Choose the right method
- [Security](DISTRIBUTION.md#security-considerations) - Keep code private

### Technical Reference
- [Architecture](ARCHITECTURE.md) - System diagrams
- [Registry](../packages/registry.json) - Component metadata
- [Build Commands](../README.md#-workspace-commands) - Build instructions

## 📦 Package Documentation

| Package | Description | Documentation |
|---------|-------------|---------------|
| @buildpad/types | TypeScript types | [README](../packages/types/README.md) |
| @buildpad/services | CRUD services, DaaSProvider, apiRequest, auth module (session, permissions, filters) | [README](../packages/services/README.md) |
| @buildpad/hooks | React hooks (useAuth, usePermissions, useDaaSContext, relations, field metadata, files, versioning, workflow) | [README](../packages/hooks/README.md) |
| @buildpad/utils | Field interface mapper & utilities | [README](../packages/utils/README.md) |
| @buildpad/ui-interfaces | Field components (40+) | [README](../packages/ui-interfaces/README.md) |
| @buildpad/ui-collections | Collection components (Form, List, Layout, Navigation, Filter, SaveOptions) | [README](../packages/ui-collections/README.md) |
| @buildpad/ui-form | VForm - Dynamic form with permission enforcement | [README](../packages/ui-form/README.md) |
| @buildpad/ui-table | VTable - Dynamic table with sorting, selection, drag-drop | [README](../packages/ui-table/README.md) |
| @buildpad/mcp | MCP server (`@buildpad/mcp` on npm) | [README](../packages/mcp-server/README.md) |
| @buildpad/cli | CLI tool (`@buildpad/cli` on npm) | [README](../packages/cli/README.md) |
| storybook-host | Next.js auth proxy & Storybook host (Amplify) | [apps/storybook-host](../apps/storybook-host) |

## 🚀 Common Tasks

### Setup Tasks

| Task | Command | Documentation |
|------|---------|---------------|
| Install dependencies | `pnpm install` | [README.md](../README.md#setup) |
| Build all packages | `pnpm build` | [README.md](../README.md#development) |
| Build MCP server | `pnpm build:mcp` | [QUICKSTART.md](../QUICKSTART.md#step-1-build-the-mcp-server) |
| Build CLI tool | `pnpm build:cli` | [QUICKSTART.md](../QUICKSTART.md#option-1-use-from-workspace-development) |
| Run Storybook | `pnpm storybook` | [packages/README.md](../packages/README.md#storybook) |
| Run VForm Storybook | `pnpm storybook:form` | [TESTING.md](TESTING.md#storybook-stories) |
| Run VTable Storybook | `pnpm storybook:table` | [TESTING.md](TESTING.md#vtable-component-testing) |
| Run Collections Storybook | `pnpm storybook:collections` | [TESTING.md](TESTING.md) |
| Start Storybook host | `pnpm dev:host` | [DISTRIBUTION.md](DISTRIBUTION.md#hosting-storybook-on-aws-amplify) |
| Build Storybook host | `pnpm build:host` | [DISTRIBUTION.md](DISTRIBUTION.md#hosting-storybook-on-aws-amplify) |
| Run VTable Storybook tests | `pnpm test:storybook:table` | [TESTING.md](TESTING.md#vtable-component-testing) |
| Run VForm with DaaS proxy | See [TESTING.md](TESTING.md#daas-playground-authentication) | [TESTING.md](TESTING.md) |
| Install Playwright | `pnpm exec playwright install chromium` | [TESTING.md](TESTING.md#prerequisites) |

### Development Tasks

| Task | Command | Documentation |
|------|---------|---------------|
| Start dev servers | `pnpm dev` | [README.md](../README.md#development) |
| MCP dev mode | `pnpm mcp:dev` | [QUICKSTART.md](../QUICKSTART.md#-development-workflow) |
| Run CLI locally | `pnpm cli list` | [QUICKSTART.md](../QUICKSTART.md#test-cli) |
| Type check | `pnpm -r typecheck` | [packages/README.md](../packages/README.md#scripts) |
| Run E2E tests | `pnpm test:e2e` | [TESTING.md](TESTING.md#running-tests) |
| Run E2E tests (UI) | `pnpm test:e2e:ui` | [TESTING.md](TESTING.md#running-tests) |

### Distribution Tasks

| Task | Command | Documentation |
|------|---------|---------------|
| List components | `buildpad list` | [packages/cli/README.md](../packages/cli/README.md#list) |
| Add component | `buildpad add input` | [packages/cli/README.md](../packages/cli/README.md#add) |
| Initialize project | `buildpad init` | [packages/cli/README.md](../packages/cli/README.md#init) |
| Bootstrap project | `buildpad bootstrap` | [CLI.md](CLI.md#bootstrap-command-recommended-for-ai-agents) |
| Check status | `buildpad status` | [packages/cli/README.md](../packages/cli/README.md#status) |
| Validate installation | `buildpad validate` | [packages/cli/README.md](../packages/cli/README.md#validate) |

## 🎨 Component Categories

### Input Components
- [Input](../packages/README.md#buildpadui-interfaces) - Text input with validation
- [Textarea](../packages/README.md#buildpadui-interfaces) - Multi-line text
- [InputCode](../packages/README.md#buildpadui-interfaces) - Code editor
- [Tags](../packages/README.md#buildpadui-interfaces) - Tag input

### Selection Components
- [SelectDropdown](../packages/README.md#buildpadui-interfaces) - Dropdown select
- [SelectRadio](../packages/README.md#buildpadui-interfaces) - Radio buttons
- [SelectMultipleCheckbox](../packages/README.md#buildpadui-interfaces) - Checkboxes
- [SelectIcon](../packages/README.md#buildpadui-interfaces) - Icon picker
- [AutocompleteAPI](../packages/README.md#buildpadui-interfaces) - API autocomplete
- [CollectionItemDropdown](../packages/README.md#buildpadui-interfaces) - Item selector

### Media Components
- [File](../packages/README.md#buildpadui-interfaces) - Single file with DaaS integration
- [FileImage](../packages/README.md#buildpadui-interfaces) - Image picker with preview, crop, and lightbox
- [Files](../packages/README.md#buildpadui-interfaces) - Multi-file upload (M2M relationship)
- [Upload](../packages/README.md#buildpadui-interfaces) - Low-level drag-drop upload zone
- [Color](../packages/README.md#buildpadui-interfaces) - Color picker

### Relational Components
- [ListM2M](../packages/README.md#buildpadui-interfaces) - Many-to-Many
- [SelectDropdownM2O](../packages/README.md#buildpadui-interfaces) - Many-to-One
- [ListO2M](../packages/README.md#buildpadui-interfaces) - One-to-Many
- [ListM2A](../packages/README.md#buildpadui-interfaces) - Many-to-Any

### Workflow Components
- [WorkflowButton](../packages/README.md#buildpadui-interfaces) - State transitions with policy-based commands

### Rich Text Components
- [InputBlockEditor](../packages/README.md#buildpadui-interfaces) - Block-based editor using EditorJS (SSR-safe wrapper)
- [RichTextHTML](../packages/README.md#buildpadui-interfaces) - WYSIWYG HTML editor (TipTap)
- [RichTextMarkdown](../packages/README.md#buildpadui-interfaces) - Markdown editor with preview

### Map / Geometry Components
- [Map](../packages/README.md#buildpadui-interfaces) - Geometry input with map preview
- [MapWithRealMap](../packages/README.md#buildpadui-interfaces) - Full MapLibre implementation

### Collection Components
- [CollectionForm](../packages/README.md#buildpadui-collections) - CRUD wrapper using VForm
- [CollectionList](../packages/README.md#buildpadui-collections) - Dynamic list/table
- [ContentLayout](../packages/ui-collections/README.md) - Shell layout with sidebar and main content
- [ContentNavigation](../packages/ui-collections/README.md) - Hierarchical collection navigation
- [FilterPanel](../packages/ui-collections/README.md) - Field-type-aware filter builder
- [SaveOptions](../packages/ui-collections/README.md) - Save action dropdown menu

### Form Components
- [VForm](../packages/ui-form/README.md) - Dynamic form that renders all 40+ interface types

[See all 40+ components →](../packages/README.md#buildpadui-interfaces)

## 🔍 How-To Guides

### Setup Guides
1. [Set up MCP Server for VS Code](../QUICKSTART.md#-setup-mcp-server-for-vs-code-copilot)
2. [Set up CLI Tool](../QUICKSTART.md#-setup-cli-tool-for-development)
3. [Initialize a New Project](../packages/cli/README.md#initialize-buildpad-in-your-project)
4. [Configure Path Aliases](../packages/cli/README.md#configuration)

### Usage Guides
1. [Add Components to Project](../packages/cli/README.md#add-components)
2. [Use with VS Code Copilot](../packages/mcp-server/README.md#usage-with-copilot)
3. [Build Custom Forms](../packages/README.md#5-use-dynamic-collection-components)
4. [Manage Relations](../packages/README.md#3-use-relation-hooks)

### Distribution Guides
1. [Choose Distribution Method](DISTRIBUTION.md#comparison-matrix)
2. [npm Publishing Workflow](PUBLISHING.md) - Versioning & release with changesets
3. [Set up GitHub Packages](DISTRIBUTION.md#4-github-packages-private-npm-registry)
4. [Use Git URLs](DISTRIBUTION.md#3-private-git-repository)
5. [Share with Team](DISTRIBUTION.md#recommended-setup)

### Troubleshooting
1. [MCP Server Issues](../QUICKSTART.md#mcp-server-issues)
2. [CLI Issues](../QUICKSTART.md#cli-issues)
3. [Build Problems](../QUICKSTART.md#-troubleshooting)
4. [Type Errors](DISTRIBUTION.md#type-errors-after-install)
5. [E2E Test Issues](TESTING.md#troubleshooting)

## 🎓 Learning Path

### For New Users
1. Read [README.md](../README.md) - Understand the workspace
2. Follow [QUICKSTART.md](../QUICKSTART.md) - Set up your first tool
3. Explore [packages/README.md](../packages/README.md) - Learn about packages
4. Try examples in package documentation

### For Developers
1. Read [packages/README.md](../packages/README.md) - Understand packages
2. Set up [CLI Tool](../QUICKSTART.md#-setup-cli-tool-for-development)
3. Add components to a project
4. Customize and build

### For AI-Assisted Development
1. Read [MCP Server README](../packages/mcp-server/README.md)
2. Set up [VS Code Copilot](../QUICKSTART.md#-setup-mcp-server-for-vs-code-copilot)
3. Ask Copilot to help build features
4. Iterate with AI assistance

### For Teams
1. Read [DISTRIBUTION.md](DISTRIBUTION.md) - Understand options
2. Choose distribution method
3. Set up infrastructure
4. Document for team

## 🏗️ Architecture

```
Buildpad Architecture

┌─────────────────────────────────────┐
│      Distribution Layer             │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ MCP Server  │  │  CLI Tool    │ │
│  │ (AI agents) │  │ (Developers) │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Component Layer                │
│  ┌───────────────────────────────┐  │
│  │  ui-interfaces (40+ components)│ │
│  │  ui-form (VForm dynamic form) │  │
│  │  ui-collections (Form & List) │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Logic Layer                    │
│  ┌────────┐ ┌──────────┐ ┌───────┐ │
│  │ hooks  │ │ services │ │ types │ │
│  └────────┘ └──────────┘ └───────┘ │
└─────────────────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│      Testing Layer                  │
│  ┌────────────────────────────────┐ │
│  │ Playwright E2E (Storybook+DaaS)│ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

[See detailed architecture →](ARCHITECTURE.md)

## 📖 External Resources

### Related Projects
- [buildpad-copilot](https://github.com/your-org/buildpad-copilot) - RAD platform boilerplate with agents, prompts, and templates
- [nextjs-supabase-daas](https://github.com/your-org/nextjs-supabase-daas) - DaaS backend server

### Related Documentation
- [DaaS Documentation](https://docs.daas.io) - Backend API reference
- [Mantine Documentation](https://mantine.dev) - UI component library
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [pnpm Workspaces](https://pnpm.io/workspaces) - Workspace documentation

### Inspiration
- [shadcn/ui](https://ui.shadcn.com) - CLI-based component distribution
- [DaaS](https://daas.io) - Headless CMS
- [VS Code Copilot](https://code.visualstudio.com/docs/copilot/overview) - AI assistant

## 🤝 Contributing

### Development Setup
1. Clone repository
2. Run `pnpm install`
3. Build packages: `pnpm build:packages`
4. Make changes
5. Test: `pnpm cli list` or test MCP

### Adding New Components
1. Create component in `packages/ui-interfaces/src/`
2. Add to registry: `packages/registry.json`
3. Export from `packages/ui-interfaces/src/index.ts`
4. Rebuild: `pnpm build:mcp && pnpm build:cli`
5. Test with CLI and MCP

### Documentation
- Update relevant README files
- Add examples
- Update this index if needed

## 📞 Support

### Getting Help
1. Check [QUICKSTART.md](../QUICKSTART.md) for common setup issues
2. Review [Troubleshooting](../QUICKSTART.md#-troubleshooting)
3. Check package-specific README files
4. Review [DISTRIBUTION.md](DISTRIBUTION.md) for detailed guides

### Reporting Issues
- Document steps to reproduce
- Include error messages
- Specify environment (OS, Node version, etc.)
- Check existing documentation first

## 📝 Changelog

### Version 1.7.0 (April 2026)
- ✨ Field name translations — `FieldMeta.translations` typed as `Array<{language, translation}>` for multi-language display labels
- ✨ Collection translations — `CollectionMeta.translations` typed as `Array<{language, translation, singular, plural}>`
- ✨ New `getFieldDisplayName(field, locale?)` utility — resolves translated field labels with locale matching and fallback
- ✨ New `formatFieldTitle(fieldName)` utility — converts snake_case to Title Case
- ✨ VForm `FormField` now uses `getFieldDisplayName()` for label resolution (supports translated labels)

### Version 1.6.0 (March 2026)
- ✨ New `useRelationMultipleM2M` hook — fetches display items for M2M junctions with sorting/pagination
- ✨ New `useRelationPermissionsM2M` hook — checks create/update permissions on junction + related collection
- ✨ New `useFieldMetadata` hook — resolves field metadata for display templates in relational interfaces
- ✨ ListM2M upgraded to full-featured M2M interface with inline editing, permissions, and display templates
- ✨ ListM2M `translations.ts` — externalized UI strings for internationalization support
- 🔧 Registry schema `$schema` updated to GitHub raw CDN URL
- 🔧 Registry description clarified to "DaaS-compatible Nextjs frontends"
- 🔧 RichTextHTML now includes `@tiptap/extension-underline` dependency

### Version 1.5.0 (February 2026)
- ✨ VTable DaaS Playground stories (`VTable.daas.stories.tsx`) — connect to real DaaS and test with actual collection data
- ✨ CollectionForm & CollectionList DaaS Playground stories with mock data interceptors
- ✨ Storybook Host now serves storybooks via catch-all API route instead of static public/ serving
- 🔧 Updated Storybook titles and tags for consistency across all packages
- 🔧 Improved Amplify deployment: removed standalone output, let Amplify handle Next.js natively
- 🔧 Added `pnpm test:storybook:table` root script
- 🔧 Playwright config now defines 4 projects: setup, chromium, storybook, storybook-table
- 🔧 Auto-starts both VForm (6006) and VTable (6007) Storybooks for tests

### Version 1.4.0 (February 2026)
- ✨ New `apps/storybook-host` Next.js app — DaaS auth proxy & Storybook host for AWS Amplify
- ✨ Runtime DaaS credential input (no more env vars) with AES-256-GCM encrypted cookies
- ✨ Storybook 10 migration with `@storybook/nextjs-vite` across all 4 packages
- ✨ New `ui-collections` Storybook (port 6005)
- ✨ Workspace now includes `apps/*` alongside `packages/*`
- 🔧 Storybook configs simplified — removed DaaS env var proxy, replaced with host app proxy
- 🔧 DaaSProvider updated for proxy-mode autoFetchUser
- 🔧 Amplify deployment updated: serves Next.js app (not static storybook-dist/)
- 🔧 New root scripts: `dev:host`, `build:host`, `start:host`, `storybook:collections`

### Version 1.3.0 (February 2026)
- ✨ Published `@buildpad/cli` and `@buildpad/mcp` to npm
- ✨ Remote registry resolver — CLI fetches components from GitHub CDN when installed via npm
- ✨ Renamed `@buildpad/mcp-server` to `@buildpad/mcp`
- ✨ Changesets-based versioning and release workflow
- ✨ GitHub Actions CI + automated npm publish workflows
- ✨ `PUBLISHING.md` documentation for release process
- 🔧 CLI auto-detects local vs remote mode (monorepo dev vs npm install)

### Version 1.2.0 (February 2026)
- ✨ New `bootstrap` CLI command (init + add --all + deps + validate in one step)
- ✨ Auth proxy routes (login, logout, user, OAuth callback) + login page template
- ✨ `get_rbac_pattern` MCP tool for generating RBAC setup sequences
- ✨ Non-interactive mode for `add` command (used by bootstrap)
- ✨ Supabase SSR auth integration (`@supabase/ssr`)
- ✨ New root dependencies: `@mantine/form`, TipTap extensions, `axios`, `lowlight`
- 🔧 Improved `validate` command with `noExit` option and return value
- 🔧 Updated registry: api-routes now includes auth routes
- 🔧 Fixed ESM/CJS type exports in `@buildpad/utils`

### Version 1.1.0 (January 2026)
- ✨ New `@buildpad/ui-form` package with VForm component (DaaS-inspired)
- ✅ Playwright E2E testing infrastructure
- ✅ Authentication setup for tests
- ✅ 19 comprehensive VForm tests
- ✅ TESTING.md documentation

### Version 1.0.0 (January 2026)
- ✨ Initial release
- ✅ MCP server for AI agents
- ✅ CLI tool for developers
- ✅ Component registry (35+ components)
- ✅ Complete documentation
- ✅ Multiple distribution methods
- ✅ Integration with buildpad-copilot RAD platform
- ✅ WorkflowButton with revision comparison
- ✅ Jest testing setup for ui-interfaces

---

**Quick Links:**
- [Get Started](../QUICKSTART.md) | [Packages](../packages/README.md) | [Architecture](ARCHITECTURE.md)
- [MCP Server](../packages/mcp-server/README.md) | [CLI Tool](../packages/cli/README.md) | [Distribution](DISTRIBUTION.md)

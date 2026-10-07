#!/usr/bin/env node
/**
 * Buildpad MCP Server
 * 
 * Exposes Buildpad components to AI agents via the Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  PACKAGES,
  getAllComponents,
  getAllLibModules,
  getComponent,
  getComponentsByCategory,
  getCategories,
  getRegistry,
  getLibModule,
  type ComponentMetadata,
} from './registry.js';
import {
  fetchChangelogContent,
  changelogSince,
} from './versioning.js';
import {
  createSourceResolver,
  detectSourceRoot,
  registryFilesOf,
  type MissingSource,
  type SourceResolver,
} from './sources.js';
import {
  buildUpgradeCommand,
  entryStatus,
  installedEntries,
  isAhead,
  fileStatuses,
  readConsumerConfig,
  recommendedAction,
  staleLibDependencies,
  validateApplyUpgradeArgs,
} from './upgrade.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * This package's version, read from package.json so it never drifts from the
 * published version. Under lockstep releases it is also the @buildpad/cli
 * release whose registry this server embeds.
 */
const MCP_VERSION = (JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
) as { version: string }).version;

/** How to run the CLI in guidance text. It is published on npm. */
const CLI = 'npx @buildpad/cli';

/**
 * Where component sources are read from: the monorepo `packages/` directory
 * when running from a checkout, otherwise the `dist/sources` bundle that ships
 * in the npm package. See sources.ts.
 */
let sourceResolver: SourceResolver = createSourceResolver(detectSourceRoot(__dirname));

/**
 * Replace the source resolver, for tests and embedders. Returns the previous
 * one so it can be restored.
 */
export function setSourceResolver(next: SourceResolver): SourceResolver {
  const previous = sourceResolver;
  sourceResolver = next;
  return previous;
}

/**
 * The tool result for sources that could not be read. Returned instead of
 * empty or placeholder content, so an agent never copies an empty file list.
 */
function missingSourcesResult(name: string, missing: MissingSource[]) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: missing.length > 0
          ? `Source code for "${name}" is not available: ${missing.length} file(s) could not be read from ${sourceResolver.describe()}.`
          : `The registry lists no source files for "${name}".`,
        name,
        missingSources: missing,
        sourceRoot: sourceResolver.root,
        hint:
          `Install it with the CLI instead (${CLI} add ${name}), which fetches the sources itself. ` +
          `If this server came from npm, its bundled sources are incomplete: reinstall it (npx -y @buildpad/mcp@${MCP_VERSION}).`,
      }, null, 2),
    }],
  };
}

/**
 * Generate component usage example
 * Uses Copy & Own style - components are imported from local project paths
 */
function generateUsageExample(component: ComponentMetadata): string {
  const examples: Record<string, string> = {
    Input: `// Copy & Own: add the component to your project first (run in the project root):
// ${CLI} add input
import { Input } from '@/components/ui/input';

function MyForm() {
  const [value, setValue] = useState('');

  return (
    <Input
      field="title"
      value={value}
      onChange={setValue}
      placeholder="Enter title"
      required
    />
  );
}`,
    SelectDropdown: `// Copy & Own: ${CLI} add select-dropdown
import { SelectDropdown } from '@/components/ui/select-dropdown';

function StatusSelect() {
  const [status, setStatus] = useState('draft');

  return (
    <SelectDropdown
      field="status"
      value={status}
      onChange={setStatus}
      choices={[
        { text: 'Draft', value: 'draft' },
        { text: 'Published', value: 'published' },
        { text: 'Archived', value: 'archived' },
      ]}
    />
  );
}`,
    DateTime: `// Copy & Own: ${CLI} add datetime
import { DateTime } from '@/components/ui/datetime';

function EventForm() {
  const [date, setDate] = useState<string | null>(null);

  return (
    <DateTime
      field="event_date"
      value={date}
      onChange={setDate}
      type="datetime"
      label="Event Date & Time"
    />
  );
}`,
    Toggle: `// Copy & Own: ${CLI} add toggle
import { Toggle } from '@/components/ui/toggle';

function FeatureToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <Toggle
      field="featured"
      value={enabled}
      onChange={setEnabled}
      label="Featured Product"
      iconOn="IconStar"
      iconOff="IconStarOff"
    />
  );
}`,
    CollectionForm: `// Copy & Own: ${CLI} add collection-form
import { CollectionForm } from '@/components/ui/collection-form';

function ProductEditor({ productId }: { productId?: string }) {
  return (
    <CollectionForm
      collection="products"
      id={productId}
      mode={productId ? 'edit' : 'create'}
      onSuccess={(data) => console.log('Saved:', data)}
      excludeFields={['internal_notes']}
    />
  );
}`,
    CollectionList: `// Copy & Own: ${CLI} add collection-list
import { CollectionList } from '@/components/ui/collection-list';

function ProductList() {
  return (
    <CollectionList
      collection="products"
      fields={['title', 'status', 'price', 'created_at']}
      enableSelection
      enableSearch
      onItemClick={(item) => router.push(\`/products/\${item.id}\`)}
    />
  );
}`,
  };

  return examples[component.name] || examples[component.title] || `// Copy & Own model: this component is copied into your project.
// Add it first (run in the project root), then import it from your components directory:
// ${CLI} add ${component.name}

import { ${component.title} } from '@/components/ui/${component.name}';

function Example() {
  const [value, setValue] = useState(null);

  return (
    <${component.title}
      field="fieldName"
      value={value}
      onChange={setValue}
    />
  );
}`;
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: 'buildpad-mcp-server',
    // Read the version from package.json so it never drifts from the published version
    version: (JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string }).version,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List all available resources (packages and components)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  // Add package resources
  for (const pkg of PACKAGES) {
    resources.push({
      uri: `buildpad://packages/${pkg.name}`,
      name: pkg.name,
      description: pkg.description,
      mimeType: 'application/json',
    });
  }

  // Add component resources
  for (const component of getAllComponents()) {
    resources.push({
      uri: `buildpad://components/${component.name}`,
      name: component.title,
      description: `${component.description} (${component.category})`,
      mimeType: 'text/plain',
    });
  }

  return { resources };
});

/**
 * Read resource content (package info or component source). Exported so it
 * can be tested without the stdio transport.
 */
export async function handleReadResourceRequest(request: { params: { uri: string } }) {
  const uri = request.params.uri;

  // Handle package info requests
  if (uri.startsWith('buildpad://packages/')) {
    const packageName = uri.replace('buildpad://packages/', '');
    const pkg = PACKAGES.find(p => p.name === packageName);

    if (!pkg) {
      throw new Error(`Package not found: ${packageName}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(pkg, null, 2),
        },
      ],
    };
  }

  // Handle component source requests: the entry's first (primary) file
  if (uri.startsWith('buildpad://components/')) {
    const componentName = uri.replace('buildpad://components/', '');
    const component = getComponent(componentName);
    const libModule = component ? undefined : getLibModule(componentName);

    if (!component && !libModule) {
      throw new Error(`Component not found: ${componentName}`);
    }

    const primary = component ? component.files[0] : registryFilesOf(libModule!)[0];
    const source = primary ? sourceResolver.read(primary.source) : null;

    if (source === null) {
      const missingSources = primary ? [{ source: primary.source, target: primary.target }] : [];
      throw new McpError(
        ErrorCode.InternalError,
        primary
          ? `Source file for "${componentName}" is not available: ${primary.source} could not be read from ${sourceResolver.describe()}.`
          : `The registry lists no source files for "${componentName}".`,
        { missingSources, sourceRoot: sourceResolver.root },
      );
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: source,
        },
      ],
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

server.setRequestHandler(ReadResourceRequestSchema, handleReadResourceRequest);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_components',
        description: 'List all available Buildpad components with metadata',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category (input, selection, datetime, boolean, media, relational, layout, rich-text)',
              enum: getCategories(),
            },
          },
        },
      },
      {
        name: 'get_component',
        description: 'Get detailed information and source code for a specific component',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Component name (e.g., Input, SelectDropdown, CollectionForm)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'get_usage_example',
        description: 'Get a usage example for a component',
        inputSchema: {
          type: 'object',
          properties: {
            component: {
              type: 'string',
              description: 'Component name',
            },
          },
          required: ['component'],
        },
      },
      {
        name: 'generate_form',
        description: 'Generate a CollectionForm component with specified configuration',
        inputSchema: {
          type: 'object',
          properties: {
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to include in the form',
            },
            mode: {
              type: 'string',
              enum: ['create', 'edit'],
              description: 'Form mode',
            },
          },
          required: ['collection'],
        },
      },
      {
        name: 'generate_interface',
        description: 'Generate code for a field interface component',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Interface type (input, select-dropdown, datetime, toggle, etc.)',
            },
            field: {
              type: 'string',
              description: 'Field name',
            },
            props: {
              type: 'object',
              description: 'Additional props for the component',
            },
          },
          required: ['type', 'field'],
        },
      },
      {
        name: 'list_packages',
        description: 'List all Buildpad packages with their exports',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_install_command',
        description: 'Get the CLI command to install components using Copy & Own model. Returns the exact command to run.',
        inputSchema: {
          type: 'object',
          properties: {
            components: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of component names to install (e.g., ["input", "select-dropdown", "datetime"])',
            },
            category: {
              type: 'string',
              description: 'Install all components from a category instead',
              enum: ['input', 'selection', 'datetime', 'boolean', 'media', 'relational', 'layout', 'rich-text', 'collection'],
            },
            all: {
              type: 'boolean',
              description: 'Install all available components',
            },
          },
        },
      },
      {
        name: 'get_copy_own_info',
        description: 'Get information about the Copy & Own distribution model and how to use it',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'copy_component',
        description: 'Get complete source code and file structure to manually copy a component into your project (shadcn-style). Returns the full implementation code, target paths, and required dependencies. Sources are returned as published, with @buildpad/* imports; the CLI (`npx @buildpad/cli add <name>`) rewrites those to your project paths. Returns isError with a missingSources list if any file cannot be read.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Component name (e.g., "datetime", "input", "select-dropdown")',
            },
            includeLib: {
              type: 'boolean',
              description: 'Also include the lib modules (types, services, hooks, utils, ...) the component depends on, directly or through other lib modules. Defaults to true.',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_lib_modules',
        description: 'List all available CLI lib modules (e.g. external-oauth, supabase-auth, api-routes) that can be added via `buildpad add <name>`. These are infrastructure/auth modules, separate from UI components.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_rbac_pattern',
        description: 'Get RBAC (Role-Based Access Control) setup patterns for DaaS applications. Returns complete MCP tool call sequences to set up roles, policies, access, and permissions with dynamic variables. Covers collection CRUD only — for non-CRUD capability gates (buttons, pages, workflow transitions) use get_module_access_pattern.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              enum: ['own_items', 'role_hierarchy', 'public_read', 'multi_tenant', 'full_crud', 'read_only'],
              description: 'RBAC pattern to generate. own_items: users manage their own records. role_hierarchy: Admin>Editor>Viewer cascading. public_read: public read + authenticated write. multi_tenant: org-level isolation. full_crud: unrestricted CRUD. read_only: read-only access.',
            },
            collections: {
              type: 'array',
              items: { type: 'string' },
              description: 'Collection names to apply the pattern to (e.g., ["articles", "categories"])',
            },
            roleName: {
              type: 'string',
              description: 'Role name for single-role patterns (e.g., "Editor")',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'get_module_access_pattern',
        description: 'Get the Module-Level Access setup sequence — application capability flags (e.g. "reports:export") that are NOT tied to a collection. Use for any gate that collection CRUD permissions cannot express: showing a button, page, section, or nav item to some users, or restricting a workflow transition. Returns tool calls to register keys in daas_module_access_keys and grant them on a policy, plus the client, server, and workflow guard patterns. NEVER gate on role names — this is the sanctioned mechanism.',
        inputSchema: {
          type: 'object',
          properties: {
            keys: {
              type: 'array',
              description: 'Capability keys to register. Format <domain>:<capability>, lowercase, matching ^[a-z][a-z0-9_:./-]*$. The system: and workflow: namespaces are reserved.',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'The capability key, e.g. "reports:export"' },
                  display_name: { type: 'string', description: 'Label shown in the Policy editor' },
                  description: { type: 'string', description: 'What the key grants' },
                },
                required: ['key'],
              },
            },
            folder: {
              type: 'string',
              description: 'Optional folder name to group the keys under in the Policy editor (creates a node with key=null)',
            },
            policyName: {
              type: 'string',
              description: 'Name of the policy the keys will be granted on (for the generated step description)',
            },
          },
        },
      },
      {
        name: 'get_package_versions',
        description: 'Get current versions for all Buildpad source packages from the registry. Returns a map of package name → { version, changelogUrl }.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_outdated',
        description: "List installed Buildpad components and lib modules (utils, services, hooks, ...) that have updates. Reads the consumer project's buildpad.json and compares each file's recorded source hash with this server's registry. Each entry has kind 'component' or 'lib'.",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute path to the consumer project root (directory containing buildpad.json)',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'get_component_changelog',
        description: 'Get the changelog for a Buildpad source package or component. Fetches and returns the relevant CHANGELOG.md slice from the registry.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Package name (e.g. "@buildpad/ui-interfaces") or component name (e.g. "input")',
            },
            sinceVersion: {
              type: 'string',
              description: 'Only return entries newer than this version (e.g. "1.3.0")',
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'get_upgrade_plan',
        description: 'Dry-run upgrade plan: for each installed component and lib module shows the release delta, stale files, local-modification status per file (paths resolved the way the CLI writes them), and the recommended action. Naming a component also plans the outdated lib modules it depends on. Read-only — does not touch any consumer files.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute path to the consumer project root (directory containing buildpad.json)',
            },
            components: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific component or lib-module names to check. Omit to plan every installed component and lib module.',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'apply_upgrade',
        description: '⚠️ WRITE TOOL — Upgrade Buildpad components and lib modules in a consumer project by running `npx @buildpad/cli@<this server\'s version> upgrade`, so the CLI applies the same registry this server reports. Upgrading everything (omit components) is the safest path. For locally-modified files, strategy controls conflict resolution: "overwrite" replaces them, "new-file" writes a .new file, "three-way" attempts a 3-way merge. Refuses to run when the project was installed from a newer release than this server.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute path to the consumer project root (directory containing buildpad.json)',
            },
            components: {
              type: 'array',
              items: { type: 'string' },
              description: 'Component or lib-module names to upgrade (lowercase, e.g. "input", "utils"). Omit to upgrade every installed component and lib module.',
            },
            includeLibDependencies: {
              type: 'boolean',
              description: 'When components are named, also upgrade the installed lib modules they depend on that are outdated. Defaults to true.',
            },
            strategy: {
              type: 'string',
              enum: ['overwrite', 'new-file', 'three-way'],
              description: 'Conflict resolution strategy for locally-modified files. Defaults to "new-file".',
            },
          },
          required: ['projectPath'],
        },
      },
    ],
  };
});

/**
 * Handle tool execution. Exported (not just passed inline to
 * setRequestHandler) so it can be invoked directly in tests without going
 * through the MCP stdio transport.
 */
export async function handleCallToolRequest(request: { params: { name: string; arguments?: unknown } }) {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'list_components': return (function handleListComponents() {
      const category = (args as any)?.category;
      const components = category
        ? getComponentsByCategory(category)
        : getAllComponents();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(components, null, 2),
          },
        ],
      };
    })();

    case 'list_lib_modules': return (function handleListLibModules() {
      const libModules = getAllLibModules().map(m => ({
        name: m.name,
        description: m.description,
        dependencies: m.dependencies ?? [],
        internalDependencies: m.internalDependencies ?? [],
        installCommand: `npx @buildpad/cli add ${m.name}`,
        files: (m.files ?? []).map(f => f.target),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(libModules, null, 2),
          },
        ],
      };
    })();

    case 'get_component': return (function handleGetComponent() {
      const componentName = (args as any)?.name;
      if (!componentName) {
        throw new Error('Component name is required');
      }

      const component = getComponent(componentName);
      const libModule = component ? undefined : getLibModule(componentName);
      if (!component && !libModule) {
        throw new Error(`Component not found: ${componentName}`);
      }

      // If it's a lib module (e.g. external-oauth, supabase-auth), return its info directly
      if (libModule) {
        const { found, missing } = sourceResolver.readFiles(registryFilesOf(libModule));
        if (missing.length > 0 || found.length === 0) {
          return missingSourcesResult(libModule.name, missing);
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              name: libModule.name,
              description: libModule.description,
              type: 'lib-module',
              files: libModule.files,
              dependencies: libModule.dependencies ?? [],
              internalDependencies: libModule.internalDependencies ?? [],
              allSources: Object.fromEntries(found.map(f => [f.target, f.content])),
              installCommand: `${CLI} add ${libModule.name}`,
            }, null, 2),
          }],
        };
      }

      // Every file of the component; the first one is the primary source.
      const { found, missing } = sourceResolver.readFiles(component!.files);
      if (missing.length > 0 || found.length === 0) {
        return missingSourcesResult(component!.name, missing);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...component,
                source: found[0].content,
                allSources: Object.fromEntries(found.map(f => [f.target, f.content])),
                installCommand: `${CLI} add ${component!.name}`,
                installNote:
                  'Run in the project root (or pass --cwd <path>); run `npx @buildpad/cli init` first if there is no buildpad.json. ' +
                  'The CLI copies the files, rewrites @buildpad/* imports to your project paths and records them for later upgrades.',
                copyOwn: {
                  description:
                    'Add this component with the CLI (recommended), or copy the source below by hand. ' +
                    'The source imports @buildpad/* packages, which are not published to npm: a manual copy must rewrite those imports to your local paths.',
                  targetPath: component!.files[0]?.target || `components/ui/${component!.name}.tsx`,
                  peerDependencies: component!.dependencies,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    })();

    case 'get_usage_example': return (function handleGetUsageExample() {
      const componentName = (args as any)?.component;
      if (!componentName) {
        throw new Error('Component name is required');
      }

      const component = getComponent(componentName);
      const libModule = !component ? getLibModule(componentName) : undefined;
      if (!component && !libModule) {
        throw new Error(`Component not found: ${componentName}`);
      }

      if (libModule) {
        return {
          content: [{
            type: 'text',
            text: `// Lib module: ${libModule.name}\n// Install via CLI:\n// npx @buildpad/cli add ${libModule.name}\n\n// ${libModule.description}`,
          }],
        };
      }

      const example = generateUsageExample(component!);

      return {
        content: [
          {
            type: 'text',
            text: example,
          },
        ],
      };
    })();

    case 'generate_form': return (function handleGenerateForm() {
      const { collection, fields, mode } = args as any;
      
      const code = `// Copy & Own: ${CLI} add collection-form
import { CollectionForm } from '@/components/ui/collection-form';

function ${collection.charAt(0).toUpperCase() + collection.slice(1)}Form() {
  return (
    <CollectionForm
      collection="${collection}"
      mode="${mode || 'create'}"
      ${fields ? `includeFields={${JSON.stringify(fields)}}` : ''}
      onSuccess={(data) => {
        console.log('Saved:', data);
      }}
    />
  );
}`;

      return {
        content: [
          {
            type: 'text',
            text: code,
          },
        ],
      };
    })();

    case 'generate_interface': return (function handleGenerateInterface() {
      const { type, field, props = {} } = args as any;

      // Map interface type to component name
      const componentMap: Record<string, string> = {
        'input': 'Input',
        'textarea': 'Textarea',
        'select-dropdown': 'SelectDropdown',
        'datetime': 'DateTime',
        'toggle': 'Toggle',
        'boolean': 'Boolean',
        'file': 'FileInterface',
        'file-image': 'FileImage',
      };

      const componentName = componentMap[type] || 'Input';
      const propsStr = Object.entries(props)
        .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
        .join('\n      ');

      const code = `// Copy & Own: ${CLI} add ${type}
import { ${componentName} } from '@/components/ui/${type}';
import { useState } from 'react';

function Example() {
  const [value, setValue] = useState(null);

  return (
    <${componentName}
      field="${field}"
      value={value}
      onChange={setValue}
      ${propsStr}
    />
  );
}`;

      return {
        content: [
          {
            type: 'text',
            text: code,
          },
        ],
      };
    })();

    case 'list_packages': return (function handleListPackages() {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(PACKAGES, null, 2),
          },
        ],
      };
    })();

    case 'get_install_command': return (function handleGetInstallCommand() {
      const { components, category, all } = args as any;

      // @buildpad/cli is published on npm; run it in the consumer project root.
      let command = `${CLI} add`;
      let explanation = '';

      if (all) {
        command += ' --all';
        explanation = 'This will install all Buildpad components to your project.';
      } else if (category) {
        command += ` --category ${category}`;
        explanation = `This will install all components from the ${category} category.`;
      } else if (components && components.length > 0) {
        command += ` ${components.join(' ')}`;
        explanation = `This will install: ${components.join(', ')}.`;
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Install Buildpad components with the CLI, published on npm as @buildpad/cli. Run it in your project root, or pass \`--cwd /path/to/your-project\`.

**Examples:**
- \`${CLI} add input select-dropdown\`
- \`${CLI} add --category selection\`
- \`${CLI} add --all\`

Pass component names, a category, or all: true to this tool to get one exact command.`,
            },
          ],
        };
      }

      const result = `## Copy & Own Installation

**Command (run in your project root, or add \`--cwd /path/to/your-project\`):**
\`\`\`bash
${command}
\`\`\`

${explanation}

**What happens:**
1. Components are copied to your project (default: @/components/ui/)
2. Internal dependencies (types, services, hooks) are copied to @/lib/buildpad/
3. Imports are transformed to use local paths
4. Dependencies are tracked in buildpad.json

**First time setup (creates buildpad.json):**
\`\`\`bash
${CLI} init
\`\`\`
Or set up a whole project in one step: \`${CLI} bootstrap\`.

**Benefits of Copy & Own:**
✅ No external package dependencies for component code
✅ Full customization - components become your application code
✅ No breaking changes from upstream updates
✅ Bundle only what you use
✅ Works offline after installation`;

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    })();

    case 'get_copy_own_info': return (function handleGetCopyOwnInfo() {
      const info = `## Buildpad Copy & Own Distribution Model

Buildpad uses the **Copy & Own** model (like shadcn/ui) instead of traditional npm packages.

The component code is not installed as a dependency. The CLI, published on npm as **@buildpad/cli**, copies the source into your project.

### How it works (run in your project root, or pass \`--cwd <path>\`):
1. **Initialize:** \`${CLI} init\`
2. **Add components:** \`${CLI} add input select-dropdown\`
3. **Customize:** Components are copied as source code - modify freely!
4. **Stay current:** \`${CLI} outdated\`, then \`${CLI} upgrade\` (3-way merges your edits)

Or do steps 1-2 for a whole project at once: \`${CLI} bootstrap\`.

### Project Structure After Installation:
\`\`\`
your-project/
├── components/
│   └── ui/
│       ├── input.tsx          # Copied component
│       ├── select-dropdown.tsx
│       └── collection-form.tsx
├── lib/
│   └── buildpad/
│       ├── types/            # Type definitions
│       ├── services/         # API services
│       └── hooks/            # React hooks
└── buildpad.json           # Tracks installed components
\`\`\`

### CLI Commands:
- \`${CLI} init\` - Initialize project (creates buildpad.json)
- \`${CLI} list\` - List available components
- \`${CLI} add <components>\` - Install components
- \`${CLI} add --category <name>\` - Install by category
- \`${CLI} diff <component>\` - Preview before install
- \`${CLI} status\` - Check installed components
- \`${CLI} outdated\` - List components and lib modules with updates
- \`${CLI} upgrade\` - Upgrade them

### Benefits:
✅ **No external dependencies** - Components are part of your codebase
✅ **Full customization** - Modify components to fit your needs
✅ **No breaking changes** - You control when to update
✅ **Tree-shaking friendly** - Only bundle what you use
✅ **Works offline** - No network required after installation

### Categories:
- \`input\` - Text inputs, textareas, code editors
- \`selection\` - Dropdowns, checkboxes, radio buttons
- \`datetime\` - Date and time pickers
- \`boolean\` - Toggles and checkboxes
- \`media\` - File uploads, image pickers
- \`relational\` - M2M, M2O, O2M relationship interfaces
- \`layout\` - Dividers, notices, accordions
- \`rich-text\` - HTML and Markdown editors
- \`collection\` - CollectionForm, CollectionList`;

      return {
        content: [
          {
            type: 'text',
            text: info,
          },
        ],
      };
    })();

    case 'copy_component': return (function handleCopyComponent() {
      const componentName = (args as any)?.name;
      const includeLib = (args as any)?.includeLib ?? true;

      if (!componentName) {
        throw new Error('Component name is required');
      }

      const component = getComponent(componentName);
      const libModule = component ? undefined : getLibModule(componentName);
      if (!component && !libModule) {
        throw new Error(`Component not found: ${componentName}`);
      }

      const registry = getRegistry();
      const missing: MissingSource[] = [];

      /**
       * The files of the lib modules reached from `deps` through
       * internalDependencies, dependencies first, each module once. This is
       * the set the CLI's `add` installs (copyLibModule recurses the same way).
       */
      const collectLibFiles = (deps: string[]) => {
        const libFiles: Array<{ path: string; content: string; module: string }> = [];
        const visited = new Set<string>();
        const resolveLib = (name: string) => {
          if (visited.has(name)) return;
          visited.add(name);
          const mod = registry.lib[name];
          if (!mod) return;
          for (const dep of (mod.internalDependencies ?? [])) resolveLib(dep);
          const { found, missing: notFound } = sourceResolver.readFiles(registryFilesOf(mod));
          missing.push(...notFound);
          for (const f of found) libFiles.push({ path: f.target, content: f.content, module: name });
        };
        for (const dep of deps) resolveLib(dep);
        return { libFiles, visited };
      };

      // If it's a lib module (e.g. external-oauth), resolve and return its files directly
      if (libModule) {
        const { libFiles: allLibFiles, visited } = collectLibFiles([componentName]);
        if (missing.length > 0 || allLibFiles.length === 0) {
          return missingSourcesResult(libModule.name, missing);
        }
        const allDeps = [...new Set(
          [...visited].flatMap(n => (registry.lib[n]?.dependencies ?? []).map((d: string) => d.replace(/@[^@/]*$/, '')))
        )];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              name: libModule.name,
              description: libModule.description,
              type: 'lib-module',
              files: allLibFiles,
              peerDependencies: allDeps,
              installCommand: `${CLI} add ${libModule.name}`,
              instructions: `## Install lib module: ${libModule.name}\n\n\`\`\`bash\n${CLI} add ${libModule.name}\n\`\`\`\n\n${libModule.description}\n\nFiles installed:\n${allLibFiles.map(f => `- \`${f.path}\` (${f.module})`).join('\n')}${allDeps.length ? `\n\n### npm dependencies\n\`\`\`bash\npnpm add ${allDeps.join(' ')}\n\`\`\`` : ''}`,
            }, null, 2),
          }],
        };
      }

      // All files of the component
      const { found, missing: notFound } = sourceResolver.readFiles(component!.files);
      missing.push(...notFound);
      const files = found.map(f => ({ path: f.target, content: f.content }));

      // With includeLib, the lib modules it depends on, transitively
      const { libFiles } = includeLib
        ? collectLibFiles(component!.internalDependencies ?? [])
        : { libFiles: [] as Array<{ path: string; content: string; module: string }> };

      if (missing.length > 0 || files.length === 0) {
        return missingSourcesResult(component!.name, missing);
      }

      const registryDependencies = component!.registryDependencies ?? [];

      const result = {
        component: component!.name,
        title: component!.title,
        description: component!.description,

        // Primary component file
        files: files,

        // Required lib modules (if any)
        libFiles: libFiles.length > 0 ? libFiles : undefined,

        // Dependencies to install via npm/pnpm
        peerDependencies: component!.dependencies,

        // Other components this one renders; copy (or add) them too
        registryDependencies,

        // Install command (recommended over a manual copy)
        cliCommand: `${CLI} add ${component!.name}`,
        cliNote:
          'Recommended: the CLI copies these files, installs their dependencies, rewrites @buildpad/* imports to your project paths and records hashes for later upgrades.',

        // Instructions
        instructions: `## Copy & Own: ${component!.title}

### Option 1: Use the CLI (Recommended)

Run in your project root (or pass \`--cwd /path/to/your-project\`). If the project has no buildpad.json yet, run \`${CLI} init\` first.
\`\`\`bash
${CLI} add ${component!.name}
\`\`\`

### Option 2: Manual Copy
1. Copy the component file(s) to your project:
${files.map(f => `   - \`${f.path}\``).join('\n')}
${libFiles.length > 0 ? `
2. Copy required lib modules:
${libFiles.map(f => `   - \`${f.path}\` (${f.module})`).join('\n')}` : ''}

${component!.dependencies.length > 0 ? `3. Install peer dependencies:
\`\`\`bash
pnpm add ${component!.dependencies.join(' ')}
\`\`\`` : ''}
${registryDependencies.length > 0 ? `
4. Also add the components it uses: ${registryDependencies.map(d => `\`${d}\``).join(', ')}` : ''}

The sources import \`@buildpad/*\` packages, which are not published to npm. Rewrite those imports to your local paths (for example \`@buildpad/hooks\` → \`@/lib/buildpad/hooks\`, \`@buildpad/ui-interfaces\` → \`@/components/ui\`), or use Option 1, which does it for you.

### Usage
\`\`\`tsx
import { ${component!.title} } from '@/components/ui/${component!.name}';
\`\`\`
`,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    })();

    case 'get_rbac_pattern': return handleGetRbacPattern(args as any);
    case 'get_module_access_pattern': return handleGetModuleAccessPattern(args as any);

    // --- Phase 5: versioning tools ---

    case 'get_package_versions': return (function handleGetPackageVersions() {
      const registry = getRegistry();
      const packages = (registry as any).packages ?? {};
      return {
        content: [{ type: 'text', text: JSON.stringify(packages, null, 2) }],
      };
    })();

    case 'list_outdated': return (function handleListOutdated() {
        const config = readConsumerConfig((args as any)?.projectPath);
        const registry = getRegistry();
        const registryPackages = registry.packages ?? {};

        const outdated: object[] = [];
        for (const entry of installedEntries(config, registry)) {
          const status = entryStatus(entry, registry.version);
          if (!status.isOutdated) continue;
          outdated.push({
            ...status,
            changelogUrl: status.sourcePackage ? registryPackages[status.sourcePackage]?.changelogUrl ?? null : null,
          });
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(outdated, null, 2) }],
        };
      })();

    case 'get_component_changelog': return (async function handleGetComponentChangelog() {
        const { target, sinceVersion } = args as any;
        if (!target) throw new Error('target is required');
        const registry = getRegistry();
        const registryPackages: Record<string, { version: string; changelogUrl?: string }> =
          (registry as any).packages ?? {};

        let changelogUrl: string | undefined;
        if (registryPackages[target]) {
          changelogUrl = registryPackages[target].changelogUrl;
        } else {
          const comp = (getAllComponents() as any[]).find(c => c.name === target);
          if (comp?.sourcePackage && registryPackages[comp.sourcePackage]) {
            changelogUrl = registryPackages[comp.sourcePackage].changelogUrl;
          }
        }
        if (!changelogUrl) {
          throw new Error(
            `Cannot find changelog for: ${target}. ` +
            `Use a package name like "@buildpad/ui-interfaces" or a component name like "input".`
          );
        }
        const content = await fetchChangelogContent(changelogUrl);
        if (!content) {
          return {
            content: [{
              type: 'text',
              text: `Changelog unavailable (network error or not yet published) for: ${target}`,
            }],
          };
        }
        const slice = changelogSince(content, sinceVersion);
        return {
          content: [{
            type: 'text',
            text: slice || `No changelog entries found${sinceVersion ? ` after version ${sinceVersion}` : ''}.`,
          }],
        };
      })();

    case 'get_upgrade_plan': return (function handleGetUpgradePlan() {
        const { projectPath, components: requested } = (args ?? {}) as { projectPath?: unknown; components?: unknown };
        const config = readConsumerConfig(projectPath);
        if (requested !== undefined && !(Array.isArray(requested) && requested.every(n => typeof n === 'string'))) {
          throw new Error('components must be an array of component or lib-module names');
        }
        const registry = getRegistry();
        const entries = installedEntries(config, registry);
        const statuses = entries.map(e => entryStatus(e, registry.version));

        // Naming a component also plans the outdated lib modules it depends
        // on: apply_upgrade upgrades those with it.
        const requestedNames = (requested as string[] | undefined) ?? [];
        const selected = requestedNames.length > 0
          ? new Set([...requestedNames, ...staleLibDependencies(requestedNames, statuses, registry)])
          : undefined;

        const plan: object[] = [];
        entries.forEach((entry, i) => {
          if (selected && !selected.has(entry.name)) return;
          const status = statuses[i];
          const files = fileStatuses(projectPath as string, config, entry);
          plan.push({
            ...status,
            modifiedLocally: files.some(f => f.status === 'modified'),
            recommendedAction: recommendedAction(status, files),
            staleLibDependencies: entry.kind === 'component'
              ? staleLibDependencies([entry.name], statuses, registry)
              : [],
            files,
          });
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
        };
      })();

    case 'apply_upgrade': return (function handleApplyUpgrade() {
        const input = validateApplyUpgradeArgs(args);
        const config = readConsumerConfig(input.projectPath);
        const registry = getRegistry();
        const entries = installedEntries(config, registry);
        const statuses = entries.map(e => entryStatus(e, registry.version));

        const unknown = input.components.filter(n => !getComponent(n) && !getLibModule(n));
        if (unknown.length > 0) {
          throw new Error(
            `Not in the @buildpad/mcp ${MCP_VERSION} registry: ${unknown.join(', ')}. ` +
            'Use list_components / list_lib_modules for valid names.'
          );
        }
        // getComponent also matches titles ("Input"); the CLI needs registry names.
        const named = input.components.map(n => getComponent(n)?.name ?? n);

        // Upgrading with this server's CLI release must not move anything backwards.
        const targeted = named.length > 0 ? new Set(named) : undefined;
        const ahead = statuses.filter(st => st.aheadOfRegistry && (!targeted || targeted.has(st.name)));
        const projectAhead = isAhead(config.release, MCP_VERSION);
        if (projectAhead || ahead.length > 0) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: JSON.stringify({
                error:
                  `This project was installed from a newer release (${projectAhead ? config.release : ahead[0].installedRelease}) ` +
                  `than this server (${MCP_VERSION}). apply_upgrade would run @buildpad/cli@${MCP_VERSION} and downgrade it.`,
                projectRelease: config.release ?? null,
                mcpVersion: MCP_VERSION,
                aheadOfRegistry: ahead.map(st => ({ kind: st.kind, name: st.name, installedRelease: st.installedRelease })),
                hint: 'Update the MCP server (npx -y @buildpad/mcp@latest), or run the CLI that matches the project directly.',
              }, null, 2),
            }],
          };
        }

        const libDependencies = named.length > 0 && input.includeLibDependencies
          ? staleLibDependencies(named, statuses, registry)
          : [];
        const names = [...named, ...libDependencies];

        const { command, args: cliArgs } = buildUpgradeCommand({
          cliVersion: MCP_VERSION,
          projectPath: input.projectPath,
          strategy: input.strategy,
          names,
        });

        // No shell: every argument reaches npx as one argv entry.
        const result = spawnSync(command, cliArgs, { // NOSONAR: fixed command; arguments validated above
          cwd: input.projectPath,
          encoding: 'utf-8',
          timeout: 120_000,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.status === 0,
              exitCode: result.status ?? -1,
              stdout: result.stdout ?? '',
              stderr: result.stderr ?? '',
              ...(result.error ? { error: result.error.message } : {}),
              components: named.length > 0 ? named : 'all installed',
              libDependencies,
              strategy: input.strategy,
              cliVersion: MCP_VERSION,
              command: [command, ...cliArgs].join(' '),
            }, null, 2),
          }],
        };
      })();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

server.setRequestHandler(CallToolRequestSchema, handleCallToolRequest);

/**
 * Generate RBAC pattern with MCP tool call sequences
 */
function handleGetRbacPattern(args: { pattern: string; collections?: string[]; roleName?: string }) {
  const collections = args.collections || ['<collection_name>'];
  const roleName = args.roleName || 'CustomRole';

  const dynamicVariablesRef = {
    variables: [
      { name: '$CURRENT_USER', type: 'string', description: 'Current user UUID', example: '{ "user_created": { "_eq": "$CURRENT_USER" } }' },
      { name: '$CURRENT_USER.<field>', type: 'any', description: 'Field on current user', example: '{ "organization": { "_eq": "$CURRENT_USER.organization" } }' },
      { name: '$CURRENT_ROLE', type: 'string', description: 'Primary role UUID', example: '{ "assigned_role": { "_eq": "$CURRENT_ROLE" } }' },
      { name: '$CURRENT_ROLES', type: 'string[]', description: 'All role UUIDs', example: '{ "target_role": { "_in": "$CURRENT_ROLES" } }' },
      { name: '$CURRENT_POLICIES', type: 'string[]', description: 'All policy UUIDs', example: '{ "required_policy": { "_in": "$CURRENT_POLICIES" } }' },
      { name: '$NOW', type: 'timestamp', description: 'Current time', example: '{ "publish_date": { "_lte": "$NOW" } }' },
    ],
  };

  const patterns: Record<string, object> = {
    own_items: {
      description: 'Users can fully manage their own items, read others\' published items',
      steps: [
        { step: 1, tool: 'roles', args: { action: 'create', data: { name: roleName, icon: 'person', description: `${roleName} - own items pattern` } } },
        { step: 2, tool: 'policies', args: { action: 'create', data: { name: `${roleName} Policy`, icon: 'shield' } } },
        { step: 3, tool: 'access', args: { action: 'create', data: { role: '<role-id>', policy: '<policy-id>' } } },
        ...collections.flatMap((c, i) => [
          { step: 4 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'create', fields: ['*'], presets: { user_created: '$CURRENT_USER' } } } },
          { step: 5 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'read', fields: ['*'], permissions: { _or: [{ user_created: { _eq: '$CURRENT_USER' } }, { status: { _eq: 'published' } }] } } } },
          { step: 6 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'update', fields: ['*'], permissions: { user_created: { _eq: '$CURRENT_USER' } } } } },
          { step: 7 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'delete', permissions: { user_created: { _eq: '$CURRENT_USER' } } } } },
        ]),
      ],
      dynamicVariables: dynamicVariablesRef,
    },

    role_hierarchy: {
      description: 'Admin (full access) → Editor (full CRUD) → Viewer (read-only published)',
      steps: [
        { step: 1, tool: 'roles', args: { action: 'create', data: { name: 'Admin', icon: 'admin_panel_settings' } } },
        { step: 2, tool: 'roles', args: { action: 'create', data: { name: 'Editor', icon: 'edit' } } },
        { step: 3, tool: 'roles', args: { action: 'create', data: { name: 'Viewer', icon: 'visibility' } } },
        { step: 4, tool: 'policies', args: { action: 'create', data: { name: 'Admin Policy', admin_access: true } } },
        { step: 5, tool: 'policies', args: { action: 'create', data: { name: 'Editor Policy', app_access: true } } },
        { step: 6, tool: 'policies', args: { action: 'create', data: { name: 'Viewer Policy', app_access: true } } },
        { step: 7, note: 'Create access entries linking each policy to its role' },
        { step: 8, note: 'Editor permissions: full CRUD on all collections', tool: 'permissions', example: { policy: '<editor-policy-id>', collection: '<collection>', action: 'create|read|update|delete', fields: ['*'], permissions: null } },
        { step: 9, note: 'Viewer permissions: read-only on published', tool: 'permissions', example: { policy: '<viewer-policy-id>', collection: '<collection>', action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } } },
      ],
      dynamicVariables: dynamicVariablesRef,
    },

    public_read: {
      description: 'Published items publicly readable, authenticated users can create',
      steps: [
        { step: 1, tool: 'policies', args: { action: 'create', data: { name: 'Public Read Policy', icon: 'public' } } },
        { step: 2, tool: 'access', args: { action: 'create', data: { role: null, user: null, policy: '<public-policy-id>' } }, note: 'Public access: role=null, user=null' },
        ...collections.map((c, i) => (
          { step: 3 + i, tool: 'permissions', args: { action: 'create', data: { policy: '<public-policy-id>', collection: c, action: 'read', fields: ['id', 'title', 'content', 'date_created'], permissions: { status: { _eq: 'published' } } } } }
        )),
        { step: 3 + collections.length, note: 'Then create an authenticated role with create/update permissions using own_items pattern' },
      ],
      dynamicVariables: dynamicVariablesRef,
    },

    multi_tenant: {
      description: 'Organization-level isolation — users only see data from their org',
      steps: [
        { step: 1, tool: 'roles', args: { action: 'create', data: { name: roleName, icon: 'business' } } },
        { step: 2, tool: 'policies', args: { action: 'create', data: { name: `${roleName} Policy`, icon: 'shield' } } },
        { step: 3, tool: 'access', args: { action: 'create', data: { role: '<role-id>', policy: '<policy-id>' } } },
        ...collections.flatMap((c, i) => [
          { step: 4 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'create', fields: ['*'], presets: { organization: '$CURRENT_USER.organization', user_created: '$CURRENT_USER' } } } },
          { step: 5 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'read', fields: ['*'], permissions: { organization: { _eq: '$CURRENT_USER.organization' } } } } },
          { step: 6 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'update', fields: ['*'], permissions: { organization: { _eq: '$CURRENT_USER.organization' } } } } },
          { step: 7 + i * 4, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'delete', permissions: { organization: { _eq: '$CURRENT_USER.organization' } } } } },
        ]),
      ],
      note: 'Requires "organization" field on daas_users and on each collection',
      dynamicVariables: dynamicVariablesRef,
    },

    full_crud: {
      description: 'Unrestricted CRUD access to specified collections',
      steps: [
        { step: 1, tool: 'roles', args: { action: 'create', data: { name: roleName, icon: 'build' } } },
        { step: 2, tool: 'policies', args: { action: 'create', data: { name: `${roleName} Policy`, icon: 'shield' } } },
        { step: 3, tool: 'access', args: { action: 'create', data: { role: '<role-id>', policy: '<policy-id>' } } },
        ...collections.flatMap((c, i) =>
          ['create', 'read', 'update', 'delete'].map((a, j) => (
            { step: 4 + i * 4 + j, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: a, fields: ['*'], permissions: null } } }
          ))
        ),
      ],
      dynamicVariables: dynamicVariablesRef,
    },

    read_only: {
      description: 'Read-only access to specified collections',
      steps: [
        { step: 1, tool: 'roles', args: { action: 'create', data: { name: roleName, icon: 'visibility' } } },
        { step: 2, tool: 'policies', args: { action: 'create', data: { name: `${roleName} Policy`, icon: 'shield' } } },
        { step: 3, tool: 'access', args: { action: 'create', data: { role: '<role-id>', policy: '<policy-id>' } } },
        ...collections.map((c, i) => (
          { step: 4 + i, tool: 'permissions', args: { action: 'create', data: { policy: '<policy-id>', collection: c, action: 'read', fields: ['*'], permissions: null } } }
        )),
      ],
      dynamicVariables: dynamicVariablesRef,
    },
  };

  const pattern = patterns[args.pattern];
  if (!pattern) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown pattern: ${args.pattern}. Available: ${Object.keys(patterns).join(', ')}` }) }],
      isError: true,
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ pattern: args.pattern, ...pattern, moduleAccess: MODULE_ACCESS_REMINDER }, null, 2),
    }],
  };
}

/**
 * Appended to every RBAC pattern.
 *
 * `daas_permissions` only covers collection CRUD. Any gate that is not "can
 * this user read/write this collection" — a button, a page, a nav item, a
 * workflow transition — is a module access key. Without this reminder agents
 * fall back to role-name checks (`user.role === 'manager'`), which the
 * create-rbac skill explicitly forbids.
 */
const MODULE_ACCESS_REMINDER = {
  note: 'Record-Level Access (above) covers collection CRUD only. Every NON-CRUD capability gate must be a Module-Level Access key — never a role-name check.',
  whenToUse: [
    'A button, page, section, or nav item shown only to some users',
    'A workflow transition restricted to certain users (use command.module_access_keys)',
    'Any feature gate not expressible as create/read/update/delete on a collection',
  ],
  forbidden: [
    "user.role === 'manager'", 'roleName checks', 'is_admin / isManager fields',
    "roleObj.name === 'Administrator'",
  ],
  nextStep: "Call get_module_access_pattern with the capability keys this feature needs.",
};

/**
 * Generate the Module-Level Access setup sequence: register keys, grant them on
 * policies, and guard them on both sides.
 */
function handleGetModuleAccessPattern(args: {
  keys?: Array<{ key: string; display_name?: string; description?: string }>;
  folder?: string;
  policyName?: string;
}) {
  const keys = args.keys?.length ? args.keys : [{ key: '<domain>:<capability>', display_name: '<Display Name>' }];
  const folder = args.folder;
  const policyName = args.policyName || '<policy-name>';

  const steps: Array<Record<string, unknown>> = [];
  let step = 1;

  if (folder) {
    steps.push({
      step: step++,
      note: 'Folder node — groups related keys in the Policy editor. key MUST be null.',
      tool: 'module_access_keys',
      args: { action: 'create', data: { display_name: folder, key: null, sort: 10 } },
    });
  }

  keys.forEach((k, i) => {
    steps.push({
      step: step++,
      tool: 'module_access_keys',
      args: {
        action: 'create',
        data: {
          ...(folder ? { parent_id: '<folder-uuid>' } : {}),
          display_name: k.display_name ?? k.key,
          description: k.description ?? `Grants ${k.key}`,
          key: k.key,
          sort: (i + 1) * 10,
        },
      },
    });
  });

  steps.push({
    step: step++,
    note: `Grant on ${policyName}. Only true grants; omit or delete a key to revoke. OR-merged across all of a user's policies.`,
    tool: 'policies',
    args: {
      action: 'update',
      id: '<policy-uuid>',
      data: { module_access: Object.fromEntries(keys.map((k) => [k.key, true])) },
    },
  });

  const firstKey = keys[0].key;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        pattern: 'module_access',
        description: 'Application capability flags that are not tied to a collection. The second permission dimension beside daas_permissions.',
        concepts: {
          registry: 'daas_module_access_keys — hierarchical. key=null is a folder; only leaves are grantable.',
          grant: 'daas_policies.module_access JSONB — { "key": true }.',
          merge: 'OR across every policy the user holds. Admins hold every key.',
          keyFormat: '^[a-z][a-z0-9_:./-]*$, globally unique. Convention <domain>:<capability>.',
          reserved: 'system: and workflow: are platform namespaces — use your own prefix.',
          scope: 'Resolved against the active Resource URI, so grants respect multi-tenant scope.',
        },
        steps,
        clientGuard: {
          note: 'UI checks are UX only — they decide what renders, never what is allowed.',
          import: "import { usePermissions } from '@/lib/buildpad/hooks';",
          example: `const { hasModuleAccess } = usePermissions();\n{hasModuleAccess('${firstKey}') && <Button onClick={handleExport}>Export</Button>}`,
          failClosed: 'hasModuleAccess returns false while loading and on error — deliberately unlike canPerform, which is optimistic. Render a skeleton if flicker matters; never render the gated control.',
        },
        serverGuard: {
          note: 'THE security boundary. Required in every route performing a gated action.',
          install: 'npx @buildpad/cli add services',
          import: "import { enforceModuleAccess } from '@/lib/module-access/enforce';",
          example: `// app/api/reports/export/route.ts\nexport async function GET() {\n  await enforceModuleAccess('${firstKey}');  // throws ModuleAccessError(403)\n  // ...\n}`,
        },
        workflowGuard: {
          note: 'For state-machine transitions, gate the command itself. module_access_keys and policies are OR\'d.',
          example: { name: 'approve', next_state: 'approved', policies: [], module_access_keys: [firstKey], actions: [] },
        },
        capabilityMatrix: {
          note: 'STOP-SHIP artifact — produce this before considering the feature complete.',
          columns: ['key', 'granted policies', 'UI guard location(s)', 'API guard location(s)'],
        },
        verification: [
          'Granted user can use the gated action',
          'Ungranted user does not see the control',
          'Ungranted user gets 403 when calling the API directly (UI bypassed)',
          'Admin bypass works on BOTH client and server',
        ],
      }, null, 2),
    }],
  };
}

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Buildpad MCP Server running on stdio');
}

/**
 * Whether this module is the program being run rather than an import, which
 * is what decides between starting the stdio server and letting tests import
 * these exports.
 *
 * Compares the resolved real paths, not the raw strings: npx and pnpm expose
 * a package's `bin` as a symlink, so `process.argv[1]` is the shim's path
 * while `import.meta.url` is the real file. Comparing those two directly
 * missed the match, and the server exited without starting and without
 * printing anything — which a client reports as CONNECTION_CLOSED.
 *
 * Exported so the shim case can be tested without building and spawning the
 * server.
 */
export function isMainModule(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  const modulePath = fileURLToPath(moduleUrl);
  try {
    return realpathSync(argv1) === realpathSync(modulePath);
  } catch {
    // One of the two no longer resolves on disk. Fall back to the plain
    // comparison instead of assuming "imported": deciding that wrongly is
    // exactly the silent do-nothing exit this check exists to avoid.
    return pathToFileURL(argv1).href === moduleUrl;
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

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
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the packages root (mcp-server/dist -> packages)
const PACKAGES_ROOT = join(__dirname, '../..');

/**
 * Read file content safely
 * Handles both direct file paths (e.g., ui-interfaces/src/datetime/DateTime.tsx)
 * and directory paths (tries index.tsx, index.ts variants)
 */
function readSourceFile(relativePath: string): string | null {
  const fullPath = join(PACKAGES_ROOT, relativePath);
  
  // First, try the exact path (for explicit file paths like DateTime.tsx)
  if (existsSync(fullPath)) {
    return readFileSync(fullPath, 'utf-8');
  }
  
  // If path doesn't exist as-is, try as directory with index files
  const extensions = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'];
  
  for (const ext of extensions) {
    const filePath = join(fullPath, ext);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
  }
  
  return null;
}

/**
 * Generate component usage example
 * Uses Copy & Own style - components are imported from local project paths
 */
function generateUsageExample(component: ComponentMetadata): string {
  const examples: Record<string, string> = {
    Input: `// Copy & Own: Component must be added via CLI from local buildpad-ui
// cd /path/to/buildpad-ui && pnpm cli add input --project /path/to/your-project
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
    SelectDropdown: `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add select-dropdown --project /path/to/your-project
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
    DateTime: `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add datetime --project /path/to/your-project
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
    Toggle: `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add toggle --project /path/to/your-project
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
    CollectionForm: `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add collection-form --project /path/to/your-project
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
    CollectionList: `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add collection-list --project /path/to/your-project
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

  return examples[component.name] || examples[component.title] || `// Copy & Own model: This component is copied to your project
// Import from your local components directory after running from buildpad-ui:
// cd /path/to/buildpad-ui && pnpm cli add ${component.name} --project /path/to/your-project

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
    version: '1.0.0',
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
 * Read resource content (package info or component source)
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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

  // Handle component source requests
  if (uri.startsWith('buildpad://components/')) {
    const componentName = uri.replace('buildpad://components/', '');
    const component = getComponent(componentName);
    const libModule = !component ? getLibModule(componentName) : undefined;

    if (!component && !libModule) {
      throw new Error(`Component not found: ${componentName}`);
    }

    // Get source from first file in files array
    const files = component ? component.files : libModule!.files ?? [];
    const sourcePath = files[0]?.source;
    const source = sourcePath ? readSourceFile(sourcePath) : null;

    if (!source) {
      throw new Error(`Source file not found for component: ${componentName}`);
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
});

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
        description: 'Get complete source code and file structure to manually copy a component into your project (shadcn-style). Returns the full implementation code, target paths, and required dependencies.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Component name (e.g., "datetime", "input", "select-dropdown")',
            },
            includeLib: {
              type: 'boolean',
              description: 'Also include required lib modules (types, services, hooks) if the component depends on them',
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
        description: 'Get RBAC (Role-Based Access Control) setup patterns for DaaS applications. Returns complete MCP tool call sequences to set up roles, policies, access, and permissions with dynamic variables.',
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
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'list_components': {
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
    }

    case 'list_lib_modules': {
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
    }

    case 'get_component': {
      const componentName = (args as any)?.name;
      if (!componentName) {
        throw new Error('Component name is required');
      }

      const component = getComponent(componentName);
      const libModule = !component ? getLibModule(componentName) : undefined;
      if (!component && !libModule) {
        throw new Error(`Component not found: ${componentName}`);
      }

      // If it's a lib module (e.g. external-oauth, supabase-auth), return its info directly
      if (libModule) {
        const libFiles: Record<string, string> = {};
        for (const file of (libModule.files ?? [])) {
          const content = readSourceFile(file.source);
          if (content) libFiles[file.target] = content;
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
              allSources: libFiles,
              installCommand: `npx @buildpad/cli add ${libModule.name}`,
            }, null, 2),
          }],
        };
      }

      // Get source from all files in files array (for components with multiple files)
      const sources: Record<string, string> = {};
      for (const file of component!.files) {
        const content = readSourceFile(file.source);
        if (content) {
          sources[file.target] = content;
        }
      }

      // Primary source is the first file
      const primarySource = component!.files[0]?.source;
      const source = primarySource ? readSourceFile(primarySource) : null;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...component,
                source: source || 'Source code not available',
                allSources: sources,
                installCommand: `cd /path/to/buildpad-ui && pnpm cli add ${component!.name} --project /path/to/your-project`,
                installNote: '⚠️ @buildpad/cli is NOT on npm. You must use the CLI from a local clone of buildpad-ui.',
                copyOwn: {
                  description: 'Copy this component to your project using the CLI from buildpad-ui, or manually copy the source code below.',
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
    }

    case 'get_usage_example': {
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
    }

    case 'generate_form': {
      const { collection, fields, mode } = args as any;
      
      const code = `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add collection-form --project /path/to/your-project
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
    }

    case 'generate_interface': {
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

      const code = `// Copy & Own: cd /path/to/buildpad-ui && pnpm cli add ${type} --project /path/to/your-project
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
    }

    case 'list_packages': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(PACKAGES, null, 2),
          },
        ],
      };
    }

    case 'get_install_command': {
      const { components, category, all } = args as any;
      
      // NOTE: @buildpad/cli is NOT published to npm. Must use local CLI from cloned repo
      let command = 'cd /path/to/buildpad-ui && pnpm cli add';
      let explanation = '';
      
      if (all) {
        command += ' --all --project /path/to/your-project';
        explanation = 'This will install all Buildpad components to your project.';
      } else if (category) {
        command += ` --category ${category} --project /path/to/your-project`;
        explanation = `This will install all components from the ${category} category.`;
      } else if (components && components.length > 0) {
        command += ` ${components.join(' ')} --project /path/to/your-project`;
        explanation = `This will install: ${components.join(', ')}.`;
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **IMPORTANT:** @buildpad/cli is NOT published to npm. You must use the CLI from a local clone.

**Prerequisites:**
1. Clone buildpad-ui: \`git clone <repo-url> buildpad-ui\`
2. Install & build: \`cd buildpad-ui && pnpm install && pnpm build\`

**Examples (run from buildpad-ui directory):**
- \`pnpm cli add input select-dropdown --project /path/to/your-project\`
- \`pnpm cli add --category selection --project /path/to/your-project\`
- \`pnpm cli add --all --project /path/to/your-project\``,
            },
          ],
        };
      }

      const result = `## Copy & Own Installation

⚠️ **IMPORTANT:** @buildpad/cli is NOT published to npm.
You must use the CLI from a local clone of buildpad-ui.

**Prerequisites:**
1. Clone the repo: \`git clone <repo-url> buildpad-ui\`
2. Install deps: \`cd buildpad-ui && pnpm install\`
3. Build CLI: \`pnpm build:cli\`

**Command (from buildpad-ui directory):**
\`\`\`bash
${command}
\`\`\`

${explanation}

**What happens:**
1. Components are copied to your project (default: @/components/ui/)
2. Internal dependencies (types, services, hooks) are copied to @/lib/buildpad/
3. Imports are transformed to use local paths
4. Dependencies are tracked in buildpad.json

**First time setup (from buildpad-ui directory):**
\`\`\`bash
pnpm cli init --project /path/to/your-project
\`\`\`

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
    }

    case 'get_copy_own_info': {
      const info = `## Buildpad Copy & Own Distribution Model

Buildpad uses the **Copy & Own** model (like shadcn/ui) instead of traditional npm packages.

⚠️ **IMPORTANT:** @buildpad/cli is NOT published to npm.
You must clone buildpad-ui locally and use the CLI from there.

### Prerequisites:
1. Clone: \`git clone <repo-url> buildpad-ui\`
2. Install: \`cd buildpad-ui && pnpm install\`
3. Build: \`pnpm build\`

### How it works (all commands from buildpad-ui directory):
1. **Initialize:** \`pnpm cli init --project /path/to/your-project\`
2. **Add components:** \`pnpm cli add input select-dropdown --project /path/to/your-project\`
3. **Customize:** Components are copied as source code - modify freely!

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

### CLI Commands (from buildpad-ui directory):
- \`pnpm cli init --project <path>\` - Initialize project
- \`pnpm cli list\` - List available components
- \`pnpm cli add <components> --project <path>\` - Install components
- \`pnpm cli add --category <name> --project <path>\` - Install by category
- \`pnpm cli diff <component> --project <path>\` - Preview before install
- \`pnpm cli status --project <path>\` - Check installed components

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
    }

    case 'copy_component': {
      const componentName = (args as any)?.name;
      const includeLib = (args as any)?.includeLib ?? true;
      
      if (!componentName) {
        throw new Error('Component name is required');
      }

      const component = getComponent(componentName);
      const libModule = !component ? getLibModule(componentName) : undefined;
      if (!component && !libModule) {
        throw new Error(`Component not found: ${componentName}`);
      }

      // If it's a lib module (e.g. external-oauth), resolve and return its files directly
      if (libModule) {
        const registry = getRegistry();
        const allLibFiles: Array<{ path: string; content: string; module: string }> = [];
        const visited = new Set<string>();
        const resolveLib = (name: string) => {
          if (visited.has(name)) return;
          visited.add(name);
          const mod = registry.lib[name];
          if (!mod) return;
          for (const dep of (mod.internalDependencies ?? [])) resolveLib(dep);
          for (const file of (mod.files ?? [])) {
            const content = readSourceFile(file.source);
            if (content) allLibFiles.push({ path: file.target, content, module: name });
          }
        };
        resolveLib(componentName);
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
              installCommand: `npx @buildpad/cli add ${libModule.name}`,
              instructions: `## Install lib module: ${libModule.name}\n\n\`\`\`bash\nnpx @buildpad/cli add ${libModule.name}\n\`\`\`\n\n${libModule.description}\n\nFiles installed:\n${allLibFiles.map(f => `- \`${f.path}\` (${f.module})`).join('\n')}${allDeps.length ? `\n\n### npm dependencies\n\`\`\`bash\npnpm add ${allDeps.join(' ')}\n\`\`\`` : ''}`,
            }, null, 2),
          }],
        };
      }

      // Collect all files for this component
      const files: Array<{ path: string; content: string }> = [];
      
      for (const file of component!.files) {
        const content = readSourceFile(file.source);
        if (content) {
          files.push({
            path: file.target,
            content: content,
          });
        }
      }

      // If includeLib and component has internal dependencies, include those too
      const libFiles: Array<{ path: string; content: string; module: string }> = [];
      
      if (includeLib && component!.internalDependencies?.length > 0) {
        const registry = getRegistry();
        
        for (const dep of component!.internalDependencies) {
          const libModule = registry.lib[dep];
          if (libModule) {
            if (libModule.files) {
              for (const file of libModule.files) {
                const content = readSourceFile(file.source);
                if (content) {
                  libFiles.push({
                    path: file.target,
                    content: content,
                    module: dep,
                  });
                }
              }
            } else if (libModule.path && libModule.target) {
              const content = readSourceFile(libModule.path);
              if (content) {
                libFiles.push({
                  path: libModule.target,
                  content: content,
                  module: dep,
                });
              }
            }
          }
        }
      }

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
        
        // Install command (must use local CLI, not npx)
        cliCommand: `cd /path/to/buildpad-ui && pnpm cli add ${component!.name} --project /path/to/your-project`,
        cliNote: '⚠️ @buildpad/cli is NOT on npm. You must use the CLI from a local clone of buildpad-ui.',
        
        // Instructions
        instructions: `## Copy & Own: ${component!.title}

⚠️ **IMPORTANT:** @buildpad/cli is NOT published to npm.
You must use the CLI from a local clone of buildpad-ui.

### Option 1: Use CLI (Recommended)

**Prerequisites:**
1. Clone buildpad-ui: \`git clone <repo-url>\`
2. Install & build: \`cd buildpad-ui && pnpm install && pnpm build\`

**Add component (from buildpad-ui directory):**
\`\`\`bash
pnpm cli add ${component!.name} --project /path/to/your-project
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
    }

    default:
      if (name === 'get_rbac_pattern') {
        return handleGetRbacPattern(args as any);
      }
      throw new Error(`Unknown tool: ${name}`);
  }
});

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
    content: [{ type: 'text', text: JSON.stringify({ pattern: args.pattern, ...pattern }, null, 2) }],
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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

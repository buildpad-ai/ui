/**
 * Component Registry
 *
 * Loads component metadata from the embedded registry (bundled at build time).
 * Used by the MCP server to expose components to AI agents.
 */

// Declare the embedded registry (injected at build time via tsup define)
declare const EMBEDDED_REGISTRY: string;

export interface ComponentMetadata {
  name: string;
  title: string;
  category: string;
  description: string;
  files: Array<{ source: string; target: string }>;
  dependencies: string[];
  internalDependencies: string[];
  registryDependencies?: string[];
}

export interface PackageMetadata {
  name: string;
  description: string;
  path: string;
  exports: string[];
  components?: ComponentMetadata[];
}

export interface CategoryMetadata {
  name: string;
  title: string;
  description: string;
}

export interface LibModule {
  name: string;
  description: string;
  files?: Array<{ source: string; target: string }>;
  path?: string;
  target?: string;
  dependencies?: string[];
  internalDependencies?: string[];
}

export interface Registry {
  version: string;
  name: string;
  description: string;
  meta: {
    model: string;
    framework: string;
    uiLibrary: string;
    typescript: boolean;
  };
  lib: Record<string, LibModule>;
  components: ComponentMetadata[];
  categories: CategoryMetadata[];
}

/**
 * Load registry from embedded JSON (bundled at build time)
 */
function loadRegistry(): Registry {
  return JSON.parse(EMBEDDED_REGISTRY) as Registry;
}

// Load registry once
let _registry: Registry | null = null;

export function getRegistry(): Registry {
  if (!_registry) {
    _registry = loadRegistry();
  }
  return _registry;
}

/**
 * Get all components
 */
export function getAllComponents(): ComponentMetadata[] {
  return getRegistry().components;
}

/**
 * Get component by name
 */
export function getComponent(name: string): ComponentMetadata | undefined {
  return getRegistry().components.find(
    (c) =>
      c.name.toLowerCase() === name.toLowerCase() ||
      c.title.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Get components by category
 */
export function getComponentsByCategory(category: string): ComponentMetadata[] {
  return getRegistry().components.filter((c) => c.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): CategoryMetadata[] {
  return getRegistry().categories;
}

/**
 * Get lib module by name
 */
export function getLibModule(name: string): LibModule | undefined {
  return getRegistry().lib[name];
}

/**
 * Get all lib modules
 */
export function getAllLibModules(): LibModule[] {
  return Object.values(getRegistry().lib);
}

// Legacy PACKAGES export for backwards compatibility with MCP server
export const PACKAGES: PackageMetadata[] = [
  {
    name: "@buildpad/types",
    description:
      "TypeScript type definitions for collections, fields, files, and relations",
    path: "packages/types",
    exports: [
      "Field",
      "FieldMeta",
      "FieldSchema",
      "Collection",
      "CollectionMeta",
      "Query",
      "Filter",
      "Relation",
      "RelationMeta",
      "DaaSFile",
      "PrimaryKey",
      "AnyItem",
    ],
  },
  {
    name: "@buildpad/services",
    description: "CRUD service classes for items, fields, and collections",
    path: "packages/services",
    exports: ["FieldsService", "CollectionsService", "apiRequest"],
  },
  {
    name: "@buildpad/hooks",
    description: "React hooks for managing relational data",
    path: "packages/hooks",
    exports: [
      "useRelationM2M",
      "useRelationM2MItems",
      "useRelationM2O",
      "useRelationM2OItem",
      "useRelationO2M",
      "useRelationO2MItems",
      "useRelationM2A",
      "useFiles",
      "api",
      "daasAPI",
    ],
  },
  {
    name: "@buildpad/ui-interfaces",
    description:
      "Field interface components (inputs, selects, file uploads, etc.)",
    path: "packages/ui-interfaces",
    exports: [],
  },
  {
    name: "@buildpad/ui-collections",
    description:
      "Dynamic collection components (CollectionForm, CollectionList)",
    path: "packages/ui-collections",
    exports: [],
  },
];

// Populate components on package references
PACKAGES[3].components = getAllComponents().filter(
  (c) => c.category !== "collection",
);
PACKAGES[4].components = getAllComponents().filter(
  (c) => c.category === "collection",
);

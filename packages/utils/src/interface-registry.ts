/**
 * Interface Registry
 * 
 * Singleton registry for managing interface definitions.
 * Supports both built-in interfaces and extension-registered interfaces.
 * 
 * @module @buildpad/utils/interface-registry
 *
 * @deprecated Dormant: nothing in Buildpad populates this registry and VForm never reads it. Interface identity lives in `INTERFACE_MANIFEST` (`interface-manifest`); custom interfaces register through VForm's `interfaces` prop or provider. Kept so existing imports keep compiling.
 */

import type {
  ComponentType,
  InterfaceDefinition,
  InterfaceMetadata,
  InterfaceRegistrationInput,
  InterfaceGroupDefinition,
  InterfaceGroup,
  InterfaceProps,
  FieldType,
  LocalType,
} from './interface-types';

/**
 * Group display names and descriptions
 */
const GROUP_INFO: Record<InterfaceGroup, { name: string; description: string }> = {
  standard: { name: 'Text & Numbers', description: 'Basic text and numeric input components' },
  selection: { name: 'Selection', description: 'Dropdowns, checkboxes, and selection components' },
  relational: { name: 'Relational', description: 'Relationship management components (M2M, M2O, O2M)' },
  presentation: { name: 'Presentation', description: 'Layout and organizational components' },
  group: { name: 'Groups', description: 'Field grouping components' },
  workflow: { name: 'Workflow', description: 'Workflow state and transition components' },
  other: { name: 'Other', description: 'Miscellaneous components' },
  system: { name: 'System', description: 'System administration components' },
};

/**
 * InterfaceRegistry class
 * 
 * Manages the collection of available interface definitions.
 * Provides methods for registration, lookup, and filtering.
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export class InterfaceRegistry {
  private interfaces: Map<string, InterfaceDefinition> = new Map();
  private componentCache: Map<string, ComponentType<InterfaceProps>> = new Map();

  /**
   * Register a new interface definition
   * 
   * @param definition - Interface definition to register
   * @throws Error if interface with same ID already exists
   */
  register<T = unknown>(definition: InterfaceRegistrationInput<T>): void {
    // Silently overwrite if already registered (useful for hot reload)

    const fullDefinition: InterfaceDefinition<T> = {
      supported: true,
      hasOptions: (definition.options?.length ?? 0) > 0,
      ...definition,
    };

    this.interfaces.set(definition.id, fullDefinition as InterfaceDefinition);

    // Cache component if provided
    if (definition.component) {
      this.componentCache.set(definition.id, definition.component as ComponentType<InterfaceProps>);
    }
  }

  /**
   * Register multiple interface definitions
   * 
   * @param definitions - Array of interface definitions
   */
  registerMany(definitions: InterfaceRegistrationInput[]): void {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  /**
   * Get an interface definition by ID
   * 
   * @param id - Interface ID
   * @returns Interface definition or undefined
   */
  get(id: string): InterfaceDefinition | undefined {
    return this.interfaces.get(id);
  }

  /**
   * Get the React component for an interface
   * 
   * @param id - Interface ID
   * @returns React component or undefined
   */
  getComponent(id: string): ComponentType<InterfaceProps> | undefined {
    return this.componentCache.get(id);
  }

  /**
   * Set or update the component for an interface
   * 
   * @param id - Interface ID
   * @param component - React component
   */
  setComponent(id: string, component: ComponentType<InterfaceProps>): void {
    this.componentCache.set(id, component);
    
    // Also update the definition if it exists
    const definition = this.interfaces.get(id);
    if (definition) {
      definition.component = component;
    }
  }

  /**
   * Check if an interface is registered
   * 
   * @param id - Interface ID
   * @returns true if registered
   */
  has(id: string): boolean {
    return this.interfaces.has(id);
  }

  /**
   * Get all registered interfaces
   * 
   * @param includeUnsupported - Include interfaces marked as unsupported
   * @returns Array of interface definitions
   */
  getAll(includeUnsupported = false): InterfaceDefinition[] {
    const all = Array.from(this.interfaces.values());
    return includeUnsupported ? all : all.filter(i => i.supported !== false);
  }

  /**
   * Get all interfaces as metadata (without components)
   * 
   * @param includeUnsupported - Include interfaces marked as unsupported
   * @returns Array of interface metadata
   */
  getAllMetadata(includeUnsupported = false): InterfaceMetadata[] {
    return this.getAll(includeUnsupported).map(({ component, ...metadata }) => metadata);
  }

  /**
   * Get interfaces that support a specific field type
   * 
   * @param type - Field type
   * @returns Array of interface definitions
   */
  getForType(type: FieldType): InterfaceDefinition[] {
    return this.getAll().filter(i => i.types.includes(type));
  }

  /**
   * Get interfaces that support a specific local type
   * 
   * @param localType - Local type (e.g., 'file', 'm2o')
   * @returns Array of interface definitions
   */
  getForLocalType(localType: LocalType): InterfaceDefinition[] {
    return this.getAll().filter(i => i.localTypes?.includes(localType));
  }

  /**
   * Get interfaces by group
   * 
   * @param group - Interface group
   * @returns Array of interface definitions
   */
  getByGroup(group: InterfaceGroup): InterfaceDefinition[] {
    return this.getAll().filter(i => i.group === group);
  }

  /**
   * Get interfaces grouped by category
   * 
   * @param includeEmpty - Include groups with no interfaces
   * @returns Array of interface group definitions
   */
  getGrouped(includeEmpty = false): InterfaceGroupDefinition[] {
    const groups: InterfaceGroupDefinition[] = [];

    for (const [key, info] of Object.entries(GROUP_INFO)) {
      const groupKey = key as InterfaceGroup;
      const interfaces = this.getByGroup(groupKey).map(({ component, ...metadata }) => metadata);

      if (includeEmpty || interfaces.length > 0) {
        groups.push({
          key: groupKey,
          name: info.name,
          description: info.description,
          interfaces,
        });
      }
    }

    return groups;
  }

  /**
   * Clear all registered interfaces
   * Useful for testing or hot reload
   */
  clear(): void {
    this.interfaces.clear();
    this.componentCache.clear();
  }

  /**
   * Get the number of registered interfaces
   */
  get size(): number {
    return this.interfaces.size;
  }

  /**
   * Unregister an interface
   * 
   * @param id - Interface ID to remove
   * @returns true if interface was removed
   */
  unregister(id: string): boolean {
    this.componentCache.delete(id);
    return this.interfaces.delete(id);
  }
}

/**
 * Global singleton instance of the InterfaceRegistry
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export const interfaceRegistry = new InterfaceRegistry();

/**
 * Get the global interface registry instance
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export function getInterfaceRegistry(): InterfaceRegistry {
  return interfaceRegistry;
}

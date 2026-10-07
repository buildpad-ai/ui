/**
 * Load Interfaces from Registry
 * 
 * Utility functions to load interface definitions from registry.json
 * and populate the InterfaceRegistry.
 * 
 * @module @buildpad/utils/load-interfaces
 *
 * @deprecated Dormant: loads registry.json into the unused InterfaceRegistry (and is not shipped to consumer projects). Interface identity lives in `INTERFACE_MANIFEST` (`interface-manifest`). Kept so existing imports keep compiling.
 */

import type { InterfaceMetadata, InterfaceGroup } from './interface-types';
import { interfaceRegistry, InterfaceRegistry } from './interface-registry';

/**
 * Interface metadata as stored in registry.json component entry
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export interface RegistryComponentInterface {
  id: string;
  name: string;
  icon: string;
  types: string[];
  localTypes?: string[];
  group: string;
  order?: number;
  supported?: boolean;
  recommended?: boolean;
  hasOptions?: boolean;
}

/**
 * Component entry from registry.json
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export interface RegistryComponent {
  name: string;
  title: string;
  description: string;
  category: string;
  files: Array<{ source: string; target: string }>;
  dependencies: string[];
  internalDependencies: string[];
  registryDependencies?: string[];
  interface?: RegistryComponentInterface;
}

/**
 * Registry.json structure
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export interface RegistryJson {
  $schema?: string;
  version: string;
  name: string;
  description: string;
  components: RegistryComponent[];
  categories: Array<{ name: string; title: string; description: string }>;
}

/**
 * Extract interface metadata from a registry component
 * 
 * @param component - Registry component entry
 * @returns Interface metadata or null if not defined
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export function extractInterfaceFromComponent(
  component: RegistryComponent
): InterfaceMetadata | null {
  if (!component.interface) {
    return null;
  }

  const { interface: intf } = component;

  return {
    id: intf.id,
    name: intf.name,
    icon: intf.icon,
    description: component.description,
    types: intf.types as InterfaceMetadata['types'],
    localTypes: intf.localTypes as InterfaceMetadata['localTypes'],
    group: intf.group as InterfaceGroup,
    order: intf.order ?? 0,
    supported: intf.supported ?? true,
    recommended: intf.recommended ?? false,
    hasOptions: intf.hasOptions ?? false,
    componentPath: component.files[0]?.target,
  };
}

/**
 * Load all interfaces from registry.json data
 * 
 * @param registryData - Parsed registry.json content
 * @param registry - Optional registry instance (defaults to global)
 * @returns Array of loaded interface metadata
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export function loadInterfacesFromRegistry(
  registryData: RegistryJson,
  registry: InterfaceRegistry = interfaceRegistry
): InterfaceMetadata[] {
  const interfaces: InterfaceMetadata[] = [];

  for (const component of registryData.components) {
    const metadata = extractInterfaceFromComponent(component);
    if (metadata) {
      registry.register(metadata);
      interfaces.push(metadata);
    }
  }

  return interfaces;
}

/**
 * Get all interface metadata from registry.json for API responses
 * 
 * This function is designed to be used in API routes to return
 * interface metadata without React components.
 * 
 * @param registryData - Parsed registry.json content
 * @returns Interface metadata grouped by category
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity.
 */
export function getInterfacesForApi(registryData: RegistryJson): {
  interfaces: InterfaceMetadata[];
  groups: Array<{
    key: InterfaceGroup;
    name: string;
    interfaces: InterfaceMetadata[];
  }>;
} {
  const interfaces: InterfaceMetadata[] = [];
  
  for (const component of registryData.components) {
    const metadata = extractInterfaceFromComponent(component);
    if (metadata && metadata.supported !== false) {
      interfaces.push(metadata);
    }
  }

  // Sort by order within each group
  interfaces.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Group by category
  const groupMap = new Map<InterfaceGroup, InterfaceMetadata[]>();
  const groupNames: Record<InterfaceGroup, string> = {
    standard: 'Text & Numbers',
    selection: 'Selection',
    relational: 'Relational',
    presentation: 'Presentation',
    group: 'Groups',
    workflow: 'Workflow',
    other: 'Other',
    system: 'System',
  };

  for (const intf of interfaces) {
    const group = intf.group as InterfaceGroup;
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }
    groupMap.get(group)!.push(intf);
  }

  const groups = Array.from(groupMap.entries()).map(([key, items]) => ({
    key,
    name: groupNames[key] || key,
    interfaces: items,
  }));

  return { interfaces, groups };
}

export default loadInterfacesFromRegistry;

/**
 * Define Interface Helper
 * 
 * Provides a type-safe way to define and register interface extensions.
 * Similar to DaaS's defineInterface() pattern.
 * 
 * @module @buildpad/utils/define-interface
 *
 * @deprecated Dormant: definitions made here register into the unused InterfaceRegistry and never reach VForm. Interface identity lives in `INTERFACE_MANIFEST` (`interface-manifest`); custom interfaces register through VForm's `interfaces` prop or provider. Kept so existing imports keep compiling.
 */

import type {
  ComponentType,
  InterfaceDefinition,
  InterfaceRegistrationInput,
  InterfaceProps,
  FieldType,
  LocalType,
  InterfaceGroup,
  InterfaceOption,
} from './interface-types';
import { interfaceRegistry, InterfaceRegistry } from './interface-registry';

/**
 * Configuration object for defineInterface
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export interface DefineInterfaceConfig<T = unknown> {
  /** Unique identifier for the interface */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Icon name (Tabler icon) */
  icon: string;
  /** Detailed description */
  description?: string;
  /** Database field types this interface supports */
  types: FieldType[];
  /** Local types like 'file', 'm2o', 'm2m', 'o2m', etc. */
  localTypes?: LocalType[];
  /** UI grouping category */
  group: InterfaceGroup;
  /** Sort order within group (lower = first) */
  order?: number;
  /** React component for rendering the interface */
  component?: ComponentType<InterfaceProps<T>>;
  /** Configuration options for the interface */
  options?: InterfaceOption[] | null;
  /** Whether this interface is recommended (shows star badge) */
  recommended?: boolean;
  /** Whether this interface is currently supported */
  supported?: boolean;
  /** Component file path for documentation */
  componentPath?: string;
  /** Keywords for search */
  keywords?: string[];
}

/**
 * Define a new interface with type safety
 * 
 * This function creates an interface definition object and optionally
 * registers it with the global registry.
 * 
 * @example
 * ```tsx
 * import { defineInterface } from '@buildpad/utils';
 * 
 * const textInput = defineInterface({
 *   id: 'text-input',
 *   name: 'Text Input',
 *   icon: 'IconForms',
 *   description: 'Basic text input field',
 *   types: ['string', 'text'],
 *   group: 'standard',
 *   component: TextInputComponent,
 *   options: [
 *     {
 *       field: 'placeholder',
 *       name: 'Placeholder',
 *       type: 'string',
 *       meta: {
 *         interface: 'input',
 *       }
 *     }
 *   ]
 * });
 * ```
 * 
 * @param config - Interface configuration
 * @param options - Additional options
 * @returns Full interface definition
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export function defineInterface<T = unknown>(
  config: DefineInterfaceConfig<T>,
  options?: {
    /** Whether to auto-register with the global registry (default: true) */
    register?: boolean;
    /** Custom registry to register with */
    registry?: InterfaceRegistry;
  }
): InterfaceDefinition<T> {
  const { register = true, registry = interfaceRegistry } = options ?? {};

  // Build the full definition with defaults
  const definition: InterfaceDefinition<T> = {
    id: config.id,
    name: config.name,
    icon: config.icon,
    description: config.description,
    types: config.types,
    localTypes: config.localTypes,
    group: config.group,
    order: config.order ?? 0,
    component: config.component,
    options: config.options,
    recommended: config.recommended ?? false,
    supported: config.supported ?? true,
    hasOptions: (config.options?.length ?? 0) > 0,
    componentPath: config.componentPath,
    keywords: config.keywords,
  };

  // Register if requested
  if (register) {
    registry.register(definition as InterfaceRegistrationInput);
  }

  return definition;
}

/**
 * Create multiple interface definitions at once
 * 
 * @example
 * ```tsx
 * import { defineInterfaces } from '@buildpad/utils';
 * 
 * const interfaces = defineInterfaces([
 *   { id: 'text', name: 'Text', icon: 'IconForms', types: ['string'], group: 'standard' },
 *   { id: 'number', name: 'Number', icon: 'IconNumber', types: ['integer', 'float'], group: 'standard' },
 * ]);
 * ```
 * 
 * @param configs - Array of interface configurations
 * @param options - Additional options
 * @returns Array of interface definitions
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export function defineInterfaces(
  configs: DefineInterfaceConfig[],
  options?: {
    register?: boolean;
    registry?: InterfaceRegistry;
  }
): InterfaceDefinition[] {
  return configs.map(config => defineInterface(config, options));
}

/**
 * Create an interface option definition
 * 
 * @example
 * ```tsx
 * const placeholderOption = createInterfaceOption({
 *   field: 'placeholder',
 *   name: 'Placeholder',
 *   type: 'string',
 *   meta: {
 *     interface: 'input',
 *     width: 'full',
 *   }
 * });
 * ```
 * 
 * @param option - Option configuration
 * @returns Interface option
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export function createInterfaceOption(option: InterfaceOption): InterfaceOption {
  return {
    ...option,
    meta: {
      interface: option.meta?.interface ?? 'input',
      width: option.meta?.width ?? 'full',
      ...option.meta,
    },
  };
}

/**
 * Create a group of related options (e.g., under a divider)
 * 
 * @param groupName - Name for the group (shown as header)
 * @param options - Options in the group
 * @returns Array with divider and options
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export function createOptionGroup(
  groupName: string,
  options: InterfaceOption[]
): InterfaceOption[] {
  return [
    {
      field: `divider-${groupName.toLowerCase().replace(/\s+/g, '-')}`,
      name: groupName,
      type: 'alias',
      meta: {
        interface: 'presentation-divider',
        special: ['alias', 'no-data'],
      },
    },
    ...options,
  ];
}

/**
 * Preset option creators for common interface options
 *
 * @deprecated Dormant (VForm never reads it). Use `INTERFACE_MANIFEST` for interface identity and VForm's `interfaces` prop or provider for custom interfaces.
 */
export const InterfaceOptions = {
  /** Create a placeholder text option */
  placeholder: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'placeholder',
    name: 'Placeholder',
    type: 'string',
    meta: {
      interface: 'input',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a required field option */
  required: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'required',
    name: 'Required',
    type: 'boolean',
    schema: { default_value: false },
    meta: {
      interface: 'boolean',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a disabled field option */
  disabled: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'disabled',
    name: 'Disabled',
    type: 'boolean',
    schema: { default_value: false },
    meta: {
      interface: 'boolean',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a soft length limit option */
  softLength: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'softLength',
    name: 'Soft Character Limit',
    type: 'integer',
    meta: {
      interface: 'input',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create trim whitespace option */
  trim: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'trim',
    name: 'Trim Whitespace',
    type: 'boolean',
    schema: { default_value: false },
    meta: {
      interface: 'boolean',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a minimum value option (for numbers) */
  min: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'min',
    name: 'Minimum Value',
    type: 'integer',
    meta: {
      interface: 'input',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a maximum value option (for numbers) */
  max: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'max',
    name: 'Maximum Value',
    type: 'integer',
    meta: {
      interface: 'input',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create a step option (for sliders/numbers) */
  step: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'step',
    name: 'Step Interval',
    type: 'integer',
    schema: { default_value: 1 },
    meta: {
      interface: 'input',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create choices option for select/dropdown */
  choices: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'choices',
    name: 'Choices',
    type: 'json',
    meta: {
      interface: 'list',
      width: 'full',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create allow other option for dropdowns */
  allowOther: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'allowOther',
    name: 'Allow Other',
    type: 'boolean',
    schema: { default_value: false },
    meta: {
      interface: 'boolean',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),

  /** Create allow none option for dropdowns */
  allowNone: (defaults?: Partial<InterfaceOption>): InterfaceOption => ({
    field: 'allowNone',
    name: 'Allow None',
    type: 'boolean',
    schema: { default_value: true },
    meta: {
      interface: 'boolean',
      width: 'half',
      ...defaults?.meta,
    },
    ...defaults,
  }),
};

export default defineInterface;

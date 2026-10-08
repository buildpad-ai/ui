/**
 * Interface Types
 * 
 * Type definitions for the Interface Extension System.
 * Mirrors DaaS InterfaceConfig but adapted for React.
 * 
 * @module @buildpad/utils/interface-types
 */

// Use a generic function component type to avoid react dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentType<P = Record<string, unknown>> = (props: P) => any;

/**
 * Supported field types that interfaces can handle
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'boolean'
  | 'integer'
  | 'bigInteger'
  | 'float'
  | 'decimal'
  | 'timestamp'
  | 'dateTime'
  | 'date'
  | 'time'
  | 'json'
  | 'csv'
  | 'uuid'
  | 'hash'
  | 'binary'
  | 'alias'
  | 'geometry'
  | 'unknown';

/**
 * Local types for relationship and special fields
 */
export type LocalType =
  | 'standard'
  | 'file'
  | 'files'
  | 'm2o'
  | 'o2m'
  | 'm2m'
  | 'm2a'
  | 'presentation'
  | 'translations'
  | 'group'
  | 'workflow'
  | 'geometry';

/**
 * Interface groupings for UI display (the registry's `interface.group`)
 */
export type InterfaceGroup =
  | 'standard'
  | 'selection'
  | 'relational'
  | 'presentation'
  | 'group'
  | 'workflow'
  | 'other'
  | 'system';

/**
 * Common props passed to all interface components
 */
export interface InterfaceProps<T = unknown> {
  /** Current field value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Field label */
  label?: string;
  /** Field description/note */
  description?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Collection name (for relational interfaces) */
  collection?: string;
  /** Field name */
  field?: string;
  /** Primary key value */
  primaryKey?: string | number;
  /** Form context */
  context?: 'create' | 'edit';
  /** Layout width */
  width?: 'half' | 'half-left' | 'half-right' | 'full' | 'fill';
}

/**
 * Configuration option for an interface
 * Used to define customizable settings in the Data Model UI
 */
export interface InterfaceOption {
  /** Option field name (stored in meta.options) */
  field: string;
  /** Display name */
  name: string;
  /** Option type */
  type: 'string' | 'integer' | 'boolean' | 'json' | 'select' | 'alias';
  /** Default value */
  default?: unknown;
  /** Meta configuration for the option field */
  meta?: InterfaceOptionMeta;
  /** Schema configuration */
  schema?: {
    default_value?: unknown;
  };
}

/**
 * Meta configuration for interface options
 */
export interface InterfaceOptionMeta {
  interface?: string;
  width?: 'half' | 'full';
  options?: Record<string, unknown>;
  special?: string[];
}

/**
 * Full interface definition
 * Used to register interfaces in the InterfaceRegistry
 */
export interface InterfaceDefinition<T = unknown> {
  /** Unique identifier for the interface (e.g., 'input', 'select-dropdown') */
  id: string;
  /** Display name shown in the Data Model UI */
  name: string;
  /** Icon name (Material Icons or Tabler Icons) */
  icon: string;
  /** Short description of the interface */
  description?: string;
  /** React component that renders the interface */
  component?: ComponentType<InterfaceProps<T>>;
  /** Component name (for lazy loading) */
  componentName?: string;
  /** Field types this interface supports */
  types: FieldType[];
  /** Local types this interface supports */
  localTypes?: LocalType[];
  /** Interface grouping for UI display */
  group: InterfaceGroup;
  /** Whether this interface handles relationships */
  relational?: boolean;
  /** Configuration options for the interface */
  options?: InterfaceOption[] | null;
  /** Whether the interface is currently supported/implemented */
  supported?: boolean;
  /** Whether this is a recommended interface (shows star badge) */
  recommended?: boolean;
  /** Whether the interface has configurable options */
  hasOptions?: boolean;
  /** Recommended display types for this interface */
  recommendedDisplays?: string[];
  /** SVG preview for interface selection drawer */
  preview?: string;
  /** Sort order in the interface list */
  order?: number;
  /** Whether this is a system interface */
  system?: boolean;
  /** Component file path for documentation */
  componentPath?: string;
  /** Keywords for search */
  keywords?: string[];
}

/**
 * Interface registration input (subset of InterfaceDefinition)
 * Allows partial definitions when registering
 */
export type InterfaceRegistrationInput<T = unknown> = Omit<InterfaceDefinition<T>, 'supported'> & {
  supported?: boolean;
};

/**
 * Interface metadata (without component)
 * Used for API responses and registry listing
 */
export type InterfaceMetadata = Omit<InterfaceDefinition, 'component'>;

/**
 * Group of interfaces for UI display
 */
export interface InterfaceGroupDefinition {
  /** Group key */
  key: InterfaceGroup;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Interfaces in this group */
  interfaces: InterfaceMetadata[];
}

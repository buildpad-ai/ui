/**
 * Core type definitions for the Content Module
 * Inspired by DaaS types
 */

export type PrimaryKey = string | number;

export type AnyItem = Record<string, unknown>;

/**
 * Filter operators for querying items
 */
export interface Filter {
  _and?: Filter[];
  _or?: Filter[];
  [field: string]: unknown;
}

/**
 * Query parameters for fetching items
 */
export interface Query {
  fields?: string[];
  filter?: Filter;
  search?: string;
  sort?: string | string[];
  limit?: number;
  offset?: number;
  page?: number;
  meta?: string[];
  aggregate?: Record<string, unknown>;
}

/**
 * Collection metadata
 */
export interface CollectionMeta {
  collection: string;
  icon?: string;
  color?: string;
  note?: string;
  display_template?: string;
  hidden?: boolean;
  singleton?: boolean;
  translations?: Array<{
    language: string;
    translation: string;
    singular: string;
    plural: string;
  }> | null;
  archive_field?: string;
  archive_app_filter?: boolean;
  archive_value?: string;
  unarchive_value?: string;
  sort_field?: string;
  accountability?: 'all' | 'activity';
  group?: string | null;
  collapse?: 'open' | 'closed' | 'locked';
  sort?: number;
  item_duplication_fields?: string[] | null;
  preview_url?: string;
  versioning?: boolean;
}

/**
 * Field schema (database column info)
 */
export interface FieldSchema {
  name: string;
  table: string;
  data_type: string;
  default_value?: unknown;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  is_nullable: boolean;
  is_unique: boolean;
  is_primary_key: boolean;
  has_auto_increment: boolean;
  foreign_key_column?: string | null;
  foreign_key_table?: string | null;
}

/**
 * Field display width
 */
export type FieldWidth = 'half' | 'half-left' | 'half-right' | 'full' | 'fill';

/**
 * Field metadata
 */
export interface FieldMeta {
  id: number;
  collection: string;
  field: string;
  special?: string[] | null;
  interface?: string | null;
  options?: Record<string, unknown> | null;
  display?: string | null;
  display_options?: Record<string, unknown> | null;
  readonly: boolean;
  hidden: boolean;
  sort?: number | null;
  width?: FieldWidth | null;
  translations?: Array<{
    language: string;
    translation: string;
  }> | null;
  note?: string | null;
  conditions?: unknown;
  required?: boolean;
  group?: string | null;
  validation?: Record<string, unknown> | null;
  validation_message?: string | null;
}

/**
 * Field definition
 */
export interface Field {
  collection: string;
  field: string;
  type: string;
  schema?: FieldSchema;
  meta?: FieldMeta | null;
}

/**
 * Collection definition
 */
export interface Collection {
  collection: string;
  meta: CollectionMeta | null;
  schema: {
    name: string;
    comment?: string | null;
  } | null;
  fields?: Field[];
}

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'share';

/**
 * Permission definition
 */
export interface Permission {
  id: string;
  role: string | null;
  policy?: string | null;
  collection: string;
  action: PermissionAction;
  permissions?: Filter | null;
  validation?: Filter | null;
  presets?: Record<string, unknown> | null;
  fields?: string[] | null;
}

/**
 * Accountability context (current user)
 */
export interface Accountability {
  user: string;
  role: string | null;
  admin: boolean;
  app: boolean;
  ip?: string;
  userAgent?: string;
}

/**
 * Mutation tracking for batch operations
 */
export interface MutationTracker {
  trackMutations(count: number): void;
  getCount(): number;
}

/**
 * Options for creating services
 */
export interface AbstractServiceOptions {
  knex?: unknown;
  accountability?: Accountability | null;
  nested?: string[];
}

/**
 * Mutation options
 */
export interface MutationOptions {
  autoPurgeCache?: boolean;
  autoPurgeSystemCache?: boolean;
  bypassLimits?: boolean;
  emitEvents?: boolean;
  mutationTracker?: MutationTracker;
}

/**
 * Bookmark for saved presets
 */
export interface Bookmark {
  id: number;
  user: string;
  collection: string;
  bookmark: string;
  icon?: string;
  color?: string;
  role?: string | null;
  filter?: Filter | null;
  search?: string | null;
  layout?: string | null;
  layout_query?: Record<string, unknown> | null;
  layout_options?: Record<string, unknown> | null;
}

/**
 * Layout preset
 */
export interface Preset {
  bookmark?: string | null;
  user?: string | null;
  role?: string | null;
  collection: string;
  search?: string | null;
  layout?: string | null;
  layout_query?: Record<string, unknown> | null;
  layout_options?: Record<string, unknown> | null;
  refresh_interval?: number | null;
  filter?: Filter | null;
  icon?: string;
  color?: string;
}

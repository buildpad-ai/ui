/**
 * Filter types for the Directus-compatible permission filter editor.
 * Ported from the buildpad-daas admin (`lib/filter/types.ts`).
 *
 * The wire type for a stored filter is `Filter` from `@buildpad/types`
 * (index-signature record, so field-keyed conditions type-check); the
 * types below model the editor's view of that JSON.
 */
import type { Filter } from '@buildpad/types';

export type { Filter };

// Filter operators supported by the system
export type FilterOperator =
  | '_eq'       // Equals
  | '_neq'      // Not equals
  | '_lt'       // Less than
  | '_lte'      // Less than or equal
  | '_gt'       // Greater than
  | '_gte'      // Greater than or equal
  | '_in'       // In array
  | '_nin'      // Not in array
  | '_null'     // Is null
  | '_nnull'    // Is not null
  | '_contains'    // Contains (string)
  | '_ncontains'   // Not contains (string)
  | '_icontains'   // Contains (case-insensitive)
  | '_starts_with' // Starts with
  | '_nstarts_with' // Not starts with
  | '_istarts_with' // Starts with (case-insensitive)
  | '_ends_with'   // Ends with
  | '_nends_with'  // Not ends with
  | '_iends_with'  // Ends with (case-insensitive)
  | '_between'     // Between (two values)
  | '_nbetween'    // Not between
  | '_empty'       // Is empty string
  | '_nempty'      // Is not empty string
  | '_has'         // Has related items (relational)
  | '_regex'       // Matches regular expression
  | '_nicontains'  // Does not contain (case-insensitive)
  | '_nistarts_with' // Does not start with (case-insensitive)
  | '_niends_with'; // Does not end with (case-insensitive)

// Logical operators
export type LogicalOperator = '_and' | '_or';

// Filter value types
export type FilterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | [unknown, unknown]; // For between

// Dynamic value placeholders
export const DYNAMIC_VALUES = {
  '$CURRENT_USER': 'Current User ID',
  '$CURRENT_ROLE': 'Current User Role',
  '$NOW': 'Current Date/Time',
  '$CURRENT_ROLES': 'Current User Roles (array)',
  '$CURRENT_POLICIES': 'Current User Policies (array)',
  '$CURRENT_RESOURCE_URI': 'Current Resource URI',
} as const;

export type DynamicValue = keyof typeof DYNAMIC_VALUES;

// Parsed filter node for rendering
export interface FilterNode {
  id: string;
  type: 'field' | 'group';
  // For field type
  field?: string;
  operator?: FilterOperator;
  value?: FilterValue | DynamicValue;
  // For group type
  logical?: LogicalOperator;
  children?: FilterNode[];
}

// Field info for field selection
export interface FilterFieldInfo {
  field: string;
  name: string;
  type: string;
  collection: string;
}

// Operator info with metadata
export interface OperatorInfo {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'date' | 'none' | 'range';
  /** If set, shown as an inline warning when this operator is selected in a permission filter */
  relationalLimitation?: string;
}

/**
 * Relation info for the filter editor.
 * Describes a relation from the current collection to a related collection.
 */
export interface RelationInfo {
  /** Field alias on the current collection (e.g. 'roles', 'author') */
  field: string;
  /** Relation type */
  relationType: 'm2o' | 'm2m' | 'o2m';
  /** The related collection name */
  relatedCollection: string;
}

/**
 * Get filter operators for a specific field type
 */
export function getOperatorsForType(type: string): OperatorInfo[] {
  const textOperators: OperatorInfo[] = [
    { value: '_eq', label: 'Equals', requiresValue: true, valueType: 'string' },
    { value: '_neq', label: 'Not equals', requiresValue: true, valueType: 'string' },
    { value: '_contains', label: 'Contains', requiresValue: true, valueType: 'string' },
    { value: '_ncontains', label: 'Not contains', requiresValue: true, valueType: 'string' },
    { value: '_icontains', label: 'Contains (case-insensitive)', requiresValue: true, valueType: 'string' },
    { value: '_starts_with', label: 'Starts with', requiresValue: true, valueType: 'string' },
    { value: '_nstarts_with', label: 'Not starts with', requiresValue: true, valueType: 'string' },
    { value: '_ends_with', label: 'Ends with', requiresValue: true, valueType: 'string' },
    { value: '_nends_with', label: 'Not ends with', requiresValue: true, valueType: 'string' },
    { value: '_in', label: 'One of', requiresValue: true, valueType: 'array' },
    { value: '_nin', label: 'Not one of', requiresValue: true, valueType: 'array' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
    { value: '_empty', label: 'Is empty', requiresValue: false, valueType: 'none' },
    { value: '_nempty', label: 'Is not empty', requiresValue: false, valueType: 'none' },
  ];

  const numberOperators: OperatorInfo[] = [
    { value: '_eq', label: 'Equals', requiresValue: true, valueType: 'number' },
    { value: '_neq', label: 'Not equals', requiresValue: true, valueType: 'number' },
    { value: '_lt', label: 'Less than', requiresValue: true, valueType: 'number' },
    { value: '_lte', label: 'Less than or equal', requiresValue: true, valueType: 'number' },
    { value: '_gt', label: 'Greater than', requiresValue: true, valueType: 'number' },
    { value: '_gte', label: 'Greater than or equal', requiresValue: true, valueType: 'number' },
    { value: '_between', label: 'Between', requiresValue: true, valueType: 'range' },
    { value: '_nbetween', label: 'Not between', requiresValue: true, valueType: 'range' },
    { value: '_in', label: 'One of', requiresValue: true, valueType: 'array' },
    { value: '_nin', label: 'Not one of', requiresValue: true, valueType: 'array' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
  ];

  const booleanOperators: OperatorInfo[] = [
    { value: '_eq', label: 'Equals', requiresValue: true, valueType: 'boolean' },
    { value: '_neq', label: 'Not equals', requiresValue: true, valueType: 'boolean' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
  ];

  const dateOperators: OperatorInfo[] = [
    { value: '_eq', label: 'Equals', requiresValue: true, valueType: 'date' },
    { value: '_neq', label: 'Not equals', requiresValue: true, valueType: 'date' },
    { value: '_lt', label: 'Before', requiresValue: true, valueType: 'date' },
    { value: '_lte', label: 'On or before', requiresValue: true, valueType: 'date' },
    { value: '_gt', label: 'After', requiresValue: true, valueType: 'date' },
    { value: '_gte', label: 'On or after', requiresValue: true, valueType: 'date' },
    { value: '_between', label: 'Between', requiresValue: true, valueType: 'range' },
    { value: '_nbetween', label: 'Not between', requiresValue: true, valueType: 'range' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
  ];

  const uuidOperators: OperatorInfo[] = [
    { value: '_eq', label: 'Equals', requiresValue: true, valueType: 'string' },
    { value: '_neq', label: 'Not equals', requiresValue: true, valueType: 'string' },
    { value: '_in', label: 'One of', requiresValue: true, valueType: 'array' },
    { value: '_nin', label: 'Not one of', requiresValue: true, valueType: 'array' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
  ];

  switch (type.toLowerCase()) {
    case 'boolean':
      return booleanOperators;
    case 'integer':
    case 'biginteger':
    case 'float':
    case 'decimal':
    case 'bigint':
    case 'int':
    case 'numeric':
      return numberOperators;
    case 'datetime':
    case 'date':
    case 'time':
    case 'timestamp':
    case 'timestamptz':
    case 'timestamp with time zone':
      return dateOperators;
    case 'uuid':
      return uuidOperators;
    case 'json':
    case 'jsonb':
      return [
        { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
        { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
      ];
    case 'string':
    case 'text':
    case 'varchar':
    case 'char':
    case 'character varying':
    default:
      return textOperators;
  }
}

/**
 * Get filter operators for a relation field (bare alias, not dot-notation).
 * Used when filtering on a relation alias itself (e.g. "roles") rather than
 * a specific column on the related table.
 */
export function getOperatorsForRelation(): OperatorInfo[] {
  return [
    { value: '_has', label: 'Has related items', requiresValue: true, valueType: 'boolean', relationalLimitation: 'Requires two-step query on child mutations (update/delete). Performance cost: +1 SELECT per operation.' },
    { value: '_null', label: 'Is null', requiresValue: false, valueType: 'none' },
    { value: '_nnull', label: 'Is not null', requiresValue: false, valueType: 'none' },
  ];
}

/**
 * Utility functions for the permission filter editor.
 * Ported from the buildpad-daas admin (`lib/filter/utils.ts`), plus
 * `hasRelationalFilterKeys` lifted from its `FilterRuleBuilder`.
 */

import type {
  Filter,
  FilterNode,
  FilterOperator,
  FilterValue,
  LogicalOperator,
  DynamicValue,
} from './PermissionFilterTypes';

/**
 * Generate a unique ID for filter nodes
 * Uses crypto.randomUUID when available, falls back to a simple random string
 */
export function generateNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'node_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Check if a value is a dynamic variable (starts with $)
 */
export function isDynamicVariable(value: unknown): value is DynamicValue {
  return typeof value === 'string' && value.startsWith('$');
}

/**
 * Get the first key from an object that's not a logical operator
 */
function getFieldFromObject(obj: Record<string, unknown>): string | null {
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key !== '_and' && key !== '_or') {
      return key;
    }
  }
  return null;
}

/**
 * Get the operator from a field filter condition
 */
function getOperatorFromCondition(condition: Record<string, unknown>): FilterOperator | null {
  const keys = Object.keys(condition);
  for (const key of keys) {
    if (key.startsWith('_')) {
      return key as FilterOperator;
    }
  }
  return null;
}

/**
 * Parse a filter object into a tree of FilterNodes for rendering
 */
export function parseFilterToNodes(filter: Filter | null | undefined): FilterNode[] {
  if (!filter || typeof filter !== 'object') {
    return [];
  }

  // Handle _and at root level
  if ('_and' in filter && Array.isArray(filter._and)) {
    return filter._and.map((item) => parseFilterItem(item)).filter(Boolean) as FilterNode[];
  }

  // Handle _or at root level
  if ('_or' in filter && Array.isArray(filter._or)) {
    return [{
      id: generateNodeId(),
      type: 'group',
      logical: '_or',
      children: filter._or.map((item) => parseFilterItem(item)).filter(Boolean) as FilterNode[],
    }];
  }

  // Single filter condition at root
  const node = parseFilterItem(filter);
  return node ? [node] : [];
}

/**
 * Parse a single filter item (field or group)
 */
function parseFilterItem(item: unknown): FilterNode | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const obj = item as Record<string, unknown>;

  // Check for logical group (_and or _or)
  if ('_and' in obj && Array.isArray(obj._and)) {
    return {
      id: generateNodeId(),
      type: 'group',
      logical: '_and',
      children: obj._and.map((child) => parseFilterItem(child)).filter(Boolean) as FilterNode[],
    };
  }

  if ('_or' in obj && Array.isArray(obj._or)) {
    return {
      id: generateNodeId(),
      type: 'group',
      logical: '_or',
      children: obj._or.map((child) => parseFilterItem(child)).filter(Boolean) as FilterNode[],
    };
  }

  // Field filter
  const field = getFieldFromObject(obj);
  if (field) {
    const condition = obj[field] as Record<string, unknown>;
    if (condition && typeof condition === 'object') {
      const operator = getOperatorFromCondition(condition);
      if (operator) {
        return {
          id: generateNodeId(),
          type: 'field',
          field,
          operator,
          value: condition[operator] as FilterValue,
        };
      }
    }
  }

  return null;
}

/**
 * Convert FilterNodes back to a filter object for API/storage
 */
export function nodesToFilter(nodes: FilterNode[]): Filter | null {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  // Single node at root
  if (nodes.length === 1) {
    const node = nodes[0];
    if (node.type === 'group' && node.logical === '_and') {
      // Unwrap single _and group to be the root _and
      const children = (node.children || []).map((child) => nodeToFilterItem(child)).filter(Boolean);
      if (children.length === 0) return null;
      return { _and: children as Filter[] };
    }
    return nodeToFilterItem(node);
  }

  // Multiple nodes wrapped in _and
  const items = nodes.map((node) => nodeToFilterItem(node)).filter(Boolean);
  if (items.length === 0) return null;
  return { _and: items as Filter[] };
}

/**
 * Convert a single FilterNode to a filter object
 */
function nodeToFilterItem(node: FilterNode): Filter | null {
  if (node.type === 'field' && node.field && node.operator) {
    return {
      [node.field]: {
        [node.operator]: node.value ?? null,
      },
    };
  }

  if (node.type === 'group' && node.logical) {
    const children = (node.children || []).map((child) => nodeToFilterItem(child)).filter(Boolean);
    if (children.length === 0) return null;
    return {
      [node.logical]: children,
    } as Filter;
  }

  return null;
}

/**
 * Create a new field filter node
 */
export function createFieldNode(field: string, operator: FilterOperator = '_eq', value: FilterValue = null): FilterNode {
  return {
    id: generateNodeId(),
    type: 'field',
    field,
    operator,
    value,
  };
}

/**
 * Create a new group node
 */
export function createGroupNode(logical: LogicalOperator = '_and', children: FilterNode[] = []): FilterNode {
  return {
    id: generateNodeId(),
    type: 'group',
    logical,
    children,
  };
}

/**
 * Update a node in the tree by ID
 */
export function updateNodeById(nodes: FilterNode[], nodeId: string, updates: Partial<FilterNode>): FilterNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.type === 'group' && node.children) {
      return {
        ...node,
        children: updateNodeById(node.children, nodeId, updates),
      };
    }
    return node;
  });
}

/**
 * Remove a node from the tree by ID
 */
export function removeNodeById(nodes: FilterNode[], nodeId: string): FilterNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.type === 'group' && node.children) {
        return {
          ...node,
          children: removeNodeById(node.children, nodeId),
        };
      }
      return node;
    });
}

/**
 * Add a node to a group by group ID
 */
export function addNodeToGroup(nodes: FilterNode[], groupId: string | null, newNode: FilterNode): FilterNode[] {
  // If no groupId, add to root level
  if (!groupId) {
    return [...nodes, newNode];
  }

  return nodes.map((node) => {
    if (node.id === groupId && node.type === 'group') {
      return {
        ...node,
        children: [...(node.children || []), newNode],
      };
    }
    if (node.type === 'group' && node.children) {
      return {
        ...node,
        children: addNodeToGroup(node.children, groupId, newNode),
      };
    }
    return node;
  });
}

/**
 * Toggle logical operator of a group node
 */
export function toggleGroupLogical(nodes: FilterNode[], groupId: string): FilterNode[] {
  return nodes.map((node) => {
    if (node.id === groupId && node.type === 'group') {
      return {
        ...node,
        logical: node.logical === '_and' ? '_or' : '_and',
      };
    }
    if (node.type === 'group' && node.children) {
      return {
        ...node,
        children: toggleGroupLogical(node.children, groupId),
      };
    }
    return node;
  });
}

/**
 * Validate a filter node
 */
export function validateNode(node: FilterNode): { valid: boolean; error?: string } {
  if (node.type === 'field') {
    if (!node.field) {
      return { valid: false, error: 'Field is required' };
    }
    if (!node.operator) {
      return { valid: false, error: 'Operator is required' };
    }
    // Check if operator requires a value
    const noValueOperators = ['_null', '_nnull', '_empty', '_nempty'];
    if (!noValueOperators.includes(node.operator)) {
      if (node.value === undefined || node.value === '') {
        return { valid: false, error: 'Value is required' };
      }
    }
  }

  if (node.type === 'group') {
    if (!node.children || node.children.length === 0) {
      return { valid: false, error: 'Group must have at least one condition' };
    }
    for (const child of node.children) {
      const result = validateNode(child);
      if (!result.valid) {
        return result;
      }
    }
  }

  return { valid: true };
}

/**
 * Validate all nodes
 */
export function validateNodes(nodes: FilterNode[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const node of nodes) {
    const result = validateNode(node);
    if (!result.valid && result.error) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * True when a filter uses operators with limited relational enforcement
 * (`_has`, dot-notation field paths, or `_some`/`_none`), which fall back
 * to a two-step query on child mutations.
 */
export function hasRelationalFilterKeys(filter: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (key.includes('.')) return true;
    if (key === '_has') return true;
    if (key === '_some' || key === '_none') return true;
    if ((key === '_and' || key === '_or') && Array.isArray(value)) {
      for (const sub of value) {
        if (typeof sub === 'object' && sub !== null && hasRelationalFilterKeys(sub as Record<string, unknown>)) {
          return true;
        }
      }
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (hasRelationalFilterKeys(value as Record<string, unknown>)) return true;
    }
  }
  return false;
}

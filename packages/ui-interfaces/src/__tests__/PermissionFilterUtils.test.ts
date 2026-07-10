import {
  parseFilterToNodes,
  nodesToFilter,
  createFieldNode,
  createGroupNode,
  updateNodeById,
  removeNodeById,
  addNodeToGroup,
  toggleGroupLogical,
  validateNode,
  validateNodes,
  isDynamicVariable,
  hasRelationalFilterKeys,
} from '../system-permissions/PermissionFilterUtils';
import {
  getOperatorsForType,
  getOperatorsForRelation,
  DYNAMIC_VALUES,
} from '../system-permissions/PermissionFilterTypes';
import type { Filter, FilterNode } from '../system-permissions/PermissionFilterTypes';

describe('parseFilterToNodes', () => {
  it('returns [] for null/undefined/non-object', () => {
    expect(parseFilterToNodes(null)).toEqual([]);
    expect(parseFilterToNodes(undefined)).toEqual([]);
  });

  it('parses a single field condition at root', () => {
    const nodes = parseFilterToNodes({ status: { _eq: 'active' } });
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'field', field: 'status', operator: '_eq', value: 'active' });
  });

  it('flattens a root _and into top-level nodes', () => {
    const nodes = parseFilterToNodes({
      _and: [{ status: { _eq: 'active' } }, { age: { _gte: 18 } }],
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ type: 'field', field: 'status', operator: '_eq' });
    expect(nodes[1]).toMatchObject({ type: 'field', field: 'age', operator: '_gte', value: 18 });
  });

  it('wraps a root _or into a single group node', () => {
    const nodes = parseFilterToNodes({
      _or: [{ status: { _eq: 'active' } }, { status: { _eq: 'invited' } }],
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('group');
    expect(nodes[0].logical).toBe('_or');
    expect(nodes[0].children).toHaveLength(2);
  });

  it('parses nested groups', () => {
    const nodes = parseFilterToNodes({
      _and: [
        { status: { _eq: 'active' } },
        { _or: [{ role: { _eq: 'admin' } }, { role: { _eq: 'editor' } }] },
      ],
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[1].type).toBe('group');
    expect(nodes[1].logical).toBe('_or');
    expect(nodes[1].children).toHaveLength(2);
  });

  it('preserves dynamic variable values', () => {
    const nodes = parseFilterToNodes({ user: { _eq: '$CURRENT_USER' } });
    expect(nodes[0].value).toBe('$CURRENT_USER');
  });
});

describe('nodesToFilter', () => {
  it('returns null for empty input', () => {
    expect(nodesToFilter([])).toBeNull();
  });

  it('serializes a single field node without wrapping', () => {
    const filter = nodesToFilter([createFieldNode('status', '_eq', 'active')]);
    expect(filter).toEqual({ status: { _eq: 'active' } });
  });

  it('wraps multiple nodes in _and', () => {
    const filter = nodesToFilter([
      createFieldNode('status', '_eq', 'active'),
      createFieldNode('age', '_gte', 18),
    ]);
    expect(filter).toEqual({ _and: [{ status: { _eq: 'active' } }, { age: { _gte: 18 } }] });
  });

  it('serializes group nodes with their logical operator', () => {
    const filter = nodesToFilter([
      createGroupNode('_or', [
        createFieldNode('role', '_eq', 'admin'),
        createFieldNode('role', '_eq', 'editor'),
      ]),
    ]);
    expect(filter).toEqual({ _or: [{ role: { _eq: 'admin' } }, { role: { _eq: 'editor' } }] });
  });

  it('drops empty groups', () => {
    expect(nodesToFilter([createGroupNode('_or', [])])).toBeNull();
  });

  it('defaults missing values to null', () => {
    const filter = nodesToFilter([createFieldNode('deleted_at', '_null')]);
    expect(filter).toEqual({ deleted_at: { _null: null } });
  });
});

describe('roundtrip parse ↔ serialize', () => {
  const cases: Array<[string, Filter]> = [
    ['single condition', { status: { _eq: 'active' } }],
    ['root _and', { _and: [{ status: { _eq: 'active' } }, { age: { _gte: 18 } }] }],
    [
      'nested _or in _and',
      { _and: [{ status: { _eq: 'active' } }, { _or: [{ a: { _eq: 1 } }, { b: { _eq: 2 } }] }] },
    ],
  ];

  it.each(cases)('%s survives a roundtrip', (_name, filter) => {
    expect(nodesToFilter(parseFilterToNodes(filter))).toEqual(filter);
  });
});

describe('node CRUD helpers', () => {
  it('updateNodeById updates nested nodes', () => {
    const child = createFieldNode('a', '_eq', 1);
    const nodes = [createGroupNode('_and', [child])];
    const updated = updateNodeById(nodes, child.id, { value: 2 });
    expect(updated[0].children?.[0].value).toBe(2);
  });

  it('removeNodeById removes nested nodes', () => {
    const child = createFieldNode('a', '_eq', 1);
    const nodes = [createGroupNode('_and', [child])];
    const removed = removeNodeById(nodes, child.id);
    expect(removed[0].children).toHaveLength(0);
  });

  it('addNodeToGroup appends to root when groupId is null', () => {
    const nodes = addNodeToGroup([], null, createFieldNode('a'));
    expect(nodes).toHaveLength(1);
  });

  it('addNodeToGroup appends into the matching group', () => {
    const group = createGroupNode('_or', []);
    const nodes = addNodeToGroup([group], group.id, createFieldNode('a'));
    expect(nodes[0].children).toHaveLength(1);
  });

  it('toggleGroupLogical flips _and ↔ _or', () => {
    const group = createGroupNode('_and', [createFieldNode('a', '_eq', 1)]);
    const toggled = toggleGroupLogical([group], group.id);
    expect(toggled[0].logical).toBe('_or');
    expect(toggleGroupLogical(toggled, group.id)[0].logical).toBe('_and');
  });
});

describe('validation', () => {
  it('requires field, operator, and value when the operator needs one', () => {
    expect(validateNode({ id: 'x', type: 'field' } as FilterNode).valid).toBe(false);
    expect(validateNode(createFieldNode('a', '_eq', '')).valid).toBe(false);
    expect(validateNode(createFieldNode('a', '_eq', 'v')).valid).toBe(true);
  });

  it('accepts no-value operators without a value', () => {
    expect(validateNode({ id: 'x', type: 'field', field: 'a', operator: '_nnull' }).valid).toBe(true);
  });

  it('rejects empty groups and validates children', () => {
    expect(validateNode(createGroupNode('_and', [])).valid).toBe(false);
    const bad = createGroupNode('_and', [createFieldNode('a', '_eq', '')]);
    expect(validateNode(bad).valid).toBe(false);
  });

  it('validateNodes collects errors', () => {
    const result = validateNodes([createFieldNode('a', '_eq', ''), createGroupNode('_or', [])]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('isDynamicVariable', () => {
  it('recognizes $-prefixed strings only', () => {
    expect(isDynamicVariable('$CURRENT_USER')).toBe(true);
    expect(isDynamicVariable('CURRENT_USER')).toBe(false);
    expect(isDynamicVariable(42)).toBe(false);
  });

  it('every documented dynamic value passes', () => {
    for (const key of Object.keys(DYNAMIC_VALUES)) {
      expect(isDynamicVariable(key)).toBe(true);
    }
  });
});

describe('hasRelationalFilterKeys', () => {
  it('detects _has, dot-notation, _some/_none at any depth', () => {
    expect(hasRelationalFilterKeys({ roles: { _has: true } })).toBe(true);
    expect(hasRelationalFilterKeys({ 'author.name': { _eq: 'x' } })).toBe(true);
    expect(hasRelationalFilterKeys({ _and: [{ items: { _some: { a: { _eq: 1 } } } }] })).toBe(true);
    expect(hasRelationalFilterKeys({ _or: [{ _and: [{ tags: { _none: {} } }] }] })).toBe(true);
  });

  it('returns false for plain field filters', () => {
    expect(hasRelationalFilterKeys({ status: { _eq: 'active' } })).toBe(false);
    expect(hasRelationalFilterKeys({ _and: [{ a: { _in: ['x'] } }] })).toBe(false);
  });
});

describe('operator sets', () => {
  it('maps types to the expected operator families', () => {
    expect(getOperatorsForType('boolean').map((o) => o.value)).toEqual(['_eq', '_neq', '_null', '_nnull']);
    expect(getOperatorsForType('integer').some((o) => o.value === '_between')).toBe(true);
    expect(getOperatorsForType('uuid').some((o) => o.value === '_contains')).toBe(false);
    expect(getOperatorsForType('timestamp with time zone')[2].label).toBe('Before');
    expect(getOperatorsForType('jsonb')).toHaveLength(2);
    expect(getOperatorsForType('unknown-type').some((o) => o.value === '_icontains')).toBe(true);
  });

  it('relation operators include _has with a relational limitation note', () => {
    const ops = getOperatorsForRelation();
    const has = ops.find((o) => o.value === '_has');
    expect(has?.relationalLimitation).toBeTruthy();
  });
});

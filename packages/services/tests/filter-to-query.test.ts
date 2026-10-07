/**
 * filter-to-query unit tests
 *
 * The translator turns DaaS permission filters into PostgREST query-builder
 * calls. It must FAIL CLOSED: any filter it cannot express faithfully throws
 * UnsupportedPermissionFilterError (a 403 PermissionError) before the query
 * builder is touched. A small fake builder records every call.
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

import {
  applyFieldOperators,
  applyFilter,
  applyFilterToQuery,
  assertPermissionFilterSupported,
  FILTER_OPERATORS,
  isUnsupportedPermissionFilterError,
  PermissionError,
  quotePostgrestValue,
  resolveFilterDynamicValues,
  UnsupportedPermissionFilterError,
  type FilterObject,
  type QueryBuilder,
  type UnsupportedPermissionFilterReason,
} from '../src/auth/filter-to-query';

// ─── Fake query builder ──────────────────────────────────────────

type Call = [method: string, ...args: unknown[]];

interface FakeQuery extends QueryBuilder {
  calls: Call[];
}

function fakeQuery(): FakeQuery {
  const calls: Call[] = [];
  const q = { calls } as FakeQuery;
  const methods = [
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'ilike', 'is', 'or', 'filter', 'not',
  ] as const;
  for (const m of methods) {
    (q as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  return q;
}

/** Apply a filter to a fresh fake builder and return the recorded calls. */
function run(filter: FilterObject | null | undefined): Call[] {
  return applyFilterToQuery(fakeQuery(), filter).calls;
}

/** Assert that applying `filter` throws the typed error and records no calls. */
function expectRejected(
  filter: unknown,
  reason: UnsupportedPermissionFilterReason,
  path?: string
): UnsupportedPermissionFilterError {
  const q = fakeQuery();
  let caught: unknown;
  try {
    applyFilterToQuery(q, filter as FilterObject);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(UnsupportedPermissionFilterError);
  const err = caught as UnsupportedPermissionFilterError;
  expect(err.reason).toBe(reason);
  if (path !== undefined) expect(err.path).toBe(path);
  // All-or-nothing: the builder was never touched.
  expect(q.calls).toEqual([]);
  return err;
}

/**
 * Split a PostgREST logic-tree body at top-level commas, honouring quoted
 * values (with backslash escapes) and parentheses — i.e. count the branches
 * PostgREST would see.
 */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      current += ch;
      if (ch === '\\') {
        current += body[++i];
      } else if (ch === '"') {
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

// ─── No-op inputs ────────────────────────────────────────────────

describe('applyFilterToQuery — no restriction inputs', () => {
  it('returns the query untouched for null / undefined', () => {
    expect(run(null)).toEqual([]);
    expect(run(undefined)).toEqual([]);
  });

  it('treats an empty filter object as no restriction (DaaS `{}` = all items)', () => {
    expect(run({})).toEqual([]);
  });

  it('treats an empty _and as no restriction', () => {
    expect(run({ _and: [] })).toEqual([]);
  });

  it('returns the same builder instance', () => {
    const q = fakeQuery();
    expect(applyFilterToQuery(q, { a: { _eq: 1 } })).toBe(q);
  });
});

// ─── Every operator at top level ─────────────────────────────────

describe('applyFilterToQuery — operators', () => {
  it.each([
    ['_eq', 'active', ['eq', 'status', 'active']],
    ['_neq', 'archived', ['neq', 'status', 'archived']],
    ['_gt', 5, ['gt', 'status', 5]],
    ['_gte', 5, ['gte', 'status', 5]],
    ['_lt', '2024-01-01', ['lt', 'status', '2024-01-01']],
    ['_lte', 0, ['lte', 'status', 0]],
    ['_eq', true, ['eq', 'status', true]],
    ['_eq', false, ['eq', 'status', false]],
  ])('%s %j', (op, value, expected) => {
    expect(run({ status: { [op]: value } })).toEqual([expected]);
  });

  it('shorthand scalar value means _eq', () => {
    expect(run({ status: 'active', count: 3 })).toEqual([
      ['eq', 'status', 'active'],
      ['eq', 'count', 3],
    ]);
  });

  it('_in builds a quoted list via filter()', () => {
    expect(run({ role: { _in: ['a', 'b', 3] } })).toEqual([
      ['filter', 'role', 'in', '("a","b","3")'],
    ]);
  });

  it('_in with an empty array matches nothing (in.())', () => {
    expect(run({ role: { _in: [] } })).toEqual([['filter', 'role', 'in', '()']]);
  });

  it('_nin builds a quoted list via not()', () => {
    expect(run({ role: { _nin: ['a', 'b'] } })).toEqual([['not', 'role', 'in', '("a","b")']]);
  });

  it.each([
    ['_null', true, ['is', 'f', null]],
    ['_null', false, ['not', 'f', 'is', null]],
    ['_nnull', true, ['not', 'f', 'is', null]],
    ['_nnull', false, ['is', 'f', null]],
    ['_null', 'true', ['is', 'f', null]],
    ['_nnull', 'false', ['is', 'f', null]],
  ])('%s %j', (op, value, expected) => {
    expect(run({ f: { [op]: value } })).toEqual([expected]);
  });

  it('_empty: NULL or empty string', () => {
    expect(run({ f: { _empty: true } })).toEqual([['or', 'f.is.null,f.eq.""']]);
    expect(run({ f: { _nempty: false } })).toEqual([['or', 'f.is.null,f.eq.""']]);
  });

  it('_nempty: NOT NULL and not empty string', () => {
    expect(run({ f: { _nempty: true } })).toEqual([
      ['not', 'f', 'is', null],
      ['neq', 'f', ''],
    ]);
    expect(run({ f: { _empty: false } })).toEqual([
      ['not', 'f', 'is', null],
      ['neq', 'f', ''],
    ]);
  });

  it.each([
    ['_contains', ['like', 'name', '%abc%']],
    ['_ncontains', ['not', 'name', 'like', '%abc%']],
    ['_icontains', ['ilike', 'name', '%abc%']],
    ['_nicontains', ['not', 'name', 'ilike', '%abc%']],
    ['_starts_with', ['like', 'name', 'abc%']],
    ['_nstarts_with', ['not', 'name', 'like', 'abc%']],
    ['_istarts_with', ['ilike', 'name', 'abc%']],
    ['_nistarts_with', ['not', 'name', 'ilike', 'abc%']],
    ['_ends_with', ['like', 'name', '%abc']],
    ['_nends_with', ['not', 'name', 'like', '%abc']],
    ['_iends_with', ['ilike', 'name', '%abc']],
    ['_niends_with', ['not', 'name', 'ilike', '%abc']],
  ])('%s', (op, expected) => {
    expect(run({ name: { [op]: 'abc' } })).toEqual([expected]);
  });

  it('escapes LIKE wildcards and backslashes so values match literally', () => {
    expect(run({ name: { _contains: '50%_off\\' } })).toEqual([
      ['like', 'name', '%50\\%\\_off\\\\%'],
    ]);
  });

  it('LIKE operators accept numbers', () => {
    expect(run({ code: { _starts_with: 42 } })).toEqual([['like', 'code', '42%']]);
  });

  it('_between → gte AND lte', () => {
    expect(run({ age: { _between: [18, 65] } })).toEqual([
      ['gte', 'age', 18],
      ['lte', 'age', 65],
    ]);
  });

  it('_nbetween → or(lt, gt) with quoted values', () => {
    expect(run({ age: { _nbetween: [18, 65] } })).toEqual([['or', 'age.lt."18",age.gt."65"']]);
  });

  it('_regex → match', () => {
    expect(run({ sku: { _regex: '^A[0-9]+$' } })).toEqual([['filter', 'sku', 'match', '^A[0-9]+$']]);
  });

  it('multiple operators on one field are ANDed', () => {
    expect(run({ age: { _gte: 18, _lt: 65, _neq: 30 } })).toEqual([
      ['gte', 'age', 18],
      ['lt', 'age', 65],
      ['neq', 'age', 30],
    ]);
  });

  it('multiple fields are ANDed', () => {
    expect(run({ a: { _eq: 1 }, b: { _null: true } })).toEqual([
      ['eq', 'a', 1],
      ['is', 'b', null],
    ]);
  });

  it('every operator listed in FILTER_OPERATORS is accepted', () => {
    const sample: Record<string, unknown> = {
      _in: ['x'],
      _nin: ['x'],
      _null: true,
      _nnull: true,
      _empty: true,
      _nempty: true,
      _between: [1, 2],
      _nbetween: [1, 2],
    };
    for (const op of Object.keys(FILTER_OPERATORS)) {
      expect(() => run({ f: { [op]: op in sample ? sample[op] : 'x' } }), op).not.toThrow();
    }
  });
});

// ─── _and / _or nesting ──────────────────────────────────────────

describe('applyFilterToQuery — logical nesting', () => {
  it('_and applies each condition as a top-level filter', () => {
    expect(run({ _and: [{ a: { _eq: 1 } }, { b: { _gt: 2 } }] })).toEqual([
      ['eq', 'a', 1],
      ['gt', 'b', 2],
    ]);
  });

  it('nested _and is flattened', () => {
    expect(
      run({ _and: [{ _and: [{ a: { _eq: 1 } }, { _and: [{ b: { _eq: 2 } }] }] }, { c: { _eq: 3 } }] })
    ).toEqual([
      ['eq', 'a', 1],
      ['eq', 'b', 2],
      ['eq', 'c', 3],
    ]);
  });

  it('_or becomes a single or() with quoted values', () => {
    expect(run({ _or: [{ a: { _eq: 'x' } }, { b: { _in: [1, 2] } }, { c: { _null: true } }] })).toEqual([
      ['or', 'a.eq."x",b.in.("1","2"),c.is.null'],
    ]);
  });

  it('a single-branch _or is applied as a plain condition', () => {
    expect(run({ _or: [{ a: { _eq: 1 } }] })).toEqual([['eq', 'a', 1]]);
  });

  it('a multi-condition branch inside _or becomes and(...)', () => {
    expect(run({ _or: [{ a: { _eq: 1 }, b: { _eq: 2 } }, { c: { _eq: 3 } }] })).toEqual([
      ['or', 'and(a.eq."1",b.eq."2"),c.eq."3"'],
    ]);
  });

  it('_and inside _or becomes and(...)', () => {
    expect(
      run({ _or: [{ _and: [{ a: { _eq: 1 } }, { b: { _neq: 2 } }] }, { c: { _lt: 3 } }] })
    ).toEqual([['or', 'and(a.eq."1",b.neq."2"),c.lt."3"']]);
  });

  it('nested _or inside _or is flattened', () => {
    expect(
      run({ _or: [{ a: { _eq: 1 } }, { _or: [{ b: { _eq: 2 } }, { c: { _eq: 3 } }] }] })
    ).toEqual([['or', 'a.eq."1",b.eq."2",c.eq."3"']]);
  });

  it('_or inside _and stays a separate or() (ANDed with the rest)', () => {
    expect(
      run({
        _and: [
          { status: { _eq: 'published' } },
          { _or: [{ owner: { _eq: 'u1' } }, { public: { _eq: true } }] },
        ],
      })
    ).toEqual([
      ['eq', 'status', 'published'],
      ['or', 'owner.eq."u1",public.eq."true"'],
    ]);
  });

  it('deep nesting renders the whole tree', () => {
    const filter = {
      _or: [
        {
          _and: [
            { a: { _eq: 1 } },
            { _or: [{ b: { _nin: ['x', 'y'] } }, { c: { _nnull: true } }] },
          ],
        },
        { d: { _nbetween: [1, 9] } },
        { e: { _icontains: 'q' } },
        { f: { _empty: true } },
      ],
    };
    expect(run(filter)).toEqual([
      [
        'or',
        'and(a.eq."1",or(b.not.in.("x","y"),c.not.is.null)),' +
          'd.lt."1",d.gt."9",' +
          'e.ilike."%q%",' +
          'f.is.null,f.eq.""',
      ],
    ]);
  });

  it('negated LIKE, between and nempty render correctly inside or()', () => {
    expect(
      run({
        _or: [
          { a: { _nstarts_with: 'x' } },
          { b: { _between: [1, 2] } },
          { c: { _nempty: true } },
          { d: { _regex: 'a|b' } },
        ],
      })
    ).toEqual([
      ['or', 'a.not.like."x%",and(b.gte."1",b.lte."2"),and(c.not.is.null,c.neq.""),d.match."a|b"'],
    ]);
  });

  it('an always-true branch ({}) makes the whole _or unrestricted (DaaS semantics)', () => {
    expect(run({ _or: [{}, { a: { _eq: 1 } }] })).toEqual([]);
    expect(run({ x: { _eq: 1 }, _or: [{ a: { _eq: 1 } }, { _and: [] }] })).toEqual([['eq', 'x', 1]]);
  });

  it('_and / _or mixed with fields at the same level are all ANDed', () => {
    expect(
      run({
        tenant: { _eq: 't1' },
        _or: [{ a: { _eq: 1 } }, { b: { _eq: 2 } }],
        _and: [{ c: { _eq: 3 } }],
      })
    ).toEqual([
      ['eq', 'tenant', 't1'],
      ['or', 'a.eq."1",b.eq."2"'],
      ['eq', 'c', 3],
    ]);
  });
});

// ─── Fail closed ─────────────────────────────────────────────────

describe('applyFilterToQuery — fails closed', () => {
  it('the error is a 403 PermissionError', () => {
    const err = expectRejected({ a: { _bogus: 1 } }, 'unknown_operator', 'a._bogus');
    expect(err).toBeInstanceOf(PermissionError);
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe('UnsupportedPermissionFilterError');
    expect(err.message).toContain('a._bogus');
    expect(isUnsupportedPermissionFilterError(err)).toBe(true);
    expect(isUnsupportedPermissionFilterError(new Error('x'))).toBe(false);
  });

  describe('_in / _nin with non-array values', () => {
    it('unresolved $CURRENT_ROLES string', () => {
      expectRejected({ role: { _in: '$CURRENT_ROLES' } }, 'unresolved_variable', 'role._in');
      expectRejected({ role: { _nin: '$CURRENT_ROLES' } }, 'unresolved_variable', 'role._nin');
    });

    it.each([['a,b'], [5], [null], [{ a: 1 }]])('_in %j', (value) => {
      expectRejected({ role: { _in: value } }, 'invalid_value', 'role._in');
      expectRejected({ role: { _nin: value } }, 'invalid_value', 'role._nin');
    });

    it('array elements must be scalars', () => {
      expectRejected({ role: { _in: ['a', null] } }, 'invalid_value', 'role._in[1]');
      expectRejected({ role: { _in: [['a']] } }, 'invalid_value', 'role._in[0]');
      expectRejected({ role: { _in: ['$CURRENT_USER'] } }, 'unresolved_variable', 'role._in[0]');
    });
  });

  describe('unknown operators', () => {
    it.each([
      '_intersects',
      '_nintersects',
      '_intersects_bbox',
      '_some',
      '_none',
      '_has',
      '_submitted',
      '_EQ',
      '_eqq',
      '__proto__',
      '_constructor',
    ])('%s at field level', (op) => {
      expectRejected(JSON.parse(`{"f": {"${op}": 1}}`), 'unknown_operator');
    });

    it('operators at filter level (outside a field)', () => {
      expectRejected({ _eq: 1 }, 'unknown_operator', '_eq');
      expectRejected({ _not: { a: { _eq: 1 } } }, 'unknown_operator', '_not');
      expectRejected(JSON.parse('{"__proto__": {"a": {"_eq": 1}}}'), 'unknown_operator');
    });

    it('inside _or branches', () => {
      expectRejected(
        { _or: [{ a: { _eq: 1 } }, { b: { _whatever: 2 } }] },
        'unknown_operator',
        '_or[1].b._whatever'
      );
    });
  });

  describe('relational / nested field paths', () => {
    it('m2o path { owner: { id: { _eq } } }', () => {
      expectRejected({ owner: { id: { _eq: 'u1' } } }, 'relational_filter', 'owner.id');
    });

    it('relational path inside _and / _or', () => {
      expectRejected(
        { _and: [{ a: { _eq: 1 } }, { owner: { role: { name: { _eq: 'x' } } } }] },
        'relational_filter',
        '_and[1].owner.role'
      );
      expectRejected(
        { _or: [{ a: { _eq: 1 } }, { owner: { id: { _eq: 'u1' } } }] },
        'relational_filter'
      );
    });

    it('mixed operators and relational keys', () => {
      expectRejected({ owner: { _nnull: true, id: { _eq: 'u1' } } }, 'relational_filter', 'owner.id');
    });

    it('dotted / JSON path field names', () => {
      expectRejected({ 'owner.id': { _eq: 'u1' } }, 'invalid_field');
      expectRejected({ 'data->key': { _eq: 'x' } }, 'invalid_field');
    });
  });

  describe('invalid field names', () => {
    it.each([
      'a,b',
      'a)',
      'or(a',
      'a b',
      'a"b',
      '1abc',
      '',
      'select',
      'order',
      'limit',
      'offset',
      'or',
      'and',
      'not',
      'on_conflict',
      'columns',
    ])('%j', (field) => {
      expectRejected({ [field]: { _eq: 1 } }, 'invalid_field');
    });

    it('inside _or strings too', () => {
      expectRejected(
        { _or: [{ a: { _eq: 1 } }, { 'id.not.is.null,x': { _eq: 1 } }] },
        'invalid_field'
      );
    });
  });

  describe('invalid values', () => {
    it.each([
      ['_eq', null],
      ['_neq', null],
      ['_gt', { a: 1 }],
      ['_lt', [1]],
      ['_eq', Number.NaN],
      ['_eq', Number.POSITIVE_INFINITY],
      ['_eq', undefined],
    ])('%s %j', (op, value) => {
      expectRejected({ f: { [op]: value } }, 'invalid_value', `f.${op}`);
    });

    it('shorthand null / array / undefined', () => {
      expectRejected({ f: null }, 'invalid_value', 'f');
      expectRejected({ f: ['a'] }, 'invalid_value', 'f');
      expectRejected({ f: undefined }, 'invalid_value', 'f');
    });

    it.each([['yes'], [1], [null], [undefined]])('_null / _nnull / _empty / _nempty %j', (value) => {
      for (const op of ['_null', '_nnull', '_empty', '_nempty']) {
        expectRejected({ f: { [op]: value } }, 'invalid_value', `f.${op}`);
      }
    });

    it.each([[[1]], [[1, 2, 3]], ['1,2'], [null], [[1, null]]])('_between / _nbetween %j', (value) => {
      expectRejected({ f: { _between: value } }, 'invalid_value');
      expectRejected({ f: { _nbetween: value } }, 'invalid_value');
    });

    it('LIKE operators reject booleans, objects and "*"', () => {
      expectRejected({ f: { _contains: true } }, 'invalid_value');
      expectRejected({ f: { _starts_with: { a: 1 } } }, 'invalid_value');
      expectRejected({ f: { _contains: 'a*b' } }, 'unsafe_value');
      expectRejected({ f: { _nends_with: '*' } }, 'unsafe_value');
    });

    it('_regex requires a string', () => {
      expectRejected({ f: { _regex: 5 } }, 'invalid_value');
    });
  });

  describe('invalid structure', () => {
    it('filter must be a plain object', () => {
      expectRejected([{ a: { _eq: 1 } }], 'invalid_structure');
      expectRejected('a.eq.1', 'invalid_structure');
      expectRejected(42, 'invalid_structure');
      expectRejected(new Date(), 'invalid_structure');
    });

    it('_and / _or must be arrays', () => {
      expectRejected({ _and: { a: { _eq: 1 } } }, 'invalid_structure', '_and');
      expectRejected({ _or: { a: { _eq: 1 } } }, 'invalid_structure', '_or');
      expectRejected({ _or: 'a.eq.1,b.eq.2' }, 'invalid_structure', '_or');
    });

    it('_or must not be empty', () => {
      expectRejected({ _or: [] }, 'invalid_structure', '_or');
      expectRejected({ _and: [{ _or: [] }] }, 'invalid_structure', '_and[0]._or');
    });

    it('group members must be objects', () => {
      expectRejected({ _and: [null] }, 'invalid_structure', '_and[0]');
      expectRejected({ _or: [{ a: { _eq: 1 } }, 'b.eq.2'] }, 'invalid_structure', '_or[1]');
    });

    it('a field condition needs at least one operator', () => {
      expectRejected({ f: {} }, 'invalid_structure', 'f');
    });
  });

  describe('unresolved dynamic variables', () => {
    it.each([
      '$CURRENT_USER',
      '$CURRENT_ROLE',
      '$CURRENT_ROLES',
      '$CURRENT_POLICIES',
      '$NOW',
      '$NOW(-1 day)',
      '$CURRENT_USER.email',
      '$FOLLOW(posts,author)',
    ])('%s', (variable) => {
      expectRejected({ owner: { _eq: variable } }, 'unresolved_variable', 'owner._eq');
      expectRejected({ owner: { _neq: variable } }, 'unresolved_variable', 'owner._neq');
      expectRejected({ owner: variable }, 'unresolved_variable', 'owner');
      expectRejected(
        { _or: [{ a: { _eq: 1 } }, { owner: { _eq: variable } }] },
        'unresolved_variable',
        '_or[1].owner._eq'
      );
    });

    it('in _between and _null positions', () => {
      expectRejected({ d: { _between: ['$NOW', '2030-01-01'] } }, 'unresolved_variable', 'd._between[0]');
      expectRejected({ d: { _null: '$CURRENT_USER' } }, 'unresolved_variable');
    });
  });

  it('is all-or-nothing: a valid prefix is not applied when a later part fails', () => {
    const q = fakeQuery();
    expect(() =>
      applyFilterToQuery(q, {
        tenant: { _eq: 't1' },
        _or: [{ a: { _eq: 1 } }, { b: { _eq: 2 } }],
        status: { _eq: 'x', _unknown: 1 },
      })
    ).toThrow(UnsupportedPermissionFilterError);
    expect(q.calls).toEqual([]);
  });

  it('assertPermissionFilterSupported validates without applying', () => {
    expect(() => assertPermissionFilterSupported(null)).not.toThrow();
    expect(() => assertPermissionFilterSupported({ a: { _eq: 1 } })).not.toThrow();
    expect(() => assertPermissionFilterSupported({ a: { _in: '$CURRENT_ROLES' } })).toThrow(
      UnsupportedPermissionFilterError
    );
  });
});

// ─── Injection ───────────────────────────────────────────────────

describe('applyFilterToQuery — PostgREST filter-string injection', () => {
  it('quotePostgrestValue wraps in quotes and escapes \\ and "', () => {
    expect(quotePostgrestValue('plain')).toBe('"plain"');
    expect(quotePostgrestValue('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(quotePostgrestValue(5)).toBe('"5"');
    expect(quotePostgrestValue(true)).toBe('"true"');
  });

  it('a value with ",x.not.is.null" cannot add an OR branch', () => {
    const [[, body]] = run({
      _or: [{ owner: { _eq: 'x,id.not.is.null' } }, { status: { _eq: 'public' } }],
    });
    expect(body).toBe('owner.eq."x,id.not.is.null",status.eq."public"');
    expect(splitTopLevel(body as string)).toHaveLength(2);
  });

  it('a value that closes the quote cannot break out', () => {
    const payload = 'x",id.not.is.null,owner.eq."y';
    const [[, body]] = run({ _or: [{ owner: { _eq: payload } }, { b: { _eq: 1 } }] });
    expect(body).toBe('owner.eq."x\\",id.not.is.null,owner.eq.\\"y",b.eq."1"');
    expect(splitTopLevel(body as string)).toHaveLength(2);
  });

  it('a trailing backslash cannot escape the closing quote', () => {
    const payload = 'x\\';
    const [[, body]] = run({ _or: [{ owner: { _eq: payload } }, { id: { _nnull: true } }] });
    expect(body).toBe('owner.eq."x\\\\",id.not.is.null');
    expect(splitTopLevel(body as string)).toHaveLength(2);
  });

  it('parentheses in values cannot close groups', () => {
    const [[, body]] = run({
      _or: [{ _and: [{ a: { _eq: 'x),or(id.not.is.null' } }, { b: { _eq: 1 } }] }, { c: { _eq: 2 } }],
    });
    expect(body).toBe('and(a.eq."x),or(id.not.is.null",b.eq."1"),c.eq."2"');
    expect(splitTopLevel(body as string)).toHaveLength(2);
  });

  it('_in / _nin list values are quoted (no extra list members)', () => {
    expect(run({ role: { _in: ['x),id.not.is.null,(y', 'b"c'] } })).toEqual([
      ['filter', 'role', 'in', '("x),id.not.is.null,(y","b\\"c")'],
    ]);
    expect(run({ role: { _nin: ['a,b', 'c'] } })).toEqual([['not', 'role', 'in', '("a,b","c")']]);
  });

  it('_nbetween values are quoted', () => {
    const [[, body]] = run({ d: { _nbetween: ['2020,id.not.is.null', '2021'] } });
    expect(body).toBe('d.lt."2020,id.not.is.null",d.gt."2021"');
    expect(splitTopLevel(body as string)).toHaveLength(2);
  });

  it('top-level scalar filters pass values as-is (PostgREST reads them verbatim)', () => {
    expect(run({ owner: { _eq: 'x,id.not.is.null' } })).toEqual([['eq', 'owner', 'x,id.not.is.null']]);
  });

  it('LIKE values cannot widen the match with wildcards', () => {
    expect(run({ name: { _starts_with: '%' } })).toEqual([['like', 'name', '\\%%']]);
    expect(run({ name: { _ends_with: '_' } })).toEqual([['like', 'name', '%\\_']]);
    expectRejected({ name: { _starts_with: '*' } }, 'unsafe_value');
  });
});

// ─── Real postgrest-js URL ───────────────────────────────────────

describe('applyFilterToQuery — with a real postgrest-js builder', () => {
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function urlOf(filter: FilterObject): URL {
    const query = client.from('items').select('*');
    const applied = applyFilterToQuery(query as unknown as QueryBuilder, filter);
    return (applied as unknown as { url: URL }).url;
  }

  it('produces the expected query-string parameters', () => {
    const url = urlOf({
      tenant: { _eq: 't,1' },
      role: { _in: ['a,b', 'c"d'] },
      deleted_at: { _null: true },
      _or: [{ owner: { _eq: 'u1' } }, { visibility: { _eq: 'x,id.not.is.null' } }],
    });
    expect(url.searchParams.getAll('tenant')).toEqual(['eq.t,1']);
    expect(url.searchParams.getAll('role')).toEqual(['in.("a,b","c\\"d")']);
    expect(url.searchParams.getAll('deleted_at')).toEqual(['is.null']);
    expect(url.searchParams.getAll('or')).toEqual([
      '(owner.eq."u1",visibility.eq."x,id.not.is.null")',
    ]);
  });

  it('negations use not.<op>', () => {
    const url = urlOf({ role: { _nin: ['a'] }, name: { _ncontains: 'x' } });
    expect(url.searchParams.getAll('role')).toEqual(['not.in.("a")']);
    expect(url.searchParams.getAll('name')).toEqual(['not.like.%x%']);
  });
});

// ─── applyFilter / applyFieldOperators ───────────────────────────

describe('applyFilter / applyFieldOperators', () => {
  it('applyFilter translates like applyFilterToQuery', () => {
    expect(applyFilter(fakeQuery(), { a: { _eq: 1 } }).calls).toEqual([['eq', 'a', 1]]);
    expect(() => applyFilter(fakeQuery(), { a: { _x: 1 } })).toThrow(UnsupportedPermissionFilterError);
  });

  it('applyFieldOperators applies one field', () => {
    expect(applyFieldOperators(fakeQuery(), 'age', { _gte: 1, _lte: 2 }).calls).toEqual([
      ['gte', 'age', 1],
      ['lte', 'age', 2],
    ]);
  });

  it('applyFieldOperators fails closed (unknown operator, non-array _in, bad field)', () => {
    const q = fakeQuery();
    expect(() => applyFieldOperators(q, 'age', { _gte: 1, _nope: 2 })).toThrow(
      UnsupportedPermissionFilterError
    );
    expect(() => applyFieldOperators(q, 'role', { _in: 'r1' })).toThrow(UnsupportedPermissionFilterError);
    expect(() => applyFieldOperators(q, 'a,b', { _eq: 1 })).toThrow(UnsupportedPermissionFilterError);
    expect(q.calls).toEqual([]);
  });
});

// ─── Dynamic variables ───────────────────────────────────────────

describe('resolveFilterDynamicValues', () => {
  const now = new Date('2026-01-02T03:04:05.678Z');
  const ctx = { roles: ['r1', 'r2'], policies: ['p1'], now };

  it('resolves all supported variables anywhere in the tree', () => {
    const resolved = resolveFilterDynamicValues(
      {
        _or: [
          { owner: { _eq: '$CURRENT_USER' } },
          { role: { _eq: '$CURRENT_ROLE' } },
          { role: { _in: '$CURRENT_ROLES' } },
          { policy: { _nin: '$CURRENT_POLICIES' } },
          { published_at: { _lte: '$NOW' } },
          { d: { _between: ['$NOW', '2030-01-01'] } },
          { assignees: { _in: ['$CURRENT_USER', 'u2'] } },
        ],
      },
      'u1',
      'r1',
      ctx
    );
    expect(resolved).toEqual({
      _or: [
        { owner: { _eq: 'u1' } },
        { role: { _eq: 'r1' } },
        { role: { _in: ['r1', 'r2'] } },
        { policy: { _nin: ['p1'] } },
        { published_at: { _lte: '2026-01-02T03:04:05.678Z' } },
        { d: { _between: ['2026-01-02T03:04:05.678Z', '2030-01-01'] } },
        { assignees: { _in: ['u1', 'u2'] } },
      ],
    });
    // Resolved filters translate.
    expect(() => run(resolved)).not.toThrow();
  });

  it('resolves $CURRENT_ROLES to an empty list when the user has no roles', () => {
    expect(resolveFilterDynamicValues({ r: { _in: '$CURRENT_ROLES' } }, 'u1', null, { roles: [] })).toEqual({
      r: { _in: [] },
    });
  });

  it('does not mutate the input and returns copies of the role/policy arrays', () => {
    const input = { owner: { _eq: '$CURRENT_USER' }, r: { _in: '$CURRENT_ROLES' } };
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = resolveFilterDynamicValues(input, 'u1', 'r1', ctx);
    expect(input).toEqual(snapshot);
    expect((out.r as { _in: string[] })._in).not.toBe(ctx.roles);
  });

  it('defaults $NOW to the current time', () => {
    const before = Date.now();
    const out = resolveFilterDynamicValues({ d: { _lt: '$NOW' } }, 'u1');
    const value = Date.parse((out.d as { _lt: string })._lt);
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Date.now());
  });

  it('leaves ordinary strings (including other "$" strings) untouched', () => {
    expect(resolveFilterDynamicValues({ price: { _eq: '$5.00' }, s: 'CURRENT_USER' }, 'u1')).toEqual({
      price: { _eq: '$5.00' },
      s: 'CURRENT_USER',
    });
  });

  it('keeps "__proto__" as a plain key (later rejected by the translator)', () => {
    const out = resolveFilterDynamicValues(JSON.parse('{"__proto__": {"a": {"_eq": 1}}}'), 'u1');
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(['__proto__']);
    expectRejected(out, 'unknown_operator');
  });

  it.each([
    ['$CURRENT_ROLE without a role', { r: { _eq: '$CURRENT_ROLE' } }, 'u1', null, ctx],
    ['$CURRENT_ROLE with empty role', { r: { _eq: '$CURRENT_ROLE' } }, 'u1', '', ctx],
    ['$CURRENT_ROLES unknown', { r: { _in: '$CURRENT_ROLES' } }, 'u1', 'r1', {}],
    ['$CURRENT_POLICIES unknown', { p: { _in: '$CURRENT_POLICIES' } }, 'u1', 'r1', { roles: [] }],
    ['$CURRENT_USER with empty id', { o: { _eq: '$CURRENT_USER' } }, '', 'r1', ctx],
    ['$CURRENT_USER.<field>', { o: { _eq: '$CURRENT_USER.email' } }, 'u1', 'r1', ctx],
    ['$CURRENT_ROLE.<field>', { o: { _eq: '$CURRENT_ROLE.name' } }, 'u1', 'r1', ctx],
    ['$NOW with an adjustment', { d: { _lt: '$NOW(-1 year)' } }, 'u1', 'r1', ctx],
    ['$FOLLOW', { d: { _eq: '$FOLLOW(a,b)' } }, 'u1', 'r1', ctx],
    ['unknown $CURRENT_*', { d: { _eq: '$CURRENT_RESOURCE_URI' } }, 'u1', 'r1', ctx],
    ['list variable inside a list', { r: { _in: ['$CURRENT_ROLES'] } }, 'u1', 'r1', ctx],
  ] as const)('throws for %s', (_label, filter, userId, roleId, context) => {
    let caught: unknown;
    try {
      resolveFilterDynamicValues(filter as FilterObject, userId, roleId, context);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnsupportedPermissionFilterError);
    expect((caught as UnsupportedPermissionFilterError).reason).toBe('unresolved_variable');
  });

  it('reports the path of the unresolved variable', () => {
    expect(() =>
      resolveFilterDynamicValues({ _or: [{ a: { _eq: 1 } }, { r: { _eq: '$CURRENT_ROLE' } }] }, 'u1', null)
    ).toThrow(/_or\[1\]\.r\._eq/);
  });
});

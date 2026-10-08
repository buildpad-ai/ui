/**
 * apply-conditions.ts — the conditional-field logic VForm runs on every render.
 *
 * It was shipped untested (4% of statements, one function of seven), which is
 * why these tests are written against the DaaS semantics it ports rather than
 * against the implementation:
 *
 *   - the LAST matching condition wins (the list is evaluated reversed);
 *   - only overrides the condition actually sets are merged;
 *   - the merge replaces arrays and merges nested objects (lodash.mergeWith);
 *   - a field with no conditions comes back untouched, by identity.
 */

import type { Field, FieldCondition } from '@buildpad/types';
import { applyConditions } from '../utils/apply-conditions';

/** A field carrying `conditions`, which FieldMeta types as `unknown`. */
function field(conditions?: FieldCondition[], meta: Record<string, unknown> = {}): Field {
  return {
    collection: 'articles',
    field: 'subtitle',
    type: 'string',
    meta: { ...meta, ...(conditions ? { conditions } : {}) } as Field['meta'],
  };
}

/** `meta` of the field a rule matched, for asserting the merge result. */
function metaAfter(
  item: Record<string, unknown>,
  conditions: FieldCondition[],
  meta?: Record<string, unknown>,
  version?: { name: string } | null,
): Record<string, unknown> {
  return applyConditions(item, field(conditions, meta), version).meta as unknown as Record<string, unknown>;
}

/** Whether a single rule matched, read off an override the condition sets. */
const matches = (rule: Record<string, unknown>, item: Record<string, unknown>): boolean =>
  metaAfter(item, [{ rule, hidden: true }]).hidden === true;

describe('applyConditions — fields it leaves alone', () => {
  test('returns the same field object when there is no meta', () => {
    const f: Field = { collection: 'articles', field: 'subtitle', type: 'string' };
    expect(applyConditions({}, f)).toBe(f);
  });

  test('returns the same field object when meta has no conditions', () => {
    const f = field(undefined, { width: 'full' });
    expect(applyConditions({ status: 'draft' }, f)).toBe(f);
  });

  test('returns the same field object for an empty conditions array', () => {
    const f = field([]);
    expect(applyConditions({}, f)).toBe(f);
  });

  test('a condition with no rule, or an empty rule, never matches', () => {
    expect(metaAfter({ status: 'draft' }, [{ hidden: true }]).hidden).toBeUndefined();
    expect(metaAfter({ status: 'draft' }, [{ rule: {}, hidden: true }]).hidden).toBeUndefined();
  });

  test('a field whose conditions are not an array is left alone', () => {
    const f: Field = {
      collection: 'articles',
      field: 'subtitle',
      type: 'string',
      meta: { conditions: 'nonsense' } as unknown as Field['meta'],
    };
    expect(applyConditions({}, f)).toBe(f);
  });
});

describe('applyConditions — rule shapes', () => {
  test('a bare value is direct equality', () => {
    expect(matches({ status: 'published' }, { status: 'published' })).toBe(true);
    expect(matches({ status: 'published' }, { status: 'draft' })).toBe(false);
  });

  test('null and undefined conditions compare identically', () => {
    expect(matches({ deleted_at: null }, { deleted_at: null })).toBe(true);
    expect(matches({ deleted_at: null }, { deleted_at: '2026-01-01' })).toBe(false);
    expect(matches({ missing: undefined }, {})).toBe(true);
  });

  test('every key in a rule must hold', () => {
    const rule = { status: { _eq: 'published' }, views: { _gt: 10 } };
    expect(matches(rule, { status: 'published', views: 11 })).toBe(true);
    expect(matches(rule, { status: 'published', views: 10 })).toBe(false);
  });

  test('_and requires every branch, _or requires one', () => {
    const and = { _and: [{ status: { _eq: 'draft' } }, { views: { _lt: 5 } }] };
    expect(matches(and, { status: 'draft', views: 1 })).toBe(true);
    expect(matches(and, { status: 'draft', views: 9 })).toBe(false);

    const or = { _or: [{ status: { _eq: 'draft' } }, { views: { _gt: 100 } }] };
    expect(matches(or, { status: 'archived', views: 101 })).toBe(true);
    expect(matches(or, { status: 'archived', views: 3 })).toBe(false);
  });

  test('nested _and inside _or', () => {
    const rule = {
      _or: [{ _and: [{ status: { _eq: 'draft' } }, { author: { _eq: 'ada' } }] }, { pinned: { _eq: true } }],
    };
    expect(matches(rule, { status: 'draft', author: 'ada' })).toBe(true);
    expect(matches(rule, { status: 'draft', author: 'bob' })).toBe(false);
    expect(matches(rule, { status: 'draft', author: 'bob', pinned: true })).toBe(true);
  });

  test('a logical operator whose value is not an array does not match', () => {
    expect(matches({ _and: { status: 'draft' } }, { status: 'draft' })).toBe(false);
    expect(matches({ _or: 'draft' }, { status: 'draft' })).toBe(false);
  });
});

describe('applyConditions — operators', () => {
  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>, boolean]> = [
    ['_eq hit', { a: { _eq: 1 } }, { a: 1 }, true],
    ['_eq miss on type', { a: { _eq: 1 } }, { a: '1' }, false],
    ['_neq', { a: { _neq: 1 } }, { a: 2 }, true],
    ['_gt', { a: { _gt: 5 } }, { a: 6 }, true],
    ['_gt is numbers only', { a: { _gt: 5 } }, { a: '6' }, false],
    ['_gte boundary', { a: { _gte: 5 } }, { a: 5 }, true],
    ['_lt', { a: { _lt: 5 } }, { a: 4 }, true],
    ['_lte boundary', { a: { _lte: 5 } }, { a: 5 }, true],
    ['_in hit', { a: { _in: ['x', 'y'] } }, { a: 'y' }, true],
    ['_in needs an array', { a: { _in: 'y' } }, { a: 'y' }, false],
    ['_nin', { a: { _nin: ['x'] } }, { a: 'y' }, true],
    ['_null true', { a: { _null: true } }, { a: null }, true],
    ['_null false', { a: { _null: false } }, { a: 1 }, true],
    ['_nnull true', { a: { _nnull: true } }, { a: 1 }, true],
    ['_nnull false', { a: { _nnull: false } }, { a: undefined }, true],
    ['_empty on ""', { a: { _empty: true } }, { a: '' }, true],
    ['_empty on []', { a: { _empty: true } }, { a: [] }, true],
    ['_empty false on value', { a: { _empty: false } }, { a: 'x' }, true],
    ['_nempty true', { a: { _nempty: true } }, { a: 'x' }, true],
    ['_nempty false on empty', { a: { _nempty: false } }, { a: null }, true],
    ['_contains', { a: { _contains: 'ell' } }, { a: 'hello' }, true],
    ['_contains is strings only', { a: { _contains: 1 } }, { a: 'hello' }, false],
    ['_ncontains', { a: { _ncontains: 'zz' } }, { a: 'hello' }, true],
    ['_starts_with', { a: { _starts_with: 'he' } }, { a: 'hello' }, true],
    ['_nstarts_with', { a: { _nstarts_with: 'zz' } }, { a: 'hello' }, true],
    ['_ends_with', { a: { _ends_with: 'lo' } }, { a: 'hello' }, true],
    ['_nends_with', { a: { _nends_with: 'zz' } }, { a: 'hello' }, true],
    ['_regex', { a: { _regex: '^h.*o$' } }, { a: 'hello' }, true],
    ['_regex miss', { a: { _regex: '^z' } }, { a: 'hello' }, false],
    ['_between inside', { a: { _between: [1, 10] } }, { a: 5 }, true],
    ['_between boundary', { a: { _between: [1, 10] } }, { a: 10 }, true],
    ['_between outside', { a: { _between: [1, 10] } }, { a: 11 }, false],
    ['_between needs two bounds', { a: { _between: [1] } }, { a: 1 }, false],
    ['_nbetween outside', { a: { _nbetween: [1, 10] } }, { a: 11 }, true],
    ['_nbetween inside', { a: { _nbetween: [1, 10] } }, { a: 5 }, false],
    ['an unknown operator never matches', { a: { _wat: 1 } }, { a: 1 }, false],
  ];

  test.each(cases)('%s', (_name, rule, item, expected) => {
    expect(matches(rule, item)).toBe(expected);
  });

  test('an invalid regex is a non-match, not a throw', () => {
    expect(matches({ a: { _regex: '([' } }, { a: 'hello' })).toBe(false);
  });
});

describe('applyConditions — which condition wins', () => {
  test('the last matching condition wins', () => {
    const conditions: FieldCondition[] = [
      { name: 'first', rule: { status: { _eq: 'draft' } }, readonly: false, hidden: false },
      { name: 'last', rule: { status: { _eq: 'draft' } }, readonly: true, hidden: true },
    ];
    const meta = metaAfter({ status: 'draft' }, conditions);
    expect(meta.readonly).toBe(true);
    expect(meta.hidden).toBe(true);
  });

  test('a later non-matching condition does not displace an earlier match', () => {
    const conditions: FieldCondition[] = [
      { rule: { status: { _eq: 'draft' } }, required: true },
      { rule: { status: { _eq: 'published' } }, required: false },
    ];
    expect(metaAfter({ status: 'draft' }, conditions).required).toBe(true);
  });
});

describe('applyConditions — merging overrides', () => {
  test('only the overrides a condition sets are applied', () => {
    const meta = metaAfter({ s: 1 }, [{ rule: { s: { _eq: 1 } }, hidden: true }], {
      readonly: false,
      width: 'half',
    });
    expect(meta.hidden).toBe(true);
    expect(meta.readonly).toBe(false); // untouched, not overwritten with undefined
    expect(meta.width).toBe('half'); // unrelated meta survives
  });

  test('false is an override, not an absent value', () => {
    const meta = metaAfter({ s: 1 }, [{ rule: { s: { _eq: 1 } }, readonly: false, hidden: false }], {
      readonly: true,
      hidden: true,
    });
    expect(meta.readonly).toBe(false);
    expect(meta.hidden).toBe(false);
  });

  test('clear_hidden_value_on_save is carried through', () => {
    const meta = metaAfter({ s: 1 }, [{ rule: { s: { _eq: 1 } }, clear_hidden_value_on_save: true }]);
    expect(meta.clear_hidden_value_on_save).toBe(true);
  });

  test('nested options merge, and arrays are replaced rather than concatenated', () => {
    const meta = metaAfter(
      { s: 1 },
      [{ rule: { s: { _eq: 1 } }, options: { choices: ['b'], placeholder: 'new' } }],
      { options: { choices: ['a'], placeholder: 'old', keep: true } },
    );
    expect(meta.options).toEqual({ choices: ['b'], placeholder: 'new', keep: true });
  });

  test('the original field and its meta are not mutated', () => {
    const original = field([{ rule: { s: { _eq: 1 } }, hidden: true }], { hidden: false });
    const result = applyConditions({ s: 1 }, original);
    expect(result).not.toBe(original);
    expect((original.meta as unknown as Record<string, unknown>).hidden).toBe(false);
    expect((result.meta as unknown as Record<string, unknown>).hidden).toBe(true);
  });
});

describe('applyConditions — $version context', () => {
  const conditions: FieldCondition[] = [{ rule: { $version: { _eq: 'draft' } }, hidden: true }];

  test('a rule can match on the content version', () => {
    expect(metaAfter({}, conditions, {}, { name: 'draft' }).hidden).toBe(true);
    expect(metaAfter({}, conditions, {}, { name: 'main' }).hidden).toBeUndefined();
  });

  test('$version is null when no version is given, so a _null rule matches', () => {
    expect(metaAfter({}, conditions).hidden).toBeUndefined();
    expect(metaAfter({}, [{ rule: { $version: { _null: true } }, hidden: true }]).hidden).toBe(true);
  });

  test('item values win over nothing — $version is added, not substituted', () => {
    const meta = metaAfter(
      { status: 'draft' },
      [{ rule: { _and: [{ status: { _eq: 'draft' } }, { $version: { _eq: 'v2' } }] }, required: true }],
      {},
      { name: 'v2' },
    );
    expect(meta.required).toBe(true);
  });
});

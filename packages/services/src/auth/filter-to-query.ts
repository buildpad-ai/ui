/**
 * Filter to Query Converter
 *
 * Converts DaaS-style (Directus-compatible) JSON permission filters into
 * Supabase / PostgREST query-builder calls, so item-level permissions are
 * enforced by the database query itself.
 *
 * SECURITY MODEL — FAIL CLOSED
 * ----------------------------
 * A permission filter is a *restriction*. Silently dropping any part of it
 * widens access, so every filter shape this module cannot express faithfully
 * throws an {@link UnsupportedPermissionFilterError} (a {@link PermissionError}
 * with status 403) instead of being skipped. The whole filter is translated
 * BEFORE the query builder is touched, so a throw never leaves a
 * half-restricted query behind.
 *
 * Supported operators (field level):
 * - Equality: `_eq`, `_neq`
 * - Comparison: `_lt`, `_lte`, `_gt`, `_gte`
 * - Lists: `_in`, `_nin` (value MUST be an array)
 * - Null checks: `_null`, `_nnull` (value MUST be a boolean)
 * - Empty checks: `_empty`, `_nempty` (NULL or `''`, Directus semantics)
 * - Substring (LIKE): `_contains`, `_ncontains`, `_icontains`, `_nicontains`
 * - Prefix/suffix (LIKE): `_starts_with`, `_nstarts_with`, `_istarts_with`,
 *   `_nistarts_with`, `_ends_with`, `_nends_with`, `_iends_with`, `_niends_with`
 * - Range: `_between`, `_nbetween` (value MUST be a 2-element array)
 * - Regex: `_regex` (PostgREST `match`, i.e. Postgres `~`)
 * - Logical: `_and`, `_or` (arbitrarily nested)
 *
 * Rejected (throws):
 * - Unknown operators (`_intersects`, `_some`, `_none`, `_has`, typos, …)
 * - Relational / nested field paths (`{ owner: { id: { _eq: … } } }`): the
 *   translator does not know the query's `select`, and PostgREST embedded
 *   filters without an `!inner` embed filter the embedded rows, not the parent
 *   rows — so they cannot be expressed faithfully here.
 * - Unresolved dynamic variables (`$CURRENT_USER`, `$CURRENT_ROLES`, `$NOW`,
 *   `$CURRENT_USER.email`, `$FOLLOW(…)`, …). Resolve them first with
 *   {@link resolveFilterDynamicValues}.
 * - Values of the wrong type (`null`, objects, non-arrays for `_in`, …)
 * - Empty `_or` groups, field names that are not plain identifiers, and LIKE
 *   values containing `*` (PostgREST rewrites `*` to `%`).
 *
 * Values that end up inside PostgREST filter strings (`.or(...)`, `in.(...)`)
 * are always double-quoted with `\` and `"` escaped, so a value such as
 * `x,id.not.is.null` cannot inject an extra OR branch.
 *
 * @module @buildpad/services/auth/filter-to-query
 */

export type FilterObject = Record<string, unknown>;

// ─── Errors ──────────────────────────────────────────────────────

/**
 * Permission denied error.
 *
 * Declared here (and re-exported from `./enforcer`) so that
 * {@link UnsupportedPermissionFilterError} can extend it without an import
 * cycle between `enforcer.ts` and this module.
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public collection?: string,
    public action?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** Why a permission filter could not be translated. */
export type UnsupportedPermissionFilterReason =
  | 'unknown_operator'
  | 'relational_filter'
  | 'unresolved_variable'
  | 'invalid_value'
  | 'invalid_field'
  | 'invalid_structure'
  | 'unsafe_value';

/**
 * Thrown when a permission filter cannot be translated faithfully into a
 * query. It is a {@link PermissionError} (status 403) so that callers which
 * already turn `PermissionError` into a 403 response deny the request instead
 * of running an unrestricted query.
 */
export class UnsupportedPermissionFilterError extends PermissionError {
  constructor(
    message: string,
    /** Machine-readable reason. */
    public readonly reason: UnsupportedPermissionFilterReason,
    /** Location inside the filter, e.g. `_or[1].status._in`. */
    public readonly path: string = ''
  ) {
    super(
      `Permission filter cannot be enforced${path ? ` at "${path}"` : ''}: ${message}`,
      403
    );
    this.name = 'UnsupportedPermissionFilterError';
  }
}

/** Type guard for {@link UnsupportedPermissionFilterError}. */
export function isUnsupportedPermissionFilterError(
  error: unknown
): error is UnsupportedPermissionFilterError {
  return error instanceof UnsupportedPermissionFilterError;
}

// ─── Query builder contract ──────────────────────────────────────

/**
 * Query builder interface compatible with the Supabase (postgrest-js) client
 */
export interface QueryBuilder {
  eq: (field: string, value: unknown) => QueryBuilder;
  neq: (field: string, value: unknown) => QueryBuilder;
  gt: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  lt: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, values: unknown[]) => QueryBuilder;
  like: (field: string, pattern: string) => QueryBuilder;
  ilike: (field: string, pattern: string) => QueryBuilder;
  is: (field: string, value: null) => QueryBuilder;
  or: (filters: string) => QueryBuilder;
  filter: (field: string, operator: string, value: unknown) => QueryBuilder;
  not: (field: string, operator: string, value: unknown) => QueryBuilder;
}

/**
 * Supported field operators → the PostgREST operator they translate to.
 * Operators not listed here are rejected with an
 * {@link UnsupportedPermissionFilterError}.
 */
export const FILTER_OPERATORS = {
  // Equality
  _eq: 'eq',
  _neq: 'neq',
  // Comparison
  _lt: 'lt',
  _lte: 'lte',
  _gt: 'gt',
  _gte: 'gte',
  // Lists
  _in: 'in',
  _nin: 'not.in',
  // Null checks
  _null: 'is',
  _nnull: 'not.is',
  // Empty checks (NULL or '')
  _empty: 'or(is,eq)',
  _nempty: 'and(not.is,neq)',
  // Substring (Directus `_contains` is a string LIKE, not array containment)
  _contains: 'like',
  _ncontains: 'not.like',
  _icontains: 'ilike',
  _nicontains: 'not.ilike',
  // Prefix / suffix
  _starts_with: 'like',
  _nstarts_with: 'not.like',
  _istarts_with: 'ilike',
  _nistarts_with: 'not.ilike',
  _ends_with: 'like',
  _nends_with: 'not.like',
  _iends_with: 'ilike',
  _niends_with: 'not.ilike',
  // Range
  _between: 'and(gte,lte)',
  _nbetween: 'or(lt,gt)',
  // Regex
  _regex: 'match',
} as const;

// ─── Dynamic variables ───────────────────────────────────────────

/** Extra session data used to resolve dynamic variables. */
export interface DynamicVariableContext {
  /** All role IDs of the user (`$CURRENT_ROLES`). Unknown → variable throws. */
  roles?: readonly string[] | null;
  /** All policy IDs of the user (`$CURRENT_POLICIES`). Unknown → variable throws. */
  policies?: readonly string[] | null;
  /** Clock for `$NOW` (defaults to `new Date()`). */
  now?: Date;
}

/** Anything that looks like a DaaS dynamic variable. */
const DYNAMIC_VARIABLE_PATTERN = /^\$(CURRENT_|NOW|FOLLOW)/;

function isDynamicVariable(value: unknown): value is string {
  return typeof value === 'string' && DYNAMIC_VARIABLE_PATTERN.test(value);
}

/**
 * Resolve dynamic values in a filter.
 *
 * Resolved:
 * - `$CURRENT_USER`     → `userId`
 * - `$CURRENT_ROLE`     → `roleId` (the user's primary role)
 * - `$CURRENT_ROLES`    → `context.roles` (array)
 * - `$CURRENT_POLICIES` → `context.policies` (array)
 * - `$NOW`              → ISO-8601 timestamp of `context.now ?? new Date()`
 *
 * Any other dynamic variable (`$CURRENT_USER.<field>`, `$NOW(-1 day)`,
 * `$FOLLOW(...)`, …), and any of the above whose value is not available
 * (e.g. `$CURRENT_ROLE` for a user without a role), throws an
 * {@link UnsupportedPermissionFilterError} — callers must deny access.
 *
 * @param filter - Filter object with potential dynamic values
 * @param userId - Current user ID
 * @param roleId - Current user's primary role ID
 * @param context - Additional session data (roles, policies, clock)
 * @returns A new filter with dynamic values resolved (input is not mutated)
 */
export function resolveFilterDynamicValues(
  filter: FilterObject,
  userId: string,
  roleId?: string | null,
  context: DynamicVariableContext = {}
): FilterObject {
  const resolveVariable = (variable: string, path: string): unknown => {
    const unavailable = (what: string) =>
      new UnsupportedPermissionFilterError(
        `dynamic variable ${variable} cannot be resolved (${what} is not available)`,
        'unresolved_variable',
        path
      );

    switch (variable) {
      case '$CURRENT_USER':
        if (typeof userId !== 'string' || userId === '') throw unavailable('user id');
        return userId;
      case '$CURRENT_ROLE':
        if (typeof roleId !== 'string' || roleId === '') throw unavailable('role');
        return roleId;
      case '$CURRENT_ROLES':
        if (!Array.isArray(context.roles)) throw unavailable('role list');
        return [...context.roles];
      case '$CURRENT_POLICIES':
        if (!Array.isArray(context.policies)) throw unavailable('policy list');
        return [...context.policies];
      case '$NOW':
        return (context.now ?? new Date()).toISOString();
      default:
        throw new UnsupportedPermissionFilterError(
          `dynamic variable ${variable} is not supported`,
          'unresolved_variable',
          path
        );
    }
  };

  const walk = (value: unknown, path: string, inArray: boolean): unknown => {
    if (isDynamicVariable(value)) {
      const resolved = resolveVariable(value, path);
      if (inArray && Array.isArray(resolved)) {
        throw new UnsupportedPermissionFilterError(
          `list variable ${value} cannot be used inside a list`,
          'unresolved_variable',
          path
        );
      }
      return resolved;
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => walk(item, `${path}[${i}]`, true));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        // defineProperty: a JSON key such as "__proto__" must stay a plain key.
        Object.defineProperty(out, key, {
          value: walk(child, joinPath(path, key), false),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }
    return value;
  };

  return walk(filter, '', false) as FilterObject;
}

// ─── Translation (filter → intermediate tree) ────────────────────

type Scalar = string | number | boolean;
type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'match';

/** Normalised, validated filter tree. */
type Node =
  | { kind: 'true' }
  | { kind: 'cmp'; field: string; op: ComparisonOp; negate: boolean; value: Scalar }
  | { kind: 'null'; field: string; negate: boolean }
  | { kind: 'in'; field: string; negate: boolean; values: Scalar[] }
  | { kind: 'and'; children: Node[] }
  | { kind: 'or'; children: Node[] };

const TRUE_NODE: Node = { kind: 'true' };

/** Plain SQL identifier; anything else (dots, JSON paths, spaces, …) is rejected. */
const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Query-string keys PostgREST reserves; a column filter under them would be misread. */
const RESERVED_FIELD_NAMES = new Set([
  'select',
  'order',
  'limit',
  'offset',
  'or',
  'and',
  'not',
  'on_conflict',
  'columns',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function andNode(children: Node[]): Node {
  const flat: Node[] = [];
  for (const child of children) {
    if (child.kind === 'true') continue;
    if (child.kind === 'and') flat.push(...child.children);
    else flat.push(child);
  }
  if (flat.length === 0) return TRUE_NODE;
  if (flat.length === 1) return flat[0];
  return { kind: 'and', children: flat };
}

function orNode(children: Node[]): Node {
  // OR with an always-true branch is always true.
  if (children.some((c) => c.kind === 'true')) return TRUE_NODE;
  const flat: Node[] = [];
  for (const child of children) {
    if (child.kind === 'or') flat.push(...child.children);
    else flat.push(child);
  }
  if (flat.length === 1) return flat[0];
  return { kind: 'or', children: flat };
}

function assertField(field: string, path: string): void {
  if (!FIELD_NAME_PATTERN.test(field) || RESERVED_FIELD_NAMES.has(field.toLowerCase())) {
    throw new UnsupportedPermissionFilterError(
      `field name ${JSON.stringify(field)} is not a plain column identifier`,
      'invalid_field',
      path
    );
  }
}

function assertScalar(value: unknown, path: string): Scalar {
  if (isDynamicVariable(value)) {
    throw new UnsupportedPermissionFilterError(
      `dynamic variable ${value} was not resolved`,
      'unresolved_variable',
      path
    );
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new UnsupportedPermissionFilterError(
    `expected a string, finite number or boolean, got ${describe(value)}`,
    'invalid_value',
    path
  );
}

function assertBoolean(value: unknown, path: string): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  if (isDynamicVariable(value)) assertScalar(value, path);
  throw new UnsupportedPermissionFilterError(
    `expected a boolean, got ${describe(value)}`,
    'invalid_value',
    path
  );
}

function assertArray(value: unknown, path: string, length?: number): unknown[] {
  if (isDynamicVariable(value)) assertScalar(value, path);
  if (!Array.isArray(value)) {
    throw new UnsupportedPermissionFilterError(
      `expected an array, got ${describe(value)}`,
      'invalid_value',
      path
    );
  }
  if (length !== undefined && value.length !== length) {
    throw new UnsupportedPermissionFilterError(
      `expected an array of ${length} values, got ${value.length}`,
      'invalid_value',
      path
    );
  }
  return value;
}

/** Escape LIKE wildcards so the value matches literally. */
function likeLiteral(value: unknown, path: string): string {
  const scalar = assertScalar(value, path);
  if (typeof scalar === 'boolean') {
    throw new UnsupportedPermissionFilterError(
      'expected a string or number, got boolean',
      'invalid_value',
      path
    );
  }
  const text = String(scalar);
  // PostgREST rewrites every `*` in a LIKE operand to `%`, and offers no escape.
  if (text.includes('*')) {
    throw new UnsupportedPermissionFilterError(
      'LIKE-based operators cannot match a literal "*" through PostgREST',
      'unsafe_value',
      path
    );
  }
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

type LikeShape = 'contains' | 'starts_with' | 'ends_with';

const LIKE_OPERATORS: Record<string, { shape: LikeShape; op: 'like' | 'ilike'; negate: boolean }> = {
  _contains: { shape: 'contains', op: 'like', negate: false },
  _ncontains: { shape: 'contains', op: 'like', negate: true },
  _icontains: { shape: 'contains', op: 'ilike', negate: false },
  _nicontains: { shape: 'contains', op: 'ilike', negate: true },
  _starts_with: { shape: 'starts_with', op: 'like', negate: false },
  _nstarts_with: { shape: 'starts_with', op: 'like', negate: true },
  _istarts_with: { shape: 'starts_with', op: 'ilike', negate: false },
  _nistarts_with: { shape: 'starts_with', op: 'ilike', negate: true },
  _ends_with: { shape: 'ends_with', op: 'like', negate: false },
  _nends_with: { shape: 'ends_with', op: 'like', negate: true },
  _iends_with: { shape: 'ends_with', op: 'ilike', negate: false },
  _niends_with: { shape: 'ends_with', op: 'ilike', negate: true },
};

const COMPARISON_OPERATORS: Record<string, ComparisonOp> = {
  _eq: 'eq',
  _neq: 'neq',
  _gt: 'gt',
  _gte: 'gte',
  _lt: 'lt',
  _lte: 'lte',
};

function compileOperator(field: string, operator: string, value: unknown, path: string): Node {
  const cmp = (op: ComparisonOp, v: Scalar, negate = false): Node => ({
    kind: 'cmp',
    field,
    op,
    negate,
    value: v,
  });

  if (Object.hasOwn(COMPARISON_OPERATORS, operator)) {
    return cmp(COMPARISON_OPERATORS[operator], assertScalar(value, path));
  }

  if (Object.hasOwn(LIKE_OPERATORS, operator)) {
    const { shape, op, negate } = LIKE_OPERATORS[operator];
    const literal = likeLiteral(value, path);
    const pattern =
      shape === 'contains' ? `%${literal}%` : shape === 'starts_with' ? `${literal}%` : `%${literal}`;
    return cmp(op, pattern, negate);
  }

  switch (operator) {
    case '_in':
    case '_nin': {
      const values = assertArray(value, path).map((v, i) => assertScalar(v, `${path}[${i}]`));
      return { kind: 'in', field, negate: operator === '_nin', values };
    }
    case '_null':
    case '_nnull': {
      const isNull = assertBoolean(value, path) === (operator === '_null');
      return { kind: 'null', field, negate: !isNull };
    }
    case '_empty':
    case '_nempty': {
      const isEmpty = assertBoolean(value, path) === (operator === '_empty');
      return isEmpty
        ? orNode([{ kind: 'null', field, negate: false }, cmp('eq', '')])
        : andNode([{ kind: 'null', field, negate: true }, cmp('neq', '')]);
    }
    case '_between':
    case '_nbetween': {
      const [low, high] = assertArray(value, path, 2).map((v, i) =>
        assertScalar(v, `${path}[${i}]`)
      );
      return operator === '_between'
        ? andNode([cmp('gte', low), cmp('lte', high)])
        : orNode([cmp('lt', low), cmp('gt', high)]);
    }
    case '_regex': {
      const pattern = assertScalar(value, path);
      if (typeof pattern !== 'string') {
        throw new UnsupportedPermissionFilterError(
          `expected a string, got ${describe(pattern)}`,
          'invalid_value',
          path
        );
      }
      return cmp('match', pattern);
    }
    default:
      throw new UnsupportedPermissionFilterError(
        `operator ${JSON.stringify(operator)} is not supported`,
        'unknown_operator',
        path
      );
  }
}

function compileField(field: string, value: unknown, path: string): Node {
  assertField(field, path);

  // Shorthand `{ field: value }` → `{ field: { _eq: value } }`.
  if (!isPlainObject(value)) {
    return compileOperator(field, '_eq', value, path);
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new UnsupportedPermissionFilterError(
      'field condition has no operators',
      'invalid_structure',
      path
    );
  }

  const children: Node[] = [];
  for (const [operator, operand] of entries) {
    const opPath = joinPath(path, operator);
    if (!operator.startsWith('_')) {
      throw new UnsupportedPermissionFilterError(
        'relational (nested field) filters are not supported by the query translator',
        'relational_filter',
        opPath
      );
    }
    children.push(compileOperator(field, operator, operand, opPath));
  }
  return andNode(children);
}

function compileGroup(value: unknown, path: string, kind: '_and' | '_or'): Node {
  if (!Array.isArray(value)) {
    throw new UnsupportedPermissionFilterError(
      `${kind} expects an array, got ${describe(value)}`,
      'invalid_structure',
      path
    );
  }
  if (kind === '_or' && value.length === 0) {
    throw new UnsupportedPermissionFilterError(
      '_or must contain at least one condition',
      'invalid_structure',
      path
    );
  }
  const children = value.map((c, i) => compileFilter(c, `${path}[${i}]`));
  return kind === '_and' ? andNode(children) : orNode(children);
}

function compileFilter(filter: unknown, path: string): Node {
  if (!isPlainObject(filter)) {
    throw new UnsupportedPermissionFilterError(
      `expected a filter object, got ${describe(filter)}`,
      'invalid_structure',
      path
    );
  }

  const children: Node[] = [];
  for (const [key, value] of Object.entries(filter)) {
    const keyPath = joinPath(path, key);
    if (key === '_and' || key === '_or') {
      children.push(compileGroup(value, keyPath, key));
    } else if (key.startsWith('_')) {
      throw new UnsupportedPermissionFilterError(
        `operator ${JSON.stringify(key)} is not supported at filter level`,
        'unknown_operator',
        keyPath
      );
    } else {
      children.push(compileField(key, value, keyPath));
    }
  }
  // An empty object imposes no restriction (DaaS: `{}` = all items).
  return andNode(children);
}

// ─── Rendering / application ─────────────────────────────────────

/**
 * Quote a value for a PostgREST filter string (logic trees and `in.(…)`
 * lists): wrap in double quotes and backslash-escape `\` and `"`.
 */
export function quotePostgrestValue(value: string | number | boolean): string {
  return `"${String(value).replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}

function renderList(values: Scalar[]): string {
  return `(${values.map(quotePostgrestValue).join(',')})`;
}

/** Render a node as a PostgREST logic-tree condition (inside `or(...)`). */
function renderCondition(node: Node): string {
  switch (node.kind) {
    case 'cmp':
      return `${node.field}.${node.negate ? 'not.' : ''}${node.op}.${quotePostgrestValue(node.value)}`;
    case 'in':
      return `${node.field}.${node.negate ? 'not.' : ''}in.${renderList(node.values)}`;
    case 'null':
      return `${node.field}.${node.negate ? 'not.' : ''}is.null`;
    case 'and':
      return `and(${node.children.map(renderCondition).join(',')})`;
    case 'or':
      return `or(${node.children.map(renderCondition).join(',')})`;
    case 'true':
      // Unreachable: andNode/orNode eliminate TRUE nodes from composite groups.
      throw new UnsupportedPermissionFilterError('internal: cannot render TRUE', 'invalid_structure');
  }
}

function applyNode<T extends QueryBuilder>(query: T, node: Node): T {
  switch (node.kind) {
    case 'true':
      return query;
    case 'and':
      // Top-level PostgREST filters are ANDed together.
      return node.children.reduce<T>((q, child) => applyNode(q, child), query);
    case 'or':
      return query.or(node.children.map(renderCondition).join(',')) as T;
    case 'null':
      return (node.negate ? query.not(node.field, 'is', null) : query.is(node.field, null)) as T;
    case 'in':
      // Built by hand (not `.in()`): postgrest-js only quotes values containing
      // `,()` and never escapes `"`, which lets crafted values alter the list.
      return (node.negate
        ? query.not(node.field, 'in', renderList(node.values))
        : query.filter(node.field, 'in', renderList(node.values))) as T;
    case 'cmp': {
      const { field, op, value } = node;
      if (node.negate) return query.not(field, op, value) as T;
      switch (op) {
        case 'eq':
          return query.eq(field, value) as T;
        case 'neq':
          return query.neq(field, value) as T;
        case 'gt':
          return query.gt(field, value) as T;
        case 'gte':
          return query.gte(field, value) as T;
        case 'lt':
          return query.lt(field, value) as T;
        case 'lte':
          return query.lte(field, value) as T;
        case 'like':
          return query.like(field, String(value)) as T;
        case 'ilike':
          return query.ilike(field, String(value)) as T;
        case 'match':
          return query.filter(field, 'match', value) as T;
      }
    }
  }
}

/**
 * Validate that a (resolved) permission filter can be translated faithfully.
 * Throws {@link UnsupportedPermissionFilterError} otherwise. Touches nothing.
 */
export function assertPermissionFilterSupported(filter: FilterObject | null | undefined): void {
  if (filter === null || filter === undefined) return;
  compileFilter(filter, '');
}

/**
 * Apply a DaaS-style filter to a Supabase query builder.
 *
 * `null` / `undefined` mean "no restriction" and return the query unchanged.
 * Any filter that cannot be expressed faithfully throws an
 * {@link UnsupportedPermissionFilterError} (a 403 {@link PermissionError})
 * before the query builder is modified — never run the query in that case.
 *
 * @param query - Supabase query builder
 * @param filter - Filter object (DaaS format, dynamic values already resolved)
 * @returns Modified query builder
 *
 * @example
 * ```typescript
 * let query = supabase.from('daas_users').select('*');
 * query = applyFilterToQuery(query, { status: { _eq: 'active' } });
 * const { data } = await query;
 * ```
 */
export function applyFilterToQuery<T extends QueryBuilder>(
  query: T,
  filter: FilterObject | null | undefined
): T {
  if (filter === null || filter === undefined) {
    return query;
  }
  return applyFilter(query, filter);
}

/**
 * Apply filter conditions (all-or-nothing: the filter is fully validated
 * before the query is modified).
 */
export function applyFilter<T extends QueryBuilder>(query: T, filter: FilterObject): T {
  return applyNode(query, compileFilter(filter, ''));
}

/**
 * Apply the operators of a single field (all-or-nothing).
 */
export function applyFieldOperators<T extends QueryBuilder>(
  query: T,
  field: string,
  operators: FilterObject
): T {
  return applyNode(query, compileField(field, operators, field));
}

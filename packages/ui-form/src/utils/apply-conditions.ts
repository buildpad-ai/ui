/**
 * Apply Conditions
 * Ported from DaaS app/src/utils/apply-conditions.ts
 *
 * Evaluates field.meta.conditions against the current form values and merges
 * the first matching condition's overrides (readonly, hidden, required, options,
 * clear_hidden_value_on_save) into the field's meta.
 *
 * Conditions are evaluated in reverse order — the LAST defined condition that
 * matches takes precedence (DaaS convention).
 */

import type { Field, FieldCondition } from '@buildpad/types';

// `FieldCondition` is now defined in `@buildpad/types` (single source of truth)
// and re-exported here for backward compatibility with existing imports.
export type { FieldCondition };

/**
 * Simple filter rule evaluation.
 *
 * DaaS conditions use a filter-rule format like:
 *   { status: { _eq: "published" } }
 *   { category: { _in: ["tech", "design"] } }
 *   { _and: [ { status: { _eq: "draft" } }, { author: { _eq: "$CURRENT_USER" } } ] }
 *
 * This function evaluates the most common operators against an item.
 */
function evaluateFilter(rule: Record<string, unknown>, item: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(rule)) {
    // Logical operators
    if (key === '_and') {
      if (!Array.isArray(condition)) return false;
      return condition.every((sub) => evaluateFilter(sub as Record<string, unknown>, item));
    }

    if (key === '_or') {
      if (!Array.isArray(condition)) return false;
      return condition.some((sub) => evaluateFilter(sub as Record<string, unknown>, item));
    }

    // Field-level condition
    const value = item[key];

    if (condition === null || condition === undefined) {
      if (value !== condition) return false;
      continue;
    }

    if (typeof condition !== 'object') {
      // Direct equality
      if (value !== condition) return false;
      continue;
    }

    // Operator-based evaluation
    const ops = condition as Record<string, unknown>;
    for (const [op, expected] of Object.entries(ops)) {
      if (!evaluateOperator(op, value, expected)) return false;
    }
  }

  return true;
}

function evaluateOperator(op: string, value: unknown, expected: unknown): boolean {
  switch (op) {
    case '_eq':
      return value === expected;
    case '_neq':
      return value !== expected;
    case '_gt':
      return typeof value === 'number' && typeof expected === 'number' && value > expected;
    case '_gte':
      return typeof value === 'number' && typeof expected === 'number' && value >= expected;
    case '_lt':
      return typeof value === 'number' && typeof expected === 'number' && value < expected;
    case '_lte':
      return typeof value === 'number' && typeof expected === 'number' && value <= expected;
    case '_in':
      return Array.isArray(expected) && expected.includes(value);
    case '_nin':
      return Array.isArray(expected) && !expected.includes(value);
    case '_null':
      return expected ? value === null || value === undefined : value !== null && value !== undefined;
    case '_nnull':
      return expected ? value !== null && value !== undefined : value === null || value === undefined;
    case '_empty':
      return expected
        ? value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
        : value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
    case '_nempty':
      return expected
        ? value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
        : value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    case '_contains':
      return typeof value === 'string' && typeof expected === 'string' && value.includes(expected);
    case '_ncontains':
      return typeof value === 'string' && typeof expected === 'string' && !value.includes(expected);
    case '_starts_with':
      return typeof value === 'string' && typeof expected === 'string' && value.startsWith(expected);
    case '_nstarts_with':
      return typeof value === 'string' && typeof expected === 'string' && !value.startsWith(expected);
    case '_ends_with':
      return typeof value === 'string' && typeof expected === 'string' && value.endsWith(expected);
    case '_nends_with':
      return typeof value === 'string' && typeof expected === 'string' && !value.endsWith(expected);
    case '_regex':
      try {
        return typeof value === 'string' && new RegExp(expected as string).test(value);
      } catch {
        return false;
      }
    case '_between': {
      if (!Array.isArray(expected) || expected.length !== 2) return false;
      const num = Number(value);
      return num >= Number(expected[0]) && num <= Number(expected[1]);
    }
    case '_nbetween': {
      if (!Array.isArray(expected) || expected.length !== 2) return false;
      const num2 = Number(value);
      return num2 < Number(expected[0]) || num2 > Number(expected[1]);
    }
    default:
      return false;
  }
}

/**
 * Deep merge utility that replaces arrays rather than concatenating them
 * (matches DaaS lodash.mergeWith behaviour)
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const result = { ...target } as Record<string, unknown>;

  for (const [key, srcVal] of Object.entries(source)) {
    if (srcVal === undefined) continue;

    const tgtVal = result[key];

    if (Array.isArray(srcVal)) {
      // Arrays are replaced, not merged (DaaS convention)
      result[key] = [...srcVal];
    } else if (srcVal !== null && typeof srcVal === 'object' && !Array.isArray(srcVal) && tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
      result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else {
      result[key] = srcVal;
    }
  }

  return result as T;
}

/**
 * Apply field conditions against the current form values.
 *
 * @param item    Current form values (merged defaults + initial + edits)
 * @param field   The field definition to evaluate conditions for
 * @param version Optional content version context (adds $version to evaluation)
 * @returns       The field with conditions applied (or the original if no match)
 */
export function applyConditions(
  item: Record<string, unknown>,
  field: Field,
  version?: { name: string } | null,
): Field {
  const conditions = field.meta?.conditions;

  if (!field.meta || !Array.isArray(conditions) || conditions.length === 0) {
    return field;
  }

  // Reverse so last-defined condition that matches wins (DaaS convention)
  const reversed = [...(conditions as FieldCondition[])].reverse();

  const matchingCondition = reversed.find((condition) => {
    if (!condition.rule || Object.keys(condition.rule).length === 0) return false;

    // Build evaluation context — include $version for version-aware rules
    const context: Record<string, unknown> = {
      ...item,
      $version: version?.name ?? null,
    };

    try {
      return evaluateFilter(condition.rule, context);
    } catch {
      return false;
    }
  });

  if (!matchingCondition) {
    return field;
  }

  // Build overrides object — only include defined values
  const overrides: Record<string, unknown> = {};
  if (matchingCondition.readonly !== undefined) overrides.readonly = matchingCondition.readonly;
  if (matchingCondition.hidden !== undefined) overrides.hidden = matchingCondition.hidden;
  if (matchingCondition.required !== undefined) overrides.required = matchingCondition.required;
  if (matchingCondition.options !== undefined) overrides.options = matchingCondition.options;
  if (matchingCondition.clear_hidden_value_on_save !== undefined) {
    overrides.clear_hidden_value_on_save = matchingCondition.clear_hidden_value_on_save;
  }

  // Deep merge condition overrides into field meta
  const updatedMeta = deepMerge({ ...(field.meta as unknown as Record<string, unknown>) }, overrides);

  return {
    ...field,
    meta: updatedMeta as unknown as typeof field.meta,
  };
}

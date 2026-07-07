/**
 * Condition round-trip test
 *
 * Proves the authoring → runtime contract end-to-end: conditions authored in
 * the `FormFieldConfig.conditions` shape (what `ConditionsEditor` emits) survive
 * the overlay merge (`buildFieldsFromDefinition`) onto the live schema and are
 * then evaluated correctly by `apply-conditions.ts` — with no translation step.
 *
 * This is the guarantee from Requirement 2.4 / 2.5: the builder emits the exact
 * `FieldCondition[]` the runtime consumes, and DaaS last-match precedence holds.
 */

import { describe, it, expect } from 'vitest';
import type { Field, FormDefinition } from '@buildpad/types';
import { buildFieldsFromDefinition } from '@buildpad/utils';
// Deep import: pulling the package root would load the whole VForm renderer
// (and EditorJS, which needs a DOM). The condition engine is self-contained.
import { applyConditions } from '@buildpad/ui-form/utils/apply-conditions';

function makeField(field: string, overrides: Partial<Field> = {}): Field {
  return {
    collection: 'issues',
    field,
    type: 'string',
    meta: {
      id: 1,
      collection: 'issues',
      field,
      readonly: false,
      hidden: false,
      required: false,
      width: 'full',
    },
    ...overrides,
  };
}

const schema: Field[] = [
  makeField('issue_type'),
  makeField('severity'),
];

/** Pull the merged `severity` field out of the built field list. */
function buildSeverity(def: FormDefinition): Field {
  const fields = buildFieldsFromDefinition(schema, def);
  const severity = fields.find((f) => f.field === 'severity');
  if (!severity) throw new Error('severity field missing from merged output');
  return severity;
}

describe('condition round-trip (builder → buildFieldsFromDefinition → applyConditions)', () => {
  const definition: FormDefinition = {
    name: 'Bug screen',
    target_collection: 'issues',
    sections: [
      {
        id: 'main',
        title: 'Main',
        fields: [
          { field: 'issue_type' },
          {
            field: 'severity',
            // Authored exactly as ConditionsEditor emits: rule + overrides.
            conditions: [
              {
                name: 'Hide unless bug',
                rule: { issue_type: { _eq: 'bug' } },
                hidden: true,
              },
            ],
          },
        ],
      },
    ],
  };

  it('carries authored conditions onto the merged field meta', () => {
    const severity = buildSeverity(definition);
    expect(severity.meta?.conditions).toHaveLength(1);
    expect(severity.meta?.conditions?.[0].rule).toEqual({
      issue_type: { _eq: 'bug' },
    });
  });

  it('does NOT apply the override when the rule does not match', () => {
    const severity = buildSeverity(definition);
    const applied = applyConditions({ issue_type: 'task' }, severity);
    // Rule is `issue_type _eq bug`; with `task` it never matches → field is
    // returned unchanged, so the default schema `hidden: false` stands.
    expect(applied.meta?.hidden).toBe(false);
  });

  it('applies the override when the rule matches', () => {
    const severity = buildSeverity(definition);
    const applied = applyConditions({ issue_type: 'bug' }, severity);
    expect(applied.meta?.hidden).toBe(true);
  });

  it('honors last-match precedence (DaaS convention: last matching wins)', () => {
    const multi: FormDefinition = {
      name: 'Precedence screen',
      target_collection: 'issues',
      sections: [
        {
          id: 'main',
          fields: [
            { field: 'issue_type' },
            {
              field: 'severity',
              conditions: [
                // Both match when issue_type === 'bug'; the LAST one wins.
                {
                  name: 'First: require',
                  rule: { issue_type: { _eq: 'bug' } },
                  required: true,
                  hidden: false,
                },
                {
                  name: 'Second: hide',
                  rule: { issue_type: { _eq: 'bug' } },
                  hidden: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const severity = buildSeverity(multi);
    const applied = applyConditions({ issue_type: 'bug' }, severity);
    // Last matching condition only sets `hidden: true`; `required` from the
    // first condition is not applied (last-match wins, not merge-of-matches).
    expect(applied.meta?.hidden).toBe(true);
    expect(applied.meta?.required).toBe(false);
  });
});

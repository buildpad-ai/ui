/**
 * buildFieldsFromDefinition Unit Tests
 *
 * Covers the overlay merge contract: ordering, width, section→group
 * membership, per-field overrides, and condition merge. Also verifies that
 * fields absent from the definition are dropped and unknown config entries are
 * skipped.
 */

import { describe, it, expect } from 'vitest';
import type { Field, FormDefinition } from '@buildpad/types';
import {
  buildFieldsFromDefinition,
  MISSING_FIELD_MARKER,
} from '../src/build-fields-from-definition';

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
      width: 'full',
    },
    ...overrides,
  };
}

const schema: Field[] = [
  makeField('title'),
  makeField('severity'),
  makeField('issue_type'),
  makeField('description'),
];

describe('buildFieldsFromDefinition', () => {
  it('orders fields by section then position and assigns incrementing sort', () => {
    const def: FormDefinition = {
      name: 'Bug screen',
      target_collection: 'issues',
      sections: [
        {
          id: 'main',
          title: 'Main',
          fields: [{ field: 'issue_type' }, { field: 'title' }],
        },
        {
          id: 'details',
          title: 'Details',
          fields: [{ field: 'severity' }],
        },
      ],
    };

    const result = buildFieldsFromDefinition(schema, def);

    // group(main), issue_type, title, group(details), severity
    expect(result.map((f) => f.field)).toEqual([
      'main',
      'issue_type',
      'title',
      'details',
      'severity',
    ]);
    expect(result.map((f) => f.meta?.sort)).toEqual([0, 1, 2, 3, 4]);
  });

  it('synthesizes a group-raw alias field per section with its title', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', title: 'Main', fields: [{ field: 'title' }] }],
    };

    const [group] = buildFieldsFromDefinition(schema, def);

    expect(group.type).toBe('alias');
    expect(group.field).toBe('main');
    expect(group.meta?.interface).toBe('group-raw');
    expect(group.meta?.special).toContain('group');
    expect(group.meta?.note).toBe('Main');
  });

  it('assigns section membership via meta.group', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title' }] }],
    };

    const result = buildFieldsFromDefinition(schema, def);
    const title = result.find((f) => f.field === 'title');

    expect(title?.meta?.group).toBe('main');
  });

  it('applies width and required/readonly/hidden/note overrides', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [
        {
          id: 'main',
          fields: [
            {
              field: 'title',
              width: 'half',
              required: true,
              readonly: true,
              hidden: true,
              note: 'Short summary',
            },
          ],
        },
      ],
    };

    const title = buildFieldsFromDefinition(schema, def).find(
      (f) => f.field === 'title',
    );

    expect(title?.meta?.width).toBe('half');
    expect(title?.meta?.required).toBe(true);
    expect(title?.meta?.readonly).toBe(true);
    expect(title?.meta?.hidden).toBe(true);
    expect(title?.meta?.note).toBe('Short summary');
  });

  it('merges conditions verbatim into meta.conditions', () => {
    const conditions = [
      { name: 'show for bugs', rule: { issue_type: { _eq: 'bug' } }, hidden: false },
    ];
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'severity', conditions }] }],
    };

    const severity = buildFieldsFromDefinition(schema, def).find(
      (f) => f.field === 'severity',
    );

    expect(severity?.meta?.conditions).toEqual(conditions);
  });

  it('drops schema fields absent from the definition', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title' }] }],
    };

    const fieldKeys = buildFieldsFromDefinition(schema, def).map((f) => f.field);

    expect(fieldKeys).not.toContain('description');
    expect(fieldKeys).not.toContain('severity');
  });

  it('flags a real-column field missing from the schema as "missing"', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [
        { id: 'main', fields: [{ field: 'ghost_field' }, { field: 'title' }] },
      ],
    };

    const result = buildFieldsFromDefinition(schema, def);
    const ghost = result.find((f) => f.field === 'ghost_field');

    // Still emitted (so the builder can surface it), but flagged + hidden.
    expect(ghost).toBeDefined();
    expect(ghost?.meta?.special).toContain(MISSING_FIELD_MARKER);
    expect(ghost?.meta?.hidden).toBe(true);
    expect(ghost?.meta?.store).toBe('column');
    expect(ghost?.meta?.interface).toBe('presentation-notice');
    expect(result.map((f) => f.field)).toContain('title');
  });

  it('synthesizes an extras field from its inline descriptor', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [
        {
          id: 'main',
          fields: [
            {
              field: 'browser',
              store: 'extras',
              required: true,
              width: 'half',
              extra: {
                type: 'string',
                interface: 'select-dropdown',
                label: 'Browser',
                options: { choices: [{ text: 'Chrome', value: 'chrome' }] },
              },
            },
          ],
        },
      ],
    };

    const browser = buildFieldsFromDefinition(schema, def).find(
      (f) => f.field === 'browser',
    );

    expect(browser).toBeDefined();
    expect(browser?.type).toBe('string');
    expect(browser?.schema).toBeUndefined(); // not a real column
    expect(browser?.meta?.store).toBe('extras');
    expect(browser?.meta?.interface).toBe('select-dropdown');
    expect(browser?.meta?.note).toBe('Browser');
    expect(browser?.meta?.required).toBe(true);
    expect(browser?.meta?.width).toBe('half');
    expect(browser?.meta?.options).toEqual({
      choices: [{ text: 'Chrome', value: 'chrome' }],
    });
  });

  it('infers the extras interface from its type when not given', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [
        {
          id: 'main',
          fields: [{ field: 'notes', store: 'extras', extra: { type: 'text' } }],
        },
      ],
    };

    const notes = buildFieldsFromDefinition(schema, def).find(
      (f) => f.field === 'notes',
    );

    expect(notes?.meta?.interface).toBe('input-multiline');
    expect(notes?.meta?.store).toBe('extras');
  });

  it('defaults real-column fields to meta.store "column"', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title' }] }],
    };

    const title = buildFieldsFromDefinition(schema, def).find(
      (f) => f.field === 'title',
    );

    expect(title?.meta?.store).toBe('column');
  });

  it('does not mutate the input schema fields', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title', width: 'half' }] }],
    };

    buildFieldsFromDefinition(schema, def);

    const original = schema.find((f) => f.field === 'title');
    expect(original?.meta?.width).toBe('full');
    expect(original?.meta?.group).toBeUndefined();
  });
});

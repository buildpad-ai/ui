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

    // group(main), heading, issue_type, title, group(details), heading, severity
    expect(result.map((f) => f.field)).toEqual([
      'main',
      'main__heading',
      'issue_type',
      'title',
      'details',
      'details__heading',
      'severity',
    ]);
    expect(result.map((f) => f.meta?.sort)).toEqual([0, 1, 2, 3, 4, 5, 6]);
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

  it('heads a titled section with a presentation-divider inside its group', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', title: 'Main', fields: [{ field: 'title' }] }],
    };

    const [, heading, title] = buildFieldsFromDefinition(schema, def);

    expect(heading.field).toBe('main__heading');
    expect(heading.type).toBe('alias');
    expect(heading.meta?.interface).toBe('presentation-divider');
    expect(heading.meta?.special).toEqual(['alias', 'no-data']);
    expect(heading.meta?.options).toEqual({ title: 'Main' });
    expect(heading.meta?.group).toBe('main');
    expect(title.field).toBe('title');
  });

  it('adds no heading to an untitled section', () => {
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title' }] }],
    };

    expect(buildFieldsFromDefinition(schema, def).map((f) => f.field)).toEqual(['main', 'title']);
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
    // The builder shows the override as the label, so the form does too.
    expect(title?.meta?.name).toBe('Short summary');
    expect(title?.meta?.note).toBeNull();
  });

  it("labels a field with its schema note when there is no override, as the builder does", () => {
    const noted = [makeField('title', { meta: { ...makeField('title').meta!, note: 'Headline' } })];
    const def: FormDefinition = {
      name: 'S',
      target_collection: 'issues',
      sections: [{ id: 'main', fields: [{ field: 'title' }, { field: 'severity' }] }],
    };

    const result = buildFieldsFromDefinition([...noted, makeField('severity')], def);
    const title = result.find((f) => f.field === 'title');
    const severity = result.find((f) => f.field === 'severity');

    expect(title?.meta?.name).toBe('Headline');
    expect(title?.meta?.note).toBeNull();
    // No note and no override: the form falls back to translations / the column name.
    expect(severity?.meta?.name).toBeUndefined();
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
    expect(browser?.meta?.name).toBe('Browser');
    expect(browser?.meta?.note).toBeNull();
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

/**
 * Provisionable interface catalog unit tests
 *
 * Covers the type-aware interface picker data source:
 * `provisionableInterfacesForType(type)` filters by the interface `types`, and
 * every catalog entry uses a renderer-recognized id + valid field types.
 */

import { describe, it, expect } from 'vitest';
import type { Field } from '@buildpad/types';
import {
  PROVISIONABLE_INTERFACES,
  provisionableInterfacesForType,
} from '../src/interface-catalog';
import { getFieldInterface } from '../src/field-interface-mapper';

/** Field types in the `FieldType` union (interface-types.ts). */
const VALID_FIELD_TYPES = new Set([
  'string', 'text', 'boolean', 'integer', 'bigInteger', 'float', 'decimal',
  'timestamp', 'dateTime', 'date', 'time', 'json', 'csv', 'uuid', 'hash',
  'binary', 'alias', 'geometry', 'unknown',
]);

const valuesFor = (type: string) =>
  provisionableInterfacesForType(type).map((i) => i.value);

describe('provisionableInterfacesForType', () => {
  it('returns only boolean interfaces for a boolean type', () => {
    expect(valuesFor('boolean')).toEqual(['boolean', 'toggle']);
  });

  it('returns the json-compatible interfaces (and not text-only input)', () => {
    const json = valuesFor('json');
    expect(json).toEqual(
      expect.arrayContaining([
        'input-code',
        'tags',
        'select-multiple-checkbox',
        'select-multiple-dropdown',
      ]),
    );
    expect(json).not.toContain('input');
  });

  it('maps every temporal type to the datetime picker', () => {
    for (const t of ['dateTime', 'date', 'time', 'timestamp']) {
      expect(valuesFor(t)).toContain('datetime');
    }
  });

  it('returns [] for a type with no provisionable interface', () => {
    expect(provisionableInterfacesForType('binary')).toEqual([]);
    expect(provisionableInterfacesForType('not-a-type')).toEqual([]);
  });

  it('offers the map interface for geometry', () => {
    expect(valuesFor('geometry')).toEqual(['map']);
  });
});

describe('PROVISIONABLE_INTERFACES integrity', () => {
  // Proof that every offered interface resolves through the REAL renderer
  // resolver (`getFieldInterface`) to its own dedicated component — not a
  // silent type-based fallback. If a catalog id weren't recognized, the resolver
  // would fall back and `.type` would differ, failing this test.
  it.each(PROVISIONABLE_INTERFACES.map((i) => [i.value, i.types[0]] as const))(
    'interface "%s" resolves to its own renderer component',
    (value, type) => {
      const field = {
        collection: '__preview__',
        field: 'f',
        type,
        meta: { id: -1, collection: '__preview__', field: 'f', interface: value },
      } as unknown as Field;
      expect(getFieldInterface(field).type).toBe(value);
    },
  );

  it('every entry declares at least one valid field type', () => {
    for (const i of PROVISIONABLE_INTERFACES) {
      expect(i.types.length).toBeGreaterThan(0);
      for (const t of i.types) expect(VALID_FIELD_TYPES.has(t)).toBe(true);
    }
  });

  it('has no duplicate interface ids', () => {
    const values = PROVISIONABLE_INTERFACES.map((i) => i.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

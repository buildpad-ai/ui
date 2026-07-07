/**
 * fieldSpecToDaaSField Unit Tests
 *
 * Covers the builder `FieldSpec` → DaaS `Field` create-payload mapping:
 * type → `schema.data_type`, type → `meta.interface` (and explicit override),
 * the `add_index` DDL flag, and required → `is_nullable`/`meta.required`.
 */

import { describe, it, expect } from 'vitest';
import type { FieldSpec } from '@buildpad/types';
import {
  fieldSpecToDaaSField,
  dataTypeForFieldType,
  interfaceForFieldType,
} from '../src/field-spec-mapper';

describe('fieldSpecToDaaSField', () => {
  it('maps type → schema.data_type and infers meta.interface', () => {
    const spec: FieldSpec = { field: 'title', type: 'string' };
    const out = fieldSpecToDaaSField('issues', spec);

    expect(out.collection).toBe('issues');
    expect(out.field).toBe('title');
    expect(out.type).toBe('string');
    expect(out.schema?.data_type).toBe('varchar');
    expect(out.meta?.interface).toBe('input');
  });

  it('defaults to string when type is omitted', () => {
    const out = fieldSpecToDaaSField('issues', { field: 'label' });
    expect(out.type).toBe('string');
    expect(out.schema?.data_type).toBe('varchar');
    expect(out.meta?.interface).toBe('input');
  });

  it.each([
    ['integer', 'integer', 'input'],
    ['bigInteger', 'bigint', 'input'],
    ['float', 'float', 'input'],
    ['decimal', 'numeric', 'input'],
    ['boolean', 'boolean', 'boolean'],
    ['text', 'text', 'input-multiline'],
    ['json', 'json', 'input-code'],
    ['uuid', 'uuid', 'input'],
    ['date', 'date', 'datetime'],
    ['dateTime', 'timestamp', 'datetime'],
    ['timestamp', 'timestamp', 'datetime'],
  ])('maps %s → data_type %s + interface %s', (type, dataType, iface) => {
    const out = fieldSpecToDaaSField('c', { field: 'f', type });
    expect(out.schema?.data_type).toBe(dataType);
    expect(out.meta?.interface).toBe(iface);
  });

  it('honors an explicit interface override', () => {
    const out = fieldSpecToDaaSField('issues', {
      field: 'priority',
      type: 'string',
      interface: 'select-dropdown',
      options: { choices: [{ text: 'High', value: 'high' }] },
    });
    expect(out.meta?.interface).toBe('select-dropdown');
    expect(out.meta?.options).toEqual({
      choices: [{ text: 'High', value: 'high' }],
    });
  });

  it('sets add_index only when requested', () => {
    const indexed = fieldSpecToDaaSField('issues', {
      field: 'status',
      type: 'string',
      addIndex: true,
    });
    expect(indexed.add_index).toBe(true);

    const plain = fieldSpecToDaaSField('issues', {
      field: 'status',
      type: 'string',
    });
    expect(plain.add_index).toBeUndefined();
  });

  it('maps required → is_nullable false + meta.required', () => {
    const required = fieldSpecToDaaSField('issues', {
      field: 'title',
      type: 'string',
      required: true,
    });
    expect(required.schema?.is_nullable).toBe(false);
    expect(required.meta?.required).toBe(true);

    const optional = fieldSpecToDaaSField('issues', {
      field: 'title',
      type: 'string',
    });
    expect(optional.schema?.is_nullable).toBe(true);
    expect(optional.meta?.required).toBe(false);
  });

  it('carries label → meta.note and width/readonly/hidden overrides', () => {
    const out = fieldSpecToDaaSField('issues', {
      field: 'summary',
      type: 'string',
      label: 'Short summary',
      width: 'half',
      readonly: true,
      hidden: true,
    });
    expect(out.meta?.note).toBe('Short summary');
    expect(out.meta?.width).toBe('half');
    expect(out.meta?.readonly).toBe(true);
    expect(out.meta?.hidden).toBe(true);
  });

  it('passes through maxLength and defaultValue into schema', () => {
    const out = fieldSpecToDaaSField('issues', {
      field: 'code',
      type: 'string',
      maxLength: 32,
      defaultValue: 'TBD',
    });
    expect(out.schema?.max_length).toBe(32);
    expect(out.schema?.default_value).toBe('TBD');
  });

  it('exposes the type→data_type and type→interface helpers with fallbacks', () => {
    expect(dataTypeForFieldType('integer')).toBe('integer');
    expect(dataTypeForFieldType('mystery')).toBe('varchar');
    expect(interfaceForFieldType('boolean')).toBe('boolean');
    expect(interfaceForFieldType('mystery')).toBe('input');
  });
});

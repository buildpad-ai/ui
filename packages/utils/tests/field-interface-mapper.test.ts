/**
 * Field Interface Mapper Unit Tests
 *
 * Covers the explicit `"input"` interface mapping: it must not inject a
 * hardcoded `type: "string"` prop, so the `type: field.type` passed by
 * FormFieldInterface survives and numeric fields render as number inputs.
 */

import { describe, it, expect } from 'vitest';
import { getFieldInterface } from '../src/field-interface-mapper';
import type { Field } from '@buildpad/types';

function makeField(overrides: Partial<Field> = {}): Field {
  return {
    collection: 'test_collection',
    field: 'test_field',
    type: 'string',
    ...overrides,
  };
}

describe('getFieldInterface — explicit "input" interface', () => {
  it('does not override the field type with a hardcoded "string" prop', () => {
    const field = makeField({
      type: 'integer',
      meta: { interface: 'input' } as Field['meta'],
    });

    const config = getFieldInterface(field);

    expect(config.type).toBe('input');
    expect(config.props?.type).toBeUndefined();
  });

  it('still allows meta.options to override the type prop', () => {
    const field = makeField({
      type: 'integer',
      meta: { interface: 'input', options: { type: 'string' } } as Field['meta'],
    });

    const config = getFieldInterface(field);

    expect(config.type).toBe('input');
    expect(config.props?.type).toBe('string');
  });

  it('passes through other meta.options as props', () => {
    const field = makeField({
      type: 'decimal',
      meta: { interface: 'input', options: { placeholder: 'Amount' } } as Field['meta'],
    });

    const config = getFieldInterface(field);

    expect(config.type).toBe('input');
    expect(config.props?.placeholder).toBe('Amount');
    expect(config.props?.type).toBeUndefined();
  });

  it('keeps the string fallback for fields without an explicit interface', () => {
    const field = makeField({ type: 'string' });

    const config = getFieldInterface(field);

    expect(config.type).toBe('input');
    expect(config.props?.type).toBe('string');
  });
});

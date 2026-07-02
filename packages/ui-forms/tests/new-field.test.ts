/**
 * New-field naming + choice-interface unit tests
 *
 * Covers the pure logic behind the "configure-after" catalog-field flow (task
 * 37): the column-name derivation + uniqueness validation shared by the name
 * prompt and the "Add field" modal, and the choice-interface predicate that
 * gates the choices editor and the save-time guard.
 */

import { describe, it, expect } from 'vitest';
import { toFieldKey, fieldKeyError, FIELD_KEY_PATTERN } from '../src/field-name';
import { interfaceRequiresChoices, CHOICE_INTERFACES } from '@buildpad/utils';

describe('toFieldKey', () => {
  it('slugifies a human label to snake_case', () => {
    expect(toFieldKey('Steps to reproduce')).toBe('steps_to_reproduce');
    expect(toFieldKey('  Priority Level  ')).toBe('priority_level');
  });

  it('collapses/strips non-alphanumerics and repeated underscores', () => {
    expect(toFieldKey('foo -- bar//baz')).toBe('foo_bar_baz');
    expect(toFieldKey('__weird__name__')).toBe('weird_name');
    expect(toFieldKey('Café & Crème')).toBe('caf_cr_me');
  });

  it('returns an empty string for input with no usable characters', () => {
    expect(toFieldKey('   ')).toBe('');
    expect(toFieldKey('---')).toBe('');
  });
});

describe('fieldKeyError (name/key uniqueness + validity)', () => {
  const existing = new Set(['title', 'status', 'user_created']);

  it('requires a non-empty key', () => {
    expect(fieldKeyError('', existing)).toMatch(/required/i);
  });

  it('rejects keys that violate the snake_case-start-with-letter rule', () => {
    expect(fieldKeyError('1abc', existing)).toMatch(/lowercase/i);
    expect(fieldKeyError('Bad Name', existing)).toMatch(/lowercase/i);
    expect(fieldKeyError('_leading', existing)).toMatch(/lowercase/i);
  });

  it('rejects a key that collides with an existing field (uniqueness)', () => {
    expect(fieldKeyError('title', existing)).toMatch(/already exists/i);
    expect(fieldKeyError('status', existing)).toMatch(/already exists/i);
  });

  it('accepts a valid, unique key', () => {
    expect(fieldKeyError('steps_to_reproduce', existing)).toBeNull();
    expect(fieldKeyError('a', existing)).toBeNull();
  });

  it('a derived key round-trips through the validator', () => {
    const key = toFieldKey('Steps to reproduce');
    expect(FIELD_KEY_PATTERN.test(key)).toBe(true);
    expect(fieldKeyError(key, existing)).toBeNull();
    // …and a second field with the same label now collides.
    expect(fieldKeyError(key, new Set([...existing, key]))).toMatch(
      /already exists/i,
    );
  });
});

describe('interfaceRequiresChoices', () => {
  it('is true for the choice interfaces', () => {
    expect(interfaceRequiresChoices('select-dropdown')).toBe(true);
    expect(interfaceRequiresChoices('select-radio')).toBe(true);
    expect(interfaceRequiresChoices('select-multiple-checkbox')).toBe(true);
    expect(interfaceRequiresChoices('select-multiple-dropdown')).toBe(true);
  });

  it('is false for non-choice interfaces', () => {
    expect(interfaceRequiresChoices('input')).toBe(false);
    expect(interfaceRequiresChoices('datetime')).toBe(false);
    expect(interfaceRequiresChoices('boolean')).toBe(false);
    expect(interfaceRequiresChoices('')).toBe(false);
    expect(interfaceRequiresChoices('not-a-real-interface')).toBe(false);
  });

  it('matches the exported CHOICE_INTERFACES set', () => {
    for (const value of CHOICE_INTERFACES) {
      expect(interfaceRequiresChoices(value)).toBe(true);
    }
  });
});

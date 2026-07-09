/**
 * Tests for translate-field utility functions
 */

import { describe, it, expect } from 'vitest';
import { getFieldDisplayName, formatFieldTitle } from '../src/translate-field';
import type { Field } from '@buildpad/types';

/** Helper to create a minimal Field object */
function makeField(
  fieldName: string,
  translations?: Array<{ language: string; translation: string }> | null,
): Field {
  return {
    collection: 'test',
    field: fieldName,
    type: 'string',
    meta: translations !== undefined
      ? {
          id: 1,
          collection: 'test',
          field: fieldName,
          readonly: false,
          hidden: false,
          translations,
        }
      : null,
  };
}

describe('formatFieldTitle', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatFieldTitle('first_name')).toBe('First Name');
  });

  it('handles single word', () => {
    expect(formatFieldTitle('status')).toBe('Status');
  });

  it('handles multiple underscores', () => {
    expect(formatFieldTitle('created_at_utc')).toBe('Created At Utc');
  });

  it('handles empty string', () => {
    expect(formatFieldTitle('')).toBe('');
  });

  it('handles already capitalized words', () => {
    expect(formatFieldTitle('IP_address')).toBe('IP Address');
  });
});

describe('getFieldDisplayName', () => {
  it('returns title-cased field name when no translations', () => {
    const field = makeField('user_name');
    expect(getFieldDisplayName(field)).toBe('User Name');
  });

  it('returns title-cased field name when meta is null', () => {
    const field = makeField('first_name');
    expect(getFieldDisplayName(field)).toBe('First Name');
  });

  it('returns title-cased field name when translations is null', () => {
    const field = makeField('email_address', null);
    expect(getFieldDisplayName(field)).toBe('Email Address');
  });

  it('returns title-cased field name when translations is empty', () => {
    const field = makeField('phone_number', []);
    expect(getFieldDisplayName(field)).toBe('Phone Number');
  });

  it('returns first translation when locale not provided', () => {
    const field = makeField('full_name', [
      { language: 'en-US', translation: 'Full Name' },
      { language: 'zh-CN', translation: '全名' },
    ]);
    // No locale passed — uses first available translation
    expect(getFieldDisplayName(field)).toBe('Full Name');
  });

  it('returns first non-empty translation when locale not provided', () => {
    const field = makeField('author_name', [
      { language: 'en-US', translation: '' },
      { language: 'zh-CN', translation: '作者姓名' },
    ]);
    expect(getFieldDisplayName(field)).toBe('作者姓名');
  });

  it('returns exact locale match', () => {
    const field = makeField('full_name', [
      { language: 'en-US', translation: 'Full Name' },
      { language: 'zh-CN', translation: '全名' },
    ]);
    expect(getFieldDisplayName(field, 'zh-CN')).toBe('全名');
  });

  it('returns exact locale match (case-insensitive)', () => {
    const field = makeField('full_name', [
      { language: 'en-US', translation: 'Full Name' },
      { language: 'zh-CN', translation: '全名' },
    ]);
    expect(getFieldDisplayName(field, 'EN-US')).toBe('Full Name');
  });

  it('returns prefix match when exact match not found', () => {
    const field = makeField('author_name', [
      { language: 'en', translation: 'Author Name' },
      { language: 'zh', translation: '作者姓名' },
    ]);
    // 'en-US' starts with 'en'
    expect(getFieldDisplayName(field, 'en-US')).toBe('Author Name');
  });

  it('falls back to formatFieldTitle when locale does not match (matching DaaS)', () => {
    const field = makeField('author_name', [
      { language: 'en-US', translation: 'Author Name' },
    ]);
    // With explicit locale that doesn't match → formatFieldTitle, not first translation
    expect(getFieldDisplayName(field, 'ja-JP')).toBe('Author Name');
  });

  it('falls back to formatFieldTitle when locale provided but no match and field name differs', () => {
    const field = makeField('created_by', [
      { language: 'en-US', translation: 'Created By User' },
    ]);
    // 'ja-JP' doesn't match 'en-US' → formatFieldTitle('created_by') = 'Created By'
    expect(getFieldDisplayName(field, 'ja-JP')).toBe('Created By');
  });

  it('falls back to formatFieldTitle when all translations are empty', () => {
    const field = makeField('author_name', [
      { language: 'en-US', translation: '' },
    ]);
    expect(getFieldDisplayName(field, 'en-US')).toBe('Author Name');
  });

  it('handles Malay locale (ms-MY)', () => {
    const field = makeField('full_name', [
      { language: 'en-US', translation: 'Full Name' },
      { language: 'ms-MY', translation: 'Nama Penuh' },
      { language: 'zh-CN', translation: '全名' },
    ]);
    expect(getFieldDisplayName(field, 'ms-MY')).toBe('Nama Penuh');
  });
});

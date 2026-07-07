/**
 * Hybrid storage round-trip tests — real columns + `extras` jsonb tail.
 *
 * Mirrors what `CollectionForm` does on load (flatten) and save (extract +
 * merge): form values ↔ real columns + the single `extras` jsonb column.
 */

import { describe, it, expect } from 'vitest';
import {
  EXTRAS_COLUMN,
  flattenExtras,
  extractExtras,
  mergeExtras,
} from '../src/extras-storage';

describe('flattenExtras (load)', () => {
  it('spreads the extras jsonb object into flat form values, keeping the raw key', () => {
    const item = {
      id: 1,
      title: 'Bug',
      [EXTRAS_COLUMN]: { browser: 'chrome', steps: '1. open' },
    };

    const flat = flattenExtras(item);

    expect(flat.title).toBe('Bug');
    expect(flat.browser).toBe('chrome');
    expect(flat.steps).toBe('1. open');
    // Raw container is retained to serve as the merge base on save.
    expect(flat[EXTRAS_COLUMN]).toEqual({ browser: 'chrome', steps: '1. open' });
  });

  it('is a no-op (shallow copy) when there is no extras object', () => {
    const item = { id: 1, title: 'Bug' };
    const flat = flattenExtras(item);
    expect(flat).toEqual(item);
    expect(flat).not.toBe(item);
  });

  it('ignores a non-object extras value', () => {
    const item = { id: 1, [EXTRAS_COLUMN]: null };
    expect(flattenExtras(item)).toEqual({ id: 1, [EXTRAS_COLUMN]: null });
  });
});

describe('extractExtras (save split)', () => {
  it('routes store:extras field names into extras and the rest into rest', () => {
    const values = {
      title: 'Bug',
      severity: 'high',
      browser: 'firefox',
    };
    const { rest, extras } = extractExtras(values, new Set(['browser']));

    expect(rest).toEqual({ title: 'Bug', severity: 'high' });
    expect(extras).toEqual({ browser: 'firefox' });
  });

  it('drops the raw extras container key (rebuilt on save)', () => {
    const values = {
      title: 'Bug',
      browser: 'firefox',
      [EXTRAS_COLUMN]: { browser: 'chrome' },
    };
    const { rest, extras } = extractExtras(values, new Set(['browser']));

    expect(rest).toEqual({ title: 'Bug' });
    expect(extras).toEqual({ browser: 'firefox' });
    expect(rest).not.toHaveProperty(EXTRAS_COLUMN);
  });

  it('puts everything in rest when there are no extra fields', () => {
    const values = { title: 'Bug', severity: 'high' };
    const { rest, extras } = extractExtras(values, new Set());
    expect(rest).toEqual(values);
    expect(extras).toEqual({});
  });
});

describe('mergeExtras (partial update)', () => {
  it('merges changed extras over the previously stored object', () => {
    expect(
      mergeExtras({ browser: 'chrome', steps: 'a' }, { browser: 'firefox' }),
    ).toEqual({ browser: 'firefox', steps: 'a' });
  });

  it('treats a missing/invalid prev as an empty base', () => {
    expect(mergeExtras(undefined, { browser: 'firefox' })).toEqual({
      browser: 'firefox',
    });
    expect(mergeExtras(null, { a: 1 })).toEqual({ a: 1 });
    expect(mergeExtras([1, 2], { a: 1 })).toEqual({ a: 1 });
  });
});

describe('full round-trip: load → edit → save', () => {
  it('writes real columns and a merged extras object on partial edit', () => {
    const extrasFieldNames = new Set(['browser', 'steps']);

    // Server item → flatten on load.
    const serverItem = {
      id: 7,
      title: 'Crash',
      severity: 'low',
      [EXTRAS_COLUMN]: { browser: 'chrome', steps: 'open app' },
    };
    const formValues = flattenExtras(serverItem);
    expect(formValues.browser).toBe('chrome');

    // User edits a real column and one extra; only those are "changed".
    const changed = { severity: 'high', browser: 'firefox' };

    // Save: split + merge into the existing extras.
    const { rest, extras } = extractExtras(changed, extrasFieldNames);
    const patch: Record<string, unknown> = { ...rest };
    if (Object.keys(extras).length > 0) {
      patch[EXTRAS_COLUMN] = mergeExtras(formValues[EXTRAS_COLUMN], extras);
    }

    expect(patch).toEqual({
      severity: 'high',
      [EXTRAS_COLUMN]: { browser: 'firefox', steps: 'open app' },
    });
  });

  it('creates an item with a fresh extras object', () => {
    const extrasFieldNames = new Set(['browser']);
    const formValues = { title: 'New', browser: 'safari' };

    const { rest, extras } = extractExtras(formValues, extrasFieldNames);
    const payload: Record<string, unknown> = { ...rest };
    if (Object.keys(extras).length > 0) payload[EXTRAS_COLUMN] = extras;

    expect(payload).toEqual({ title: 'New', [EXTRAS_COLUMN]: { browser: 'safari' } });
  });
});

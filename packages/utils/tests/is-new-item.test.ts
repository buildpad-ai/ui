/**
 * New-item sentinel tests: "+" (and its encoding) opens a create form, and a
 * row keyed "new" opens for editing.
 */
import { describe, it, expect } from 'vitest';
import { isNewItem, isExistingItem } from '../src/is-new-item';

describe('isNewItem', () => {
  it('reads the create segment "+" and its encoding as a new item', () => {
    expect(isNewItem('+')).toBe(true);
    expect(isNewItem('%2B')).toBe(true);
  });

  it('reads no key as a new item', () => {
    expect(isNewItem(null)).toBe(true);
    expect(isNewItem(undefined)).toBe(true);
    expect(isNewItem('')).toBe(true);
  });

  it('reads "new" as an item key, not as a new item', () => {
    // A manually entered string key can be "new"; that row must open for editing.
    expect(isNewItem('new')).toBe(false);
    expect(isExistingItem('new')).toBe(true);
  });

  it('reads other keys as existing items', () => {
    expect(isNewItem('abc-123')).toBe(false);
    expect(isNewItem(42)).toBe(false);
    expect(isNewItem(0)).toBe(false);
    expect(isExistingItem(42)).toBe(true);
  });
});

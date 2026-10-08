/**
 * Page arithmetic tests: a list never asks for, or stays on, a page past its
 * last one.
 */
import { describe, it, expect } from 'vitest';
import { clampPage, pageAfterRemoval } from '../src/list-page';

describe('clampPage', () => {
  it('keeps a page inside the list', () => {
    expect(clampPage(1, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(3, 3)).toBe(3);
  });

  it('steps back to the last page when the page is past it', () => {
    // Page 2 held one row; it was deleted, and the list now has one page.
    expect(clampPage(2, 1)).toBe(1);
    expect(clampPage(9, 4)).toBe(4);
  });

  it('treats an empty list as one page', () => {
    // The reference routes answer totalPages 0 for no rows; the engine answers 1.
    expect(clampPage(1, 0)).toBe(1);
    expect(clampPage(3, 0)).toBe(1);
  });

  it('never goes below page 1 and ignores fractions', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-2, 5)).toBe(1);
    expect(clampPage(2.9, 5)).toBe(2);
    expect(clampPage(2, 2.5)).toBe(2);
  });

  it('falls back to page 1 for values that are not numbers', () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(3, Number.NaN)).toBe(1);
    expect(clampPage(Number.POSITIVE_INFINITY, 5)).toBe(1);
  });
});

describe('pageAfterRemoval', () => {
  it('stays on the page while it still has a row', () => {
    expect(pageAfterRemoval(2, 25)).toBe(2);
    expect(pageAfterRemoval(2, 2)).toBe(2);
    expect(pageAfterRemoval(3, 5, 4)).toBe(3);
  });

  it('steps back when the last row of the page was deleted', () => {
    expect(pageAfterRemoval(2, 1)).toBe(1);
    expect(pageAfterRemoval(4, 3, 3)).toBe(3);
  });

  it('stays on page 1 when page 1 was emptied', () => {
    expect(pageAfterRemoval(1, 1)).toBe(1);
    expect(pageAfterRemoval(0, 0)).toBe(1);
  });
});

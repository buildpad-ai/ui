/**
 * three-way-merge.ts tests
 */

import { describe, expect, test } from 'vitest';
import { threeWayMerge } from '../src/utils/three-way-merge.js';

describe('threeWayMerge', () => {
  test('clean merge when ours and theirs change well-separated regions', () => {
    // node-diff3 needs unchanged context BETWEEN edits to merge cleanly.
    // Adjacent edits (lines 2 and 3 with no separator) collapse into a
    // single conflict region — which is the standard diff3 behaviour.
    const base   = 'a\nb\nc\nd\ne\nf\ng\nh\ni\n';
    const ours   = 'a\nb-mine\nc\nd\ne\nf\ng\nh\ni\n';        // changed line 2
    const theirs = 'a\nb\nc\nd\ne\nf\ng\nh\ni-upstream\n';     // changed line 9
    const result = threeWayMerge(ours, base, theirs);
    expect(result.ok).toBe(true);
    expect(result.text).toContain('b-mine');
    expect(result.text).toContain('i-upstream');
  });

  test('returns ours unchanged when theirs is identical to base', () => {
    const base   = 'a\nb\nc\n';
    const ours   = 'a\nb-mine\nc\n';
    const theirs = base;
    const result = threeWayMerge(ours, base, theirs);
    expect(result.ok).toBe(true);
    expect(result.text).toContain('b-mine');
  });

  test('returns theirs when ours is identical to base', () => {
    const base   = 'a\nb\nc\n';
    const ours   = base;
    const theirs = 'a\nb\nc-upstream\n';
    const result = threeWayMerge(ours, base, theirs);
    expect(result.ok).toBe(true);
    expect(result.text).toContain('c-upstream');
  });

  test('reports conflict when ours and theirs change the same line', () => {
    const base   = 'a\nb\nc\n';
    const ours   = 'a\nb-mine\nc\n';
    const theirs = 'a\nb-upstream\nc\n';
    const result = threeWayMerge(ours, base, theirs);
    expect(result.ok).toBe(false);
    expect(result.text).toContain('<<<<<<< HEAD');
    expect(result.text).toContain('=======');
    expect(result.text).toContain('>>>>>>> upstream');
    expect(result.text).toContain('b-mine');
    expect(result.text).toContain('b-upstream');
  });

  test('normalises CRLF on all three sides before merging', () => {
    // Without LF normalisation, every line of `ours` (CRLF) would conflict
    // against `base`/`theirs` (LF) because the line bytes differ.
    const base   = 'a\nb\nc\nd\ne\nf\ng\nh\ni\n';
    const ours   = 'a\r\nb-mine\r\nc\r\nd\r\ne\r\nf\r\ng\r\nh\r\ni\r\n';
    const theirs = 'a\nb\nc\nd\ne\nf\ng\nh\ni-upstream\n';
    const result = threeWayMerge(ours, base, theirs);
    expect(result.ok).toBe(true);
    expect(result.text).toContain('b-mine');
    expect(result.text).toContain('i-upstream');
  });

  test('handles empty inputs without throwing', () => {
    const result = threeWayMerge('', '', '');
    expect(result.ok).toBe(true);
  });
});

/**
 * findComponentWithSuggestions: name resolution used by `buildpad add <name>`.
 * Pure function (aside from the console.log suggestion output) — unit tested
 * directly rather than through the full add() file-copy pipeline.
 */
import { describe, expect, test, vi } from 'vitest';
import { findComponentWithSuggestions } from '../src/commands/add.js';
import type { Registry } from '../src/resolver.js';

function makeRegistry(): Registry {
  return {
    version: '2.0.0',
    name: 'buildpad',
    lib: {},
    components: [
      {
        name: 'select-icon',
        title: 'Select Icon',
        description: 'Icon picker input',
        category: 'input',
        files: [],
        dependencies: [],
        internalDependencies: [],
      },
      {
        name: 'rich-text-markdown',
        title: 'Rich Text Markdown',
        description: 'Markdown-backed rich text editor',
        category: 'input',
        files: [],
        dependencies: [],
        internalDependencies: [],
      },
    ],
    categories: [
      { name: 'input', title: 'Input', description: 'Input components' },
    ],
  };
}

describe('findComponentWithSuggestions', () => {
  test('matches by exact name', () => {
    const registry = makeRegistry();
    const result = findComponentWithSuggestions('select-icon', registry);
    expect(result?.name).toBe('select-icon');
  });

  test('matches by title, case-insensitively', () => {
    const registry = makeRegistry();
    const result = findComponentWithSuggestions('Rich Text Markdown', registry);
    expect(result?.name).toBe('rich-text-markdown');
  });

  test('fuzzy-matches ignoring dashes', () => {
    const registry = makeRegistry();
    const result = findComponentWithSuggestions('selecticon', registry);
    expect(result?.name).toBe('select-icon');
  });

  test('resolves a known alias to its real component name', () => {
    const registry = makeRegistry();
    // 'icon' has no matching component/title/fuzzy-match, but is aliased to 'select-icon'.
    const result = findComponentWithSuggestions('icon', registry);
    expect(result?.name).toBe('select-icon');
  });

  test('returns null and prints suggestions for an unknown, similar name', () => {
    const registry = makeRegistry();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = findComponentWithSuggestions('select-icn', registry);

    expect(result).toBeNull();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Component not found'));
    logSpy.mockRestore();
  });

  test('returns null with no suggestions for a completely unrelated name', () => {
    const registry = makeRegistry();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = findComponentWithSuggestions('zzz-totally-unrelated-xyz', registry);

    expect(result).toBeNull();
    logSpy.mockRestore();
  });
});

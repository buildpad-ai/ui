/**
 * Interface manifest unit tests
 *
 * The manifest's own invariants (unique ids, aliases that cannot collide,
 * rendered entries with a loading class, …), its lookups and predicates, and
 * the derived tables. The cross-package parity checks (FormFieldInterface,
 * registry blocks, consumer barrel) and the pre-manifest snapshot live in
 * packages/cli/tests/interface-tables.test.ts.
 */

import { describe, it, expect } from 'vitest';
import type { Field } from '@buildpad/types';
import {
  DEFAULT_INTERFACE_FALLBACK_HEIGHT,
  INTERFACE_MANIFEST,
  PRESENTATION_INTERFACE_PREFIX,
  getInterfaceManifestEntry,
  interfaceAliasMap,
  interfaceHasFlag,
  interfaceIdsWithFlag,
  isNonFlatRelationalInterface,
  isPresentationInterface,
  isPresentationLikeInterface,
  isRelationListInterface,
  isRenderedPresentationInterface,
  isSelfPersistingInterface,
  normalizeInterfaceId,
  type InterfaceFlags,
  type InterfaceManifestEntry,
} from '../src/interface-manifest';
import { REGISTRY_INTERFACE_ALIASES, getFieldInterface, isPresentationField } from '../src/field-interface-mapper';
import { concealingInterface } from '../src/conceal';
import { CHOICE_INTERFACES, PROVISIONABLE_INTERFACES } from '../src/interface-catalog';

const manifest: readonly InterfaceManifestEntry[] = INTERFACE_MANIFEST;
const ids = manifest.map((e) => e.id);
const aliasesOf = (e: InterfaceManifestEntry) => [...(e.aliases?.registry ?? []), ...(e.aliases?.legacy ?? [])];
const allAliases = manifest.flatMap(aliasesOf);
const hookAliases = manifest.flatMap((e) => e.relation?.hookAliases ?? []);
const sorted = (xs: Iterable<string>) => [...xs].sort((a, b) => a.localeCompare(b));

/** Every id the tests probe: manifest ids, all aliases, and ids nothing knows. */
const PROBES = [...ids, ...allAliases, ...hookAliases, 'presentation-custom', 'not-an-interface', 'INPUT', ' tags', ''];

describe('INTERFACE_MANIFEST invariants', () => {
  it('has one entry per id', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('aliases are unique and never an entry id, so normalisation is unambiguous', () => {
    expect(new Set(allAliases).size).toBe(allAliases.length);
    expect(allAliases.filter((a) => ids.includes(a))).toEqual([]);
  });

  it('relation-hook aliases are neither ids nor aliases (the renderer does not resolve them)', () => {
    expect(hookAliases.filter((a) => ids.includes(a) || allAliases.includes(a))).toEqual([]);
  });

  it('every rendered entry has an export name and a loading class; unrendered ones have neither', () => {
    for (const e of manifest) {
      if (e.renders) {
        expect([e.id, typeof e.exportName, ['eager', 'lazy', 'client-only'].includes(e.loading)]).toEqual([e.id, 'string', true]);
      } else {
        expect([e.id, e.loading, e.fallbackHeight, e.provision]).toEqual([e.id, undefined, undefined, undefined]);
      }
    }
  });

  it('records the lazy-loading classes and skeleton heights', () => {
    const byLoading = (loading: string) =>
      sorted(manifest.filter((e) => e.renders && e.loading === loading).map((e) => e.id));
    expect(byLoading('client-only')).toEqual(['input-block-editor']);
    expect(byLoading('lazy')).toEqual([
      'collection-item-dropdown',
      'file',
      'file-image',
      'files',
      'input-autocomplete-api',
      'input-rich-text-html',
      'input-rich-text-md',
      'list-m2a',
      'list-m2m',
      'list-o2m',
      'map',
      'select-icon',
      'system-permissions',
    ]);
    // Eager is everything else that renders.
    expect(byLoading('eager')).toHaveLength(manifest.filter((e) => e.renders).length - 14);
    const heights = Object.fromEntries(
      manifest.flatMap((e) => (e.renders && e.fallbackHeight !== undefined ? [[e.id, e.fallbackHeight]] : [])),
    );
    expect(heights).toEqual({
      'input-rich-text-html': 240,
      'input-rich-text-md': 240,
      'input-block-editor': 200,
      map: 500,
      'file-image': 220,
    });
    // An eager component renders at once: a skeleton height would never show.
    expect(manifest.filter((e) => e.renders && e.loading === 'eager' && e.fallbackHeight !== undefined)).toEqual([]);
    expect(DEFAULT_INTERFACE_FALLBACK_HEIGHT).toBe(36);
  });

  it('only rendered interfaces are provisionable, and every choice interface is provisionable', () => {
    for (const e of manifest) {
      if (e.provision) expect([e.id, e.renders]).toEqual([e.id, true]);
      if (e.flags?.choices) expect([e.id, !!e.provision]).toEqual([e.id, true]);
    }
  });

  it('every presentation id follows the presentation-* convention, and vice versa', () => {
    for (const e of manifest) {
      expect([e.id, !!e.flags?.presentation]).toEqual([e.id, e.id.startsWith(PRESENTATION_INTERFACE_PREFIX)]);
    }
  });

  it('no flagged interface has an alias, so flag checks match the same ids with or without normalisation', () => {
    const flaggedWithAliases = manifest.filter((e) => e.flags && aliasesOf(e).length > 0).map((e) => e.id);
    expect(flaggedWithAliases).toEqual([]);
  });

  it('exactly the entries with a relation are non-flat relational', () => {
    // Kept as two fields on purpose (see InterfaceFlags.nonFlatRelational);
    // a new relation-list entry must still get both, or CollectionForm and
    // CollectionList would request it as a bare column.
    for (const e of manifest) {
      expect([e.id, !!e.flags?.nonFlatRelational]).toEqual([e.id, !!e.relation]);
    }
    expect(manifest.filter((e) => e.relation).map((e) => e.id)).toEqual(['list-o2m', 'list-m2m', 'list-m2a']);
  });

  it('declares only registry field types', () => {
    const valid = new Set([
      'string', 'text', 'boolean', 'integer', 'bigInteger', 'float', 'decimal', 'timestamp', 'dateTime', 'date',
      'time', 'json', 'csv', 'uuid', 'hash', 'binary', 'alias', 'geometry', 'unknown',
    ]);
    expect(manifest.flatMap((e) => e.types).filter((t) => !valid.has(t))).toEqual([]);
  });
});

describe('normalizeInterfaceId / getInterfaceManifestEntry', () => {
  it('resolves registry and legacy aliases to the renderer id', () => {
    expect(normalizeInterfaceId('input-tags')).toBe('tags');
    expect(normalizeInterfaceId('input-map-gl')).toBe('map');
    expect(normalizeInterfaceId('textarea')).toBe('input-multiline');
    expect(normalizeInterfaceId('xtremax-workflow-button-v2')).toBe('workflow-button');
  });

  it('leaves renderer ids, hook aliases and unknown ids alone, matching exactly', () => {
    for (const id of [...ids, 'one-to-many', 'not-an-interface', 'INPUT-TAGS', ' textarea', '']) {
      expect(normalizeInterfaceId(id)).toBe(id);
    }
  });

  it('finds an entry by id or alias, and nothing for unknown ids or non-strings', () => {
    expect(getInterfaceManifestEntry('wysiwyg')?.id).toBe('input-rich-text-html');
    expect(getInterfaceManifestEntry('tags')?.exportName).toBe('Tags');
    expect(getInterfaceManifestEntry('one-to-many')).toBeUndefined();
    for (const value of ['nope', '', null, undefined, 42, {}]) expect(getInterfaceManifestEntry(value)).toBeUndefined();
  });

  it('interfaceAliasMap lists each kind in manifest order', () => {
    expect(Object.entries(interfaceAliasMap('registry'))).toEqual([
      ['input-tags', 'tags'],
      ['input-map', 'map'],
      ['input-map-gl', 'map'],
    ]);
    expect(Object.keys(interfaceAliasMap('legacy'))).toEqual([
      'textarea',
      'wysiwyg',
      'markdown',
      'list-m2o',
      'xtr-interface-workflow',
      'xtr-interface-workflow-old',
      'xtremax-workflow-button',
      'xtremax-workflow-button-v2',
      'xtremax-workflow-button-scheduled',
    ]);
  });
});

describe('predicates', () => {
  const accepting = (pred: (id: unknown) => boolean) => sorted(PROBES.filter((id) => pred(id)));

  it('interfaceIdsWithFlag / interfaceHasFlag agree for every flag', () => {
    const flags: (keyof InterfaceFlags)[] = [
      'concealing', 'choices', 'presentation', 'csvMultiValue', 'nonFlatRelational', 'selfPersisting',
    ];
    for (const flag of flags) {
      expect([flag, accepting((id) => interfaceHasFlag(id, flag))]).toEqual([flag, sorted(interfaceIdsWithFlag(flag))]);
    }
  });

  it('isPresentationInterface: divider, notice and the unrendered presentation-links', () => {
    expect(accepting(isPresentationInterface)).toEqual(['presentation-divider', 'presentation-links', 'presentation-notice']);
  });

  it('isRenderedPresentationInterface: only the presentation interfaces VForm renders', () => {
    expect(accepting(isRenderedPresentationInterface)).toEqual(['presentation-divider', 'presentation-notice']);
  });

  it('isPresentationLikeInterface: any presentation-* id, known or not', () => {
    expect(accepting(isPresentationLikeInterface)).toEqual([
      'presentation-custom',
      'presentation-divider',
      'presentation-links',
      'presentation-notice',
    ]);
    expect(isPresentationLikeInterface(undefined)).toBe(false);
  });

  it('isNonFlatRelationalInterface / isSelfPersistingInterface', () => {
    expect(accepting(isNonFlatRelationalInterface)).toEqual(['list-m2a', 'list-m2m', 'list-o2m']);
    expect(accepting(isSelfPersistingInterface)).toEqual(['files']);
  });

  it('isRelationListInterface accepts what each relation hook accepted', () => {
    expect(accepting((id) => isRelationListInterface(id, 'o2m'))).toEqual(['list-o2m', 'one-to-many']);
    expect(accepting((id) => isRelationListInterface(id, 'm2m'))).toEqual(['list-m2m']);
    expect(accepting((id) => isRelationListInterface(id, 'm2a'))).toEqual(['list-m2a']);
    for (const value of [null, undefined, 1, ['list-m2m']]) expect(isRelationListInterface(value, 'm2m')).toBe(false);
  });
});

describe('derived tables', () => {
  it('REGISTRY_INTERFACE_ALIASES is the registry alias map', () => {
    expect(REGISTRY_INTERFACE_ALIASES).toEqual(interfaceAliasMap('registry'));
  });

  it('getFieldInterface resolves every alias like its renderer id', () => {
    const options = { __probe: true };
    const config = (id: string) =>
      getFieldInterface({ field: 'f', type: 'string', meta: { interface: id, options } } as unknown as Field);
    for (const e of manifest) {
      for (const alias of aliasesOf(e)) expect([alias, config(alias)]).toEqual([alias, config(e.id)]);
    }
  });

  it('getFieldInterface does not resolve unrendered ids or hook aliases (they use the type default)', () => {
    const typeDefault = getFieldInterface({ field: 'f', type: 'uuid', meta: null } as unknown as Field);
    for (const id of [...manifest.filter((e) => !e.renders).map((e) => e.id), ...hookAliases]) {
      const field = { field: 'f', type: 'uuid', meta: { interface: id, options: { __probe: true } } } as unknown as Field;
      expect([id, getFieldInterface(field)]).toEqual([id, typeDefault]);
    }
  });

  it('concealingInterface, CHOICE_INTERFACES and isPresentationField follow the flags', () => {
    expect(accepting(concealingInterface)).toEqual(['input-hash', 'system-token']);
    expect([...CHOICE_INTERFACES]).toEqual(interfaceIdsWithFlag('choices'));
    expect(accepting((id) => isPresentationField({ field: 'f', meta: { interface: id } } as unknown as Field))).toEqual(
      sorted(interfaceIdsWithFlag('presentation')),
    );
  });

  it('PROVISIONABLE_INTERFACES lists the provision descriptors in manifest order, with fresh type arrays', () => {
    const provisionable = manifest.filter((e) => e.renders && e.provision);
    expect(PROVISIONABLE_INTERFACES.map((p) => p.value)).toEqual(provisionable.map((e) => e.id));
    PROVISIONABLE_INTERFACES.forEach((p, i) => {
      const e = provisionable[i];
      expect(p).toEqual({ value: e.id, label: e.provision?.label, group: e.provision?.group, types: [...e.types] });
      expect(p.types).not.toBe(e.types);
    });
  });

  function accepting(pred: (id: string) => boolean): string[] {
    return sorted(PROBES.filter((id) => pred(id)));
  }
});

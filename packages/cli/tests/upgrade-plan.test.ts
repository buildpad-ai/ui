/**
 * utils/upgrade-plan.ts — which dependencies an upgrade brings along.
 */

import { describe, expect, test } from 'vitest';
import { directDependencies, isEmptyPlan, planDependencies, type EntryRef } from '../src/utils/upgrade-plan.js';

type Deps = { internalDependencies?: string[]; registryDependencies?: string[] };

/** A registry of nothing but dependency edges. */
function registryOf(components: Record<string, Deps>, lib: Record<string, Deps>) {
  return {
    components: Object.entries(components).map(([name, deps]) => ({ name, ...deps })),
    lib: Object.fromEntries(Object.entries(lib).map(([name, deps]) => [name, { name, ...deps }])),
  } as unknown as Parameters<typeof planDependencies>[0]['registry'];
}

const component = (name: string): EntryRef => ({ kind: 'component', name });
const lib = (name: string): EntryRef => ({ kind: 'lib', name });

/**
 * form → field, picker (components) and helpers (lib); field → form (a cycle);
 * picker → icons (lib); helpers → core (lib); routes (lib) → form.
 */
const registry = registryOf(
  {
    form: { internalDependencies: ['helpers'], registryDependencies: ['field', 'picker'] },
    field: { internalDependencies: ['helpers'], registryDependencies: ['form'] },
    picker: { internalDependencies: ['icons'] },
    standalone: {},
  },
  {
    helpers: { internalDependencies: ['core'] },
    core: {},
    icons: {},
    routes: { registryDependencies: ['form'] },
  },
);

const plan = (
  targets: EntryRef[],
  installed: { components: string[]; lib: string[] },
  stale: string[],
) =>
  planDependencies({
    targets,
    registry,
    installedComponents: installed.components,
    installedLib: installed.lib,
    needsUpgrade: (e) => stale.includes(e.name),
  });

const everything = { components: ['form', 'field', 'picker', 'standalone'], lib: ['helpers', 'core', 'icons', 'routes'] };

describe('directDependencies', () => {
  test('lib modules first, then components, dropping names the registry does not have', () => {
    const r = registryOf({ a: { internalDependencies: ['x', 'ghost'], registryDependencies: ['b', 'phantom'] }, b: {} }, { x: {} });
    expect(directDependencies(component('a'), r)).toEqual([lib('x'), component('b')]);
    expect(directDependencies(component('nope'), r)).toEqual([]);
    expect(directDependencies(lib('nope'), r)).toEqual([]);
  });
});

describe('planDependencies', () => {
  test('brings the out-of-date dependencies of a target, of both kinds', () => {
    const p = plan([component('form')], everything, ['field', 'helpers', 'standalone']);
    expect(p.upgradeComponents).toEqual(['field']);
    expect(p.upgradeLibModules).toEqual(['helpers']);
    expect(p.installComponents).toEqual([]);
    expect(p.installLibModules).toEqual([]);
    // `standalone` is out of date too, but nothing selected depends on it.
    expect(p.neededBy.get('component:field')).toEqual(component('form'));
    expect(p.neededBy.get('lib:helpers')).toEqual(component('form'));
  });

  test('installs what the project lacks, and what that in turn needs', () => {
    const p = plan([component('form')], { components: ['form', 'field'], lib: ['helpers', 'core'] }, []);
    expect(p.installComponents).toEqual(['picker']);
    expect(p.installLibModules).toEqual(['icons']);
    expect(p.neededBy.get('component:picker')).toEqual(component('form'));
    expect(p.neededBy.get('lib:icons')).toEqual(component('picker'));
  });

  test('walks through an up-to-date dependency to an out-of-date one behind it', () => {
    // form → helpers (current) → core (stale)
    const p = plan([component('form')], everything, ['core']);
    expect(p.upgradeLibModules).toEqual(['core']);
    expect(p.neededBy.get('lib:core')).toEqual(lib('helpers'));
  });

  test('never lists a target, and ends on a dependency cycle', () => {
    // form ↔ field; both selected and both stale.
    const p = plan([component('form'), component('field')], everything, ['form', 'field']);
    expect(isEmptyPlan(p)).toBe(true);
    // Selecting one end of the cycle lists the other once.
    expect(plan([component('field')], everything, ['form', 'field']).upgradeComponents).toEqual(['form']);
  });

  test('follows a lib module to the components it needs', () => {
    const p = plan([lib('routes')], everything, ['form', 'field']);
    expect(p.upgradeComponents).toEqual(['form', 'field']);
    expect(p.neededBy.get('component:form')).toEqual(lib('routes'));
    expect(p.neededBy.get('component:field')).toEqual(component('form'));
  });

  test('a target with no dependencies, or an unknown one, asks for nothing', () => {
    expect(isEmptyPlan(plan([component('standalone')], everything, ['form']))).toBe(true);
    expect(isEmptyPlan(plan([component('not-in-registry')], everything, ['form']))).toBe(true);
    expect(isEmptyPlan(plan([], everything, ['form']))).toBe(true);
  });

  test('a component and a lib module with the same name are different entries', () => {
    const r = registryOf({ a: { internalDependencies: ['shared'], registryDependencies: ['shared'] }, shared: {} }, { shared: {} });
    const p = planDependencies({
      targets: [component('a')],
      registry: r,
      installedComponents: ['a', 'shared'],
      installedLib: [],
      needsUpgrade: () => true,
    });
    expect(p.upgradeComponents).toEqual(['shared']);
    expect(p.installLibModules).toEqual(['shared']);
  });
});

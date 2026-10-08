/**
 * What an upgrade has to bring along.
 *
 * An entry's new source imports its dependencies' new source: 3.0's
 * `list-o2m` imports a services file and a `list-m2a` file that 2.6 does not
 * have. Upgrading only the entry leaves a project that does not compile, so
 * `upgrade` also upgrades every out-of-date entry its targets depend on, and
 * installs the ones the project lacks.
 *
 * The walk follows both kinds of dependency edge, through components and lib
 * modules alike, and through entries that are themselves up to date (their
 * dependencies can still be behind, or missing):
 *   - `internalDependencies` — lib modules;
 *   - `registryDependencies` — components.
 *
 * Pure: it decides, the command acts.
 */

import type { Registry } from '../resolver.js';

export type EntryKind = 'component' | 'lib';

export interface EntryRef {
  kind: EntryKind;
  name: string;
}

export interface DependencyPlan {
  /** Installed, out-of-date components a target depends on. */
  upgradeComponents: string[];
  /** Installed, out-of-date lib modules a target depends on. */
  upgradeLibModules: string[];
  /** Components a target depends on that the project does not have. */
  installComponents: string[];
  /** Lib modules a target depends on that the project does not have. */
  installLibModules: string[];
  /** For each name above, the entry whose dependency list led to it. */
  neededBy: Map<string, EntryRef>;
}

export interface PlanInput {
  /** The entries the user selected (already resolved to kind). */
  targets: EntryRef[];
  registry: Pick<Registry, 'components' | 'lib'>;
  installedComponents: readonly string[];
  installedLib: readonly string[];
  /** Whether an installed entry is behind the registry (stale, pending, pre-v3 or untracked). */
  needsUpgrade: (entry: EntryRef) => boolean;
}

/** Map key for an entry: a component and a lib module may share a name. */
export const entryKey = (entry: EntryRef): string => `${entry.kind}:${entry.name}`;

/** The entries `entry` depends on directly, as the registry declares them. Unknown names are dropped. */
export function directDependencies(entry: EntryRef, registry: Pick<Registry, 'components' | 'lib'>): EntryRef[] {
  const source =
    entry.kind === 'component' ? registry.components.find(c => c.name === entry.name) : registry.lib?.[entry.name];
  if (!source) return [];
  const libs = (source.internalDependencies ?? [])
    .filter(name => !!registry.lib?.[name])
    .map((name): EntryRef => ({ kind: 'lib', name }));
  const components = (source.registryDependencies ?? [])
    .filter(name => registry.components.some(c => c.name === name))
    .map((name): EntryRef => ({ kind: 'component', name }));
  return [...libs, ...components];
}

/**
 * Everything the targets depend on that an upgrade must touch, in the order
 * the walk finds it (breadth-first from the targets, so a target's own
 * dependencies come before theirs). The targets themselves are never listed.
 */
export function planDependencies(input: PlanInput): DependencyPlan {
  const { targets, registry, installedComponents, installedLib, needsUpgrade } = input;
  const plan: DependencyPlan = {
    upgradeComponents: [],
    upgradeLibModules: [],
    installComponents: [],
    installLibModules: [],
    neededBy: new Map(),
  };

  const seen = new Set(targets.map(entryKey));
  const queue = [...targets];
  for (let i = 0; i < queue.length; i++) {
    const parent = queue[i];
    for (const dep of directDependencies(parent, registry)) {
      const key = entryKey(dep);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(dep);

      const isComponent = dep.kind === 'component';
      const installed = (isComponent ? installedComponents : installedLib).includes(dep.name);
      if (!installed) {
        (isComponent ? plan.installComponents : plan.installLibModules).push(dep.name);
      } else if (needsUpgrade(dep)) {
        (isComponent ? plan.upgradeComponents : plan.upgradeLibModules).push(dep.name);
      } else {
        continue; // up to date: nothing to do, but its dependencies are still walked
      }
      plan.neededBy.set(key, parent);
    }
  }
  return plan;
}

/** True when the plan asks for nothing. */
export function isEmptyPlan(plan: DependencyPlan): boolean {
  return (
    plan.upgradeComponents.length === 0 &&
    plan.upgradeLibModules.length === 0 &&
    plan.installComponents.length === 0 &&
    plan.installLibModules.length === 0
  );
}

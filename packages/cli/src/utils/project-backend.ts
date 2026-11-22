/**
 * The project's backend and tenancy mode, as a Buildpad starter records them.
 *
 * The Platform writes `.buildpad/project.json` (`{"buildpadProject":1,
 * "backend":"engine"|"supabase"}`) into every starter it assembles; a project
 * without it may carry the developer's answer in `.buildpad/backend-answer.json`
 * (`{"buildpadBackendAnswer":1,"backend":...}`). These are the first two steps
 * of the skills' "Establish the backend first" procedure; the CLI never asks
 * and never writes either file.
 *
 * An Engine kit's `.buildpad/project.json` also carries `"tenancy"`:
 * `"scope"` or `"customer-tenants"` (the Platform's Tenancy_Signal). Only
 * `customer-tenants` changes what the CLI installs.
 */

import fs from 'fs-extra';
import path from 'node:path';
import type { Registry } from '../resolver.js';

export type ProjectBackend = 'engine' | 'supabase';
export type ProjectTenancy = 'scope' | 'customer-tenants';

export const BACKEND_SIGNAL_PATH = '.buildpad/project.json';
export const BACKEND_ANSWER_PATH = '.buildpad/backend-answer.json';

function backendIn(file: string): ProjectBackend | null {
  try {
    const json: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const backend = (json as { backend?: unknown } | null)?.backend;
    return backend === 'engine' || backend === 'supabase' ? backend : null;
  } catch {
    return null;
  }
}

/**
 * `.buildpad/project.json` first, then `.buildpad/backend-answer.json`; null
 * when neither names a backend (an older starter, or not a starter at all),
 * which every caller treats as the Supabase behaviour the CLI always had.
 */
export function readProjectBackend(cwd: string): ProjectBackend | null {
  return (
    backendIn(path.join(cwd, BACKEND_SIGNAL_PATH)) ??
    backendIn(path.join(cwd, BACKEND_ANSWER_PATH))
  );
}

/**
 * The `tenancy` member of `.buildpad/project.json`; null when the file or the
 * member is missing or names another value. The answer file never carries it.
 */
export function readProjectTenancy(cwd: string): ProjectTenancy | null {
  try {
    const json: unknown = JSON.parse(fs.readFileSync(path.join(cwd, BACKEND_SIGNAL_PATH), 'utf-8'));
    const tenancy = (json as { tenancy?: unknown } | null)?.tenancy;
    return tenancy === 'scope' || tenancy === 'customer-tenants' ? tenancy : null;
  } catch {
    return null;
  }
}

/**
 * The lib module to install for `name` on this backend: a module that names an
 * `engineVariant` is swapped for it on an Engine project
 * (external-oauth → external-oauth-engine), and an Engine module that names a
 * `customerTenantsVariant` is swapped again when the project's tenancy is
 * `customer-tenants` (external-oauth-engine → external-oauth-engine-customers).
 * Every other name is returned as is; `scope` and a missing tenancy change
 * nothing.
 */
export function libForBackend(
  name: string,
  registry: Pick<Registry, 'lib'>,
  backend: ProjectBackend | null,
  tenancy: ProjectTenancy | null = null
): string {
  const variant = registry.lib[name]?.engineVariant;
  const forBackend = backend === 'engine' && variant && registry.lib[variant] ? variant : name;
  if (backend !== 'engine' || tenancy !== 'customer-tenants') return forBackend;
  const customers = registry.lib[forBackend]?.customerTenantsVariant;
  return customers && registry.lib[customers] ? customers : forBackend;
}

/**
 * Why `name` must not be installed on this project, or null. A module marked
 * for one backend (or one tenancy mode) is refused only when the project
 * records another one; a project that records nothing gets what it asked for
 * by name.
 */
export function libBackendMismatch(
  name: string,
  registry: Pick<Registry, 'lib'>,
  backend: ProjectBackend | null,
  tenancy: ProjectTenancy | null = null
): string | null {
  const wantedTenancy = registry.lib[name]?.tenancy;
  if (wantedTenancy && tenancy && wantedTenancy !== tenancy) {
    const base = Object.values(registry.lib).find(m => m.customerTenantsVariant === name)?.name;
    return (
      `${name} is for a project whose ${BACKEND_SIGNAL_PATH} says "tenancy": "${wantedTenancy}", ` +
      `but this project's says "${tenancy}".` +
      (base ? ` Install ${base} instead.` : '')
    );
  }
  const wanted = registry.lib[name]?.backend;
  if (!wanted || !backend || wanted === backend) return null;
  const supabaseName = Object.values(registry.lib).find(m => m.engineVariant === name)?.name;
  return (
    `${name} is for ${wanted === 'engine' ? 'an Engine' : 'a Supabase'} project, but ${BACKEND_SIGNAL_PATH} ` +
    `says this project's backend is ${backend}.` +
    (supabaseName ? ` Install ${supabaseName} instead.` : '')
  );
}

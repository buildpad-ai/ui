/**
 * The project's backend, as a Buildpad starter records it.
 *
 * The Platform writes `.buildpad/project.json` (`{"buildpadProject":1,
 * "backend":"engine"|"supabase"}`) into every starter it assembles; a project
 * without it may carry the developer's answer in `.buildpad/backend-answer.json`
 * (`{"buildpadBackendAnswer":1,"backend":...}`). These are the first two steps
 * of the skills' "Establish the backend first" procedure; the CLI never asks
 * and never writes either file.
 */

import fs from 'fs-extra';
import path from 'node:path';
import type { Registry } from '../resolver.js';

export type ProjectBackend = 'engine' | 'supabase';

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
 * The lib module to install for `name` on this backend: a module that names an
 * `engineVariant` is swapped for it on an Engine project
 * (external-oauth → external-oauth-engine). Every other name is returned as is.
 */
export function libForBackend(
  name: string,
  registry: Pick<Registry, 'lib'>,
  backend: ProjectBackend | null
): string {
  const variant = registry.lib[name]?.engineVariant;
  return backend === 'engine' && variant && registry.lib[variant] ? variant : name;
}

/**
 * Why `name` must not be installed on this project, or null. A module marked
 * for one backend is refused only when the project records the other one; a
 * project that records nothing gets what it asked for by name.
 */
export function libBackendMismatch(
  name: string,
  registry: Pick<Registry, 'lib'>,
  backend: ProjectBackend | null
): string | null {
  const wanted = registry.lib[name]?.backend;
  if (!wanted || !backend || wanted === backend) return null;
  const supabaseName = Object.values(registry.lib).find(m => m.engineVariant === name)?.name;
  return (
    `${name} is for ${wanted === 'engine' ? 'an Engine' : 'a Supabase'} project, but ${BACKEND_SIGNAL_PATH} ` +
    `says this project's backend is ${backend}.` +
    (supabaseName ? ` Install ${supabaseName} instead.` : '')
  );
}

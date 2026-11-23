/**
 * Server variables a lib module needs at run time on Amplify Hosting.
 *
 * Amplify exposes a branch's variables to the build only. A Next.js server
 * reads a variable without `NEXT_PUBLIC_` at run time from `.env.production`,
 * so the app's `amplify.yml` writes each one there before `next build`. A lib
 * module lists its own in the registry (`serverEnv`); `add` puts one line per
 * variable into `amplify.yml`, in the form the Platform's docs give for
 * `BUILDPAD_ONBOARDING_KEY`, which writes nothing when the variable is unset.
 */
import fs from 'fs-extra';
import path from 'path';

/** The `amplify.yml` list item that writes `name` into `.env.production`. */
export function envProductionLine(name: string): string {
  return `- '[ -z "$${name}" ] || echo "${name}=$${name}" >> .env.production'`;
}

const WRITES_ENV_PRODUCTION = /^(\s*)- .*>>\s*\.env\.production\b/;

export interface AmplifyServerEnvResult {
  /** The file's new text (unchanged when nothing was added). */
  text: string;
  /** Variables whose line was added. */
  added: string[];
  /** Variables `amplify.yml` writes already. */
  present: string[];
  /** Variables with no place to go: no step writes `.env.production`. */
  unplaced: string[];
}

/**
 * Adds a `.env.production` line for each variable `amplify.yml` does not
 * write yet. The line goes right after the one that writes
 * `BUILDPAD_ONBOARDING_KEY`, else after the last step that writes
 * `.env.production`, at its indentation. A file with no such step is left as
 * it is: where the build commands live is the app's choice.
 */
export function addServerEnvToAmplify(text: string, names: string[]): AmplifyServerEnvResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const result: AmplifyServerEnvResult = { text, added: [], present: [], unplaced: [] };

  for (const name of names) {
    const mentions = new RegExp(`\\b${name}\\b`);
    if (lines.some(line => mentions.test(line) && line.includes('.env.production'))) {
      result.present.push(name);
      continue;
    }
    let anchor = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!WRITES_ENV_PRODUCTION.test(lines[i])) continue;
      if (lines[i].includes('BUILDPAD_ONBOARDING_KEY')) {
        anchor = i;
        break;
      }
      anchor = i;
    }
    if (anchor < 0) {
      result.unplaced.push(name);
      continue;
    }
    // After the anchor and any lines a previous variable added beside it.
    let at = anchor + 1;
    while (at < lines.length && result.added.some(added => lines[at].includes(`"${added}=$${added}"`))) at++;
    const indent = WRITES_ENV_PRODUCTION.exec(lines[anchor])![1];
    lines.splice(at, 0, `${indent}${envProductionLine(name)}`);
    result.added.push(name);
  }

  if (result.added.length > 0) result.text = lines.join(eol);
  return result;
}

export interface EnsureAmplifyServerEnvReport {
  file: string | null;
  added: string[];
  /** Variables the developer adds by hand (no `amplify.yml`, or no step that writes `.env.production`). */
  manual: string[];
}

/** Applies {@link addServerEnvToAmplify} to `<cwd>/amplify.yml`, when there is one. */
export async function ensureAmplifyServerEnv(cwd: string, names: string[]): Promise<EnsureAmplifyServerEnvReport> {
  const file = path.join(cwd, 'amplify.yml');
  if (names.length === 0) return { file: null, added: [], manual: [] };
  if (!(await fs.pathExists(file))) return { file: null, added: [], manual: [...names] };
  const before = await fs.readFile(file, 'utf-8');
  const result = addServerEnvToAmplify(before, names);
  if (result.text !== before) await fs.writeFile(file, result.text);
  return { file, added: result.added, manual: result.unplaced };
}

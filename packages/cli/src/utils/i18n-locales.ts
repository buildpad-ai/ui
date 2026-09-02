/**
 * `--locales` support: rewrite the marker-delimited blocks in the scaffolded
 * lib/i18n/config.ts and lib/i18n/dictionaries.ts, and seed a dictionary file
 * per locale from en.json.
 *
 * The templates carry `// buildpad:…` marker comments around every block this
 * touches, so the rewrite is line-based and survives user edits elsewhere in
 * the file. Names come from `Intl.DisplayNames` (Node ships full ICU), so the
 * switcher shows "Bahasa Indonesia", not "id".
 */

import fs from 'fs-extra';
import path from 'path';

/** BCP 47-ish: `en`, `id`, `pt-BR`, `zh-Hant`. */
export const LOCALE_CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ku', 'ckb']);

/** Parse `--locales en,id` (commas or spaces). Returns undefined when not given. */
export function parseLocalesOption(raw?: string): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  const codes = raw
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (codes.length === 0) {
    throw new Error('--locales needs at least one locale code, e.g. --locales en,id');
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    if (!LOCALE_CODE.test(code)) {
      throw new Error(`Invalid locale code '${code}' — expected a BCP 47 tag such as en, id or pt-BR`);
    }
    if (!seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

/**
 * CLDR autonyms that differ from the label people expect in a switcher
 * (ICU says "Indonesia" for `id`; every Indonesian site says "Bahasa Indonesia").
 */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
};

/** Native display name for a locale ("id" → "Bahasa Indonesia"), falling back to the code. */
export function localeDisplayName(code: string): string {
  const override = DISPLAY_NAME_OVERRIDES[code.toLowerCase()];
  if (override) return override;
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    if (!name || name.toLowerCase() === code.toLowerCase()) return code;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}

export function localeDirection(code: string): 'ltr' | 'rtl' {
  const primary = code.split('-')[0].toLowerCase();
  return RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr';
}

/** Object key for a locale — quoted when it is not a plain identifier (`"pt-BR"`). */
function keyFor(code: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(code) ? code : JSON.stringify(code);
}

/** Replace the line(s) between two marker comments (markers stay in place). */
function replaceBetween(content: string, start: string, end: string, body: string, file: string): string {
  const lines = content.split('\n');
  const from = lines.findIndex(l => l.includes(start));
  const to = lines.findIndex(l => l.includes(end));
  if (from === -1 || to === -1 || to <= from) {
    throw new Error(`Marker '${start}' … '${end}' not found in ${file} — edit the file by hand`);
  }
  return [...lines.slice(0, from + 1), ...body.split('\n'), ...lines.slice(to)].join('\n');
}

/** Replace the single line after a marker comment. */
function replaceLineAfter(content: string, marker: string, line: string, file: string): string {
  const lines = content.split('\n');
  const at = lines.findIndex(l => l.includes(marker));
  if (at === -1 || at + 1 >= lines.length) {
    throw new Error(`Marker '${marker}' not found in ${file} — edit the file by hand`);
  }
  lines[at + 1] = line;
  return lines.join('\n');
}

export interface ApplyLocalesOptions {
  cwd: string;
  srcDir: boolean;
  locales: string[];
  /** Defaults to the first locale. Must be in `locales`. */
  defaultLocale?: string;
  dryRun?: boolean;
}

export interface ApplyLocalesResult {
  locales: string[];
  defaultLocale: string;
  /** Files rewritten (project-relative). */
  changed: string[];
  /** Dictionary files seeded from en.json (project-relative). */
  created: string[];
}

/**
 * Write `locales` into lib/i18n and seed missing dictionaries.
 * Throws when lib/i18n is not installed or a marker is missing.
 */
export async function applyLocales(options: ApplyLocalesOptions): Promise<ApplyLocalesResult> {
  const { cwd, srcDir, locales, dryRun = false } = options;
  if (locales.length === 0) throw new Error('At least one locale is required');
  const defaultLocale = options.defaultLocale ?? locales[0];
  if (!locales.includes(defaultLocale)) {
    throw new Error(`Default locale '${defaultLocale}' is not in the locale list (${locales.join(', ')})`);
  }

  const srcRoot = srcDir ? path.join(cwd, 'src') : cwd;
  const i18nDir = path.join(srcRoot, 'lib', 'i18n');
  const configPath = path.join(i18nDir, 'config.ts');
  const dictionariesPath = path.join(i18nDir, 'dictionaries.ts');
  const dictionariesDir = path.join(i18nDir, 'dictionaries');
  const rel = (p: string) => path.relative(cwd, p);

  if (!fs.existsSync(configPath) || !fs.existsSync(dictionariesPath)) {
    throw new Error(`lib/i18n is not installed (expected ${rel(configPath)}). Run: npx buildpad add i18n`);
  }

  // ── config.ts ────────────────────────────────────────────────────
  let config = await fs.readFile(configPath, 'utf-8');
  config = replaceLineAfter(
    config,
    'buildpad:locales',
    `export const locales = [${locales.map(l => JSON.stringify(l)).join(', ')}] as const;`,
    rel(configPath)
  );
  config = replaceLineAfter(
    config,
    'buildpad:default-locale',
    `export const defaultLocale: Locale = ${JSON.stringify(defaultLocale)};`,
    rel(configPath)
  );
  const meta = [
    'export const localeMeta: Record<Locale, LocaleMeta> = {',
    ...locales.map(
      code =>
        `  ${keyFor(code)}: { name: ${JSON.stringify(localeDisplayName(code))}, direction: "${localeDirection(code)}" },`
    ),
    '};',
  ].join('\n');
  config = replaceBetween(config, 'buildpad:locale-meta-start', 'buildpad:locale-meta-end', meta, rel(configPath));

  // ── dictionaries.ts ──────────────────────────────────────────────
  let dictionaries = await fs.readFile(dictionariesPath, 'utf-8');
  const loaders = locales
    .map(code => `  ${keyFor(code)}: () => import("./dictionaries/${code}.json").then((m) => m.default),`)
    .join('\n');
  dictionaries = replaceBetween(
    dictionaries,
    'buildpad:dictionary-loaders-start',
    'buildpad:dictionary-loaders-end',
    loaders,
    rel(dictionariesPath)
  );

  // ── dictionaries/<code>.json ─────────────────────────────────────
  const enPath = path.join(dictionariesDir, 'en.json');
  const created: string[] = [];
  const seeds: Array<{ target: string; content: string }> = [];
  for (const code of locales) {
    const target = path.join(dictionariesDir, `${code}.json`);
    if (fs.existsSync(target)) continue;
    if (!fs.existsSync(enPath)) {
      throw new Error(`Cannot seed ${rel(target)}: ${rel(enPath)} is missing`);
    }
    seeds.push({ target, content: await fs.readFile(enPath, 'utf-8') });
    created.push(rel(target));
  }

  if (!dryRun) {
    await fs.writeFile(configPath, config);
    await fs.writeFile(dictionariesPath, dictionaries);
    for (const seed of seeds) {
      await fs.ensureDir(path.dirname(seed.target));
      await fs.writeFile(seed.target, seed.content);
    }
  }

  return {
    locales,
    defaultLocale,
    changed: [rel(configPath), rel(dictionariesPath)],
    created,
  };
}

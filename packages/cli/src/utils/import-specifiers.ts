/**
 * Module-specifier scanner.
 *
 * Finds the string literal of every module reference in a script, in each
 * form a shipped file can use:
 *
 *   from       import … from 'x' · import type … from 'x' · export … from 'x'
 *              (any whitespace before the quote, so multi-line and minified too)
 *   side-effect import 'x'
 *   dynamic    import('x')  — also `import('x').T` in type positions
 *   require    require('x') — also `import x = require('x')`
 *   ambient    declare module 'x'
 *
 * Lexical on purpose: the CLI ships without a parser, and the transformer's
 * output must stay byte-identical (it has always rewritten comment lines too).
 * Callers that must ignore comments filter by line (see isCommentLine).
 */

import { isNonInstallableSpecifier } from '../commands/import-map.js';

export type SpecifierKind = 'from' | 'side-effect' | 'dynamic' | 'require' | 'ambient';

export interface SpecifierMatch {
  kind: SpecifierKind;
  /** The module name, without quotes. */
  specifier: string;
  /** The quote character used. */
  quote: '"' | "'";
  /** Offsets of the whole matched fragment (e.g. `from 'x'`, `import('x')`). */
  start: number;
  end: number;
  /** Offsets of the string literal, quotes included. */
  literalStart: number;
  literalEnd: number;
  /** 1-based line of the string literal. */
  line: number;
}

// Each pattern: group 1 = quote, group 2 = specifier. A keyword must not be
// part of a longer identifier or a property access (`x.from`, `fromX`).
const PATTERNS: Array<{ kind: SpecifierKind; re: RegExp }> = [
  { kind: 'from', re: /(?<![\w$.])from\s*(['"])([^'"\n]+)\1/g },
  { kind: 'dynamic', re: /(?<![\w$.])import\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g },
  { kind: 'side-effect', re: /(?<![\w$.])import\s*(['"])([^'"\n]+)\1/g },
  { kind: 'require', re: /(?<![\w$.])require\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g },
  { kind: 'ambient', re: /(?<![\w$.])declare\s+module\s+(['"])([^'"\n]+)\1/g },
];

/** Every module specifier in `content`, in source order. */
export function scanSpecifiers(content: string): SpecifierMatch[] {
  const lineAt = lineLocator(content);
  const matches: SpecifierMatch[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of content.matchAll(re)) {
      const start = m.index!;
      const quote = m[1] as '"' | "'";
      const literalStart = start + m[0].indexOf(quote);
      const literalEnd = literalStart + m[2].length + 2;
      matches.push({
        kind,
        specifier: m[2],
        quote,
        start,
        end: start + m[0].length,
        literalStart,
        literalEnd,
        line: lineAt(literalStart),
      });
    }
  }
  return matches.sort((a, b) => a.literalStart - b.literalStart);
}

/** offset → 1-based line, by binary search over the line starts. */
function lineLocator(content: string): (offset: number) => number {
  const starts = [0];
  for (let i = content.indexOf('\n'); i !== -1; i = content.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** A line that is (part of) a comment: `// …`, `/* …`, or a JSDoc ` * …` continuation. */
export function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
}

export interface UntransformedImport {
  line: number;
  kind: SpecifierKind;
  specifier: string;
  /** The trimmed source line, for messages. */
  text: string;
}

/**
 * `@buildpad/*` module references left in a consumer file, in any import form,
 * ignoring comment lines (JSDoc usage examples) and the packages published to
 * npm (@buildpad/cli, @buildpad/mcp), which a consumer's own code may import.
 */
export function findUntransformedImports(content: string): UntransformedImport[] {
  const lines = content.split('\n');
  const found: UntransformedImport[] = [];
  for (const m of scanSpecifiers(content)) {
    if (!m.specifier.startsWith('@buildpad/') || isNonInstallableSpecifier(m.specifier)) continue;
    const text = lines[m.line - 1] ?? '';
    if (isCommentLine(text)) continue;
    found.push({ line: m.line, kind: m.kind, specifier: m.specifier, text: text.trim() });
  }
  return found;
}

/**
 * Module-specifier scanner.
 *
 * Finds the string literal of every module reference in a script, in each
 * form a shipped file can use:
 *
 *   from       import … from 'x' · import type … from 'x' · export … from 'x'
 *              (any whitespace before the quote, so multi-line and minified too)
 *   side-effect import 'x'
 *   dynamic    import('x')  — also `import('x').T` in type positions, comments
 *              before the specifier (`import(/* webpackChunkName: "c" *\/ 'x')`),
 *              import attributes and a trailing comma (`import('x', { with })`),
 *              and a template literal (`import(\`x\`)`)
 *   require    require('x') — also `import x = require('x')`
 *   ambient    declare module 'x'
 *
 * Lexical on purpose: the CLI ships without a parser, and the transformer's
 * output must stay byte-identical (it has always rewritten comment lines too).
 * Callers that must ignore comments ask per match (see isCommentedOut).
 * tests/untransformed-imports.test.ts cross-checks it against TypeScript's
 * pre-processor.
 */

import { isNonInstallableSpecifier } from '../commands/import-map.js';

export type SpecifierKind = 'from' | 'side-effect' | 'dynamic' | 'require' | 'ambient';

export interface SpecifierMatch {
  kind: SpecifierKind;
  /** The module name, without quotes. */
  specifier: string;
  /** The quote character used (a backtick only for `import()`). */
  quote: '"' | "'" | '`';
  /** Offsets of the whole matched fragment (e.g. `from 'x'`, `import('x')`). */
  start: number;
  end: number;
  /** Offsets of the string literal, quotes included. */
  literalStart: number;
  literalEnd: number;
  /** 1-based line of the string literal. */
  line: number;
  /** 0-based offset of the string literal within its line. */
  column: number;
}

// Comments allowed between `import(` and the specifier (webpack/Vite magic
// comments). Each alternative consumes a comment exactly once, so matching
// stays linear.
const DYNAMIC_COMMENTS = String.raw`(?:(?:/\*(?:[^*]|\*(?!/))*\*/|//[^\n]*\n)\s*)*`;

// Each pattern: group 1 = quote, group 2 = specifier. A keyword must not be
// part of a longer identifier or a property access (`x.from`, `fromX`).
const PATTERNS: Array<{ kind: SpecifierKind; re: RegExp }> = [
  { kind: 'from', re: /(?<![\w$.])from\s*(['"])([^'"\n]+)\1/dg },
  // Ends at the `)` or at the `,` before import attributes.
  {
    kind: 'dynamic',
    re: new RegExp(String.raw`(?<![\w$.])import\s*\(\s*${DYNAMIC_COMMENTS}(['"\`])([^'"\`\n]+)\1\s*[,)]`, 'dg'),
  },
  { kind: 'side-effect', re: /(?<![\w$.])import\s*(['"])([^'"\n]+)\1/dg },
  { kind: 'require', re: /(?<![\w$.])require\s*\(\s*(['"])([^'"\n]+)\1\s*\)/dg },
  { kind: 'ambient', re: /(?<![\w$.])declare\s+module\s+(['"])([^'"\n]+)\1/dg },
];

/** Every module specifier in `content`, in source order. */
export function scanSpecifiers(content: string): SpecifierMatch[] {
  const locate = lineLocator(content);
  const matches: SpecifierMatch[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of content.matchAll(re)) {
      const start = m.index!;
      // The specifier's own offsets: a comment before it may hold quotes too.
      const [specStart, specEnd] = m.indices![2];
      const literalStart = specStart - 1;
      const { line, column } = locate(literalStart);
      matches.push({
        kind,
        specifier: m[2],
        quote: m[1] as SpecifierMatch['quote'],
        start,
        end: start + m[0].length,
        literalStart,
        literalEnd: specEnd + 1,
        line,
        column,
      });
    }
  }
  return matches.sort((a, b) => a.literalStart - b.literalStart);
}

/** offset → 1-based line and 0-based column, by binary search over the line starts. */
function lineLocator(content: string): (offset: number) => { line: number; column: number } {
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
    return { line: lo + 1, column: offset - starts[lo] };
  };
}

/**
 * Whether the text at `column` of `line` is commented out: the line is a
 * comment line (`// …`, `/* …`, or a JSDoc ` * …` continuation) and no `*\/`
 * closes the comment before `column`. So `/* eslint-disable *\/ import … from
 * 'x'` and ` *\/ import … from 'x'` are code. Per line, like the transformer
 * has always been: a line inside a block comment that does not start with `*`
 * counts as code (reported, never skipped).
 */
export function isCommentedOut(line: string, column: number): boolean {
  const indent = line.length - line.trimStart().length;
  const rest = line.slice(indent);
  if (rest.startsWith('//')) return true;
  let from: number;
  if (rest.startsWith('/*')) from = indent + 2;
  else if (rest.startsWith('*')) from = indent;
  else return false;
  const close = line.indexOf('*/', from);
  return close === -1 || close + 2 > column;
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
 * ignoring commented-out ones (JSDoc usage examples) and the packages published to
 * npm (@buildpad/cli, @buildpad/mcp), which a consumer's own code may import.
 */
export function findUntransformedImports(content: string): UntransformedImport[] {
  const lines = content.split('\n');
  const found: UntransformedImport[] = [];
  for (const m of scanSpecifiers(content)) {
    if (!m.specifier.startsWith('@buildpad/') || isNonInstallableSpecifier(m.specifier)) continue;
    const text = lines[m.line - 1] ?? '';
    if (isCommentedOut(text, m.column)) continue;
    found.push({ line: m.line, kind: m.kind, specifier: m.specifier, text: text.trim() });
  }
  return found;
}

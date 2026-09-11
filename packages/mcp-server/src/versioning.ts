/**
 * Phase 5 helpers — versioning / upgrade support.
 *
 * Pulled out of index.ts (which unconditionally calls main() -> server.connect()
 * on import) so these pure functions can be unit tested without booting the
 * MCP stdio server.
 */
import { createHash } from 'node:crypto';

/**
 * Strip the `@buildpad-origin` JSDoc header from a transformed file so that
 * the remaining content can be hashed stably (the header contains the version
 * string which changes on every upgrade).
 */
export function stripOriginHeader(content: string): string {
  return content.replace(
    /^(["']use client["'];?\s*\n)?\/\*\*[\s\S]*?@buildpad-origin[\s\S]*?\*\/\s*\n?/,
    '$1'
  );
}

/**
 * Compute a stable SHA-256 hash of a transformed file — strips the origin
 * header, normalises line endings to LF, and ensures a trailing newline.
 */
export function hashTransformed(content: string): string {
  const stripped = stripOriginHeader(content);
  const normalised = stripped.replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n');
  const withNewline = normalised.trimEnd() + '\n';
  return createHash('sha256').update(withNewline, 'utf8').digest('hex');
}

/**
 * Compare two semver strings.  Returns -1, 0, or 1.
 * Strips leading non-numeric characters (e.g. "^", "~") before comparing.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^[^0-9]*/, '').split('.').map(n => Number.parseInt(n, 10) || 0);
  const [a0, a1, a2] = parse(a);
  const [b0, b1, b2] = parse(b);
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  return 0;
}

/**
 * Files of one installed component that are out of sync with the registry.
 *
 * Mirrors `computeEntryStaleness` in the CLI (packages/cli/src/utils/staleness.ts):
 * a file is stale when the registry's `sourceSha256` differs from the hash
 * recorded at install time, when the last upgrade left it `pending`, or when
 * the registry has added or removed it. Version numbers are not consulted.
 *
 * A manifest older than schema v3 has no per-file `sourceSha256`; those files
 * are reported as `needs-migrate` rather than guessed at.
 */
export function staleFilesOf(
  regComp: { files?: Array<{ target: string; sourceSha256?: string }> },
  installed: { files?: Array<{ target: string; sourceSha256?: string; state?: string }> }
): Array<{ target: string; reason: string }> {
  const stale: Array<{ target: string; reason: string }> = [];
  const recorded = new Map((installed.files ?? []).map(f => [f.target, f]));

  for (const rf of regComp.files ?? []) {
    const rec = recorded.get(rf.target);
    if (!rec) { stale.push({ target: rf.target, reason: 'added' }); continue; }
    if (rec.state === 'pending') { stale.push({ target: rf.target, reason: 'pending' }); continue; }
    if (!rec.sourceSha256) { stale.push({ target: rf.target, reason: 'needs-migrate' }); continue; }
    if (!rf.sourceSha256) continue;
    if (rec.sourceSha256 !== rf.sourceSha256) {
      stale.push({ target: rf.target, reason: 'upstream-changed' });
    }
  }

  const registryTargets = new Set((regComp.files ?? []).map(f => f.target));
  for (const target of recorded.keys()) {
    if (!registryTargets.has(target)) stale.push({ target, reason: 'removed' });
  }

  return stale;
}

const CHANGELOG_RAW_BASE =
  process.env.BUILDPAD_CHANGELOG_URL?.replace(/\/?$/, '/') ??
  'https://raw.githubusercontent.com/buildpad-ai/ui/main/packages/';

/** Fetch raw CHANGELOG.md content; returns null on network error. */
export async function fetchChangelogContent(changelogUrl: string): Promise<string | null> {
  const url = changelogUrl.startsWith('http')
    ? changelogUrl
    : `${CHANGELOG_RAW_BASE}${changelogUrl}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/**
 * Return only the changelog sections newer than `since`.
 * If `since` is omitted the full content is returned.
 */
export function changelogSince(content: string, since?: string): string {
  if (!since) return content.trim();
  const lines = content.split('\n');
  let inRange = false;
  const result: string[] = [];
  for (const line of lines) {
    const m = /^## (\d+\.\d+\.\d+)/.exec(line);
    if (m) {
      inRange = compareSemver(m[1], since) > 0;
    }
    if (inRange) result.push(line);
  }
  return result.join('\n').trim();
}

/**
 * changelog-parser.ts
 *
 * Extracts a slice of a Keep-a-Changelog / Changesets CHANGELOG.md,
 * returning only the entries from `sinceVersion` (exclusive) up to
 * `untilVersion` (inclusive, defaults to the latest).
 *
 * Supported heading formats:
 *   ## [1.2.3] - 2024-01-01
 *   ## 1.2.3
 *   ## v1.2.3
 */

const VERSION_HEADING = /^##\s+(?:\[?)v?([\d]+\.[\d]+\.[\d]+)/;

/**
 * Parse a CHANGELOG.md string into a map of version → section content.
 */
export function parseChangelog(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentVersion: string | null = null;
  const lines: string[] = [];

  for (const line of markdown.split('\n')) {
    const match = line.match(VERSION_HEADING);
    if (match) {
      if (currentVersion !== null) {
        sections.set(currentVersion, lines.join('\n').trim());
        lines.length = 0;
      }
      currentVersion = match[1];
      lines.push(line);
    } else if (currentVersion !== null) {
      lines.push(line);
    }
  }

  if (currentVersion !== null) {
    sections.set(currentVersion, lines.join('\n').trim());
  }

  return sections;
}

/**
 * Return the changelog sections for versions newer than `sinceVersion`.
 *
 * @param markdown     - Raw CHANGELOG.md content
 * @param sinceVersion - Semver string (e.g. "1.2.3"). Sections for this version and older are excluded.
 *                       Pass undefined / empty string to return all sections.
 * @returns            - Markdown string with only the relevant sections, or empty string if none.
 */
export function changelogSince(markdown: string, sinceVersion?: string): string {
  const sections = parseChangelog(markdown);
  if (sections.size === 0) return '';

  const versions = Array.from(sections.keys());

  if (!sinceVersion) {
    // Return all sections
    return versions.map(v => sections.get(v)!).join('\n\n');
  }

  const newer = versions.filter(v => semverGt(v, sinceVersion));
  if (newer.length === 0) return '';

  return newer.map(v => sections.get(v)!).join('\n\n');
}

/** Simple semver greater-than comparison (no pre-release support needed). */
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return false; // equal
}

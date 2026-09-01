/**
 * "Is this CLI behind?" check.
 *
 * Because every remote fetch is pinned to `v<cli version>` (see resolver.ts),
 * an old CLI reports an old registry and is honestly "up to date" against it.
 * That is correct but not useful on its own, so `outdated` also asks npm what
 * the `latest` dist-tag is and prints a hint when the two differ.
 *
 * Advisory only: a network failure, a proxy, or an offline machine must not
 * change the exit status or the component report.
 */

const DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/@buildpad%2fcli/dist-tags';

/** Compare bare semver strings — true when a >= b. */
function semverGte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return true;
}

/**
 * The `latest` version of @buildpad/cli on npm, or `null` when npm cannot be
 * reached within `timeoutMs`.
 */
export async function fetchLatestCliVersion(timeoutMs = 3000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(DIST_TAGS_URL, { signal: controller.signal });
      if (!res.ok) return null;
      const tags = (await res.json()) as Record<string, string>;
      return typeof tags?.latest === 'string' ? tags.latest : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * `latest` when the running CLI is behind it, otherwise null (including when
 * npm is unreachable, or when the CLI is running from a monorepo checkout and
 * has no meaningful version).
 */
export async function checkCliBehind(currentVersion: string): Promise<string | null> {
  if (!/^\d+\.\d+\.\d+/.test(currentVersion)) return null;
  const latest = await fetchLatestCliVersion();
  if (!latest || !/^\d+\.\d+\.\d+/.test(latest)) return null;
  return semverGte(currentVersion, latest) ? null : latest;
}

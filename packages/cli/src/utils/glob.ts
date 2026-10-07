import { glob } from 'tinyglobby';

/**
 * Absolute paths of the files under `dir` that match `pattern`, skipping
 * node_modules.
 *
 * `pattern` is relative to `dir` and always uses `/`: joining an absolute
 * directory into the pattern (as the call sites used to) puts backslashes into
 * it on Windows, which glob syntax reads as escapes.
 */
export function globFiles(dir: string, pattern: string): Promise<string[]> {
  return glob(pattern, {
    cwd: dir,
    absolute: true,
    ignore: ['**/node_modules/**'],
    // fast-glob semantics: a pattern naming a directory does not match its contents.
    expandDirectories: false,
  });
}

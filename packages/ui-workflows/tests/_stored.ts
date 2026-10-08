/**
 * Reorders object keys the way a jsonb column returns them (shorter keys
 * first, then by byte order), which is how a saved definition reaches the
 * editor. It is not the order the dialogs list their fields in, so a dialog
 * that rebuilds an object field by field changes its JSON without changing
 * its content — and an unsaved-changes check that compares JSON sees an edit.
 */
export function asStored<T>(value: T): T {
  if (Array.isArray(value)) return value.map(asStored) as T;
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value)
    .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1))
    .map(([key, child]) => [key, asStored(child)]);
  return Object.fromEntries(entries) as T;
}

/**
 * `{key}` placeholder interpolation — the convention introduced by the
 * `ListM2M` `translations` prop and shared by every Buildpad dictionary.
 *
 * - Unknown keys are left as-is (`{missing}`) so a typo is visible, not blank.
 * - `null`/`undefined` values render as an empty string.
 * - Numbers are rendered with `String()`; format them first with
 *   `Intl.NumberFormat` when the locale matters (`formatCount` does this).
 *
 * @example
 * interpolate('Showing {start} to {end} of {total}', { start: 1, end: 10, total: 42 })
 * // → 'Showing 1 to 10 of 42'
 */
import type { InterpolationValues } from './types';

const PLACEHOLDER = /{(\w+)}/g;

export function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(PLACEHOLDER, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

/** Whether a template still contains an unfilled `{key}` placeholder. */
export function hasPlaceholders(template: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(template);
}

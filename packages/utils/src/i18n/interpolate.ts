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

/** One run of a rich-text template: plain text (`tag` null) or the text inside `<tag>…</tag>`. */
export interface RichTextSegment {
  tag: string | null;
  text: string;
}

const RICH_TEXT_TAG = /<([a-z]+)>([\s\S]*?)<\/\1>/g;

/**
 * Splits a template that carries inline `<tag>…</tag>` markers into its runs,
 * for a component that draws each tag as an element of its own
 * (`'Delete <strong>{name}</strong>?'` → text, `strong`, text).
 *
 * Tags are lowercase names, do not nest and carry no attributes; anything else
 * stays text. Split first and interpolate each run afterwards: a value is then
 * never read as markup, whatever it contains.
 *
 * @example
 * splitRichText('From: <from>{from}</from> → To: <to>{to}</to>')
 * // → [{ tag: null, text: 'From: ' }, { tag: 'from', text: '{from}' },
 * //    { tag: null, text: ' → To: ' }, { tag: 'to', text: '{to}' }]
 */
export function splitRichText(template: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let last = 0;
  RICH_TEXT_TAG.lastIndex = 0;
  for (let match = RICH_TEXT_TAG.exec(template); match; match = RICH_TEXT_TAG.exec(template)) {
    if (match.index > last) segments.push({ tag: null, text: template.slice(last, match.index) });
    segments.push({ tag: match[1], text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < template.length) segments.push({ tag: null, text: template.slice(last) });
  return segments;
}

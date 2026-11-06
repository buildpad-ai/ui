/**
 * @mentions in comments. The text is the source of truth: a mention is stored as the token
 * `@[Display Name](user:<uuid>)` inside the body (the format of the add-comments skill). The
 * composer shows plain `@Name` and converts on the way in and out. Pure: shared by the browser
 * (composer, chips) and anything that reads a body (a hook, an email).
 */
export const MAX_MENTIONS = 10;
export const MAX_NAME = 100;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// A new RegExp each time: a shared /g regex keeps its position between calls.
const tokenRe = () => new RegExp(`@\\[([^\\[\\]()\\n]{1,${MAX_NAME}})\\]\\(user:(${UUID})\\)`, 'gi');

/** A name that is safe inside a token: no brackets, parentheses or line breaks, and not absurdly long. */
export function cleanName(name: string): string {
  return name
    .replace(/[[\]()\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
    .trim();
}

export const makeToken = (name: string, id: string) => `@[${cleanName(name) || 'Someone'}](user:${id.toLowerCase()})`;

export interface Token {
  name: string;
  id: string;
  start: number;
  end: number;
}

export function parseTokens(body: string): Token[] {
  const out: Token[] = [];
  for (const m of body.matchAll(tokenRe())) {
    out.push({ name: m[1], id: m[2].toLowerCase(), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

/** The people a body mentions, once each, in order. */
export function mentionIds(body: string): string[] {
  return [...new Set(parseTokens(body).map((t) => t.id))];
}

/** Turn tokens into plain `@Name`. With `keep`, tokens for people it accepts are left alone. */
export function stripTokens(body: string, keep?: (id: string) => boolean): string {
  return body.replace(tokenRe(), (all, name: string, id: string) => (keep?.(id.toLowerCase()) ? all : `@${name}`));
}

/** Keep the first `max` distinct people as mentions; the rest become plain `@Name`. */
export function capMentions(body: string, max = MAX_MENTIONS): string {
  const allowed = new Set(mentionIds(body).slice(0, max));
  return stripTokens(body, (id) => allowed.has(id));
}

export type Segment = { type: 'text'; text: string } | { type: 'mention'; name: string; id: string };

/** A body cut into plain text and mentions, for showing chips. */
export function segments(body: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const t of parseTokens(body)) {
    if (t.start > at) out.push({ type: 'text', text: body.slice(at, t.start) });
    out.push({ type: 'mention', name: t.name, id: t.id });
    at = t.end;
  }
  if (at < body.length) out.push({ type: 'text', text: body.slice(at) });
  return out;
}

/** What the composer shows for a stored body: plain `@Name`, plus the people already picked (name → id). */
export function toDisplay(body: string): { text: string; picked: Record<string, string> } {
  const picked: Record<string, string> = {};
  for (const t of parseTokens(body)) picked[t.name] = t.id;
  return { text: stripTokens(body), picked };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The composer's text back to a stored body: each picked `@Name` becomes its token (longest names first). */
export function toStored(text: string, picked: Record<string, string>): string {
  const names = Object.keys(picked)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const re = new RegExp(`(^|\\s)@(${names.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
  return text.replace(re, (_all, lead: string, name: string) => `${lead}${makeToken(name, picked[name])}`);
}

/** Is the caret right after `@word` (at the start or after whitespace)? Then that word is what to search for. */
export function findTrigger(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|\s)@([^\s@[\]()]{0,30})$/);
  if (!m) return null;
  return { start: before.length - m[2].length - 1, query: m[2] };
}

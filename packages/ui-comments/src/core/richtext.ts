/**
 * The little formatting a comment can carry, stored as plain text so older code still reads it:
 *   **bold**   *italic*   ++underline++   and lines that start with "- " as a bullet list.
 * `blocks` turns a text into paragraphs and lists; `inline` turns a line into runs. Rendering never sees HTML: anything
 * that is not one of these marks stays plain text, so a comment can never inject markup.
 */
export type Run = { kind: 'text' | 'bold' | 'italic' | 'underline'; text: string };
export type Block = { type: 'p'; text: string } | { type: 'ul'; items: string[] };

const BULLET = /^\s*[-•]\s+(.*)$/;

export function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const b = BULLET.exec(line);
    const last = out[out.length - 1];
    if (b) {
      if (last?.type === 'ul') last.items.push(b[1]);
      else out.push({ type: 'ul', items: [b[1]] });
    } else if (line.trim() === '' && out.length === 0) {
      continue;
    } else {
      out.push({ type: 'p', text: line });
    }
  }
  return out;
}

const MARKS: Array<{ open: string; kind: Run['kind'] }> = [
  { open: '**', kind: 'bold' },
  { open: '++', kind: 'underline' },
  { open: '*', kind: 'italic' },
];

/** Split one line into runs. A mark with no closing partner (or nothing inside it) stays as typed. */
export function inline(line: string): Run[] {
  const runs: Run[] = [];
  let plain = '';
  const flush = () => {
    if (plain) runs.push({ kind: 'text', text: plain });
    plain = '';
  };
  for (let i = 0; i < line.length; ) {
    const mark = MARKS.find((m) => line.startsWith(m.open, i));
    if (mark) {
      const end = line.indexOf(mark.open, i + mark.open.length);
      const inner = end > i + mark.open.length ? line.slice(i + mark.open.length, end) : '';
      if (inner && !/^\s|\s$/.test(inner)) {
        flush();
        runs.push({ kind: mark.kind, text: inner });
        i = end + mark.open.length;
        continue;
      }
    }
    plain += line[i];
    i++;
  }
  flush();
  return runs;
}

/** Wrap the selected text `[from, to)` in a mark, or take it off again when it is already wrapped. */
export function toggleMark(
  text: string,
  from: number,
  to: number,
  mark: '**' | '*' | '++'
): { text: string; from: number; to: number } {
  const before = text.slice(0, from);
  const sel = text.slice(from, to);
  const after = text.slice(to);
  if (before.endsWith(mark) && after.startsWith(mark) && mark !== '*') {
    return {
      text: before.slice(0, -mark.length) + sel + after.slice(mark.length),
      from: from - mark.length,
      to: to - mark.length,
    };
  }
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2 + 1) {
    const inner = sel.slice(mark.length, -mark.length);
    return { text: before + inner + after, from, to: from + inner.length };
  }
  return { text: before + mark + sel + mark + after, from: from + mark.length, to: to + mark.length };
}

/** Make the lines touched by `[from, to)` bullets (or plain again when they all are). */
export function toggleBullets(text: string, from: number, to: number): { text: string; from: number; to: number } {
  const start = text.lastIndexOf('\n', from - 1) + 1;
  const nl = text.indexOf('\n', to);
  const end = nl === -1 ? text.length : nl;
  const lines = text.slice(start, end).split('\n');
  const all = lines.every((l) => BULLET.test(l));
  const next = lines.map((l) => (all ? (BULLET.exec(l)?.[1] ?? l) : BULLET.test(l) ? l : `- ${l}`));
  const body = next.join('\n');
  return { text: text.slice(0, start) + body + text.slice(end), from: start, to: start + body.length };
}

/** What Enter does inside a bullet line: another bullet, or (on an empty bullet) end the list. Null when the line is not a bullet. */
export function continueBullet(text: string, caret: number): { text: string; caret: number } | null {
  const start = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(start, caret);
  const m = BULLET.exec(line);
  if (!m) return null;
  if (m[1].trim() === '') return { text: text.slice(0, start) + text.slice(caret), caret: start };
  return { text: `${text.slice(0, caret)}\n- ${text.slice(caret)}`, caret: caret + 3 };
}

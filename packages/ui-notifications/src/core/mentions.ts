// A new RegExp each time: a shared /g regex keeps its position between calls.
const tokenRe = () => /@\[([^[\]\n]{1,200})\]\(([a-z0-9_-]+):([^)\s]{1,200})\)/gi;

/** Turn `@[Name](type:id)` mention tokens into plain `@Name`. */
export function mentionsToPlainText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(tokenRe(), (_m, name: string) => `@${name}`);
}

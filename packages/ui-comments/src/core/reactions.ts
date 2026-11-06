/**
 * Reactions under a comment: a fixed list of emoji, one row per person per emoji per comment.
 * Pure helpers shared by the adapter (grouping rows into chips) and the UI (optimistic updates).
 */
export const REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '😮', '😢', '🙏', '👀', '🚀', '✅', '🔥'] as const;

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
  /** Who reacted, in the order the rows came. */
  names: string[];
}

/** Drop the variation selector so ❤ and ❤️ are the same reaction. */
const strip = (emoji: string) => emoji.replace(/️/g, '');

/** The list's form of an emoji, or null when it is not one of the reactions. */
export function canonicalReaction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const bare = strip(value.trim());
  return REACTIONS.find((reaction) => strip(reaction) === bare) ?? null;
}

const order = (emoji: string) => {
  const index = (REACTIONS as readonly string[]).indexOf(emoji);
  return index === -1 ? 999 : index;
};

/** Group one comment's rows into chips, in the order of the fixed list. A person counts once per emoji. */
export function summarize(
  rows: ReadonlyArray<{ emoji: string; reacted_by: string }>,
  meId: string | null,
  nameOf: (userId: string) => string
): ReactionSummary[] {
  const me = meId?.toLowerCase() ?? null;
  const groups = new Map<string, { users: string[]; mine: boolean }>();
  for (const row of rows) {
    const emoji = canonicalReaction(row.emoji) ?? row.emoji;
    const group = groups.get(emoji) ?? { users: [], mine: false };
    const id = row.reacted_by.toLowerCase();
    if (!group.users.includes(id)) group.users.push(id);
    if (id === me) group.mine = true;
    groups.set(emoji, group);
  }
  return [...groups.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([emoji, group]) => ({ emoji, count: group.users.length, mine: group.mine, names: group.users.map(nameOf) }));
}

/** The chips after I add or take back my reaction, to show before the server answers. */
export function toggleLocal(
  chips: readonly ReactionSummary[] | undefined,
  emoji: string,
  on: boolean,
  myName: string
): ReactionSummary[] {
  const list = [...(chips ?? [])];
  const at = list.findIndex((chip) => chip.emoji === emoji);
  if (on) {
    if (at === -1) list.push({ emoji, count: 1, mine: true, names: [myName] });
    else if (!list[at].mine) {
      list[at] = { ...list[at], count: list[at].count + 1, mine: true, names: [...list[at].names, myName] };
    }
  } else if (at !== -1 && list[at].mine) {
    const left = list[at].count - 1;
    if (left <= 0) list.splice(at, 1);
    else list[at] = { ...list[at], count: left, mine: false, names: list[at].names.filter((name) => name !== myName) };
  }
  return list.sort((a, b) => order(a.emoji) - order(b.emoji));
}

/** "Ana, Budi, Citra and 2 more" for a chip's tooltip. */
export function reactorNames(names: readonly string[], more: (count: number) => string): string {
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} ${more(names.length - 3)}` : names.join(', ');
}

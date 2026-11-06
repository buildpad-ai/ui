/**
 * An in-memory `CommentsAdapter` for the stories and the tests. It behaves like the server side
 * of the `add-comments` skill: the author and the thread root are stamped here, not by the caller.
 */
import type { CommentsAdapter } from './CommentsAdapter';
import { summarize, canonicalReaction, type ReactionSummary } from './core/reactions';
import type { Comment } from './core/types';

export interface MockPerson {
  id: string;
  name: string;
}

export interface MockOptions {
  me: MockPerson;
  /** Everyone who can appear as an author or a reactor. */
  people?: MockPerson[];
  comments?: Comment[];
  /** Milliseconds each call takes, so a story can show the in-between states. */
  latency?: number;
  /** Which calls fail, to show the error states. */
  failOn?: Array<'list' | 'add' | 'react' | 'edit' | 'remove' | 'resolve' | 'upload'>;
  /** Offer picture upload (default true). Uploads are kept in memory and drawn as coloured tiles. */
  images?: boolean;
  edit?: boolean;
  remove?: boolean;
  resolve?: boolean;
  react?: boolean;
  /** Offer the @ picker (default true). */
  mentions?: boolean;
  link?: (id: string) => string;
}

type Reaction = { commentId: string; emoji: string; by: string };

export interface MockAdapter extends CommentsAdapter {
  /** Every call, in order, as `method:detail` — for assertions. */
  calls: string[];
  /** How many times `list` has been called. */
  listed: number;
}

export function mockAdapter(options: MockOptions): MockAdapter {
  const people = new Map([options.me, ...(options.people ?? [])].map((p) => [p.id, p]));
  const comments = new Map((options.comments ?? []).map((c) => [c.id, { ...c }]));
  const reactions: Reaction[] = [];
  let serial = 0;
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, options.latency ?? 0));
  const guard = async (name: NonNullable<MockOptions['failOn']>[number]) => {
    await pause();
    if (options.failOn?.includes(name)) throw new Error(`${name} failed`);
  };

  // Reactions seeded on the comments are kept as rows so toggling them works.
  for (const c of options.comments ?? []) {
    for (const chip of c.reactions ?? []) {
      chip.names.forEach((name, index) => {
        const by = [...people.values()].find((p) => p.name === name)?.id ?? `${name}-${index}`;
        if (!people.has(by)) people.set(by, { id: by, name });
        reactions.push({ commentId: c.id, emoji: chip.emoji, by });
      });
    }
  }

  const chipsFor = (commentId: string): ReactionSummary[] | undefined => {
    const rows = reactions.filter((r) => r.commentId === commentId).map((r) => ({ emoji: r.emoji, reacted_by: r.by }));
    // `summarize` compares ids without case and hands them back lower-cased.
    const nameOf = (id: string) => [...people.values()].find((p) => p.id.toLowerCase() === id)?.name ?? 'Someone';
    const chips = summarize(rows, options.me.id, nameOf);
    return chips.length ? chips : undefined;
  };

  const adapter: MockAdapter = {
    calls: [],
    listed: 0,

    async list() {
      adapter.calls.push('list');
      adapter.listed++;
      await guard('list');
      return [...comments.values()].map((c) => ({ ...c, reactions: chipsFor(c.id) }));
    },

    async add(input) {
      adapter.calls.push(`add:${input.parent ?? 'top'}:${input.body}`);
      await guard('add');
      const parent = input.parent ? comments.get(input.parent) : undefined;
      serial++;
      const made: Comment = {
        id: `new-${serial}`,
        parent: parent ? parent.id : null,
        // Stamped like the create hook: the parent's root, or the parent itself for a top-level parent.
        root: parent ? (parent.root ?? parent.id) : null,
        author: { id: options.me.id, name: options.me.name },
        body: input.body,
        photos: input.photos?.length ? input.photos : null,
        resolved: options.resolve ? false : undefined,
        createdAt: new Date(Date.UTC(2026, 10, 5, 12, 0, serial)).toISOString(),
      };
      comments.set(made.id, made);
      return made;
    },
  };

  if (options.edit) {
    adapter.edit = async (commentId, body) => {
      adapter.calls.push(`edit:${commentId}`);
      await guard('edit');
      const c = comments.get(commentId);
      if (c) c.body = body;
    };
  }

  if (options.remove) {
    adapter.remove = async (commentId) => {
      adapter.calls.push(`remove:${commentId}`);
      await guard('remove');
      // Replies go with their parent, like the foreign key's cascade.
      const gone = new Set([commentId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of comments.values()) {
          if (c.parent && gone.has(c.parent) && !gone.has(c.id)) {
            gone.add(c.id);
            grew = true;
          }
        }
      }
      gone.forEach((id) => comments.delete(id));
    };
  }

  if (options.resolve) {
    adapter.resolve = async (commentId, resolved) => {
      adapter.calls.push(`resolve:${commentId}:${resolved}`);
      await guard('resolve');
      const c = comments.get(commentId);
      if (c) c.resolved = resolved;
    };
  }

  if (options.react !== false) {
    adapter.react = async (commentId, emoji, on) => {
      adapter.calls.push(`react:${commentId}:${emoji}:${on}`);
      await guard('react');
      const canonical = canonicalReaction(emoji);
      if (!canonical) throw new Error('That emoji is not one of the reactions');
      const at = reactions.findIndex(
        (r) => r.commentId === commentId && r.by === options.me.id && canonicalReaction(r.emoji) === canonical
      );
      if (on && at === -1) reactions.push({ commentId, emoji: canonical, by: options.me.id });
      if (!on && at !== -1) reactions.splice(at, 1);
    };
  }

  if (options.images !== false) {
    adapter.uploadImage = async (file) => {
      adapter.calls.push(`upload:${file.name}:${file.type}`);
      await guard('upload');
      serial++;
      return `file-${serial}`;
    };
    // A coloured tile with the file's number: real pixels for Storybook, no network.
    adapter.photoUrl = (fileId, size = 'full') => {
      const hue = [...fileId].reduce((sum, ch) => sum + ch.charCodeAt(0) * 37, 0) % 360;
      const side = size === 'thumb' ? 160 : 720;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${Math.round(side * 0.66)}">` +
        `<rect width="100%" height="100%" fill="hsl(${hue} 55% 62%)"/>` +
        `<text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="${side / 9}" fill="white">${fileId}</text></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };
  }

  if (options.mentions !== false) {
    adapter.searchPeople = async (query) => {
      adapter.calls.push('people:' + query);
      await pause();
      const q = query.toLowerCase();
      return [...people.values()].filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
    };
  }

  if (options.link) adapter.linkFor = options.link;
  return adapter;
}

/**
 * How the comments reach their data. An adapter lists, adds and (optionally) edits, deletes and
 * resolves comments, and adds or takes back reactions. Two things ship with the module:
 *
 * - `itemsAdapter` talks to a host collection's comments through the app's `/api/items/...`
 *   routes, so DaaS applies the signed-in user's own permissions, and the create hook of the
 *   `add-comments` skill stamps author, thread root and access.
 * - the Storybook mock (`_mockAdapter.ts`) keeps everything in memory.
 *
 * A method an adapter leaves out switches that feature off in the UI: no `react` hides the
 * reaction picker (chips stay read-only), no `edit`/`remove`/`resolve` hides those buttons.
 */
import { apiRequest, buildApiUrl, getApiHeadersAsync } from '@buildpad/services';
import { summarize, type ReactionSummary } from './core/reactions';
import { displayName, type PersonRow } from './core/people';
import type { Comment, NewComment, Person } from './core/types';

export interface CommentsAdapter {
  /** Every comment of the thread(s), top-level and replies, in any order. */
  list(): Promise<Comment[]>;
  add(input: NewComment): Promise<Comment>;
  edit?(commentId: string, body: string): Promise<void>;
  remove?(commentId: string): Promise<void>;
  resolve?(commentId: string, resolved: boolean): Promise<void>;
  /** Add (`on`) or take back my reaction. */
  react?(commentId: string, emoji: string, on: boolean): Promise<void>;
  /** A link that opens the page on this comment, for "Copy link". */
  linkFor?(commentId: string): string;
  /**
   * People matching what was typed after `@`. Leave out and `@` is just text. The server side
   * (the create hook) is what makes a mention safe: it turns a token of someone who may not
   * read the record into plain text.
   */
  searchPeople?(query: string): Promise<Person[]>;
  /** Upload one picture and return its file id (stored in `photos`). Leave out and there is no picture button and no paste. */
  uploadImage?(file: File): Promise<string>;
  /** Where to load a stored picture from. `thumb` is the small version shown in the comment. */
  photoUrl?(fileId: string, size?: 'thumb' | 'full'): string;
}

/** Upload one file to the app's `/api/files` route (multipart) and return its id. */
export async function uploadToFiles(file: File, folder?: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  if (folder) form.append('folder', folder);
  // The multipart boundary is set by the browser: no Content-Type here.
  const { 'Content-Type': _type, ...headers } = (await getApiHeadersAsync()) as Record<string, string>;
  const response = await fetch(buildApiUrl('/api/files'), { method: 'POST', headers, body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { errors?: Array<{ message?: string }> } | null;
    throw new Error(body?.errors?.[0]?.message || 'Upload failed');
  }
  const { data } = (await response.json()) as { data?: { id?: string } };
  if (!data?.id) throw new Error('Upload failed');
  return data.id;
}

/** `/api/assets/<id>`, resized for a thumbnail. */
export const assetUrl = (fileId: string, size: 'thumb' | 'full' = 'full') =>
  `/api/assets/${encodeURIComponent(fileId)}${size === 'thumb' ? '?width=320&height=320&fit=inside' : ''}`;

/** People search over the app's `/api/users` route (active users, matched on name and email). */
export function usersSearch(request: Request = (path, init) => apiRequest(path, init), limit = 8) {
  return async (query: string): Promise<Person[]> => {
    const params = new URLSearchParams({ limit: String(limit), fields: 'id,first_name,last_name,email', status: 'active' });
    if (query) params.set('search', query);
    const res = await request<{ data?: PersonRow[] }>(`/api/users?${params.toString()}`);
    return (res?.data ?? [])
      .filter((row): row is PersonRow & { id: string } => typeof row.id === 'string')
      .map((row) => ({ id: row.id.toLowerCase(), name: displayName(row), email: row.email ?? undefined }));
  };
}

/** Column names of the comment collection and its reactions collection. Defaults follow the `add-comments` skill. */
export interface CommentFields {
  parent: string;
  root: string;
  author: string;
  body: string;
  photos: string;
  createdAt: string;
  /** Leave undefined when the collection has no resolve column. */
  resolved?: string;
  /** The one-to-many alias on the comment collection that lists its reactions. */
  reactions: string;
  reaction: { emoji: string; reactedBy: string; target: string };
}

export const DEFAULT_FIELDS: CommentFields = {
  parent: 'parent',
  root: 'root',
  author: 'author',
  body: 'body',
  photos: 'photos',
  createdAt: 'created_at',
  reactions: 'reactions',
  reaction: { emoji: 'emoji', reactedBy: 'reacted_by', target: 'target_comment' },
};

type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface ItemsAdapterOptions {
  /** The comment collection, e.g. `ticket_comments`. */
  collection: string;
  /** The reactions collection, e.g. `ticket_comment_reactions`. Leave out to switch reactions off. */
  reactionsCollection?: string;
  /** The column on the comment collection that points at the thing commented on, and that thing's id. */
  hostField: string;
  hostId: string;
  /** The signed-in user's id and name (for the optimistic chips and "mine"). */
  meId: string;
  fields?: Partial<Omit<CommentFields, 'reaction'>> & { reaction?: Partial<CommentFields['reaction']> };
  /**
   * People for the @ picker. `true` searches `/api/users`; a function replaces that; leave out and
   * `@` is just text.
   */
  mentions?: boolean | ((query: string) => Promise<Person[]>);
  /**
   * Pictures: `true` uploads to `/api/files` and shows `/api/assets/<id>`; `folder` puts the files
   * in a folder; `upload` replaces the upload. Leave out and there is no picture button.
   */
  images?: boolean | { folder?: string; upload?: (file: File) => Promise<string> };
  /** Edit and delete are off unless asked for: comments are immutable by default. */
  allowEdit?: boolean;
  allowDelete?: boolean;
  /** Builds the link for "Copy link". */
  linkFor?: (commentId: string) => string;
  /** Replaces `apiRequest` (tests). */
  request?: Request;
}

/** Replies are read in groups of this many thread ids, so the URL stays short. */
export const REPLY_CHUNK = 40;

const AUTHOR_FIELDS = ['id', 'first_name', 'last_name', 'email'];

const enc = (value: unknown) => encodeURIComponent(JSON.stringify(value));

interface Row extends Record<string, unknown> {
  id: string;
}

const personOf = (value: unknown) =>
  value && typeof value === 'object' ? (value as { id?: string; first_name?: string; last_name?: string; email?: string }) : null;

/** The comments of one host record, read and written through `/api/items/...`. */
export function itemsAdapter(options: ItemsAdapterOptions): CommentsAdapter {
  const fields: CommentFields = {
    ...DEFAULT_FIELDS,
    ...options.fields,
    reaction: { ...DEFAULT_FIELDS.reaction, ...options.fields?.reaction },
  };
  const request: Request = options.request ?? ((path, init) => apiRequest(path, init));
  const base = `/api/items/${options.collection}`;
  const reactionsBase = options.reactionsCollection ? `/api/items/${options.reactionsCollection}` : null;
  const me = options.meId.toLowerCase();

  const reactionColumns = reactionsBase
    ? [
        `${fields.reactions}.id`,
        `${fields.reactions}.${fields.reaction.emoji}`,
        ...AUTHOR_FIELDS.map((f) => `${fields.reactions}.${fields.reaction.reactedBy}.${f}`),
      ]
    : [];
  const columns = [
    'id',
    fields.parent,
    fields.root,
    fields.body,
    fields.photos,
    fields.createdAt,
    ...(fields.resolved ? [fields.resolved] : []),
    ...AUTHOR_FIELDS.map((f) => `${fields.author}.${f}`),
    ...reactionColumns,
  ].join(',');

  const idOf = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    const person = personOf(value);
    return person?.id ?? null;
  };

  const chipsOf = (row: Row): ReactionSummary[] | undefined => {
    const raw = row[fields.reactions];
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const names = new Map<string, string>();
    const rows = raw.flatMap((item: Record<string, unknown>) => {
      const by = item[fields.reaction.reactedBy];
      const id = idOf(by);
      if (!id) return [];
      const person = personOf(by);
      if (person) names.set(id.toLowerCase(), displayName(person));
      return [{ emoji: String(item[fields.reaction.emoji] ?? ''), reacted_by: id }];
    });
    const chips = summarize(rows, me, (id) => names.get(id.toLowerCase()) ?? 'Someone');
    return chips.length ? chips : undefined;
  };

  const toComment = (row: Row): Comment => {
    const author = personOf(row[fields.author]);
    const photos = row[fields.photos];
    return {
      id: row.id,
      parent: idOf(row[fields.parent]),
      root: idOf(row[fields.root]),
      author: author?.id ? { id: author.id, name: displayName(author) } : null,
      body: typeof row[fields.body] === 'string' ? (row[fields.body] as string) : '',
      photos: Array.isArray(photos) && photos.length ? photos.map(String) : null,
      resolved: fields.resolved ? Boolean(row[fields.resolved]) : undefined,
      createdAt: String(row[fields.createdAt] ?? ''),
      reactions: chipsOf(row),
    };
  };

  const read = async (filter: unknown): Promise<Row[]> => {
    const res = await request<{ data?: Row[] }>(
      `${base}?fields=${encodeURIComponent(columns)}&sort=${fields.createdAt}&limit=-1&filter=${enc(filter)}`
    );
    return res?.data ?? [];
  };

  const adapter: CommentsAdapter = {
    // The whole thread in two reads, whatever its depth: the top-level comments, then every reply
    // by `root` (the create hook stamps it), so no read is needed per level.
    async list() {
      const tops = await read({ _and: [{ [options.hostField]: { _eq: options.hostId } }, { [fields.parent]: { _null: true } }] });
      const ids = tops.map((row) => row.id);
      const replies: Row[] = [];
      for (let i = 0; i < ids.length; i += REPLY_CHUNK) {
        replies.push(...(await read({ [fields.root]: { _in: ids.slice(i, i + REPLY_CHUNK) } })));
      }
      return [...tops, ...replies].map(toComment);
    },

    async add(input) {
      // Only what the browser may send: the hook stamps author, root, access and time.
      const res = await request<{ data: Row }>(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [options.hostField]: options.hostId,
          [fields.parent]: input.parent ?? null,
          [fields.body]: input.body,
          [fields.photos]: input.photos && input.photos.length ? input.photos : null,
        }),
      });
      return toComment(res.data);
    },
  };

  if (options.linkFor) adapter.linkFor = options.linkFor;

  if (options.images) {
    const custom = typeof options.images === 'object' ? options.images : {};
    adapter.uploadImage = custom.upload ?? ((file) => uploadToFiles(file, custom.folder));
    adapter.photoUrl = assetUrl;
  }

  if (options.mentions) {
    adapter.searchPeople = typeof options.mentions === 'function' ? options.mentions : usersSearch(request);
  }

  if (options.allowEdit) {
    adapter.edit = async (commentId, body) => {
      await request(`${base}/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fields.body]: body }),
      });
    };
  }

  if (options.allowDelete) {
    adapter.remove = async (commentId) => {
      await request(`${base}/${commentId}`, { method: 'DELETE' });
    };
  }

  if (fields.resolved) {
    const column = fields.resolved;
    adapter.resolve = async (commentId, resolved) => {
      await request(`${base}/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [column]: resolved }),
      });
    };
  }

  if (reactionsBase) {
    const { emoji: emojiField, reactedBy, target } = fields.reaction;
    adapter.react = async (commentId, emoji, on) => {
      if (on) {
        // The reactions hook checks the emoji list and stamps `reacted_by`.
        await request(reactionsBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [emojiField]: emoji, [target]: commentId }),
        });
        return;
      }
      // Take back only my own rows; DaaS also refuses anyone else's.
      const mine = await request<{ data?: Row[] }>(
        `${reactionsBase}?fields=id,${emojiField}&limit=-1&filter=${enc({
          _and: [{ [target]: { _eq: commentId } }, { [reactedBy]: { _eq: options.meId } }],
        })}`
      );
      const want = emoji.replace(/️/g, '');
      for (const row of mine?.data ?? []) {
        if (String(row[emojiField] ?? '').replace(/️/g, '') === want) {
          await request(`${reactionsBase}/${row.id}`, { method: 'DELETE' });
        }
      }
    };
  }

  return adapter;
}

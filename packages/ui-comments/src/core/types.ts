import type { ReactionSummary } from './reactions';

/** Limits the kit enforces in the browser. The create hook enforces the same ones on the server (add-comments skill, step 3). */
export const MAX_BODY = 20000;
export const MAX_PHOTOS = 20;

export interface CommentAuthor {
  id: string;
  name: string;
}

/** One comment as the UI works with it, whatever the host collection's column names are. */
export interface Comment {
  id: string;
  /** The comment this one answers; null on a top-level comment. */
  parent: string | null;
  /** The first comment of the thread; null on a top-level comment. */
  root: string | null;
  author: CommentAuthor | null;
  /** The text markup (see richtext.ts). */
  body: string;
  /** File ids of attached pictures, null when none. */
  photos: string[] | null;
  /** Only meaningful on a top-level comment; undefined when the host has no resolve. */
  resolved?: boolean;
  createdAt: string;
  reactions?: ReactionSummary[];
}

/** A comment placed in its thread. */
export interface ThreadNode {
  comment: Comment;
  depth: number;
  /** True when the comment answers one that is not loaded. */
  orphan: boolean;
  children: ThreadNode[];
}

export interface NewComment {
  body: string;
  /** The comment answered; omit for a top-level comment. */
  parent?: string | null;
  photos?: string[];
}

export type { ReactionSummary };

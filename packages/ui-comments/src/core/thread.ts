import type { Comment, ThreadNode } from './types';

/** Replies deeper than this are not drawn (a guard against a cyclic or runaway list). */
export const MAX_DEPTH = 40;

const byTime = (a: Comment, b: Comment) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

/**
 * Build the threads from the flat list: children by `parent`, oldest first at each level.
 * A comment whose parent is not loaded stays at the top and is marked `orphan`, so the list can
 * say whom it answers. A cycle (a comment that is its own ancestor) never loops: each comment is
 * placed once, and one reachable only through a cycle is placed at the top.
 */
export function buildThreads(comments: readonly Comment[]): ThreadNode[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const children = new Map<string, Comment[]>();
  const tops: Comment[] = [];
  for (const comment of comments) {
    if (comment.parent && ids.has(comment.parent) && comment.parent !== comment.id) {
      children.set(comment.parent, [...(children.get(comment.parent) ?? []), comment]);
    } else {
      tops.push(comment);
    }
  }

  const placed = new Set<string>();
  const place = (comment: Comment, depth: number, orphan: boolean): ThreadNode => {
    placed.add(comment.id);
    const kids =
      depth >= MAX_DEPTH
        ? []
        : (children.get(comment.id) ?? [])
            .filter((child) => !placed.has(child.id))
            .sort(byTime)
            .map((child) => place(child, depth + 1, false));
    return { comment, depth, orphan, children: kids };
  };

  const nodes = tops.sort(byTime).map((comment) => place(comment, 0, comment.parent !== null));
  // Whatever a cycle kept out of the tree still shows, at the top.
  for (const comment of [...comments].sort(byTime)) {
    if (!placed.has(comment.id)) nodes.push(place(comment, 0, true));
  }
  return nodes;
}

/** How many comments a thread holds, replies included. */
export function countThread(node: ThreadNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countThread(child), 0);
}

/** Left indent in px for a reply: 41 for the first level, 22 for each deeper one. Top-level comments are not indented. */
export function indentFor(depth: number): number {
  if (depth <= 0) return 0;
  return depth === 1 ? 41 : 22;
}

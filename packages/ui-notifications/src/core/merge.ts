import type { Notification } from './types';

/** Newest first; a stable sort, so rows sharing a created_at keep their order. */
const byNewest = (a: Notification, b: Notification) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

/**
 * Fold a polled first page into what is on screen:
 * - rows we already have take the fresh copy (read state may have changed elsewhere). A fresh copy
 *   may be NEWER than the loaded one (a merged reply row moves to the top when it absorbs a reply),
 *   so the result is re-sorted newest first: the row moves to its place instead of keeping its old
 *   index, day groups stay contiguous and the last row is still the oldest (the paging cursor);
 * - rows strictly newer than anything loaded are prepended (an unknown row at the same instant
 *   belongs to a later page and arrives through paging);
 * - older loaded rows stay, even when new arrivals pushed them off the polled first page.
 */
export function mergePoll(current: Notification[], polled: Notification[]): Notification[] {
  if (!current.length) return polled;
  const fresh = new Map(polled.map((n) => [n.id, n]));
  const known = new Set(current.map((n) => n.id));
  const newest = current[0].created_at;
  const added = polled.filter((n) => !known.has(n.id) && n.created_at > newest);
  const updated = current.map((n) => fresh.get(n.id) ?? n);
  return [...added, ...updated].sort(byNewest);
}

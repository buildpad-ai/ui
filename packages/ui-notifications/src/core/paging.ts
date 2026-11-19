import type { Notification } from './types';

export const PAGE_SIZE = 30;
/** Extra rows asked for beyond the page, so rows sharing the cursor timestamp are not lost. */
export const OVERLAP = 10;

/**
 * Keyset paging over `created_at` only (DaaS cannot sort by a second field). The next page asks
 * for `created_at <= last loaded` (inclusive, so equal timestamps are not skipped) with
 * `PAGE + 1 + OVERLAP` rows; rows already loaded are dropped by id.
 */
export const requestLimit = (page = PAGE_SIZE, overlap = OVERLAP) => page + 1 + overlap;

export const cursorOf = (items: Notification[]): string | undefined => items.at(-1)?.created_at;

export interface PageResult {
  items: Notification[];
  hasMore: boolean;
}

/**
 * Fold a fetched page into the loaded rows: drop known ids, keep at most `page` new rows.
 * `_limit` (the request's limit) is kept for callers; whether more exist no longer depends on it.
 */
export function appendPage(loaded: Notification[], fetched: Notification[], _limit: number, page = PAGE_SIZE): PageResult {
  const seen = new Set(loaded.map((n) => n.id));
  const fresh: Notification[] = [];
  for (const n of fetched) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    fresh.push(n);
  }
  const taken = fresh.slice(0, page);
  // A short page does not prove the end: a read filter on the server (the notifications-visible hook)
  // may have dropped rows from it. So any page that brought fresh rows keeps paging, and only a page
  // with nothing new ends it (one extra, empty request at the very end). That also ends the stall
  // where more rows than one request share the cursor's created_at: the request returns only rows we
  // already hold, the cursor cannot move, and asking again would loop forever.
  const hasMore = fresh.length > 0;
  return { items: [...loaded, ...taken], hasMore };
}

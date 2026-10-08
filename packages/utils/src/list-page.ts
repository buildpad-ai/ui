/**
 * Page arithmetic for a paged list.
 *
 * A list that deletes the only row of its last page and refetches the same
 * page gets an empty answer: the table shows its empty state and the pager
 * (drawn only for more than one page) disappears, while every other row still
 * exists. These helpers keep the page inside the list.
 */

/**
 * `page` held inside 1..`totalPages`. Use it on the answer of every list
 * request, and refetch when it differs from the page that was asked for:
 * rows can also disappear because someone else deleted them.
 */
export function clampPage(page: number, totalPages: number): number {
  const last = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), last);
}

/**
 * The page to load after `removed` of the `rowsOnPage` rows on `page` were
 * deleted: the same page while it still has a row, the one before it when it
 * was emptied. Saves the round trip of loading a page that is known to be
 * empty.
 */
export function pageAfterRemoval(page: number, rowsOnPage: number, removed = 1): number {
  const current = clampPage(page, Number.MAX_SAFE_INTEGER);
  return rowsOnPage - removed > 0 ? current : Math.max(1, current - 1);
}

/**
 * New Item Detection Utility
 *
 * Centralizes the "+" sentinel pattern used across Buildpad to distinguish
 * new (unsaved) items from existing ones. Mirrors the DaaS pattern where
 * routes navigate to `/content/{collection}/+` for item creation.
 *
 * Handles URL-encoded "+" (%2B) which occurs when the "+" character is
 * percent-encoded in Next.js dynamic route segments.
 *
 * @package @buildpad/utils
 */

/** Sentinel values that indicate a new/unsaved item */
const NEW_ITEM_SENTINELS = new Set(["+", "%2B", "new"]);

/**
 * Check if a primary key / route ID represents a new (unsaved) item.
 *
 * Returns `true` for:
 * - `"+"` — primary sentinel (DaaS convention, used in routes like `/content/articles/+`)
 * - `"%2B"` — URL-encoded `+` (Next.js may percent-encode the `+` in `[id]` segments)
 * - `"new"` — alternative human-readable sentinel
 * - `null`, `undefined`, `""` — no ID means new item
 *
 * @example
 * ```ts
 * isNewItem("+");    // true
 * isNewItem("%2B");  // true
 * isNewItem("new");  // true
 * isNewItem(null);   // true
 * isNewItem("abc-123"); // false
 * isNewItem(42);     // false
 * ```
 */
export function isNewItem(id?: string | number | null): boolean {
  if (id === null || id === undefined || id === "") return true;
  if (typeof id === "string" && NEW_ITEM_SENTINELS.has(id)) return true;
  return false;
}

/**
 * Check if a primary key is valid for API operations (i.e., NOT a new item).
 *
 * This is the inverse of `isNewItem()` with a type guard so the result
 * can be used directly in API calls that require a concrete ID.
 *
 * @example
 * ```ts
 * if (isExistingItem(id)) {
 *   await ItemsService.readOne(collection, id); // id is string | number
 * }
 * ```
 */
export function isExistingItem(
  id?: string | number | null,
): id is string | number {
  return !isNewItem(id);
}

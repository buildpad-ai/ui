import { useState, useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { interpolate } from '@buildpad/utils';
import { useBuildpadI18n, useBuildpadTranslations } from './useBuildpadI18n';
import type { M2MRelationInfo } from './useRelationM2M';
import { apiRequest, isValidPrimaryKey } from './utils';

export interface M2MItem {
  id: string | number;
  [key: string]: unknown;
}

export interface M2MQueryParams {
  limit: number;
  page: number;
  search?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  fields: string[];
  enableSearchFilter?: boolean;
}

/**
 * Alias the junction table's real primary key onto `.id`.
 *
 * Guarded, matching `useRelationMultipleM2M`: when the PK column is absent
 * from the response (field-level read permission, or a mis-resolved field
 * name) the row is returned untouched. Writing `undefined` over a real `id`
 * would collapse every row onto one identity and point every per-row URL at
 * `/undefined` — worse than the bug the alias fixes.
 */
function aliasJunctionPk(item: M2MItem, pkField: string): M2MItem {
  const pk = item[pkField];
  if (pk === undefined || pk === null) return item;
  return { ...item, id: pk as string | number };
}

interface ItemsResponse {
  data: M2MItem[];
  meta?: {
    total_count?: number;
  };
}

/**
 * Custom hook for managing M2M relationship items (CRUD operations)
 * Similar to DaaS useRelationMultiple composable
 *
 * Not currently consumed by any first-party component — `ListM2M.tsx` (the
 * shipped ListM2M interface) uses `useRelationMultipleM2M` instead;
 * `ListM2MInterface.tsx` only references this hook in a doc comment. Kept
 * (and kept correct) as public package API rather than removed outright,
 * since removing an exported hook is a breaking change for any external
 * consumer that may already depend on it.
 */
export function useRelationM2MItems(
  relationInfo: M2MRelationInfo | null,
  primaryKey: string | number | null
) {
  const [items, setItems] = useState<M2MItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPrimaryKeys, setSelectedPrimaryKeys] = useState<(string | number)[]>([]);

  // Check if operations can be performed (item must be saved first)
  const canPerformOperations = isValidPrimaryKey(primaryKey);

  // Notification strings from the shared dictionary (English without a provider).
  const t = useBuildpadTranslations((d) => d.hooks.relations);
  const { formatCount } = useBuildpadI18n();

  // Resolved once, defensively — matching the sibling hooks. A hand-built
  // `relationInfo` (a supported pattern) without this field used to throw
  // inside loadItems' try, where the bare catch reduced it to an empty list
  // and a generic toast.
  const junctionPKField = relationInfo?.junctionPrimaryKeyField?.field ?? 'id';
  const junctionFieldName = relationInfo?.junctionField?.field ?? '';
  const relatedPKField = relationInfo?.relatedPrimaryKeyField?.field ?? 'id';

  // The last successful load, so mutations can refresh instead of leaving
  // `items`/`totalCount`/`selectedPrimaryKeys` stale behind a green toast.
  const lastParamsRef = useRef<M2MQueryParams | null>(null);
  // Guards against an older in-flight load landing after a newer one.
  const requestIdRef = useRef(0);

  // Load junction items
  const loadItems = useCallback(async (params: M2MQueryParams) => {
    if (!relationInfo || !isValidPrimaryKey(primaryKey)) {
      setItems([]);
      setTotalCount(0);
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.set('limit', String(params.limit));
      queryParams.set('offset', String((params.page - 1) * params.limit));
      queryParams.set('meta', 'total_count');
      
      // Build filter
      const filter = {
        [relationInfo.reverseJunctionField.field]: {
          _eq: primaryKey
        }
      };
      queryParams.set('filter', JSON.stringify(filter));

      // Always fetch the three fields this hook itself depends on: the
      // junction PK (used for every per-row URL), the related PK (used to
      // build `selectedPrimaryKeys`, which silently came back empty whenever
      // the caller's `fields` omitted it), and the sort field.
      const fieldsToFetch = new Set<string>([
        junctionPKField,
        `${junctionFieldName}.${relatedPKField}`,
        ...params.fields.map(f => f.includes('.') ? f : `${junctionFieldName}.${f}`),
      ]);
      if (relationInfo.sortField) fieldsToFetch.add(relationInfo.sortField);
      queryParams.set('fields', [...fieldsToFetch].join(','));

      // A bare `sortField` names a related-collection column, exactly as it
      // does in `fields` above — sorting the junction table by it asks the
      // backend for a column that doesn't exist there.
      const sortField = params.sortField
        ? (params.sortField.includes('.') ? params.sortField : `${junctionFieldName}.${params.sortField}`)
        : relationInfo.sortField;
      if (sortField) {
        // Direction applies to the configured sort field too; it used to be
        // honoured only on the caller-supplied branch.
        queryParams.set('sort', params.sortDirection === 'desc' ? `-${sortField}` : sortField);
      }

      // `enableSearchFilter` is optional and undefined by default, so a caller
      // passing `search` alone had it silently discarded. Search when asked.
      if (params.search) {
        queryParams.set('search', params.search);
      }

      const response = await apiRequest<ItemsResponse>(
        `/api/items/${relationInfo.junctionCollection.collection}?${queryParams.toString()}`
      );

      if (requestIdRef.current !== requestId) return; // superseded by a newer call

      const rows = Array.isArray(response?.data) ? response.data : [];
      const loadedItems: M2MItem[] = rows.map((item) => aliasJunctionPk(item, junctionPKField));
      setItems(loadedItems);
      lastParamsRef.current = params;

      // NOT `meta.total_count`: on this DaaS build that is the unfiltered
      // count of the whole junction table, while this query is always
      // filtered by the parent — it reported every junction row in the
      // database as this parent's count, producing phantom pages. Infer from
      // page fullness instead: a short page is the last one.
      const pageSize = params.limit ?? loadedItems.length;
      const page = params.page ?? 1;
      const offset = (page - 1) * pageSize;
      setTotalCount(
        loadedItems.length < pageSize ? offset + loadedItems.length : offset + loadedItems.length + 1,
      );

      // Extract selected primary keys for filtering. `isValidPrimaryKey`
      // rather than `Boolean`, so a legitimate key of `0` survives.
      const pks = loadedItems
        .map((item) => {
          const relatedData = item[junctionFieldName] as Record<string, unknown> | undefined;
          return relatedData?.[relatedPKField] as string | number | undefined;
        })
        .filter((pk): pk is string | number => isValidPrimaryKey(pk));
      setSelectedPrimaryKeys(pks);

    } catch {
      notifications.show({
        title: t.errorTitle,
        message: t.loadItemsFailed,
        color: 'red',
      });
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [relationInfo, primaryKey, junctionPKField, junctionFieldName, relatedPKField, t]);

  /** Re-run the last successful load, so state isn't stale after a mutation. */
  const refresh = useCallback(async () => {
    if (lastParamsRef.current) await loadItems(lastParamsRef.current);
  }, [loadItems]);

  /**
   * Next sort value for a newly linked row. Derived from the loaded page, so
   * it is correct for single-page lists and appends to the end of the current
   * page otherwise — better than the NULL that made new rows clump.
   */
  const nextSortValue = useCallback((): number => {
    const sortKey = relationInfo?.sortField;
    if (!sortKey) return 1;
    const highest = items.reduce((max, item) => {
      const v = Number(item[sortKey]);
      return Number.isFinite(v) && v > max ? v : max;
    }, 0);
    return highest + 1;
  }, [items, relationInfo]);

  // Create new junction record
  const createJunctionItem = useCallback(async (relatedItemId: string | number) => {
    if (!relationInfo) {
      return null;
    }

    if (!isValidPrimaryKey(primaryKey)) {
      notifications.show({
        title: t.saveRequiredTitle,
        message: t.saveFirst,
        color: 'yellow',
      });
      return null;
    }

    try {
      const junctionItem: Record<string, unknown> = {
        [relationInfo.reverseJunctionField.field]: primaryKey,
        [relationInfo.junctionField.field]: relatedItemId,
      };
      // Without a sort value a new row lands as NULL and clumps at one end of
      // the next sorted load, regardless of where the user added it.
      if (relationInfo.sortField) junctionItem[relationInfo.sortField] = nextSortValue();

      const result = await apiRequest<{ data: M2MItem }>(
        `/api/items/${relationInfo.junctionCollection.collection}`,
        {
          method: 'POST',
          body: JSON.stringify(junctionItem),
        }
      );

      notifications.show({
        title: t.successTitle,
        message: t.itemAdded,
        color: 'green',
      });
      await refresh();
      // Aliased like the load path: the raw POST body carries the junction's
      // real PK, not `.id`, so returning it unmapped handed the caller a row
      // whose `removeItem` URL resolved to `/undefined`.
      return result?.data ? aliasJunctionPk(result.data, junctionPKField) : null;
    } catch {
      notifications.show({
        title: t.errorTitle,
        message: t.addItemFailed,
        color: 'red',
      });
      throw new Error('Failed to add item');
    }
  }, [relationInfo, primaryKey, junctionPKField, nextSortValue, refresh, t]);

  // Select existing items from the RELATED collection
  const selectItems = useCallback(async (selectedIds: (string | number)[]) => {
    if (!relationInfo) {
      return;
    }

    if (!isValidPrimaryKey(primaryKey)) {
      notifications.show({
        title: t.saveRequiredTitle,
        message: t.saveFirst,
        color: 'yellow',
      });
      return;
    }

    try {
      const baseSort = nextSortValue();
      const junctionItems = selectedIds.map((relatedId, i) => {
        const row: Record<string, unknown> = {
          [relationInfo.reverseJunctionField.field]: primaryKey,
          [relationInfo.junctionField.field]: relatedId,
        };
        if (relationInfo.sortField) row[relationInfo.sortField] = baseSort + i;
        return row;
      });

      // `allSettled`, not `all`: these are independent writes, so a rejection
      // partway through still leaves the earlier rows committed. Reporting the
      // whole batch as failed made the user retry and duplicate them.
      const results = await Promise.allSettled(
        junctionItems.map(item =>
          apiRequest<{ data: M2MItem }>(
            `/api/items/${relationInfo.junctionCollection.collection}`,
            {
              method: 'POST',
              body: JSON.stringify(item),
            }
          )
        )
      );

      const created: M2MItem[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.data) {
          created.push(aliasJunctionPk(r.value.data, junctionPKField));
        }
      }
      const failed = results.length - created.length;

      notifications.show({
        title: failed ? t.partiallyAddedTitle : t.successTitle,
        message: failed
          ? interpolate(t.addedPartial, { added: created.length, total: results.length, failed })
          : formatCount(created.length, t.addedCount),
        color: failed ? 'yellow' : 'green',
      });

      await refresh();
      // The server rows, not the request bodies — those carried no primary key
      // of any name, so the caller could never remove what it had just added.
      return created;
    } catch {
      notifications.show({
        title: t.errorTitle,
        message: t.addSelectedFailed,
        color: 'red',
      });
      throw new Error('Failed to add selected items');
    }
  }, [relationInfo, primaryKey, junctionPKField, nextSortValue, refresh, t, formatCount]);

  // Remove item (delete junction record)
  const removeItem = useCallback(async (item: M2MItem) => {
    if (!relationInfo) {
      return;
    }

    // Resolve the real PK rather than trusting `.id`: rows can reach here from
    // paths the load-time alias never touched. Without this a missing key
    // produced `/api/items/{collection}/undefined`, which a string-PK backend
    // answers 2xx — so the UI reported a success that never happened.
    const pk = (item[junctionPKField] ?? item.id) as string | number | undefined;
    if (!isValidPrimaryKey(pk)) {
      notifications.show({
        title: t.errorTitle,
        message: t.removeNoPrimaryKey,
        color: 'red',
      });
      throw new Error('Failed to remove item: missing primary key');
    }

    try {
      await apiRequest(
        `/api/items/${relationInfo.junctionCollection.collection}/${encodeURIComponent(String(pk))}`,
        {
          method: 'DELETE',
        }
      );
      notifications.show({
        title: t.successTitle,
        message: t.itemRemoved,
        color: 'green',
      });
      await refresh();
    } catch {
      notifications.show({
        title: t.errorTitle,
        message: t.removeItemFailed,
        color: 'red',
      });
      throw new Error('Failed to remove item');
    }
  }, [relationInfo, junctionPKField, refresh, t]);

  // Update sort order for items
  /**
   * @param sortedItems the reordered rows of the CURRENT page
   * @param pageOffset  rows preceding this page, e.g. `(page - 1) * limit`.
   *   Numbering positions 1..length assigns page-local sort values, so a
   *   reorder on page 2 collided with page 1 and the two interleaved
   *   arbitrarily on the next sorted load. Defaults to the offset of the last
   *   load, so callers that paginate through `loadItems` get this for free.
   */
  const updateSortOrder = useCallback(async (sortedItems: M2MItem[], pageOffset?: number) => {
    if (!relationInfo?.sortField) {
      return;
    }

    const last = lastParamsRef.current;
    const offset = pageOffset ?? (last ? ((last.page ?? 1) - 1) * last.limit : 0);

    // Resolve every PK up front: a row with none would otherwise PATCH
    // `/undefined`, and because the writes fan out, the rows before it in the
    // array would already have been renumbered by the time it threw.
    const targets = sortedItems.map((item, idx) => ({
      pk: (item[junctionPKField] ?? item.id) as string | number | undefined,
      sort: offset + idx + 1,
    }));
    const unresolved = targets.filter(t => !isValidPrimaryKey(t.pk));
    if (unresolved.length > 0) {
      notifications.show({
        title: t.errorTitle,
        message: t.reorderNoPrimaryKey,
        color: 'red',
      });
      throw new Error('Failed to update sort order: missing primary key');
    }

    // `allSettled`: a rejection partway through still leaves the earlier
    // PATCHes committed, so reporting a total failure hid a half-renumbered
    // table behind the pre-reorder order.
    const results = await Promise.allSettled(
      targets.map(t =>
        apiRequest(
          `/api/items/${relationInfo.junctionCollection.collection}/${encodeURIComponent(String(t.pk))}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              [relationInfo.sortField!]: t.sort
            }),
          }
        )
      )
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      notifications.show({
        title: t.errorTitle,
        message: interpolate(t.reorderFailed, { failed, total: results.length }),
        color: 'red',
      });
      // Re-read rather than trusting the requested order: some writes landed.
      await refresh();
      throw new Error('Failed to update sort order');
    }

    setItems(sortedItems.map(item => aliasJunctionPk(item, junctionPKField)));
  }, [relationInfo, junctionPKField, refresh, t]);

  // Move item up in sort order
  const moveItemUp = useCallback(async (index: number) => {
    // Bound BOTH ends: an index past the end (row removed, or the page shrank
    // between render and click) used to fall through, writing `undefined` into
    // the copied array and renumbering the real rows before throwing on it.
    if (index <= 0 || index >= items.length || !relationInfo?.sortField) {
      return;
    }
    
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    
    await updateSortOrder(newItems);
  }, [items, relationInfo, updateSortOrder]);

  // Move item down in sort order
  const moveItemDown = useCallback(async (index: number) => {
    if (index < 0 || index >= items.length - 1 || !relationInfo?.sortField) {
      return;
    }
    
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    
    await updateSortOrder(newItems);
  }, [items, relationInfo, updateSortOrder]);

  return {
    items,
    totalCount,
    loading,
    selectedPrimaryKeys,
    canPerformOperations,
    loadItems,
    createJunctionItem,
    selectItems,
    removeItem,
    updateSortOrder,
    moveItemUp,
    moveItemDown,
    setItems
  };
}

/**
 * useRelationMultipleM2M
 *
 * Local-first staged change tracking for M2M (Many-to-Many) relationships.
 *
 * Follows the same ChangesItem pattern as useRelationM2AItems:
 * - All create / update / delete operations are staged locally in a
 *   `{create:[], update:[], delete:[]}` structure.
 * - Nothing is persisted until the consumer calls the parent form save,
 *   which reads `getChanges()` and POSTs the payload to the DaaS API.
 * - `displayItems` merges fetched server data with local changes so the
 *   UI always reflects the user's in-progress edits.
 *
 * Port of the DaaS `use-relation-multiple` composable, specialised for
 * M2M relations (junction table pattern).
 *
 * @module @buildpad/hooks/useRelationMultipleM2M
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { apiRequest, isNewItem } from './utils';
import type { M2MRelationInfo } from './useRelationM2M';

// ── Types ──────────────────────────────────────────────────────────

export interface M2MDisplayItem {
    /** Junction row primary key */
    id: string | number;
    /** Index within the local changes array (create/update/delete) */
    $index?: number;
    /** Item type marker for local-first tracking */
    $type?: 'created' | 'updated' | 'deleted';
    /** Index into the update array when an item is both edited and deleted */
    $edits?: number;
    /** Any other fields from the junction row + nested related data */
    [key: string]: unknown;
}

export interface M2MChangesItem {
    /** New junction rows to create on save */
    create: Record<string, unknown>[];
    /** Existing junction rows with edits to PATCH on save */
    update: Record<string, unknown>[];
    /** Junction primary keys to DELETE on save */
    delete: (string | number)[];
}

export interface M2MMultipleQueryParams {
    limit: number;
    page: number;
    fields: string[];
    search?: string;
    sort?: string;
    filter?: Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Strip internal $-prefixed props before persisting */
function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
        if (!key.startsWith('$')) {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

/** Check whether a cleaned update entry is effectively empty (only has PKs) */
function isEmptyM2MEdits(
    item: Record<string, unknown>,
    junctionPKField: string,
    junctionFieldName: string,
    relatedPKField: string,
): boolean {
    const keys = Object.keys(item).filter(k => !k.startsWith('$'));

    // Only junction PK → empty
    if (keys.length === 1 && keys[0] === junctionPKField) return true;

    // Junction PK + nested related data that only has the related PK → empty
    if (
        keys.length === 2 &&
        keys.includes(junctionPKField) &&
        keys.includes(junctionFieldName)
    ) {
        const nested = item[junctionFieldName];
        if (nested && typeof nested === 'object') {
            const nestedKeys = Object.keys(nested as Record<string, unknown>);
            return nestedKeys.length === 1 && nestedKeys[0] === relatedPKField;
        }
    }

    return false;
}

// ── Hook ───────────────────────────────────────────────────────────

/**
 * Hook for managing M2M relationship items with local-first state.
 *
 * @param relationInfo - Resolved M2MRelationInfo (null while loading)
 * @param parentPrimaryKey - Primary key of the parent item (null or '+' for new)
 */
export function useRelationMultipleM2M(
    relationInfo: M2MRelationInfo | null,
    parentPrimaryKey: string | number | null,
) {
    // ── server state ────────────────────────────────────────────────
    const [fetchedItems, setFetchedItems] = useState<M2MDisplayItem[]>([]);
    const [existingItemCount, setExistingItemCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── local-first changes ─────────────────────────────────────────
    const [changes, setChanges] = useState<M2MChangesItem>({
        create: [],
        update: [],
        delete: [],
    });

    // Helper field names
    const junctionPKField = relationInfo?.junctionPrimaryKeyField?.field ?? 'id';
    const junctionFieldName = relationInfo?.junctionField?.field ?? '';
    const relatedPKField = relationInfo?.relatedPrimaryKeyField?.field ?? 'id';

    // ── Load items from server ──────────────────────────────────────
    const requestIdRef = useRef(0);

    const loadItems = useCallback(async (params: M2MMultipleQueryParams) => {
        const requestId = ++requestIdRef.current;

        if (!relationInfo || isNewItem(parentPrimaryKey)) {
            setFetchedItems([]);
            setExistingItemCount(0);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const reverseJunctionField = relationInfo.reverseJunctionField.field;

            // Build fields set — ensure required junction fields are included
            const fields = new Set(params.fields);
            fields.add(junctionPKField);
            fields.add(`${junctionFieldName}.${relatedPKField}`);
            if (relationInfo.sortField) fields.add(relationInfo.sortField);

            // Build filter
            const filter: Record<string, unknown> = {
                _and: [
                    { [reverseJunctionField]: { _eq: parentPrimaryKey } },
                    ...(params.filter ? [params.filter] : []),
                ],
            };

            const queryParams = new URLSearchParams({
                fields: Array.from(fields).join(','),
                filter: JSON.stringify(filter),
                limit: String(params.limit),
                page: String(params.page),
                meta: 'total_count,filter_count',
            });

            if (params.search) {
                queryParams.set('search', params.search);
            }

            if (params.sort) {
                queryParams.set('sort', params.sort);
            } else if (relationInfo.sortField) {
                queryParams.set('sort', relationInfo.sortField);
            }

            const response = await apiRequest<{
                data: M2MDisplayItem[];
                meta?: { total_count?: number; filter_count?: number };
            } | M2MDisplayItem[]>(
                `/api/items/${relationInfo.junctionCollection.collection}?${queryParams}`,
            );

            let items: M2MDisplayItem[];
            let total = 0;

            if (Array.isArray(response)) {
                items = response;
                total = response.length;
            } else {
                items = response.data || [];
                total = response.meta?.total_count ?? response.meta?.filter_count ?? items.length;
            }

            if (requestIdRef.current !== requestId) return; // superseded by a newer call

            setFetchedItems(items);
            setExistingItemCount(total);
        } catch (err) {
            if (requestIdRef.current !== requestId) return;
            const errorMessage = err instanceof Error ? err.message : 'Failed to load related items';
            setError(errorMessage);
            setFetchedItems([]);
            setExistingItemCount(0);
        } finally {
            if (requestIdRef.current === requestId) setLoading(false);
        }
    }, [relationInfo, parentPrimaryKey, junctionPKField, junctionFieldName, relatedPKField]);

    // ── displayItems: merge fetched + local changes ─────────────────

    const displayItems: M2MDisplayItem[] = useMemo(() => {
        if (!relationInfo) return [];

        // 1. Map fetched items, overlaying any local updates / deletes
        const items: M2MDisplayItem[] = fetchedItems.map((item) => {
            const pk = item[junctionPKField];
            let result: M2MDisplayItem = { ...item };

            // Check for local update
            const updateIdx = changes.update.findIndex(
                u => u[junctionPKField] === pk,
            );
            if (updateIdx !== -1) {
                const edits = changes.update[updateIdx];
                // Deep-merge junction field (nested related item data)
                if (
                    edits[junctionFieldName] &&
                    typeof edits[junctionFieldName] === 'object' &&
                    typeof result[junctionFieldName] === 'object'
                ) {
                    result = {
                        ...result,
                        ...edits,
                        [junctionFieldName]: {
                            ...(result[junctionFieldName] as Record<string, unknown>),
                            ...(edits[junctionFieldName] as Record<string, unknown>),
                        },
                    };
                } else {
                    result = { ...result, ...edits };
                }
                result.$type = 'updated';
                result.$index = updateIdx;
                result.$edits = updateIdx;
            }

            // Check for local delete
            const deleteIdx = changes.delete.findIndex(id => id === pk);
            if (deleteIdx !== -1) {
                result.$type = 'deleted';
                result.$index = deleteIdx;
                if (updateIdx !== -1) {
                    result.$edits = updateIdx;
                }
            }

            return result;
        });

        // 2. Append locally-created items (not yet on server)
        //    For M2M: filter out items that have reverseJunctionField set
        //    (those are "selected" items that reference existing related items)
        const createdItems: M2MDisplayItem[] = changes.create.map((item, index) => ({
            ...item,
            id: (item[junctionPKField] as string | number) ?? `$new-${index}`,
            $type: 'created' as const,
            $index: index,
        }));

        items.push(...createdItems);

        return items;
    }, [fetchedItems, changes, relationInfo, junctionPKField, junctionFieldName]);

    // Total count including local creates, minus local deletes
    const totalCount = useMemo(() => {
        return existingItemCount + changes.create.length - changes.delete.length;
    }, [existingItemCount, changes.create.length, changes.delete.length]);

    // ── local-first CRUD actions ────────────────────────────────────

    /**
     * Stage creation of a brand-new related item AND its junction row.
     * Called after the user fills out a CollectionForm for a new item.
     * The nested item object will be deep-created by DaaS on save.
     */
    const createItem = useCallback((
        relatedItemData: Record<string, unknown>,
        additionalJunctionData?: Record<string, unknown>,
    ): void => {
        if (!relationInfo) return;

        const junctionData: Record<string, unknown> = {
            [junctionFieldName]: relatedItemData,
            ...additionalJunctionData,
        };

        // Auto-assign sort value
        if (relationInfo.sortField) {
            const sortKey = relationInfo.sortField;
            const maxSort = [...fetchedItems, ...changes.create.map((c, i) => ({
                ...c,
                $type: 'created' as const,
                $index: i,
            }))].reduce((max, item) => {
                const sortVal = (item as Record<string, unknown>)[sortKey];
                return typeof sortVal === 'number' && sortVal > max ? sortVal : max;
            }, 0);
            junctionData[sortKey] = maxSort + 1;
        }

        setChanges(prev => ({
            ...prev,
            create: [...prev.create, cleanItem(junctionData)],
        }));
    }, [relationInfo, junctionFieldName, fetchedItems, changes.create]);

    /**
     * Stage selection of existing items from the related collection.
     * Creates one junction create-entry per selected ID.
     */
    const selectItems = useCallback((
        selectedIds: (string | number)[],
    ): void => {
        if (!relationInfo) return;

        const newEntries = selectedIds.map((id) => {
            const entry: Record<string, unknown> = {
                [junctionFieldName]: {
                    [relatedPKField]: id,
                },
            };

            // Auto-assign sort value
            if (relationInfo.sortField) {
                const sortKey = relationInfo.sortField;
                const allVisible = [...fetchedItems, ...changes.create.map((c, i) => ({
                    ...c,
                    id: ((c as Record<string, unknown>)[junctionPKField] as string | number) ?? `$new-${i}`,
                }))].filter(i => {
                    const pk = (i as Record<string, unknown>)[junctionPKField] ?? i.id;
                    return !changes.delete.includes(pk as string | number);
                });
                const maxSort = allVisible.reduce((max, item) => {
                    const sortVal = (item as Record<string, unknown>)[sortKey];
                    return typeof sortVal === 'number' && sortVal > max ? sortVal : max;
                }, 0);
                entry[sortKey] = maxSort + 1;
            }

            return cleanItem(entry);
        });

        setChanges(prev => ({
            ...prev,
            create: [...prev.create, ...newEntries],
        }));
    }, [relationInfo, junctionFieldName, relatedPKField, junctionPKField, fetchedItems, changes]);

    /**
     * Stage removal (unlink) of a junction item.
     * - If the item was locally created, splice it from the create array.
     * - If it's already deleted, undo by removing from delete array.
     * - Otherwise, add its PK to the delete array.
     */
    const removeItem = useCallback((item: M2MDisplayItem): void => {
        if (!relationInfo) return;

        if (item.$type === 'created' && item.$index !== undefined) {
            // Remove from local create array
            setChanges(prev => ({
                ...prev,
                create: prev.create.filter((_, idx) => idx !== item.$index),
            }));
        } else if (item.$type === 'deleted' && item.$index !== undefined) {
            // Undo delete
            setChanges(prev => ({
                ...prev,
                delete: prev.delete.filter((_, idx) => idx !== item.$index),
            }));
        } else {
            // Mark existing item for deletion
            const pk = item[junctionPKField];
            if (pk === undefined) return;
            setChanges(prev => ({
                ...prev,
                delete: [...prev.delete, pk as string | number],
            }));
        }
    }, [relationInfo, junctionPKField]);

    /**
     * Stage an update to an existing or locally-created junction item.
     * For M2M, edits to the related item are nested under the junctionField key.
     */
    const updateItem = useCallback((
        item: M2MDisplayItem,
        edits: Record<string, unknown>,
    ): void => {
        if (!relationInfo) return;

        if (item.$type === 'created' && item.$index !== undefined) {
            // Update local create entry in-place
            setChanges(prev => {
                const newCreate = [...prev.create];
                const existing = newCreate[item.$index!];
                if (
                    edits[junctionFieldName] &&
                    typeof edits[junctionFieldName] === 'object' &&
                    typeof existing[junctionFieldName] === 'object'
                ) {
                    newCreate[item.$index!] = {
                        ...existing,
                        ...edits,
                        [junctionFieldName]: {
                            ...(existing[junctionFieldName] as Record<string, unknown>),
                            ...(edits[junctionFieldName] as Record<string, unknown>),
                        },
                    };
                } else {
                    newCreate[item.$index!] = { ...existing, ...edits };
                }
                return { ...prev, create: newCreate };
            });
        } else {
            // Stage update for a fetched item
            const pk = item[junctionPKField];
            if (pk === undefined) return;

            setChanges(prev => {
                const existingIdx = prev.update.findIndex(u => u[junctionPKField] === pk);
                const updateEntry = { [junctionPKField]: pk, ...edits };

                if (existingIdx !== -1) {
                    // Merge into existing update
                    const newUpdate = [...prev.update];
                    const existing = newUpdate[existingIdx];
                    if (
                        edits[junctionFieldName] &&
                        typeof edits[junctionFieldName] === 'object' &&
                        typeof existing[junctionFieldName] === 'object'
                    ) {
                        newUpdate[existingIdx] = {
                            ...existing,
                            ...edits,
                            [junctionFieldName]: {
                                ...(existing[junctionFieldName] as Record<string, unknown>),
                                ...(edits[junctionFieldName] as Record<string, unknown>),
                            },
                        };
                    } else {
                        newUpdate[existingIdx] = { ...existing, ...edits };
                    }

                    // If the update is now empty, remove it
                    if (isEmptyM2MEdits(
                        newUpdate[existingIdx],
                        junctionPKField,
                        junctionFieldName,
                        relatedPKField,
                    )) {
                        newUpdate.splice(existingIdx, 1);
                    }

                    return { ...prev, update: newUpdate };
                }

                return { ...prev, update: [...prev.update, updateEntry] };
            });
        }
    }, [relationInfo, junctionPKField, junctionFieldName, relatedPKField]);

    /**
     * Reorder all visible items by updating their sort fields locally.
     *
     * `reorderedItems` is only the *current page's* items (both `displayItems`
     * here and the caller's `visibleItems` are built from `fetchedItems`,
     * which is itself a single paginated fetch) — so numbering positions
     * `1..reorderedItems.length` assigns page-local sort values. Pass
     * `pageOffset` (e.g. `(currentPage - 1) * limit`) so multi-page lists
     * get globally-unique sorts instead of every page colliding on 1..N.
     */
    const reorderItems = useCallback((reorderedItems: M2MDisplayItem[], pageOffset = 0): void => {
        if (!relationInfo?.sortField) return;
        const sortKey = relationInfo.sortField;

        setChanges(prev => {
            const newCreate = [...prev.create];
            const newUpdate = [...prev.update];

            for (let i = 0; i < reorderedItems.length; i++) {
                const item = reorderedItems[i];
                const newSort = pageOffset + i + 1;
                const currentSort = item[sortKey] as number | undefined;

                if (currentSort === newSort) continue;

                if (item.$type === 'created' && item.$index !== undefined) {
                    newCreate[item.$index] = { ...newCreate[item.$index], [sortKey]: newSort };
                } else {
                    const pk = item[junctionPKField];
                    if (pk === undefined) continue;

                    const existingIdx = newUpdate.findIndex(u => u[junctionPKField] === pk);
                    if (existingIdx !== -1) {
                        newUpdate[existingIdx] = { ...newUpdate[existingIdx], [sortKey]: newSort };
                    } else {
                        newUpdate.push({ [junctionPKField]: pk, [sortKey]: newSort });
                    }
                }
            }

            return { ...prev, create: newCreate, update: newUpdate };
        });
    }, [relationInfo, junctionPKField]);

    /** Move item up in the visible list (`pageOffset`: see reorderItems) */
    const moveItemUp = useCallback((index: number, pageOffset = 0): void => {
        if (index <= 0 || !relationInfo?.sortField) return;
        const visible = displayItems.filter(i => i.$type !== 'deleted');
        if (index >= visible.length) return;
        const reordered = [...visible];
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        reorderItems(reordered, pageOffset);
    }, [displayItems, relationInfo, reorderItems]);

    /** Move item down in the visible list (`pageOffset`: see reorderItems) */
    const moveItemDown = useCallback((index: number, pageOffset = 0): void => {
        if (!relationInfo?.sortField) return;
        const visible = displayItems.filter(i => i.$type !== 'deleted');
        if (index >= visible.length - 1) return;
        const reordered = [...visible];
        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        reorderItems(reordered, pageOffset);
    }, [displayItems, relationInfo, reorderItems]);

    /**
     * Get IDs of currently-linked related items (for filtering selection modal).
     * Includes fetched items (minus deleted) and locally created items.
     */
    const getSelectedRelatedPKs = useCallback((): (string | number)[] => {
        if (!relationInfo) return [];

        const pks: (string | number)[] = [];

        // From fetched items (exclude deleted)
        for (const item of fetchedItems) {
            const pk = item[junctionPKField];
            if (changes.delete.includes(pk as string | number)) continue;

            const nested = item[junctionFieldName];
            if (nested && typeof nested === 'object') {
                const relatedPK = (nested as Record<string, unknown>)[relatedPKField];
                if (relatedPK !== undefined) {
                    pks.push(relatedPK as string | number);
                }
            }
        }

        // From locally created items
        for (const item of changes.create) {
            const nested = item[junctionFieldName];
            if (nested && typeof nested === 'object') {
                const relatedPK = (nested as Record<string, unknown>)[relatedPKField];
                if (relatedPK !== undefined) {
                    pks.push(relatedPK as string | number);
                }
            }
        }

        return pks;
    }, [fetchedItems, changes, relationInfo, junctionPKField, junctionFieldName, relatedPKField]);

    /** Return the current local changes for the parent form save payload */
    const getChanges = useCallback((): M2MChangesItem => {
        return { ...changes };
    }, [changes]);

    /** Check if there are any unsaved local changes */
    const hasChanges = useMemo((): boolean => {
        return changes.create.length > 0 || changes.update.length > 0 || changes.delete.length > 0;
    }, [changes]);

    /** Reset local changes (e.g. after a successful save) */
    const resetChanges = useCallback((): void => {
        setChanges({ create: [], update: [], delete: [] });
    }, []);

    /** Replace all local changes (e.g. from external state) */
    const setLocalChanges = useCallback((newChanges: M2MChangesItem): void => {
        setChanges(newChanges);
    }, []);

    return {
        /** Merged display items (fetched + local changes) */
        displayItems,
        /** Raw items from server (no local changes applied) */
        fetchedItems,
        /** Total count accounting for local creates/deletes */
        totalCount,
        /** Whether items are being fetched */
        loading,
        /** Error message if any */
        error,
        /** Fetch items from the server */
        loadItems,
        /** Stage creation of a new related item with data */
        createItem,
        /** Stage selection of existing related items */
        selectItems,
        /** Stage removal/unlink (or undo) */
        removeItem,
        /** Stage an update to junction/related data */
        updateItem,
        /** Reorder all visible items by sort field */
        reorderItems,
        /** Swap item with previous in sort order */
        moveItemUp,
        /** Swap item with next in sort order */
        moveItemDown,
        /** Get IDs of related items currently linked */
        getSelectedRelatedPKs,
        /** Get the ChangesItem for parent save payload */
        getChanges,
        /** Whether there are unsaved local changes */
        hasChanges,
        /** Clear all local changes */
        resetChanges,
        /** Replace local changes from external state */
        setLocalChanges,
        /** Raw changes state */
        changes,
    };
}

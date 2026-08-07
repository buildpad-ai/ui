import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { apiRequest } from '@buildpad/services';
import { isNewItem } from '@buildpad/utils';

interface CollectionMeta {
    display_template?: string;
    icon?: string;
    singleton?: boolean;
    [key: string]: unknown;
}

interface CollectionInfo {
    collection: string;
    meta?: CollectionMeta;
    name?: string;
    icon?: string;
}

interface FieldMeta {
    interface?: string;
    options?: Record<string, unknown>;
    [key: string]: unknown;
}

interface FieldInfo {
    field: string;
    type?: string;
    meta?: FieldMeta;
    schema?: {
        is_primary_key?: boolean;
        [key: string]: unknown;
    };
}

/**
 * Detect the actual primary key field for each collection by querying its fields.
 * Falls back to { field: 'id', type: 'uuid' } if detection fails.
 */
async function detectPrimaryKeyFields(
    collectionNames: string[],
): Promise<Record<string, { field: string; type: string }>> {
    const result: Record<string, { field: string; type: string }> = {};

    await Promise.all(
        collectionNames.map(async (name) => {
            try {
                const response = await apiRequest<{ data: FieldInfo[] } | FieldInfo[]>(`/api/fields/${name}`);
                const fields: FieldInfo[] = Array.isArray(response) ? response : ((response as { data: FieldInfo[] }).data ?? []);

                const pkField = fields.find(
                    (f) => f.schema?.is_primary_key === true,
                );
                if (pkField) {
                    result[name] = { field: pkField.field, type: pkField.type || 'uuid' };
                } else {
                    // fallback: look for a field named 'id'
                    const idField = fields.find((f) => f.field === 'id');
                    result[name] = {
                        field: idField?.field || 'id',
                        type: idField?.type || 'uuid',
                    };
                }
            } catch {
                result[name] = { field: 'id', type: 'uuid' };
            }
        }),
    );

    return result;
}

interface RelationMeta {
    id?: number;
    one_field?: string | null;
    one_collection?: string | null;
    one_allowed_collections?: string[] | null;
    many_collection?: string;
    many_field?: string;
    junction_field?: string | null;
    sort_field?: string | null;
    one_deselect_action?: string;
    [key: string]: unknown;
}

interface Relation {
    collection?: string;
    field?: string;
    related_collection?: string | null;
    meta?: RelationMeta;
    schema?: {
        table?: string;
        column?: string;
        foreign_key_table?: string;
        foreign_key_column?: string;
        constraint_name?: string | null;
        on_update?: string;
        on_delete?: string;
    };
    // DaaS flat format (top-level properties)
    many_collection?: string;
    many_field?: string;
    one_collection?: string | null;
    one_field?: string | null;
    one_allowed_collections?: string | string[] | null;
    junction_field?: string | null;
    sort_field?: string | null;
}

/**
 * M2A Relation Info - Many-to-Any relationship metadata
 * 
 * M2A is like M2M but can link to MULTIPLE different collections.
 * 
 * Structure:
 * Parent Collection      Junction Table                    Related Collections (Any)
 * ┌─────────────┐        ┌──────────────────────────┐      ┌───────────────┐
 * │id           ├──┐     │id: junctionPKField       │  ┌───┤ Collection A  │
 * │m2a_field    │  └────►│parent_id: reverseJunction│  │   └───────────────┘
 * └─────────────┘        │collection: collectionField├──┤   ┌───────────────┐
 *                        │item: junctionField        │  ├───┤ Collection B  │
 *                        │sort: sortField            │  │   └───────────────┘
 *                        └──────────────────────────┘  │   ┌───────────────┐
 *                                                      └───┤ Collection C  │
 *                                                          └───────────────┘
 */
export interface M2ARelationInfo {
    /** Junction collection info */
    junctionCollection: {
        collection: string;
        meta?: CollectionMeta;
    };
    /** All allowed related collections */
    allowedCollections: CollectionInfo[];
    /** Field in junction table that stores the collection name */
    collectionField: {
        field: string;
        type: string;
    };
    /** Field in junction table that stores the related item ID/key */
    junctionField: {
        field: string;
        type: string;
    };
    /** Field in junction table that points to parent collection */
    reverseJunctionField: {
        field: string;
        type: string;
    };
    /** Primary key field of junction collection */
    junctionPrimaryKeyField: {
        field: string;
        type: string;
    };
    /** Primary key fields of each allowed collection */
    relationPrimaryKeyFields: Record<string, {
        field: string;
        type: string;
    }>;
    /** Sort field for ordering (optional) */
    sortField?: string;
    /** The relation metadata from junction to parent */
    relation: {
        field: string;
        collection: string;
        meta?: RelationMeta;
    };
}

/**
 * Custom hook for managing M2A (Many-to-Any) relationship information
 * 
 * Follows DaaS useRelationM2A composable pattern.
 * 
 * M2A allows linking to multiple different collections through a junction table
 * that stores both the collection name and item ID.
 */
export function useRelationM2A(collection: string, field: string) {
    const [relationInfo, setRelationInfo] = useState<M2ARelationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadRelationInfo = async () => {
            if (!collection || !field) {
                setRelationInfo(null);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Get field info to verify it's a list-m2a interface
                const fieldResponse = await apiRequest<{ data: FieldInfo[] } | FieldInfo[]>(`/api/fields/${collection}`);
                const fieldInfo = Array.isArray(fieldResponse) ? fieldResponse : (fieldResponse.data || []);
                const currentField = fieldInfo.find((f: FieldInfo) => f.field === field);

                if (!currentField) {
                    setError(`Field "${field}" not found in collection "${collection}"`);
                    setRelationInfo(null);
                    setLoading(false);
                    return;
                }

                // Check interface from meta (DaaS format) or top-level (DaaS flat format)
                const fieldInterface = currentField.meta?.interface || (currentField as unknown as Record<string, unknown>).interface;
                if (fieldInterface !== 'list-m2a') {
                    setError(`Field "${field}" is not configured as a list-m2a interface`);
                    setRelationInfo(null);
                    setLoading(false);
                    return;
                }

                // Get all relations from API
                const relationsResponse = await apiRequest<{ data: Relation[] } | Relation[]>('/api/relations');
                const relations = Array.isArray(relationsResponse) ? relationsResponse : (relationsResponse.data || []);

                // Get all collections for metadata
                const collectionsResponse = await apiRequest<{ data: CollectionInfo[] } | CollectionInfo[]>('/api/collections');
                const collections = Array.isArray(collectionsResponse) ? collectionsResponse : (collectionsResponse.data || []);

                // ============================================================
                // M2A Relation Discovery (two-step, following DaaS pattern)
                // ============================================================
                // M2A uses TWO relations on the junction table:
                //   1. O2M "junction" relation: links parent → junction (has junction_field, sort_field)
                //   2. M2A "companion" relation: links junction → any allowed collection (has one_allowed_collections)
                //
                // Step 1: Find the O2M junction relation
                // Step 2: Follow junction_field to find the M2A companion
                // Step 3: Get one_allowed_collections from the companion

                // Helper to read a property from either top-level (DaaS flat) or meta (DaaS nested)
                const getRelProp = (rel: Relation, prop: string): unknown =>
                    (rel as Record<string, unknown>)[prop] ?? (rel.meta as Record<string, unknown> | undefined)?.[prop];

                // --- Step 1: Find the O2M junction relation ---
                // DaaS format: related_collection=parent, meta.one_field=alias, meta.junction_field defined
                // DaaS flat format: one_collection=parent, one_field=alias, junction_field defined
                let junctionRel = relations.find((rel: Relation) =>
                    rel.related_collection === collection &&
                    rel.meta?.one_field === field &&
                    rel.meta?.junction_field
                );

                // Fallback: DaaS format using meta.one_collection instead of related_collection
                if (!junctionRel) {
                    junctionRel = relations.find((rel: Relation) =>
                        rel.meta?.one_collection === collection &&
                        rel.meta?.one_field === field &&
                        rel.meta?.junction_field
                    );
                }

                // Fallback: DaaS flat format (properties at top level, not nested in meta)
                if (!junctionRel) {
                    junctionRel = relations.find((rel: Relation) =>
                        (rel.one_collection === collection) &&
                        (rel.one_field === field) &&
                        (rel.junction_field != null)
                    );
                }

                // --- Step 2: Find the M2A companion relation ---
                if (junctionRel) {
                    const junctionCollectionName = (junctionRel.collection || junctionRel.many_collection) as string | undefined;
                    const junctionFieldName = (getRelProp(junctionRel, 'junction_field') || 'item') as string;

                    // The companion relation is on the same junction collection, where field === junction_field
                    const companionRel = junctionCollectionName ? relations.find((rel: Relation) => {
                        const relCollection = rel.collection || rel.many_collection;
                        const relField = rel.field || rel.many_field;
                        return relCollection === junctionCollectionName &&
                               relField === junctionFieldName &&
                               rel !== junctionRel;
                    }) : undefined;

                    if (companionRel && junctionCollectionName) {
                        // --- Step 3: Extract one_allowed_collections from companion ---
                        let allowedNames: string[] = [];
                        const rawAllowed = getRelProp(companionRel, 'one_allowed_collections');
                        if (Array.isArray(rawAllowed)) {
                            allowedNames = rawAllowed;
                        } else if (typeof rawAllowed === 'string') {
                            const trimmed = rawAllowed.trim();
                            if (trimmed.startsWith('[')) {
                                try { allowedNames = JSON.parse(trimmed); } catch { allowedNames = []; }
                            } else {
                                // CSV format: "col1,col2"
                                allowedNames = trimmed.split(',').map(s => s.trim()).filter(Boolean);
                            }
                        }
                        // Defensive: strip any stray brackets/quotes from each name
                        // (handles case where DaaS backend split JSON array by comma incorrectly)
                        allowedNames = allowedNames.map(n => n.replace(/^[\["]+|["\]]+$/g, '').trim()).filter(Boolean);

                        if (allowedNames.length > 0) {
                            // Determine field names from the two relations
                            const collectionFieldName = (getRelProp(companionRel, 'one_collection_field') as string) || 'collection';
                            const itemFieldName = (companionRel.field || companionRel.many_field || junctionFieldName) as string;
                            const reverseJunctionFieldName = (junctionRel.field || junctionRel.many_field || `${collection}_id`) as string;
                            const sortFieldName = (getRelProp(junctionRel, 'sort_field') || getRelProp(companionRel, 'sort_field') || undefined) as string | undefined;

                            // Build allowed collections info
                            const allowedCollections: CollectionInfo[] = allowedNames
                                .map((name: string) => {
                                    const collInfo = collections.find((c: CollectionInfo) => c.collection === name);
                                    return {
                                        collection: name,
                                        meta: collInfo?.meta || {},
                                        name: collInfo?.meta?.display_template || name,
                                        icon: collInfo?.meta?.icon || 'box',
                                    };
                                })
                                .filter((c: CollectionInfo) => c.meta?.singleton !== true);

                            // Detect actual PK fields for allowed collections
                            const relationPrimaryKeyFields = await detectPrimaryKeyFields(allowedNames);

                            const info: M2ARelationInfo = {
                                junctionCollection: {
                                    collection: junctionCollectionName,
                                    meta: {},
                                },
                                allowedCollections,
                                collectionField: {
                                    field: collectionFieldName,
                                    type: 'string',
                                },
                                junctionField: {
                                    field: itemFieldName,
                                    type: 'uuid',
                                },
                                reverseJunctionField: {
                                    field: reverseJunctionFieldName,
                                    type: 'uuid',
                                },
                                junctionPrimaryKeyField: {
                                    field: 'id',
                                    type: 'integer',
                                },
                                relationPrimaryKeyFields,
                                sortField: sortFieldName,
                                relation: {
                                    field: reverseJunctionFieldName,
                                    collection: junctionCollectionName,
                                    meta: junctionRel.meta || {},
                                },
                            };

                            setRelationInfo(info);
                            setLoading(false);
                            return;
                        }
                    }
                }

                // FALLBACK: Try to build from field options (when relation API doesn't provide enough data)
                {
                    const options = (currentField.meta?.options || (currentField as unknown as Record<string, unknown>).options) as Record<string, unknown> | undefined;

                    // Support both camelCase (allowedCollections) and snake_case (allowed_collections)
                    const allowedCollectionNames = (
                        options?.allowedCollections || 
                        options?.allowed_collections
                    ) as string[] | undefined;
                    
                    // Junction collection can be explicit or inferred from convention: {collection}_{field} or {collection}_m2a
                    const junctionCollectionFb = (
                        options?.junction_collection ||
                        options?.junctionCollection ||
                        `${collection}_m2a`  // Default convention for M2A junction tables
                    ) as string;

                    if (allowedCollectionNames && allowedCollectionNames.length > 0) {
                        const collectionFieldName = (options?.collection_field as string) || (options?.collectionField as string) || 'collection';
                        const junctionFieldName = (options?.junction_field as string) || (options?.junctionField as string) || 'item';
                        const reverseJunctionFieldName = (options?.reverse_junction_field as string) || (options?.reverseJunctionField as string) || `${collection}_id`;
                        const sortFieldName = (options?.sort_field as string) || (options?.sortField as string) || undefined;

                        // Build allowed collections info
                        const allowedCollections: CollectionInfo[] = allowedCollectionNames
                            .map(name => {
                                const collInfo = collections.find((c: CollectionInfo) => c.collection === name);
                                return {
                                    collection: name,
                                    meta: collInfo?.meta || {},
                                    name: collInfo?.meta?.display_template || name,
                                    icon: collInfo?.meta?.icon || 'box',
                                };
                            })
                            .filter(c => c.meta?.singleton !== true); // Exclude singletons

                        // Detect actual PK fields for allowed collections
                        const relationPrimaryKeyFields = await detectPrimaryKeyFields(allowedCollectionNames);

                        const info: M2ARelationInfo = {
                            junctionCollection: {
                                collection: junctionCollectionFb,
                                meta: {},
                            },
                            allowedCollections,
                            collectionField: {
                                field: collectionFieldName,
                                type: 'string',
                            },
                            junctionField: {
                                field: junctionFieldName,
                                type: 'uuid',
                            },
                            reverseJunctionField: {
                                field: reverseJunctionFieldName,
                                type: 'uuid',
                            },
                            junctionPrimaryKeyField: {
                                field: 'id',
                                type: 'integer',
                            },
                            relationPrimaryKeyFields,
                            sortField: sortFieldName,
                            relation: {
                                field: reverseJunctionFieldName,
                                collection: junctionCollectionFb,
                                meta: {},
                            },
                        };

                        setRelationInfo(info);
                        setLoading(false);
                        return;
                    }

                    console.error('M2A junction relation not found for', collection, field);
                    console.error('Field options:', currentField.meta?.options);
                    setError(`M2A relationship not configured. No junction relation found for field "${field}".`);
                    setRelationInfo(null);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load relationship configuration';
                console.error('Error loading M2A relation:', err);
                setError(errorMessage);
                setRelationInfo(null);
                notifications.show({
                    title: 'Error',
                    message: 'Failed to load M2A relationship configuration',
                    color: 'red',
                });
            } finally {
                setLoading(false);
            }
        };

        loadRelationInfo();
    }, [collection, field]);

    return {
        relationInfo,
        loading,
        error,
    };
}

/**
 * M2A Item - a junction item in a Many-to-Any relationship
 */
export interface M2AItem {
    /** Primary key of the junction item */
    id: string | number;
    /** The collection name of the related item */
    collection?: string;
    /** The related item (nested data) or ID */
    item?: Record<string, unknown> | string | number;
    /** Sort order */
    sort?: number;
    /** Index within the local changes array (create/update/delete) */
    $index?: number;
    /** Item type marker: created/updated/deleted for local-first tracking */
    $type?: 'created' | 'updated' | 'deleted';
    /** Index into the update array when an item is both edited and deleted */
    $edits?: number;
    /** Any other fields from the junction row */
    [key: string]: unknown;
}

/**
 * Local-first changes structure following DaaS ChangesItem pattern.
 * All mutations are staged locally until the parent form saves.
 */
export interface ChangesItem {
    /** New junction rows to create on save */
    create: Record<string, unknown>[];
    /** Existing junction rows with edits to PATCH on save */
    update: Record<string, unknown>[];
    /** Junction primary keys to DELETE on save */
    delete: (string | number)[];
}

/**
 * Query parameters for loading M2A items
 */
export interface M2AQueryParams {
    limit?: number;
    page?: number;
    search?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    fields?: string[];
    filter?: Record<string, unknown>;
}

// ── helpers ─────────────────────────────────────────────────────────

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

/** Check whether a cleaned item is effectively empty (only has the PK) */
function isEmptyEdits(item: Record<string, unknown>, pkField: string): boolean {
    const keys = Object.keys(item).filter(k => k !== pkField);
    return keys.length === 0;
}

/**
 * Custom hook for managing M2A relationship items with **local-first** state.
 *
 * Follows the DaaS `useRelationMultiple` ChangesItem pattern:
 * - All create / update / delete operations are staged locally in a
 *   `{create:[], update:[], delete:[]}` structure.
 * - Nothing is persisted until the consumer calls the parent form save,
 *   which reads `getChanges()` and POSTs the payload to the DaaS API.
 * - `displayItems` merges fetched server data with local changes so the
 *   UI always reflects the user's in-progress edits.
 */
export function useRelationM2AItems(
    relationInfo: M2ARelationInfo | null,
    parentPrimaryKey: string | number | null
) {
    // ── server state ────────────────────────────────────────────────
    const [fetchedItems, setFetchedItems] = useState<M2AItem[]>([]);
    const [existingItemCount, setExistingItemCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── local-first changes ─────────────────────────────────────────
    const [changes, setChanges] = useState<ChangesItem>({
        create: [],
        update: [],
        delete: [],
    });

    // Helper to get the junction PK field name
    const junctionPKField = relationInfo?.junctionPrimaryKeyField?.field ?? 'id';

    // ── load fetched items from server ──────────────────────────────
    const requestIdRef = useRef(0);

    const loadItems = useCallback(async (params?: M2AQueryParams) => {
        const requestId = ++requestIdRef.current;

        if (!relationInfo || isNewItem(parentPrimaryKey)) {
            setFetchedItems([]);
            setExistingItemCount(0);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const filter = {
                [relationInfo.reverseJunctionField.field]: {
                    _eq: parentPrimaryKey,
                },
            };

            // Fetch junction items with flat fields only.
            // NOTE: We do NOT use DaaS M2A colon syntax (e.g. "item:collection_name.*")
            // because the DaaS/Supabase backend does not support it.
            // Instead we fetch flat junction data, then resolve nested items manually.
            //
            // Always include essential junction columns (collection, item, FK, sort)
            // regardless of the `fields` prop, which is meant for display purposes only.
            const essentialJunctionFields = [
                relationInfo.collectionField.field,     // e.g. "collection"
                relationInfo.junctionField.field,       // e.g. "item"
                relationInfo.reverseJunctionField.field, // e.g. "test_m2a_pages_id"
                ...(relationInfo.sortField ? [relationInfo.sortField] : []),
            ];
            const requestedFields = params?.fields || ['*'];
            const fieldsToFetch = requestedFields.includes('*')
                ? ['*']
                : [...new Set([...requestedFields, ...essentialJunctionFields])];

            const queryParams = new URLSearchParams({
                filter: JSON.stringify(filter),
                fields: fieldsToFetch.join(','),
                limit: String(params?.limit || 15),
                page: String(params?.page || 1),
                meta: 'total_count,filter_count',
            });

            if (params?.sortField) {
                queryParams.set('sort', params.sortDirection === 'desc'
                    ? `-${params.sortField}`
                    : params.sortField);
            } else if (relationInfo.sortField) {
                queryParams.set('sort', relationInfo.sortField);
            }

            if (params?.search) {
                queryParams.set('search', params.search);
            }

            const data = await apiRequest<{ data: M2AItem[]; meta?: { total_count?: number; filter_count?: number } } | M2AItem[]>(
                `/api/items/${relationInfo.junctionCollection.collection}?${queryParams}`
            );

            let junctionItems: M2AItem[];
            let totalCount = 0;

            if (Array.isArray(data)) {
                junctionItems = data;
                totalCount = data.length;
            } else {
                junctionItems = data.data || [];
                totalCount = data.meta?.total_count || data.meta?.filter_count || junctionItems.length;
            }

            // Resolve nested item data from each allowed collection.
            // Group junction items by collection, then batch-fetch related items.
            const collectionField = relationInfo.collectionField.field;
            const itemField = relationInfo.junctionField.field;

            // Group item IDs by collection
            const idsByCollection = new Map<string, Set<string | number>>();
            for (const jItem of junctionItems) {
                const coll = jItem[collectionField] as string;
                const itemId = jItem[itemField] as string | number;
                if (coll && itemId) {
                    if (!idsByCollection.has(coll)) {
                        idsByCollection.set(coll, new Set());
                    }
                    idsByCollection.get(coll)!.add(itemId);
                }
            }

            // Fetch related items from each collection in parallel
            const relatedDataByCollection = new Map<string, Map<string | number, Record<string, unknown>>>();
            const fetchPromises = Array.from(idsByCollection.entries()).map(
                async ([coll, ids]) => {
                    try {
                        const idsArray = Array.from(ids);
                        // Detect primary key field for this collection
                        const pkField = relationInfo.relationPrimaryKeyFields[coll]?.field || 'id';
                        const filterParam = JSON.stringify({ [pkField]: { _in: idsArray } });
                        const relatedData = await apiRequest<{ data: Record<string, unknown>[] } | Record<string, unknown>[]>(
                            `/api/items/${coll}?filter=${encodeURIComponent(filterParam)}&fields=*&limit=${idsArray.length}`
                        );
                        const items = Array.isArray(relatedData) ? relatedData : (relatedData.data || []);
                        const itemMap = new Map<string | number, Record<string, unknown>>();
                        for (const item of items) {
                            const id = item[pkField] as string | number;
                            if (id != null) {
                                // Store under both the original type and its string
                                // representation so lookups work regardless of whether
                                // the junction `item` column returns a string or number.
                                itemMap.set(id, item);
                                itemMap.set(String(id), item);
                                if (typeof id === 'string' && !isNaN(Number(id))) {
                                    itemMap.set(Number(id), item);
                                }
                            }
                        }
                        relatedDataByCollection.set(coll, itemMap);
                    } catch (err) {
                        console.warn(`[M2A] Failed to fetch related items from ${coll}:`, err);
                    }
                }
            );
            await Promise.all(fetchPromises);

            // Merge nested item data into junction items
            const enrichedItems = junctionItems.map(jItem => {
                const coll = jItem[collectionField] as string;
                const itemId = jItem[itemField] as string | number;
                const collMap = relatedDataByCollection.get(coll);
                const nestedItem = collMap?.get(itemId) || collMap?.get(String(itemId));
                if (nestedItem) {
                    return { ...jItem, [itemField]: nestedItem };
                }
                return jItem;
            });

            if (requestIdRef.current !== requestId) return; // superseded by a newer call

            setFetchedItems(enrichedItems);
            setExistingItemCount(totalCount);
        } catch (err) {
            if (requestIdRef.current !== requestId) return;
            const errorMessage = err instanceof Error ? err.message : 'Failed to load related items';
            setError(errorMessage);
            setFetchedItems([]);
            setExistingItemCount(0);
            console.error('Error loading M2A items:', err);
        } finally {
            if (requestIdRef.current === requestId) setLoading(false);
        }
    }, [relationInfo, parentPrimaryKey]);

    // ── displayItems: merge fetched + local changes ─────────────────
    const displayItems: M2AItem[] = useMemo(() => {
        if (!relationInfo) return [];

        // 1. Map fetched items, overlaying any local updates / deletes
        const items: M2AItem[] = fetchedItems.map((item) => {
            const pk = item[junctionPKField];
            let result: M2AItem = { ...item };

            // Check for local update
            const updateIdx = changes.update.findIndex(
                u => u[junctionPKField] === pk
            );
            if (updateIdx !== -1) {
                const edits = changes.update[updateIdx];
                // Deep-merge junction field (nested related item data)
                const jfKey = relationInfo.junctionField.field;
                if (edits[jfKey] && typeof edits[jfKey] === 'object' && typeof result[jfKey] === 'object') {
                    result = {
                        ...result,
                        ...edits,
                        [jfKey]: { ...(result[jfKey] as Record<string, unknown>), ...(edits[jfKey] as Record<string, unknown>) },
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
                // Preserve $edits if also updated
                if (updateIdx !== -1) {
                    result.$edits = updateIdx;
                }
            }

            return result;
        });

        // 2. Append locally-created items (not yet on server)
        const createdItems: M2AItem[] = changes.create.map((item, index) => ({
            ...item,
            // Synthesise a temporary id so React has a stable key
            id: item[junctionPKField] as string | number ?? `$new-${index}`,
            $type: 'created' as const,
            $index: index,
        }));

        items.push(...createdItems);

        return items;
    }, [fetchedItems, changes, relationInfo, junctionPKField]);

    // Total count including local creates, minus local deletes
    const totalCount = useMemo(() => {
        return existingItemCount + changes.create.length - changes.delete.length;
    }, [existingItemCount, changes.create.length, changes.delete.length]);

    // ── local-first CRUD actions ────────────────────────────────────

    /**
     * Stage creation of a new junction item linking to `targetCollection`/`itemId`.
     * Nothing is persisted until the parent form saves.
     */
    const createItem = useCallback((
        targetCollection: string,
        itemId: string | number,
        additionalData?: Record<string, unknown>
    ): void => {
        if (!relationInfo) return;

        const pkField = relationInfo.relationPrimaryKeyFields[targetCollection]?.field || 'id';

        const junctionData: Record<string, unknown> = {
            [relationInfo.collectionField.field]: targetCollection,
            [relationInfo.junctionField.field]: {
                [pkField]: itemId,
            },
            ...additionalData,
        };

        // Auto-assign sort value to the end
        if (relationInfo.sortField) {
            const maxSort = displayItems.reduce((max, item) => {
                if (item.$type === 'deleted') return max;
                const sortVal = item[relationInfo.sortField!];
                return typeof sortVal === 'number' && sortVal > max ? sortVal : max;
            }, 0);
            junctionData[relationInfo.sortField] = maxSort + 1;
        }

        setChanges(prev => ({
            ...prev,
            create: [...prev.create, cleanItem(junctionData)],
        }));
    }, [relationInfo, displayItems]);

    /**
     * Stage creation of a brand-new related item *and* its junction row.
     * Called after the user fills out a CollectionForm for a new item.
     * The nested `item` object will be deep-created by DaaS on save.
     */
    const createItemWithData = useCallback((
        targetCollection: string,
        itemData: Record<string, unknown>,
        additionalData?: Record<string, unknown>
    ): void => {
        if (!relationInfo) return;

        const junctionData: Record<string, unknown> = {
            [relationInfo.collectionField.field]: targetCollection,
            [relationInfo.junctionField.field]: itemData,
            ...additionalData,
        };

        if (relationInfo.sortField) {
            const maxSort = displayItems.reduce((max, item) => {
                if (item.$type === 'deleted') return max;
                const sortVal = item[relationInfo.sortField!];
                return typeof sortVal === 'number' && sortVal > max ? sortVal : max;
            }, 0);
            junctionData[relationInfo.sortField] = maxSort + 1;
        }

        setChanges(prev => ({
            ...prev,
            create: [...prev.create, cleanItem(junctionData)],
        }));
    }, [relationInfo, displayItems]);

    /**
     * Stage removal (unlink) of a junction item.
     * - If the item was locally created, just splice it out of the create array.
     * - If it was fetched, add its PK to the delete array.
     * - If already deleted, "undo" by removing it from the delete array.
     */
    const removeItem = useCallback((item: M2AItem): void => {
        if (!relationInfo) return;

        if (item.$type === 'created' && item.$index !== undefined) {
            // Remove from local create array
            setChanges(prev => ({
                ...prev,
                create: prev.create.filter((_, idx) => idx !== item.$index),
            }));
        } else if (item.$type === 'deleted' && item.$index !== undefined) {
            // Undo delete – remove from delete array
            setChanges(prev => ({
                ...prev,
                delete: prev.delete.filter((_, idx) => idx !== item.$index),
            }));
        } else {
            // Mark existing (or updated) item for deletion
            const pk = item[junctionPKField];
            if (pk === undefined) return;
            setChanges(prev => ({
                ...prev,
                delete: [...prev.delete, pk as string | number],
            }));
        }
    }, [relationInfo, junctionPKField]);

    /**
     * Stage an update to an existing (fetched) or locally-created junction item.
     * For M2A, edits to the *related* item are nested under the junctionField key.
     */
    const updateItem = useCallback((item: M2AItem, edits: Record<string, unknown>): void => {
        if (!relationInfo) return;

        if (item.$type === 'created' && item.$index !== undefined) {
            // Update local create entry in-place
            setChanges(prev => {
                const newCreate = [...prev.create];
                const existing = newCreate[item.$index!];
                const jfKey = relationInfo.junctionField.field;
                if (edits[jfKey] && typeof edits[jfKey] === 'object' && typeof existing[jfKey] === 'object') {
                    newCreate[item.$index!] = {
                        ...existing,
                        ...edits,
                        [jfKey]: { ...(existing[jfKey] as Record<string, unknown>), ...(edits[jfKey] as Record<string, unknown>) },
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
                    const jfKey = relationInfo.junctionField.field;
                    if (edits[jfKey] && typeof edits[jfKey] === 'object' && typeof existing[jfKey] === 'object') {
                        newUpdate[existingIdx] = {
                            ...existing,
                            ...edits,
                            [jfKey]: { ...(existing[jfKey] as Record<string, unknown>), ...(edits[jfKey] as Record<string, unknown>) },
                        };
                    } else {
                        newUpdate[existingIdx] = { ...existing, ...edits };
                    }

                    // If the update is now empty, remove it
                    if (isEmptyEdits(newUpdate[existingIdx], junctionPKField)) {
                        newUpdate.splice(existingIdx, 1);
                    }

                    return { ...prev, update: newUpdate };
                }

                return { ...prev, update: [...prev.update, updateEntry] };
            });
        }
    }, [relationInfo, junctionPKField]);

    /**
     * Stage selection of existing items from a specific collection.
     * Creates one junction create-entry per selected ID.
     */
    const selectItems = useCallback((
        targetCollection: string,
        itemIds: (string | number)[]
    ): void => {
        if (!relationInfo) return;

        const pkField = relationInfo.relationPrimaryKeyFields[targetCollection]?.field || 'id';

        const newEntries = itemIds.map(id => {
            const entry: Record<string, unknown> = {
                [relationInfo.collectionField.field]: targetCollection,
                [relationInfo.junctionField.field]: {
                    [pkField]: id,
                },
            };

            if (relationInfo.sortField) {
                const allItems = displayItems.filter(i => i.$type !== 'deleted');
                const maxSort = allItems.reduce((max, item) => {
                    const sortVal = item[relationInfo.sortField!];
                    return typeof sortVal === 'number' && sortVal > max ? sortVal : max;
                }, 0);
                entry[relationInfo.sortField] = maxSort + 1;
            }

            return cleanItem(entry);
        });

        setChanges(prev => ({
            ...prev,
            create: [...prev.create, ...newEntries],
        }));
    }, [relationInfo, displayItems]);

    /**
     * Reorder all *visible* items by updating their sort fields locally.
     * Only items that actually change sort order get an update entry.
     */
    const reorderItems = useCallback((reorderedItems: M2AItem[]): void => {
        if (!relationInfo?.sortField) return;
        const sortKey = relationInfo.sortField;

        setChanges(prev => {
            const newCreate = [...prev.create];
            const newUpdate = [...prev.update];

            for (let i = 0; i < reorderedItems.length; i++) {
                const item = reorderedItems[i];
                const newSort = i + 1;
                const currentSort = item[sortKey] as number | undefined;

                // Skip if sort hasn't changed
                if (currentSort === newSort) continue;

                if (item.$type === 'created' && item.$index !== undefined) {
                    // Update sort on local create entry
                    newCreate[item.$index] = { ...newCreate[item.$index], [sortKey]: newSort };
                } else {
                    // Stage sort update for fetched item
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

    /**
     * Move item up in the visible list (swap with previous).
     */
    const moveItemUp = useCallback((index: number): void => {
        if (index <= 0 || !relationInfo?.sortField) return;
        const visible = displayItems.filter(i => i.$type !== 'deleted');
        if (index >= visible.length) return;
        const reordered = [...visible];
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        reorderItems(reordered);
    }, [displayItems, relationInfo, reorderItems]);

    /**
     * Move item down in the visible list (swap with next).
     */
    const moveItemDown = useCallback((index: number): void => {
        if (!relationInfo?.sortField) return;
        const visible = displayItems.filter(i => i.$type !== 'deleted');
        if (index >= visible.length - 1) return;
        const reordered = [...visible];
        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        reorderItems(reordered);
    }, [displayItems, relationInfo, reorderItems]);

    /**
     * Get IDs of currently-linked items grouped by collection.
     * Includes fetched items (minus deleted) and locally created items.
     * Used to filter out already-linked items in the select modal.
     */
    const getSelectedPrimaryKeysByCollection = useCallback((): Record<string, (string | number)[]> => {
        if (!relationInfo) return {};

        const result: Record<string, (string | number)[]> = {};
        const visibleItems = displayItems.filter(i => i.$type !== 'deleted');

        for (const item of visibleItems) {
            const collectionName = (item[relationInfo.collectionField.field] as string) || item.collection;
            if (!collectionName) continue;

            if (!result[collectionName]) {
                result[collectionName] = [];
            }

            const itemData = item[relationInfo.junctionField.field];
            if (typeof itemData === 'object' && itemData !== null) {
                const pkField = relationInfo.relationPrimaryKeyFields[collectionName]?.field || 'id';
                const pk = (itemData as Record<string, unknown>)[pkField];
                if (pk !== undefined) {
                    result[collectionName].push(pk as string | number);
                }
            } else if (itemData !== undefined) {
                result[collectionName].push(itemData as string | number);
            }
        }

        return result;
    }, [displayItems, relationInfo]);

    /**
     * Return the current local changes. The parent form/page reads this
     * to build the save payload for the DaaS API.
     */
    const getChanges = useCallback((): ChangesItem => {
        return { ...changes };
    }, [changes]);

    /**
     * Check if there are any unsaved local changes.
     */
    const hasChanges = useMemo((): boolean => {
        return changes.create.length > 0 || changes.update.length > 0 || changes.delete.length > 0;
    }, [changes]);

    /**
     * Reset local changes (e.g. after a successful save).
     */
    const resetChanges = useCallback((): void => {
        setChanges({ create: [], update: [], delete: [] });
    }, []);

    /**
     * Replace all local changes (used when parent form sets initial value
     * or when restoring from external state).
     */
    const setLocalChanges = useCallback((newChanges: ChangesItem): void => {
        setChanges(newChanges);
    }, []);

    return {
        /** Merged display items (fetched + local changes) */
        displayItems,
        /** Raw items from server (no local changes applied) */
        fetchedItems,
        /** Total count accounting for local creates/deletes */
        totalCount,
        loading,
        error,
        /** Fetch items from the server */
        loadItems,
        /** Stage a create (link existing item) – local only */
        createItem,
        /** Stage a create with inline related item data – local only */
        createItemWithData,
        /** Stage a remove/unlink or undo a delete – local only */
        removeItem,
        /** Stage an update to junction/related data – local only */
        updateItem,
        /** Stage selection of multiple existing items – local only */
        selectItems,
        /** Reorder all visible items by sort field – local only */
        reorderItems,
        /** Swap item with previous in sort order – local only */
        moveItemUp,
        /** Swap item with next in sort order – local only */
        moveItemDown,
        /** Get IDs currently linked, grouped by collection */
        getSelectedPrimaryKeysByCollection,
        /** Get the current ChangesItem for the parent save payload */
        getChanges,
        /** Whether there are unsaved local changes */
        hasChanges,
        /** Clear all local changes */
        resetChanges,
        /** Replace local changes from external state */
        setLocalChanges,
        /** Raw changes state (for controlled components) */
        changes,
    };
}

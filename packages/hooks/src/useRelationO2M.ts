import { FieldsService, apiRequest } from "@buildpad/services";
import type { Field } from "@buildpad/types";
import { useCallback, useEffect, useState } from "react";

/**
 * Resolve a collection's real primary key field (name + type), the same way
 * useRelationM2A's detectPrimaryKeyFields does. Falls back to `id`/`uuid`
 * when the schema can't be read or has no explicit PK, but no longer
 * *assumes* every related/parent collection uses `id` — some (e.g.
 * daas_scope_items.uri_path) don't.
 */
async function detectPrimaryKeyField(
  collection: string,
): Promise<{ field: string; type: string }> {
  try {
    const fieldsService = new FieldsService();
    const fields = await fieldsService.readAll(collection);
    const pkField = fields.find((f: Field) => f.schema?.is_primary_key === true);
    if (pkField) {
      return { field: pkField.field, type: pkField.type || "uuid" };
    }
    const idField = fields.find((f: Field) => f.field === "id");
    return { field: idField?.field || "id", type: idField?.type || "uuid" };
  } catch {
    return { field: "id", type: "uuid" };
  }
}

/**
 * Information about a One-to-Many relationship
 */
export interface O2MRelationInfo {
  /** The related collection (the "many" side) */
  relatedCollection: {
    collection: string;
    meta?: Record<string, unknown>;
  };
  /** The field in the related collection that points back to this collection (foreign key) */
  reverseJunctionField: {
    field: string;
    type: string;
  };
  /** Primary key field of the related collection */
  relatedPrimaryKeyField: {
    field: string;
    type: string;
  };
  /** Primary key field of the current (parent) collection */
  parentPrimaryKeyField: {
    field: string;
    type: string;
  };
  /** Sort field for ordering items (if configured) */
  sortField?: string;
  /** Display template for the related item */
  displayTemplate?: string;
  /** Action when deselecting items: 'nullify' (set FK to null) or 'delete' */
  oneDeselectAction?: "nullify" | "delete";
  /** Whether the related collection is a singleton */
  isSingleton?: boolean;
  /** Whether the FK field has a unique constraint (only 1 child allowed) */
  isForeignKeyUnique?: boolean;
  /** Relation metadata */
  relation: {
    field: string;
    collection: string;
    related_collection: string;
    meta?: Record<string, unknown> | null;
  };
}

/**
 * Custom hook for managing One-to-Many (O2M) relationship information
 *
 * In O2M relationships:
 * - The RELATED collection has a foreign key pointing to the CURRENT collection
 * - MULTIPLE related items can exist for a single parent item
 * - Example: A "category" has MANY "posts" (posts have category_id foreign key)
 */
export function useRelationO2M(collection: string, field: string) {
  const [relationInfo, setRelationInfo] = useState<O2MRelationInfo | null>(
    null,
  );
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

        // Get field info
        const fieldsService = new FieldsService();
        const fieldsData = await fieldsService.readAll(collection);
        const currentField = fieldsData.find((f: Field) => f.field === field);

        if (!currentField) {
          setError(`Field "${field}" not found in collection "${collection}"`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Check if this is an O2M interface
        const interfaceType = currentField.meta?.interface;
        if (interfaceType !== "list-o2m" && interfaceType !== "one-to-many") {
          setError(
            `Field "${field}" is not configured as a list-o2m interface`,
          );
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Get the related collection and reverse field from field options
        const fieldOptions = currentField.meta?.options as
          | Record<string, unknown>
          | undefined;
        let relatedCollectionName: string | null =
          (fieldOptions?.related_collection as string | undefined) ||
          (fieldOptions?.relatedCollection as string | undefined) ||
          null;

        let reverseFieldName: string | null =
          (fieldOptions?.foreign_key_field as string | undefined) ||
          (fieldOptions?.foreignKeyField as string | undefined) ||
          (fieldOptions?.reverse_field as string | undefined) ||
          null;

        const sortFieldName: string | undefined =
          (fieldOptions?.sort_field as string | undefined) ||
          (fieldOptions?.sortField as string | undefined) ||
          undefined;

        // If not found in options, try fetching from daas_relations
        let oneDeselectAction: "nullify" | "delete" = "nullify";
        let sortFieldFromRelation: string | undefined;
        if (!relatedCollectionName || !reverseFieldName) {
          try {
            interface RelationData {
              collection?: string;
              related_collection?: string | null;
              field?: string;
              one_collection?: string;
              one_field?: string;
              many_collection?: string;
              many_field?: string;
              sort_field?: string | null;
              one_deselect_action?: string | null;
              meta?: {
                one_collection?: string;
                one_field?: string;
                many_collection?: string;
                many_field?: string;
                sort_field?: string | null;
                one_deselect_action?: string | null;
              };
            }
            const relationsData = await apiRequest<{ data: RelationData[] }>(
              `/api/relations`,
            );

            const o2mRelation = relationsData.data?.find(
              (r) =>
                (r.meta?.one_collection === collection &&
                  r.meta?.one_field === field) ||
                (r.one_collection === collection && r.one_field === field),
            );

            if (o2mRelation) {
              relatedCollectionName =
                relatedCollectionName ||
                o2mRelation.meta?.many_collection ||
                o2mRelation.many_collection ||
                null;
              reverseFieldName =
                reverseFieldName ||
                o2mRelation.meta?.many_field ||
                o2mRelation.many_field ||
                null;
              // Extract one_deselect_action from relation
              const deselectAction =
                o2mRelation.one_deselect_action ||
                o2mRelation.meta?.one_deselect_action;
              if (deselectAction === "delete") {
                oneDeselectAction = "delete";
              }
              // Extract sort_field from relation
              sortFieldFromRelation =
                (o2mRelation.sort_field ||
                  o2mRelation.meta?.sort_field) as string | undefined ||
                undefined;
            }

            // Auto-discover FK field if needed
            if (relatedCollectionName && !reverseFieldName) {
              const m2oRelation = relationsData.data?.find(
                (r) =>
                  (r.collection === relatedCollectionName ||
                    r.many_collection === relatedCollectionName) &&
                  (r.related_collection === collection ||
                    r.one_collection === collection),
              );

              if (m2oRelation) {
                reverseFieldName =
                  m2oRelation.field || m2oRelation.many_field || null;
              }
            }
          } catch {
            // Ignore relation fetch errors
          }
        }

        if (!relatedCollectionName) {
          setError(`No related collection configured for field "${field}".`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        if (!reverseFieldName) {
          setError(`No foreign key field configured for field "${field}".`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Check if the related collection is a singleton and if the FK is unique
        let isSingleton = false;
        let isForeignKeyUnique = false;
        try {
          // Fetch related collection metadata to check singleton status
          const collectionMeta = await apiRequest<{
            data: { meta?: { singleton?: boolean } };
          }>(`/api/collections/${relatedCollectionName}`);
          isSingleton = collectionMeta.data?.meta?.singleton === true;

          // Fetch FK field schema to check uniqueness
          const fkFieldData = await apiRequest<{
            data: { schema?: { is_unique?: boolean } };
          }>(
            `/api/fields/${relatedCollectionName}/${reverseFieldName}`,
          );
          isForeignKeyUnique =
            fkFieldData.data?.schema?.is_unique === true;
        } catch {
          // Ignore metadata fetch errors — defaults are safe
        }

        // Use sort_field from relation as fallback
        const effectiveSortField = sortFieldName || sortFieldFromRelation || undefined;

        // Resolve the related & parent collections' real primary keys —
        // previously hardcoded to id/uuid, which breaks item identity
        // (keys, unlink/delete/reorder, dedupe, edit-target) for any
        // related collection whose PK isn't literally "id".
        const [relatedPrimaryKeyField, parentPrimaryKeyField] = await Promise.all([
          detectPrimaryKeyField(relatedCollectionName),
          detectPrimaryKeyField(collection),
        ]);

        // Build relation info
        const info: O2MRelationInfo = {
          relatedCollection: {
            collection: relatedCollectionName,
            meta: {},
          },
          reverseJunctionField: {
            field: reverseFieldName,
            type: "uuid",
          },
          relatedPrimaryKeyField,
          parentPrimaryKeyField,
          sortField: effectiveSortField,
          displayTemplate: fieldOptions?.template as string | undefined,
          relation: {
            field,
            collection,
            related_collection: relatedCollectionName,
            meta: currentField.meta as Record<string, unknown> | undefined,
          },
          oneDeselectAction: oneDeselectAction,
          isSingleton: isSingleton,
          isForeignKeyUnique: isForeignKeyUnique,
        };

        setRelationInfo(info);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load relationship configuration";
        setError(errorMessage);
        setRelationInfo(null);
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
 * O2M Item - a related item in a One-to-Many relationship
 */
export interface O2MItem {
  id: string | number;
  $index?: number;
  $type?: "created" | "updated" | "deleted" | "staged";
  $edits?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Query parameters for loading O2M items
 */
export interface O2MQueryParams {
  limit?: number;
  page?: number;
  search?: string;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  fields?: string[];
  filter?: Record<string, unknown>;
}

/**
 * Custom hook for managing O2M relationship items (CRUD operations)
 */
export function useRelationO2MItems(
  relationInfo: O2MRelationInfo | null,
  parentPrimaryKey: string | number | null,
) {
  const [items, setItems] = useState<O2MItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The related collection's real primary key column — not necessarily "id"
  // (e.g. a slug-PK collection). Every read/write below must key items by
  // this field; hardcoding `.id` silently no-ops removeItem/deleteItem/
  // reorderItems (URL becomes `/api/items/{collection}/undefined`) and
  // corrupts `setItems` filtering (every item's `.id` is `undefined`, so
  // `i.id !== item.id` is false for all of them at once).
  const pkField = relationInfo?.relatedPrimaryKeyField?.field || "id";

  // Load items from the related collection
  const loadItems = useCallback(
    async (params?: O2MQueryParams) => {
      if (!relationInfo || !parentPrimaryKey) {
        setItems([]);
        setTotalCount(0);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const query: Record<string, unknown> = {
          limit: params?.limit || 15,
          page: params?.page || 1,
          filter: {
            [relationInfo.reverseJunctionField.field]: {
              _eq: parentPrimaryKey,
            },
          },
          meta: ["total_count", "filter_count"],
        };

        if (params?.filter) {
          query.filter = {
            _and: [query.filter, params.filter],
          };
        }

        if (params?.fields && params.fields.length > 0) {
          query.fields = params.fields.join(",");
        }

        if (params?.search) {
          query.search = params.search;
        }

        if (params?.sortField) {
          query.sort =
            params.sortDirection === "desc"
              ? `-${params.sortField}`
              : params.sortField;
        } else if (relationInfo.sortField) {
          query.sort = relationInfo.sortField;
        }

        const queryString = new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [
              k,
              typeof v === "object" ? JSON.stringify(v) : String(v),
            ]),
        ).toString();

        const data = await apiRequest<{
          data: O2MItem[];
          meta?: { total_count?: number; filter_count?: number };
        }>(
          `/api/items/${relationInfo.relatedCollection.collection}?${queryString}`,
        );

        setItems(data.data || []);
        setTotalCount(
          data.meta?.total_count ||
            data.meta?.filter_count ||
            data.data?.length ||
            0,
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load related items";
        setError(errorMessage);
        setItems([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [relationInfo, parentPrimaryKey],
  );

  // Create a new item
  const createItem = useCallback(
    async (data: Partial<O2MItem>): Promise<O2MItem | null> => {
      if (!relationInfo || !parentPrimaryKey) return null;

      const collection = relationInfo.relatedCollection.collection;
      const itemData = {
        ...data,
        [relationInfo.reverseJunctionField.field]: parentPrimaryKey,
      };

      const created = await apiRequest<{ data: O2MItem }>(
        `/api/items/${collection}`,
        { method: "POST", body: JSON.stringify(itemData) },
      );
      const id = created.data?.[pkField];
      const fetched = await apiRequest<{ data: O2MItem }>(
        `/api/items/${collection}/${id}`,
      );
      return fetched.data as O2MItem;
    },
    [relationInfo, parentPrimaryKey, pkField],
  );

  // Update an existing item
  const updateItem = useCallback(
    async (
      id: string | number,
      data: Partial<O2MItem>,
    ): Promise<O2MItem | null> => {
      if (!relationInfo) return null;

      const collection = relationInfo.relatedCollection.collection;
      await apiRequest(`/api/items/${collection}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const fetched = await apiRequest<{ data: O2MItem }>(
        `/api/items/${collection}/${id}`,
      );
      return fetched.data as O2MItem;
    },
    [relationInfo],
  );

  // Remove (unlink) an item
  const removeItem = useCallback(
    async (item: O2MItem): Promise<void> => {
      if (!relationInfo) return;

      await apiRequest(
        `/api/items/${relationInfo.relatedCollection.collection}/${item[pkField]}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [relationInfo.reverseJunctionField.field]: null,
          }),
        },
      );
      setItems((prev) => prev.filter((i) => i[pkField] !== item[pkField]));
      setTotalCount((prev) => Math.max(0, prev - 1));
    },
    [relationInfo, pkField],
  );

  // Delete an item completely
  const deleteItem = useCallback(
    async (item: O2MItem): Promise<void> => {
      if (!relationInfo) return;

      await apiRequest(
        `/api/items/${relationInfo.relatedCollection.collection}/${item[pkField]}`,
        { method: "DELETE" },
      );
      setItems((prev) => prev.filter((i) => i[pkField] !== item[pkField]));
      setTotalCount((prev) => Math.max(0, prev - 1));
    },
    [relationInfo, pkField],
  );

  // Link existing items
  const selectItems = useCallback(
    async (itemIds: (string | number)[]): Promise<void> => {
      if (!relationInfo || !parentPrimaryKey) return;

      const collection = relationInfo.relatedCollection.collection;
      await Promise.all(
        itemIds.map((id) =>
          apiRequest(`/api/items/${collection}/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              [relationInfo.reverseJunctionField.field]: parentPrimaryKey,
            }),
          }),
        ),
      );
    },
    [relationInfo, parentPrimaryKey],
  );

  // Reorder items
  const reorderItems = useCallback(
    async (reorderedItems: O2MItem[]): Promise<void> => {
      if (!relationInfo?.sortField) return;

      const collection = relationInfo.relatedCollection.collection;
      await Promise.all(
        reorderedItems.map((item, index) =>
          apiRequest(`/api/items/${collection}/${item[pkField]}`, {
            method: "PATCH",
            body: JSON.stringify({
              [relationInfo.sortField!]: index + 1,
            }),
          }),
        ),
      );
      setItems(reorderedItems);
    },
    [relationInfo, pkField],
  );

  // Move item up
  const moveItemUp = useCallback(
    async (index: number): Promise<void> => {
      if (index <= 0 || !relationInfo?.sortField) return;
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [
        newItems[index],
        newItems[index - 1],
      ];
      await reorderItems(newItems);
    },
    [items, relationInfo, reorderItems],
  );

  // Move item down
  const moveItemDown = useCallback(
    async (index: number): Promise<void> => {
      if (index >= items.length - 1 || !relationInfo?.sortField) return;
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [
        newItems[index + 1],
        newItems[index],
      ];
      await reorderItems(newItems);
    },
    [items, relationInfo, reorderItems],
  );

  return {
    items,
    totalCount,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    removeItem,
    deleteItem,
    selectItems,
    reorderItems,
    moveItemUp,
    moveItemDown,
    setItems,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, isValidPrimaryKey } from "./utils";

// ---------------------------------------------------------------------------
// Template field extraction helper
// ---------------------------------------------------------------------------

const TEMPLATE_REGEX = /\{\{(.*?)\}\}/g;

/**
 * Extract field names referenced inside `{{…}}` placeholders so we know which
 * fields to request from the API when loading items.
 */
export function extractFieldsFromTemplate(template: string | undefined | null): string[] {
  if (!template) return [];
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TEMPLATE_REGEX.exec(template)) !== null) {
    const key = m[1].trim();
    if (key) {
      // For nested paths like "author.name" we need the root field ("author")
      // to include in the API `fields` param, but we also include the full
      // dot-path so that deep selects work.
      fields.push(key);
      const root = key.split(".")[0];
      if (root !== key && !fields.includes(root)) {
        fields.push(root);
      }
    }
  }
  return [...new Set(fields)];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Information about a Many-to-One relationship.
 *
 * Built from the DaaS `/relations` endpoint + optional collection metadata.
 */
export interface M2ORelationInfo {
  /** The related collection (foreign table) */
  relatedCollection: {
    collection: string;
    meta?: Record<string, unknown>;
  };
  /** The field containing the foreign key */
  foreignKeyField: {
    field: string;
    type: string;
  };
  /** Primary key field of the related collection */
  relatedPrimaryKeyField: {
    field: string;
    type: string;
  };
  /**
   * Resolved display template — precedence:
   * 1. explicit `template` prop from field options
   * 2. related collection's `meta.display_template`
   * 3. `undefined` (component should build a fallback)
   */
  displayTemplate?: string;
  /** Relation metadata from DaaS */
  relation: {
    field: string;
    collection: string;
    related_collection: string;
    meta?: Record<string, unknown> | null;
  };
  /**
   * Whether the related collection is a singleton (single-object collection).
   * When true the interface should auto-select the single item.
   */
  isSingleton?: boolean;
}

/**
 * Custom hook for loading Many-to-One (M2O) relationship metadata.
 *
 * Improvements over prior version:
 * - Queries `/api/relations` directly (no interface-type gate).
 * - Resolves display template from collection metadata if the field options
 *   don't provide one.
 * - Extracts required query fields from the template.
 * - Detects singleton collections.
 *
 * @param collection - The collection that owns the foreign key.
 * @param field      - The M2O field name.
 * @param templateOverride - Optional explicit template (from field options).
 */
export function useRelationM2O(
  collection: string,
  field: string,
  templateOverride?: string,
) {
  const [relationInfo, setRelationInfo] = useState<M2ORelationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!collection || !field) {
        setRelationInfo(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // ── 1. Fetch relation metadata from DaaS ──────────────────────
        const relationsResp = await apiRequest<{
          data: {
            many_collection: string;
            many_field: string;
            one_collection: string | null;
            one_primary?: string;
            schema?: { foreign_key_column?: string; data_type?: string } | null;
            meta?: Record<string, unknown> | null;
          }[];
        }>(`/api/relations`);

        const relation = relationsResp.data?.find(
          (r) =>
            (r.many_collection === collection && r.many_field === field) ||
            ((r.meta?.many_collection as string) === collection &&
              (r.meta?.many_field as string) === field),
        );

        // Resolve one_collection from top-level or meta (DaaS may nest it)
        const resolvedOneCollection =
          relation?.one_collection ??
          (relation?.meta?.one_collection as string | undefined) ??
          null;

        if (!resolvedOneCollection) {
          if (!cancelled) {
            setError(
              `No M2O relation found for ${collection}.${field}. ` +
                `Ensure a relation is configured in DaaS.`,
            );
            setRelationInfo(null);
          }
          return;
        }

        const relatedCollectionName = resolvedOneCollection;
        const fkType = relation!.schema?.data_type || "uuid";
        const relatedPK =
          relation!.one_primary ||
          (relation!.meta?.one_primary as string | undefined) ||
          relation!.schema?.foreign_key_column ||
          "id";

        // ── 2. Fetch related collection meta for display template ─────
        let collectionMeta: Record<string, unknown> | undefined;
        let resolvedTemplate: string | undefined = templateOverride;
        let isSingleton = false;

        try {
          const colResp = await apiRequest<{
            data: {
              collection: string;
              meta?: {
                display_template?: string;
                singleton?: boolean;
                [key: string]: unknown;
              };
            };
          }>(`/api/collections/${relatedCollectionName}`);

          collectionMeta = colResp.data?.meta as Record<string, unknown> | undefined;

          if (!resolvedTemplate && collectionMeta?.display_template) {
            resolvedTemplate = collectionMeta.display_template as string;
          }

          if (collectionMeta?.singleton === true) {
            isSingleton = true;
          }
        } catch {
          // Collection meta is optional — template will just be undefined
        }

        if (cancelled) return;

        const info: M2ORelationInfo = {
          relatedCollection: {
            collection: relatedCollectionName,
            meta: collectionMeta,
          },
          foreignKeyField: {
            field,
            type: fkType,
          },
          relatedPrimaryKeyField: {
            field: relatedPK,
            type: "uuid",
          },
          displayTemplate: resolvedTemplate,
          relation: {
            field,
            collection,
            related_collection: relatedCollectionName,
            meta: relation!.meta ?? null,
          },
          isSingleton,
        };

        setRelationInfo(info);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load relationship configuration",
          );
          setRelationInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [collection, field, templateOverride]);

  /**
   * Fields that need to be fetched for any item so the display template
   * can be rendered. Always includes at least the primary key.
   */
  const templateFields = useMemo(() => {
    const pk = relationInfo?.relatedPrimaryKeyField.field ?? "id";
    const fromTemplate = extractFieldsFromTemplate(relationInfo?.displayTemplate);
    const merged = new Set([pk, ...fromTemplate]);
    return Array.from(merged);
  }, [relationInfo]);

  return {
    relationInfo,
    loading,
    error,
    /** Fields required by the display template (includes PK). */
    templateFields,
  };
}

// ---------------------------------------------------------------------------
// M2O Item types
// ---------------------------------------------------------------------------

/**
 * M2O Item — a related item in a Many-to-One relationship.
 *
 * The value can be:
 * - A primitive (string | number) representing the foreign key.
 * - A full object (when the item is fetched or inlined).
 */
export interface M2OItem {
  [key: string]: unknown;
}

export interface M2OQueryParams {
  fields?: string[];
}

/**
 * Get the primitive primary-key value from a value that may be an object.
 */
function getPrimaryKeyFromValue(
  value: string | number | Record<string, unknown> | null | undefined,
  pkField: string,
): string | number | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object") {
    const pk = value[pkField];
    if (typeof pk === "string" || typeof pk === "number") return pk;
  }
  return null;
}

/**
 * Custom hook for loading / managing the selected M2O item.
 *
 * Improvements:
 * - Accepts object values (`Record<string, any>`) in addition to primitives.
 * - Auto-loads with template fields from `useRelationM2O`.
 * - Merges inline edits with fetched data.
 */
export function useRelationM2OItem(
  relationInfo: M2ORelationInfo | null,
  value: string | number | Record<string, unknown> | null,
  templateFields?: string[],
) {
  const [item, setItem] = useState<M2OItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkField = relationInfo?.relatedPrimaryKeyField.field ?? "id";
  const primaryKey = getPrimaryKeyFromValue(value, pkField);

  // If value is already an object, use it as initial/edits data
  const inlineData = typeof value === "object" && value !== null ? value : null;

  const loadItem = useCallback(
    async (params?: M2OQueryParams) => {
      if (!relationInfo || !isValidPrimaryKey(primaryKey)) {
        // If we have inline data (object value) use it directly
        if (inlineData) {
          setItem(inlineData);
        } else {
          setItem(null);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const col = relationInfo.relatedCollection.collection;
        const fields = params?.fields ?? templateFields ?? [];
        const queryParams = new URLSearchParams();
        if (fields.length > 0) {
          queryParams.set("fields", fields.join(","));
        }
        let fetched: M2OItem | null;
        if (pkField === "id") {
          const qs = queryParams.toString();
          const path = `/api/items/${col}/${primaryKey}${qs ? `?${qs}` : ""}`;
          const response = await apiRequest<{ data: M2OItem }>(path);
          fetched = (response.data ?? null) as M2OItem | null;
        } else {
          // The relation targets a non-id column (e.g. daas_scope_items.uri_path).
          // The by-id path route can't resolve those values — and they may contain
          // path-breaking characters like "/" — so look the item up via a filter.
          queryParams.set(
            "filter",
            JSON.stringify({ [pkField]: { _eq: primaryKey } }),
          );
          queryParams.set("limit", "1");
          const response = await apiRequest<{ data: M2OItem[] }>(
            `/api/items/${col}?${queryParams.toString()}`,
          );
          fetched = (response.data?.[0] ?? null) as M2OItem | null;
        }

        // Merge inline edits on top of fetched data
        if (fetched && inlineData) {
          setItem({ ...fetched, ...inlineData });
        } else {
          setItem(fetched);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load related item",
        );
        // Fall back to inline data if available
        setItem(inlineData);
      } finally {
        setLoading(false);
      }
    },
    [relationInfo, primaryKey, inlineData, templateFields],
  );

  const clearItem = useCallback(() => {
    setItem(null);
  }, []);

  return {
    item,
    loading,
    error,
    loadItem,
    clearItem,
    setItem,
    /** Resolved primitive primary key */
    primaryKey,
  };
}

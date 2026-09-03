import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { useBuildpadTranslations } from './useBuildpadI18n';
import type { Relation as BaseRelation, RelationMeta as BaseRelationMeta } from '@buildpad/types';
import { apiRequest } from './utils';

/**
 * Resolve a collection's real primary key field (name + type), mirroring
 * useRelationM2A's detectPrimaryKeyFields. `relatedPrimaryKeyField` and
 * `junctionPrimaryKeyField` were previously hardcoded to id/uuid and
 * id/integer respectively — correct for the common case, but wrong (and
 * silently so) for any related or junction collection whose PK isn't
 * literally `id`, breaking dedupe, edit-target resolution, and the
 * "exclude already-linked" filter that read these fields.
 */
async function detectPrimaryKeyField(
  collection: string,
): Promise<{ field: string; type: string }> {
  try {
    const response = await apiRequest<{ data: FieldInfo[] } | FieldInfo[]>(`/api/fields/${collection}`);
    const fields: FieldInfo[] = Array.isArray(response) ? response : (response.data ?? []);
    const pkField = fields.find((f) => f.schema?.is_primary_key === true);
    if (pkField) {
      return { field: pkField.field, type: pkField.type || 'uuid' };
    }
    const idField = fields.find((f) => f.field === 'id');
    return { field: idField?.field || 'id', type: idField?.type || 'uuid' };
  } catch {
    return { field: 'id', type: 'uuid' };
  }
}

interface CollectionMeta {
  display_template?: string;
  [key: string]: unknown;
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
  schema?: { is_primary_key?: boolean };
}

interface RelationMeta extends BaseRelationMeta {
  id?: number;
  one_field?: string | null;
  one_collection?: string | null;
  many_collection?: string;
  many_field?: string;
  junction_field?: string | null;
  sort_field?: string | null;
  one_deselect_action?: string;
}

interface Relation extends BaseRelation {
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
}

export interface M2MRelationInfo {
  junctionCollection: {
    collection: string;
    meta: CollectionMeta;
  };
  relatedCollection: {
    collection: string;
    meta: CollectionMeta;
  };
  junctionField: {
    field: string;
    type: string;
  };
  reverseJunctionField: {
    field: string;
    type: string;
  };
  relatedPrimaryKeyField: {
    field: string;
    type: string;
  };
  junctionPrimaryKeyField: {
    field: string;
    type: string;
  };
  sortField?: string;
  relation: {
    field: string;
    collection: string;
    related_collection: string;
    meta: RelationMeta;
  };
  junction: Relation;
}

/**
 * Custom hook for managing M2M (Many-to-Many) relationship information
 * 
 * Follows DaaS useRelationM2M composable pattern:
 * 
 * One1 (current)      Junction Table                  One2 (related)
 * ┌─────────┐         ┌─────────────────────────┐     ┌─────────────────┐
 * │id       ├───┐     │id: junctionPKField      │ ┌───┤id: relatedPKField
 * │many     │   └────►│one1_id: reverseJunction │ │   │                 │
 * └─────────┘         │one2_id: junctionField   ├─┘   └─────────────────┘
 *                     │sort: sortField          │
 *                     └─────────────────────────┘
 */
export function useRelationM2M(collection: string, field: string) {
  const t = useBuildpadTranslations((d) => d.hooks.relations);
  const [relationInfo, setRelationInfo] = useState<M2MRelationInfo | null>(null);
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
        
        // Get field info to verify it's a list-m2m interface
        const fieldResponse = await apiRequest<{ data: FieldInfo[] }>(`/api/fields/${collection}`);
        const fieldInfo = fieldResponse.data || [];
        const currentField = fieldInfo.find((f) => f.field === field);
        
        if (!currentField?.meta?.interface || currentField.meta.interface !== 'list-m2m') {
          setError(`Field "${field}" is not configured as a list-m2m interface`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Get all relations from API
        const relationsResponse = await apiRequest<{ data: Relation[] }>('/api/relations');
        const relations = relationsResponse.data || [];
        
        // Step 1: Find the "junction" relation 
        let junction = relations.find((rel) =>
          rel.related_collection === collection &&
          rel.meta?.one_field === field &&
          rel.meta?.junction_field
        );

        // Alternative: look for relation by meta.one_collection
        if (!junction) {
          junction = relations.find((rel) =>
            rel.meta?.one_collection === collection &&
            rel.meta?.one_field === field &&
            rel.meta?.junction_field
          );
        }
        
        // FALLBACK: Build from field options if no relation entry exists
        if (!junction) {
          const options = currentField.meta?.options as Record<string, unknown> | undefined;
          
          if (options?.junction_collection && options?.related_collection) {
            const junctionCollection = options.junction_collection as string;
            const relatedCollection = options.related_collection as string;
            const junctionFieldCurrent = (options.junction_field_current as string) || `${collection}_id`;
            const junctionFieldRelated = (options.junction_field_related as string) || `${relatedCollection}_id`;

            const [relatedPrimaryKeyField, junctionPrimaryKeyField] = await Promise.all([
              detectPrimaryKeyField(relatedCollection),
              detectPrimaryKeyField(junctionCollection),
            ]);

            const info: M2MRelationInfo = {
              junctionCollection: {
                collection: junctionCollection,
                meta: {}
              },
              relatedCollection: {
                collection: relatedCollection,
                meta: {}
              },
              junctionField: {
                field: junctionFieldRelated,
                type: 'uuid'
              },
              reverseJunctionField: {
                field: junctionFieldCurrent,
                type: 'uuid'
              },
              relatedPrimaryKeyField,
              junctionPrimaryKeyField,
              sortField: (options.sort_field as string) || undefined,
              relation: {
                field: junctionFieldRelated,
                collection: junctionCollection,
                related_collection: relatedCollection,
                meta: {} as RelationMeta
              },
              junction: {
                collection: junctionCollection,
                field: junctionFieldCurrent,
                related_collection: collection,
                meta: {
                  one_field: field,
                  one_collection: collection,
                  many_collection: junctionCollection,
                  many_field: junctionFieldCurrent,
                  junction_field: junctionFieldRelated,
                }
              }
            };
            
            setRelationInfo(info);
            setLoading(false);
            return;
          }
          
          setError(`M2M relationship not configured. No junction relation found for field "${field}".`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        const junctionCollection = junction.collection;
        const junctionField = junction.meta?.junction_field;
        
        if (!junctionCollection || !junctionField) {
          setError('Invalid junction relation: missing collection or junction_field');
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Step 2: Find the "relation" from junction to related collection
        const relation = relations.find((rel) =>
          rel.collection === junctionCollection &&
          rel.field === junctionField
        );

        if (!relation || !relation.related_collection) {
          setError(`M2M relationship not configured. Related collection not found for junction field "${junctionField}".`);
          setRelationInfo(null);
          setLoading(false);
          return;
        }

        // Resolve real PKs (previously hardcoded to id/uuid and id/integer).
        const [relatedPrimaryKeyField, junctionPrimaryKeyField] = await Promise.all([
          detectPrimaryKeyField(relation.related_collection),
          detectPrimaryKeyField(junctionCollection),
        ]);

        // Build the M2MRelationInfo
        const info: M2MRelationInfo = {
          junctionCollection: {
            collection: junctionCollection,
            meta: {}
          },
          relatedCollection: {
            collection: relation.related_collection,
            meta: {}
          },
          junctionField: {
            field: junctionField,
            type: 'uuid'
          },
          reverseJunctionField: {
            field: junction.field || `${collection}_id`,
            type: 'uuid'
          },
          relatedPrimaryKeyField,
          junctionPrimaryKeyField,
          sortField: junction.meta?.sort_field || undefined,
          relation: {
            field: junctionField,
            collection: junctionCollection,
            related_collection: relation.related_collection,
            meta: (relation.meta || {}) as RelationMeta
          },
          junction: junction
        };
        
        setRelationInfo(info);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load relationship configuration';
        setError(errorMessage);
        setRelationInfo(null);
        notifications.show({
          title: t.errorTitle,
          message: t.loadConfigFailed,
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRelationInfo();
  }, [collection, field, t]);

  return {
    relationInfo,
    loading,
    error
  };
}

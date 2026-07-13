/**
 * Field/relation metadata fetchers for the permission detail editor.
 *
 * Imperative, module-cached functions rather than hooks: the filter editor
 * lazily loads metadata per (related) collection from menu interactions,
 * and caching at module level lets every modal/menu share one request per
 * collection. Uses `apiRequest` directly, keeping the registry entry's
 * `internalDependencies` at `["services"]`.
 */
import { apiRequest } from '@buildpad/services';
import type { Field, Relation } from '@buildpad/types';
import type { RelationInfo } from './PermissionFilterTypes';

const fieldsCache = new Map<string, Promise<Field[]>>();
let relationsCache: Promise<Relation[]> | null = null;

/**
 * Fields for one collection via `GET /api/fields/{collection}`.
 * Cached per collection; a failed fetch is evicted so it can be retried.
 */
export function fetchCollectionFields(collection: string): Promise<Field[]> {
  let cached = fieldsCache.get(collection);
  if (!cached) {
    cached = apiRequest<{ data: Field[] }>(`/api/fields/${collection}`)
      .then((response) => response.data ?? [])
      .catch((err) => {
        fieldsCache.delete(collection);
        throw err;
      });
    fieldsCache.set(collection, cached);
  }
  return cached;
}

/**
 * All relations via the flat `GET /api/relations` (there is no
 * per-collection relations route; matching happens client-side, same as
 * `useRelationM2O`). Cached once per module lifetime.
 */
function fetchAllRelations(): Promise<Relation[]> {
  if (!relationsCache) {
    relationsCache = apiRequest<{ data: Relation[] }>(`/api/relations?limit=-1`)
      .then((response) => response.data ?? [])
      .catch((err) => {
        relationsCache = null;
        throw err;
      });
  }
  return relationsCache;
}

/**
 * Relations of one collection, mapped for the filter editor.
 *
 * - M2M: collection is `one_collection` and the relation has a
 *   `junction_field` — the alias is `one_field`, and filterable columns
 *   live on the junction (`many_collection`), not the far target.
 * - O2M: collection is `one_collection`, alias is `one_field`.
 * - M2O: collection is `many_collection`, field is the FK column itself.
 *
 * Deduplicated by field name; alias relations (o2m/m2m) sort before
 * physical FK columns (m2o).
 */
export async function fetchCollectionRelations(collection: string): Promise<RelationInfo[]> {
  const relations = await fetchAllRelations();

  const mapped: RelationInfo[] = [];
  for (const rel of relations) {
    const meta = rel.meta;
    if (!meta) continue;

    if (meta.junction_field) {
      if (meta.one_collection === collection && meta.one_field) {
        mapped.push({
          field: meta.one_field,
          relationType: 'm2m',
          relatedCollection: meta.many_collection ?? '',
        });
      }
    } else if (meta.one_collection === collection && meta.one_field) {
      mapped.push({
        field: meta.one_field,
        relationType: 'o2m',
        relatedCollection: meta.many_collection ?? '',
      });
    } else if (meta.many_collection === collection && meta.many_field) {
      mapped.push({
        field: meta.many_field,
        relationType: 'm2o',
        relatedCollection: meta.one_collection || rel.related_collection || '',
      });
    }
  }

  const seen = new Set<string>();
  const deduped = mapped.filter((r) => {
    if (seen.has(r.field) || !r.relatedCollection) return false;
    seen.add(r.field);
    return true;
  });
  deduped.sort((a, b) => {
    const aIsM2O = a.relationType === 'm2o' ? 1 : 0;
    const bIsM2O = b.relationType === 'm2o' ? 1 : 0;
    return aIsM2O - bIsM2O;
  });
  return deduped;
}

/** Reset the module caches (tests, or after schema changes). */
export function clearPermissionMetadataCache(): void {
  fieldsCache.clear();
  relationsCache = null;
}

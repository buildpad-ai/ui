'use client';

import { useState, useCallback, useMemo } from 'react';
import { ItemsService } from '@buildpad/services';
import type { AnyItem, FormDefinition } from '@buildpad/types';

/**
 * useFormDefinitions
 *
 * Data hook for the Dynamic Form Builder. Persists `FormDefinition`s as items
 * in an ordinary, consumer-owned definitions collection (default
 * `fb_definitions`) via the generic `ItemsService` — no new API routes.
 *
 * Each definition is stored as one row with filterable scalar columns
 * (`name`, `target_collection`, `key`) plus a `definition` json column holding
 * the full `FormDefinition` body. `resolveScreen` selects the screen for a
 * `target_collection`/`key` using **most-specific-scope-wins** when the
 * definitions collection is scope-enabled, and is a no-op (single baseline) on
 * a non-scope-enabled collection.
 *
 * @package @buildpad/hooks
 */

/** Default definitions collection name. */
export const DEFAULT_FORMS_COLLECTION = 'fb_definitions';

/**
 * Upper bound for "fetch all" definition queries. This DaaS treats `limit: -1`
 * literally (returns zero rows) rather than as Directus-style "unlimited", so we
 * pass a large finite cap instead. Screens per collection are few in practice.
 */
const MAX_DEFINITIONS_LIMIT = 10000;

/** Params for listing definitions. */
export interface ListFormDefinitionsParams {
  /** Filter to a single target collection. */
  target_collection?: string;
  /** Filter to a single screen key (`null` matches rows with no key). */
  key?: string | null;
}

/** Params for resolving a single screen. */
export interface ResolveScreenParams {
  /** The collection the screen targets. */
  target_collection: string;
  /** Optional screen discriminator (e.g. by `issue_type`). */
  key?: string | null;
}

/** Options for the hook. */
export interface UseFormDefinitionsOptions {
  /**
   * Field on the definitions item that holds the scope URI when the
   * definitions collection is scope-enabled. Used by `resolveScreen` to pick
   * the nearest-ancestor-or-self override. Default `'resource_uri'`.
   */
  scopeField?: string;
}

/** Return shape of `useFormDefinitions`. */
export interface UseFormDefinitionsReturn {
  loading: boolean;
  error: string | null;
  list: (params?: ListFormDefinitionsParams) => Promise<FormDefinition[]>;
  get: (id: string | number) => Promise<FormDefinition>;
  create: (def: FormDefinition) => Promise<FormDefinition>;
  update: (id: string | number, def: FormDefinition) => Promise<FormDefinition>;
  remove: (id: string | number) => Promise<void>;
  resolveScreen: (params: ResolveScreenParams) => Promise<FormDefinition | null>;
}

/** Reconstruct a `FormDefinition` from a stored item row. */
function rowToDefinition(row: AnyItem): FormDefinition {
  const body = (row.definition ?? {}) as Partial<FormDefinition>;
  return {
    id: row.id as string,
    name: (row.name as string) ?? body.name ?? '',
    target_collection:
      (row.target_collection as string) ?? body.target_collection ?? '',
    key: (row.key as string | null | undefined) ?? body.key ?? null,
    sections: body.sections ?? [],
  };
}

/** Project a `FormDefinition` into an item row payload. */
function definitionToRow(def: FormDefinition): Partial<AnyItem> {
  const { id: _id, ...body } = def;
  return {
    name: def.name,
    target_collection: def.target_collection,
    key: def.key ?? null,
    definition: body,
  };
}

/** Build a DaaS filter from list params. */
function buildFilter(params: ListFormDefinitionsParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.target_collection) {
    filter.target_collection = { _eq: params.target_collection };
  }
  if (params.key !== undefined) {
    filter.key = params.key === null ? { _null: true } : { _eq: params.key };
  }
  return filter;
}

/** Read the active scope URI from the `daas_resource_uri` cookie (browser only). */
function readActiveScopeUri(): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('daas_resource_uri='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : null;
}

/** True when `candidate` is the active scope itself or one of its ancestors. */
function isAncestorOrSelf(candidate: string, active: string): boolean {
  if (candidate === active) return true;
  const prefix = candidate.endsWith('/') ? candidate : `${candidate}/`;
  return active.startsWith(prefix);
}

export function useFormDefinitions(
  formsCollection: string = DEFAULT_FORMS_COLLECTION,
  options: UseFormDefinitionsOptions = {},
): UseFormDefinitionsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeField = options.scopeField ?? 'resource_uri';
  const service = useMemo(
    () => new ItemsService(formsCollection),
    [formsCollection],
  );

  /** Run an async operation with shared loading/error bookkeeping. */
  const run = useCallback(async <T>(op: () => Promise<T>, msg: string): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await op();
    } catch (err) {
      const message = err instanceof Error ? err.message : msg;
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const list = useCallback(
    (params: ListFormDefinitionsParams = {}) =>
      run(async () => {
        const filter = buildFilter(params);
        const resp = await service.readByQuery({
          filter: Object.keys(filter).length ? filter : undefined,
          sort: ['name'],
          limit: MAX_DEFINITIONS_LIMIT,
        });
        return resp.data.map(rowToDefinition);
      }, 'Failed to list form definitions'),
    [run, service],
  );

  const get = useCallback(
    (id: string | number) =>
      run(
        async () => rowToDefinition(await service.readOne(id)),
        'Failed to load form definition',
      ),
    [run, service],
  );

  const create = useCallback(
    (def: FormDefinition) =>
      run(
        async () => rowToDefinition(await service.createOne(definitionToRow(def))),
        'Failed to create form definition',
      ),
    [run, service],
  );

  const update = useCallback(
    (id: string | number, def: FormDefinition) =>
      run(
        async () =>
          rowToDefinition(await service.updateOne(id, definitionToRow(def))),
        'Failed to update form definition',
      ),
    [run, service],
  );

  const remove = useCallback(
    (id: string | number) =>
      run(async () => {
        await service.deleteOne(id);
      }, 'Failed to delete form definition'),
    [run, service],
  );

  const resolveScreen = useCallback(
    (params: ResolveScreenParams) =>
      run(async () => {
        const filter = buildFilter(params);
        const resp = await service.readByQuery({
          filter: Object.keys(filter).length ? filter : undefined,
          sort: ['name'],
          limit: MAX_DEFINITIONS_LIMIT,
        });
        const rows = resp.data;
        if (rows.length === 0) return null;

        const activeScope = readActiveScopeUri();
        const isScopeEnabled = rows.some((r) => r[scopeField] != null);

        // Non-scope-enabled collection (or no active scope): single baseline.
        if (!isScopeEnabled || !activeScope) {
          return rowToDefinition(rows[0]);
        }

        // Most-specific-scope-wins: the nearest ancestor-or-self of the active
        // scope; an unscoped row is the global baseline (weakest match).
        let best: AnyItem | null = null;
        let bestScore = -1; // -1 none, 0 baseline, >0 = override scope length
        for (const row of rows) {
          const scope = row[scopeField];
          if (scope == null) {
            if (bestScore < 0) {
              best = row;
              bestScore = 0;
            }
          } else if (
            typeof scope === 'string' &&
            isAncestorOrSelf(scope, activeScope) &&
            scope.length > bestScore
          ) {
            best = row;
            bestScore = scope.length;
          }
        }

        return best ? rowToDefinition(best) : rowToDefinition(rows[0]);
      }, 'Failed to resolve form screen'),
    [run, service, scopeField],
  );

  return { loading, error, list, get, create, update, remove, resolveScreen };
}

export default useFormDefinitions;

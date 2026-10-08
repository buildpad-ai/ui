'use client';

import { useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type {
  WorkflowDefinitionInput,
  WorkflowDefinitionRecord,
  WorkflowDefinitionUpdate,
  WorkflowListParams,
  WorkflowListResult,
} from '@buildpad/types';
import { normalizeWorkflowJson } from '@buildpad/utils';
import {
  buildDaaSListQuery,
  DaaSRequestError,
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  readDaaSRecord,
  toDaaSRequestError,
  useDaaSRequest,
} from './daasRequest';

const BASE_PATH = '/api/workflows';

/** Page size of `fetchAllDefinitions`; both backends serve up to 1000. */
const ALL_PAGE_SIZE = 100;

/** Upper bound on the pages `fetchAllDefinitions` reads (10 000 definitions). */
const ALL_MAX_PAGES = 100;

const NOT_FOUND = 'Workflow definition not found';

/** A definition row with its document in the shape the editor can walk. */
function readDefinition(row: WorkflowDefinitionRecord): WorkflowDefinitionRecord {
  return { ...row, workflow_json: normalizeWorkflowJson(row.workflow_json) };
}

/**
 * Hook for workflow definition CRUD (`/api/workflows`). Follows the
 * `useUsers.ts` conventions: `'use client'`, `loading` / `error` state,
 * `useCallback` methods, `apiRequest` transport.
 *
 * Works against both backends. Every method rejects with a
 * `DaaSRequestError`, whose `kind` tells a missing definition (`notFound`)
 * from a refusal (`forbidden`, `mfaRequired`) from a failure; a load that
 * failed never resolves to an empty list or an empty record. `error` and
 * `errorInfo` hold the last failure for a component that renders from state.
 *
 * Not to be confused with `useWorkflow` (`@buildpad/ui-interfaces`), which
 * drives the workflow button of one item.
 */
export function useWorkflowDefinitions() {
  const { loading, error, errorInfo, run } = useDaaSRequest();

  /**
   * List definitions, ordered by name. `search` matches the name and the
   * description. `page` and `limit` are always sent (defaults 1 and 25).
   *
   * Compare the answer's `totalPages` with the page you asked for
   * (`clampPage`): after a delete the page may no longer exist.
   */
  const fetchDefinitions = useCallback(
    (params: WorkflowListParams = {}): Promise<WorkflowListResult<WorkflowDefinitionRecord>> =>
      run(async () => {
        const { page, limit, query } = buildDaaSListQuery(params);
        const result = await apiRequest(`${BASE_PATH}?${query}`);
        const list = readDaaSListResponse<WorkflowDefinitionRecord>(result, { page, limit });
        return { ...list, items: list.items.map(readDefinition) };
      }),
    [run],
  );

  /**
   * Every definition, page after page — the options of a picker. A plain
   * list request returns one page (25 rows by default), which is how a
   * picker ends up without the definitions past the first page. Pass
   * `search` to load only the matches instead.
   */
  const fetchAllDefinitions = useCallback(
    (params: { search?: string } = {}): Promise<WorkflowDefinitionRecord[]> =>
      run(async () => {
        const all: WorkflowDefinitionRecord[] = [];
        for (let page = 1; page <= ALL_MAX_PAGES; page += 1) {
          const { limit, query } = buildDaaSListQuery({
            page,
            limit: ALL_PAGE_SIZE,
            search: params.search,
          });
          const result = await apiRequest(`${BASE_PATH}?${query}`);
          const list = readDaaSListResponse<WorkflowDefinitionRecord>(result, { page, limit });
          all.push(...list.items.map(readDefinition));
          if (list.items.length === 0 || page >= list.totalPages) break;
        }
        return all;
      }),
    [run],
  );

  /**
   * Get one definition. Rejects with `kind: 'notFound'` when the id names no
   * definition the caller may read, including an id that is not a valid one.
   */
  const getDefinition = useCallback(
    (id: string): Promise<WorkflowDefinitionRecord> =>
      run(async () => {
        try {
          const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`);
          return readDefinition(readDaaSRecord<WorkflowDefinitionRecord>(result, NOT_FOUND));
        } catch (err) {
          throw missingWhenIdIsMalformed(toDaaSRequestError(err));
        }
      }),
    [run],
  );

  /** Create a definition. Resolves to the new definition's id. */
  const createDefinition = useCallback(
    (data: WorkflowDefinitionInput): Promise<string> =>
      run(async () => {
        const result = await apiRequest<{ data?: unknown }>(BASE_PATH, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        // Both backends answer the bare id; a row is accepted as well.
        const created = result?.data;
        const id =
          created && typeof created === 'object' ? (created as { id?: unknown }).id : created;
        if (typeof id !== 'string' || !id) {
          throw new DaaSRequestError('The server did not answer the id of the new workflow definition', {
            kind: 'failure',
          });
        }
        return id;
      }),
    [run],
  );

  /**
   * Update a definition (pass only the keys to change). Resolves to nothing:
   * one backend answers the stored row and the other only the id, so read the
   * definition again with `getDefinition` when the stored form is needed.
   *
   * `description: null` clears the description. It is sent as `''`: the
   * engine reads a `null` there as a key that was not sent, answers 200 and
   * keeps the stored text, while both backends store an empty string.
   */
  const updateDefinition = useCallback(
    (id: string, data: WorkflowDefinitionUpdate): Promise<void> =>
      run(async () => {
        await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(data.description === null ? { ...data, description: '' } : data),
        });
      }),
    [run],
  );

  /**
   * Delete a definition. A definition that is assigned to a collection or has
   * instances is refused (`kind: 'invalid'`, the message says which).
   */
  const deleteDefinition = useCallback(
    (id: string): Promise<void> =>
      run(async () => {
        await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }),
    [run],
  );

  return {
    loading,
    error,
    errorInfo,
    fetchDefinitions,
    fetchAllDefinitions,
    getDefinition,
    createDefinition,
    updateDefinition,
    deleteDefinition,
  };
}

export default useWorkflowDefinitions;

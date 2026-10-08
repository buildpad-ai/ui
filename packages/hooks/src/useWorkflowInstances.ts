'use client';

import { useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type {
  WorkflowDefinitionRef,
  WorkflowHistoryRecord,
  WorkflowInstanceRecord,
  WorkflowListParams,
  WorkflowListResult,
} from '@buildpad/types';
import { normalizeWorkflowJson } from '@buildpad/utils';
import {
  buildDaaSListQuery,
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  readDaaSRecord,
  toDaaSRequestError,
  useDaaSRequest,
} from './daasRequest';

const BASE_PATH = '/api/workflow-instances';

/** Page size of `fetchInstanceHistory`. */
const HISTORY_PAGE_SIZE = 100;

/** Upper bound on the pages `fetchInstanceHistory` reads (10 000 transitions). */
const HISTORY_MAX_PAGES = 100;

const NOT_FOUND = 'Workflow instance not found';

/** An instance row as the routes answer it: the definition sits under `workflow`. */
type StoredInstance = Omit<WorkflowInstanceRecord, 'workflow'> & { workflow?: unknown };

/**
 * An instance row with its definition as one shape: the embedded object, a
 * bare id as an object without a name, and a withheld or missing definition
 * as `null` (which `typeof` would otherwise report as an object).
 */
function readInstance(row: StoredInstance): WorkflowInstanceRecord {
  const stored = row.workflow;
  let workflow: WorkflowDefinitionRef | null = null;

  if (typeof stored === 'string' && stored) {
    workflow = { id: stored, name: '' };
  } else if (stored && typeof stored === 'object') {
    const embedded = stored as WorkflowDefinitionRef;
    workflow =
      embedded.workflow_json === undefined || embedded.workflow_json === null
        ? embedded
        : { ...embedded, workflow_json: normalizeWorkflowJson(embedded.workflow_json) };
  }

  return { ...row, workflow };
}

/**
 * Hook for reading workflow instances and their transition history
 * (`/api/workflow-instances`). Follows the `useUsers.ts` conventions:
 * `'use client'`, `loading` / `error` state, `useCallback` methods,
 * `apiRequest` transport.
 *
 * Read-only by design: an instance is created by the backend when an item
 * enters an assigned collection and moves only through a transition (the
 * workflow button, `useWorkflow` in `@buildpad/ui-interfaces`). Neither
 * backend serves a create, update or delete here.
 *
 * Works against both backends. Every method rejects with a
 * `DaaSRequestError`, whose `kind` tells a missing instance (`notFound`) from
 * a refusal (`forbidden`, `mfaRequired`) from a failure; a load that failed
 * never resolves to an empty list or an empty record.
 */
export function useWorkflowInstances() {
  const { loading, error, errorInfo, run } = useDaaSRequest();

  /**
   * List instances, newest first. `search` matches the collection, the
   * current state and the item id. `page` and `limit` are always sent
   * (defaults 1 and 25).
   */
  const fetchInstances = useCallback(
    (params: WorkflowListParams = {}): Promise<WorkflowListResult<WorkflowInstanceRecord>> =>
      run(async () => {
        const { page, limit, query } = buildDaaSListQuery(params);
        const result = await apiRequest(`${BASE_PATH}?${query}`);
        const list = readDaaSListResponse<StoredInstance>(result, { page, limit });
        return { ...list, items: list.items.map(readInstance) };
      }),
    [run],
  );

  /**
   * Get one instance, with its definition's document (`workflow.workflow_json`).
   * Rejects with `kind: 'notFound'` when the id names no instance the caller
   * may read, including an id that is not a valid one.
   */
  const getInstance = useCallback(
    (id: string): Promise<WorkflowInstanceRecord> =>
      run(async () => {
        try {
          const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`);
          return readInstance(readDaaSRecord<StoredInstance>(result, NOT_FOUND));
        } catch (err) {
          throw missingWhenIdIsMalformed(toDaaSRequestError(err));
        }
      }),
    [run],
  );

  /**
   * Every transition of an instance, newest first.
   *
   * The whole history is read page by page, because the backends disagree on
   * this route: one serves every row and ignores `page` and `limit`, the
   * other serves 50 rows unless told otherwise and sends no count. Reading
   * stops at the first page that is short, empty, longer than was asked for,
   * or a repeat of rows already read.
   *
   * An empty list means no transitions — or an instance the caller cannot
   * read, which this route answers the same way; load the instance itself
   * (`getInstance`) to tell them apart. A caller without read access to the
   * history collection is refused (`kind: 'forbidden'`), not answered `[]`.
   */
  const fetchInstanceHistory = useCallback(
    (instanceId: string): Promise<WorkflowHistoryRecord[]> =>
      run(async () => {
        const history: WorkflowHistoryRecord[] = [];
        const seen = new Set<string>();
        let previousPage = '';

        for (let page = 1; page <= HISTORY_MAX_PAGES; page += 1) {
          const { limit, query } = buildDaaSListQuery({ page, limit: HISTORY_PAGE_SIZE });
          const result = await apiRequest(
            `${BASE_PATH}/${encodeURIComponent(instanceId)}/history?${query}`,
          );
          const { items } = readDaaSListResponse<WorkflowHistoryRecord>(result, { page, limit });

          // A backend that ignores `page` answers the first page again. The
          // rows are compared by id, and the page as a whole for a caller
          // whose grant withholds the id.
          const thisPage = JSON.stringify(items);
          if (thisPage === previousPage) break;
          previousPage = thisPage;

          const fresh = items.filter((row) => typeof row.id !== 'string' || !seen.has(row.id));
          fresh.forEach((row) => {
            if (typeof row.id === 'string') seen.add(row.id);
          });
          history.push(...fresh);

          if (fresh.length < items.length || items.length !== limit) break;
        }

        return history;
      }),
    [run],
  );

  return {
    loading,
    error,
    errorInfo,
    fetchInstances,
    getInstance,
    fetchInstanceHistory,
  };
}

export default useWorkflowInstances;

'use client';

import { useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type {
  WorkflowAssignmentInput,
  WorkflowAssignmentRecord,
  WorkflowAssignmentUpdate,
  WorkflowListParams,
  WorkflowListResult,
} from '@buildpad/types';
import { isWorkflowFilterRule } from '@buildpad/utils';
import {
  buildDaaSListQuery,
  DaaSRequestError,
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  readDaaSRecord,
  toDaaSRequestError,
  useDaaSRequest,
} from './daasRequest';

const BASE_PATH = '/api/workflow-assignments';

const NOT_FOUND = 'Workflow assignment not found';

const NOT_ANSWERED = 'The server did not answer the saved workflow assignment';

/**
 * Refuses a filter rule that is not an object of conditions before it is
 * sent. One backend stores whatever JSON it is given, and a rule that is an
 * array, a number or text narrows nothing: every item of the collection would
 * get the workflow while the assignment still reads as filtered. The message
 * and the code are the ones the other backend answers.
 */
function assertFilterRule(value: unknown): void {
  if (!isWorkflowFilterRule(value)) {
    throw new DaaSRequestError('filter_rule must be a JSON object or null', {
      kind: 'invalid',
      code: 'INVALID_PAYLOAD',
    });
  }
}

/**
 * Hook for workflow assignment CRUD (`/api/workflow-assignments`): which
 * workflow the items of which collection get. Follows the `useUsers.ts`
 * conventions: `'use client'`, `loading` / `error` state, `useCallback`
 * methods, `apiRequest` transport.
 *
 * Works against both backends. Every method rejects with a
 * `DaaSRequestError`, whose `kind` tells a missing assignment (`notFound`)
 * from a refusal (`forbidden`, `mfaRequired`) from a failure; a load that
 * failed never resolves to an empty list or an empty record.
 *
 * Not to be confused with `useWorkflowAssignment(collection)` (singular),
 * which answers whether one collection has an assignment.
 */
export function useWorkflowAssignments() {
  const { loading, error, errorInfo, run } = useDaaSRequest();

  /**
   * List assignments, newest first. `search` matches the collection name.
   * `page` and `limit` are always sent (defaults 1 and 25); both backends
   * serve at most 100 rows a page.
   *
   * Compare the answer's `totalPages` with the page you asked for
   * (`clampPage`): after a delete the page may no longer exist.
   */
  const fetchAssignments = useCallback(
    (params: WorkflowListParams = {}): Promise<WorkflowListResult<WorkflowAssignmentRecord>> =>
      run(async () => {
        const { page, limit, query } = buildDaaSListQuery(params);
        const result = await apiRequest(`${BASE_PATH}?${query}`);
        return readDaaSListResponse<WorkflowAssignmentRecord>(result, { page, limit });
      }),
    [run],
  );

  /**
   * Get one assignment. Rejects with `kind: 'notFound'` when the id names no
   * assignment the caller may read, including an id that is not a valid one.
   */
  const getAssignment = useCallback(
    (id: string): Promise<WorkflowAssignmentRecord> =>
      run(async () => {
        try {
          const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`);
          return readDaaSRecord<WorkflowAssignmentRecord>(result, NOT_FOUND);
        } catch (err) {
          throw missingWhenIdIsMalformed(toDaaSRequestError(err));
        }
      }),
    [run],
  );

  /**
   * Create an assignment. A `filter_rule` that is not an object (or null) is
   * refused before the request, with `kind: 'invalid'`. Resolves to the new
   * row, with the assigned definition's id and name.
   */
  const createAssignment = useCallback(
    (data: WorkflowAssignmentInput): Promise<WorkflowAssignmentRecord> =>
      run(async () => {
        assertFilterRule(data.filter_rule);
        // No rule is sent as no key: both backends store NULL for an absent one.
        const { filter_rule: filterRule, ...payload } = data;
        const result = await apiRequest(BASE_PATH, {
          method: 'POST',
          body: JSON.stringify(
            filterRule === null || filterRule === undefined
              ? payload
              : { ...payload, filter_rule: filterRule },
          ),
        });
        return readDaaSRecord<WorkflowAssignmentRecord>(result, NOT_ANSWERED, 'failure');
      }),
    [run],
  );

  /**
   * Update an assignment (pass only the keys to change). `filter_rule: null`
   * clears the rule; leaving the key out keeps it. A `filter_rule` that is
   * not an object (or null) is refused before the request.
   */
  const updateAssignment = useCallback(
    (id: string, data: WorkflowAssignmentUpdate): Promise<WorkflowAssignmentRecord> =>
      run(async () => {
        assertFilterRule(data.filter_rule);
        const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return readDaaSRecord<WorkflowAssignmentRecord>(result, NOT_ANSWERED, 'failure');
      }),
    [run],
  );

  /** Delete an assignment. */
  const deleteAssignment = useCallback(
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
    fetchAssignments,
    getAssignment,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  };
}

export default useWorkflowAssignments;

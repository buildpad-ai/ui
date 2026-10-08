/**
 * loadAllWorkflowPolicyOptions: the Command dialog's picker must offer every
 * policy, not the first page of a paged list.
 */
import { describe, it, expect, vi } from 'vitest';
import { loadAllWorkflowPolicyOptions } from '../src/workflowPolicies';

/** A paged policy list of `total` rows, served `limit` at a time. */
function pagedPolicies(total: number) {
  return vi.fn(async ({ page, limit }: { page: number; limit: number }) => {
    const start = (page - 1) * limit;
    const count = Math.max(0, Math.min(limit, total - start));
    return {
      policies: Array.from({ length: count }, (_, i) => ({ id: `p${start + i + 1}`, name: `Policy ${start + i + 1}` })),
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  });
}

describe('loadAllWorkflowPolicyOptions', () => {
  it('reads past the first page: 26 policies are 26 options', async () => {
    const fetchPage = pagedPolicies(26);
    const options = await loadAllWorkflowPolicyOptions(fetchPage);
    expect(options).toHaveLength(26);
    expect(options[25]).toEqual({ id: 'p26', name: 'Policy 26' });
  });

  it('asks for pages of 100 until the last one', async () => {
    const fetchPage = pagedPolicies(250);
    const options = await loadAllWorkflowPolicyOptions(fetchPage);
    expect(options).toHaveLength(250);
    expect(fetchPage.mock.calls.map(([params]) => params)).toEqual([
      { page: 1, limit: 100 },
      { page: 2, limit: 100 },
      { page: 3, limit: 100 },
    ]);
  });

  it('asks once for a list that fits one page, and once for an empty one', async () => {
    const one = pagedPolicies(3);
    expect(await loadAllWorkflowPolicyOptions(one)).toHaveLength(3);
    expect(one).toHaveBeenCalledTimes(1);

    const none = pagedPolicies(0);
    expect(await loadAllWorkflowPolicyOptions(none)).toEqual([]);
    expect(none).toHaveBeenCalledTimes(1);
  });

  it('stops at an empty page even when the count says there is more', async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      policies: page === 1 ? [{ id: 'a', name: 'A' }] : [],
      totalPages: 9,
    }));
    expect(await loadAllWorkflowPolicyOptions(fetchPage)).toEqual([{ id: 'a', name: 'A' }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('offers a policy without a name by its id, and a policy answered twice once', async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      policies:
        page === 1
          ? [
              { id: 'a', name: 'A' },
              { id: 'b', name: null },
            ]
          : [
              { id: 'b', name: null },
              { id: 'c', name: '' },
            ],
      totalPages: 2,
    }));
    expect(await loadAllWorkflowPolicyOptions(fetchPage)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'b' },
      { id: 'c', name: 'c' },
    ]);
  });

  it('rejects with what the page request rejects with', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('Permission denied'));
    await expect(loadAllWorkflowPolicyOptions(fetchPage)).rejects.toThrow('Permission denied');
  });
});

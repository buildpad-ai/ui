/**
 * The policy options of the Add/Edit Command dialog.
 *
 * A command stores the ids of the policies that may run it. The dialog offers
 * policies by name, so it needs the whole list: a picker fed one page of a
 * paged list (25 rows by default) cannot select, or even name, a policy past
 * that page.
 */

/** A policy the Policies tab can offer: its id (what the command stores) and its name. */
export interface WorkflowPolicyOption {
  id: string;
  name: string;
}

/** One page of a policy list, as `usePolicies().fetchPolicies` answers it. */
export interface WorkflowPolicyPage {
  policies: ReadonlyArray<{ id: string; name?: string | null }>;
  totalPages: number;
}

/** Page size of `loadAllWorkflowPolicyOptions`. */
const PAGE_SIZE = 100;

/** Upper bound on the pages `loadAllWorkflowPolicyOptions` reads (10 000 policies). */
const MAX_PAGES = 100;

/**
 * Every policy as a picker option, read page after page through `fetchPage`
 * (pass `usePolicies().fetchPolicies`). A policy without a name is offered by
 * its id. Rejects with whatever `fetchPage` rejects with.
 */
export async function loadAllWorkflowPolicyOptions(
  fetchPage: (params: { page: number; limit: number }) => Promise<WorkflowPolicyPage>,
): Promise<WorkflowPolicyOption[]> {
  const options: WorkflowPolicyOption[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await fetchPage({ page, limit: PAGE_SIZE });
    result.policies.forEach((policy) => {
      // A row inserted while the pages are read can be answered twice
      if (seen.has(policy.id)) return;
      seen.add(policy.id);
      options.push({ id: policy.id, name: policy.name || policy.id });
    });
    if (result.policies.length === 0 || page >= result.totalPages) break;
  }

  return options;
}

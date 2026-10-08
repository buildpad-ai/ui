/**
 * The options of the assignment form's two pickers.
 *
 * An assignment stores the id of a workflow definition and the name of a
 * collection. The form offers both by name, so it needs the whole list of
 * each: a picker fed one page of a paged list (25 rows by default) cannot
 * select a definition past that page, and shows a saved one from past it as
 * blank.
 */
import { toDaaSRequestError } from '@buildpad/hooks';
import { apiRequest } from '@buildpad/services';

/** A workflow definition the Workflow picker can offer: its id (what the assignment stores) and its name. */
export interface WorkflowDefinitionOption {
  id: string;
  name: string;
}

/**
 * The name of every collection the caller can see (`GET /api/collections`),
 * sorted, as the options of the Collection picker.
 *
 * Rejects with a `DaaSRequestError` when the request is refused or fails, and
 * when the answer is not a list — a failed load is never "no collections".
 * One backend serves this route to administrators only; the form falls back
 * to a text field for a caller it refuses.
 */
export async function loadWorkflowCollectionNames(): Promise<string[]> {
  let answer: unknown;
  try {
    answer = await apiRequest<unknown>('/api/collections');
  } catch (err) {
    throw toDaaSRequestError(err);
  }

  // `{ data: [...] }` from both backends (`data: null` for no rows); a bare
  // array is accepted as well
  const data =
    answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as { data?: unknown }).data : answer;
  if (data === null) return [];
  if (!Array.isArray(data)) {
    throw toDaaSRequestError(new Error('The server answered the collections request without a list of collections'));
  }

  const names = new Set<string>();
  data.forEach((row: unknown) => {
    const name = row && typeof row === 'object' ? (row as { collection?: unknown }).collection : row;
    if (typeof name === 'string' && name) names.add(name);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

---
"@buildpad/types": minor
"@buildpad/hooks": minor
"@buildpad/utils": minor
"@buildpad/cli": minor
---

Data layer for a Workflows admin module: types, data hooks, editor logic and translations. No components yet.

- **Types** (`@buildpad/types`, `workflow.ts`): `WorkflowDefinitionRecord`, `WorkflowAssignmentRecord`, `WorkflowInstanceRecord`, `WorkflowHistoryRecord`, the `workflow_json` document (`WorkflowJson`, `WorkflowJsonState`, `WorkflowJsonCommand` with `module_access_keys`, `sourceHandle` and `targetHandle`, `WorkflowJsonAction`), the create and update bodies, and `WorkflowListResult<T>`. The four collection names are constants (`WORKFLOW_COLLECTIONS`: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance`, `daas_wf_history`); gate on these, they are the names the API enforces. The older, narrower `WorkflowAssignment`, `WorkflowState` and `WorkflowInstance` types of `@buildpad/hooks`, and the workflow button's own types, are unchanged.
- **Hooks** (`@buildpad/hooks`): `useWorkflowDefinitions` (list, load every page for a picker, get, create, update, delete), `useWorkflowAssignments` (list, get, create, update, delete) and `useWorkflowInstances` (list, get, full transition history). They work against both backends: list counts are read from `count`/`totalCount`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, `data: null` is an empty page, and `page` and `limit` are always sent.
- **Typed errors** (`@buildpad/hooks`): every method of these hooks rejects with a `DaaSRequestError` whose `kind` is `notFound`, `forbidden`, `mfaRequired`, `unauthenticated`, `invalid` or `failure`, with the status, the backend's error code, and the readable message from `parseDaaSError`. A failed load is never an empty list, and a get never resolves without a record. `toDaaSRequestError`, `readDaaSListResponse`, `buildDaaSListQuery`, `readDaaSRecord` and `useDaaSRequest` are exported for other data hooks.
- **Editor logic** (`@buildpad/utils`): `buildWorkflowCommand` and `buildWorkflowState` build what a dialog saves on top of the stored object, so keys the form has no field for (a command's `module_access_keys`) and the stored key order survive; `findWorkflowCommandProblem`, `findWorkflowStateProblem` and `findWorkflowDefinitionProblem` return what refuses a save, with a code to translate; `applyWorkflowStateSave` and `applyWorkflowCommandSave` apply a dialog's result to the document; `normalizeWorkflowJson` gives every command its `actions` and `policies` arrays; `isWorkflowFilterRule` and `parseWorkflowFilterRule` accept only an object of conditions (or none) as an assignment's filter rule. `clampPage` and `pageAfterRemoval` keep a paged list off a page that no longer exists after a delete.
- **Translations** (`@buildpad/utils`): a `workflows` namespace with English defaults and the Indonesian catalog.

`buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.

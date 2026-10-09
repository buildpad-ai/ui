---
"@buildpad/ui-workflows": minor
---

Workflows module: four fixes that were made in `@buildpad/ui-cron` first.

**A second click on Create no longer makes a second record** (`WorkflowDetail`, `WorkflowAssignmentDetail`)

- After a successful create the component goes on as the editor of the record it created: the title and the breadcrumb are the record's, the button reads Save Changes and waits for an edit, and a further Save is an update of that record. It kept `id="new"` and an enabled Create button, so a host that did not navigate in `onSaved` (or was slow to) created a duplicate on the next click.
- `onSaved` is called as before: with the stored record after a create and after an update. A host no longer has to navigate after a create to stay correct; navigate so the URL names the record (a reload of `/…/new` opens an empty form). A host that compares its own `id` with `'new'` inside `onSaved` sees `'new'` for every save until it navigates.
- A user who may create but not update gets the record it created read-only.
- `WorkflowAssignmentDetail` keeps a collection typed while the save was in flight; the answer replaced it with the collection that was sent.
- A save (or a create) answered after the host gave the component another `id` is no longer drawn over that record. `onSaved` is still called with the record that was saved.

**No write control, and no open form, until the permissions are known** (`WorkflowsManager`, `WorkflowAssignmentsManager`, `WorkflowDetail`, `WorkflowAssignmentDetail`)

- The gates were optimistic while the permissions request ran: for its length a reader was shown Add Workflow / New Assignment, full row menus, Save, an editable form and an editable diagram, and `/…/new` opened its form before turning into access-denied. These controls are now drawn when the permissions are known. Meanwhile the editors are covered by their loading overlay and take no edit, the diagram has no edit control (so neither dialog can open), and a new record's form is neither opened nor refused.
- Reading does not wait: the lists and the records load at once, and are not loaded again when the permissions arrive.
- A later refresh of the permissions (a renewed token, another scope) keeps the controls and the open form as they were until its answer is in.
- The Cancel / Back button keeps its wording: it reads Back only for `readOnly` or once the permissions say the user may not save.
- `WorkflowInstancesManager` and `WorkflowInstanceDetail` have no permission gate and are unchanged.

**A search or a page-size change on a later page is one request** (`WorkflowsManager`, `WorkflowAssignmentsManager`, `WorkflowInstancesManager`)

- On page 2 or later, typing a search, clearing one or picking another page size sent two requests: the new filter for the old page, then the same filter for page 1. The first answer was dropped, so nothing showed on screen, but a backend that refuses a page past the end of the list answered it with an error. The list now sends the one request for page 1. A page restored from the URL is kept as before.

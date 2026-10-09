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

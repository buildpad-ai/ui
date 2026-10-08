---
"@buildpad/ui-interfaces": minor
"@buildpad/cli": minor
---

The workflow button works as a form field again.

- **Item id**: `VForm` hands every interface the record's key as `primaryKey`, but `WorkflowButton` read only `itemId`. Inside a form the button therefore got no id, treated every existing item as new, and showed the placeholder with no current state and no transitions. It now accepts `primaryKey` as well; `itemId` wins when both are given. Only the `workflow-button` component changes — `vform` is untouched.
- **Failed transitions**: a transition the server refused (or that failed) was only logged to the console, so the button went back to the old state without a word. `useWorkflow().executeTransition` still rejects, and now also puts the failure in `errorMessage`, which the button shows. The next transition or refetch clears it. With the built-in fetch client the text is the HTTP status line (`HTTP error! status: 403`); the response body is not read yet.
- **Instance lookup**: `useWorkflow` looked the instance up by `item_id` alone, so item 5 of one collection could show the workflow of item 5 of another. The lookup now filters by `collection` too. Lookups by `translationId` are unchanged.

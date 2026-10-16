---
"@buildpad/services": patch
---

A DaaS answer with no body now raises the service's own error, not a TypeError.

`FieldsService` and `CollectionsService` unwrapped `{ data }` envelopes by reading `.data` straight off the response. When the server answered with no body at all — a 204, or a proxy that dropped it — that threw `Cannot read properties of null (reading 'data')` *before* the method's own guard could run. Callers still saw a rejection, so nothing was silently wrong, but the message named neither the record nor the operation, which made a failed load or a refused DDL call hard to place.

- `FieldsService.readOne` reaches its existing `Field not found: <collection>.<field>` error instead.
- `FieldsService.createField` / `updateField` throw `Could not create|update field <collection>.<field>: the server returned no field`.
- `CollectionsService.createCollection` throws `Could not create collection <collection>: the server returned no collection`, naming the normalized (`fb_`-prefixed) collection.
- `FieldsService.readAll` and `CollectionsService.readByQuery` read a bodiless answer as an empty list. `readByQuery` already resolved `[]` for this case by catching the TypeError; it no longer logs a misleading "Error fetching collections" on the way.

The guards also require the property that identifies the record (`field`, `collection`), because the `?? response` fallback accepted an `{ data: null }` envelope as the record itself — which would have returned `null` typed as a `Field`/`Collection` and pushed the failure into whatever used the result next.

Callers that already handled a rejection need no change; the message is more specific than it was.

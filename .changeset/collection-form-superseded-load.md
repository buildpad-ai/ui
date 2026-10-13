---
"@buildpad/ui-collections": minor
---

`CollectionForm`: a load that was superseded no longer applies its result, and a host re-render with the same props no longer starts a load.

The form loads its fields, permissions and (when editing) its item in an effect. When that effect ran again before the load had finished, the earlier load was left to finish on its own, and each one reset the form when it answered. The effect ran again:

- on every mount in a host that runs React strict mode (development builds only; the Next.js App Router does by default);
- when the host changed `collection`, `id` or `mode`;
- on every re-render of a host that passes `defaultValues`, `excludeFields`, `includeFields` or `definition` as an inline literal, because each render gave the form a new object. `ListO2M` does for the form in its modal, and `ListM2M` for the junction forms in its drawer.

What changes for a user:

- **What was typed is kept.** With two loads in flight the form was drawn by the first answer and reset by the second: a name typed in between was emptied, and Create then saved an item without it. It needed a backend slow enough for the two answers to arrive apart.
- **The form shows the item of the `id` it was given.** An item opened and replaced by another before it had loaded was drawn over the second one when it answered last.
- **An `id` that returns to an item while another was loading loads that item again.** The form kept the guard of the earlier load, loaded nothing, and showed the other item when it answered.

How:

- A superseded load stops at its next step: it sets no state, reports no error and leaves the loading overlay to the load that replaced it. Under strict mode the form is drawn once, by the second load.
- `defaultValues`, `excludeFields`, `includeFields` and `definition` are compared by content (arrays and plain objects member by member, dates by time, anything else by identity). A new object with the same content is not a change, so a host that re-renders while the form is loading neither starts a second load nor cancels the first. A change of content while the form is loading still starts the load again with the new values; after the form has loaded it is ignored, as before.

No prop, callback or test id changes.

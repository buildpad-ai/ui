---
"@buildpad/ui-comments": minor
"@buildpad/cli": minor
"@buildpad/utils": minor
---

New Comments module (`@buildpad/ui-comments`, CLI target `comments`; recipe at /comments): comments for any record. `CommentsKit` shows threads with replies at any depth (the indent shrinks per level), a comment box with bold, italic, underline, bullets and an emoji picker (Ctrl/Cmd+Enter sends, Esc cancels, Enter continues a list), and one-click emoji reactions from a fixed list of twelve, with counts, names in the tooltip and optimistic updates that roll back on a failure. Posting, replying and reacting never blank the list: it stays on screen and is replaced quietly. Comment text is rendered as React nodes only, so a comment cannot inject markup.

The kit talks to its data through a `CommentsAdapter`. `itemsAdapter` is the default: it reads a whole thread in two requests (the top-level comments, then every reply by `root`, with the reactions nested), writes through the app's `/api/items/...` routes under the signed-in user's own permissions, and uses the column names of the `add-comments` skill (`parent`, `root`, `author`, `body`, `photos`, `created_at`; reactions with `emoji`, `reacted_by`, `target_comment`), all overridable. The skill's create hook stamps the author, the thread root and the access. Comments are immutable unless the adapter offers `edit`, `remove` or `resolve`; without `react` the chips are read-only; a viewer who may not comment sees the list and the chips only.

Strings come from the new `comments` namespace of the shared dictionary (English and Bahasa Indonesia); overrides via `BuildpadI18nProvider` or the component's `translations` prop. The CLI gains a `collaboration` category. Not in this version: @mentions, pictures and notification emails.

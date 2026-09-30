---
"@buildpad/ui-interfaces": minor
"@buildpad/cli": minor
---

Sanitize stored block-editor content before rendering it.

`InputBlockEditor` passed a stored value straight to EditorJS, which assigns paragraph, header, quote, list, checklist and table strings to `innerHTML` without sanitizing them — its sanitizer only runs on save and paste. A value saved with `<img src=x onerror=…>` in a paragraph therefore ran script for whoever opened the item, read-only views included.

Every string in a block's data now goes through DOMPurify, limited to the inline markup the editor's own tools produce (bold, italic, underline, inline code, links, marks, line breaks). `javascript:` links and event handlers are removed. Code blocks are left alone: they render as plain text, and markup is their content.

The component gains a `dompurify` dependency; `buildpad add input-block-editor` and `buildpad fix` install it.

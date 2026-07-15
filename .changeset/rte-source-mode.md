---
"@buildpad/ui-interfaces": minor
---

RichTextMarkdown: replace the rendered "Preview" toggle with an editable raw-Markdown "Source" mode. The WYSIWYG editor renders Markdown as you type (it is the preview), which made a separate Preview mode redundant and confusing. Source mode shows the underlying Markdown in a monospace textarea; edits flow through `onChange` immediately and re-parse into the rich editor when switching back. The `previewFont` prop is deprecated (kept for type compatibility, no effect).

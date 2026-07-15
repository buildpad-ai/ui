---
"@buildpad/ui-interfaces": minor
---

RichTextMarkdown now persists and round-trips Markdown instead of HTML. It parses the `value` prop as Markdown on load, serializes the document back to Markdown through `onChange`, and renders the preview from Markdown. Adds GFM table support so tables round-trip as real table nodes (the toolbar "table" action now inserts a table node), and reinterprets Markdown source pasted from a rendered code fence instead of trapping the whole document in a single code block.

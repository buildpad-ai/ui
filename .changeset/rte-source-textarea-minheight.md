---
"@buildpad/ui-interfaces": patch
---

RichTextMarkdown: fix a crash when opening Source mode — react-textarea-autosize (behind Mantine's `autosize` Textarea) rejects `style.minHeight`; the height floor now comes from `minRows` alone. This fix was part of the Source-mode branch but missed the 1.9.0 merge window.

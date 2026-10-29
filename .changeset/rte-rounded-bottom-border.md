---
"@buildpad/ui-interfaces": patch
---

RichTextHTML's bottom border is no longer clipped at the rounded corners. The editable area painted a square white background over the root's 8px-radius border; it now relies on the content wrapper's rounded background instead.

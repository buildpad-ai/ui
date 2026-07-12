---
'@buildpad/ui-collections': patch
---

`CollectionForm`'s split save button (Save + SaveOptions caret) no longer
renders with a gap in host apps whose Mantine theme forces `Group` gap via
`theme.components.Group.styles.root` — theme styles are applied inline and
override the `gap={0}` prop, so the group now also sets an inline
`style={{ gap: 0 }}`, which takes precedence over both.

---
"@buildpad/ui-collections": minor
---

`CollectionList` offers the audit fields again. `date_created`, `date_updated`, `user_created` and `user_updated` were dropped from the field list entirely, so they could never be added as a column under **Add field**, filtered on or sorted by. They are now in the field list like any other field, and are still left out when the list picks its first five default columns.

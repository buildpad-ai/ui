---
"@buildpad/services": minor
"@buildpad/cli": minor
---

Permission filters fail closed.

`filter-to-query` translated DaaS permission filters into Supabase queries by dropping whatever it could not express: an unknown operator, a relational path such as `{ owner: { id: { _eq: "$CURRENT_USER" } } }`, an `_in` whose value was not an array (every `_in: "$CURRENT_ROLES"`), or a dynamic variable it did not resolve. The query then ran without that restriction and returned every row — and static-token users run through the service-role client, so RLS did not catch it.

Any filter the translator cannot enforce faithfully now throws `UnsupportedPermissionFilterError` (a 403 `PermissionError`). `getPermissionFilters` turns that into its deny-all filter; `applyFilterToQuery` throws it to the caller. Values inside `.or()` and `in.(…)` strings are quoted and escaped, closing a PostgREST filter-string injection.

`$CURRENT_ROLES`, `$CURRENT_POLICIES` and `$NOW` are now resolved; `$CURRENT_USER.<field>`, `$NOW(<offset>)` and `$FOLLOW` deny.

Behaviour changes to check against your permissions:
- A filter that "worked" because part of it was silently dropped now denies.
- `_contains` / `_ncontains` are substring matches, as the permission editor describes them. They were translated to array containment, which errors on text columns. `_nicontains`, `_istarts_with`, `_nistarts_with`, `_iends_with`, `_niends_with` and `_regex` are new.
- `_empty` / `_nempty` match NULL or `''` (previously NULL only).
- `_null` / `_nnull` require a boolean; `_eq: null` throws (use `_null`); an empty `_or: []` denies.
- `$CURRENT_ROLE` for a user with no role denies (it resolved to `null`).

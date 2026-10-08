---
"@buildpad/hooks": minor
"@buildpad/cli": minor
---

`parseDaaSError` reads a top-level `{ "message": "…" }` body.

It knew `{ errors: [{ message }] }` and `{ error }` only. Both backends answer some refusals as `{ message }` — the workflow-transition 403, and the Go engine's transition envelope when it carries no `errors` — and those reached the user as the raw `API error: 403 - {"message":"…"}` string. `message` is read last, so a body that also has `errors` or `error` gives the same text as before.

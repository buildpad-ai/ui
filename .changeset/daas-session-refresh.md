---
"@buildpad/services": minor
"@buildpad/cli": minor
---

An idle tab no longer shows "Could not load …" until it is reloaded. `DaaSConfig` gains `renewToken`: on a 401, `apiRequest` gets a new token once and retries. `DaaSProvider` re-reads its stored token when the tab comes back and every 4 minutes. `api-routes` (and `api-routes-engine`) now install `app/api/auth/token` and `lib/daas-token`, and `DaaSProviderWrapper` renews an expired or missing browser token from the server's session, reloading to the login page only when there is no session at all.

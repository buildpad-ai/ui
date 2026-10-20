---
"@buildpad/cli": minor
---

My Apps sign-in on an Engine project: the `external-oauth-engine` lib module.

`buildpad add external-oauth`, `add --with-api` and `bootstrap` read the project's backend from `.buildpad/project.json` (then `.buildpad/backend-answer.json`). On an Engine project they install `external-oauth-engine`:

- `GET /api/auth/oauth/my-apps` starts the authorization-code flow with PKCE, a random `state` and a raw nonce kept in one httpOnly cookie, and sends My Apps the nonce's SHA-256 hex.
- `GET /api/auth/callback` checks `state`, exchanges the code server-side with `OAUTH_CLIENT_SECRET`, and signs in to the Engine with `supabase.auth.signInWithIdToken({ provider: 'my-apps', token, nonce })` on a client that sends `X-Tenant-Id`. It writes the session cookies in the format `lib/supabase/*` reads, and clears the flow cookie on every answer. No service-role key, admin API, magic link or role write; no token is logged.
- An account the Engine created on its first sign-in holds no role: its session is ended and the user lands on `/auth/pending-access`. The Engine's refusals (`invalid_credentials`, `user_banned`, unavailable) become `?error=` codes that the Engine `OAuthLoginButtons` explains.

The module replaces unmodified copies of `external-oauth`'s files and api-routes' callback, keeps edited ones (with a warning), and supersedes `external-oauth` in `buildpad.json`. A Supabase project, or one that records no backend, still gets `external-oauth`, unchanged. `upgrade` on an Engine project that still has `external-oauth` says how to switch.

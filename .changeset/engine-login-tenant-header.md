---
"@buildpad/cli": patch
---

Password sign-in on an Engine project names the project's tenant.

`lib/supabase/server.ts` (installed by `supabase-auth`) sends `X-Tenant-Id: $NEXT_PUBLIC_BUILDPAD_TENANT_ID` as a supabase-js global header when that variable is set. `POST /api/auth/login` signs in through this client, so the Engine's `/auth/v1/token?grant_type=password` now binds the session to the app's tenant instead of choosing one by its own rule. Every other server call through `createClient()` sends it too; the Engine consults it only on requests without a session token.

On a Supabase project the variable is unset and the client is created with the same options as before. `buildpad upgrade` offers the new file; an unmodified copy updates cleanly.

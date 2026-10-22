---
"@buildpad/cli": patch
---

The Engine sign-in templates (`external-oauth-engine`) now name the product XAppHub instead of My Apps.

The login button says "Continue with XAppHub", and the sign-in error messages, the `/auth/pending-access` page and the server messages say XAppHub. This is display text only: the `my-apps` provider sent to `signInWithIdToken`, the `/api/auth/oauth/my-apps` route, the `OAUTH_*` and `MY_APPS_*` variables, file names and the module name are unchanged. `buildpad upgrade` offers the new files; unmodified copies update cleanly.

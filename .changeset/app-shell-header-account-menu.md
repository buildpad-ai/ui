---
"@buildpad/cli": minor
---

The `AuthenticatedShell` account menu moves from the bottom of the sidebar to the top right of the header. The trigger shows the user's avatar, name and a chevron (the avatar alone below `sm`), and the menu opens underneath with the name and email at the top. The new `.bp-header-user-button` style ships in `app/globals.css`; `.bp-user-profile-button` stays for shells generated before this change. Existing apps pick up the new shell when they re-add `components/layout/AuthenticatedShell.tsx`.

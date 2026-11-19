---
"@buildpad/ui-notifications": minor
"@buildpad/utils": patch
"@buildpad/ui-comments": patch
"@buildpad/cli": patch
---

New `@buildpad/ui-notifications` package (registry component `notifications`): one notification bell and inbox for every Buildpad app, with an unread badge, a filtered inbox and a detail pane to reply and act, behind a small adapter. `@buildpad/utils` gains the notifications i18n strings, `@buildpad/ui-comments`' comment mail service can also create in-app notifications (off by default), and the CLI maps `@buildpad/ui-notifications` imports to `components/ui/notifications`.

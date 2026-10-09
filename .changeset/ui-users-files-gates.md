---
"@buildpad/ui-users": minor
---

Users and Files modules: the fixes that were made in `@buildpad/ui-cron` and `@buildpad/ui-workflows` first.

**No write control, and no open form, until the permissions are known** (`UsersManager`, `RolesManager`, `PoliciesManager`, `ModuleAccessKeysManager`, `UserDetail`, `RoleDetail`, `PolicyDetail`)

- The gates were optimistic while the permissions request ran: for its length a reader was shown Add User / Add Role / Add Policy / Add Folder / Add Key, full row menus, the selection column with its bulk actions, rows that open the editor, Save, Delete and an open form, and `/…/new` showed Create. These controls are now drawn when the permissions are known. Meanwhile the three forms are covered by their loading overlay and take no edit (the fields are disabled, and so are the permissions matrix and the module-level grants of a policy).
- Reading does not wait: the lists and the records load at once, and are not loaded again when the permissions arrive.
- A later refresh of the permissions (a renewed token, another scope) keeps the controls, the selection and the open form as they were until its answer is in.
- For a browser test: wait for the control (`users-manager-add-btn`, a row menu, `user-detail-save-btn`, …) instead of clicking as soon as the list or the form is drawn; a row click that opens a record works once the permissions are known. The forms have a wrapper with `data-testid` `user-detail-form` / `role-detail-form` / `policy-detail-form`, disabled until then.
- `RoleUsersManager`, `RolePoliciesManager`, `UserPoliciesManager`, `PolicyAttachmentManager` and `ModuleAccessPanel` have no permission gate and are unchanged.

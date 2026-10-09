---
"@buildpad/ui-users": minor
"@buildpad/ui-files": minor
"@buildpad/utils": minor
---

Users and Files modules: the fixes that were made in `@buildpad/ui-cron` and `@buildpad/ui-workflows` first.

**A second click on Create or Save no longer makes a second record** (`UserDetail`, `RoleDetail`, `PolicyDetail`)

- After a successful create the component goes on as the editor of the record it created: the title is Edit User / Edit Role / Edit Policy, Delete, the tabs of a stored record and the info panel are drawn (for a policy, the permissions matrix), `UserDetail`'s and `PolicyDetail`'s button reads Save and waits for an edit, and a further Save is an update of that record. The components kept `id="new"` and an enabled Create / Save, so a host that did not navigate in `onSaved` (or was slow to) created a duplicate role or policy on the next click. (For a user the second create was refused by the form, which wanted the password again, and with the password typed again by the backend, which has one user per email.)
- `RoleDetail`: after a create with **Save & Add New** the form is emptied for the next role instead of staying filled with the role just created; a second pick of a Save action while the first is in flight is ignored.
- `onSaved` is called as before: with the stored record (and for a role the chosen action) after a create and after an update. A host no longer has to navigate after a create to stay correct; navigate so the URL names the record (a reload of `/…/new` opens an empty form). A host that compares its own `id` with `'new'` inside `onSaved` sees `'new'` for every save until it navigates. The generated pages are unchanged.
- What is typed while a save is in flight is kept as an unsaved edit. `UserDetail` wrote the values it had sent back into the form, and `RoleDetail`'s Save & Stay reloaded the role over them.
- A save (or a create) answered after the host gave the component another `id` is no longer drawn over that record, and neither is a slow load of the record opened before. `onSaved` is still called with the record that was saved. A policy's unsaved matrix edits are dropped when another policy is opened in the same component; they were applied to that policy on its next Save.
- An `id` that changes to `'new'` in place opens an empty form; it kept the values of the record shown before.
- A change of language (or of a `translations` override) no longer loads the record again; the reload reset a form with unsaved edits.

**No write control, and no open form, until the permissions are known** (`UsersManager`, `RolesManager`, `PoliciesManager`, `ModuleAccessKeysManager`, `UserDetail`, `RoleDetail`, `PolicyDetail`)

- The gates were optimistic while the permissions request ran: for its length a reader was shown Add User / Add Role / Add Policy / Add Folder / Add Key, full row menus, the selection column with its bulk actions, rows that open the editor, Save, Delete and an open form, and `/…/new` showed Create. These controls are now drawn when the permissions are known. Meanwhile the three forms are covered by their loading overlay and take no edit (the fields are disabled, and so are the permissions matrix and the module-level grants of a policy).
- Reading does not wait: the lists and the records load at once, and are not loaded again when the permissions arrive.
- A later refresh of the permissions (a renewed token, another scope) keeps the controls, the selection and the open form as they were until its answer is in.
- For a browser test: wait for the control (`users-manager-add-btn`, a row menu, `user-detail-save-btn`, …) instead of clicking as soon as the list or the form is drawn; a row click that opens a record works once the permissions are known. The forms have a wrapper with `data-testid` `user-detail-form` / `role-detail-form` / `policy-detail-form`, disabled until then.
- `RoleUsersManager`, `RolePoliciesManager`, `UserPoliciesManager`, `PolicyAttachmentManager` and `ModuleAccessPanel` have no permission gate and are unchanged.

**Files: no write control until the permissions are known** (`FileManager`, `FileDetail`)

- The same optimistic gates: for the length of the permissions request a reader was shown the upload zone (and could drop a file on it), New Folder, the folder menus, Edit / Delete in the list's row menu, the bulk bar, and on the detail page Delete, Replace file and an enabled metadata form. They are now drawn (and the form enabled) when the permissions are known. `FilesToolbar`, `BulkActionsBar`, `FilesGrid`, `FilesList`, `NewFolderDialog` and `FileMetadataForm` take their gates from these two and need no change.
- Reading does not wait: the library, the file, its preview and its downloads load at once, and are not loaded again when the permissions arrive. A file still opens on a click, and a selection made meanwhile gets its bulk bar when the answer is in.
- A later refresh of the permissions keeps the controls, an upload in flight and a half-typed metadata form as they were.
- The empty library says "No files here yet." alone until the permissions are known; the hint after it ("Drag files above…" or "No files are available.") follows.
- For a browser test: wait for `upload-dropzone`, `files-new-folder`, `file-detail-delete` or `file-detail-replace` instead of acting as soon as the library or the file is drawn.

**Files: Enter in the New Folder dialog no longer makes a second folder** (`NewFolderDialog`, `FileManager`)

- The dialog's button is disabled while the folder is being created or renamed, but Enter in its field was not: pressed again (or held) while the request was out, it sent the same name once more, and the backend stored a second folder with that name. Enter now waits like the button.
- Upload, import from URL, Replace file, the metadata Save and the delete confirmations could not be sent twice by a second click and are unchanged. A second DROP on the upload zone while an upload is in flight still starts a second upload; that is `Upload` in `@buildpad/ui-interfaces`, and is left as it is.

**A search, filter, sort or page-size change on a later page is one request** (`UsersManager`, `RolesManager`, `PoliciesManager`)

- On page 2 or later, typing a search, clearing one, picking a role or status filter, sorting a column or picking another page size sent two requests: the new filter for the old page, then the same filter for page 1. The answers could arrive in either order (the lists draw whichever comes last), and a backend that refuses a page past the end of the list answered the first with an error. The list now sends the one request for page 1. A page restored from the URL is kept as before.
- `ModuleAccessKeysManager` (one request for the whole tree, searched in the browser), `RoleUsersManager` and the policy picker do not page and are unchanged.

**The footer names one row in the singular** (`@buildpad/utils` `users` namespace, `ListFooter`, the three lists)

- A list of one read "Showing 1 of 1 users" / "roles" / "policies". `usersManager.itemsLabel`, `rolesManager.itemsLabel` and `policiesManager.itemsLabel` are now plural forms (`{ one: 'user', other: 'users' }`), as the namespace's `count` entries are, and the footer picks the form the locale's plural rules give the TOTAL: "Showing 1 of 1 user", "Showing 1 of 26 users". Indonesian nouns have one form: `{ other: 'pengguna' }`.
- An override of one of these three keys (a `translations` prop, a provider dictionary) is now typed as plural forms. A dictionary that still holds one string there keeps working: the footer shows the string as it is.
- `ListFooter`'s `itemsLabel` prop takes plural forms or, as before, one string.


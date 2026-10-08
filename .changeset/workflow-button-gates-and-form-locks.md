---
"@buildpad/ui-interfaces": patch
"@buildpad/ui-form": patch
---

WorkflowButton offers the commands the server will accept, and works inside a form.

**`useWorkflow` / `WorkflowButton`**

- A command gated by `module_access_keys` is now filtered by the user's module access. The hook
  only read `policies`, so a key-gated command was offered to everyone and refused with 403 on click.
- The user's policies are read from `GET /api/policies/me`. The earlier lookup read a `policies`
  list off `/api/auth/user` / `/api/users/me`, which neither route returns, so a policy-gated
  command was hidden from the users it was granted to. That lookup remains as the fallback.
- An administrator is offered every command, matching `usePermissions().hasModuleAccess`.
- The default API client sends requests to the configured DaaS origin with the session token and
  scope header, like the other data hooks. The paths were fetched relative to the page, so an app
  scaffolded by the CLI needed a proxy route per path — and had none for
  `/api/workflow/transition`, so every transition answered 404. With no DaaS URL configured the
  paths stay relative.
- A refused request reports the server's reason ("You are not authorized to perform this
  transition") instead of `HTTP error! status: 403`.

**`FormFieldInterface`**

- A workflow field's `readonly` / non-editable state no longer makes the button inert. Those locks
  say the column may not be edited; who may run a transition is decided by the command's gates.
  The Studio's own wizard creates the state field `readonly`, which disabled the button in forms.
  The form-level `disabled` still turns it off.
- The button is no longer wired to the form's `onChange`. It reports the command it ran, so the
  command name ("Submit") landed in the form's edits under the state field and the next save wrote
  it over the real state.

# @buildpad/ui-workflows

## 3.0.0

### Minor Changes

- 3fd3c13: New Workflows module: the `@buildpad/ui-workflows` package, the `workflow-management` registry component and the `workflows-routes` lib module. `buildpad add workflows-routes` installs the whole feature.

  - **Definitions** (`WorkflowsManager`, `WorkflowDetail`): the list with search, paging and permission-gated create, edit and delete; the editor with the name, the description and the state machine drawn as a diagram. States and commands are edited in dialogs (`WorkflowStateModal`, `WorkflowCommandModal`: target state, policies, module access keys kept as stored, actions with JSON parameters) or on the canvas (drag a state, draw a connection, move an edge, delete with the menu or the keyboard). `WorkflowDiagram` is exported on its own for a read-only diagram on another page.
  - **Assignments** (`WorkflowAssignmentsManager`, `WorkflowAssignmentDetail`): which workflow the items of which collection get, with an optional filter rule edited as JSON.
  - **Instances** (`WorkflowInstancesManager`, `WorkflowInstanceDetail`): read-only list and detail with the current state, the diagram and the whole transition history.
  - A command is also added from a state's menu (Add Command), so the editor can be worked with the keyboard: a connection can only be drawn with a pointer. An action's Parameters must be a JSON object; the Go engine refuses a definition that stores anything else there.
  - A definition answered without `workflow_json` (the caller's read grant withholds the field) shows a notice in place of the diagram. It is not drawn as an empty machine and the document is never sent, so a save cannot replace the stored one.
  - Navigation is by callback props (`onWorkflowClick`, `onCreateWorkflow`, `onAssignmentClick`, `onCreateAssignment`, `onInstanceClick`, `onBack`, `onSaved`). A detail component keeps `id="new"` after a create, so the page must navigate in `onSaved`; the installed pages do.
  - Permissions are checked on the collections the API enforces: `daas_wf_definition`, `daas_wf_assignment`, `daas_wf_instance` and `daas_wf_history`. Not-found, access-denied and load-error states are drawn as such, never as an empty list.
  - Both backends are supported through the `useWorkflowDefinitions`, `useWorkflowAssignments` and `useWorkflowInstances` hooks.
  - Strings come from the `workflows` namespace (English and Indonesian); every component takes a `translations` override.

  **New npm dependency: `@xyflow/react`** (React Flow 12, MIT) draws the diagram. `add` and `upgrade` install it pinned to `^12.9.3`, and `fix` knows it. `WorkflowDiagram` imports `@xyflow/react/dist/style.css` itself. React Flow shows an attribution on the canvas; `hideAttribution` removes it, which its authors ask organisations to pair with supporting the project.

  **Registry and CLI**

  - `workflow-management` (category `workflow`, not part of `add --all`): 22 files under `components/ui/workflow-management/`; depends on the `types`, `hooks`, `services` and `utils` lib modules and on the `vtable` component.
  - `workflows-routes`: six pages under `app/[lang]/(authenticated)/` (`/workflows`, `/workflows/[id]`, `/workflow-assignments`, `/workflow-assignments/[id]`, `/workflow-instances`, `/workflow-instances/[id]`) and three sidebar entries in a new Automation section. The app dictionary gains `app.nav.workflows`, `app.nav.workflowAssignments`, `app.nav.workflowInstances` and `app.nav.automation`; an existing app gets them from `buildpad upgrade i18n`, and the sidebar shows the English labels until then.
  - `@buildpad/ui-workflows` imports are rewritten to `@/components/ui/workflow-management` (subpaths kebab-cased).
  - `buildpad add` installs a component's missing npm dependencies before it validates the project. It validated first, and validation exits on a type error, so adding a component whose npm package the app did not have yet (here `@xyflow/react`) ended with `TS2307: Cannot find module` and exit code 1, without installing the package or printing the install command. Modules whose dependencies `bootstrap` already installs were not affected.
  - `@buildpad/mcp` embeds the same registry, so `list_components`, `list_lib_modules` and `copy_component` serve both entries.

  **Utils additions the editor uses** (`@buildpad/utils`): the diagram gestures as functions from one document to the next (`removeWorkflowState`, `removeWorkflowCommand`, `moveWorkflowState`, `reconnectWorkflowCommand`), `findWorkflowConnectionProblem` (no command out of an end state, back to its own state, or to something that is no state), the end-state check of `findWorkflowStateProblem` (an end state cannot be given to a state that has commands), and `splitRichText` for strings that carry `<tag>…</tag>` markers.

  Storybook: `pnpm storybook:workflows` (port 6013), built with the others by `pnpm build:storybook`. Docs: the Workflows Module Recipe page.

### Patch Changes

- Updated dependencies [37df067]
- Updated dependencies [9544e24]
- Updated dependencies [78f5d65]
- Updated dependencies [eddcba0]
- Updated dependencies [443b901]
- Updated dependencies [60ae923]
- Updated dependencies [b4030ca]
- Updated dependencies [3fd3c13]
- Updated dependencies [5147727]
- Updated dependencies [42ab7ff]
  - @buildpad/hooks@3.0.0
  - @buildpad/utils@3.0.0
  - @buildpad/services@3.0.0
  - @buildpad/types@3.0.0
  - @buildpad/ui-table@3.0.0

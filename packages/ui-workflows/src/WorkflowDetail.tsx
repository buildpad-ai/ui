'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Grid,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DaaSRequestError, usePermissions, usePolicies, useWorkflowDefinitions } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import {
  WORKFLOW_DEFINITION_COLLECTION,
  type WorkflowDefinitionRecord,
  type WorkflowDefinitionUpdate,
  type WorkflowJson,
  type WorkflowJsonCommand,
  type WorkflowJsonState,
} from '@buildpad/types';
import {
  applyWorkflowCommandSave,
  applyWorkflowStateSave,
  findWorkflowDefinitionProblem,
  interpolate,
  normalizeWorkflowJson,
  type DeepPartial,
  type WorkflowsTranslations,
} from '@buildpad/utils';
import { WorkflowCommandModal } from './WorkflowCommandModal';
import { WorkflowDiagram } from './WorkflowDiagram';
import { WorkflowPageState } from './WorkflowPageState';
import { WorkflowStateModal } from './WorkflowStateModal';
import { loadAllWorkflowPolicyOptions, type WorkflowPolicyOption } from './workflowPolicies';

/** What the editor edits: the three writable keys of a definition. */
interface WorkflowForm {
  name: string;
  description: string;
  workflow_json: WorkflowJson;
}

const EMPTY_FORM: WorkflowForm = {
  name: '',
  description: '',
  workflow_json: { initial_state: '', states: [] },
};

/** Why there is no definition to edit. */
type LoadFailure =
  | { kind: 'notFound' }
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

/** The Add/Edit Command dialog's subject: a stored command, or a connection that was drawn. */
interface CommandDraft {
  stateName: string;
  command: WorkflowJsonCommand | null;
  targetState?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** Whether two forms hold the same definition, as the unsaved-changes badge reads it. */
function sameForm(a: WorkflowForm, b: WorkflowForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface WorkflowDetailProps {
  /** ID of the definition to edit, or `'new'` to create one. */
  id: string;
  /**
   * Called by Cancel, by the breadcrumb back to the list, and by the Back
   * button of the not-found, access-denied and load-error states. Without it
   * none of those controls is drawn.
   */
  onBack?: () => void;
  /**
   * Called after a successful create or update with the definition as it was
   * saved (a created one carries its new id). The reference admin UI returns
   * to the list after a create and stays on the editor after an update. The
   * component itself goes nowhere: after a create it becomes the editor of the
   * definition it created, so a further Save updates that definition whether
   * or not the host has navigated yet.
   */
  onSaved?: (workflow: WorkflowDefinitionRecord) => void;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_wf_definition', the
   * name both backends enforce.
   */
  workflowsCollection?: string;
  /**
   * Show the definition without any way to change it. A user without update
   * access gets the same view whatever this says. Default: false.
   */
  readOnly?: boolean;
  /**
   * The policies the Command dialog offers. Pass every policy, not one page.
   * Default: all policies are loaded through `usePolicies` (which needs read
   * access to `daas_policies`) the first time the dialog opens.
   */
  policies?: WorkflowPolicyOption[];
  /** Loads the policies the Command dialog offers, in place of the default loader. */
  loadPolicies?: () => Promise<WorkflowPolicyOption[]>;
  /** Height of the state diagram (CSS length or pixels). Default: 600. */
  diagramHeight?: number | string;
  /** Hide React Flow's attribution on the diagram; see `WorkflowDiagram`. Default: false. */
  hideAttribution?: boolean;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Workflow definition editor: name and description, statistics, a states
 * overview, and the state diagram with its State and Command dialogs. The
 * whole machine is one `workflow_json` document, saved with one request.
 * Ported from the buildpad-daas reference `app/[lang]/workflows/[id]/page.tsx`
 * to `useWorkflowDefinitions` + `usePermissions` and routing-agnostic
 * navigation through `onBack` / `onSaved`.
 *
 * What differs from the reference, on purpose:
 *
 * - A definition that does not exist, one the caller may not read, and a load
 *   that failed each draw their own state. The reference drew a blank,
 *   editable form for all three, and Save would have written to a missing id.
 * - The stored document is normalised on load (`normalizeWorkflowJson`), so a
 *   command written through the API without `actions` or `policies` opens.
 * - There are no links: the breadcrumb and Cancel call `onBack`, so the host
 *   app's router (and its locale prefix) decides where "back" is.
 * - A user who may not save gets a read-only editor instead of an editable
 *   form with no Save button.
 * - An update sends only the keys that changed, and Save Changes is disabled
 *   while there is nothing to save.
 * - A definition answered without its `workflow_json` (the caller's grant
 *   withholds the column) says so in place of the statistics and the diagram.
 *   It is not an empty machine: drawn as one, a state added to it and saved
 *   would replace the stored document. The name and the description can
 *   still be edited, and the document is never sent.
 * - After a create the editor is the stored definition's: a second Save
 *   updates it. Nothing is created twice when the host is slow to navigate,
 *   or does not.
 * - A save answered after the host opened another definition in the same
 *   editor is not drawn over that definition.
 */
export const WorkflowDetail: React.FC<WorkflowDetailProps> = ({
  id,
  onBack,
  onSaved,
  workflowsCollection = WORKFLOW_DEFINITION_COLLECTION,
  readOnly = false,
  policies,
  loadPolicies,
  diagramHeight,
  hideAttribution = false,
  translations,
}) => {
  const newRoute = id === 'new' || id === '+';
  // The definition this editor created while `id` still says "new". From then
  // on it edits that definition: a second Save must update it, not create it
  // once more, whether or not the host has navigated to its own route yet.
  const [created, setCreated] = useState<WorkflowDefinitionRecord | null>(null);
  const isNew = newRoute && !created;
  const definitionId = newRoute && created ? created.id : id;
  const { getDefinition, createDefinition, updateDefinition } = useWorkflowDefinitions();
  const { fetchPolicies } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [workflowsCollection],
  });
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);

  const createAllowed = permsLoading || isAdmin || canPerform(workflowsCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(workflowsCollection, 'update');
  const saveAllowed = isNew ? createAllowed : updateAllowed;
  const viewOnly = readOnly || !saveAllowed;

  const [record, setRecord] = useState<WorkflowDefinitionRecord | null>(null);
  // The definition was answered without its document: the caller's grant
  // withholds the column, which is not the same as a machine without states
  const documentWithheld = !isNew && record !== null && record.workflow_json === undefined;
  const [loading, setLoading] = useState(!newRoute);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // The definition as loaded (or last saved), to tell what was edited
  const [initial, setInitial] = useState<WorkflowForm>(EMPTY_FORM);
  const [form, setForm] = useState<WorkflowForm>(EMPTY_FORM);
  const hasEdits = useMemo(() => !sameForm(initial, form), [initial, form]);

  // Dialogs
  const [stateModalOpened, setStateModalOpened] = useState(false);
  const [editingState, setEditingState] = useState<WorkflowJsonState | null>(null);
  const [commandModalOpened, setCommandModalOpened] = useState(false);
  const [commandDraft, setCommandDraft] = useState<CommandDraft>({ stateName: '', command: null });

  const requestRef = useRef(0);

  // Keyed on the `id` it is given, not on the definition a create adopted:
  // the load runs when the host opens another definition (or a new one), and
  // not for the definition that was just created here.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setFailure(null);
    setCreated(null);
    if (newRoute) {
      setRecord(null);
      setInitial(EMPTY_FORM);
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetched = await getDefinition(id);
      if (request !== requestRef.current) return;
      const loaded: WorkflowForm = {
        name: fetched.name ?? '',
        description: fetched.description ?? '',
        // Every state gets its commands array and every command its actions
        // and policies arrays, whatever wrote the document
        workflow_json: normalizeWorkflowJson(fetched.workflow_json),
      };
      setRecord(fetched);
      setInitial(loaded);
      setForm(loaded);
    } catch (err) {
      if (request !== requestRef.current) return;
      const message = err instanceof Error && err.message ? err.message : t.workflowDetail.notifications.fetchFailed;
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      setRecord(null);
      if (kind === 'notFound') {
        setFailure({ kind: 'notFound' });
      } else if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({
          title: t.workflowDetail.notifications.fetchFailed,
          message,
          color: 'red',
        });
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [getDefinition, id, newRoute, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Every policy, read once per editor and only when the Command dialog asks
  const policyOptionsRef = useRef<Promise<WorkflowPolicyOption[]> | null>(null);
  const loadPolicyOptions = useCallback((): Promise<WorkflowPolicyOption[]> => {
    if (loadPolicies) return loadPolicies();
    if (!policyOptionsRef.current) {
      const pending = loadAllWorkflowPolicyOptions(fetchPolicies);
      policyOptionsRef.current = pending;
      // A failed load is not remembered: the next time the dialog opens it tries again
      pending.catch(() => {
        if (policyOptionsRef.current === pending) policyOptionsRef.current = null;
      });
    }
    return policyOptionsRef.current;
  }, [loadPolicies, fetchPolicies]);

  const handleSave = useCallback(async () => {
    if (savingRef.current || viewOnly) return;

    // A document the editor was not given has no states to check, and is not sent
    const problem = findWorkflowDefinitionProblem(form);
    if (problem && (problem.code === 'nameRequired' || !documentWithheld)) {
      notifications.show({
        title: t.validationErrorTitle,
        message: t.workflowDetail.validation[problem.code],
        color: 'red',
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    // The answer belongs to the definition on screen now. When the host has
    // opened another one by the time it arrives, it must not be drawn over
    // that definition.
    const shown = requestRef.current;
    const stillShown = () => shown === requestRef.current;
    try {
      const description = form.description.trim() ? form.description : null;
      let savedId = definitionId;
      if (isNew) {
        savedId = await createDefinition({
          name: form.name,
          description,
          workflow_json: form.workflow_json,
        });
      } else {
        // Only the keys that changed: a grant that withholds a field refuses a
        // write that names it, changed or not
        const edits: WorkflowDefinitionUpdate = {};
        if (form.name !== initial.name) edits.name = form.name;
        if (form.description !== initial.description) edits.description = description;
        // Never a document the editor was not given: it would replace the stored one
        if (
          !documentWithheld &&
          JSON.stringify(form.workflow_json) !== JSON.stringify(initial.workflow_json)
        ) {
          edits.workflow_json = form.workflow_json;
        }
        await updateDefinition(definitionId, edits);
      }

      notifications.show({
        title: common.success,
        message: isNew ? t.workflowDetail.notifications.created : t.workflowDetail.notifications.updated,
        color: 'green',
      });

      const saved: WorkflowDefinitionRecord = {
        ...record,
        id: savedId,
        name: form.name,
        description,
        ...(documentWithheld ? {} : { workflow_json: form.workflow_json }),
      };
      if (stillShown()) {
        // What was sent is what is stored now. `form` is the form as it was
        // when the request left: an edit made since then (the request takes a
        // while, and the inputs stay open) differs from it, and stays unsaved.
        setInitial(form);
        setRecord(saved);
        // A created definition is the one on screen from here on, so the next
        // Save updates it; where to go next is the host's to say
        if (isNew) setCreated(saved);
      }
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error && err.message ? err.message : t.workflowDetail.notifications.saveFailed,
        color: 'red',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    viewOnly,
    form,
    initial,
    definitionId,
    isNew,
    record,
    documentWithheld,
    createDefinition,
    updateDefinition,
    onSaved,
    t,
    common,
  ]);

  const handleWorkflowJsonChange = useCallback((workflowJson: WorkflowJson) => {
    setForm((prev) => ({ ...prev, workflow_json: workflowJson }));
  }, []);

  // State dialog
  const handleAddState = useCallback(() => {
    setEditingState(null);
    setStateModalOpened(true);
  }, []);

  const handleEditState = useCallback((state: WorkflowJsonState) => {
    setEditingState(state);
    setStateModalOpened(true);
  }, []);

  const handleSaveState = (state: WorkflowJsonState, stateIsNew: boolean, isInitial: boolean) => {
    setForm((prev) => ({
      ...prev,
      workflow_json: applyWorkflowStateSave(prev.workflow_json, state, {
        originalName: stateIsNew ? null : editingState?.name,
        isInitial,
      }),
    }));
  };

  // Command dialog
  const handleAddCommand = useCallback(
    (stateName: string, targetState?: string, sourceHandle?: string, targetHandle?: string) => {
      setCommandDraft({ stateName, command: null, targetState, sourceHandle, targetHandle });
      setCommandModalOpened(true);
    },
    [],
  );

  const handleEditCommand = useCallback((stateName: string, command: WorkflowJsonCommand) => {
    setCommandDraft({
      stateName,
      command,
      sourceHandle: command.sourceHandle,
      targetHandle: command.targetHandle,
    });
    setCommandModalOpened(true);
  }, []);

  const handleSaveCommand = (command: WorkflowJsonCommand, commandIsNew: boolean) => {
    setForm((prev) => ({
      ...prev,
      workflow_json: applyWorkflowCommandSave(
        prev.workflow_json,
        commandDraft.stateName,
        command,
        commandIsNew ? null : commandDraft.command?.name,
      ),
    }));
  };

  const currentTitle = isNew ? t.workflowDetail.breadcrumbNew : form.name || (loading ? common.loading : t.emptyValue);

  const rootCrumb = onBack ? (
    // A button, not a link: where the list lives is the host app's to say
    <Anchor component="button" type="button" size="sm" onClick={onBack} data-testid="workflow-detail-breadcrumb-root">
      {t.workflowDetail.breadcrumbRoot}
    </Anchor>
  ) : (
    <Text size="sm">{t.workflowDetail.breadcrumbRoot}</Text>
  );

  // Nothing to edit: say which of the three it is, and offer the way out
  const refusedCreate = isNew && !createAllowed;
  if (failure || refusedCreate) {
    let state: React.ReactNode;
    if (refusedCreate || failure?.kind === 'accessDenied') {
      state = (
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={
            (failure?.kind === 'accessDenied' && failure.description) || t.accessDenied.description
          }
          onBack={onBack}
          data-testid="workflow-detail-access-denied"
        />
      );
    } else if (failure?.kind === 'notFound') {
      state = (
        <WorkflowPageState
          variant="notFound"
          title={t.workflowDetail.notFound.title}
          description={t.workflowDetail.notFound.description}
          onBack={onBack}
          data-testid="workflow-detail-not-found"
        />
      );
    } else {
      state = (
        <WorkflowPageState
          variant="error"
          title={interpolate(t.workflowDetail.loadError, { error: failure?.kind === 'error' ? failure.message : '' })}
          onBack={onBack}
          onRetry={() => void load()}
          data-testid="workflow-detail-load-error"
        />
      );
    }

    return (
      <Stack gap="md" data-testid="workflow-detail">
        <Breadcrumbs>{rootCrumb}</Breadcrumbs>
        {state}
      </Stack>
    );
  }

  const { workflow_json: workflowJson } = form;
  const commandCount = workflowJson.states.reduce((total, s) => total + (s.commands?.length ?? 0), 0);

  return (
    <Box pos="relative" data-testid="workflow-detail">
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        <Breadcrumbs>
          {rootCrumb}
          <Text size="sm">{currentTitle}</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <Group gap="sm">
            <Title order={2}>{isNew ? t.workflowDetail.titleNew : form.name}</Title>
            {hasEdits && !viewOnly && (
              <Badge color="yellow" variant="light" data-testid="workflow-detail-unsaved-badge">
                {common.unsavedChanges}
              </Badge>
            )}
          </Group>
          <Group>
            {onBack && (
              <Button variant="light" onClick={onBack} data-testid="workflow-detail-cancel-btn">
                {viewOnly ? common.back : common.cancel}
              </Button>
            )}
            {!viewOnly && (
              <Button
                onClick={() => void handleSave()}
                loading={saving}
                disabled={loading || (!isNew && !hasEdits)}
                data-testid="workflow-detail-save-btn"
              >
                {isNew ? t.workflowDetail.createWorkflow : t.saveChanges}
              </Button>
            )}
          </Group>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="md">
                <Title order={4}>{t.workflowDetail.detailsHeading}</Title>

                <TextInput
                  label={t.workflowDetail.fields.name}
                  placeholder={t.workflowDetail.fields.namePlaceholder}
                  value={form.name}
                  onChange={(e) => {
                    const name = e.currentTarget.value;
                    setForm((prev) => ({ ...prev, name }));
                  }}
                  required
                  readOnly={viewOnly}
                  data-testid="workflow-detail-name"
                />

                <Textarea
                  label={t.workflowDetail.fields.description}
                  placeholder={t.workflowDetail.fields.descriptionPlaceholder}
                  value={form.description}
                  onChange={(e) => {
                    const description = e.currentTarget.value;
                    setForm((prev) => ({ ...prev, description }));
                  }}
                  minRows={3}
                  readOnly={viewOnly}
                  data-testid="workflow-detail-description"
                />

                {!documentWithheld && (
                  <Box>
                    <Text size="sm" fw={500} mb="xs">
                      {t.workflowDetail.statistics.title}
                    </Text>
                    <Group gap="md">
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t.workflowDetail.statistics.states}
                        </Text>
                        <Text fw={500} data-testid="workflow-detail-stat-states">
                          {workflowJson.states.length}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t.workflowDetail.statistics.commands}
                        </Text>
                        <Text fw={500} data-testid="workflow-detail-stat-commands">
                          {commandCount}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">
                          {t.workflowDetail.statistics.initialState}
                        </Text>
                        <Badge variant="light" color="green" data-testid="workflow-detail-stat-initial">
                          {workflowJson.initial_state || t.workflowDetail.statistics.notSet}
                        </Badge>
                      </Box>
                    </Group>
                  </Box>
                )}

                {!documentWithheld && workflowJson.states.length > 0 && (
                  <Box data-testid="workflow-detail-states-overview">
                    <Text size="sm" fw={500} mb="xs">
                      {t.workflowDetail.statesOverview.title}
                    </Text>
                    <Stack gap="xs">
                      {workflowJson.states.map((state) => (
                        <Paper key={state.name} p="xs" withBorder radius="sm">
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                              {state.name === workflowJson.initial_state && (
                                <Badge size="xs" color="green" style={{ flexShrink: 0 }}>
                                  {t.workflowDetail.statesOverview.initialBadge}
                                </Badge>
                              )}
                              {state.isEndState && (
                                <Badge size="xs" color="red" style={{ flexShrink: 0 }}>
                                  {t.workflowDetail.statesOverview.endBadge}
                                </Badge>
                              )}
                              <Text size="sm" truncate>
                                {state.name}
                              </Text>
                            </Group>
                            <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
                              {interpolate(t.workflowDetail.statesOverview.commandCount, {
                                count: state.commands?.length ?? 0,
                              })}
                            </Badge>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>{t.workflowDetail.diagramTitle}</Title>
                  {!viewOnly && !documentWithheld && (
                    <Text size="sm" c="dimmed" data-testid="workflow-detail-diagram-hint">
                      {t.workflowDetail.diagramHint}
                    </Text>
                  )}
                </Group>

                {documentWithheld ? (
                  // No canvas at all: an empty one offers "Add your first state"
                  <Text size="sm" c="dimmed" role="note" data-testid="workflow-detail-document-withheld">
                    {t.workflowDetail.documentWithheld}
                  </Text>
                ) : (
                  <WorkflowDiagram
                    workflowJson={workflowJson}
                    onChange={handleWorkflowJsonChange}
                    onEditState={handleEditState}
                    onAddState={handleAddState}
                    onEditCommand={handleEditCommand}
                    onAddCommand={handleAddCommand}
                    readOnly={viewOnly}
                    height={diagramHeight}
                    hideAttribution={hideAttribution}
                    translations={translations}
                  />
                )}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>

      <WorkflowStateModal
        opened={stateModalOpened}
        onClose={() => setStateModalOpened(false)}
        state={editingState}
        workflowJson={workflowJson}
        onSave={handleSaveState}
        translations={translations}
      />

      <WorkflowCommandModal
        opened={commandModalOpened}
        onClose={() => setCommandModalOpened(false)}
        command={commandDraft.command}
        stateName={commandDraft.stateName}
        targetState={commandDraft.targetState}
        sourceHandle={commandDraft.sourceHandle}
        targetHandle={commandDraft.targetHandle}
        workflowJson={workflowJson}
        onSave={handleSaveCommand}
        policies={policies}
        loadPolicies={loadPolicyOptions}
        translations={translations}
      />
    </Box>
  );
};

export default WorkflowDetail;

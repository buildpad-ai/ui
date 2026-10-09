'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconX } from '@tabler/icons-react';
import {
  DaaSRequestError,
  usePermissions,
  useWorkflowAssignments,
  useWorkflowDefinitions,
} from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import {
  WORKFLOW_ASSIGNMENT_COLLECTION,
  type WorkflowAssignmentRecord,
  type WorkflowAssignmentUpdate,
  type WorkflowFilterRule,
} from '@buildpad/types';
import {
  interpolate,
  parseWorkflowFilterRule,
  type DeepPartial,
  type WorkflowsTranslations,
} from '@buildpad/utils';
import { WorkflowPageState } from './WorkflowPageState';
import { loadWorkflowCollectionNames, type WorkflowDefinitionOption } from './workflowAssignmentOptions';

/** What the form edits. The rule is edited as text and stored as JSON. */
interface AssignmentForm {
  workflow: string;
  collection: string;
  filterRuleText: string;
}

const EMPTY_FORM: AssignmentForm = { workflow: '', collection: '', filterRuleText: '' };

/**
 * The assignment as loaded (or last saved), to tell what was edited. A
 * `filterRule` of `undefined` is a rule the caller's grant withholds: the
 * form does not show one and never sends one.
 */
interface StoredAssignment {
  workflow: string;
  collection: string;
  filterRule: WorkflowFilterRule | null | undefined;
}

const EMPTY_STORED: StoredAssignment = { workflow: '', collection: '', filterRule: null };

/** Why there is no assignment to edit. */
type LoadFailure =
  | { kind: 'notFound' }
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

/** The options of a picker: not asked for yet, on their way, here, or not coming. */
interface Options<T> {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  items: T[];
}

/** The text the Filter Rule field shows for a stored rule. */
function filterRuleText(rule: WorkflowFilterRule | null | undefined): string {
  return rule ? JSON.stringify(rule, null, 2) : '';
}

/** The sentence of a thrown value, or `fallback` when it carries none. */
function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export interface WorkflowAssignmentDetailProps {
  /** ID of the assignment to edit, or `'new'` to create one. */
  id: string;
  /**
   * Called by Cancel, by the breadcrumb back to the list, and by the Back
   * button of the not-found, access-denied and load-error states. Without it
   * none of those controls is drawn.
   */
  onBack?: () => void;
  /**
   * Called after a successful create or update with the assignment as the
   * server stored it (a created one carries its new id). The reference admin
   * UI returns to the list after either. The component itself goes nowhere:
   * after a create it becomes the form of the assignment it created, so a
   * further Save updates that assignment whether or not the host has
   * navigated yet.
   */
  onSaved?: (assignment: WorkflowAssignmentRecord) => void;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_wf_assignment', the
   * name both backends enforce.
   */
  assignmentsCollection?: string;
  /**
   * Show the assignment without any way to change it. A user without update
   * access gets the same view whatever this says. Default: false.
   */
  readOnly?: boolean;
  /**
   * The workflow definitions the Workflow picker offers. Pass every
   * definition, not one page. Default: all definitions are loaded through
   * `useWorkflowDefinitions().fetchAllDefinitions` (which needs read access to
   * `daas_wf_definition`).
   */
  workflows?: WorkflowDefinitionOption[];
  /** Loads the definitions the Workflow picker offers, in place of the default loader. */
  loadWorkflows?: () => Promise<WorkflowDefinitionOption[]>;
  /**
   * The collection names the Collection picker offers — the place to leave
   * out collections that hold no content items. Default: every collection the
   * caller can see is loaded from `/api/collections`.
   */
  collections?: string[];
  /** Loads the collection names the Collection picker offers, in place of the default loader. */
  loadCollections?: () => Promise<string[]>;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Workflow assignment form: which workflow the items of which collection get,
 * and an optional filter rule (a DaaS filter object, edited as JSON) that
 * narrows which items. Ported from the buildpad-daas reference
 * `app/[lang]/workflow-assignments/[id]/page.tsx` to `useWorkflowAssignments`
 * + `usePermissions` and routing-agnostic navigation through `onBack` /
 * `onSaved`.
 *
 * What differs from the reference, on purpose:
 *
 * - The Workflow picker offers every definition (`fetchAllDefinitions`), and
 *   always the one the assignment already has. The reference loaded the first
 *   25, so a later definition could not be picked and a saved one showed blank.
 * - A Filter Rule that is valid JSON but not an object (`[]`, `123`, `"x"`)
 *   is refused on the field and nothing is sent. The reference saved it, and
 *   such a rule narrows nothing: every item of the collection gets the
 *   workflow while the list says "Has filter".
 * - An assignment that does not exist, one the caller may not read, and a
 *   load that failed each draw their own state. The reference drew a blank
 *   "Edit Workflow Assignment" form for all three.
 * - Cancel and the breadcrumb call `onBack`. The reference's Cancel was
 *   `history.back()`, which leaves the app when the page was opened directly.
 * - Permissions are checked on `daas_wf_assignment`, the collection the API
 *   enforces; the reference checked a name no backend knows.
 * - A user who may not save gets a read-only form instead of an editable one
 *   with no Save button, and a user who may not create gets the
 *   access-denied state instead of a redirect.
 * - A failed save shows the server's sentence; a failed load of either
 *   picker's options is a notification, not silence. When the collections
 *   cannot be listed (one backend serves that route to administrators only)
 *   the Collection field becomes a text field, so the form still works.
 * - An update sends only the keys that changed, and Save Changes is disabled
 *   while there is nothing to save. A filter rule the caller's grant
 *   withholds is not shown and never sent back.
 * - The invalid Filter Rule is reported when the field is left, not only on
 *   save.
 * - After a create the form is the stored assignment's: a second Save updates
 *   it. Nothing is created twice when the host is slow to navigate, or does
 *   not.
 * - What is typed while a save is in flight is kept as an unsaved edit, and a
 *   save answered after the host opened another assignment in the same form
 *   is not drawn over that assignment.
 * - Until the permissions are known nothing that writes is offered: the form
 *   is covered and takes no edit, and no Save button is drawn. A new
 *   assignment's form is neither opened to a user who may not create nor
 *   refused to one who may before the answer is in. The assignment itself
 *   loads at once.
 */
export const WorkflowAssignmentDetail: React.FC<WorkflowAssignmentDetailProps> = ({
  id,
  onBack,
  onSaved,
  assignmentsCollection = WORKFLOW_ASSIGNMENT_COLLECTION,
  readOnly = false,
  workflows,
  loadWorkflows,
  collections,
  loadCollections,
  translations,
}) => {
  const newRoute = id === 'new' || id === '+';
  // The assignment this form created while `id` still says "new". From then on
  // it edits that assignment: a second Save must update it, not create it once
  // more, whether or not the host has navigated to its own route yet.
  const [created, setCreated] = useState<WorkflowAssignmentRecord | null>(null);
  const isNew = newRoute && !created;
  const assignmentId = newRoute && created ? created.id : id;
  const { getAssignment, createAssignment, updateAssignment } = useWorkflowAssignments();
  const { fetchAllDefinitions } = useWorkflowDefinitions();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [assignmentsCollection],
  });
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);

  // Nothing that writes is offered until the permissions are known: a user
  // without the right must not be shown Save or an open form for the length
  // of that request. Known once is known: a later refresh (a renewed token,
  // another scope) answers from what was known until its own answer is in, so
  // the form does not close under a user who is typing.
  const permsKnownRef = useRef(false);
  if (!permsLoading) permsKnownRef.current = true;
  const permsKnown = permsKnownRef.current;
  const createAllowed = permsKnown && (isAdmin || canPerform(assignmentsCollection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(assignmentsCollection, 'update'));
  const saveAllowed = isNew ? createAllowed : updateAllowed;
  const viewOnly = readOnly || !saveAllowed;
  // Who is told there is nothing to cancel: nobody is called a reader before
  // the permissions are known
  const reader = readOnly || (permsKnown && !saveAllowed);

  const [record, setRecord] = useState<WorkflowAssignmentRecord | null>(null);
  const [loading, setLoading] = useState(!newRoute);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [initial, setInitial] = useState<StoredAssignment>(EMPTY_STORED);
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  // What the form refused, shown on the fields until they change
  const [filterRuleError, setFilterRuleError] = useState<string | null>(null);
  const [missing, setMissing] = useState({ workflow: false, collection: false });

  const filterRuleWithheld = initial.filterRule === undefined;
  const parsedRule = useMemo(() => parseWorkflowFilterRule(form.filterRuleText), [form.filterRuleText]);
  const filterRuleEdited =
    !filterRuleWithheld &&
    (!parsedRule.valid || JSON.stringify(parsedRule.rule) !== JSON.stringify(initial.filterRule ?? null));
  const hasEdits =
    form.workflow !== initial.workflow || form.collection.trim() !== initial.collection || filterRuleEdited;

  const requestRef = useRef(0);

  // Keyed on the `id` it is given, not on the assignment a create adopted: the
  // load runs when the host opens another assignment (or a new one), and not
  // for the assignment that was just created here.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setFailure(null);
    setCreated(null);
    setFilterRuleError(null);
    setMissing({ workflow: false, collection: false });
    if (newRoute) {
      setRecord(null);
      setInitial(EMPTY_STORED);
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetched = await getAssignment(id);
      if (request !== requestRef.current) return;
      setRecord(fetched);
      setInitial({
        workflow: fetched.workflow ?? '',
        collection: fetched.collection ?? '',
        filterRule: fetched.filter_rule,
      });
      setForm({
        workflow: fetched.workflow ?? '',
        collection: fetched.collection ?? '',
        filterRuleText: filterRuleText(fetched.filter_rule),
      });
    } catch (err) {
      if (request !== requestRef.current) return;
      const message = messageOf(err, t.assignmentDetail.notifications.fetchFailed);
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      setRecord(null);
      if (kind === 'notFound') {
        setFailure({ kind: 'notFound' });
      } else if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: t.assignmentDetail.notifications.fetchFailed, message, color: 'red' });
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [getAssignment, id, newRoute, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------------------------------------------------------------------------
  // Picker options: asked for once, and only for a form that can be changed
  // ---------------------------------------------------------------------------

  const [workflowOptions, setWorkflowOptions] = useState<Options<WorkflowDefinitionOption>>({
    status: 'idle',
    items: [],
  });
  const [collectionOptions, setCollectionOptions] = useState<Options<string>>({ status: 'idle', items: [] });
  // Not before the assignment is here either: a form that turns out to be a
  // not-found state has no use for them, nor for the notification of their
  // failure. (Not before the permissions are known: `viewOnly` until then.)
  const editable = !viewOnly && !loading && !failure;
  const workflowsAskedRef = useRef(false);
  const collectionsAskedRef = useRef(false);

  useEffect(() => {
    if (!editable || workflows || workflowsAskedRef.current) return;
    workflowsAskedRef.current = true;
    setWorkflowOptions({ status: 'loading', items: [] });
    // Every definition, not the first page of them
    (loadWorkflows ? loadWorkflows() : fetchAllDefinitions()).then(
      (items) => setWorkflowOptions({ status: 'loaded', items }),
      (err: unknown) => {
        setWorkflowOptions({ status: 'failed', items: [] });
        notifications.show({
          title: t.assignmentDetail.notifications.workflowsLoadFailed,
          message: messageOf(err, t.assignmentDetail.notifications.workflowsLoadFailed),
          color: 'red',
        });
      },
    );
  }, [editable, workflows, loadWorkflows, fetchAllDefinitions, t]);

  useEffect(() => {
    if (!editable || collections || collectionsAskedRef.current) return;
    collectionsAskedRef.current = true;
    setCollectionOptions({ status: 'loading', items: [] });
    (loadCollections ?? loadWorkflowCollectionNames)().then(
      (items) => setCollectionOptions({ status: 'loaded', items }),
      (err: unknown) => {
        setCollectionOptions({ status: 'failed', items: [] });
        notifications.show({
          title: t.assignmentDetail.notifications.collectionsLoadFailed,
          message: messageOf(err, t.assignmentDetail.notifications.collectionsLoadFailed),
          color: 'red',
        });
      },
    );
  }, [editable, collections, loadCollections, t]);

  // The value a picker holds is always one of its options: an assignment whose
  // definition or collection is not in the list still shows what it has
  const workflowData = useMemo(() => {
    const data = (workflows ?? workflowOptions.items).map((w) => ({ value: w.id, label: w.name || w.id }));
    if (form.workflow && !data.some((option) => option.value === form.workflow)) {
      const embedded = record?.workflow_definition;
      data.unshift({
        value: form.workflow,
        label: (embedded && embedded.id === form.workflow && embedded.name) || form.workflow,
      });
    }
    return data;
  }, [workflows, workflowOptions.items, form.workflow, record]);

  const collectionData = useMemo(() => {
    const data = [...(collections ?? collectionOptions.items)];
    if (form.collection && !data.includes(form.collection)) data.unshift(form.collection);
    return data;
  }, [collections, collectionOptions.items, form.collection]);

  // ---------------------------------------------------------------------------
  // Editing and saving
  // ---------------------------------------------------------------------------

  /** The dictionary's sentence for a Filter Rule the form refuses. */
  const filterRuleProblem = useCallback(
    (code: 'invalidJson' | 'notObject') =>
      code === 'invalidJson'
        ? t.assignmentDetail.validation.filterRuleInvalidJson
        : t.assignmentDetail.validation.filterRuleNotObject,
    [t],
  );

  const handleFilterRuleBlur = () => {
    if (viewOnly) return;
    if (!parsedRule.valid) {
      setFilterRuleError(filterRuleProblem(parsedRule.code));
    } else if (parsedRule.rule) {
      // A rule that can be stored is shown the way it is stored
      setForm((prev) => ({ ...prev, filterRuleText: filterRuleText(parsedRule.rule) }));
    }
  };

  const handleSave = useCallback(async () => {
    if (savingRef.current || viewOnly) return;

    const collection = form.collection.trim();
    if (!form.workflow || !collection) {
      setMissing({ workflow: !form.workflow, collection: !collection });
      notifications.show({
        title: t.validationErrorTitle,
        message: t.assignmentDetail.validation.required,
        color: 'red',
      });
      return;
    }

    // Valid JSON is not enough: only an object of conditions narrows anything
    if (!filterRuleWithheld && !parsedRule.valid) {
      const problem = filterRuleProblem(parsedRule.code);
      setFilterRuleError(problem);
      notifications.show({ title: t.validationErrorTitle, message: problem, color: 'red' });
      return;
    }
    const filterRule = parsedRule.valid ? parsedRule.rule : null;

    savingRef.current = true;
    setSaving(true);
    // The answer belongs to the assignment on screen now. When the host has
    // opened another one by the time it arrives, it must not be drawn over
    // that assignment.
    const shown = requestRef.current;
    const stillShown = () => shown === requestRef.current;
    try {
      let saved: WorkflowAssignmentRecord;
      if (isNew) {
        saved = await createAssignment({ workflow: form.workflow, collection, filter_rule: filterRule });
      } else {
        // Only the keys that changed: a grant that withholds a field refuses a
        // write that names it, changed or not
        const edits: WorkflowAssignmentUpdate = {};
        if (form.workflow !== initial.workflow) edits.workflow = form.workflow;
        if (collection !== initial.collection) edits.collection = collection;
        if (filterRuleEdited) edits.filter_rule = filterRule;
        saved = await updateAssignment(assignmentId, edits);
      }

      notifications.show({
        title: common.success,
        message: isNew ? t.assignmentDetail.notifications.created : t.assignmentDetail.notifications.updated,
        color: 'green',
      });

      if (stillShown()) {
        // What was sent is what is stored now
        setInitial({
          workflow: form.workflow,
          collection,
          filterRule: filterRuleWithheld ? undefined : filterRule,
        });
        // The collection is shown the way it was sent (trimmed) — unless it
        // was edited since the request left (the request takes a while, and
        // the inputs stay open): that text stays, as an edit not saved yet.
        setForm((prev) => (prev.collection === form.collection ? { ...prev, collection } : prev));
        setRecord(saved);
        // A created assignment is the one on screen from here on, so the next
        // Save updates it; where to go next is the host's to say
        if (isNew) setCreated(saved);
      }
      onSaved?.(saved);
    } catch (err) {
      const fallback = isNew
        ? t.assignmentDetail.notifications.createFailed
        : t.assignmentDetail.notifications.updateFailed;
      notifications.show({ title: fallback, message: messageOf(err, fallback), color: 'red' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    viewOnly,
    form,
    initial,
    parsedRule,
    filterRuleWithheld,
    filterRuleEdited,
    filterRuleProblem,
    assignmentId,
    isNew,
    createAssignment,
    updateAssignment,
    onSaved,
    t,
    common,
  ]);

  const rootCrumb = onBack ? (
    // A button, not a link: where the list lives is the host app's to say
    <Anchor
      component="button"
      type="button"
      size="sm"
      onClick={onBack}
      data-testid="workflow-assignment-detail-breadcrumb-root"
    >
      {t.assignmentDetail.breadcrumbRoot}
    </Anchor>
  ) : (
    <Text size="sm">{t.assignmentDetail.breadcrumbRoot}</Text>
  );

  // Nothing to edit: say which of the three it is, and offer the way out
  const refusedCreate = isNew && permsKnown && !createAllowed;
  if (failure || refusedCreate) {
    let state: React.ReactNode;
    if (refusedCreate || failure?.kind === 'accessDenied') {
      state = (
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={(failure?.kind === 'accessDenied' && failure.description) || t.accessDenied.description}
          onBack={onBack}
          data-testid="workflow-assignment-detail-access-denied"
        />
      );
    } else if (failure?.kind === 'notFound') {
      state = (
        <WorkflowPageState
          variant="notFound"
          title={t.assignmentDetail.notFound.title}
          description={t.assignmentDetail.notFound.description}
          onBack={onBack}
          data-testid="workflow-assignment-detail-not-found"
        />
      );
    } else {
      state = (
        <WorkflowPageState
          variant="error"
          title={interpolate(t.assignmentDetail.loadError, {
            error: failure?.kind === 'error' ? failure.message : '',
          })}
          onBack={onBack}
          onRetry={() => void load()}
          data-testid="workflow-assignment-detail-load-error"
        />
      );
    }

    return (
      <Stack gap="md" data-testid="workflow-assignment-detail">
        <Breadcrumbs>{rootCrumb}</Breadcrumbs>
        {state}
      </Stack>
    );
  }

  // The collections could not be listed: the name can still be typed
  const collectionAsText = !collections && collectionOptions.status === 'failed';

  return (
    <Stack gap="md" data-testid="workflow-assignment-detail">
      <Breadcrumbs>
        {rootCrumb}
        <Text size="sm">{isNew ? t.assignmentDetail.breadcrumbNew : t.assignmentDetail.breadcrumbEdit}</Text>
      </Breadcrumbs>

      <Group gap="sm">
        <Title order={2}>{isNew ? t.assignmentDetail.titleNew : t.assignmentDetail.titleEdit}</Title>
        {hasEdits && !viewOnly && !loading && (
          <Badge color="yellow" variant="light" data-testid="workflow-assignment-detail-unsaved-badge">
            {common.unsavedChanges}
          </Badge>
        )}
      </Group>

      <Paper shadow="xs" radius="md" p="xl" withBorder pos="relative" maw={720}>
        <LoadingOverlay visible={loading || !permsKnown} />

        <Stack gap="md">
          <Select
            label={t.assignmentDetail.fields.workflow}
            placeholder={t.assignmentDetail.fields.workflowPlaceholder}
            data={workflowData}
            // null, not '': an empty string leaves the last label in the input
            value={form.workflow || null}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, workflow: value ?? '' }));
              setMissing((prev) => ({ ...prev, workflow: false }));
            }}
            allowDeselect={false}
            error={missing.workflow}
            required
            searchable
            readOnly={viewOnly}
            data-testid="workflow-assignment-detail-workflow"
          />

          {collectionAsText ? (
            <TextInput
              label={t.assignmentDetail.fields.collection}
              description={t.assignmentDetail.fields.collectionDescription}
              value={form.collection}
              onChange={(e) => {
                const collection = e.currentTarget.value;
                setForm((prev) => ({ ...prev, collection }));
                setMissing((prev) => ({ ...prev, collection: false }));
              }}
              error={missing.collection}
              required
              readOnly={viewOnly}
              data-testid="workflow-assignment-detail-collection"
            />
          ) : (
            <Select
              label={t.assignmentDetail.fields.collection}
              description={t.assignmentDetail.fields.collectionDescription}
              placeholder={t.assignmentDetail.fields.collectionPlaceholder}
              data={collectionData}
              value={form.collection || null}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, collection: value ?? '' }));
                setMissing((prev) => ({ ...prev, collection: false }));
              }}
              allowDeselect={false}
              error={missing.collection}
              required
              searchable
              readOnly={viewOnly}
              data-testid="workflow-assignment-detail-collection"
            />
          )}

          {!filterRuleWithheld && (
            <Textarea
              label={t.assignmentDetail.fields.filterRule}
              description={t.assignmentDetail.fields.filterRuleDescription}
              placeholder={t.assignmentDetail.fields.filterRulePlaceholder}
              value={form.filterRuleText}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setForm((prev) => ({ ...prev, filterRuleText: text }));
                setFilterRuleError(null);
              }}
              onBlur={handleFilterRuleBlur}
              error={filterRuleError}
              minRows={6}
              autosize
              readOnly={viewOnly}
              styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
              data-testid="workflow-assignment-detail-filter-rule"
            />
          )}

          <Group justify="flex-end" mt="md">
            {onBack && (
              <Button
                variant="light"
                leftSection={reader ? undefined : <IconX size={16} />}
                onClick={onBack}
                data-testid="workflow-assignment-detail-cancel-btn"
              >
                {reader ? common.back : common.cancel}
              </Button>
            )}
            {!viewOnly && (
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={() => void handleSave()}
                loading={saving}
                disabled={loading || (!isNew && !hasEdits)}
                data-testid="workflow-assignment-detail-save-btn"
              >
                {isNew ? t.assignmentDetail.createAssignment : t.saveChanges}
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default WorkflowAssignmentDetail;

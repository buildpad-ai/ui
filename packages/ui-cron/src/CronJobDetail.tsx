'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Code,
  Grid,
  Group,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconClock,
  IconHistory,
  IconInfoCircle,
  IconPlayerPlayFilled,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { DaaSRequestError, useCronJobs, usePermissions } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import { CRON_JOBS_COLLECTION, type CronJobRecord, type CronJobStatus } from '@buildpad/types';
import {
  CRON_FORM_DEFAULTS,
  CRON_JOB_FORM_FIELDS,
  CRON_NUMBER_INPUTS,
  CRON_TIMEZONE_OPTIONS,
  DEFAULT_CRON_CODE,
  changedCronJobFields,
  cronJobInputFromForm,
  cronJobToForm,
  cronTimezoneOptions,
  findCronJobFormProblem,
  interpolate,
  normalizeCronMemoryLimitMb,
  normalizeCronTimeoutMs,
  withheldCronJobFields,
  type CronJobForm,
  type CronJobFormField,
  type CronTimezoneOption,
  type CronTranslations,
  type DeepPartial,
} from '@buildpad/utils';
import { CronCodeEditor, type CronCodeEditorProps } from './CronCodeEditor';
import { CronIntegerInput } from './CronIntegerInput';
import { CronJobStatusBadge } from './CronJobStatusBadge';
import { CronPageState } from './CronPageState';
import { CronRichText } from './CronRichText';
import { CronRunsTable } from './CronRunsTable';

type DetailTab = 'settings' | 'history';

/** Why there is no job to edit. */
type LoadFailure =
  | { kind: 'notFound' }
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

/** The form of a stored job before it is loaded: nothing of a job, and none of the new-job defaults. */
const BLANK_FORM: CronJobForm = cronJobToForm({});

export interface CronJobDetailProps {
  /** ID of the job to edit, or `'new'` to create one. */
  id: string;
  /**
   * Called by the breadcrumb back to the list and by the Back button of the
   * not-found, access-denied and load-error states. Without it none of those
   * controls is drawn.
   */
  onBack?: () => void;
  /**
   * Called after a successful create with the stored job, which carries its
   * new id. The host navigates: the reference admin UI opens the new job's
   * editor (`/cron/<id>`). The component itself goes nowhere — it becomes the
   * editor of the job it created, so a further Save updates that job whether
   * or not the host has navigated yet.
   */
  onCreated?: (job: CronJobRecord) => void;
  /** Called after a successful save of an existing job, with the job as it is stored now. */
  onSaved?: (job: CronJobRecord) => void;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_cron_jobs', the one
   * name both backends decide every cron route by.
   */
  collection?: string;
  /**
   * Show the job without any way to change it: a read-only form and no Run
   * Now, Activate, Deactivate or Save. A user without update access (create,
   * for a new job) gets the same view whatever this says. Default: false.
   */
  readOnly?: boolean;
  /**
   * The code a new job starts with. Default: `DEFAULT_CRON_CODE`, which runs
   * unchanged on both backends. What `services` offers differs per backend, so
   * a host that knows its backend can start a job with a better example.
   */
  defaultCode?: string;
  /**
   * What the "Cron Code" notice above the editor says, in place of the
   * dictionary's sentence — for a host that knows what its backend gives a job.
   */
  codeHelp?: React.ReactNode;
  /**
   * The options of the Timezone select. Default: the 26 whole-hour UTC
   * offsets (`CRON_TIMEZONE_OPTIONS`). A job's stored timezone that is not
   * among them is always added as an option of its own.
   */
  timezoneOptions?: readonly CronTimezoneOption[];
  /**
   * Draws the code editor, in place of the built-in one (a monospace textarea
   * with line numbers, no highlighting). Put `id` and `aria-labelledby` on the
   * element that takes the text, honour `readOnly`, and call `onChange` with a
   * string.
   */
  renderCodeEditor?: (props: CronCodeEditorProps) => React.ReactNode;
  /** Height the code editor should at least have, in pixels. Default: 440. */
  codeEditorMinHeight?: number;
  /** Initial runs per page on the History tab. Default: 50. */
  historyPageSize?: number;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Cron job editor: the job's code beside its settings (name, description,
 * schedule, timezone, timeout, memory limit, and status for a stored job),
 * with Run Now, Activate or Deactivate and Save in the header, and the job's
 * run history on a second tab. Ported from the buildpad-daas reference
 * `app/[lang]/cron/[id]/page.tsx` to `useCronJobs` + `usePermissions` and
 * routing-agnostic navigation through `onBack` / `onCreated`.
 *
 * What differs from the reference, on purpose:
 *
 * - No redirect and no link. A job that does not exist, one the caller may
 *   not read, and a load that failed each draw their own state in place; the
 *   breadcrumb calls `onBack` and a create calls `onCreated`, so the host
 *   app's router (and its locale prefix) decides where to go.
 * - A user who may not save gets a read-only form — code included — and no
 *   Run Now, Activate, Deactivate or Save. The reference left every field
 *   editable and showed "Unsaved Changes" to a user with no Save button.
 * - Save sends only the fields that changed (`changedCronJobFields`) and is
 *   disabled while there is nothing to save. The reference sent the whole
 *   form, and with it the status the form was loaded with.
 * - While the permissions are loading nothing that writes is offered: the
 *   form is covered and takes no edit, and no button is drawn. A new job's
 *   form is neither opened to a user who may not create nor refused to one
 *   who may before the answer is in. (ui-workflows is optimistic there.)
 * - After a create the editor is the stored job's: a second Save updates it.
 *   Nothing is created twice when the host is slow to navigate, or does not.
 * - What is typed while a save is in flight is kept as an unsaved edit; the
 *   reference replaced it with the saved values.
 * - An emptied description is saved as none.
 * - A stored timezone that is not one of the options is shown, and kept, as
 *   it is stored (`cronTimezoneOptions`). The reference showed "UTC+0".
 * - Picking the option that is already selected keeps it; the reference
 *   cleared the Select and fell back to UTC / Inactive.
 * - Timeout and Memory Limit take whole numbers only, and an emptied one
 *   falls back to its default when the field loses focus, not at the
 *   keystroke that emptied it.
 * - Run Now reads its answer: a job that was already running was not started
 *   again, and the notification says so. The history is loaded when the
 *   request is answered — which is when the run has ended — not 1.5 seconds
 *   after the click.
 * - Deactivate follows Activate's rule: both wait for unsaved edits to be
 *   saved, and both are pending while they run. The reference disabled only
 *   Activate.
 * - The status badge reads "Active" / "Inactive", as the jobs list does; the
 *   reference showed the stored value in lower case here.
 * - "Job Code" names the editor (`aria-labelledby`); it was a text beside it.
 * - A job answered without some of its columns (the caller's grant withholds
 *   them) shows those fields read-only and never sends them; code that is
 *   withheld is said to be, in place of an empty editor.
 * - The code a new job starts with, and the notice above the editor, name
 *   what both backends give a job (`defaultCode` and `codeHelp` replace them).
 */
export const CronJobDetail: React.FC<CronJobDetailProps> = ({
  id,
  onBack,
  onCreated,
  onSaved,
  collection = CRON_JOBS_COLLECTION,
  readOnly = false,
  defaultCode = DEFAULT_CRON_CODE,
  codeHelp,
  timezoneOptions = CRON_TIMEZONE_OPTIONS,
  renderCodeEditor,
  codeEditorMinHeight = 440,
  historyPageSize = 50,
  translations,
}) => {
  const newRoute = id === 'new' || id === '+';
  // The job this editor created while `id` still says "new". From then on it
  // edits that job: a second Save must update it, not create it once more,
  // whether or not the host has navigated to the job's own route yet.
  const [created, setCreated] = useState<CronJobRecord | null>(null);
  const isNew = newRoute && !created;
  const jobId = created ? created.id : id;
  const { getJob, createJob, updateJob, runJob } = useCronJobs();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({ collections: [collection] });
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const common = useBuildpadTranslations((d) => d.common);

  // Nothing that writes is offered until the permissions are known: a user
  // without the right must not be shown Save, Run Now or an open form for the
  // length of that request, and nobody is called a reader before it is answered.
  const permsKnown = !permsLoading;
  const createAllowed = permsKnown && (isAdmin || canPerform(collection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(collection, 'update'));
  const saveAllowed = isNew ? createAllowed : updateAllowed;
  const viewOnly = readOnly || !saveAllowed;
  // Run Now, Activate and Deactivate are writes on a stored job
  const actionsAllowed = !readOnly && updateAllowed && !isNew;

  const newForm = useMemo<CronJobForm>(() => ({ ...CRON_FORM_DEFAULTS, code: defaultCode }), [defaultCode]);

  const [record, setRecord] = useState<CronJobRecord | null>(null);
  const [loading, setLoading] = useState(!newRoute);
  const [failure, setFailure] = useState<LoadFailure | null>(null);

  // The job as loaded (or last saved), to tell what was edited
  const [initial, setInitial] = useState<CronJobForm>(newRoute ? newForm : BLANK_FORM);
  const [form, setForm] = useState<CronJobForm>(newRoute ? newForm : BLANK_FORM);
  const edits = useMemo(() => changedCronJobFields(initial, form), [initial, form]);
  const hasEdits = Object.keys(edits).length > 0;

  // The columns the caller's grant withholds: no stored value to show, and none to send
  const withheld = useMemo<CronJobFormField[]>(
    () => (record && !isNew ? withheldCronJobFields(record) : []),
    [record, isNew],
  );
  const locked = (field: CronJobFormField) => viewOnly || withheld.includes(field);

  // Each write has a state that disables its button on the next render, and a
  // ref that refuses a second click arriving before that render.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);

  const [tab, setTab] = useState<DetailTab>('settings');
  // The history is loaded when its tab is first opened, and again each time
  // it is opened after that and after a Run Now.
  const [historyOpened, setHistoryOpened] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const openHistory = useCallback(() => {
    setTab('history');
    setHistoryOpened(true);
    setHistoryKey((key) => key + 1);
  }, []);

  const codeId = useId();
  const codeLabelId = `${codeId}-label`;
  const codeDescriptionId = `${codeId}-description`;

  const requestRef = useRef(0);

  // Keyed on the `id` it is given, not on the job a create adopted: the load
  // runs when the host opens another job (or a new one), and not a second
  // time for the job that was just created here.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setFailure(null);
    setCreated(null);
    if (newRoute) {
      setRecord(null);
      setInitial(newForm);
      setForm(newForm);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetched = await getJob(id);
      if (request !== requestRef.current) return;
      const loaded = cronJobToForm(fetched);
      setRecord(fetched);
      setInitial(loaded);
      setForm(loaded);
    } catch (err) {
      if (request !== requestRef.current) return;
      const message = err instanceof Error && err.message ? err.message : t.jobDetail.notifications.fetchFailed;
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      setRecord(null);
      if (kind === 'notFound') {
        setFailure({ kind: 'notFound' });
      } else if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: common.error, message, color: 'red' });
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [getJob, id, newRoute, newForm, t, common]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Shows the job as it is stored now: what a write answered, over what was
   * known. `sent` is the form as it was when the request left: a field edited
   * since then (the request takes a while, and the inputs stay open) keeps
   * what was typed, as an edit that is not saved yet.
   */
  const showStored = useCallback(
    (stored: CronJobRecord, known: CronJobRecord | null, sent: CronJobForm): CronJobRecord => {
      // The answer carries the columns the caller may read; the others stay as known
      const merged = { ...known, ...stored };
      const filled = cronJobToForm(merged);
      setRecord(merged);
      setInitial(filled);
      setForm((current) => {
        if (current === sent) return filled;
        const typedSince = CRON_JOB_FORM_FIELDS.filter((field) => current[field] !== sent[field]);
        return typedSince.reduce<CronJobForm>((next, field) => ({ ...next, [field]: current[field] }), filled);
      });
      return merged;
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (savingRef.current || viewOnly) return;

    const problem = findCronJobFormProblem(form, withheld);
    if (problem) {
      notifications.show({
        title: t.validationErrorTitle,
        message: t.jobDetail.validation[problem.code],
        color: 'red',
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (isNew) {
        const stored = await createJob(cronJobInputFromForm(form));
        notifications.show({
          title: common.success,
          message: t.jobDetail.notifications.created,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // What is on screen is the stored job from here on, so the next Save
        // updates it; where to go next is the host's to say
        setCreated(stored);
        showStored(stored, null, form);
        onCreated?.(stored);
      } else {
        // Only the fields edited since the form was filled from the server: the
        // rest may have changed elsewhere (the status above all), and the form's
        // copy of them is only as fresh as its load.
        const saved = await updateJob(jobId, changedCronJobFields(initial, form));
        notifications.show({
          title: common.success,
          message: t.jobDetail.notifications.saved,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Not inside the optional call: without `onSaved` its argument is never evaluated
        const now = showStored(saved, record, form);
        onSaved?.(now);
      }
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error && err.message ? err.message : t.jobDetail.notifications.saveFailed,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [viewOnly, form, initial, withheld, isNew, jobId, record, createJob, updateJob, showStored, onCreated, onSaved, t, common]);

  const handleSetStatus = useCallback(
    async (status: CronJobStatus) => {
      if (switchingRef.current || !record) return;
      switchingRef.current = true;
      setSwitching(true);
      const active = status === 'active';
      try {
        const saved = await updateJob(record.id, { status });
        // The form has no unsaved edit when the button is clicked (it waits
        // for them); one typed while the request runs is kept
        showStored(saved, record, form);
        notifications.show({
          title: active ? t.notificationTitles.activated : t.notificationTitles.deactivated,
          message: active ? t.jobDetail.notifications.activated : t.jobDetail.notifications.deactivated,
          color: active ? 'green' : 'yellow',
        });
      } catch (err) {
        const fallback = active
          ? t.jobDetail.notifications.activateFailed
          : t.jobDetail.notifications.deactivateFailed;
        notifications.show({
          title: common.error,
          message: err instanceof Error && err.message ? err.message : fallback,
          color: 'red',
        });
      } finally {
        switchingRef.current = false;
        setSwitching(false);
      }
    },
    [record, form, updateJob, showStored, t, common],
  );

  const handleRunNow = useCallback(async () => {
    if (runningRef.current || !record) return;
    runningRef.current = true;
    setRunning(true);
    try {
      // Answered when the run has ended, not when it starts
      const result = await runJob(record.id);
      if (result.skipped) {
        // Nothing ran: the job was already running, and saying "started" would be false
        notifications.show({
          title: t.notificationTitles.runSkipped,
          message: t.jobDetail.notifications.runSkipped,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: t.notificationTitles.triggered,
          message: t.jobDetail.notifications.triggered,
          color: 'blue',
          icon: <IconPlayerPlayFilled size={16} />,
        });
      }
      // The run that just ended — or the one that is still going — is in the history
      openHistory();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error && err.message ? err.message : t.jobDetail.notifications.runFailed,
        color: 'red',
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [record, runJob, openHistory, t, common]);

  const rootCrumb = onBack ? (
    // A button, not a link: where the list lives is the host app's to say
    <Anchor component="button" type="button" size="sm" onClick={onBack} data-testid="cron-job-detail-breadcrumb-root">
      {t.jobDetail.breadcrumbRoot}
    </Anchor>
  ) : (
    <Text size="sm">{t.jobDetail.breadcrumbRoot}</Text>
  );

  // Nothing to edit: say which of the three it is, and offer the way out
  const refusedCreate = isNew && permsKnown && !createAllowed;
  if (failure || refusedCreate) {
    let state: React.ReactNode;
    if (refusedCreate || failure?.kind === 'accessDenied') {
      state = (
        <CronPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={(failure?.kind === 'accessDenied' && failure.description) || t.accessDenied.description}
          onBack={onBack}
          data-testid="cron-job-detail-access-denied"
        />
      );
    } else if (failure?.kind === 'notFound') {
      state = (
        <CronPageState
          variant="notFound"
          title={t.jobDetail.notFound.title}
          description={t.jobDetail.notFound.description}
          onBack={onBack}
          data-testid="cron-job-detail-not-found"
        />
      );
    } else {
      state = (
        <CronPageState
          variant="error"
          title={interpolate(t.jobDetail.loadError, { error: failure?.kind === 'error' ? failure.message : '' })}
          onBack={onBack}
          onRetry={() => void load()}
          data-testid="cron-job-detail-load-error"
        />
      );
    }

    return (
      <Stack gap="md" data-testid="cron-job-detail">
        <Breadcrumbs>{rootCrumb}</Breadcrumbs>
        {state}
      </Stack>
    );
  }

  const currentCrumb = isNew ? t.jobDetail.breadcrumbNew : (record?.name ?? common.loading);
  const codeWithheld = withheld.includes('code');

  // The stored timezone is always an option, so the Select shows it and keeps it
  const timezoneData = cronTimezoneOptions(initial.timezone, timezoneOptions);
  // The inputs' bounds are the form's, not the server's: a stored value outside
  // them is shown as it is stored, and is not pulled inside on blur
  const timeoutMin = Math.min(CRON_NUMBER_INPUTS.timeout_ms.min, initial.timeout_ms);
  const memoryMin = Math.min(CRON_NUMBER_INPUTS.memory_limit_mb.min, initial.memory_limit_mb);
  const memoryMax = Math.max(CRON_NUMBER_INPUTS.memory_limit_mb.max, initial.memory_limit_mb);

  const editorProps: CronCodeEditorProps = {
    value: form.code,
    onChange: (code) => setForm((prev) => ({ ...prev, code })),
    readOnly: locked('code'),
    minHeight: codeEditorMinHeight,
    placeholder: t.jobDetail.code.placeholder,
    id: codeId,
    'aria-labelledby': codeLabelId,
    'aria-describedby': codeDescriptionId,
  };

  return (
    <Box pos="relative" data-testid="cron-job-detail">
      <LoadingOverlay visible={loading || permsLoading} />

      <Stack gap="md">
        <Breadcrumbs>
          {rootCrumb}
          <Text size="sm" data-testid="cron-job-detail-breadcrumb-current">
            {currentCrumb}
          </Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <Group>
            <Title order={2}>{isNew ? t.jobDetail.titleNew : t.jobDetail.titleEdit}</Title>
            {hasEdits && !viewOnly && (
              <Badge color="yellow" variant="light" data-testid="cron-job-detail-unsaved-badge">
                {t.jobDetail.unsavedChanges}
              </Badge>
            )}
            {record && (
              <CronJobStatusBadge
                status={record.status}
                data-testid="cron-job-detail-status-badge"
                translations={translations}
              />
            )}
          </Group>
          <Group>
            {actionsAllowed && record && (
              <Tooltip label={hasEdits ? t.jobDetail.saveFirstTooltip : t.jobDetail.runNowTooltip}>
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconPlayerPlayFilled size={14} />}
                  onClick={() => void handleRunNow()}
                  loading={running}
                  disabled={hasEdits}
                  data-testid="cron-job-detail-run-btn"
                >
                  {t.actions.runNow}
                </Button>
              </Tooltip>
            )}
            {actionsAllowed && record?.status === 'inactive' && (
              <Button
                variant="light"
                color="green"
                onClick={() => void handleSetStatus('active')}
                loading={switching}
                disabled={hasEdits}
                data-testid="cron-job-detail-activate-btn"
              >
                {t.actions.activate}
              </Button>
            )}
            {actionsAllowed && record?.status === 'active' && (
              <Button
                variant="light"
                color="yellow"
                onClick={() => void handleSetStatus('inactive')}
                loading={switching}
                disabled={hasEdits}
                data-testid="cron-job-detail-deactivate-btn"
              >
                {t.actions.deactivate}
              </Button>
            )}
            {!viewOnly && (
              <Button
                onClick={() => void handleSave()}
                loading={saving}
                disabled={loading || (!isNew && !hasEdits)}
                data-testid="cron-job-detail-save-btn"
              >
                {isNew ? common.create : common.save}
              </Button>
            )}
          </Group>
        </Group>

        {viewOnly && !loading && permsKnown && (
          <Text size="sm" c="dimmed" role="note" data-testid="cron-job-detail-read-only-notice">
            {t.jobDetail.readOnlyNotice}
          </Text>
        )}

        <Tabs
          value={tab}
          onChange={(value) => {
            if (value === 'history') openHistory();
            else setTab('settings');
          }}
        >
          <Tabs.List mb="md">
            <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />} data-testid="cron-job-detail-tab-settings">
              {t.jobDetail.tabs.settings}
            </Tabs.Tab>
            {!isNew && (
              <Tabs.Tab value="history" leftSection={<IconHistory size={14} />} data-testid="cron-job-detail-tab-history">
                {t.jobDetail.tabs.history}
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="settings">
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper shadow="xs" p="md" withBorder>
                  <Stack gap="md">
                    <Alert
                      icon={<IconInfoCircle size={16} />}
                      title={t.jobDetail.codeHelp.title}
                      color="teal"
                      variant="light"
                      data-testid="cron-job-detail-code-help"
                    >
                      <Text size="sm" component="div">
                        {codeHelp ?? (
                          <CronRichText
                            template={t.jobDetail.codeHelp.body}
                            tags={{ code: (text) => <Code>{text}</Code> }}
                          />
                        )}
                      </Text>
                    </Alert>

                    <Box>
                      <Text size="sm" fw={500} mb={4} id={codeLabelId}>
                        {t.jobDetail.code.label}
                      </Text>
                      <Text size="xs" c="dimmed" mb={8} id={codeDescriptionId}>
                        {t.jobDetail.code.description}
                      </Text>
                      {codeWithheld ? (
                        // No editor at all: an empty one would present the job as having no code
                        <Text size="sm" c="dimmed" role="note" data-testid="cron-job-detail-code-withheld">
                          {t.jobDetail.codeWithheld}
                        </Text>
                      ) : renderCodeEditor ? (
                        renderCodeEditor(editorProps)
                      ) : (
                        <CronCodeEditor {...editorProps} />
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper shadow="xs" p="md" withBorder>
                  <Stack gap="md">
                    <Title order={4}>
                      <Group gap="xs">
                        <IconClock size={18} />
                        {t.jobDetail.settingsHeading}
                      </Group>
                    </Title>

                    <TextInput
                      label={t.jobDetail.fields.name}
                      placeholder={t.jobDetail.fields.namePlaceholder}
                      required
                      value={form.name}
                      onChange={(e) => {
                        const name = e.currentTarget.value;
                        setForm((prev) => ({ ...prev, name }));
                      }}
                      readOnly={locked('name')}
                      data-testid="cron-job-detail-name"
                    />

                    <Textarea
                      label={t.jobDetail.fields.description}
                      placeholder={t.jobDetail.fields.descriptionPlaceholder}
                      value={form.description}
                      onChange={(e) => {
                        const description = e.currentTarget.value;
                        setForm((prev) => ({ ...prev, description }));
                      }}
                      minRows={2}
                      readOnly={locked('description')}
                      data-testid="cron-job-detail-description"
                    />

                    <TextInput
                      label={t.jobDetail.fields.schedule}
                      description={t.jobDetail.fields.scheduleDescription}
                      placeholder={t.jobDetail.fields.schedulePlaceholder}
                      required
                      value={form.schedule}
                      onChange={(e) => {
                        const schedule = e.currentTarget.value;
                        setForm((prev) => ({ ...prev, schedule }));
                      }}
                      readOnly={locked('schedule')}
                      data-testid="cron-job-detail-schedule"
                    />

                    <Select
                      label={t.jobDetail.fields.timezone}
                      description={t.jobDetail.fields.timezoneDescription}
                      data={timezoneData}
                      value={form.timezone}
                      onChange={(timezone) => {
                        // Never null: the option that is selected cannot be picked away
                        if (timezone) setForm((prev) => ({ ...prev, timezone }));
                      }}
                      allowDeselect={false}
                      readOnly={locked('timezone')}
                      data-testid="cron-job-detail-timezone"
                    />

                    <CronIntegerInput
                      label={t.jobDetail.fields.timeout}
                      description={t.jobDetail.fields.timeoutDescription}
                      value={form.timeout_ms}
                      onChange={(timeout_ms) => setForm((prev) => ({ ...prev, timeout_ms }))}
                      normalize={normalizeCronTimeoutMs}
                      min={timeoutMin}
                      step={CRON_NUMBER_INPUTS.timeout_ms.step}
                      readOnly={locked('timeout_ms')}
                      data-testid="cron-job-detail-timeout"
                    />

                    <CronIntegerInput
                      label={t.jobDetail.fields.memoryLimit}
                      description={t.jobDetail.fields.memoryLimitDescription}
                      value={form.memory_limit_mb}
                      onChange={(memory_limit_mb) => setForm((prev) => ({ ...prev, memory_limit_mb }))}
                      normalize={normalizeCronMemoryLimitMb}
                      min={memoryMin}
                      max={memoryMax}
                      step={CRON_NUMBER_INPUTS.memory_limit_mb.step}
                      readOnly={locked('memory_limit_mb')}
                      data-testid="cron-job-detail-memory"
                    />

                    {!isNew && (
                      <Select
                        label={t.jobDetail.fields.status}
                        data={[
                          { value: 'active', label: t.jobStatus.active },
                          { value: 'inactive', label: t.jobStatus.inactive },
                        ]}
                        value={form.status}
                        onChange={(status) => {
                          // Never null: the option that is selected cannot be picked away
                          if (status) setForm((prev) => ({ ...prev, status: status as CronJobStatus }));
                        }}
                        allowDeselect={false}
                        readOnly={locked('status')}
                        data-testid="cron-job-detail-status"
                      />
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {!isNew && (
            <Tabs.Panel value="history">
              {historyOpened && record && (
                <CronRunsTable
                  jobId={record.id}
                  pageSize={historyPageSize}
                  refreshKey={historyKey}
                  data-testid="cron-job-detail-history"
                  translations={translations}
                />
              )}
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Box>
  );
};

export default CronJobDetail;

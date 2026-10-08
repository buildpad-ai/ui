'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  LoadingOverlay,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconHistory } from '@tabler/icons-react';
import { DaaSRequestError, useWorkflowInstances } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { WorkflowHistoryRecord, WorkflowInstanceRecord } from '@buildpad/types';
import { interpolate, type DeepPartial, type WorkflowsTranslations } from '@buildpad/utils';
import { WorkflowDiagram } from './WorkflowDiagram';
import { WorkflowListEmptyState } from './WorkflowListEmptyState';
import { WorkflowPageState } from './WorkflowPageState';

/** Why there is no instance to show. */
type LoadFailure =
  | { kind: 'notFound' }
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

/** The transition history, or why there is none to show. */
type HistoryState =
  | { status: 'loading' }
  | { status: 'loaded'; rows: WorkflowHistoryRecord[] }
  | { status: 'accessDenied' }
  | { status: 'error'; message: string };

export interface WorkflowInstanceDetailProps {
  /** ID of the instance to show. */
  id: string;
  /**
   * Called by the Back button, by the breadcrumb back to the list, and by the
   * Back button of the not-found, access-denied and load-error states. Without
   * it none of those controls is drawn.
   */
  onBack?: () => void;
  /**
   * Draw the instance's workflow as a read-only state diagram, when the
   * instance was answered with its definition's document. Default: true.
   */
  showDiagram?: boolean;
  /** Height of the state diagram (CSS length or pixels). Default: 420. */
  diagramHeight?: number | string;
  /** Hide React Flow's attribution on the diagram; see `WorkflowDiagram`. Default: false. */
  hideAttribution?: boolean;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/** One labelled value of the Instance Information card. */
const Field: React.FC<{ label: string; children: React.ReactNode; 'data-testid'?: string }> = ({
  label,
  children,
  'data-testid': testId,
}) => (
  <Grid.Col span={{ base: 12, sm: 6 }}>
    <Stack gap="xs" align="flex-start" data-testid={testId}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      {children}
    </Stack>
  </Grid.Col>
);

/**
 * One workflow instance, read-only: its fields (workflow, current state,
 * collection, item, version, dates, id), its workflow as a state diagram, and
 * its transition history, newest first. Ported from the buildpad-daas
 * reference `app/[lang]/workflow-instances/[id]/page.tsx` to
 * `useWorkflowInstances` and routing-agnostic navigation through `onBack`.
 *
 * What differs from the reference, on purpose:
 *
 * - An instance that does not exist, one the caller may not read, and a load
 *   that failed each draw their own state. The reference drew an empty card
 *   and "0 transitions" for all three.
 * - Back and the breadcrumb call `onBack`. The reference's Back was
 *   `history.back()`, which leaves the app when the page was opened directly.
 * - A history the caller may not read, and one that failed to load, say so;
 *   the reference showed "No transitions recorded yet" for both. The history
 *   is asked for only once the instance itself has loaded, because the
 *   history route answers an unreadable instance with an empty list.
 * - The whole history is shown (the hook reads every page); one backend
 *   serves 50 rows to a request that does not page.
 * - The page makes no permission check of its own; see
 *   `WorkflowInstancesManager`.
 * - The workflow is drawn as a read-only diagram under the fields. The
 *   diagram does not mark the current state; the Current State field does.
 */
export const WorkflowInstanceDetail: React.FC<WorkflowInstanceDetailProps> = ({
  id,
  onBack,
  showDiagram = true,
  diagramHeight = 420,
  hideAttribution = false,
  translations,
}) => {
  const { getInstance, fetchInstanceHistory } = useWorkflowInstances();
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount, formatDateTime } = useBuildpadI18n();

  const [instance, setInstance] = useState<WorkflowInstanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' });

  const requestRef = useRef(0);

  const loadHistory = useCallback(
    async (request: number) => {
      setHistory({ status: 'loading' });
      try {
        const rows = await fetchInstanceHistory(id);
        if (request !== requestRef.current) return;
        setHistory({ status: 'loaded', rows });
      } catch (err) {
        if (request !== requestRef.current) return;
        const message =
          err instanceof Error && err.message ? err.message : t.instanceDetail.notifications.historyFetchFailed;
        const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
        if (kind === 'forbidden' || kind === 'mfaRequired') {
          setHistory({ status: 'accessDenied' });
        } else {
          setHistory({ status: 'error', message });
          notifications.show({
            title: t.instanceDetail.notifications.historyFetchFailed,
            message,
            color: 'red',
          });
        }
      }
    },
    [fetchInstanceHistory, id, t],
  );

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setFailure(null);
    setLoading(true);
    try {
      const fetched = await getInstance(id);
      if (request !== requestRef.current) return;
      setInstance(fetched);
      setLoading(false);
    } catch (err) {
      if (request !== requestRef.current) return;
      const message =
        err instanceof Error && err.message ? err.message : t.instanceDetail.notifications.fetchFailed;
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      setInstance(null);
      setLoading(false);
      if (kind === 'notFound') {
        setFailure({ kind: 'notFound' });
      } else if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: t.instanceDetail.notifications.fetchFailed, message, color: 'red' });
      }
      return;
    }
    // Only for an instance that loaded: the history route answers an instance
    // the caller cannot read with an empty list, which would read as "no
    // transitions yet"
    await loadHistory(request);
  }, [getInstance, id, loadHistory, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const rootCrumb = onBack ? (
    // A button, not a link: where the list lives is the host app's to say
    <Anchor
      component="button"
      type="button"
      size="sm"
      onClick={onBack}
      data-testid="workflow-instance-detail-breadcrumb-root"
    >
      {t.instanceDetail.breadcrumbRoot}
    </Anchor>
  ) : (
    <Text size="sm">{t.instanceDetail.breadcrumbRoot}</Text>
  );

  // Nothing to show: say which of the three it is, and offer the way out
  if (failure) {
    let state: React.ReactNode;
    if (failure.kind === 'accessDenied') {
      state = (
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={failure.description || t.accessDenied.description}
          onBack={onBack}
          data-testid="workflow-instance-detail-access-denied"
        />
      );
    } else if (failure.kind === 'notFound') {
      state = (
        <WorkflowPageState
          variant="notFound"
          title={t.instanceDetail.notFound.title}
          description={t.instanceDetail.notFound.description}
          onBack={onBack}
          data-testid="workflow-instance-detail-not-found"
        />
      );
    } else {
      state = (
        <WorkflowPageState
          variant="error"
          title={interpolate(t.instanceDetail.loadError, { error: failure.message })}
          onBack={onBack}
          onRetry={() => void load()}
          data-testid="workflow-instance-detail-load-error"
        />
      );
    }

    return (
      <Stack gap="md" data-testid="workflow-instance-detail">
        <Breadcrumbs>{rootCrumb}</Breadcrumbs>
        {state}
      </Stack>
    );
  }

  // `formatDateTime` returns '' for an empty or invalid value
  const dateTime = (value: string | null | undefined) => formatDateTime(value) || t.emptyValue;
  const workflowJson = instance?.workflow?.workflow_json;

  return (
    <Stack gap="md" data-testid="workflow-instance-detail">
      <Breadcrumbs>
        {rootCrumb}
        <Text size="sm">{t.instanceDetail.breadcrumbCurrent}</Text>
      </Breadcrumbs>

      <Group justify="space-between">
        <Title order={2}>{t.instanceDetail.title}</Title>
        {onBack && (
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
            data-testid="workflow-instance-detail-back-btn"
          >
            {common.back}
          </Button>
        )}
      </Group>

      <Paper shadow="xs" radius="md" p="xl" withBorder pos="relative" mih={160}>
        <LoadingOverlay visible={loading} />

        {instance && (
          <Stack gap="md" data-testid="workflow-instance-detail-information">
            <Group justify="space-between">
              <Title order={4}>{t.instanceDetail.informationHeading}</Title>
              <Badge
                variant="light"
                color={instance.terminated ? 'gray' : 'green'}
                size="lg"
                data-testid="workflow-instance-detail-status"
              >
                {instance.terminated ? t.status.terminated : t.status.active}
              </Badge>
            </Group>

            <Divider />

            <Grid>
              <Field label={t.instanceDetail.fields.workflow} data-testid="workflow-instance-detail-workflow">
                <Text size="sm" fw={500}>
                  {/* The id when the backend answered no name; the marker when the definition is withheld */}
                  {instance.workflow?.name || instance.workflow?.id || t.emptyValue}
                </Text>
              </Field>

              <Field
                label={t.instanceDetail.fields.currentState}
                data-testid="workflow-instance-detail-current-state"
              >
                <Badge variant="filled" color="blue" size="lg" style={{ textTransform: 'none' }}>
                  {instance.current_state}
                </Badge>
              </Field>

              <Field label={t.instanceDetail.fields.collection} data-testid="workflow-instance-detail-collection">
                <Badge variant="light" style={{ textTransform: 'none' }}>
                  {instance.collection}
                </Badge>
              </Field>

              <Field label={t.instanceDetail.fields.itemId} data-testid="workflow-instance-detail-item-id">
                <Text size="sm" ff="monospace">
                  {instance.item_id}
                </Text>
              </Field>

              <Field label={t.instanceDetail.fields.versionKey} data-testid="workflow-instance-detail-version-key">
                <Text size="sm">{instance.version_key || t.emptyValue}</Text>
              </Field>

              <Field label={t.instanceDetail.fields.created} data-testid="workflow-instance-detail-created">
                <Text size="sm">{dateTime(instance.date_created)}</Text>
              </Field>

              <Field label={t.instanceDetail.fields.lastUpdated} data-testid="workflow-instance-detail-updated">
                <Text size="sm">{dateTime(instance.date_updated)}</Text>
              </Field>

              <Field label={t.instanceDetail.fields.instanceId} data-testid="workflow-instance-detail-id">
                <Text size="sm" ff="monospace">
                  {instance.id}
                </Text>
              </Field>
            </Grid>
          </Stack>
        )}
      </Paper>

      {instance && showDiagram && workflowJson && workflowJson.states.length > 0 && (
        <Paper shadow="xs" radius="md" p="xl" withBorder data-testid="workflow-instance-detail-diagram">
          <Stack gap="md">
            <Title order={4}>{t.workflowDetail.diagramTitle}</Title>
            <WorkflowDiagram
              workflowJson={workflowJson}
              readOnly
              height={diagramHeight}
              hideAttribution={hideAttribution}
              translations={translations}
            />
          </Stack>
        </Paper>
      )}

      {instance && (
        <Paper shadow="xs" radius="md" p="xl" withBorder data-testid="workflow-instance-detail-history">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconHistory size={20} />
              <Title order={4}>{t.instanceDetail.history.title}</Title>
            </Group>
            {history.status === 'loaded' && (
              <Badge variant="light" size="lg" data-testid="workflow-instance-detail-history-count">
                {formatCount(history.rows.length, t.count.transitions)}
              </Badge>
            )}
          </Group>

          <Divider mb="md" />

          {history.status === 'loading' && (
            <Group justify="center" py="xl" data-testid="workflow-instance-detail-history-loading">
              <Loader size="sm" />
            </Group>
          )}

          {history.status === 'accessDenied' && (
            <Box ta="center" py="xl" data-testid="workflow-instance-detail-history-access-denied">
              <Text c="dimmed" size="sm">
                {t.instanceDetail.history.accessDenied}
              </Text>
            </Box>
          )}

          {history.status === 'error' && (
            <Stack align="center" gap={0}>
              <WorkflowListEmptyState
                error
                title={interpolate(t.instanceDetail.history.loadError, { error: history.message })}
                data-testid="workflow-instance-detail-history-load-error"
              />
              <Button
                variant="default"
                size="xs"
                onClick={() => void loadHistory(requestRef.current)}
                data-testid="workflow-instance-detail-history-retry-btn"
              >
                {common.retry}
              </Button>
            </Stack>
          )}

          {history.status === 'loaded' && history.rows.length === 0 && (
            <Box ta="center" py="xl" data-testid="workflow-instance-detail-history-empty">
              <Text c="dimmed" size="sm">
                {t.instanceDetail.history.emptyState}
              </Text>
            </Box>
          )}

          {history.status === 'loaded' && history.rows.length > 0 && (
            <Table.ScrollContainer minWidth={700}>
              <Table striped highlightOnHover data-testid="workflow-instance-detail-history-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t.instanceDetail.history.columns.date}</Table.Th>
                    <Table.Th>{t.instanceDetail.history.columns.command}</Table.Th>
                    <Table.Th>{t.instanceDetail.history.columns.fromState}</Table.Th>
                    <Table.Th>{t.instanceDetail.history.columns.toState}</Table.Th>
                    <Table.Th>{t.instanceDetail.history.columns.transitionedBy}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.rows.map((record, index) => (
                    // A grant can withhold the id; the rows of one load never reorder
                    <Table.Tr key={record.id ?? index} data-testid="workflow-instance-detail-history-row">
                      <Table.Td>
                        <Text size="sm">{dateTime(record.transitioned_date)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="indigo" style={{ textTransform: 'none' }}>
                          {record.command}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" style={{ textTransform: 'none' }}>
                          {record.from_state}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="filled" color="blue" style={{ textTransform: 'none' }}>
                          {record.to_state}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {record.transitioned_by || t.emptyValue}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      )}
    </Stack>
  );
};

export default WorkflowInstanceDetail;

'use client';

import React, { useCallback, useMemo } from 'react';
import { ActionIcon, Badge, Box, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { useHydrated, useWorkflowInstances } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { WorkflowInstanceRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import { interpolate, type DeepPartial, type WorkflowsTranslations } from '@buildpad/utils';
import { WorkflowListEmptyState } from './WorkflowListEmptyState';
import { WorkflowListFooter } from './WorkflowListFooter';
import { WorkflowPageState } from './WorkflowPageState';
import { WorkflowSearchInput } from './WorkflowSearchInput';
import { useWorkflowList } from './useWorkflowList';
import './WorkflowManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface WorkflowInstancesManagerProps {
  /** Called when an instance row is clicked, and by the row's View Details button. */
  onInstanceClick?: (instance: WorkflowInstanceRecord) => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces. Default: false. */
  hideHeader?: boolean;
  /**
   * Persist search and page in the URL query string so the list is
   * shareable and reload-safe; see `WorkflowsManager`. Set `false` for
   * embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Workflow instances list — where each item is in its workflow: search by
 * collection, state or item id, a count, the table (workflow, collection, item
 * id, current state, version, status, created) and pagination with a
 * page-size selector. Read-only: an instance is created by the backend and
 * moves only through a transition. Ported from the buildpad-daas reference
 * `app/[lang]/workflow-instances/page.tsx` to `useWorkflowInstances` and
 * routing-agnostic navigation through `onInstanceClick`.
 *
 * What differs from the reference, on purpose:
 *
 * - There is no permission check on the page. The reference gated on
 *   'daas_workflow_instances', a name no backend knows, and so sent away users
 *   the API serves and let in users it refuses. The list has nothing to gate
 *   but reading, and whether the caller may read is the API's answer (it
 *   enforces `daas_wf_instance`): a refusal draws the access-denied state.
 * - A load that fails says so (the load-error state and a notification). The
 *   reference showed "No workflow instances found" for it.
 * - A search without matches says so; the reference said that instances are
 *   created automatically.
 * - The footer (count, page size, pager) is the one the other workflow lists
 *   have, and the search and page survive a reload.
 * - An instance whose definition the caller's grant withholds shows the
 *   missing-value marker in the Workflow column.
 *
 * Client-only gate: see `WorkflowsManager`.
 */
export const WorkflowInstancesManager: React.FC<WorkflowInstancesManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <WorkflowInstancesManagerBody {...props} />;
};

const WorkflowInstancesManagerBody: React.FC<WorkflowInstancesManagerProps> = ({
  onInstanceClick,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchInstances } = useWorkflowInstances();
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const { formatCount, formatDate } = useBuildpadI18n();

  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: t.instancesManager.columns.workflow, value: 'workflow', sortable: false },
      { text: t.instancesManager.columns.collection, value: 'collection', sortable: false },
      { text: t.instancesManager.columns.itemId, value: 'itemId', sortable: false },
      { text: t.instancesManager.columns.currentState, value: 'currentState', sortable: false },
      { text: t.instancesManager.columns.version, value: 'version', sortable: false },
      { text: t.instancesManager.columns.status, value: 'status', sortable: false },
      { text: t.instancesManager.columns.created, value: 'created', sortable: false },
    ],
    [t],
  );

  const list = useWorkflowList<WorkflowInstanceRecord>({
    fetchPage: fetchInstances,
    pageSize,
    pageSizeOptions,
    urlParams,
    urlParamPrefix,
    loadFailedMessage: t.instancesManager.notifications.loadFailed,
  });
  const { rows: instances, loading, failure } = list;

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const instance = item as unknown as WorkflowInstanceRecord;
      switch (header.value) {
        case 'workflow':
          return (
            <Text size="sm" fw={500}>
              {/* The id when the backend answered no name; the marker when the definition is withheld */}
              {instance.workflow?.name || instance.workflow?.id || t.emptyValue}
            </Text>
          );
        case 'collection':
          return (
            <Badge variant="light" size="sm" style={{ textTransform: 'none' }}>
              {instance.collection}
            </Badge>
          );
        case 'itemId':
          return (
            <Text size="sm" ff="monospace">
              {instance.item_id}
            </Text>
          );
        case 'currentState':
          return (
            <Badge variant="filled" color="blue" style={{ textTransform: 'none' }}>
              {instance.current_state}
            </Badge>
          );
        case 'version':
          return (
            <Text size="sm" c="dimmed">
              {instance.version_key || t.emptyValue}
            </Text>
          );
        case 'status':
          return (
            <Badge variant="light" color={instance.terminated ? 'gray' : 'green'}>
              {instance.terminated ? t.status.terminated : t.status.active}
            </Badge>
          );
        case 'created':
          return (
            <Text size="sm" c="dimmed">
              {/* `formatDate` returns '' for an empty or invalid value */}
              {formatDate(instance.date_created) || t.emptyValue}
            </Text>
          );
        default:
          return null;
      }
    },
    [t, formatDate],
  );

  const renderRowAppend = onInstanceClick
    ? (item: Item) => (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={(e) => {
            // The row's own click would open the instance a second time
            e.stopPropagation();
            onInstanceClick(item as unknown as WorkflowInstanceRecord);
          }}
          aria-label={t.instancesManager.viewDetails}
          title={t.instancesManager.viewDetails}
        >
          <IconEye size={16} />
        </ActionIcon>
      )
    : undefined;

  const header = !hideHeader && (
    <Box>
      <Title order={2} mb={4}>
        {t.instancesManager.title}
      </Title>
      <Text size="sm" c="dimmed">
        {t.instancesManager.subtitle}
      </Text>
    </Box>
  );

  if (failure?.kind === 'accessDenied') {
    return (
      <Stack gap="md" data-testid="workflow-instances-manager">
        {header}
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={failure.description || t.accessDenied.description}
          data-testid="workflow-instances-manager-access-denied"
        />
      </Stack>
    );
  }

  const empty = !loading && instances.length === 0;

  return (
    <Stack gap="md" data-testid="workflow-instances-manager">
      {header}

      <div className="bp-workflow-manager-card">
        <Group className="bp-workflow-manager-toolbar" wrap="wrap">
          <WorkflowSearchInput
            placeholder={t.instancesManager.searchPlaceholder}
            value={list.search}
            onChange={list.setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="workflow-instances-manager-search"
            translations={translations}
          />
          {!failure && (
            <Badge
              variant="light"
              color="gray"
              size="lg"
              radius="sm"
              style={{ marginLeft: 'auto' }}
              data-testid="workflow-instances-manager-count"
            >
              {formatCount(list.totalCount, t.count.instances)}
            </Badge>
          )}
        </Group>

        {empty && failure && (
          <WorkflowListEmptyState
            error
            title={interpolate(t.instancesManager.emptyState.loadError, { error: failure.message })}
            data-testid="workflow-instances-manager-load-error"
          />
        )}

        {empty && !failure && (
          <WorkflowListEmptyState
            title={
              list.debouncedSearch ? t.instancesManager.emptyState.search : t.instancesManager.emptyState.pristine
            }
            data-testid="workflow-instances-manager-empty"
          />
        )}

        {!empty && (
          <VTable
            headers={headers}
            items={instances as unknown as Item[]}
            itemKey="id"
            showSelect="none"
            fixedHeader
            loading={loading}
            clickable={Boolean(onInstanceClick)}
            renderCell={renderCell}
            renderRowAppend={renderRowAppend}
            renderFooter={() => (
              <WorkflowListFooter
                shown={instances.length}
                totalCount={list.totalCount}
                itemsLabel={t.instancesManager.itemsLabel}
                page={list.page}
                totalPages={list.totalPages}
                onPageChange={list.setPage}
                limit={list.limit}
                sizeOptions={list.sizeOptions}
                onLimitChange={list.setLimit}
                data-testid="workflow-instances-manager-page-size"
                translations={translations}
              />
            )}
            onRowClick={
              onInstanceClick
                ? ({ item }) => onInstanceClick(item as unknown as WorkflowInstanceRecord)
                : undefined
            }
            data-testid="workflow-instances-manager-table"
          />
        )}
      </div>
    </Stack>
  );
};

export default WorkflowInstancesManager;

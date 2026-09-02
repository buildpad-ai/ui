'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Center,
  Loader,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconShield } from '@tabler/icons-react';
import { readUrlIntParam, readUrlParam, useHydrated, usePermissions, usePolicies, useUrlListParams } from '@buildpad/hooks';
import type { Policy } from '@buildpad/types';
import { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item, Sort } from '@buildpad/ui-table';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListFooter } from './ListFooter';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import './ManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const POLICY_HEADERS: HeaderRaw[] = [
  { text: '', value: 'icon', sortable: false, width: 48 },
  { text: 'Name', value: 'name', sortable: true, width: 260 },
  { text: 'Users', value: 'userCount', sortable: false },
  { text: 'Roles', value: 'roleCount', sortable: false },
  { text: 'Description', value: 'description', sortable: false },
];

export interface PoliciesManagerProps {
  /** Called when a policy row is clicked (and the current user may update policies). */
  onPolicyClick?: (policy: Policy) => void;
  /** Called when the "Add Policy" button is clicked. */
  onCreatePolicy?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add Policy button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_policies'. */
  policiesCollection?: string;
  /**
   * Persist search, sort, and page in the URL query string so the list is
   * shareable and reload-safe. Writes ride the 300 ms search debounce and go
   * through the app's registered URL writer (Next.js App Router:
   * `router.replace`, registered by the `DaaSProviderWrapper` template —
   * required there); outside a router they fall back to `history.replaceState`.
   * Set `false` for embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
}

/**
 * Policies list surface: search, user/role attachment counts, sortable Name
 * column, pagination with a page-size selector, and a row menu for
 * edit/delete. Ported from the buildpad-daas reference
 * `app/policies/page.tsx` to `usePolicies` + `usePermissions` and
 * routing-agnostic navigation via `onPolicyClick`/`onCreatePolicy` props.
 *
 * Only `name` is sortable: `userCount`/`roleCount` are computed after the
 * query server-side and cannot be sorted on.
 */
/** Parse the DaaS-style sort string (`-name` = descending). */
function parseSortParam(raw: string | null): Sort | null {
  if (!raw) return null;
  const desc = raw.startsWith('-');
  const by = desc ? raw.slice(1) : raw;
  return by ? { by, desc } : null;
}

/**
 * Client-only gate. The body seeds its state from the URL in `useState`
 * initializers, which renders differently on the server (no URL) and on the
 * client — a hydration mismatch on every deep link. Until hydrated, render the
 * same loading shell the body shows before its first fetch, so server HTML and
 * the hydration render agree; the body then mounts once with the URL in hand.
 * Skipped when URL persistence is off, since then initial state is
 * URL-independent and the body can server-render as before.
 */
export const PoliciesManager: React.FC<PoliciesManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <PoliciesManagerBody {...props} />;
};

const PoliciesManagerBody: React.FC<PoliciesManagerProps> = ({
  onPolicyClick,
  onCreatePolicy,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  policiesCollection = 'daas_policies',
  urlParams = true,
  urlParamPrefix = '',
}) => {
  const { fetchPolicies, deletePolicy } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [policiesCollection],
  });

  const createAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'delete');

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // Server-side sort; computed count columns are not sortable.
  const [sort, setSort] = useState<Sort | null>(() =>
    urlParams ? parseSortParam(readUrlParam(param('sort'))) : null,
  );
  // URL persistence — see useUrlListParams. Defaults serialize to null so they
  // stay off the URL; Back/Forward and bridge rewrites flow back in below.
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('sort')]: sort ? `${sort.desc ? '-' : ''}${sort.by}` : null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));
        setSort((current) => {
          const next = parseSortParam(get(param('sort')));
          const same = current?.by === next?.by && current?.desc === next?.desc;
          return same ? current : next;
        });
        const rawPage = get(param('page'));
        const nextPage = (() => {
          const value = rawPage ? Number.parseInt(rawPage, 10) : 1;
          return Number.isInteger(value) && value > 0 ? value : 1;
        })();
        setPage((current) => (current === nextPage ? current : nextPage));
      },
      [param],
    ),
  });


  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPolicies({
        page,
        limit,
        search: debouncedSearch || undefined,
        sort: sort?.by ? (sort.desc ? `-${sort.by}` : sort.by) : undefined,
      });
      setPolicies(result.policies);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load policies';
      setPolicies([]);
      setLoadError(message);
      notifications.show({ title: 'Failed to load policies', message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies, page, limit, debouncedSearch, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only on CHANGES — not mount, or a ?page= restored from the URL is clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted". StrictMode re-runs mount effects with refs intact, so a
  // has-mounted flag fires setPage(1) on the second run and clobbers a
  // ?page= restored from the URL in development.
  const filtersKey = JSON.stringify([debouncedSearch, sort, limit]);
  const previousFiltersKeyRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (previousFiltersKeyRef.current !== null && previousFiltersKeyRef.current !== filtersKey) {
      setPage(1);
    }
    previousFiltersKeyRef.current = filtersKey;
  }, [filtersKey]);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deletePolicy(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } catch (err) {
      // Keep the modal open so the administrator can retry or cancel.
      notifications.show({
        title: 'Failed to delete policy',
        message: err instanceof Error ? err.message : 'Failed to delete policy',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [deletePolicy, deleteModal.id, load]);

  const addButton =
    createAllowed && onCreatePolicy ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreatePolicy} data-testid="policies-manager-add-btn">
        Add Policy
      </Button>
    ) : null;

  const renderCell = useCallback((item: Item, header: Header): React.ReactNode => {
    const policy = item as unknown as Policy;
    switch (header.value) {
      case 'icon':
        return <IconDisplay icon={policy.icon} fallback={IconShield} />;
      case 'name':
        return (
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {policy.name}
            </Text>
            {policy.admin_access && (
              <Badge color="red" size="xs">
                Admin
              </Badge>
            )}
            {policy.app_access && (
              <Badge color="blue" size="xs">
                App
              </Badge>
            )}
          </Group>
        );
      case 'userCount':
        return <Text size="sm">{policy.userCount || 0}</Text>;
      case 'roleCount':
        return <Text size="sm">{policy.roleCount || 0}</Text>;
      case 'description':
        return (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {policy.description || '—'}
          </Text>
        );
      default:
        return null;
    }
  }, []);

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const policy = item as unknown as Policy;
          return (
            <RowActionsMenu
              onEdit={updateAllowed ? () => onPolicyClick?.(policy) : undefined}
              onDelete={
                deleteAllowed ? () => setDeleteModal({ opened: true, id: policy.id }) : undefined
              }
            />
          );
        }
      : undefined;

  return (
    <Stack gap="md" data-testid="policies-manager">
      {!hideHeader && (
        <Box>
          <Title order={2} mb={4}>
            Policies
          </Title>
          <Text size="sm" c="dimmed">
            Define policies that grant access and permissions to users and roles
          </Text>
        </Box>
      )}

      <div className="bp-manager-card">
        <Group className="bp-manager-toolbar" wrap="wrap">
          <SearchInput
            placeholder="Search policies..."
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="policies-manager-search"
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {totalCount > 0 && (
              <Badge variant="light" color="gray" size="lg" radius="sm">
                {totalCount} {totalCount === 1 ? 'policy' : 'policies'}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        <VTable
          headers={POLICY_HEADERS}
          items={policies as unknown as Item[]}
          itemKey="id"
          sort={sort}
          showSelect="none"
          fixedHeader
          loading={loading}
          noItemsText={
            loadError
              ? `Failed to load policies — ${loadError}`
              : debouncedSearch
                ? 'No policies found — try a different search term'
                : 'No policies found — create your first policy to get started'
          }
          clickable={updateAllowed}
          renderCell={renderCell}
          renderRowAppend={renderRowAppend}
          renderFooter={() => (
            <ListFooter
              shown={policies.length}
              totalCount={totalCount}
              itemsLabel="policies"
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={limit}
              sizeOptions={sizeOptions}
              onLimitChange={setLimit}
              data-testid="policies-manager-page-size"
            />
          )}
          onSortChange={setSort}
          onRowClick={updateAllowed ? ({ item }) => onPolicyClick?.(item as unknown as Policy) : undefined}
          data-testid="policies-manager-table"
        />
      </div>

      <DeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete policy"
        description="Are you sure you want to delete this policy? This action cannot be undone."
      />
    </Stack>
  );
};

export default PoliciesManager;

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
import { IconPlus, IconUsersGroup } from '@tabler/icons-react';
import { readUrlIntParam, readUrlParam, useHydrated, usePermissions, useRoles, useUrlListParams } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { Role } from '@buildpad/types';
import { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListFooter } from './ListFooter';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import './ManagerTable.css';

function getUserCount(role: Role): number {
  return role.users?.[0]?.count ?? 0;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface RolesManagerProps {
  /** Called when a role row is clicked (and the current user may update roles). */
  onRoleClick?: (role: Role) => void;
  /** Called when the "Add Role" button is clicked. */
  onCreateRole?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add Role button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_roles'. */
  rolesCollection?: string;
  /**
   * Persist search and page in the URL query string so the list is
   * shareable and reload-safe. Writes ride the 300 ms search debounce and go
   * through the app's registered URL writer (Next.js App Router:
   * `router.replace`, registered by the `DaaSProviderWrapper` template —
   * required there); outside a router they fall back to `history.replaceState`.
   * Set `false` for embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Roles list surface: search, member counts (`includeUsers=true`),
 * pagination with a page-size selector, and a row menu for edit/delete.
 * Ported from the buildpad-daas reference `app/roles/page.tsx` to
 * `useRoles` + `usePermissions` and routing-agnostic navigation via
 * `onRoleClick`/`onCreateRole` props.
 *
 * No column sorting: the roles API ignores the `sort` param (hardcodes
 * name-asc), so a sort UI here would lie across pages (Req 20.6).
 */
/**
 * Client-only gate. The body seeds its state from the URL in `useState`
 * initializers, which renders differently on the server (no URL) and on the
 * client — a hydration mismatch on every deep link. Until hydrated, render the
 * same loading shell the body shows before its first fetch, so server HTML and
 * the hydration render agree; the body then mounts once with the URL in hand.
 * Skipped when URL persistence is off, since then initial state is
 * URL-independent and the body can server-render as before.
 */
export const RolesManager: React.FC<RolesManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <RolesManagerBody {...props} />;
};

const RolesManagerBody: React.FC<RolesManagerProps> = ({
  onRoleClick,
  onCreateRole,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  rolesCollection = 'daas_roles',
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchRoles, deleteRole } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [rolesCollection],
  });
  const t = useBuildpadTranslations((d) => d.users, translations);
  const { formatCount } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'delete');

  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: '', value: 'icon', sortable: false, width: 48 },
      { text: t.columns.name, value: 'name', sortable: false },
      { text: t.columns.users, value: 'users', sortable: false },
      { text: t.columns.description, value: 'description', sortable: false },
    ],
    [t]
  );

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // URL persistence — see useUrlListParams. Defaults serialize to null so they
  // stay off the URL; Back/Forward and bridge rewrites flow back in below.
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));
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
      const result = await fetchRoles({
        page,
        limit,
        search: debouncedSearch || undefined,
        includeUsers: true,
      });
      setRoles(result.roles);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.rolesManager.notifications.loadFailed;
      setRoles([]);
      setLoadError(message);
      notifications.show({ title: t.rolesManager.notifications.loadFailed, message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fetchRoles, page, limit, debouncedSearch, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only on CHANGES — not mount, or a ?page= restored from the URL is clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted". StrictMode re-runs mount effects with refs intact, so a
  // has-mounted flag fires setPage(1) on the second run and clobbers a
  // ?page= restored from the URL in development.
  const filtersKey = JSON.stringify([debouncedSearch, limit]);
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
      await deleteRole(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } catch (err) {
      // Keep the modal open so the administrator can retry or cancel.
      notifications.show({
        title: t.rolesManager.notifications.deleteFailed,
        message: err instanceof Error ? err.message : t.rolesManager.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteRole, deleteModal.id, load, t]);

  const addButton =
    createAllowed && onCreateRole ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateRole} data-testid="roles-manager-add-btn">
        {t.rolesManager.addRole}
      </Button>
    ) : null;

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const role = item as unknown as Role;
      switch (header.value) {
        case 'icon':
          // Explicit fallback: IconDisplay's default is the generic
          // unknown-icon glyph, which reads as broken data for the common case
          // of a role simply having no icon set. A users-group glyph is the
          // right empty state here — the sibling policy surfaces pass
          // `fallback={IconShield}` for the same reason.
          return <IconDisplay icon={role.icon} fallback={IconUsersGroup} />;
        case 'name':
          return (
            <Text size="sm" fw={500}>
              {role.name}
            </Text>
          );
        case 'users':
          return (
            <Group gap={4}>
              <IconUsersGroup size={14} stroke={1.5} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {getUserCount(role)}
              </Text>
            </Group>
          );
        case 'description':
          return (
            <Text size="sm" c="dimmed" lineClamp={1}>
              {role.description || t.emptyValue}
            </Text>
          );
        default:
          return null;
      }
    },
    [t]
  );

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const role = item as unknown as Role;
          return (
            <RowActionsMenu
              onEdit={updateAllowed ? () => onRoleClick?.(role) : undefined}
              onDelete={
                deleteAllowed ? () => setDeleteModal({ opened: true, id: role.id }) : undefined
              }
              translations={translations}
            />
          );
        }
      : undefined;

  return (
    <Stack gap="md" data-testid="roles-manager">
      {!hideHeader && (
        <Box>
          <Title order={2} mb={4}>
            {t.rolesManager.title}
          </Title>
          <Text size="sm" c="dimmed">
            {t.rolesManager.subtitle}
          </Text>
        </Box>
      )}

      <div className="bp-manager-card">
        <Group className="bp-manager-toolbar" wrap="wrap">
          <SearchInput
            placeholder={t.rolesManager.searchPlaceholder}
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="roles-manager-search"
            translations={translations}
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {totalCount > 0 && (
              <Badge variant="light" color="gray" size="lg" radius="sm">
                {formatCount(totalCount, t.count.roles)}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        <VTable
          headers={headers}
          items={roles as unknown as Item[]}
          itemKey="id"
          showSelect="none"
          fixedHeader
          loading={loading}
          noItemsText={
            loadError
              ? interpolate(t.rolesManager.emptyState.loadError, { error: loadError })
              : debouncedSearch
                ? t.rolesManager.emptyState.search
                : t.rolesManager.emptyState.pristine
          }
          clickable={updateAllowed}
          renderCell={renderCell}
          renderRowAppend={renderRowAppend}
          renderFooter={() => (
            <ListFooter
              shown={roles.length}
              totalCount={totalCount}
              itemsLabel={t.rolesManager.itemsLabel}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={limit}
              sizeOptions={sizeOptions}
              onLimitChange={setLimit}
              data-testid="roles-manager-page-size"
              translations={translations}
            />
          )}
          onRowClick={updateAllowed ? ({ item }) => onRoleClick?.(item as unknown as Role) : undefined}
          data-testid="roles-manager-table"
        />
      </div>

      <DeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t.rolesManager.deleteModal.title}
        description={t.rolesManager.deleteModal.description}
        translations={translations}
      />
    </Stack>
  );
};

export default RolesManager;

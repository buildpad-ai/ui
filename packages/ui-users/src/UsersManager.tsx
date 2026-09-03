'use client';

import './UsersManager.css';
import './ManagerTable.css';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Text,
  Title,
  Center,
  Loader,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconUsersGroup } from '@tabler/icons-react';
import {
  readUrlIntParam,
  readUrlParam,
  usePermissions,
  useRoles,
  useSelection,
  useHydrated,
  useUrlListParams,
  useUsers,
} from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { Role, User, UserStatus } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item, Sort } from '@buildpad/ui-table';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListFooter } from './ListFooter';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import { DATE_FORMAT_OPTIONS } from './accessUtils';
import { getUserDisplayName } from './userDisplay';

/** Order of the status filter / bulk "Set status" options; labels come from `users.status`. */
const STATUS_VALUES: UserStatus[] = ['active', 'suspended', 'invited', 'draft', 'terminated'];

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** A role entry as it may appear on `User.roles`: a bare ID, a flattened
 * `{id,name,icon}` object, or a junction row shaped `{id, role_id: {...}}`. */
type RoleEntry = string | { id?: string; name?: string; role_id?: { id?: string; name?: string } };

/** Extract a displayable `{ id, name }` badge from a role entry in any of the supported shapes. */
function extractRoleBadge(entry: RoleEntry): { id: string; name: string } | null {
  if (typeof entry === 'string') return null; // bare ID with no name to display
  const nested = entry.role_id;
  if (nested?.name) return { id: nested.id ?? entry.id ?? nested.name, name: nested.name };
  if (entry.name) return { id: entry.id ?? entry.name, name: entry.name };
  return null;
}

export interface UsersManagerProps {
  /** Called when a user row is clicked (and the current user may update users). */
  onUserClick?: (user: User) => void;
  /** Called when the "Add User" button is clicked. */
  onCreateUser?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add User button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_users'. */
  usersCollection?: string;
  /**
   * Persist search, filters, sort, and page in the URL query string
   * (`?search=…&role=…&status=…&sort=…&page=…`) so the list is shareable and
   * reload-safe. Writes ride the existing 300 ms search debounce and go through
   * the app's registered URL writer (Next.js App Router: `router.replace`,
   * registered by the `DaaSProviderWrapper` template — required there);
   * outside a router they fall back to `history.replaceState`. Set `false` for embedded surfaces that must not
   * touch the page URL. Default: true.
   */
  urlParams?: boolean;
  /**
   * Prefix for every URL parameter this list manages (e.g. `'users-'` →
   * `?users-search=…`). Use when two url-synced lists share one page.
   * Default: '' (unprefixed).
   */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

interface BulkRolesModalProps {
  opened: boolean;
  onClose: () => void;
  roles: Role[];
  count: number;
  busy: boolean;
  onApply: (addRoles: string[], removeRoles: string[]) => void;
  translations?: DeepPartial<UsersTranslations>;
}

/** Staged add/remove role picks applied in a single `bulkUpdateUsers` call. */
const BulkRolesModal: React.FC<BulkRolesModalProps> = ({
  opened,
  onClose,
  roles,
  count,
  busy,
  onApply,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();
  const [addRoles, setAddRoles] = useState<string[]>([]);
  const [removeRoles, setRemoveRoles] = useState<string[]>([]);

  useEffect(() => {
    if (opened) {
      setAddRoles([]);
      setRemoveRoles([]);
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t.usersManager.bulkRoles.title}
      data-testid="users-manager-bulk-roles-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {formatCount(count, t.usersManager.bulkRoles.description)}
        </Text>
        <MultiSelect
          label={t.usersManager.bulkRoles.addLabel}
          placeholder={t.usersManager.bulkRoles.addPlaceholder}
          data={roles.map((role) => ({
            value: role.id,
            label: role.name,
            // Scope rules reject assignment of non-assignable roles server-side.
            disabled: role.assignable === false,
          }))}
          value={addRoles}
          onChange={setAddRoles}
          searchable
          clearable
          data-testid="users-manager-bulk-roles-add"
        />
        <MultiSelect
          label={t.usersManager.bulkRoles.removeLabel}
          placeholder={t.usersManager.bulkRoles.removePlaceholder}
          data={roles.map((role) => ({ value: role.id, label: role.name }))}
          value={removeRoles}
          onChange={setRemoveRoles}
          searchable
          clearable
          data-testid="users-manager-bulk-roles-remove"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button
            onClick={() => onApply(addRoles, removeRoles)}
            loading={busy}
            disabled={addRoles.length === 0 && removeRoles.length === 0}
            data-testid="users-manager-bulk-roles-apply"
          >
            {common.apply}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

/**
 * Full users list surface: search, role/status filters, sortable columns,
 * pagination with a page-size selector, bulk actions (roles/status/delete),
 * and a row menu for edit/delete. Ported from the buildpad-daas reference
 * `app/users/page.tsx` to `useUsers`/`useRoles` + `usePermissions` and
 * routing-agnostic navigation via `onUserClick`/`onCreateUser` props.
 */
/** Accept only real statuses from the URL; anything else means "no filter". */
function parseStatusParam(raw: string | null): UserStatus | null {
  if (!raw) return null;
  return STATUS_VALUES.some((value) => value === raw) ? (raw as UserStatus) : null;
}

/** Parse the DaaS-style sort string (`-last_access` = descending). */
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
export const UsersManager: React.FC<UsersManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <UsersManagerBody {...props} />;
};

const UsersManagerBody: React.FC<UsersManagerProps> = ({
  onUserClick,
  onCreateUser,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  usersCollection = 'daas_users',
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchUsers, updateUser, deleteUser, bulkUpdateUsers } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
  });
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatDate, formatCount } = useBuildpadI18n();

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'delete');
  const selectable = updateAllowed || deleteAllowed;

  const statusOptions = useMemo<Array<{ value: UserStatus; label: string }>>(
    () => STATUS_VALUES.map((value) => ({ value, label: t.status[value] })),
    [t]
  );
  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: t.usersManager.columns.user, value: 'first_name', sortable: true, width: 260 },
      { text: t.usersManager.columns.email, value: 'email', sortable: true },
      { text: t.usersManager.columns.role, value: 'roles', sortable: false },
      { text: t.usersManager.columns.status, value: 'status', sortable: true },
      { text: t.usersManager.columns.lastAccess, value: 'last_access', sortable: true },
    ],
    [t]
  );

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // URL-persisted list state (see useUrlListParams). Initializers read the URL
  // once, so a shared /users?search=ann&status=active&page=2 link restores the
  // exact view; invalid values fall back to the defaults.
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [selectedRole, setSelectedRole] = useState<string | null>(() =>
    urlParams ? readUrlParam(param('role')) : null,
  );
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | null>(() =>
    urlParams ? parseStatusParam(readUrlParam(param('status'))) : null,
  );
  // Server-side sort; fields are whitelisted real columns.
  const [sort, setSort] = useState<Sort | null>(() =>
    urlParams ? parseSortParam(readUrlParam(param('sort'))) : null,
  );

  const { selection, setSelection, clearSelection, selectionCount } = useSelection<string>();

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const [bulkRolesOpen, setBulkRolesOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const hasFilters = Boolean(debouncedSearch || selectedRole || selectedStatus);

  // Keep the URL following the settled state (search rides its 300 ms
  // debounce), and the state following the URL on Back/Forward or a
  // bridge-driven rewrite. Defaults serialize to null so they stay off the URL.
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('role')]: selectedRole,
      [param('status')]: selectedStatus,
      [param('sort')]: sort ? `${sort.desc ? '-' : ''}${sort.by}` : null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));
        setSelectedRole((current) => {
          const next = get(param('role'));
          return current === next ? current : next;
        });
        setSelectedStatus((current) => {
          const next = parseStatusParam(get(param('status')));
          return current === next ? current : next;
        });
        setSort((current) => {
          const next = parseSortParam(get(param('sort')));
          const same = current?.by === next?.by && current?.desc === next?.desc;
          return same ? current : next;
        });
        const nextPage = (() => {
          const raw = get(param('page'));
          const value = raw ? Number.parseInt(raw, 10) : 1;
          return Number.isInteger(value) && value > 0 ? value : 1;
        })();
        setPage((current) => (current === nextPage ? current : nextPage));
      },
      [param],
    ),
  });

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        sort: sort?.by ? (sort.desc ? `-${sort.by}` : sort.by) : undefined,
        // Expand the roles junction so the Role column has names to badge
        // (daas reference projection — without it the API returns bare IDs).
        fields: '*,roles.*,roles.role_id.name',
      });
      setUsers(result.users);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.usersManager.notifications.loadFailed;
      setUsers([]);
      setLoadError(message);
      notifications.show({ title: t.usersManager.notifications.loadFailed, message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, page, limit, debouncedSearch, selectedRole, selectedStatus, sort, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 whenever a filter, the sort, or the page size CHANGES —
  // not on mount, or a ?page=3 restored from the URL would be clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted". StrictMode re-runs mount effects with refs intact, so a
  // has-mounted flag fires setPage(1) on the second run and clobbers a
  // ?page= restored from the URL in development.
  const filtersKey = JSON.stringify([debouncedSearch, selectedRole, selectedStatus, sort, limit]);
  const previousFiltersKeyRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (previousFiltersKeyRef.current !== null && previousFiltersKeyRef.current !== filtersKey) {
      setPage(1);
    }
    previousFiltersKeyRef.current = filtersKey;
  }, [filtersKey]);

  // Selection survives page changes but not a change of what's being listed.
  useEffect(() => {
    clearSelection();
  }, [debouncedSearch, selectedRole, selectedStatus, clearSelection]);

  useEffect(() => {
    fetchRoles({ limit: 1000 })
      .then((result) => setRoles(result.roles))
      .catch(() => setRoles([]));
  }, [fetchRoles]);

  const requestDelete = useCallback((id: string) => {
    setDeleteModal({ opened: true, id });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteUser(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } catch (err) {
      // Keep the modal open so the administrator can retry or cancel.
      notifications.show({
        title: t.usersManager.notifications.deleteFailed,
        message: err instanceof Error ? err.message : t.usersManager.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteUser, deleteModal.id, load, t]);

  const bulkApplyRoles = useCallback(
    async (addRoles: string[], removeRoles: string[]) => {
      setBulkBusy(true);
      try {
        await bulkUpdateUsers(selection, {
          addRoles: addRoles.length > 0 ? addRoles : undefined,
          removeRoles: removeRoles.length > 0 ? removeRoles : undefined,
        });
        notifications.show({
          title: t.usersManager.notifications.rolesUpdatedTitle,
          message: formatCount(selection.length, t.usersManager.notifications.rolesUpdated),
          color: 'green',
        });
        setBulkRolesOpen(false);
        clearSelection();
        await load();
      } catch (err) {
        notifications.show({
          title: common.error,
          message: err instanceof Error ? err.message : t.usersManager.notifications.rolesUpdateFailed,
          color: 'red',
        });
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkUpdateUsers, selection, clearSelection, load, t, common, formatCount]
  );

  // No bulk-status/bulk-delete endpoints exist — fan out per user.
  const bulkSetStatus = useCallback(
    async (status: UserStatus) => {
      setBulkBusy(true);
      try {
        const results = await Promise.allSettled(
          selection.map((id) => updateUser(id, { status }))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        const succeeded = results.length - failed;
        notifications.show({
          title:
            failed > 0
              ? t.usersManager.notifications.completedWithErrors
              : t.usersManager.notifications.statusUpdatedTitle,
          message:
            failed > 0
              ? interpolate(t.usersManager.notifications.statusPartial, {
                  succeeded,
                  total: results.length,
                  failed,
                })
              : formatCount(succeeded, t.usersManager.notifications.statusUpdated, {
                  status: t.statusBadge[status] ?? status,
                }),
          color: failed > 0 ? 'orange' : 'green',
        });
        clearSelection();
        await load();
      } finally {
        setBulkBusy(false);
      }
    },
    [selection, updateUser, clearSelection, load, t, formatCount]
  );

  const bulkDelete = useCallback(async () => {
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selection.map((id) => deleteUser(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      notifications.show({
        title:
          failed > 0
            ? t.usersManager.notifications.completedWithErrors
            : t.usersManager.notifications.usersDeletedTitle,
        message:
          failed > 0
            ? interpolate(t.usersManager.notifications.deletePartial, {
                succeeded,
                total: results.length,
                failed,
              })
            : formatCount(succeeded, t.usersManager.notifications.deleted),
        color: failed > 0 ? 'orange' : 'green',
      });
      setBulkDeleteOpen(false);
      clearSelection();
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [selection, deleteUser, clearSelection, load, t, formatCount]);

  const addButton =
    createAllowed && onCreateUser ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateUser} data-testid="users-manager-add-btn">
        {t.usersManager.addUser}
      </Button>
    ) : null;

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const user = item as unknown as User;
      switch (header.value) {
        case 'first_name':
          return (
            <Group gap="sm">
              <UserAvatar user={user} size={32} />
              <Text size="sm" fw={500}>
                {getUserDisplayName(user)}
              </Text>
            </Group>
          );
        case 'email':
          return (
            <Text size="sm" c="dimmed">
              {user.email}
            </Text>
          );
        case 'roles': {
          const roleBadges = (user.roles ?? [])
            .map((r) => extractRoleBadge(r as RoleEntry))
            .filter((r): r is { id: string; name: string } => r !== null);
          return roleBadges.length > 0 ? (
            <Group gap={4} wrap="wrap">
              {roleBadges.map((r) => (
                <Badge key={r.id} variant="light" size="sm">
                  {r.name}
                </Badge>
              ))}
            </Group>
          ) : (
            <></>
          );
        }
        case 'status':
          return <UserStatusBadge status={user.status} translations={translations} />;
        case 'last_access':
          return (
            <Text size="xs" c="dimmed">
              {user.last_access ? formatDate(user.last_access, DATE_FORMAT_OPTIONS) : t.never}
            </Text>
          );
        default:
          return null;
      }
    },
    [t, formatDate, translations]
  );

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const user = item as unknown as User;
          return (
            <RowActionsMenu
              onEdit={updateAllowed ? () => onUserClick?.(user) : undefined}
              onDelete={deleteAllowed ? () => requestDelete(user.id) : undefined}
              translations={translations}
            />
          );
        }
      : undefined;

  return (
    <Stack gap="md" className="bp-users-manager" data-testid="users-manager">
      {!hideHeader && (
        <Box>
          <Title order={2} mb={4}>
            {t.usersManager.title}
          </Title>
          <Text size="sm" c="dimmed">
            {t.usersManager.subtitle}
          </Text>
        </Box>
      )}

      {selectionCount > 0 && (
        <Paper p="sm" radius="md" withBorder data-testid="users-manager-bulk-toolbar">
          <Group>
            <Text size="sm" fw={500}>
              {formatCount(selectionCount, common.selectedCount)}
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={clearSelection}
              data-testid="users-manager-bulk-clear"
            >
              {common.clear}
            </Button>
            <Group gap="xs" style={{ marginLeft: 'auto' }}>
              {updateAllowed && (
                <>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconUsersGroup size={14} />}
                    onClick={() => setBulkRolesOpen(true)}
                    data-testid="users-manager-bulk-roles"
                  >
                    {t.usersManager.bulk.updateRoles}
                  </Button>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Button variant="light" size="xs" data-testid="users-manager-bulk-status">
                        {t.usersManager.bulk.setStatus}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {statusOptions.map((option) => (
                        <Menu.Item
                          key={option.value}
                          onClick={() => void bulkSetStatus(option.value)}
                          data-testid={`users-manager-bulk-status-${option.value}`}
                        >
                          {option.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                </>
              )}
              {deleteAllowed && (
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setBulkDeleteOpen(true)}
                  data-testid="users-manager-bulk-delete"
                >
                  {common.delete}
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

      <div className="bp-manager-card">
        <Group className="bp-manager-toolbar" wrap="wrap">
          <SearchInput
            placeholder={t.usersManager.searchPlaceholder}
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="users-manager-search"
            translations={translations}
          />
          <Select
            placeholder={t.usersManager.filters.role}
            data={roles.map((role) => ({ value: role.id, label: role.name }))}
            value={selectedRole}
            onChange={setSelectedRole}
            clearable
            size="sm"
            style={{ minWidth: 160 }}
            data-testid="users-manager-role-filter"
          />
          <Select
            placeholder={t.usersManager.filters.status}
            data={statusOptions}
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value as UserStatus | null)}
            clearable
            size="sm"
            style={{ minWidth: 160 }}
            data-testid="users-manager-status-filter"
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {totalCount > 0 && (
              <Badge variant="light" color="gray" size="lg" radius="sm">
                {formatCount(totalCount, t.count.users)}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        <VTable
          headers={headers}
          items={users as unknown as Item[]}
          itemKey="id"
          sort={sort}
          showSelect={selectable ? 'multiple' : 'none'}
          value={selection}
          selectionUseKeys
          fixedHeader
          loading={loading}
          noItemsText={
            loadError
              ? interpolate(t.usersManager.emptyState.loadError, { error: loadError })
              : hasFilters
                ? t.usersManager.emptyState.filtered
                : t.usersManager.emptyState.pristine
          }
          clickable={updateAllowed}
          renderCell={renderCell}
          renderRowAppend={renderRowAppend}
          renderFooter={() => (
            <ListFooter
              shown={users.length}
              totalCount={totalCount}
              itemsLabel={t.usersManager.itemsLabel}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={limit}
              sizeOptions={sizeOptions}
              onLimitChange={setLimit}
              data-testid="users-manager-page-size"
              translations={translations}
            />
          )}
          onUpdate={(value) => setSelection(value as string[])}
          onSortChange={setSort}
          onRowClick={updateAllowed ? ({ item }) => onUserClick?.(item as unknown as User) : undefined}
          data-testid="users-manager-table"
        />
      </div>

      <DeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t.usersManager.deleteModal.title}
        description={t.usersManager.deleteModal.description}
        translations={translations}
      />

      <DeleteConfirmModal
        opened={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
        loading={bulkBusy}
        title={t.usersManager.bulkDeleteModal.title}
        description={formatCount(selectionCount, t.usersManager.bulkDeleteModal.description)}
        translations={translations}
      />

      <BulkRolesModal
        opened={bulkRolesOpen}
        onClose={() => setBulkRolesOpen(false)}
        roles={roles}
        count={selectionCount}
        busy={bulkBusy}
        onApply={(addRoles, removeRoles) => void bulkApplyRoles(addRoles, removeRoles)}
        translations={translations}
      />
    </Stack>
  );
};

export default UsersManager;

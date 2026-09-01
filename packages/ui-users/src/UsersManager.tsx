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
  useUrlListParams,
  useUsers,
} from '@buildpad/hooks';
import type { Role, User, UserStatus } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item, Sort } from '@buildpad/ui-table';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListFooter } from './ListFooter';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import { getUserDisplayName } from './userDisplay';

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'invited', label: 'Invited' },
  { value: 'draft', label: 'Draft' },
  { value: 'terminated', label: 'Terminated' },
];

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const USER_HEADERS: HeaderRaw[] = [
  { text: 'User', value: 'first_name', sortable: true, width: 260 },
  { text: 'Email', value: 'email', sortable: true },
  { text: 'Role', value: 'roles', sortable: false },
  { text: 'Status', value: 'status', sortable: true },
  { text: 'Last Access', value: 'last_access', sortable: true },
];

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
   * reload-safe. Writes use `history.replaceState` and ride the existing
   * 300 ms search debounce. Set `false` for embedded surfaces that must not
   * touch the page URL. Default: true.
   */
  urlParams?: boolean;
  /**
   * Prefix for every URL parameter this list manages (e.g. `'users-'` →
   * `?users-search=…`). Use when two url-synced lists share one page.
   * Default: '' (unprefixed).
   */
  urlParamPrefix?: string;
}

interface BulkRolesModalProps {
  opened: boolean;
  onClose: () => void;
  roles: Role[];
  count: number;
  busy: boolean;
  onApply: (addRoles: string[], removeRoles: string[]) => void;
}

/** Staged add/remove role picks applied in a single `bulkUpdateUsers` call. */
const BulkRolesModal: React.FC<BulkRolesModalProps> = ({
  opened,
  onClose,
  roles,
  count,
  busy,
  onApply,
}) => {
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
      title="Update roles"
      data-testid="users-manager-bulk-roles-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Add and/or remove roles for {count} selected {count === 1 ? 'user' : 'users'}. Users can
          hold multiple roles.
        </Text>
        <MultiSelect
          label="Add roles"
          placeholder="Select roles to add"
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
          label="Remove roles"
          placeholder="Select roles to remove"
          data={roles.map((role) => ({ value: role.id, label: role.name }))}
          value={removeRoles}
          onChange={setRemoveRoles}
          searchable
          clearable
          data-testid="users-manager-bulk-roles-remove"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onApply(addRoles, removeRoles)}
            loading={busy}
            disabled={addRoles.length === 0 && removeRoles.length === 0}
            data-testid="users-manager-bulk-roles-apply"
          >
            Apply
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
  return STATUS_OPTIONS.some((option) => option.value === raw) ? (raw as UserStatus) : null;
}

/** Parse the DaaS-style sort string (`-last_access` = descending). */
function parseSortParam(raw: string | null): Sort | null {
  if (!raw) return null;
  const desc = raw.startsWith('-');
  const by = desc ? raw.slice(1) : raw;
  return by ? { by, desc } : null;
}

export const UsersManager: React.FC<UsersManagerProps> = ({
  onUserClick,
  onCreateUser,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  usersCollection = 'daas_users',
  urlParams = true,
  urlParamPrefix = '',
}) => {
  const { fetchUsers, updateUser, deleteUser, bulkUpdateUsers } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'delete');
  const selectable = updateAllowed || deleteAllowed;

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
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setUsers([]);
      setLoadError(message);
      notifications.show({ title: 'Failed to load users', message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, page, limit, debouncedSearch, selectedRole, selectedStatus, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 whenever a filter, the sort, or the page size CHANGES —
  // not on mount, or a ?page=3 restored from the URL would be clobbered.
  const filtersMountedRef = React.useRef(false);
  useEffect(() => {
    if (!filtersMountedRef.current) {
      filtersMountedRef.current = true;
      return;
    }
    setPage(1);
  }, [debouncedSearch, selectedRole, selectedStatus, sort, limit]);

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
        title: 'Failed to delete user',
        message: err instanceof Error ? err.message : 'Failed to delete user',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteUser, deleteModal.id, load]);

  const bulkApplyRoles = useCallback(
    async (addRoles: string[], removeRoles: string[]) => {
      setBulkBusy(true);
      try {
        await bulkUpdateUsers(selection, {
          addRoles: addRoles.length > 0 ? addRoles : undefined,
          removeRoles: removeRoles.length > 0 ? removeRoles : undefined,
        });
        notifications.show({
          title: 'Roles updated',
          message: `Roles updated for ${selection.length} ${selection.length === 1 ? 'user' : 'users'}`,
          color: 'green',
        });
        setBulkRolesOpen(false);
        clearSelection();
        await load();
      } catch (err) {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to update roles',
          color: 'red',
        });
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkUpdateUsers, selection, clearSelection, load]
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
          title: failed > 0 ? 'Completed with errors' : 'Status updated',
          message:
            failed > 0
              ? `Status updated for ${succeeded} of ${results.length} users (${failed} failed)`
              : `Status set to "${status}" for ${succeeded} ${succeeded === 1 ? 'user' : 'users'}`,
          color: failed > 0 ? 'orange' : 'green',
        });
        clearSelection();
        await load();
      } finally {
        setBulkBusy(false);
      }
    },
    [selection, updateUser, clearSelection, load]
  );

  const bulkDelete = useCallback(async () => {
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selection.map((id) => deleteUser(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      notifications.show({
        title: failed > 0 ? 'Completed with errors' : 'Users deleted',
        message:
          failed > 0
            ? `Deleted ${succeeded} of ${results.length} users (${failed} failed)`
            : `Deleted ${succeeded} ${succeeded === 1 ? 'user' : 'users'}`,
        color: failed > 0 ? 'orange' : 'green',
      });
      setBulkDeleteOpen(false);
      clearSelection();
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [selection, deleteUser, clearSelection, load]);

  const addButton =
    createAllowed && onCreateUser ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateUser} data-testid="users-manager-add-btn">
        Add User
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
          return <UserStatusBadge status={user.status} />;
        case 'last_access':
          return (
            <Text size="xs" c="dimmed">
              {user.last_access ? new Date(user.last_access).toLocaleDateString() : 'Never'}
            </Text>
          );
        default:
          return null;
      }
    },
    []
  );

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const user = item as unknown as User;
          return (
            <RowActionsMenu
              onEdit={updateAllowed ? () => onUserClick?.(user) : undefined}
              onDelete={deleteAllowed ? () => requestDelete(user.id) : undefined}
            />
          );
        }
      : undefined;

  return (
    <Stack gap="md" className="bp-users-manager" data-testid="users-manager">
      {!hideHeader && (
        <Box>
          <Title order={2} mb={4}>
            Users
          </Title>
          <Text size="sm" c="dimmed">
            Manage user accounts, roles, and access permissions
          </Text>
        </Box>
      )}

      {selectionCount > 0 && (
        <Paper p="sm" radius="md" withBorder data-testid="users-manager-bulk-toolbar">
          <Group>
            <Text size="sm" fw={500}>
              {selectionCount} selected
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={clearSelection}
              data-testid="users-manager-bulk-clear"
            >
              Clear
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
                    Update roles…
                  </Button>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Button variant="light" size="xs" data-testid="users-manager-bulk-status">
                        Set status
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {STATUS_OPTIONS.map((option) => (
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
                  Delete
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

      <div className="bp-manager-card">
        <Group className="bp-manager-toolbar" wrap="wrap">
          <SearchInput
            placeholder="Search users..."
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="users-manager-search"
          />
          <Select
            placeholder="Role"
            data={roles.map((role) => ({ value: role.id, label: role.name }))}
            value={selectedRole}
            onChange={setSelectedRole}
            clearable
            size="sm"
            style={{ minWidth: 160 }}
            data-testid="users-manager-role-filter"
          />
          <Select
            placeholder="Status"
            data={STATUS_OPTIONS}
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
                {totalCount} {totalCount === 1 ? 'user' : 'users'}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        <VTable
          headers={USER_HEADERS}
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
              ? `Failed to load users — ${loadError}`
              : hasFilters
                ? 'No users found — try adjusting your filters'
                : 'No users found — get started by adding your first user'
          }
          clickable={updateAllowed}
          renderCell={renderCell}
          renderRowAppend={renderRowAppend}
          renderFooter={() => (
            <ListFooter
              shown={users.length}
              totalCount={totalCount}
              itemsLabel="users"
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={limit}
              sizeOptions={sizeOptions}
              onLimitChange={setLimit}
              data-testid="users-manager-page-size"
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
        title="Delete user"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />

      <DeleteConfirmModal
        opened={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
        loading={bulkBusy}
        title="Delete users"
        description={`Are you sure you want to delete ${selectionCount} ${selectionCount === 1 ? 'user' : 'users'}? This action cannot be undone.`}
      />

      <BulkRolesModal
        opened={bulkRolesOpen}
        onClose={() => setBulkRolesOpen(false)}
        roles={roles}
        count={selectionCount}
        busy={bulkBusy}
        onApply={(addRoles, removeRoles) => void bulkApplyRoles(addRoles, removeRoles)}
      />
    </Stack>
  );
};

export default UsersManager;

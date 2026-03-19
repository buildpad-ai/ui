import React, { forwardRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Highlight,
  LoadingOverlay,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBlockquote,
  IconCheck,
  IconDatabaseOff,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { apiRequest } from '@buildpad/services';
import type { Permission, PermissionAction, Collection } from '@buildpad/types';
import './SystemPermissions.css';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'share'];

const PERMISSION_LABELS: Record<PermissionAction, string> = {
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
  share: 'S',
};

const DISABLED_ACTIONS: Record<string, PermissionAction[]> = {
  daas_extensions: ['create', 'delete'],
};

const APP_ACCESS_MINIMAL_PERMISSIONS: Partial<Permission>[] = [
  { collection: 'daas_activity', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_collections', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_fields', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_relations', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_roles', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_policies', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_users', action: 'read', fields: ['*'], permissions: {} },
  { collection: 'daas_settings', action: 'read', fields: ['*'], permissions: {} },
];

function isSystemCollection(collection: string): boolean {
  return collection.startsWith('daas_');
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PermissionAlterations {
  create: Partial<Permission>[];
  update: Partial<Permission>[];
  delete: (string | number)[];
}

export interface PermissionGroup {
  collection: CollectionInfo;
  permissions: DisplayPermission[];
}

interface CollectionInfo {
  collection: string;
  name: string;
  system?: boolean;
}

interface DisplayPermission extends Partial<Permission> {
  $type?: 'created' | 'updated' | 'deleted';
  $index?: number;
}

type PermissionLevel = 'all' | 'custom' | 'none';

export interface SystemPermissionsProps {
  primaryKey?: string | null;
  disabled?: boolean;
  value?: PermissionAlterations | number[] | null;
  onChange?: (value: PermissionAlterations | null) => void;
  appAccess?: boolean;
  adminAccess?: boolean;
  collections?: Collection[];
  label?: string;
  description?: string;
  error?: string;
  'data-testid'?: string;
}

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

function getPermissionLevel(permission?: DisplayPermission | null): PermissionLevel {
  if (!permission) return 'none';
  const hasAllFields = permission.fields?.includes('*');
  const hasNoPermissions = !permission.permissions || Object.keys(permission.permissions).length === 0;
  const hasNoValidation = !permission.validation || Object.keys(permission.validation).length === 0;
  if (hasAllFields && hasNoPermissions && hasNoValidation) return 'all';
  return 'custom';
}

function cleanItem(item: DisplayPermission): Partial<Permission> {
  return Object.entries(item).reduce((acc, [key, value]) => {
    if (!key.startsWith('$')) (acc as Record<string, unknown>)[key] = value;
    return acc;
  }, {} as Partial<Permission>);
}

function normalizeAlterations(value: PermissionAlterations | number[] | null | undefined): PermissionAlterations {
  if (!value || Array.isArray(value)) {
    return { create: [], update: [], delete: [] };
  }
  return value;
}

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  all: 'green',
  custom: 'blue',
  none: 'gray',
};

/* ------------------------------------------------------------------ */
/*  PermissionsToggle — Badge with dropdown menu                       */
/* ------------------------------------------------------------------ */

interface PermissionsToggleProps {
  action: PermissionAction;
  permission?: DisplayPermission;
  appMinimal?: boolean;
  disabled?: boolean;
  onSetFullAccess: () => void;
  onSetNoAccess: () => void;
  onEdit: () => void;
  'data-testid'?: string;
}

function PermissionsToggle({
  action, permission, appMinimal, disabled,
  onSetFullAccess, onSetNoAccess, onEdit,
  'data-testid': testId,
}: PermissionsToggleProps) {
  const level = getPermissionLevel(permission);

  if (appMinimal) {
    return (
      <Badge
        color="cyan"
        variant="filled"
        size="sm"
        title="Required for app access"
        data-testid={testId}
        data-level="all"
        data-action={action}
      >
        {PERMISSION_LABELS[action]}
      </Badge>
    );
  }

  return (
    <Menu position="bottom" withArrow>
      <Menu.Target>
        <Badge
          color={PERMISSION_COLORS[level]}
          variant={level === 'none' ? 'outline' : 'filled'}
          size="sm"
          style={{ cursor: disabled ? 'default' : 'pointer' }}
          title={`${action} - ${level}`}
          data-testid={testId}
          data-level={level}
          data-action={action}
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          {PERMISSION_LABELS[action]}
        </Badge>
      </Menu.Target>
      {!disabled && (
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconCheck size={14} />}
            disabled={level === 'all'}
            onClick={onSetFullAccess}
            data-testid={testId ? `${testId}-full` : undefined}
          >
            All Access
          </Menu.Item>
          <Menu.Item
            leftSection={<IconBlockquote size={14} />}
            disabled={level === 'none'}
            onClick={onSetNoAccess}
            data-testid={testId ? `${testId}-none` : undefined}
          >
            No Access
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconSettings size={14} />}
            onClick={onEdit}
            data-testid={testId ? `${testId}-custom` : undefined}
          >
            Use Custom
          </Menu.Item>
        </Menu.Dropdown>
      )}
    </Menu>
  );
}

/* ------------------------------------------------------------------ */
/*  PermissionsRow — Mantine Table.Tr                                  */
/* ------------------------------------------------------------------ */

interface PermissionsRowProps {
  collection: CollectionInfo;
  permissions: DisplayPermission[];
  disabledActions?: PermissionAction[];
  appMinimalKeys?: Set<string>;
  disabled?: boolean;
  onEditItem: (action: PermissionAction) => void;
  onRemoveRow: () => void;
  onSetFullAccessAll: () => void;
  onSetNoAccessAll: () => void;
  onSetFullAccess: (action: PermissionAction) => void;
  onSetNoAccess: (action: PermissionAction) => void;
  'data-testid'?: string;
}

function PermissionsRow({
  collection, permissions, disabledActions = [], appMinimalKeys, disabled,
  onEditItem, onRemoveRow, onSetFullAccessAll, onSetNoAccessAll,
  onSetFullAccess, onSetNoAccess,
  'data-testid': testId,
}: PermissionsRowProps) {
  return (
    <Table.Tr data-testid={testId ? `${testId}-row-${collection.collection}` : undefined}>
      <Table.Td>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Tooltip label={collection.name || collection.collection}>
            <Text
              size="sm"
              ff="monospace"
              style={{
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {collection.collection}
            </Text>
          </Tooltip>
          {!disabled && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span
                onClick={onSetFullAccessAll}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                role="button"
                tabIndex={0}
                data-testid={testId ? `${testId}-all-${collection.collection}` : undefined}
              >
                all
              </span>
              {' / '}
              <span
                onClick={onSetNoAccessAll}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                role="button"
                tabIndex={0}
                data-testid={testId ? `${testId}-none-${collection.collection}` : undefined}
              >
                none
              </span>
            </Text>
          )}
        </Group>
      </Table.Td>

      {PERMISSION_ACTIONS.map((action) => (
        <Table.Td key={action} style={{ textAlign: 'center' }}>
          {disabledActions.includes(action) ? (
            <Text c="dimmed" size="xs" data-testid={testId ? `${testId}-disabled-${collection.collection}-${action}` : undefined}>
              —
            </Text>
          ) : (
            <PermissionsToggle
              action={action}
              permission={permissions.find((p) => p.action === action)}
              appMinimal={appMinimalKeys?.has(`${collection.collection}:${action}`)}
              disabled={disabled}
              onSetFullAccess={() => onSetFullAccess(action)}
              onSetNoAccess={() => onSetNoAccess(action)}
              onEdit={() => onEditItem(action)}
              data-testid={testId ? `${testId}-toggle-${collection.collection}-${action}` : undefined}
            />
          )}
        </Table.Td>
      ))}

      <Table.Td>
        {!disabled && (
          <Tooltip label="Remove collection">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={onRemoveRow}
              data-testid={testId ? `${testId}-remove-${collection.collection}` : undefined}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component: SystemPermissions                                  */
/* ------------------------------------------------------------------ */

export const SystemPermissions = forwardRef<HTMLDivElement, SystemPermissionsProps>(({
  primaryKey,
  disabled = false,
  value,
  onChange,
  appAccess = false,
  adminAccess = false,
  collections: externalCollections,
  label,
  description,
  error,
  'data-testid': testId,
}, ref) => {
  const [fetchedPermissions, setFetchedPermissions] = useState<Permission[]>([]);
  const [fetchedCollections, setFetchedCollections] = useState<CollectionInfo[]>([]);
  const [localCollections, setLocalCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'minimum' | 'recommended'>('minimum');

  // Add Collection modal state
  const [addCollectionOpened, setAddCollectionOpened] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');

  const alterations = useMemo(() => normalizeAlterations(value), [value]);

  // App minimal permissions as a Set for fast lookup
  const appMinimalKeys = useMemo(() => {
    if (!appAccess) return undefined;
    return new Set(
      APP_ACCESS_MINIMAL_PERMISSIONS.map((p) => `${p.collection}:${p.action}`),
    );
  }, [appAccess]);

  // --- Fetch permissions from API ---
  useEffect(() => {
    if (!primaryKey || primaryKey === '+') {
      setFetchedPermissions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{ data: Permission[] }>(`/api/permissions?filter[_and][0][policy][_eq]=${encodeURIComponent(primaryKey)}&fields=*&limit=-1`);
        if (!cancelled) setFetchedPermissions(res.data ?? []);
      } catch {
        if (!cancelled) setFetchedPermissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [primaryKey]);

  // --- Fetch available collections ---
  useEffect(() => {
    if (externalCollections && externalCollections.length > 0) {
      setFetchedCollections(
        externalCollections.map((c) => ({
          collection: c.collection,
          name: c.meta?.collection ?? c.collection,
          system: isSystemCollection(c.collection),
        })),
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest<{ data: Collection[] }>('/api/collections');
        if (!cancelled) {
          setFetchedCollections(
            (res.data ?? []).map((c) => ({
              collection: c.collection,
              name: c.meta?.collection ?? c.collection,
              system: isSystemCollection(c.collection),
            })),
          );
        }
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [externalCollections]);

  const allCollections = useMemo(() => {
    if (externalCollections && externalCollections.length > 0) {
      return externalCollections.map((c) => ({
        collection: c.collection,
        name: c.meta?.collection ?? c.collection,
        system: isSystemCollection(c.collection),
      }));
    }
    return fetchedCollections;
  }, [externalCollections, fetchedCollections]);

  // --- Compute display items ---
  const displayItems = useMemo<DisplayPermission[]>(() => {
    const items: DisplayPermission[] = fetchedPermissions.map((item) => {
      let updated: DisplayPermission = { ...item };

      const updateIdx = alterations.update.findIndex((u) => u.id === item.id);
      if (updateIdx !== -1) {
        updated = { ...updated, ...alterations.update[updateIdx], $type: 'updated', $index: updateIdx };
      }

      const deleteIdx = alterations.delete.findIndex((id) => id === item.id);
      if (deleteIdx !== -1) {
        updated = { ...updated, $type: 'deleted', $index: deleteIdx };
      }

      return updated;
    });

    alterations.create.forEach((item, index) => {
      items.push({ ...item, $type: 'created', $index: index });
    });

    return items.filter((item) => item.$type !== 'deleted');
  }, [fetchedPermissions, alterations]);

  // --- Group permissions by collection ---
  const permissionGroups = useMemo<PermissionGroup[]>(() => {
    const groupMap = new Map<string, DisplayPermission[]>();

    for (const item of displayItems) {
      if (!item.collection) continue;
      const existing = groupMap.get(item.collection) ?? [];
      existing.push(item);
      groupMap.set(item.collection, existing);
    }

    for (const coll of localCollections) {
      if (!groupMap.has(coll)) {
        groupMap.set(coll, []);
      }
    }

    const groups: PermissionGroup[] = [];
    for (const [coll, perms] of groupMap) {
      const info = allCollections.find((c) => c.collection === coll);
      groups.push({
        collection: info ?? { collection: coll, name: coll, system: isSystemCollection(coll) },
        permissions: perms,
      });
    }

    return groups.sort((a, b) => a.collection.collection.localeCompare(b.collection.collection));
  }, [displayItems, localCollections, allCollections]);

  const regularPermissions = useMemo(
    () => permissionGroups.filter((g) => !isSystemCollection(g.collection.collection)),
    [permissionGroups],
  );

  const systemPermissions = useMemo(
    () => permissionGroups.filter((g) => isSystemCollection(g.collection.collection)),
    [permissionGroups],
  );

  const excludedCollections = useMemo(
    () => new Set(permissionGroups.map((g) => g.collection.collection)),
    [permissionGroups],
  );

  // --- Available collections for the Add Collection modal ---
  const availableCollections = useMemo(() => {
    const notConfigured = allCollections.filter((c) => !excludedCollections.has(c.collection));
    const query = collectionSearch.toLowerCase().trim();
    const filtered = query
      ? notConfigured.filter((c) => c.collection.toLowerCase().includes(query))
      : notConfigured;

    const userCols = filtered.filter((c) => !c.system).sort((a, b) => a.collection.localeCompare(b.collection));
    const systemCols = filtered.filter((c) => c.system).sort((a, b) => a.collection.localeCompare(b.collection));
    return { userCollections: userCols, systemCollections: systemCols, total: filtered.length };
  }, [allCollections, excludedCollections, collectionSearch]);

  // --- Emit changes ---
  const emitAlterations = useCallback((newAlts: PermissionAlterations) => {
    if (newAlts.create.length === 0 && newAlts.update.length === 0 && newAlts.delete.length === 0) {
      onChange?.(null);
    } else {
      onChange?.(newAlts);
    }
  }, [onChange]);

  // --- CRUD operations ---
  const createPermission = useCallback((...items: Partial<Permission>[]) => {
    const next = { ...alterations, create: [...alterations.create] };
    for (const item of items) {
      next.create.push(cleanItem(item as DisplayPermission));
    }
    emitAlterations(next);
  }, [alterations, emitAlterations]);

  const updatePermission = useCallback((item: DisplayPermission) => {
    const next = { ...alterations, create: [...alterations.create], update: [...alterations.update] };
    const cleaned = cleanItem(item);

    if (item.$type === 'created' && item.$index !== undefined) {
      next.create[item.$index] = cleaned;
    } else if (item.$type === 'updated' && item.$index !== undefined) {
      next.update[item.$index] = cleaned;
    } else {
      next.update.push(cleaned);
    }
    emitAlterations(next);
  }, [alterations, emitAlterations]);

  const removePermission = useCallback((item: DisplayPermission) => {
    const next = {
      create: [...alterations.create],
      update: [...alterations.update],
      delete: [...alterations.delete],
    };

    if (item.$type === 'created' && item.$index !== undefined) {
      next.create.splice(item.$index, 1);
    } else if (item.$type === 'updated' && item.$index !== undefined) {
      next.update.splice(item.$index, 1);
      if (item.id) next.delete.push(item.id);
    } else {
      if (item.id) next.delete.push(item.id);
    }
    emitAlterations(next);
  }, [alterations, emitAlterations]);

  // --- Set access helpers ---
  const setFullAccess = useCallback((collection: string, action: PermissionAction) => {
    if (DISABLED_ACTIONS[collection]?.includes(action)) return;

    const existing = displayItems.find(
      (p) => p.collection === collection && p.action === action,
    );

    if (existing) {
      updatePermission({
        ...existing,
        fields: ['*'],
        permissions: null,
        validation: null,
        presets: null,
      });
    } else {
      createPermission({
        policy: primaryKey ?? undefined,
        collection,
        action,
        fields: ['*'],
        permissions: null,
        validation: null,
        presets: null,
      });
    }
  }, [displayItems, updatePermission, createPermission, primaryKey]);

  const setNoAccess = useCallback((collection: string, action: PermissionAction) => {
    if (DISABLED_ACTIONS[collection]?.includes(action)) return;
    const existing = displayItems.find(
      (p) => p.collection === collection && p.action === action,
    );
    if (existing) {
      removePermission(existing);
    }
  }, [displayItems, removePermission]);

  // Batched: build all changes in one pass to avoid stale closure issues
  const setFullAccessAll = useCallback((collection: string) => {
    const next = {
      create: [...alterations.create],
      update: [...alterations.update],
      delete: [...alterations.delete],
    };

    for (const action of PERMISSION_ACTIONS) {
      if (DISABLED_ACTIONS[collection]?.includes(action)) continue;

      const existing = displayItems.find(
        (p) => p.collection === collection && p.action === action,
      );

      if (existing) {
        const cleaned = cleanItem({
          ...existing,
          fields: ['*'],
          permissions: null,
          validation: null,
          presets: null,
        });
        if (existing.$type === 'created' && existing.$index !== undefined) {
          next.create[existing.$index] = cleaned;
        } else if (existing.$type === 'updated' && existing.$index !== undefined) {
          next.update[existing.$index] = cleaned;
        } else {
          next.update.push(cleaned);
        }
      } else {
        next.create.push({
          policy: primaryKey ?? undefined,
          collection,
          action,
          fields: ['*'],
          permissions: null,
          validation: null,
          presets: null,
        } as Partial<Permission>);
      }
    }

    emitAlterations(next);
  }, [alterations, displayItems, emitAlterations, primaryKey]);

  // Batched: remove all actions for a collection in one pass
  const setNoAccessAll = useCallback((collection: string) => {
    const actionsToRemove = new Set<PermissionAction>(
      PERMISSION_ACTIONS.filter((a) => !DISABLED_ACTIONS[collection]?.includes(a)),
    );

    const existingForCollection = displayItems.filter(
      (p) => p.collection === collection && p.action && actionsToRemove.has(p.action),
    );

    const createdIndicesToRemove = new Set<number>();
    const updatedIndicesToRemove = new Set<number>();
    const idsToDelete: (string | number)[] = [];

    for (const item of existingForCollection) {
      if (item.$type === 'created' && item.$index !== undefined) {
        createdIndicesToRemove.add(item.$index);
      } else if (item.$type === 'updated' && item.$index !== undefined) {
        updatedIndicesToRemove.add(item.$index);
        if (item.id) idsToDelete.push(item.id);
      } else {
        if (item.id) idsToDelete.push(item.id);
      }
    }

    const next: PermissionAlterations = {
      create: alterations.create.filter((_, i) => !createdIndicesToRemove.has(i)),
      update: alterations.update.filter((_, i) => !updatedIndicesToRemove.has(i)),
      delete: [...alterations.delete, ...idsToDelete],
    };

    emitAlterations(next);
  }, [alterations, displayItems, emitAlterations]);

  const removeCollection = useCallback((collection: string) => {
    setNoAccessAll(collection);
    setLocalCollections((prev) => prev.filter((c) => c !== collection));
  }, [setNoAccessAll]);

  const handleAddCollection = useCallback((collection: string) => {
    setFullAccess(collection, 'read');
    setAddCollectionOpened(false);
    setCollectionSearch('');
  }, [setFullAccess]);

  const editItem = useCallback((_collection: string, _action: PermissionAction) => {
    // Permission detail editing — will be implemented as PermissionDetailModal
  }, []);

  // --- Reset system permissions ---
  const resetSystemPermissions = useCallback((useRecommended: boolean) => {
    const systemItems = displayItems.filter((p) => p.collection && isSystemCollection(p.collection));
    for (const item of systemItems) {
      removePermission(item);
    }

    setLocalCollections((prev) => prev.filter((c) => !isSystemCollection(c)));

    if (appAccess && useRecommended) {
      const recommended = APP_ACCESS_MINIMAL_PERMISSIONS.map((perm) => ({
        ...perm,
        policy: primaryKey ?? undefined,
      }));
      createPermission(...recommended);
    }

    setResetDialogOpen(false);
  }, [displayItems, removePermission, createPermission, appAccess, primaryKey]);

  // --- Render ---
  if (adminAccess) {
    return (
      <div ref={ref} data-testid={testId}>
        {label && <Text fw={500} size="sm" mb={4}>{label}</Text>}
        <Paper p="md" withBorder>
          <Text c="dimmed" ta="center" data-testid={testId ? `${testId}-admin-notice` : undefined}>
            Admin Access is enabled. This policy has full access to all collections and actions.
          </Text>
        </Paper>
      </div>
    );
  }

  return (
    <div ref={ref} data-testid={testId}>
      <Group justify="space-between" mb="sm">
        {label ? <Title order={4}>{label}</Title> : <span />}
        {!disabled && (
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAddCollectionOpened(true)}
            data-testid={testId ? `${testId}-add-btn` : undefined}
          >
            Add Collection
          </Button>
        )}
      </Group>
      {description && <Text size="xs" c="dimmed" mb="sm">{description}</Text>}

      <Paper withBorder pos="relative">
        <LoadingOverlay visible={loading && permissionGroups.length === 0} />
        <ScrollArea type="auto">
          <Table striped highlightOnHover style={{ minWidth: '600px' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: '200px' }}>Collection</Table.Th>
                {PERMISSION_ACTIONS.map((action) => (
                  <Table.Th key={action} style={{ width: '60px', textAlign: 'center' }}>
                    <Text size="xs" tt="uppercase" fw={600}>
                      {action}
                    </Text>
                  </Table.Th>
                ))}
                <Table.Th style={{ width: '50px' }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {permissionGroups.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="xl" data-testid={testId ? `${testId}-empty` : undefined}>
                      No permissions configured. Click &quot;Add Collection&quot; to get started.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                <>
                  {regularPermissions.map((group) => (
                    <PermissionsRow
                      key={group.collection.collection}
                      collection={group.collection}
                      permissions={group.permissions}
                      appMinimalKeys={appMinimalKeys}
                      disabled={disabled}
                      onEditItem={(action) => editItem(group.collection.collection, action)}
                      onRemoveRow={() => removeCollection(group.collection.collection)}
                      onSetFullAccessAll={() => setFullAccessAll(group.collection.collection)}
                      onSetNoAccessAll={() => setNoAccessAll(group.collection.collection)}
                      onSetFullAccess={(action) => setFullAccess(group.collection.collection, action)}
                      onSetNoAccess={(action) => setNoAccess(group.collection.collection, action)}
                      data-testid={testId}
                    />
                  ))}

                  {regularPermissions.length > 0 && systemPermissions.length > 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={7} py={4}>
                        <Divider
                          label={
                            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                              System Collections
                            </Text>
                          }
                          labelPosition="center"
                        />
                      </Table.Td>
                    </Table.Tr>
                  )}

                  {systemPermissions.map((group) => (
                    <PermissionsRow
                      key={group.collection.collection}
                      collection={group.collection}
                      permissions={group.permissions}
                      disabledActions={DISABLED_ACTIONS[group.collection.collection]}
                      appMinimalKeys={appMinimalKeys}
                      disabled={disabled}
                      onEditItem={(action) => editItem(group.collection.collection, action)}
                      onRemoveRow={() => removeCollection(group.collection.collection)}
                      onSetFullAccessAll={() => setFullAccessAll(group.collection.collection)}
                      onSetNoAccessAll={() => setNoAccessAll(group.collection.collection)}
                      onSetFullAccess={(action) => setFullAccess(group.collection.collection, action)}
                      onSetNoAccess={(action) => setNoAccess(group.collection.collection, action)}
                      data-testid={testId}
                    />
                  ))}
                </>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {appAccess && (
        <Text size="xs" c="dimmed" mt="xs">
          <strong>App Access is enabled.</strong> Minimal permissions are automatically applied and cannot be removed.
          {' '}
          <span>
            Reset system permissions to:{' '}
            <span
              onClick={() => { setResetMode('minimum'); setResetDialogOpen(true); }}
              style={{ cursor: 'pointer', color: 'var(--mantine-primary-color-6)', textDecoration: 'underline' }}
              role="button"
              tabIndex={0}
              data-testid={testId ? `${testId}-reset-minimum` : undefined}
            >
              app access minimum
            </span>
            {' / '}
            <span
              onClick={() => { setResetMode('recommended'); setResetDialogOpen(true); }}
              style={{ cursor: 'pointer', color: 'var(--mantine-primary-color-6)', textDecoration: 'underline' }}
              role="button"
              tabIndex={0}
              data-testid={testId ? `${testId}-reset-recommended` : undefined}
            >
              recommended defaults
            </span>
          </span>
        </Text>
      )}

      {error && (
        <Text size="xs" c="red" mt={4}>{error}</Text>
      )}

      {/* Add Collection Modal */}
      <Modal
        opened={addCollectionOpened}
        onClose={() => { setAddCollectionOpened(false); setCollectionSearch(''); }}
        title="Add Collection"
        size="md"
        transitionProps={{ duration: 0 }}
        data-testid={testId ? `${testId}-add-modal` : undefined}
      >
        <Stack gap="sm">
          <TextInput
            placeholder="Search collections..."
            leftSection={<IconSearch size={14} />}
            value={collectionSearch}
            onChange={(e) => setCollectionSearch(e.currentTarget.value)}
            data-testid={testId ? `${testId}-add-search` : undefined}
            data-autofocus
          />
          <ScrollArea h={350} offsetScrollbars>
            <Stack gap="xs">
              {availableCollections.total === 0 ? (
                <Stack align="center" gap="xs" py="xl">
                  <IconDatabaseOff size={40} stroke={1.2} color="var(--mantine-color-dimmed)" />
                  <Text c="dimmed" size="sm" ta="center">
                    {collectionSearch
                      ? `No collections matching "${collectionSearch}"`
                      : 'All collections have been configured'}
                  </Text>
                </Stack>
              ) : (
                <>
                  {availableCollections.userCollections.map((col) => (
                    <Paper
                      key={col.collection}
                      p="sm"
                      withBorder
                      style={{ cursor: 'pointer', transition: 'background 150ms ease' }}
                      className="hover-highlight"
                      onClick={() => handleAddCollection(col.collection)}
                      data-testid={testId ? `${testId}-add-item-${col.collection}` : undefined}
                    >
                      <Highlight highlight={collectionSearch} size="sm" fw={500} ff="monospace">
                        {col.collection}
                      </Highlight>
                    </Paper>
                  ))}
                  {availableCollections.userCollections.length > 0 && availableCollections.systemCollections.length > 0 && (
                    <Divider
                      label={<Text size="xs" c="dimmed" fw={600} tt="uppercase">System Collections</Text>}
                      labelPosition="left"
                      my="xs"
                    />
                  )}
                  {availableCollections.systemCollections.length > 0 && availableCollections.userCollections.length === 0 && (
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>
                      System Collections
                    </Text>
                  )}
                  {availableCollections.systemCollections.map((col) => (
                    <Paper
                      key={col.collection}
                      p="sm"
                      withBorder
                      style={{ cursor: 'pointer', transition: 'background 150ms ease' }}
                      className="hover-highlight"
                      onClick={() => handleAddCollection(col.collection)}
                      data-testid={testId ? `${testId}-add-item-${col.collection}` : undefined}
                    >
                      <Group justify="space-between">
                        <Highlight highlight={collectionSearch} size="sm" fw={500} ff="monospace">
                          {col.collection}
                        </Highlight>
                        <Badge size="xs" variant="light" color="accent">System</Badge>
                      </Group>
                    </Paper>
                  ))}
                </>
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* Reset confirmation dialog */}
      <Modal
        opened={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        title="Reset System Permissions"
        centered
        size="sm"
        transitionProps={{ duration: 0 }}
        data-testid={testId ? `${testId}-reset-dialog` : undefined}
      >
        <Text size="sm" mb="md">
          Are you sure you want to reset all system collection permissions
          {resetMode === 'recommended' ? ' to recommended defaults' : ' to app access minimum'}?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => resetSystemPermissions(resetMode === 'recommended')}
            data-testid={testId ? `${testId}-reset-confirm` : undefined}
          >
            Reset
          </Button>
        </Group>
      </Modal>
    </div>
  );
});

SystemPermissions.displayName = 'SystemPermissions';
export default SystemPermissions;

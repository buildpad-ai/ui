'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconKey,
  IconPlus,
} from '@tabler/icons-react';
import { useModuleAccessKeys, usePermissions } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { ModuleAccessKey } from '@buildpad/types';
import {
  MODULE_ACCESS_KEY_PATTERN,
  RESERVED_MODULE_ACCESS_NAMESPACES,
} from '@buildpad/types';
import {
  defaultTranslations,
  interpolate,
  type DeepPartial,
  type UsersTranslations,
} from '@buildpad/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListEmptyState } from './ListEmptyState';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import './ManagerTable.css';

/**
 * ModuleAccessKeysManager — CRUD for the `daas_module_access_keys` registry.
 *
 * The registry is the catalogue of application capability flags; policies grant
 * them via `ModuleAccessPanel`. A row with `key === null` is a folder that only
 * groups its children.
 *
 * Port of the platform's `app/module-access-keys/page.tsx`.
 */

interface FormState {
  display_name: string;
  key: string;
  description: string;
  parent_id: string | null;
  sort: number;
  isFolder: boolean;
}

const EMPTY_FORM: FormState = {
  display_name: '',
  key: '',
  description: '',
  parent_id: null,
  sort: 0,
  isFolder: false,
};

/**
 * Validate a leaf key against the platform format and reserved namespaces.
 * Returns the localized message from `messages` (English when omitted), or
 * `null` when the key is valid.
 */
function validateKey(
  key: string,
  messages: UsersTranslations['moduleAccessKeys']['validation'] = defaultTranslations.users
    .moduleAccessKeys.validation,
): string | null {
  if (!key.trim()) return messages.keyRequired;
  if (!MODULE_ACCESS_KEY_PATTERN.test(key)) {
    return messages.keyFormat;
  }
  const reserved = RESERVED_MODULE_ACCESS_NAMESPACES.find((ns) => key.startsWith(ns));
  if (reserved) {
    return interpolate(messages.keyReserved, { namespace: reserved });
  }
  return null;
}

/** Depth-first flatten of a tree, carrying indent depth for rendering. */
function flattenTree(
  nodes: ModuleAccessKey[],
  depth = 0,
  collapsed: Set<string> = new Set(),
): Array<{ node: ModuleAccessKey; depth: number }> {
  const out: Array<{ node: ModuleAccessKey; depth: number }> = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length && !collapsed.has(node.id)) {
      out.push(...flattenTree(node.children, depth + 1, collapsed));
    }
  }
  return out;
}

export interface ModuleAccessKeysManagerProps {
  /** Hide the built-in heading + subtitle for embedded surfaces. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_module_access_keys'. */
  keysCollection?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

export const ModuleAccessKeysManager: React.FC<ModuleAccessKeysManagerProps> = ({
  hideHeader = false,
  keysCollection = 'daas_module_access_keys',
  translations,
}) => {
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [keysCollection],
  });
  const createAllowed = permsLoading || isAdmin || canPerform(keysCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(keysCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(keysCollection, 'delete');

  const { fetchKeys, createKey, updateKey, deleteKey } = useModuleAccessKeys();
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);

  const [items, setItems] = useState<ModuleAccessKey[]>([]);
  const [tree, setTree] = useState<ModuleAccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [keyError, setKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ModuleAccessKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { keys, tree: built } = await fetchKeys();
      setItems(keys);
      setTree(built);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [fetchKeys]);

  useEffect(() => {
    load();
  }, [load]);

  /** Folder options for the parent selector — leaves cannot have children. */
  const folderOptions = useMemo(
    () =>
      items
        .filter((i) => i.key === null && i.id !== editingId)
        .map((i) => ({ value: i.id, label: i.display_name })),
    [items, editingId],
  );

  /**
   * Search filters to matching rows only (flat), because hiding a parent would
   * hide its matching children. With no search, render the tree.
   */
  const rows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return flattenTree(tree, 0, collapsed);
    return items
      .filter(
        (i) =>
          i.display_name.toLowerCase().includes(term) ||
          (i.key ?? '').toLowerCase().includes(term) ||
          (i.description ?? '').toLowerCase().includes(term),
      )
      .map((node) => ({ node, depth: 0 }));
  }, [debouncedSearch, tree, items, collapsed]);

  const openCreate = (isFolder: boolean) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isFolder });
    setKeyError(null);
    setDrawerOpen(true);
  };

  const openEdit = (node: ModuleAccessKey) => {
    setEditingId(node.id);
    setForm({
      display_name: node.display_name,
      key: node.key ?? '',
      description: node.description ?? '',
      parent_id: node.parent_id,
      sort: node.sort ?? 0,
      isFolder: node.key === null,
    });
    setKeyError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      notifications.show({
        title: common.error,
        message: t.moduleAccessKeys.validation.displayNameRequired,
        color: 'red',
      });
      return;
    }

    if (!form.isFolder) {
      const err = validateKey(form.key.trim(), t.moduleAccessKeys.validation);
      if (err) {
        setKeyError(err);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        description: form.description.trim() || null,
        key: form.isFolder ? null : form.key.trim(),
        parent_id: form.parent_id,
        sort: form.sort,
      };

      if (editingId) {
        await updateKey(editingId, payload);
      } else {
        await createKey(payload);
      }

      notifications.show({
        title: t.moduleAccessKeys.notifications.savedTitle,
        message: editingId
          ? t.moduleAccessKeys.notifications.keyUpdated
          : t.moduleAccessKeys.notifications.keyCreated,
        color: 'green',
      });
      setDrawerOpen(false);
      await load();
    } catch (err) {
      // Surface the server error verbatim — a UNIQUE violation on `key` is the
      // common case and its message is the useful one.
      notifications.show({
        title: t.moduleAccessKeys.notifications.saveFailedTitle,
        message: err instanceof Error ? err.message : t.moduleAccessKeys.notifications.saveFailed,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteKey(deleteTarget.id);
      notifications.show({
        title: t.moduleAccessKeys.notifications.deletedTitle,
        message: t.moduleAccessKeys.notifications.keyRemoved,
        color: 'green',
      });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      notifications.show({
        title: t.moduleAccessKeys.notifications.deleteFailedTitle,
        message: err instanceof Error ? err.message : t.moduleAccessKeys.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteDescription = deleteTarget
    ? deleteTarget.key === null
      ? interpolate(t.moduleAccessKeys.deleteModal.folderDescription, {
          name: deleteTarget.display_name,
        })
      : interpolate(t.moduleAccessKeys.deleteModal.keyDescription, { key: deleteTarget.key })
    : undefined;

  const drawerTitle = editingId
    ? form.isFolder
      ? t.moduleAccessKeys.drawer.editFolder
      : t.moduleAccessKeys.drawer.editKey
    : form.isFolder
      ? t.moduleAccessKeys.drawer.newFolder
      : t.moduleAccessKeys.drawer.newKey;

  return (
    <Stack gap="md" data-testid="module-access-keys-manager">
      {!hideHeader && (
        <Box>
          <Title order={2}>{t.moduleAccessKeys.title}</Title>
          <Text c="dimmed" size="sm">
            {t.moduleAccessKeys.subtitle}
          </Text>
        </Box>
      )}

      <Group justify="space-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t.moduleAccessKeys.searchPlaceholder}
          translations={translations}
        />
        {createAllowed && (
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconFolder size={16} />}
              onClick={() => openCreate(true)}
              data-testid="module-access-add-folder"
            >
              {t.moduleAccessKeys.addFolder}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => openCreate(false)}
              data-testid="module-access-add-key"
            >
              {t.moduleAccessKeys.addKey}
            </Button>
          </Group>
        )}
      </Group>

      {loadFailed && (
        <Alert color="red" variant="light">
          {t.moduleAccessKeys.loadError}
        </Alert>
      )}

      {!loading && items.length === 0 && !loadFailed && (
        <ListEmptyState
          title={t.moduleAccessKeys.emptyState.title}
          hint={t.moduleAccessKeys.emptyState.hint}
          data-testid="module-access-empty"
        />
      )}

      <Stack gap={0}>
        {rows.map(({ node, depth }) => {
          const isFolder = node.key === null;
          const hasChildren = Boolean(node.children?.length);
          return (
            <Group
              key={node.id}
              justify="space-between"
              py={8}
              pl={depth * 20}
              style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
              data-testid={`module-access-row-${node.id}`}
            >
              <Group gap="xs">
                {isFolder && hasChildren ? (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => toggleCollapse(node.id)}
                    aria-label={
                      collapsed.has(node.id) ? t.moduleAccessKeys.expand : t.moduleAccessKeys.collapse
                    }
                  >
                    {collapsed.has(node.id) ? (
                      <IconChevronRight size={12} />
                    ) : (
                      <IconChevronDown size={12} />
                    )}
                  </ActionIcon>
                ) : (
                  <Box w={18} />
                )}
                {isFolder ? (
                  <IconFolder size={14} style={{ color: 'var(--mantine-color-yellow-6)' }} />
                ) : (
                  <IconKey size={14} style={{ color: 'var(--mantine-color-blue-6)' }} />
                )}
                <Stack gap={0}>
                  <Text size="sm" fw={isFolder ? 600 : 400}>
                    {node.display_name}
                  </Text>
                  {node.description && (
                    <Text size="xs" c="dimmed">
                      {node.description}
                    </Text>
                  )}
                </Stack>
              </Group>

              <Group gap="xs">
                {node.key && (
                  <Badge
                    variant="outline"
                    size="xs"
                    color="blue"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {node.key}
                  </Badge>
                )}
                <RowActionsMenu
                  onEdit={updateAllowed ? () => openEdit(node) : undefined}
                  onDelete={deleteAllowed ? () => setDeleteTarget(node) : undefined}
                  translations={translations}
                />
              </Group>
            </Group>
          );
        })}
      </Stack>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        title={drawerTitle}
      >
        <Stack gap="md">
          <TextInput
            label={t.moduleAccessKeys.form.displayName}
            required
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.currentTarget.value }))}
            data-testid="module-access-form-display-name"
          />

          {!form.isFolder && (
            <TextInput
              label={t.moduleAccessKeys.form.key}
              required
              description={t.moduleAccessKeys.form.keyDescription}
              placeholder={t.moduleAccessKeys.form.keyPlaceholder}
              value={form.key}
              error={keyError}
              onChange={(e) => {
                setForm((f) => ({ ...f, key: e.currentTarget.value }));
                setKeyError(null);
              }}
              data-testid="module-access-form-key"
            />
          )}

          <Textarea
            label={t.fields.description}
            autosize
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
          />

          <Select
            label={t.moduleAccessKeys.form.parentFolder}
            placeholder={t.moduleAccessKeys.form.parentFolderPlaceholder}
            clearable
            data={folderOptions}
            value={form.parent_id}
            onChange={(v) => setForm((f) => ({ ...f, parent_id: v }))}
          />

          <NumberInput
            label={t.moduleAccessKeys.form.sort}
            value={form.sort}
            onChange={(v) => setForm((f) => ({ ...f, sort: typeof v === 'number' ? v : 0 }))}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDrawerOpen(false)}>
              {common.cancel}
            </Button>
            <Button onClick={handleSave} loading={saving} data-testid="module-access-form-save">
              {common.save}
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <DeleteConfirmModal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t.moduleAccessKeys.deleteModal.title}
        description={deleteDescription}
        loading={deleting}
        translations={translations}
      />
    </Stack>
  );
};

export default ModuleAccessKeysManager;

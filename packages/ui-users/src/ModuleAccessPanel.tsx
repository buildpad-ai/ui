'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Divider,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconKey,
} from '@tabler/icons-react';
import { useModuleAccessKeys } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { ModuleAccessKey, ModuleAccessMap } from '@buildpad/types';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';
import { splitTaggedText } from './accessUtils';

/**
 * ModuleAccessPanel — the "Module-Level Access" half of the Policy editor.
 *
 * Renders the `daas_module_access_keys` registry as a collapsible tree and
 * toggles which keys this policy grants. Keys can only be *selected* here, not
 * invented: creating them belongs to `ModuleAccessKeysManager` at
 * `/module-access-keys`. That is what makes typos impossible through the UI —
 * DaaS does not validate `module_access` entries against the registry.
 *
 * Port of the platform's `components/ModuleLevelAccessEditor.tsx`.
 */

// ─── Group section ────────────────────────────────────────────────────────────

interface GroupSectionProps {
  node: ModuleAccessKey;
  grants: ModuleAccessMap;
  onChange: (key: string, value: boolean) => void;
}

function GroupSection({ node, grants, onChange }: GroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const leafChildren = (node.children ?? []).filter((c) => c.key !== null);
  const folderChildren = (node.children ?? []).filter((c) => c.key === null);

  return (
    <Box>
      <Group
        gap="xs"
        style={{ cursor: 'pointer', userSelect: 'none', paddingBottom: 4 }}
        onClick={() => setExpanded((v) => !v)}
        data-testid={`module-access-folder-${node.id}`}
      >
        <ActionIcon size="xs" variant="subtle" color="gray">
          {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </ActionIcon>
        <IconFolder size={14} style={{ color: 'var(--mantine-color-yellow-6)' }} />
        <Text size="sm" fw={600}>
          {node.display_name}
        </Text>
      </Group>

      {expanded && (
        <Box pl="md">
          {leafChildren.map((leaf) => (
            <LeafRow key={leaf.id} leaf={leaf} grants={grants} onChange={onChange} withBorder />
          ))}

          {folderChildren.map((child) => (
            <GroupSection key={child.id} node={child} grants={grants} onChange={onChange} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Leaf row ─────────────────────────────────────────────────────────────────

interface LeafRowProps {
  leaf: ModuleAccessKey;
  grants: ModuleAccessMap;
  onChange: (key: string, value: boolean) => void;
  withBorder?: boolean;
}

function LeafRow({ leaf, grants, onChange, withBorder }: LeafRowProps) {
  return (
    <Group
      justify="space-between"
      py={6}
      style={
        withBorder
          ? { borderBottom: '1px solid var(--mantine-color-default-border)' }
          : undefined
      }
    >
      <Group gap="xs">
        <IconKey size={13} style={{ color: 'var(--mantine-color-blue-6)' }} />
        <Stack gap={0}>
          <Text size="sm">{leaf.display_name}</Text>
          {leaf.description && (
            <Text size="xs" c="dimmed">
              {leaf.description}
            </Text>
          )}
        </Stack>
      </Group>
      <Group gap="xs">
        <Badge variant="outline" size="xs" color="blue" style={{ fontFamily: 'monospace' }}>
          {leaf.key}
        </Badge>
        <Switch
          checked={grants[leaf.key!] === true}
          onChange={(e) => onChange(leaf.key!, e.currentTarget.checked)}
          size="sm"
          data-testid={`module-access-toggle-${leaf.key}`}
        />
      </Group>
    </Group>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ModuleAccessPanelProps {
  /** Current `module_access` grants on the policy. */
  value: ModuleAccessMap;
  /** Fires with the full updated map on every toggle. */
  onChange: (updated: ModuleAccessMap) => void;
  /**
   * Whether the policy also grants admin access. Shows an explanatory notice;
   * toggles stay enabled so grants survive turning admin off again.
   */
  adminAccess?: boolean;
  /** Route of the registry management page, linked from the empty state. */
  keysHref?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

export const ModuleAccessPanel: React.FC<ModuleAccessPanelProps> = ({
  value,
  onChange,
  adminAccess,
  keysHref = '/module-access-keys',
  translations,
}) => {
  const { fetchKeys } = useModuleAccessKeys();
  const t = useBuildpadTranslations((d) => d.users, translations);
  const [tree, setTree] = useState<ModuleAccessKey[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { keys, tree: built } = await fetchKeys();
        if (cancelled) return;
        setTree(built);
        setCount(keys.length);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKeys]);

  /**
   * Toggling a key off DELETES it rather than writing `false`.
   *
   * The server drops `false` when OR-merging across policies, so a stored
   * `false` is inert — keeping it would just accrete dead entries in the JSONB.
   */
  const handleToggle = useCallback(
    (key: string, checked: boolean) => {
      const updated = { ...value };
      if (checked) {
        updated[key] = true;
      } else {
        delete updated[key];
      }
      onChange(updated);
    },
    [value, onChange],
  );

  if (loading) {
    return (
      <Box py="xl" ta="center" data-testid="module-access-loading">
        <Loader size="sm" />
      </Box>
    );
  }

  if (loadFailed) {
    return (
      <Alert color="red" variant="light" data-testid="module-access-error">
        {t.moduleAccessPanel.loadError}
      </Alert>
    );
  }

  if (count === 0) {
    return (
      <Box py="xl" ta="center" data-testid="module-access-empty">
        <Text size="sm" c="dimmed">
          {splitTaggedText(t.moduleAccessPanel.empty).map((segment, index) =>
            segment.tag === 'link' ? (
              <Anchor key={index} href={keysHref} size="sm">
                {segment.text}
              </Anchor>
            ) : (
              <React.Fragment key={index}>{segment.text}</React.Fragment>
            ),
          )}
        </Text>
      </Box>
    );
  }

  const rootLeaves = tree.filter((n) => n.key !== null);
  const rootFolders = tree.filter((n) => n.key === null);

  return (
    <Stack gap="md" data-testid="module-access-panel">
      {adminAccess && (
        <Text size="sm" c="dimmed" fs="italic">
          {t.moduleAccessPanel.adminNotice}
        </Text>
      )}

      {rootFolders.map((folder) => (
        <Box key={folder.id}>
          <GroupSection node={folder} grants={value} onChange={handleToggle} />
          <Divider mt="sm" />
        </Box>
      ))}

      {rootLeaves.map((leaf) => (
        <LeafRow key={leaf.id} leaf={leaf} grants={value} onChange={handleToggle} />
      ))}
    </Stack>
  );
};

export default ModuleAccessPanel;

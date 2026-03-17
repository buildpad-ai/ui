/**
 * CustomPermissionsEditor
 *
 * Policy detail panel for managing application-level boolean capability flags
 * stored in daas_policies.custom_permissions (JSONB).
 *
 * Renders a key/value list where:
 *   - Keys follow dot-notation: AppName.Domain.Capability
 *   - Values are boolean toggles (true = granted, false = explicitly denied)
 *
 * Reads the current policy via GET /api/policies/:id and persists changes
 * via PATCH /api/policies/:id — no DaaS code changes required.
 *
 * Usage:
 *   <CustomPermissionsEditor policyId={policy.id} onChange={handleChange} />
 *
 * Prerequisites:
 *   - daas_policies.custom_permissions JSONB column must exist (add via MCP).
 *   - See .github/skills/create-custom-permissions/SKILL.md for full guide.
 *
 * @buildpad/origin: components/CustomPermissionsEditor
 * @buildpad/version: 1.0.0
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Title,
  Table,
  Switch,
  ActionIcon,
  TextInput,
  Button,
  Group,
  Text,
  Alert,
  Skeleton,
  Tooltip,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconPlus, IconAlertCircle } from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomPermissionsEditorProps {
  /** Policy UUID whose custom_permissions will be read and written */
  policyId: string;
  /**
   * Called after every successful save with the updated permissions map.
   * Use this to invalidate parent state or show unsaved-changes indicators.
   */
  onChange?: (updated: Record<string, boolean>) => void;
  /** Base path for the policies API. Defaults to /api/policies */
  apiBase?: string;
}

// ─── Key validation ───────────────────────────────────────────────────────────

/** Validates AppName.Domain.Capability dot-notation */
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){1,}$/;

function validateKey(key: string, existing: string[]): string | null {
  if (!key.trim()) return 'Key is required';
  if (!KEY_PATTERN.test(key)) return 'Use dot-notation: AppName.Domain.Capability';
  if (existing.includes(key)) return 'Key already exists';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomPermissionsEditor({
  policyId,
  onChange,
  apiBase = '/api/policies',
}: CustomPermissionsEditorProps) {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // New-key input state
  const [newKey, setNewKey] = useState('');
  const [newKeyError, setNewKeyError] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${apiBase}/${policyId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const cp = body?.data?.custom_permissions;
      setPerms(cp && typeof cp === 'object' ? cp : {});
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [apiBase, policyId]);

  useEffect(() => { fetchPolicy(); }, [fetchPolicy]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async (updated: Record<string, boolean>) => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/${policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_permissions: updated }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setPerms(updated);
      onChange?.(updated);
      notifications.show({ title: 'Saved', message: 'Custom permissions updated', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggle = async (key: string, value: boolean) => {
    const updated = { ...perms, [key]: value };
    await save(updated);
  };

  const handleRemove = async (key: string) => {
    const { [key]: _, ...rest } = perms;
    await save(rest);
  };

  const handleAdd = async () => {
    const trimmed = newKey.trim();
    const error = validateKey(trimmed, Object.keys(perms));
    if (error) {
      setNewKeyError(error);
      return;
    }
    setNewKeyError(null);
    setNewKey('');
    await save({ ...perms, [trimmed]: true });
  };

  const handleKeyInputChange = (value: string) => {
    setNewKey(value);
    if (newKeyError) setNewKeyError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to load">
        {fetchError}
      </Alert>
    );
  }

  const keys = Object.keys(perms).sort();

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Title order={4}>Custom Permissions</Title>
          <Text size="xs" c="dimmed" mt={2}>
            Application capability flags. Users assigned to this policy (directly or via Role)
            will hold these flags.
          </Text>
        </div>
        {keys.length > 0 && (
          <Badge variant="light" color="blue">
            {keys.length} flag{keys.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </Group>

      {loading ? (
        <Stack gap="xs">
          {[1, 2, 3].map((i) => <Skeleton key={i} height={36} radius="sm" />)}
        </Stack>
      ) : keys.length === 0 ? (
        <Text size="sm" c="dimmed" fs="italic">
          No custom permissions defined. Add one below.
        </Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Permission Key</Table.Th>
              <Table.Th w={90}>Granted</Table.Th>
              <Table.Th w={60}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {keys.map((key) => (
              <Table.Tr key={key}>
                <Table.Td>
                  <Text size="sm" ff="monospace">{key}</Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={perms[key] === true}
                    onChange={(e) => handleToggle(key, e.currentTarget.checked)}
                    disabled={saving}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Remove key">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      disabled={saving}
                      onClick={() => handleRemove(key)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Add new key row */}
      <Group gap="xs" align="flex-start">
        <TextInput
          placeholder="MyApp.Domain.Capability"
          value={newKey}
          onChange={(e) => handleKeyInputChange(e.currentTarget.value)}
          error={newKeyError}
          size="sm"
          style={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          ff="monospace"
          disabled={saving}
        />
        <Button
          leftSection={<IconPlus size={14} />}
          size="sm"
          variant="light"
          onClick={handleAdd}
          loading={saving}
          disabled={!newKey.trim()}
        >
          Add
        </Button>
      </Group>

      <Text size="xs" c="dimmed">
        Keys must follow dot-notation: <Text span ff="monospace">AppName.Domain.Capability</Text>
      </Text>
    </Stack>
  );
}

export default CustomPermissionsEditor;

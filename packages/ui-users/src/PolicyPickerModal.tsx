'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { usePolicies } from '@buildpad/hooks';
import type { Policy } from '@buildpad/types';
import { SearchInput } from './SearchInput';

export interface PolicyPickerModalProps {
  opened: boolean;
  onClose: () => void;
  /** Policy IDs already attached — excluded from the pickable list. */
  excludeIds: string[];
  /** Called with the selected policy IDs when the admin confirms. */
  onAttach: (policyIds: string[]) => void | Promise<void>;
  title?: string;
}

/**
 * Searchable policy picker shared by `UserPoliciesManager` and
 * `RolePoliciesManager` — dedupes the two near-identical "Add Policies"
 * modals from the buildpad-daas reference into one component.
 */
export const PolicyPickerModal: React.FC<PolicyPickerModalProps> = ({
  opened,
  onClose,
  excludeIds,
  onAttach,
  title = 'Add Policies',
}) => {
  const { fetchPolicies } = usePolicies();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Stabilise the `excludeIds` dependency by CONTENT rather than array
  // identity, so a caller passing an inline array doesn't retrigger this
  // callback (and thus the fetch effect) on every render.
  const excludeKey = excludeIds.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const excludeSet = new Set(excludeKey ? excludeKey.split(',') : []);
      const { policies: fetched } = await fetchPolicies({
        search: debouncedSearch || undefined,
        limit: 100,
      });
      setPolicies(fetched.filter((p) => !excludeSet.has(p.id)));
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, fetchPolicies, excludeKey]);

  useEffect(() => {
    if (opened) void load();
  }, [opened, load]);

  const reset = useCallback(() => {
    setSearch('');
    setSelected(new Set());
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAttach = useCallback(async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAttach(Array.from(selected));
      reset();
    } finally {
      setSaving(false);
    }
  }, [selected, onAttach, reset]);

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="lg" data-testid="policy-picker-modal">
      <Stack gap="md">
        <SearchInput
          placeholder="Search policies..."
          value={search}
          onChange={setSearch}
          size="md"
          data-testid="policy-picker-search"
        />

        <Box mih={200} mah={400} style={{ overflowY: 'auto' }}>
          {loading ? (
            <Text c="dimmed" ta="center" py="xl">
              Loading policies…
            </Text>
          ) : policies.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {search ? 'No policies found matching your search' : 'All policies are already attached'}
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }} />
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Access</Table.Th>
                  <Table.Th>Description</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {policies.map((policy) => (
                  <Table.Tr
                    key={policy.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggle(policy.id)}
                    data-testid={`policy-picker-row-${policy.id}`}
                  >
                    <Table.Td>
                      <Checkbox
                        checked={selected.has(policy.id)}
                        onChange={() => toggle(policy.id)}
                        aria-label={`Select ${policy.name}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {policy.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {policy.admin_access && (
                          <Badge color="red" size="sm">
                            Admin
                          </Badge>
                        )}
                        {policy.app_access && (
                          <Badge color="blue" size="sm">
                            App
                          </Badge>
                        )}
                        {policy.delegate_access && (
                          <Badge color="green" size="sm">
                            Delegate
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {policy.description || '-'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAttach}
            disabled={selected.size === 0}
            loading={saving}
            data-testid="policy-picker-attach-btn"
          >
            Add{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PolicyPickerModal;

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
import { useBuildpadTranslations } from '@buildpad/services';
import type { Policy } from '@buildpad/types';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
import { SearchInput } from './SearchInput';

export interface PolicyPickerModalProps {
  opened: boolean;
  onClose: () => void;
  /** Policy IDs already attached — excluded from the pickable list. */
  excludeIds: string[];
  /** Called with the selected policy IDs when the admin confirms. */
  onAttach: (policyIds: string[]) => void | Promise<void>;
  /** Default: the dictionary's "Add Policies". */
  title?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
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
  title,
  translations,
}) => {
  const { fetchPolicies } = usePolicies();
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
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
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title ?? t.policyPicker.title}
      size="lg"
      data-testid="policy-picker-modal"
    >
      <Stack gap="md">
        <SearchInput
          placeholder={t.policyPicker.searchPlaceholder}
          value={search}
          onChange={setSearch}
          size="md"
          data-testid="policy-picker-search"
          translations={translations}
        />

        <Box mih={200} mah={400} style={{ overflowY: 'auto' }}>
          {loading ? (
            <Text c="dimmed" ta="center" py="xl">
              {t.policyPicker.loading}
            </Text>
          ) : policies.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {search ? t.policyPicker.emptySearch : t.policyPicker.emptyAllAttached}
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }} />
                  <Table.Th>{t.columns.name}</Table.Th>
                  <Table.Th>{t.columns.access}</Table.Th>
                  <Table.Th>{t.columns.description}</Table.Th>
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
                        aria-label={interpolate(t.policyPicker.selectAriaLabel, { name: policy.name })}
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
                            {t.policyAccess.admin}
                          </Badge>
                        )}
                        {policy.app_access && (
                          <Badge color="blue" size="sm">
                            {t.policyAccess.app}
                          </Badge>
                        )}
                        {policy.delegate_access && (
                          <Badge color="green" size="sm">
                            {t.policyAccess.delegate}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {policy.description || t.policyPicker.emptyDescription}
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
            {common.cancel}
          </Button>
          <Button
            onClick={handleAttach}
            disabled={selected.size === 0}
            loading={saving}
            data-testid="policy-picker-attach-btn"
          >
            {selected.size > 0
              ? interpolate(t.policyPicker.addWithCount, { count: selected.size })
              : t.policyPicker.add}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PolicyPickerModal;

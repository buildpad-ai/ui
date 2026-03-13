/**
 * ScopeSwitcher
 *
 * Drop-in scope selector for app headers / nav bars.
 * Fetches available scopes from GET /api/scope/available and writes
 * the selected URI into the `daas_resource_uri` cookie via useScope().
 *
 * - Shows nothing while loading or when the user has only one selectable scope
 *   and it is already active (auto-activated at mount).
 * - Shows a Mantine Select when the user has multiple scopes to choose from.
 * - Shows an alert when the user has no scope access at all.
 *
 * Usage:
 *   <ScopeSwitcher />
 *
 * @buildpad/origin: scope-routes/scope-switcher
 * @buildpad/version: 1.0.0
 */

'use client';

import { useEffect, useState } from 'react';
import { Select, Alert, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useScope } from '@/lib/scope/context';
import { useDaaSContext } from '@/lib/buildpad/services';

interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  selectable?: boolean;
  scope_type?: { name: string } | null;
}

export default function ScopeSwitcher() {
  const { resourceUri, setScope, isHydrating } = useScope();
  const { buildUrl, getHeaders } = useDaaSContext();
  const [options, setOptions] = useState<ScopeItem[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(buildUrl('/api/scope/available'), { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load scopes: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const selectable: ScopeItem[] = (data.data ?? []).filter(
          (s: ScopeItem) => s.selectable !== false,
        );
        setOptions(selectable);

        // Auto-select the only available scope
        if (selectable.length === 1 && !resourceUri) {
          setScope(selectable[0].uri_path);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load scopes');
      });
    // Only run on mount — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isHydrating || options === null) return <Loader size="xs" />;

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} p="xs">
        {error}
      </Alert>
    );
  }

  if (options.length === 0) {
    return (
      <Alert color="orange" icon={<IconAlertCircle size={16} />} p="xs">
        No scope assigned — contact your administrator.
      </Alert>
    );
  }

  // Single scope that is already active — nothing to switch, hide the selector
  if (options.length === 1) return null;

  const selectData = options.map((s) => ({
    value: s.uri_path,
    label: s.scope_type ? `${s.scope_type.name}: ${s.name}` : s.name,
  }));

  return (
    <Select
      data={selectData}
      value={resourceUri}
      onChange={(uri) => setScope(uri)}
      placeholder="Select scope…"
      size="sm"
      w={220}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

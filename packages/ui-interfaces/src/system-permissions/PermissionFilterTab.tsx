import React from 'react';
import { LoadingOverlay, Stack, Text } from '@mantine/core';
import type { Field, Filter, Permission } from '@buildpad/types';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';
import type { RelationInfo } from './PermissionFilterTypes';
import { FilterRuleBuilder } from './FilterRuleBuilder';

export interface PermissionFilterTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Fields of the permission's collection (fetched or injected by the modal). */
  fields: Field[];
  /** Relations of the permission's collection (fetched or injected by the modal). */
  relations?: RelationInfo[];
  loading?: boolean;
  /** Item-filter rules locked in by app-access minimal permissions. */
  appMinimal?: Filter | null;
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.systemPermissions`) */
  translations?: DeepPartial<InterfacesTranslations['systemPermissions']>;
}

/**
 * "Item Permissions" tab — Directus-filter rules limiting which items the
 * action applies to, edited in the visual rule builder (with a JSON mode).
 */
export function PermissionFilterTab({
  permission,
  policyName,
  fields,
  relations,
  loading = false,
  appMinimal,
  onChange,
  'data-testid': testId,
  translations,
}: PermissionFilterTabProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.systemPermissions, translations);

  if (loading) {
    return (
      <Stack gap="md" pos="relative" mih={200} data-testid={testId}>
        <LoadingOverlay visible />
        <Text size="sm" c="dimmed">{t.filterEditor.loadingFields}</Text>
      </Stack>
    );
  }

  return (
    <FilterRuleBuilder
      permission={permission}
      policyName={policyName}
      collection={permission.collection ?? ''}
      fields={fields}
      relations={relations}
      appMinimal={appMinimal}
      onChange={onChange}
      data-testid={testId}
      translations={translations}
    />
  );
}

export default PermissionFilterTab;

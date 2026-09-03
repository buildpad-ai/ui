'use client';

import React, { useCallback } from 'react';
import { useRoles } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { Policy } from '@buildpad/types';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';
import { PolicyAttachmentManager } from './PolicyAttachmentManager';

export interface RolePoliciesManagerProps {
  /** ID of the role whose attached policies are managed. */
  roleId: string;
  /** Called after any successful attach/detach so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a policy row's "open" action is clicked. Hidden when omitted. */
  onPolicyClick?: (policy: Policy) => void;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Manages the policies attached to a role (`daas_access` rows with `role`
 * set) via `GET/POST /api/roles/[id]/policies` and
 * `DELETE /api/roles/[id]/policies/[policyId]`. Ported from the buildpad-daas
 * `RolePoliciesManager`, with the shared list/attach/detach UI delegated to
 * `PolicyAttachmentManager`.
 */
export const RolePoliciesManager: React.FC<RolePoliciesManagerProps> = ({
  roleId,
  onUpdate,
  onPolicyClick,
  translations,
}) => {
  const { fetchRolePolicies, attachRolePolicy, detachRolePolicy } = useRoles();
  const t = useBuildpadTranslations((d) => d.users, translations);

  const fetchAttached = useCallback(
    () => fetchRolePolicies(roleId),
    [fetchRolePolicies, roleId]
  );
  const attach = useCallback(
    (policyIds: string[]) => attachRolePolicy(roleId, policyIds),
    [attachRolePolicy, roleId]
  );
  const detach = useCallback(
    (policyId: string) => detachRolePolicy(roleId, policyId),
    [detachRolePolicy, roleId]
  );

  return (
    <PolicyAttachmentManager
      fetchAttached={fetchAttached}
      attach={attach}
      detach={detach}
      onUpdate={onUpdate}
      onPolicyClick={onPolicyClick}
      emptyMessage={t.rolePolicies.emptyState}
      translations={translations}
    />
  );
};

export default RolePoliciesManager;

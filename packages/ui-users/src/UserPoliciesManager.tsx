'use client';

import React, { useCallback } from 'react';
import { useUsers } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { Policy } from '@buildpad/types';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';
import { PolicyAttachmentManager } from './PolicyAttachmentManager';

export interface UserPoliciesManagerProps {
  /** ID of the user whose directly-attached policies are managed. */
  userId: string;
  /** Called after any successful attach/detach so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a policy row's "open" action is clicked. Hidden when omitted. */
  onPolicyClick?: (policy: Policy) => void;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Manages the policies directly attached to a user (`daas_access` rows with
 * `user` set) via `GET/POST /api/users/[id]/policies` and
 * `DELETE /api/users/[id]/policies/[policyId]`. Ported from the buildpad-daas
 * `UserPoliciesManager`, with the shared list/attach/detach UI delegated to
 * `PolicyAttachmentManager`.
 */
export const UserPoliciesManager: React.FC<UserPoliciesManagerProps> = ({
  userId,
  onUpdate,
  onPolicyClick,
  translations,
}) => {
  const { fetchUserPolicies, attachUserPolicy, detachUserPolicy } = useUsers();
  const t = useBuildpadTranslations((d) => d.users, translations);

  const fetchAttached = useCallback(
    () => fetchUserPolicies(userId),
    [fetchUserPolicies, userId]
  );
  const attach = useCallback(
    (policyIds: string[]) => attachUserPolicy(userId, policyIds),
    [attachUserPolicy, userId]
  );
  const detach = useCallback(
    (policyId: string) => detachUserPolicy(userId, policyId),
    [detachUserPolicy, userId]
  );

  return (
    <PolicyAttachmentManager
      fetchAttached={fetchAttached}
      attach={attach}
      detach={detach}
      onUpdate={onUpdate}
      onPolicyClick={onPolicyClick}
      emptyMessage={t.userPolicies.emptyState}
      translations={translations}
    />
  );
};

export default UserPoliciesManager;

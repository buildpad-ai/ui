'use client';

import React, { useCallback } from 'react';
import { useUsers } from '@buildpad/hooks';
import type { Policy } from '@buildpad/types';
import { PolicyAttachmentManager } from './PolicyAttachmentManager';

export interface UserPoliciesManagerProps {
  /** ID of the user whose directly-attached policies are managed. */
  userId: string;
  /** Called after any successful attach/detach so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a policy row's "open" action is clicked. Hidden when omitted. */
  onPolicyClick?: (policy: Policy) => void;
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
}) => {
  const { fetchUserPolicies, attachUserPolicy, detachUserPolicy } = useUsers();

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
      emptyMessage="No policies attached directly to this user"
    />
  );
};

export default UserPoliciesManager;

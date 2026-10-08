'use client';

import React from 'react';
import { ActionIcon, Menu } from '@mantine/core';
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, WorkflowsTranslations } from '@buildpad/utils';

export interface WorkflowRowActionsMenuProps {
  /** Edit item; omit when the current user may not update. */
  onEdit?: () => void;
  /** Delete item; omit when the current user may not delete. */
  onDelete?: () => void;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Kebab row menu of the workflow list managers. Callers gate by passing
 * `undefined` for disallowed actions; renders nothing when both are absent.
 * All clicks stop propagation so row navigation never fires.
 *
 * Package-local copy of ui-users' `RowActionsMenu` reading the `workflows`
 * namespace; not exported from the package.
 */
export const WorkflowRowActionsMenu: React.FC<WorkflowRowActionsMenuProps> = ({
  onEdit,
  onDelete,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);

  if (!onEdit && !onDelete) return null;

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          aria-label={t.rowActions.ariaLabel}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {onEdit && (
          <Menu.Item
            leftSection={<IconEdit size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            {common.edit}
          </Menu.Item>
        )}
        {onDelete && (
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            {common.delete}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};

export default WorkflowRowActionsMenu;

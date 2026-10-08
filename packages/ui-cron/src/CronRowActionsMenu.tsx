'use client';

import React from 'react';
import { ActionIcon, Menu } from '@mantine/core';
import {
  IconCopy,
  IconDots,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerPlayFilled,
  IconTrash,
} from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type CronTranslations, type DeepPartial } from '@buildpad/utils';

export interface CronRowActionsMenuProps {
  /** The job's name, for the trigger's accessible name ("Actions for Nightly report"). */
  jobName?: string;
  /** Edit item; omit when the current user may not update. */
  onEdit?: () => void;
  /** Run Now item; omit when the current user may not update. */
  onRunNow?: () => void;
  /** Activate item; pass it for an inactive job the current user may update. */
  onActivate?: () => void;
  /** Deactivate item; pass it for an active job the current user may update. */
  onDeactivate?: () => void;
  /** Clone item; omit when the current user may not create. */
  onClone?: () => void;
  /** Delete item; omit when the current user may not delete. */
  onDelete?: () => void;
  /**
   * True while an action of this row is in flight: the trigger shows a loader
   * and does not open, so a second action cannot be started on top of it.
   */
  pending?: boolean;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Kebab row menu of the jobs list: Edit, Run Now, Activate or Deactivate,
 * Clone and Delete. Callers gate by passing `undefined` for a disallowed
 * action; with no action at all nothing is rendered — not a trigger that opens
 * an empty menu. All clicks stop propagation so row navigation never fires.
 *
 * Package-local counterpart of ui-workflows' `WorkflowRowActionsMenu`; not
 * exported from the package.
 */
export const CronRowActionsMenu: React.FC<CronRowActionsMenuProps> = ({
  jobName,
  onEdit,
  onRunNow,
  onActivate,
  onDeactivate,
  onClone,
  onDelete,
  pending = false,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const common = useBuildpadTranslations((d) => d.common);

  if (!onEdit && !onRunNow && !onActivate && !onDeactivate && !onClone && !onDelete) return null;

  /** A menu item's click: never the row's, and then the action. */
  const act = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };
  const hasItemAboveDelete = Boolean(onEdit || onRunNow || onActivate || onDeactivate || onClone);

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          loading={pending}
          aria-label={jobName ? interpolate(t.rowActions.jobAriaLabel, { name: jobName }) : t.rowActions.ariaLabel}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {onEdit && (
          <Menu.Item leftSection={<IconEdit size={14} />} onClick={act(onEdit)}>
            {common.edit}
          </Menu.Item>
        )}
        {onRunNow && (
          <Menu.Item leftSection={<IconPlayerPlayFilled size={14} />} onClick={act(onRunNow)}>
            {t.actions.runNow}
          </Menu.Item>
        )}
        {onDeactivate && (
          <Menu.Item leftSection={<IconPlayerPause size={14} />} onClick={act(onDeactivate)}>
            {t.actions.deactivate}
          </Menu.Item>
        )}
        {onActivate && (
          <Menu.Item leftSection={<IconPlayerPlay size={14} />} onClick={act(onActivate)}>
            {t.actions.activate}
          </Menu.Item>
        )}
        {onClone && (
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={act(onClone)}>
            {t.actions.clone}
          </Menu.Item>
        )}
        {onDelete && (
          <>
            {hasItemAboveDelete && <Menu.Divider />}
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={act(onDelete)}>
              {common.delete}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};

export default CronRowActionsMenu;

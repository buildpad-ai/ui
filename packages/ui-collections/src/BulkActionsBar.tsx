import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Tooltip,
} from "@mantine/core";
import {
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useBuildpadI18n, useBuildpadTranslations } from "@buildpad/services";
import type { CollectionsTranslations, DeepPartial } from "@buildpad/utils";
import React from "react";
import type { BulkAction } from "./CollectionList";

export interface BulkActionsBarProps {
  selectedIds: (string | number)[];
  /** The selected rows themselves, forwarded to bulk actions that need their fields */
  selectedRows?: Record<string, unknown>[];
  enableDelete: boolean;
  deleteAllowed: boolean;
  createAllowed: boolean;
  updateAllowed: boolean;
  bulkActions: BulkAction[];
  onDeleteRequest: (ids: (string | number)[]) => void;
  onClearSelection: () => void;
  /** Per-instance overrides of the `collections` dictionary namespace (prop > provider > defaults) */
  translations?: DeepPartial<CollectionsTranslations>;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedIds,
  selectedRows,
  enableDelete,
  deleteAllowed,
  createAllowed,
  updateAllowed,
  bulkActions,
  onDeleteRequest,
  onClearSelection,
  translations,
}) => {
  // Strings: component prop > provider dictionary > English defaults.
  const t = useBuildpadTranslations((d) => d.collections, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();

  return (
    <Group gap="xs" data-testid="collection-list-bulk-actions">
      <Badge variant="light" size="lg">
        {formatCount(selectedIds.length, t.bulkActions.selectedCount)}
      </Badge>

      {enableDelete && (
        <Tooltip label={deleteAllowed ? t.bulkActions.deleteSelectedTooltip : common.notAllowed}>
          <Button
            variant="light"
            color="red"
            size="compact-sm"
            leftSection={<IconTrash size={16} />}
            onClick={() => deleteAllowed && onDeleteRequest(selectedIds)}
            disabled={!deleteAllowed}
            data-testid="bulk-action-delete"
          >
            {t.bulkActions.delete}
          </Button>
        </Tooltip>
      )}

      {bulkActions.map((action, index) => {
        const permKey = action.requiredPermission;
        const permAllowed =
          !permKey ||
          (permKey === "create" && createAllowed) ||
          (permKey === "update" && updateAllowed) ||
          (permKey === "delete" && deleteAllowed);
        return (
          <Tooltip
            key={index}
            label={permAllowed ? action.label : common.notAllowed}
          >
            <Button
              variant="light"
              color={action.color}
              size="compact-sm"
              leftSection={action.icon || (
                action.requiredPermission === "delete" ? <IconTrash size={16} /> :
                action.requiredPermission === "update" ? <IconEdit size={16} /> :
                action.requiredPermission === "create" ? <IconPlus size={16} /> :
                null
              )}
              onClick={() => permAllowed && action.action(selectedIds, selectedRows)}
              disabled={!permAllowed}
              data-testid={`bulk-action-${index}`}
            >
              {action.label}
            </Button>
          </Tooltip>
        );
      })}

      <ActionIcon
        variant="subtle"
        onClick={onClearSelection}
        title={t.bulkActions.clearSelection}
        data-testid="collection-list-clear-selection"
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
};

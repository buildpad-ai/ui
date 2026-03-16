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
import React from "react";
import type { BulkAction } from "./CollectionList";

export interface BulkActionsBarProps {
  selectedIds: (string | number)[];
  enableDelete: boolean;
  deleteAllowed: boolean;
  createAllowed: boolean;
  updateAllowed: boolean;
  bulkActions: BulkAction[];
  onDeleteRequest: (ids: (string | number)[]) => void;
  onClearSelection: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedIds,
  enableDelete,
  deleteAllowed,
  createAllowed,
  updateAllowed,
  bulkActions,
  onDeleteRequest,
  onClearSelection,
}) => {
  return (
    <Group gap="xs" data-testid="collection-list-bulk-actions">
      <Badge variant="light" size="lg">
        {selectedIds.length} selected
      </Badge>

      {enableDelete && (
        <Tooltip label={deleteAllowed ? "Delete selected" : "Not allowed"}>
          <Button
            variant="light"
            color="red"
            size="compact-sm"
            leftSection={<IconTrash size={16} />}
            onClick={() => deleteAllowed && onDeleteRequest(selectedIds)}
            disabled={!deleteAllowed}
            data-testid="bulk-action-delete"
          >
            Delete
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
            label={permAllowed ? action.label : "Not allowed"}
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
              onClick={() => permAllowed && action.action(selectedIds)}
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
        title="Clear selection"
        data-testid="collection-list-clear-selection"
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
};

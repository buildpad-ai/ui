import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArchive,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import React from "react";
import type { ArchiveFilter, BulkAction } from "./CollectionList";
import { BulkActionsBar } from "./BulkActionsBar";

export interface CollectionListToolbarProps {
  /* Search */
  enableSearch: boolean;
  search: string;
  onSearchChange: (value: string) => void;

  /* Filter */
  enableFilter: boolean;
  filterPanelOpen: boolean;
  activeFilterCount: number;
  onToggleFilterPanel: () => void;

  /* Archive */
  archiveField?: string;
  archiveFilterMode: ArchiveFilter;
  onArchiveFilterChange: (mode: ArchiveFilter) => void;

  /* Refresh */
  onRefresh: () => void;

  /* Selection / Bulk actions */
  enableSelection: boolean;
  selectedIds: (string | number)[];
  enableDelete: boolean;
  deleteAllowed: boolean;
  createAllowed: boolean;
  updateAllowed: boolean;
  bulkActions: BulkAction[];
  onDeleteRequest: (ids: (string | number)[]) => void;
  onClearSelection: () => void;

  /* Create */
  enableCreate: boolean;
  onCreate?: () => void;
}

export const CollectionListToolbar: React.FC<CollectionListToolbarProps> = ({
  enableSearch,
  search,
  onSearchChange,
  enableFilter,
  filterPanelOpen,
  activeFilterCount,
  onToggleFilterPanel,
  archiveField,
  archiveFilterMode,
  onArchiveFilterChange,
  onRefresh,
  enableSelection,
  selectedIds,
  enableDelete,
  deleteAllowed,
  createAllowed,
  updateAllowed,
  bulkActions,
  onDeleteRequest,
  onClearSelection,
  enableCreate,
  onCreate,
}) => {
  const showBulkActions = enableSelection && selectedIds.length > 0;

  return (
    <div className="collection-list-toolbar" data-testid="collection-list-toolbar">
      {/* Left side: search, filter toggle, archive filter, refresh */}
      <Group gap="xs">
        {enableSearch && (
          <TextInput
            placeholder="Search..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange(e.currentTarget.value)
            }
            rightSection={
              search ? (
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                >
                  <IconX size={12} />
                </ActionIcon>
              ) : undefined
            }
            size="sm"
            className="collection-list-search"
            data-testid="collection-list-search"
          />
        )}

        {enableFilter && (
          <Tooltip label={filterPanelOpen ? "Hide filters" : "Show filters"}>
            <ActionIcon
              variant={activeFilterCount > 0 ? "filled" : "subtle"}
              color={activeFilterCount > 0 ? "primary" : undefined}
              onClick={onToggleFilterPanel}
              title="Toggle filter panel"
              data-testid="collection-list-filter-toggle"
              pos="relative"
            >
              <IconFilter size={16} />
              {activeFilterCount > 0 && (
                <Badge
                  size="xs"
                  circle
                  color="red"
                  className="collection-list-filter-badge"
                  data-testid="collection-list-filter-count"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </ActionIcon>
          </Tooltip>
        )}

        {archiveField && (
          <Select
            value={archiveFilterMode}
            onChange={(val) => {
              if (val) onArchiveFilterChange(val as ArchiveFilter);
            }}
            data={[
              { value: "all", label: "All Items" },
              { value: "unarchived", label: "Active Items" },
              { value: "archived", label: "Archived Items" },
            ]}
            size="sm"
            leftSection={<IconArchive size={14} />}
            data-testid="collection-list-archive-filter"
            style={{ width: 160 }}
          />
        )}

        <ActionIcon
          variant="subtle"
          onClick={onRefresh}
          title="Refresh"
          data-testid="collection-list-refresh"
        >
          <IconRefresh size={16} />
        </ActionIcon>
      </Group>

      {/* Right side: bulk actions (when selected), create button */}
      <Group gap="xs">
        {showBulkActions && (
          <BulkActionsBar
            selectedIds={selectedIds}
            enableDelete={enableDelete}
            deleteAllowed={deleteAllowed}
            createAllowed={createAllowed}
            updateAllowed={updateAllowed}
            bulkActions={bulkActions}
            onDeleteRequest={onDeleteRequest}
            onClearSelection={onClearSelection}
          />
        )}

        {enableCreate && onCreate && (
          <Tooltip label={createAllowed ? "Create item" : "Not allowed"}>
            <Button
              variant="filled"
              size="compact-sm"
              leftSection={<IconPlus size={18} />}
              onClick={createAllowed ? onCreate : undefined}
              disabled={!createAllowed}
              data-testid="collection-list-create"
              aria-label={createAllowed ? "Create item" : "Create item (not allowed)"}
            >
              Create item
            </Button>
          </Tooltip>
        )}
      </Group>
    </div>
  );
};

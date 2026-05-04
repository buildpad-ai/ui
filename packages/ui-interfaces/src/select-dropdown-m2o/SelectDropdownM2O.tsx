"use client";

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  CloseButton,
  Combobox,
  Group,
  InputBase,
  Loader,
  LoadingOverlay,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  useCombobox,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import {
  useRelationM2O,
  useRelationM2OItem,
  type M2OItem,
} from "@buildpad/hooks";
import { apiRequest } from "@buildpad/services";
import {
  IconAlertCircle,
  IconEdit,
  IconExternalLink,
  IconLink,
  IconPlus,
  IconSearch,
  IconSelector,
  IconTrash,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useState } from "react";

const DEFAULT_FIELDS: string[] = ["id"];

/**
 * Props for the SelectDropdownM2O component
 *
 * Many-to-One (M2O) relationship interface - allows selecting ONE item from a related collection.
 * Example: A "post" belongs to ONE "category"
 */
export interface SelectDropdownM2OProps {
  /** Current value - the foreign key (ID of the related item) */
  value?: string | number | null;
  /** Callback fired when value changes */
  onChange?: (value: string | number | null) => void;
  /** Current collection name */
  collection: string;
  /** Field name for this M2O relationship */
  field: string;
  /** Primary key of the current item (optional, used in edit mode) */
  primaryKey?: string | number;
  /** Layout mode - 'dropdown' for inline selector, 'modal' for modal picker */
  layout?: "dropdown" | "modal";
  /** Fields to display in the dropdown/selection */
  fields?: string[];
  /** Template string for display */
  template?: string;
  /** Whether the interface is disabled */
  disabled?: boolean;
  /** Enable create new items button */
  enableCreate?: boolean;
  /** Enable link to related items */
  enableLink?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Filter to apply when selecting items */
  filter?: Record<string, unknown>;
  /** Enable search/filter */
  searchable?: boolean;
  /** Field label */
  label?: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string | boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Allow clearing the selection */
  allowNone?: boolean;
}

/**
 * SelectDropdownM2O - Many-to-One relationship interface
 *
 * Similar to DaaS list-o2m but for M2O relationships.
 * Allows selecting ONE related item from another collection.
 */
export const SelectDropdownM2O: React.FC<SelectDropdownM2OProps> = ({
  value,
  onChange,
  collection,
  field,
  // primaryKey is reserved for future use when edit mode needs to know current item
  primaryKey: _primaryKey,
  layout = "dropdown",
  fields = DEFAULT_FIELDS,
  template,
  disabled = false,
  enableCreate = true,
  enableLink = false,
  placeholder = "Select an item...",
  // filter is reserved for future use to filter available items
  filter: _filter,
  searchable = true,
  label,
  description,
  error,
  required = false,
  readOnly = false,
  allowNone = true,
}) => {
  // Suppress unused variable warnings
  void _primaryKey;
  void _filter;
  // Use the custom hook for M2O relationship info
  const {
    relationInfo,
    loading: relationLoading,
    error: relationError,
  } = useRelationM2O(collection, field);

  // Use the hook for loading the selected item
  const {
    item: selectedItem,
    loading: itemLoading,
    loadItem,
  } = useRelationM2OItem(relationInfo, value ?? null);

  // State for dropdown
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  // State for search
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // State for available items
  const [availableItems, setAvailableItems] = useState<M2OItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Modal states
  const [
    createModalOpened,
    { open: openCreateModal, close: closeCreateModal },
  ] = useDisclosure(false);
  const [
    selectModalOpened,
    { open: openSelectModal, close: closeSelectModal },
  ] = useDisclosure(false);

  // Combined loading state
  const loading = relationLoading || itemLoading;

  // Load selected item when value changes
  useEffect(() => {
    if (relationInfo && value) {
      loadItem({ fields });
    }
  }, [relationInfo, value, fields, loadItem]);

  // Load available items for dropdown
  const loadAvailableItems = useCallback(
    async (searchTerm?: string) => {
      if (!relationInfo) return;

      try {
        setItemsLoading(true);
        const collection = relationInfo.relatedCollection.collection;

        const query: Record<string, unknown> = {
          limit: 100,
          fields: fields.join(","),
        };

        // Add search filter if provided
        if (searchTerm) {
          // Search across display fields
          const searchFields = fields.filter((f) => f !== "id");
          if (searchFields.length > 0) {
            query.filter = {
              _or: searchFields.map((f) => ({
                [f]: { _icontains: searchTerm },
              })),
            };
          }
        }

        const queryString = new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [
              k,
              typeof v === "object" ? JSON.stringify(v) : String(v),
            ]),
        ).toString();

        const response = await apiRequest<{ data: M2OItem[] }>(
          `/api/items/${collection}${queryString ? `?${queryString}` : ""}`,
        );
        setAvailableItems(response.data || []);
      } catch (err) {
        console.error("Error loading available items:", err);
        setAvailableItems([]);
      } finally {
        setItemsLoading(false);
      }
    },
    [relationInfo, fields],
  );

  // Load items when dropdown opens or search changes
  useEffect(() => {
    if (combobox.dropdownOpened && relationInfo) {
      loadAvailableItems(debouncedSearch);
    }
  }, [
    combobox.dropdownOpened,
    debouncedSearch,
    relationInfo,
    loadAvailableItems,
  ]);

  // Format display value for an item
  const formatDisplayValue = useCallback(
    (item: M2OItem | null): string => {
      if (!item) return "";

      if (template) {
        // Simple template rendering
        let rendered = template;
        Object.keys(item).forEach((key) => {
          rendered = rendered.replace(`{{${key}}}`, String(item[key] || ""));
        });
        return rendered;
      }

      // Default: show the first available field that's not 'id'
      const displayField = fields.find((f) => f !== "id" && item[f]) || "id";
      return String(item[displayField] ?? item.id ?? "");
    },
    [template, fields],
  );

  // Handle item selection
  const handleSelect = useCallback(
    (itemId: string | number | null) => {
      onChange?.(itemId);
      combobox.closeDropdown();
      setSearch("");
    },
    [onChange, combobox],
  );

  // Handle clear selection
  const handleClear = useCallback(() => {
    onChange?.(null);
    setSearch("");
  }, [onChange]);

  // Handle create new (placeholder - would open a modal to create item in related collection)
  const handleCreateNew = useCallback(() => {
    openCreateModal();
  }, [openCreateModal]);

  // Show relation error
  if (relationError) {
    return (
      <Stack gap="xs">
        {label && (
          <Text size="sm" fw={500}>
            {label}
          </Text>
        )}
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Configuration Error"
          color="red"
        >
          <Text size="sm">{relationError}</Text>
          <Text size="xs" c="dimmed" mt="xs">
            Note: In Storybook, relational interfaces require API proxy routes.
            This component works fully in a Next.js app with DaaS integration.
          </Text>
        </Alert>
      </Stack>
    );
  }

  if (!relationInfo && !relationLoading) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Relationship not configured"
        color="warning"
      >
        The many-to-one relationship is not properly configured for this field.
      </Alert>
    );
  }

  // Dropdown layout (default)
  if (layout === "dropdown") {
    return (
      <Stack gap="xs">
        {label && (
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {label}
              {required && (
                <Text span c="red">
                  {" "}
                  *
                </Text>
              )}
            </Text>
          </Group>
        )}

        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}

        <Combobox
          store={combobox}
          withinPortal={false}
          onOptionSubmit={(val) => handleSelect(val)}
          disabled={disabled || readOnly}
        >
          <Combobox.Target>
            <InputBase
              component="button"
              type="button"
              pointer
              rightSection={
                loading ? (
                  <Loader size={16} />
                ) : value && allowNone && !disabled && !readOnly ? (
                  <CloseButton
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    aria-label="Clear selection"
                  />
                ) : (
                  <IconSelector size={16} />
                )
              }
              onClick={() => {
                if (!disabled && !readOnly) {
                  combobox.toggleDropdown();
                }
              }}
              rightSectionPointerEvents={
                value && allowNone && !disabled && !readOnly ? "auto" : "none"
              }
              disabled={disabled || readOnly}
              error={error ? true : undefined}
              data-testid={`m2o-select-${field}`}
            >
              {selectedItem ? (
                <Group gap="xs" wrap="nowrap">
                  <IconLink size={14} />
                  <Text size="sm" truncate>
                    {formatDisplayValue(selectedItem)}
                  </Text>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  {placeholder}
                </Text>
              )}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown>
            {searchable && (
              <Combobox.Search
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search..."
                leftSection={<IconSearch size={14} />}
              />
            )}

            <Combobox.Options>
              <ScrollArea.Autosize mah={300} type="scroll">
                {itemsLoading ? (
                  <Combobox.Empty>
                    <Group justify="center" py="xs">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">
                        Loading...
                      </Text>
                    </Group>
                  </Combobox.Empty>
                ) : availableItems.length === 0 ? (
                  <Combobox.Empty>No items found</Combobox.Empty>
                ) : (
                  availableItems.map((item) => (
                    <Combobox.Option
                      key={String(item.id)}
                      value={String(item.id)}
                      active={value === item.id}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <IconLink size={14} />
                        <Text size="sm" truncate>
                          {formatDisplayValue(item)}
                        </Text>
                      </Group>
                    </Combobox.Option>
                  ))
                )}
              </ScrollArea.Autosize>
            </Combobox.Options>

            {/* Footer with create action */}
            {!disabled && !readOnly && enableCreate && (
              <Combobox.Footer>
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateNew();
                    combobox.closeDropdown();
                  }}
                >
                  Create New
                </Button>
              </Combobox.Footer>
            )}
          </Combobox.Dropdown>
        </Combobox>

        {/* Action buttons */}
        <Group gap="xs">
          {enableLink && selectedItem && (
            <Tooltip label="View related item">
              <ActionIcon
                variant="subtle"
                size="sm"
                disabled={disabled}
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {error && typeof error === "string" && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        {/* Create Modal */}
        <Modal
          opened={createModalOpened}
          onClose={closeCreateModal}
          title={`Create New ${
            relationInfo?.relatedCollection.collection || "Item"
          }`}
          size="lg"
        >
          <Alert icon={<IconAlertCircle size={16} />} color="info">
            Create functionality will be available when CollectionForm component
            is implemented.
          </Alert>
        </Modal>
      </Stack>
    );
  }

  // Modal layout
  return (
    <Stack gap="sm">
      {label && (
        <Group>
          <Text size="sm" fw={500}>
            {label}
            {required && (
              <Text span c="red">
                {" "}
                *
              </Text>
            )}
          </Text>
        </Group>
      )}

      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}

      <Paper p="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} />

        {/* Selected Item Display */}
        {selectedItem ? (
          <Group justify="space-between">
            <Group gap="xs">
              <IconLink size={16} />
              <Text>{formatDisplayValue(selectedItem)}</Text>
            </Group>

            <Group gap="xs">
              {enableLink && (
                <Tooltip label="View item">
                  <ActionIcon variant="subtle" size="sm">
                    <IconExternalLink size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {!disabled && !readOnly && (
                <>
                  <Tooltip label="Change">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={openSelectModal}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Tooltip>

                  {allowNone && (
                    <Tooltip label="Remove">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={handleClear}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </>
              )}
            </Group>
          </Group>
        ) : (
          <Group justify="center" py="md">
            <Text c="dimmed">No item selected</Text>

            {!disabled && !readOnly && (
              <Button
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={openSelectModal}
              >
                Select Item
              </Button>
            )}
          </Group>
        )}
      </Paper>

      {error && typeof error === "string" && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      {/* Select Modal */}
      <Modal
        opened={selectModalOpened}
        onClose={closeSelectModal}
        title={`Select ${relationInfo?.relatedCollection.collection || "Item"}`}
        size="xl"
      >
        {relationInfo && (
          <Box p="md">
            <Stack gap="md">
              {/* Search */}
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  loadAvailableItems(e.currentTarget.value);
                }}
              />

              {/* Items Table */}
              <Paper withBorder>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {fields.map((f) => (
                        <Table.Th key={f}>
                          <Text size="sm" fw={500}>
                            {f
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Text>
                        </Table.Th>
                      ))}
                      <Table.Th style={{ width: 80 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {itemsLoading ? (
                      <Table.Tr>
                        <Table.Td colSpan={fields.length + 1}>
                          <Group justify="center" py="md">
                            <Loader size="sm" />
                            <Text size="sm" c="dimmed">
                              Loading...
                            </Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ) : availableItems.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={fields.length + 1}>
                          <Text ta="center" c="dimmed" py="md">
                            No items found
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      availableItems.map((item) => (
                        <Table.Tr
                          key={String(item.id)}
                          style={{
                            cursor: "pointer",
                            backgroundColor:
                              value === item.id
                                ? "var(--mantine-primary-color-light)"
                                : undefined,
                          }}
                          onClick={() => {
                            handleSelect(item.id as string | number);
                            closeSelectModal();
                          }}
                        >
                          {fields.map((f) => (
                            <Table.Td key={f}>
                              <Text size="sm">{String(item[f] || "-")}</Text>
                            </Table.Td>
                          ))}
                          <Table.Td>
                            <Button
                              size="xs"
                              variant={value === item.id ? "filled" : "light"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(item.id as string | number);
                                closeSelectModal();
                              }}
                            >
                              {value === item.id ? "Selected" : "Select"}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>

              {/* Footer actions */}
              <Group justify="space-between">
                {allowNone && value && (
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => {
                      handleClear();
                      closeSelectModal();
                    }}
                  >
                    Clear Selection
                  </Button>
                )}

                <Group ml="auto">
                  {enableCreate && (
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => {
                        closeSelectModal();
                        openCreateModal();
                      }}
                    >
                      Create New
                    </Button>
                  )}
                  <Button variant="default" onClick={closeSelectModal}>
                    Cancel
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Box>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={`Create New ${
          relationInfo?.relatedCollection.collection || "Item"
        }`}
        size="lg"
      >
        <Alert icon={<IconAlertCircle size={16} />} color="info">
          Create functionality will be available when CollectionForm component
          is implemented.
        </Alert>
      </Modal>
    </Stack>
  );
};

export default SelectDropdownM2O;

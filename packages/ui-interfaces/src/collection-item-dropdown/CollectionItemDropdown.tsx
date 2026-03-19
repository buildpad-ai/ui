"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Paper,
    Group,
    Text,
    LoadingOverlay,
    Modal,
    Stack,
    ActionIcon,
    Table,
    TextInput,
    Alert,
    Box,
    Tooltip,
    Combobox,
    useCombobox,
    InputBase,
    ScrollArea,
    Loader,
    CloseButton,
    Badge,
    Menu,
    Divider,
} from "@mantine/core";
import {
    IconEdit,
    IconTrash,
    IconExternalLink,
    IconSearch,
    IconAlertCircle,
    IconChevronDown,
    IconList,
} from "@tabler/icons-react";
import { useDisclosure, useDebouncedValue } from "@mantine/hooks";

/**
 * Value type for CollectionItemDropdown
 * Stores both the key (ID) and the collection name
 */
export interface CollectionItemDropdownValue {
    key: (string | number) | null;
    collection: string;
}

/**
 * Display item type for rendering selected item
 */
type DisplayItem = Record<string, unknown>;

/**
 * Collection type for collection selection
 */
interface CollectionInfo {
    collection: string;
    meta?: {
        icon?: string;
        singleton?: boolean;
        note?: string;
    } | null;
}

/**
 * Props for the CollectionItemDropdown component
 * 
 * This interface allows selecting a single item from a specific collection
 * and stores both the item key and collection name as a JSON value.
 * 
 * Based on DaaS collection-item-dropdown interface.
 */
export interface CollectionItemDropdownProps {
    /** Current value containing key and collection */
    value?: CollectionItemDropdownValue | null;
    /** Callback fired when value changes */
    onChange?: (value: CollectionItemDropdownValue | null) => void;
    /** The collection to select items from (optional if showCollectionSelect is true) */
    selectedCollection?: string;
    /** Callback fired when collection changes (for collection selection mode) */
    onCollectionChange?: (collection: string) => void;
    /** Show collection selection UI (like DaaS system-collection interface) */
    showCollectionSelect?: boolean;
    /** Include system collections in collection dropdown */
    includeSystemCollections?: boolean;
    /** Exclude singleton collections from dropdown */
    excludeSingletons?: boolean;
    /** Collections data for demo/mock mode (collection selection) */
    mockCollections?: CollectionInfo[];
    /** Display template for rendering items (e.g., "{{name}} - {{id}}") */
    template?: string | null;
    /** Whether the interface is disabled */
    disabled?: boolean;
    /** Filter to apply when fetching items (JSON filter object) */
    filter?: Record<string, unknown> | null;
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
    /** Placeholder text */
    placeholder?: string;
    /** Fields to fetch for display (defaults to ['id']) */
    fields?: string[];
    /** Primary key field name (defaults to 'id') */
    primaryKey?: string;
    /** Enable creating new items */
    enableCreate?: boolean;
    /** Enable link to view selected item */
    enableLink?: boolean;
    /** Enable search functionality */
    searchable?: boolean;
    /** Allow clearing selection */
    allowNone?: boolean;
    /** Items data for demo/mock mode */
    mockItems?: DisplayItem[];
}

/**
 * CollectionItemDropdown - Collection Item Selection Interface
 * 
 * Similar to DaaS collection-item-dropdown interface.
 * Allows selecting a single item from a collection and stores
 * both the key and collection name as JSON.
 * 
 * Features:
 * - Dropdown selection with search
 * - Display template support (e.g., "{{name}} - {{email}}")
 * - Item filtering
 * - Create new item button
 * - Link to view selected item
 * - Disabled and read-only states
 * 
 * @example
 * ```tsx
 * <CollectionItemDropdown
 *   value={{ key: 'user-1', collection: 'users' }}
 *   onChange={handleChange}
 *   selectedCollection="users"
 *   template="{{name}} ({{email}})"
 *   label="Select User"
 *   placeholder="Choose a user..."
 *   searchable
 *   allowNone
 * />
 * ```
 */
export const CollectionItemDropdown: React.FC<CollectionItemDropdownProps> = ({
    value = null,
    onChange,
    selectedCollection: selectedCollectionProp,
    onCollectionChange,
    showCollectionSelect = false,
    includeSystemCollections = true,
    excludeSingletons = true,
    mockCollections,
    template = null,
    disabled = false,
    filter = null,
    label,
    description,
    error,
    required = false,
    readOnly = false,
    placeholder = "Select an item...",
    fields = ['id'],
    primaryKey = 'id',
    enableLink = false,
    searchable = true,
    allowNone = true,
    mockItems,
}) => {

    // Internal collection state (for collection selection mode)
    const [internalCollection, setInternalCollection] = useState<string>(selectedCollectionProp || '');
    const selectedCollection = selectedCollectionProp || internalCollection;

    // Collection selection state
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [availableCollections, setAvailableCollections] = useState<CollectionInfo[]>([]);
    const [collectionMenuOpened, setCollectionMenuOpened] = useState(false);

    // Sync internal collection with prop
    useEffect(() => {
        if (selectedCollectionProp) {
            setInternalCollection(selectedCollectionProp);
        }
    }, [selectedCollectionProp]);

    // State for loading
    const [loading, setLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);

    // State for display item (the currently selected item's display data)
    const [displayItem, setDisplayItem] = useState<DisplayItem | null>(null);

    // State for available items
    const [availableItems, setAvailableItems] = useState<DisplayItem[]>([]);

    // State for search
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebouncedValue(search, 300);

    // Combobox state
    const combobox = useCombobox({
        onDropdownClose: () => {
            combobox.resetSelectedOption();
            setSearch('');
        },
    });

    // Modal states
    const [selectModalOpened, { open: _openSelectModal, close: closeSelectModal }] = useDisclosure(false);

    // Suppress unused variable warnings
    void _openSelectModal;

    // Use refs for values that shouldn't trigger effect re-runs
    const fieldsRef = useRef(fields);
    const mockItemsRef = useRef(mockItems);
    const primaryKeyRef = useRef(primaryKey);
    const filterRef = useRef(filter);
    
    // Update refs when props change
    useEffect(() => {
        fieldsRef.current = fields;
        mockItemsRef.current = mockItems;
        primaryKeyRef.current = primaryKey;
        filterRef.current = filter;
    }, [fields, mockItems, primaryKey, filter]);

    // Load available collections for collection selection mode
    useEffect(() => {
        if (!showCollectionSelect) return;

        const loadCollections = async () => {
            // In mock mode, use mockCollections
            if (mockCollections && mockCollections.length > 0) {
                let filtered = mockCollections;
                if (!includeSystemCollections) {
                    filtered = filtered.filter(c => !c.collection.startsWith('daas_'));
                }
                if (excludeSingletons) {
                    filtered = filtered.filter(c => !c.meta?.singleton);
                }
                setAvailableCollections(filtered);
                return;
            }

            // In real mode, fetch from API
            setCollectionsLoading(true);
            try {
                const response = await fetch('/api/collections');
                if (!response.ok) throw new Error('Failed to fetch collections');
                const data = await response.json();
                let collections: CollectionInfo[] = data.data || [];
                
                if (!includeSystemCollections) {
                    collections = collections.filter(c => !c.collection.startsWith('daas_'));
                }
                if (excludeSingletons) {
                    collections = collections.filter(c => !c.meta?.singleton);
                }
                
                setAvailableCollections(collections);
            } catch (err) {
                console.error('Failed to fetch collections:', err);
            } finally {
                setCollectionsLoading(false);
            }
        };

        loadCollections();
    }, [showCollectionSelect, mockCollections, includeSystemCollections, excludeSingletons]);

    // Handle collection selection
    const handleCollectionSelect = useCallback((collection: string) => {
        setInternalCollection(collection);
        onCollectionChange?.(collection);
        setCollectionMenuOpened(false);
        // Clear item selection when collection changes
        onChange?.(null);
    }, [onCollectionChange, onChange]);

    // Separate user and system collections
    const { userCollections, systemCollections } = React.useMemo(() => {
        return {
            userCollections: availableCollections.filter(c => !c.collection.startsWith('daas_')),
            systemCollections: availableCollections.filter(c => c.collection.startsWith('daas_')),
        };
    }, [availableCollections]);

    // Build display template
    const displayTemplate = React.useMemo(() => {
        if (template) return template;
        return `{{ ${primaryKey || 'id'} }}`;
    }, [template, primaryKey]);

    // Format display value using template
    const formatDisplayValue = useCallback((item: DisplayItem | null): string => {
        if (!item) return '';

        let rendered = displayTemplate;
        // Replace template placeholders like {{field}} or {{ field }}
        const templateRegex = /\{\{\s*(\w+)\s*\}\}/g;
        rendered = rendered.replace(templateRegex, (_, fieldName) => {
            return String(item[fieldName] ?? '');
        });

        // Clean up any remaining empty placeholders
        rendered = rendered.replace(/\{\{\s*\w*\s*\}\}/g, '').trim();
        
        return rendered || String(item[primaryKey] ?? item.id ?? '');
    }, [displayTemplate, primaryKey]);

    // Load display item when value changes
    useEffect(() => {
        const loadDisplayItem = async () => {
            const currentMockItems = mockItemsRef.current;
            const currentPrimaryKey = primaryKeyRef.current;
            
            if (!value || !value.key) {
                setDisplayItem(null);
                return;
            }

            // In mock mode, find item from mockItems
            if (currentMockItems && currentMockItems.length > 0) {
                const found = currentMockItems.find(item => 
                    item[currentPrimaryKey] === value.key || item.id === value.key
                );
                setDisplayItem(found || null);
                return;
            }

            // In real mode, would fetch from API
            // For now, set a placeholder
            setLoading(true);
            try {
                // Simulated delay for demo
                await new Promise(resolve => setTimeout(resolve, 100));
                setDisplayItem({ [currentPrimaryKey]: value.key });
            } finally {
                setLoading(false);
            }
        };

        loadDisplayItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.key, value?.collection]); // Only depend on the primitive values to avoid infinite loops

    // Load available items for dropdown
    const loadAvailableItems = useCallback(async (searchTerm?: string) => {
        setItemsLoading(true);
        try {
            // In mock mode, filter mockItems
            const currentMockItems = mockItemsRef.current;
            const currentFields = fieldsRef.current;
            const currentFilter = filterRef.current;
            
            if (currentMockItems && currentMockItems.length > 0) {
                let filtered = currentMockItems;
                
                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    filtered = currentMockItems.filter(item => {
                        return currentFields.some(field => {
                            const val = item[field];
                            return val && String(val).toLowerCase().includes(lowerSearch);
                        });
                    });
                }
                
                setAvailableItems(filtered);
                return;
            }

            // In real mode, fetch from API
            if (!selectedCollection) {
                setAvailableItems([]);
                return;
            }

            try {
                // Build query params
                const params = new URLSearchParams();
                params.set('limit', '100'); // Limit for dropdown

                if (searchTerm) {
                    // Use search parameter if available
                    params.set('search', searchTerm);
                }

                // Add filter if provided (use ref to avoid infinite loops)
                if (currentFilter) {
                    params.set('filter', JSON.stringify(currentFilter));
                }

                const response = await fetch(`/api/items/${selectedCollection}?${params.toString()}`);
                
                if (!response.ok) {
                    console.error('Failed to fetch items:', await response.text());
                    setAvailableItems([]);
                    return;
                }

                const result = await response.json();
                // Handle both { data: [...] } and direct array response
                const items = Array.isArray(result) ? result : (result.data || []);
                setAvailableItems(items);
            } catch (fetchErr) {
                console.error('Error fetching items:', fetchErr);
                setAvailableItems([]);
            }
        } finally {
            setItemsLoading(false);
        }
    }, [selectedCollection]); // selectedCollection is a primitive string, safe to include

    // Load items when dropdown opens or search changes
    useEffect(() => {
        if (combobox.dropdownOpened) {
            loadAvailableItems(debouncedSearch);
        }
    }, [combobox.dropdownOpened, debouncedSearch, loadAvailableItems]);

    // Handle item selection
    const handleSelect = useCallback((itemKey: string | number | null) => {
        if (itemKey === null) {
            onChange?.(null);
        } else {
            onChange?.({
                key: itemKey,
                collection: selectedCollection,
            });
        }
        combobox.closeDropdown();
        setSearch('');
    }, [onChange, selectedCollection, combobox]);

    // Handle clear selection
    const handleClear = useCallback(() => {
        onChange?.(null);
        setSearch('');
    }, [onChange]);

    // Check if we have valid configuration (only if collection selection is not enabled)
    if (!selectedCollection && !showCollectionSelect) {
        return (
            <Alert icon={<IconAlertCircle size={16} />} title="Configuration Error" color="red" data-testid="collection-item-dropdown-config-error">
                The selectedCollection prop is required for CollectionItemDropdown, or enable showCollectionSelect.
            </Alert>
        );
    }

    return (
        <Stack gap="xs" data-testid="collection-item-dropdown-container">
            {label && (
                <Group gap="xs">
                    <Text size="sm" fw={500} data-testid="collection-item-dropdown-label">
                        {label}
                        {required && <Text span c="red"> *</Text>}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                        {selectedCollection}
                    </Badge>
                </Group>
            )}

            {description && (
                <Text size="xs" c="dimmed" data-testid="collection-item-dropdown-description">
                    {description}
                </Text>
            )}

            {/* Collection Selection (when showCollectionSelect is true) */}
            {showCollectionSelect && (
                <TextInput
                    value={selectedCollection}
                    onChange={(e) => handleCollectionSelect(e.target.value)}
                    placeholder="Select a collection..."
                    disabled={disabled || readOnly}
                    label="Collection"
                    description="Select which collection to pick items from"
                    styles={{
                        input: {
                            fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                            color: availableCollections.some(c => c.collection === selectedCollection)
                                ? 'var(--mantine-primary-color-6)'
                                : undefined,
                        },
                    }}
                    rightSection={
                        !disabled && !readOnly && (
                            <Menu
                                opened={collectionMenuOpened}
                                onClose={() => setCollectionMenuOpened(false)}
                                position="bottom-end"
                                withinPortal
                                width={300}
                            >
                                <Menu.Target>
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => setCollectionMenuOpened(!collectionMenuOpened)}
                                        title="Select existing collection"
                                        data-testid="collection-select-menu-trigger"
                                    >
                                        {collectionsLoading ? <Loader size={14} /> : <IconList size={16} />}
                                    </ActionIcon>
                                </Menu.Target>

                                <Menu.Dropdown data-testid="collection-select-dropdown">
                                    <ScrollArea.Autosize mah={300} type="scroll">
                                        {/* User Collections */}
                                        {userCollections.length > 0 && (
                                            <>
                                                {userCollections.map((col) => (
                                                    <Menu.Item
                                                        key={col.collection}
                                                        onClick={() => handleCollectionSelect(col.collection)}
                                                        style={{
                                                            fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                                                            backgroundColor: selectedCollection === col.collection
                                                                ? 'var(--mantine-primary-color-light)'
                                                                : undefined,
                                                        }}
                                                        data-testid={`collection-option-${col.collection}`}
                                                    >
                                                        <Text size="sm" truncate style={{ fontFamily: 'var(--mantine-font-family-monospace, monospace)' }}>
                                                            {col.collection}
                                                        </Text>
                                                    </Menu.Item>
                                                ))}
                                            </>
                                        )}

                                        {/* System Collections */}
                                        {includeSystemCollections && systemCollections.length > 0 && (
                                            <>
                                                <Divider my="xs" />
                                                <Text size="xs" c="dimmed" px="xs" py={4}>
                                                    System
                                                </Text>
                                                {systemCollections.map((col) => (
                                                    <Menu.Item
                                                        key={col.collection}
                                                        onClick={() => handleCollectionSelect(col.collection)}
                                                        style={{
                                                            fontFamily: 'var(--mantine-font-family-monospace, monospace)',
                                                            backgroundColor: selectedCollection === col.collection
                                                                ? 'var(--mantine-primary-color-light)'
                                                                : undefined,
                                                        }}
                                                        data-testid={`collection-option-${col.collection}`}
                                                    >
                                                        <Text size="sm" truncate style={{ fontFamily: 'var(--mantine-font-family-monospace, monospace)' }}>
                                                            {col.collection}
                                                        </Text>
                                                    </Menu.Item>
                                                ))}
                                            </>
                                        )}

                                        {/* Empty state */}
                                        {userCollections.length === 0 && systemCollections.length === 0 && !collectionsLoading && (
                                            <Text size="sm" c="dimmed" ta="center" p="md">
                                                No collections found
                                            </Text>
                                        )}

                                        {collectionsLoading && (
                                            <Group justify="center" p="md">
                                                <Loader size="sm" />
                                            </Group>
                                        )}
                                    </ScrollArea.Autosize>
                                </Menu.Dropdown>
                            </Menu>
                        )
                    }
                    data-testid="collection-select-input"
                    mb="md"
                />
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
                            ) : value?.key && allowNone && !disabled && !readOnly ? (
                                <CloseButton
                                    size="sm"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClear();
                                    }}
                                    aria-label="Clear selection"
                                    data-testid="collection-item-dropdown-clear"
                                />
                            ) : (
                                <IconChevronDown size={16} />
                            )
                        }
                        onClick={() => {
                            if (!disabled && !readOnly) {
                                combobox.toggleDropdown();
                            }
                        }}
                        rightSectionPointerEvents={value?.key && allowNone && !disabled && !readOnly ? 'auto' : 'none'}
                        disabled={disabled || readOnly}
                        error={error ? true : undefined}
                        data-testid="collection-item-dropdown-input"
                        pos="relative"
                    >
                        <LoadingOverlay visible={loading} loaderProps={{ size: 'xs' }} />
                        {displayItem ? (
                            <Group gap="xs" wrap="nowrap">
                                <Text size="sm" truncate data-testid="collection-item-dropdown-selected-value">
                                    {formatDisplayValue(displayItem)}
                                </Text>
                            </Group>
                        ) : (
                            <Text size="sm" c="dimmed" data-testid="collection-item-dropdown-placeholder">
                                {placeholder}
                            </Text>
                        )}
                    </InputBase>
                </Combobox.Target>

                <Combobox.Dropdown data-testid="collection-item-dropdown-dropdown">
                    {searchable && (
                        <Combobox.Search
                            value={search}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            placeholder="Search..."
                            leftSection={<IconSearch size={14} />}
                            data-testid="collection-item-dropdown-search"
                        />
                    )}

                    <Combobox.Options>
                        <ScrollArea.Autosize mah={300} type="scroll">
                            {itemsLoading ? (
                                <Combobox.Empty>
                                    <Group justify="center" py="xs">
                                        <Loader size="sm" />
                                        <Text size="sm" c="dimmed">Loading...</Text>
                                    </Group>
                                </Combobox.Empty>
                            ) : availableItems.length === 0 ? (
                                <Combobox.Empty data-testid="collection-item-dropdown-empty">
                                    No items found
                                </Combobox.Empty>
                            ) : (
                                availableItems.map((item, index) => {
                                    const itemKey = item[primaryKey] ?? item.id;
                                    const isSelected = value?.key === itemKey;
                                    
                                    return (
                                        <Combobox.Option
                                            key={String(itemKey)}
                                            value={String(itemKey)}
                                            active={isSelected}
                                            data-testid={`collection-item-dropdown-option-${index}`}
                                        >
                                            <Group gap="xs" wrap="nowrap">
                                                <Text size="sm" truncate>
                                                    {formatDisplayValue(item)}
                                                </Text>
                                            </Group>
                                        </Combobox.Option>
                                    );
                                })
                            )}
                        </ScrollArea.Autosize>
                    </Combobox.Options>
                </Combobox.Dropdown>
            </Combobox>

            {/* Action buttons */}
            {enableLink && !disabled && !readOnly && (
                <Group gap="xs">
                    {displayItem && (
                        <Tooltip label="View item">
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                data-testid="collection-item-dropdown-view-link"
                            >
                                <IconExternalLink size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            )}

            {error && typeof error === 'string' && (
                <Text size="xs" c="red" data-testid="collection-item-dropdown-error">
                    {error}
                </Text>
            )}

            {/* Select Modal (optional modal view) */}
            <Modal
                opened={selectModalOpened}
                onClose={closeSelectModal}
                title={`Select from ${selectedCollection}`}
                size="xl"
                data-testid="collection-item-dropdown-select-modal"
            >
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
                            data-testid="collection-item-dropdown-modal-search"
                        />

                        {/* Items Table */}
                        <Paper withBorder>
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        {fields.map(f => (
                                            <Table.Th key={f}>
                                                <Text size="sm" fw={500}>
                                                    {f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </Text>
                                            </Table.Th>
                                        ))}
                                        <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {itemsLoading ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={fields.length + 1}>
                                                <Group justify="center" py="md">
                                                    <Loader size="sm" />
                                                    <Text size="sm" c="dimmed">Loading...</Text>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : availableItems.length === 0 ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={fields.length + 1}>
                                                <Text ta="center" c="dimmed" py="md">No items found</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : (
                                        availableItems.map((item) => {
                                            const itemKey = item[primaryKey] ?? item.id;
                                            const isSelected = value?.key === itemKey;
                                            
                                            return (
                                                <Table.Tr
                                                    key={String(itemKey)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        backgroundColor: isSelected ? 'var(--mantine-primary-color-light)' : undefined,
                                                    }}
                                                    onClick={() => {
                                                        handleSelect(itemKey as string | number);
                                                        closeSelectModal();
                                                    }}
                                                >
                                                    {fields.map(f => (
                                                        <Table.Td key={f}>
                                                            <Text size="sm">{String(item[f] || '-')}</Text>
                                                        </Table.Td>
                                                    ))}
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <Tooltip label="Select">
                                                                <ActionIcon
                                                                    variant={isSelected ? 'filled' : 'light'}
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSelect(itemKey as string | number);
                                                                        closeSelectModal();
                                                                    }}
                                                                >
                                                                    <IconEdit size={14} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            {enableLink && (
                                                                <Tooltip label="View">
                                                                    <ActionIcon
                                                                        variant="subtle"
                                                                        color="gray"
                                                                        size="sm"
                                                                    >
                                                                        <IconExternalLink size={14} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                            )}
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Paper>

                        {/* Footer actions */}
                        <Group justify="space-between">
                            {allowNone && value?.key && (
                                <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => {
                                        handleClear();
                                        closeSelectModal();
                                    }}
                                    data-testid="collection-item-dropdown-modal-clear"
                                >
                                    <IconTrash size={14} />
                                </ActionIcon>
                            )}
                            
                        </Group>
                    </Stack>
                </Box>
            </Modal>
        </Stack>
    );
};

export default CollectionItemDropdown;

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
import { renderTemplate, resolveDisplayTemplate } from "../list-m2a/render-template";
import { useBuildpadTranslations } from "@buildpad/services";
import { interpolate, type DeepPartial, type InterfacesTranslations } from "@buildpad/utils";

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
    /** Current value containing key and collection. Also accepts a raw key, a JSON string, or a resolved item object for interoperability with external data sources. */
    value?: CollectionItemDropdownValue | string | number | Record<string, unknown> | null;
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
    /** Per-instance overrides of the dictionary strings (`interfaces.collectionItemDropdown`) */
    translations?: DeepPartial<InterfacesTranslations['collectionItemDropdown']>;
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
    placeholder,
    fields = ['id'],
    primaryKey = 'id',
    enableLink = false,
    searchable = true,
    allowNone = true,
    mockItems,
    translations,
}) => {
    const t = useBuildpadTranslations((d) => d.interfaces.collectionItemDropdown, translations);

    // Internal collection state (for collection selection mode)
    const [internalCollection, setInternalCollection] = useState<string>(selectedCollectionProp || '');
    const selectedCollection = selectedCollectionProp || internalCollection;

    // Raw text of the collection TextInput while the user is typing. Kept
    // separate from `selectedCollection` so keystrokes don't commit (and
    // clear the item selection) until the value is either an exact match
    // or the field blurs — see handleCollectionInputChange/Blur below.
    const [collectionDraft, setCollectionDraft] = useState(selectedCollection);
    useEffect(() => {
        setCollectionDraft(selectedCollection);
    }, [selectedCollection]);

    // Normalize value from primitive or other object formats to CollectionItemDropdownValue
    const normalizedValue = React.useMemo<CollectionItemDropdownValue | null>(() => {
        if (!value) return null;
        
        let parsedValue = value;
        if (typeof value === 'string' && value.trim().startsWith('{')) {
            try {
                parsedValue = JSON.parse(value);
            } catch {
                // Ignore parse error, treat as raw string
            }
        }

        // If it's already in the expected shape
        if (typeof parsedValue === 'object' && parsedValue !== null && 'key' in parsedValue) {
            return parsedValue as CollectionItemDropdownValue;
        }
        
        // If it's a resolved item object (e.g. { id: 123, name: '...' })
        if (typeof parsedValue === 'object' && parsedValue !== null) {
            const keyVal = (parsedValue as any)[primaryKey] ?? (parsedValue as any).id;
            if (keyVal !== undefined && keyVal !== null) {
                return {
                    key: keyVal,
                    collection: selectedCollection,
                };
            }
            return null;
        }
        
        // If it's a primitive string/number key
        return {
            key: parsedValue as string | number,
            collection: selectedCollection,
        };
    }, [value, selectedCollection, primaryKey]);

    // Collection selection state
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [availableCollections, setAvailableCollections] = useState<CollectionInfo[]>([]);
    // Whether the collection list has been successfully resolved at least
    // once. `availableCollections` alone can't distinguish "loaded, and there
    // genuinely are none" from "not loaded yet" or "the fetch failed" — and
    // validating a typed name against an unloaded list rejects valid input.
    const [collectionsKnown, setCollectionsKnown] = useState(false);
    // The collection most recently committed to the parent. `selectedCollection`
    // cannot serve this purpose: under a controlled prop that does not echo
    // `onCollectionChange` back (the form pipeline never passes that callback
    // at all), it never updates, so blur would see the draft still differing
    // from it and commit a second time.
    const lastCommittedCollectionRef = React.useRef<string>(selectedCollectionProp || '');
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
    const availableItemsRef = useRef(availableItems);
    
    // Update refs when props/state change
    useEffect(() => {
        fieldsRef.current = fields;
        mockItemsRef.current = mockItems;
        primaryKeyRef.current = primaryKey;
        filterRef.current = filter;
        availableItemsRef.current = availableItems;
    }, [fields, mockItems, primaryKey, filter, availableItems]);

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
                setCollectionsKnown(true);
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
                setCollectionsKnown(true);
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
        // V3-7: retyping the CURRENT collection character-by-character
        // (backspace + retype the same value) re-matched `availableCollections`
        // and ran through here again, unconditionally clearing the item
        // selection even though the collection never actually changed. A
        // real no-op for the collection itself must not wipe anything.
        // V3-7: retyping the CURRENT collection character-by-character
        // (backspace + retype the same value) re-matched `availableCollections`
        // and ran through here again, unconditionally clearing the item
        // selection even though the collection never actually changed.
        //
        // Only the DESTRUCTIVE half is skipped. The pick is still reported:
        // "value unchanged" and "user made no choice" are different events, and
        // a parent that has lost its collection (form reset, record switch)
        // relies on this callback to learn the user re-confirmed one. The
        // internal fallback is still synced too, so it cannot strand a stale
        // value that later wins over a cleared prop.
        const unchanged = collection === selectedCollection;
        lastCommittedCollectionRef.current = collection;
        setInternalCollection(collection);
        onCollectionChange?.(collection);
        setCollectionMenuOpened(false);
        if (!unchanged) {
            // Clear item selection when the collection actually changes
            onChange?.(null);
        }
    }, [selectedCollection, onCollectionChange, onChange]);

    // Free-text collection input: only commit (and clear the item selection)
    // once the typed value resolves to a real collection or the field blurs
    // — not on every keystroke, which used to wipe the selection mid-type.
    const handleCollectionInputChange = useCallback((raw: string) => {
        setCollectionDraft(raw);
        if (availableCollections.some((c) => c.collection === raw)) {
            handleCollectionSelect(raw);
        }
    }, [availableCollections, handleCollectionSelect]);

    const handleCollectionInputBlur = useCallback(() => {
        const trimmed = collectionDraft.trim();
        if (trimmed === selectedCollection || trimmed === lastCommittedCollectionRef.current) {
            // Still normalize the displayed text, so stray whitespace doesn't
            // leave the input rendering something the selection isn't.
            setCollectionDraft(selectedCollection);
            return;
        }
        // V3-7: commit only a value that actually resolves to a real
        // collection — an unvalidated partial string (the user typed
        // something and clicked away without picking from the menu) used to
        // commit as-is, wiping the item selection and leaving selectedCollection
        // set to a collection that doesn't exist. Revert the draft instead.
        //
        // Only when the list is actually KNOWN, though: it starts empty and is
        // filled by an async fetch that can also fail outright, and treating
        // "we haven't loaded it yet" the same as "that isn't a collection"
        // silently discarded a perfectly valid typed name — removing the
        // free-text escape hatch precisely when the menu can't offer one.
        if (!collectionsKnown || availableCollections.some((c) => c.collection === trimmed)) {
            handleCollectionSelect(trimmed);
        } else {
            setCollectionDraft(selectedCollection);
        }
    }, [collectionDraft, selectedCollection, handleCollectionSelect, availableCollections, collectionsKnown]);

    // Separate user and system collections
    const { userCollections, systemCollections } = React.useMemo(() => {
        return {
            userCollections: availableCollections.filter(c => !c.collection.startsWith('daas_')),
            systemCollections: availableCollections.filter(c => c.collection.startsWith('daas_')),
        };
    }, [availableCollections]);

    // Build display template using shared fallback chain
    const displayTemplate = React.useMemo(() => {
        return resolveDisplayTemplate(template, null, primaryKey || 'id');
    }, [template, primaryKey]);

    // Format display value using shared renderTemplate
    const formatDisplayValue = useCallback((item: DisplayItem | null): string => {
        if (!item) return '';
        return renderTemplate(displayTemplate, item as Record<string, unknown>);
    }, [displayTemplate]);

    // Load display item when value changes
    useEffect(() => {
        const loadDisplayItem = async () => {
            const currentMockItems = mockItemsRef.current;
            const currentPrimaryKey = primaryKeyRef.current;
            
            if (!normalizedValue || !normalizedValue.key) {
                setDisplayItem(null);
                return;
            }

            // In mock mode, find item from mockItems
            if (currentMockItems && currentMockItems.length > 0) {
                const found = currentMockItems.find(item => 
                    item[currentPrimaryKey] === normalizedValue.key || item.id === normalizedValue.key
                );
                setDisplayItem(found || null);
                return;
            }

            // Try to find the item in currently loaded items first to avoid a network request
            const currentAvailableItems = availableItemsRef.current;
            if (currentAvailableItems && currentAvailableItems.length > 0) {
                const found = currentAvailableItems.find(item => 
                    item[currentPrimaryKey] === normalizedValue.key || item.id === normalizedValue.key
                );
                if (found) {
                    setDisplayItem(found);
                    return;
                }
            }

            // In real mode, fetch from API
            const collectionName = normalizedValue.collection || selectedCollection;
            if (!collectionName) {
                setDisplayItem({ [currentPrimaryKey]: normalizedValue.key });
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`/api/items/${collectionName}/${normalizedValue.key}`);
                if (response.ok) {
                    const result = await response.json();
                    setDisplayItem(result.data || null);
                } else {
                    console.error('Failed to fetch selected item:', await response.text());
                    setDisplayItem({ [currentPrimaryKey]: normalizedValue.key });
                }
            } catch (err) {
                console.error('Error fetching selected item:', err);
                setDisplayItem({ [currentPrimaryKey]: normalizedValue.key });
            } finally {
                setLoading(false);
            }
        };

        loadDisplayItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizedValue?.key, normalizedValue?.collection]); // Only depend on the primitive values to avoid infinite loops

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
            <Alert icon={<IconAlertCircle size={16} />} title={t.configError.title} color="red" data-testid="collection-item-dropdown-config-error">
                {t.configError.message}
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
                    value={collectionDraft}
                    onChange={(e) => handleCollectionInputChange(e.target.value)}
                    onBlur={handleCollectionInputBlur}
                    placeholder={t.collectionSelect.placeholder}
                    disabled={disabled || readOnly}
                    label={t.collectionSelect.label}
                    description={t.collectionSelect.description}
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
                                        title={t.collectionSelect.menuTooltip}
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
                                                    {t.collectionSelect.systemSection}
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
                                                {t.collectionSelect.empty}
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
                onOptionSubmit={(val) => {
                    // `val` is Mantine's stringified option value — resolve it
                    // back to the item's raw (possibly numeric) key so
                    // isSelected/`===` comparisons and the stored value keep
                    // their original type instead of collapsing to a string.
                    const matched = availableItems.find(
                        (item) => String(item[primaryKey] ?? item.id) === val,
                    );
                    const resolvedKey = matched
                        ? (matched[primaryKey] ?? matched.id) as string | number
                        : val;
                    handleSelect(resolvedKey);
                }}
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
                            ) : normalizedValue?.key && allowNone && !disabled && !readOnly ? (
                                <CloseButton
                                    size="sm"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClear();
                                    }}
                                    aria-label={t.clearSelection}
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
                        rightSectionPointerEvents={normalizedValue?.key && allowNone && !disabled && !readOnly ? 'auto' : 'none'}
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
                                {placeholder ?? t.placeholder}
                            </Text>
                        )}
                    </InputBase>
                </Combobox.Target>

                <Combobox.Dropdown data-testid="collection-item-dropdown-dropdown">
                    {searchable && (
                        <Combobox.Search
                            value={search}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            placeholder={t.searchPlaceholder}
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
                                        <Text size="sm" c="dimmed">{t.loading}</Text>
                                    </Group>
                                </Combobox.Empty>
                            ) : availableItems.length === 0 ? (
                                <Combobox.Empty data-testid="collection-item-dropdown-empty">
                                    {t.noItems}
                                </Combobox.Empty>
                            ) : (
                                availableItems.map((item, index) => {
                                    const itemKey = item[primaryKey] ?? item.id;
                                    const isSelected = normalizedValue?.key === itemKey;
                                    
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
                        <Tooltip label={t.viewItem}>
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
                title={interpolate(t.selectModal.title, { collection: selectedCollection })}
                size="xl"
                data-testid="collection-item-dropdown-select-modal"
            >
                <Box p="md">
                    <Stack gap="md">
                        {/* Search */}
                        <TextInput
                            placeholder={t.searchPlaceholder}
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
                                        <Table.Th style={{ width: 120 }}>{t.selectModal.actionsColumn}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {itemsLoading ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={fields.length + 1}>
                                                <Group justify="center" py="md">
                                                    <Loader size="sm" />
                                                    <Text size="sm" c="dimmed">{t.loading}</Text>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : availableItems.length === 0 ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={fields.length + 1}>
                                                <Text ta="center" c="dimmed" py="md">{t.noItems}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : (
                                        availableItems.map((item) => {
                                            const itemKey = item[primaryKey] ?? item.id;
                                            const isSelected = normalizedValue?.key === itemKey;
                                            
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
                                                            <Text size="sm">{String(item[f] || t.selectModal.emptyCell)}</Text>
                                                        </Table.Td>
                                                    ))}
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <Tooltip label={t.selectModal.select}>
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
                                                                <Tooltip label={t.selectModal.view}>
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
                            {allowNone && normalizedValue?.key && (
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

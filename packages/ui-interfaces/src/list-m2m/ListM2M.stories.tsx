import type { Meta, StoryObj } from '@storybook/react';
import { ListM2M } from './ListM2M';
import type { M2MDisplayItem } from '@buildpad/hooks';

const meta: Meta<typeof ListM2M> = {
    title: 'Interfaces/ListM2M',
    component: ListM2M,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: `
The ListM2M interface manages many-to-many relationships through junction tables,
providing a comprehensive UI for creating, selecting, editing, and removing related items.

## Features
- **Dual Layout Modes**: List view with templates and Table view with columns
- **CRUD Operations**: Create new items, select existing items, edit relationships, remove items
- **Search & Filter**: Built-in search functionality for table layout
- **Manual Sorting**: Up/down buttons for reordering when sort field exists
- **Pagination**: Handle large datasets with configurable page size
- **Customizable Display**: Templates for list view, field selection for table view
- **Integration**: Uses CollectionList for selection and CollectionForm for editing

## Use Cases
- Article tags management
- User-project assignments
- Product categories
- Permission roles
- Content relationships
                `
            }
        }
    },
    argTypes: {
        layout: {
            control: 'select',
            options: ['list', 'table'],
            description: 'Layout mode - list or table view'
        },
        tableSpacing: {
            control: 'select',
            options: ['compact', 'cozy', 'comfortable'],
            description: 'Table row spacing (only for table layout)'
        },
        enableCreate: {
            control: 'boolean',
            description: 'Show create new item button'
        },
        enableSelect: {
            control: 'boolean',
            description: 'Show select existing items button'
        },
        enableSearchFilter: {
            control: 'boolean',
            description: 'Show search input (table layout only)'
        },
        enableLink: {
            control: 'boolean',
            description: 'Show links to related items'
        },
        disabled: {
            control: 'boolean',
            description: 'Disable the interface'
        },
        required: {
            control: 'boolean',
            description: 'Mark as required field'
        },
        allowDuplicates: {
            control: 'boolean',
            description: 'Allow duplicate selections'
        },
        limit: {
            control: 'number',
            description: 'Items per page',
            min: 5,
            max: 100
        }
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for stories — shaped as M2MDisplayItem (junction rows with nested related data)
const mockArticleTags: M2MDisplayItem[] = [
    {
        id: 1,
        article_id: 1,
        tag_id: { id: 1, name: "React", color: "#61DAFB", slug: "react" },
        created_at: "2024-01-15T10:30:00Z"
    },
    {
        id: 2,
        article_id: 1,
        tag_id: { id: 2, name: "TypeScript", color: "#3178C6", slug: "typescript" },
        created_at: "2024-01-15T10:31:00Z"
    },
    {
        id: 3,
        article_id: 1,
        tag_id: { id: 3, name: "Mantine", color: "#339AF0", slug: "mantine" },
        created_at: "2024-01-15T10:32:00Z"
    }
];

const mockProjectMembers: M2MDisplayItem[] = [
    {
        id: 1,
        project_id: 1,
        user_id: { 
            id: 1, 
            name: "John Doe", 
            email: "john@example.com", 
            role: "Developer",
            avatar: null
        },
        role: "Lead Developer",
        permissions: ["read", "write", "admin"],
        joined_at: "2024-01-01T00:00:00Z"
    },
    {
        id: 2,
        project_id: 1,
        user_id: { 
            id: 2, 
            name: "Jane Smith", 
            email: "jane@example.com", 
            role: "Designer",
            avatar: null
        },
        role: "UI Designer",
        permissions: ["read", "write"],
        joined_at: "2024-01-02T00:00:00Z"
    },
    {
        id: 3,
        project_id: 1,
        user_id: { 
            id: 3, 
            name: "Bob Wilson", 
            email: "bob@example.com", 
            role: "Manager",
            avatar: null
        },
        role: "Project Manager",
        permissions: ["read", "write", "admin"],
        joined_at: "2024-01-03T00:00:00Z"
    }
];

/**
 * Default List M2M interface in list layout mode
 */
// Minimal mock relation info so the component can format display values
const mockTagRelationInfo = {
    junctionCollection: { collection: 'articles_tags', meta: {} },
    relatedCollection: { collection: 'tags', meta: {} },
    junctionField: { field: 'tag_id', collection: 'articles_tags' },
    reverseJunctionField: { field: 'article_id', collection: 'articles_tags' },
    junctionPrimaryKeyField: { field: 'id', collection: 'articles_tags' },
    relatedPrimaryKeyField: { field: 'id', collection: 'tags' },
    sortField: null,
    oneDeselect: 'nullify' as const,
};

const mockMembersRelationInfo = {
    junctionCollection: { collection: 'project_members', meta: {} },
    relatedCollection: { collection: 'users', meta: {} },
    junctionField: { field: 'user_id', collection: 'project_members' },
    reverseJunctionField: { field: 'project_id', collection: 'project_members' },
    junctionPrimaryKeyField: { field: 'id', collection: 'project_members' },
    relatedPrimaryKeyField: { field: 'id', collection: 'users' },
    sortField: null,
    oneDeselect: 'nullify' as const,
};

export const Default: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}} ({{color}})',
        enableCreate: true,
        enableSelect: true,
        enableLink: false,
        disabled: false,
        label: 'Article Tags',
        description: 'Tags associated with this article',
        limit: 15,
        onChange: (_value: any) => {
            // Value changed callback
        }
    }
};

/**
 * Table layout with multiple columns and search functionality
 */
export const TableLayout: Story = {
    args: {
        mockItems: mockProjectMembers,
        mockRelationInfo: mockMembersRelationInfo as any,
        collection: 'projects',
        field: 'members',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'email', 'role', 'joined_at'],
        enableCreate: true,
        enableSelect: true,
        enableSearchFilter: true,
        enableLink: true,
        disabled: false,
        label: 'Project Members',
        description: 'Users assigned to this project',
        tableSpacing: 'cozy',
        limit: 15,
        onChange: (_value: any) => {
            // Table value changed callback
        }
    }
};

/**
 * Compact table layout with minimal spacing
 */
export const CompactTable: Story = {
    args: {
        ...TableLayout.args,
        tableSpacing: 'compact',
        label: 'Compact Project Members',
        description: 'Compact table layout with minimal row spacing'
    }
};

/**
 * Comfortable table layout with more spacing
 */
export const ComfortableTable: Story = {
    args: {
        ...TableLayout.args,
        tableSpacing: 'comfortable',
        label: 'Comfortable Project Members',
        description: 'Comfortable table layout with generous row spacing'
    }
};

/**
 * Disabled state - read-only interface
 */
export const Disabled: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        disabled: true,
        label: 'Read-only Tags',
        description: 'These tags cannot be modified',
        enableCreate: false,
        enableSelect: false,
        onChange: (_value: any) => {
            // Value changed (disabled) callback
        }
    }
};

/**
 * Empty state with no items
 */
export const Empty: Story = {
    args: {
        mockItems: [],
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'categories',
        primaryKey: 1,
        layout: 'list',
        enableCreate: true,
        enableSelect: true,
        label: 'Article Categories',
        description: 'No categories assigned yet',
        onChange: (_value: any) => {
            // Empty value changed callback
        }
    }
};

/**
 * Required field with validation
 */
export const Required: Story = {
    args: {
        mockItems: [],
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'categories',
        primaryKey: 1,
        layout: 'list',
        enableCreate: true,
        enableSelect: true,
        required: true,
        label: 'Required Categories',
        description: 'At least one category must be selected',
        error: 'This field is required',
        onChange: (_value: any) => {
            // Required value changed callback
        }
    }
};

/**
 * Minimal configuration with defaults
 */
export const Minimal: Story = {
    args: {
        mockItems: [],
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'posts',
        field: 'tags',
        primaryKey: 1,
        onChange: (_value: any) => {
            // Minimal value changed callback
        }
    }
};

/**
 * With custom template formatting
 */
export const CustomTemplate: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '🏷️ {{name}} | {{slug}} | {{color}}',
        enableCreate: true,
        enableSelect: true,
        label: 'Tags with Custom Template',
        description: 'Using custom template with emojis and multiple fields',
        onChange: (_value: any) => {
            // Custom template value changed callback
        }
    }
};

/**
 * Large dataset with pagination
 */
export const WithPagination: Story = {
    args: {
        mockItems: [
            ...mockProjectMembers,
            ...Array.from({ length: 20 }, (_, i): M2MDisplayItem => ({
                id: i + 10,
                project_id: 1,
                user_id: { 
                    id: i + 10, 
                    name: `User ${i + 4}`, 
                    email: `user${i + 4}@example.com`, 
                    role: "Contributor"
                },
                role: "Contributor",
                permissions: ["read"],
                joined_at: `2024-01-${String(i + 4).padStart(2, '0')}T00:00:00Z`
            }))
        ],
        mockRelationInfo: mockMembersRelationInfo as any,
        collection: 'projects',
        field: 'members',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'email', 'role'],
        enableSearchFilter: true,
        label: 'Large Member List',
        description: 'Demonstrating pagination with many items',
        limit: 10,
        onChange: (_value: any) => {
            // Paginated value changed callback
        }
    }
};

/**
 * Error state
 */
export const WithError: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        label: 'Tags with Error',
        description: 'This field has a validation error',
        error: 'Invalid tag selection - duplicates not allowed',
        required: true,
        onChange: (_value: any) => {
            // Error state value changed callback
        }
    }
};

/**
 * All features enabled
 */
export const FullFeatured: Story = {
    args: {
        mockItems: mockProjectMembers,
        mockRelationInfo: mockMembersRelationInfo as any,
        collection: 'projects',
        field: 'members',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'email', 'role', 'permissions', 'joined_at'],
        enableCreate: true,
        enableSelect: true,
        enableSearchFilter: true,
        enableLink: true,
        tableSpacing: 'cozy',
        label: 'Full Featured Project Members',
        description: 'All features enabled - create, select, search, link, sort',
        required: false,
        allowDuplicates: false,
        limit: 15,
        onChange: (_value: any) => {
            // Full featured value changed callback
        }
    }
};

// ── Local-first state management stories ────────────────────────

/** Mock items with $type markers showing various change states */
const mockLocalFirstItems: M2MDisplayItem[] = [
    {
        id: 1,
        tag_id: { id: 1, name: "Unmodified Item", color: "#888" },
        // no $type → existing unmodified
    },
    {
        id: 2,
        $type: 'updated',
        $index: 0,
        tag_id: { id: 2, name: "Updated Item", color: "#FFA500" },
    },
    {
        id: '$new-0',
        $type: 'created',
        $index: 0,
        tag_id: { id: 99, name: "Created Item", color: "#00FF00" },
    },
];

/**
 * Demonstrates local-first state management with created, updated, and deleted items.
 */
export const LocalFirstStates: Story = {
    args: {
        mockItems: mockLocalFirstItems,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        enableCreate: true,
        enableSelect: true,
        label: 'Local-First States',
        description: 'Items with various change states (created, updated, unmodified)',
        onChange: (_value: any) => {},
    }
};

/**
 * Non-editable mode — items are visible but no action buttons shown.
 */
export const NonEditable: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        nonEditable: true,
        label: 'Non-Editable Tags',
        description: 'View-only mode — no add/edit/remove actions',
        onChange: (_value: any) => {},
    }
};

/**
 * Read-only mode
 */
export const ReadOnlyMode: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        readOnly: true,
        label: 'Read-Only Tags',
        description: 'Read-only mode — interface is non-interactive',
        onChange: (_value: any) => {},
    }
};

// ── P2: Drag-and-drop sorting stories ───────────────────────────

/** Mock relation with sortField enabled (enables DnD/sort) */
const mockSortableRelationInfo = {
    ...mockTagRelationInfo,
    sortField: 'sort_order',
};

/** Mock sortable items with sort_order values */
const mockSortableItems: M2MDisplayItem[] = [
    {
        id: 1,
        article_id: 1,
        sort_order: 1,
        tag_id: { id: 1, name: "First Item", color: "#61DAFB", slug: "first" },
    },
    {
        id: 2,
        article_id: 1,
        sort_order: 2,
        tag_id: { id: 2, name: "Second Item", color: "#3178C6", slug: "second" },
    },
    {
        id: 3,
        article_id: 1,
        sort_order: 3,
        tag_id: { id: 3, name: "Third Item", color: "#339AF0", slug: "third" },
    },
];

/**
 * Drag-and-drop sorting in list layout.
 * Items show a drag handle (grip icon) because sortField is set
 * and all items fit on one page (totalCount <= limit).
 */
export const DragAndDropList: Story = {
    args: {
        mockItems: mockSortableItems,
        mockRelationInfo: mockSortableRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}} ({{color}})',
        enableCreate: true,
        enableSelect: true,
        label: 'Drag & Drop List',
        description: 'Sortable items with drag handles — drag to reorder',
        limit: 15,
        onChange: (_value: any) => {},
    }
};

/**
 * Drag-and-drop sorting in table layout.
 * Shows drag handle column instead of up/down arrows when
 * all items fit on a single page.
 */
export const DragAndDropTable: Story = {
    args: {
        mockItems: mockSortableItems,
        mockRelationInfo: mockSortableRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'color', 'slug'],
        enableCreate: true,
        enableSelect: true,
        enableSearchFilter: true,
        label: 'Drag & Drop Table',
        description: 'Table layout with drag-and-drop sorting',
        limit: 15,
        onChange: (_value: any) => {},
    }
};

/**
 * Sort fallback: When items exceed the page limit, DnD is disabled
 * and up/down arrow buttons are shown instead.
 */
export const SortFallbackArrows: Story = {
    args: {
        mockItems: mockSortableItems,
        mockRelationInfo: mockSortableRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        enableCreate: true,
        enableSelect: true,
        label: 'Sort Fallback — Arrows',
        description: 'DnD is disabled when items exceed page size — shows up/down arrows instead',
        limit: 2, // limit < totalCount → arrows instead of DnD
        onChange: (_value: any) => {},
    }
};

// ── P2: Batch edit story ───────────────────────────────────────

/**
 * Batch edit mode in table layout.
 * Shows checkboxes for multi-selection and a batch edit button
 * appears when items are selected.
 */
export const BatchEditTable: Story = {
    args: {
        mockItems: mockProjectMembers,
        mockRelationInfo: mockMembersRelationInfo as any,
        collection: 'projects',
        field: 'members',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'email', 'role'],
        enableCreate: true,
        enableSelect: true,
        enableBatchEdit: true,
        label: 'Batch Edit Table',
        description: 'Table with multi-select checkboxes for batch editing',
        limit: 15,
        onChange: (_value: any) => {},
    }
};

// ── P2: i18n / translations story ───────────────────────────────

/**
 * Custom translations (i18n override).
 * Demonstrates overriding default English strings with custom labels.
 */
export const CustomTranslations: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        enableCreate: true,
        enableSelect: true,
        label: 'Étiquettes',
        description: 'Démonstration de la traduction i18n',
        translations: {
            create_new: 'Créer nouveau',
            add_existing: 'Ajouter existant',
            no_items: 'Aucun élément lié',
            edit: 'Modifier',
            remove: 'Supprimer',
            navigate_to_item: 'Ouvrir l\'élément',
            search_placeholder: 'Rechercher...',
            select_items: 'Sélectionner des éléments',
            add_selected: 'Ajouter la sélection',
            create_item: 'Créer un élément',
            edit_item: 'Modifier l\'élément',
            badge_new: 'NOUVEAU',
            badge_edited: 'MODIFIÉ',
            unsaved_changes: '(modifications non enregistrées)',
            item_count_one: '1 élément',
            item_count_other: '{count} éléments',
        },
        onChange: (_value: any) => {},
    }
};

// ── P2: Skeleton loading story ──────────────────────────────────

/**
 * Skeleton loading state — list layout.
 * This story cannot truly show the skeleton loading state in storybook
 * because mock mode bypasses loading. In a real app, skeleton placeholders
 * appear while data is being fetched from DaaS.
 */
export const SkeletonLoadingList: Story = {
    args: {
        mockItems: [],
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        label: 'Skeleton Loading (List)',
        description: 'Shows skeleton placeholders while loading. (In mock mode, you see the empty state instead.)',
        onChange: (_value: any) => {},
    }
};

/**
 * Skeleton loading state — table layout.
 */
export const SkeletonLoadingTable: Story = {
    args: {
        mockItems: [],
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'table',
        fields: ['name', 'color', 'slug'],
        label: 'Skeleton Loading (Table)',
        description: 'Shows skeleton rows while loading. (In mock mode, you see the empty state.)',
        onChange: (_value: any) => {},
    }
};

// ── P2: Version indicator story ─────────────────────────────────

/**
 * Content versioning indicator.
 * When a versionId is provided, a badge shows which version is being viewed.
 */
export const VersionedContent: Story = {
    args: {
        mockItems: mockArticleTags,
        mockRelationInfo: mockTagRelationInfo as any,
        collection: 'articles',
        field: 'tags',
        primaryKey: 1,
        layout: 'list',
        template: '{{name}}',
        versionId: 'draft-v2',
        enableCreate: true,
        enableSelect: true,
        label: 'Versioned Tags',
        description: 'Viewing a specific content version',
        onChange: (_value: any) => {},
    }
};

/**
 * Rendered without `CollectionsRelationalProvider` (the decorator opts out):
 * the field still lists and removes items, but shows the translated
 * missing-provider alert and hides create, select and edit.
 */
export const WithoutProvider: Story = {
    args: { ...Default.args, label: 'M2M without a relational provider' },
    parameters: {
        relationalUI: false,
        docs: {
            description: {
                story: 'No relational provider: the alert explains which components are missing and the create / select / edit actions are hidden. Switch the Locale toolbar to see the translations.',
            },
        },
    },
};

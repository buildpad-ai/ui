# @buildpad/ui-collections

Dynamic collection components for Buildpad projects. Includes CRUD forms, data tables, navigation, layouts, and filter builders — all inspired by DaaS's content module.

## Components

| Component | Description |
|-----------|-------------|
| `CollectionForm` | CRUD form with auto-field detection (uses VForm for 40+ interface types) |
| `CollectionList` | Dynamic table with pagination, search, selection, bulk actions |
| `ContentLayout` | Shell layout with sidebar navigation and main content area |
| `ContentNavigation` | Hierarchical sidebar navigation for collections |
| `FilterPanel` | Field-type-aware filter builder for collection queries |
| `SaveOptions` | Dropdown menu with save actions (save & stay, save & add new, etc.) |

## Architecture

```
CollectionForm (Data Layer)
    │
    ├── Fetches field definitions
    ├── Loads/saves item data
    ├── Handles CRUD operations
    │
    └──▶ VForm (Presentation Layer)
            │
            └──▶ ui-interfaces (40+ components)
                    ├── Input, Textarea, InputCode
                    ├── SelectDropdown, Tags, Color
                    ├── DateTime, Boolean, Toggle
                    ├── ListM2M, ListM2O, ListO2M
                    └── RichText, File, Map...
```

## Installation

```bash
pnpm add @buildpad/ui-collections
```

## Peer Dependencies

This package requires the following peer dependencies:

- `@mantine/core` ^8.0.0
- `@mantine/dates` ^8.0.0
- `@mantine/hooks` ^8.0.0
- `@buildpad/services` workspace:*
- `@buildpad/types` workspace:*
- `@buildpad/ui-form` workspace:*
- `@tabler/icons-react` ^3.0.0
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Usage

### CollectionForm

Dynamic form for creating/editing collection items:

```tsx
import { CollectionForm } from '@buildpad/ui-collections';

function CreateProduct() {
  return (
    <CollectionForm
      collection="products"
      mode="create"
      defaultValues={{ status: 'draft' }}
      onSuccess={(data) => console.log('Created:', data)}
      onCancel={() => console.log('Cancelled')}
      excludeFields={['internal_notes']}
    />
  );
}

function EditProduct({ productId }: { productId: string }) {
  return (
    <CollectionForm
      collection="products"
      id={productId}
      mode="edit"
      onSuccess={(data) => console.log('Updated:', data)}
    />
  );
}
```

### CollectionList

Dynamic list/table for displaying collection items:

```tsx
import { CollectionList } from '@buildpad/ui-collections';

function ProductList() {
  return (
    <CollectionList
      collection="products"
      enableSelection
      enableSearch
      fields={['name', 'status', 'price']}
      limit={25}
      filter={{ status: { _eq: 'published' } }}
      bulkActions={[
        {
          label: 'Delete',
          color: 'red',
          action: (ids) => handleBulkDelete(ids),
        },
      ]}
      onItemClick={(item) => router.push(`/products/${item.id}`)}
    />
  );
}
```

### ContentLayout

Shell layout providing sidebar navigation and main content area with header:

```tsx
import { ContentLayout, ContentNavigation } from '@buildpad/ui-collections';

function ContentModule() {
  const [currentCollection, setCurrentCollection] = useState('products');
  const collections = useCollections(); // From your data layer
  
  return (
    <ContentLayout
      title="Products"
      breadcrumbs={[
        { label: 'Content', href: '/content' },
        { label: 'Products' },
      ]}
      icon="box"
      actions={
        <Button onClick={() => router.push('/content/products/+')}>
          Create New
        </Button>
      }
      navigation={
        <ContentNavigation
          currentCollection={currentCollection}
          rootCollections={collections}
          onNavigate={setCurrentCollection}
          activeGroups={['system']}
          onToggleGroup={(id) => console.log('Toggle', id)}
          showSearch
        />
      }
    >
      {/* Main content area */}
      <CollectionList collection={currentCollection} />
    </ContentLayout>
  );
}
```

### ContentNavigation

Hierarchical sidebar navigation with search, grouping, and bookmarks:

```tsx
import { ContentNavigation } from '@buildpad/ui-collections';

function Sidebar() {
  const collections = useCollections(); // Build your tree structure
  
  return (
    <ContentNavigation
      currentCollection="products"
      rootCollections={collections}
      activeGroups={['content', 'system']}
      onToggleGroup={(id) => setExpandedGroups([...groups, id])}
      onNavigate={(collection) => router.push(`/content/${collection}`)}
      showSearch
      showHidden={false}
      onToggleHidden={() => setShowHidden(!showHidden)}
      hasHiddenCollections
      isAdmin
    />
  );
}
```

### FilterPanel

Build field-type-aware filters for collection queries:

```tsx
import { FilterPanel } from '@buildpad/ui-collections';

function ProductFilters() {
  const [filter, setFilter] = useState({});
  const fields = useFields('products'); // Fetch field definitions
  
  return (
    <FilterPanel
      collection="products"
      fields={fields}
      value={filter}
      onChange={setFilter}
      onApply={(filter) => {
        console.log('Apply filter:', filter);
        // Pass to CollectionList or use with apiRequest
      }}
      onClear={() => setFilter({})}
    />
  );
}

// Use with CollectionList
<CollectionList collection="products" filter={filter} />
```

### SaveOptions

Save action dropdown menu for forms:

```tsx
import { SaveOptions } from '@buildpad/ui-collections';

function FormActions() {
  return (
    <Group>
      <Button onClick={handleSave}>Save</Button>
      <SaveOptions
        onSaveAndStay={() => {
          handleSave();
          // Stay on current page
        }}
        onSaveAndAddNew={() => {
          handleSave();
          router.push('/products/+');
        }}
        onSaveAsCopy={() => {
          handleSaveAsCopy();
        }}
        onDiscardAndStay={() => {
          resetForm();
        }}
        disabledOptions={['save-as-copy']}
      />
    </Group>
  );
}
```

## API Reference

### CollectionFormProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `string` | required | Collection name |
| `id` | `string \| number` | - | Item ID for edit mode |
| `mode` | `'create' \| 'edit'` | `'create'` | Form mode |
| `defaultValues` | `Record<string, unknown>` | `{}` | Default values for new items |
| `onSuccess` | `(data?: Record<string, unknown>) => void` | - | Callback on successful save |
| `onCancel` | `() => void` | - | Callback on cancel |
| `excludeFields` | `string[]` | `[]` | Fields to exclude from form |
| `includeFields` | `string[]` | - | Fields to show (exclusive) |

### CollectionListProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `string` | required | Collection name to display |
| `enableSelection` | `boolean` | `false` | Enable row selection |
| `filter` | `Record<string, unknown>` | - | Filter to apply |
| `bulkActions` | `BulkAction[]` | `[]` | Bulk actions for selected items |
| `fields` | `string[]` | - | Fields to display (defaults to first 4 fields) |
| `limit` | `number` | `15` | Items per page |
| `enableSearch` | `boolean` | `true` | Enable search |
| `primaryKeyField` | `string` | `'id'` | Primary key field name |
| `onItemClick` | `(item: AnyItem) => void` | - | Callback when item is clicked |

### BulkAction

```typescript
interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  action: (selectedIds: (string | number)[]) => void | Promise<void>;
}
```

### ContentLayoutProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Page title |
| `icon` | `string \| ReactNode` | - | Page icon (Tabler icon name or component) |
| `breadcrumbs` | `BreadcrumbItem[]` | - | Breadcrumb navigation |
| `actions` | `ReactNode` | - | Header action buttons |
| `navigation` | `ReactNode` | - | Sidebar navigation component |
| `children` | `ReactNode` | required | Main content area |
| `loading` | `boolean` | `false` | Show loading skeleton |
| `sidebarDefaultOpened` | `boolean` | `true` | Sidebar initially opened |

### ContentNavigationProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentCollection` | `string` | - | Active collection |
| `rootCollections` | `CollectionTreeNode[]` | required | Collection tree structure |
| `activeGroups` | `string[]` | required | Expanded group IDs |
| `onToggleGroup` | `(id: string) => void` | required | Toggle group expand/collapse |
| `onNavigate` | `(collection: string) => void` | required | Navigate to collection |
| `showHidden` | `boolean` | `false` | Show hidden collections |
| `onToggleHidden` | `() => void` | - | Toggle hidden visibility |
| `hasHiddenCollections` | `boolean` | `false` | Whether hidden collections exist |
| `showSearch` | `boolean` | `false` | Enable search |
| `isAdmin` | `boolean` | `false` | User is admin |
| `bookmarks` | `Bookmark[]` | - | Collection bookmarks |
| `onBookmarkClick` | `(bookmark: Bookmark) => void` | - | Bookmark click handler |

### FilterPanelProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `string` | required | Collection name |
| `fields` | `Field[]` | required | Available fields for filtering |
| `value` | `object` | `{}` | Current filter value (DaaS format) |
| `onChange` | `(filter: object) => void` | - | Filter change callback |
| `onApply` | `(filter: object) => void` | - | Apply filter callback |
| `onClear` | `() => void` | - | Clear filter callback |

### SaveOptionsProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSaveAndStay` | `() => void` | - | Save and stay on current item |
| `onSaveAndAddNew` | `() => void` | - | Save and create new |
| `onSaveAsCopy` | `() => void` | - | Save as copy |
| `onDiscardAndStay` | `() => void` | - | Discard changes |
| `disabledOptions` | `SaveAction[]` | `[]` | Disabled save actions |
| `disabled` | `boolean` | `false` | Disable all options |
| `platform` | `'mac' \| 'win'` | auto-detect | Platform for keyboard shortcuts |

## Features

### CollectionForm Features

- **Auto-field Detection**: Automatically fetches field definitions from the API
- **VForm Integration**: Uses VForm for rendering, supporting all 40+ interface types:
  - Text fields → Input, Textarea, InputCode, RichText
  - Selection fields → SelectDropdown, SelectRadio, Tags, Color
  - Boolean fields → Toggle, Boolean
  - Date/DateTime fields → DateTime picker
  - Relational fields → ListM2M, ListM2O, ListO2M, ListM2A
  - Media fields → File, FileImage, Files, Upload
  - Layout fields → Divider, Notice, GroupDetail
- **System Field Handling**: Auto-excludes system fields (id, user_created, etc.)
- **Edit Mode**: Load existing item data when editing
- **Validation**: Built-in required field validation with error display
- **Loading States**: Shows loading overlay while fetching data
- **Error Handling**: Displays error messages on failure

### CollectionList Features

- **Dynamic Columns**: Auto-detects displayable fields
- **Pagination**: Built-in pagination with configurable page size
- **Search**: Full-text search across items
- **Row Selection**: Checkbox selection with select-all
- **Bulk Actions**: Configurable bulk action buttons
- **Filtering**: Apply custom filters to the query
- **Click Handling**: Row click callback for navigation
- **Loading States**: Shows loading overlay while fetching
- **Error Handling**: Displays error messages on failure

### ContentLayout Features

- **Responsive**: Sidebar collapses on mobile with burger menu
- **Breadcrumbs**: Hierarchical navigation trail
- **Header Actions**: Customizable action buttons in header
- **Loading States**: Skeleton loaders for header and content
- **Sidebar Navigation**: Dedicated slot for ContentNavigation

### ContentNavigation Features

- **Hierarchical Tree**: Display collections in nested groups
- **Search**: Filter collections by name
- **Hidden Collections**: Toggle visibility of hidden collections
- **Bookmarks**: Display collection bookmarks
- **Context Menus**: Right-click for collection settings (admin)
- **Icon Support**: Collection icons with color customization
- **Active State**: Highlight current collection

### FilterPanel Features

- **Field-Type Aware**: Operators adapt to field type (string, number, date, etc.)
- **Visual Builder**: Add/remove filter rules and groups
- **AND/OR Logic**: Support for complex filter combinations
- **DaaS Compatible**: Produces standard DaaS filter format
- **Type-Safe**: TypeScript types for filter values
- **Clear/Reset**: Clear all filters or individual rules

### SaveOptions Features

- **Multiple Actions**: Save & stay, save & add new, save as copy, discard
- **Keyboard Shortcuts**: Display platform-specific shortcuts (⌘S / Ctrl+S)
- **Disabled States**: Disable individual save actions
- **Icon Support**: Tabler icons for each action
- **Dropdown Menu**: Compact dropdown attached to primary save button

## Architecture

This package follows DaaS's content module pattern:

| DaaS | Buildpad |
|----------|------------|
| `v-form` component | `CollectionForm` |
| `v-list` component | `CollectionList` |
| `private-view` layout | `ContentLayout` |
| `navigation.vue` | `ContentNavigation` |
| `system-filter` interface | `FilterPanel` |
| `save-options.vue` | `SaveOptions` |

The components use:
- `@buildpad/services` for API calls (`FieldsService`, `CollectionsService`, `apiRequest`)
- `@buildpad/types` for type definitions (`Field`, `Collection`, `AnyItem`, `Filter`)
- `@buildpad/ui-form` for form rendering (`VForm` → 40+ interface types)
- Mantine v8 for UI components (AppShell, NavLink, Menu, etc.)

## Storybook

This package includes comprehensive Storybook documentation on port 6005:

```bash
# Run Storybook
pnpm storybook:collections

# Or from workspace root
pnpm --filter @buildpad/ui-collections storybook
```

**Available Stories:**
- **CollectionForm** - Basic and DaaS Playground stories
- **CollectionList** - Basic and DaaS Playground stories  
- **ContentLayout** - Layout variations and responsive behavior
- **ContentNavigation** - Tree structures, search, bookmarks
- **FilterPanel** - Filter building with various field types
- **SaveOptions** - Save action menu variations

**DaaS Playground:** Connect to a real DaaS instance to test with actual collections using the Storybook host app authentication proxy. See [QUICKSTART.md](../../QUICKSTART.md#daas-playground-with-storybook-host-recommended) for setup.

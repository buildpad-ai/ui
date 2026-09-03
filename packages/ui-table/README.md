# @buildpad/ui-table

Dynamic table component for Buildpad projects, inspired by the DaaS v-table component.

## Features

- **Dynamic Column Rendering**: Render columns based on schema configuration
- **Sorting**: Click column headers to sort (ascending/descending)
- **Column Resizing**: Drag column borders to resize
- **Column Reordering**: Drag-and-drop columns to reorder
- **Row Selection**: Single or multiple row selection modes
- **Manual Sort**: Drag-and-drop row reordering
- **Loading States**: Built-in loading skeleton and empty states
- **DaaS Integration**: Connect to Buildpad DaaS for real data

## Installation

```bash
pnpm add @buildpad/ui-table
```

## Usage

### Basic Usage

```tsx
import { VTable } from '@buildpad/ui-table';

const headers = [
  { text: 'Name', value: 'name' },
  { text: 'Email', value: 'email' },
  { text: 'Status', value: 'status' },
];

const items = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
];

function MyTable() {
  return (
    <VTable
      headers={headers}
      items={items}
      itemKey="id"
    />
  );
}
```

### With Selection

```tsx
import { VTable } from '@buildpad/ui-table';
import { useState } from 'react';

function SelectableTable() {
  const [selected, setSelected] = useState([]);

  return (
    <VTable
      headers={headers}
      items={items}
      showSelect="multiple"
      value={selected}
      onUpdate={setSelected}
    />
  );
}
```

### With Sorting

```tsx
import { VTable } from '@buildpad/ui-table';
import { useState } from 'react';

function SortableTable() {
  const [sort, setSort] = useState({ by: 'name', desc: false });

  return (
    <VTable
      headers={headers}
      items={items}
      sort={sort}
      onSortChange={setSort}
    />
  );
}
```

### DaaS Integration

```tsx
import { VTable } from '@buildpad/ui-table';
import { DaaSProvider } from '@buildpad/services';

function DaaSTable() {
  return (
    <DaaSProvider config={{ url: 'https://xxx.buildpad-daas.xtremax.com' }}>
      <VTable
        collection="products"
        showSelect="multiple"
      />
    </DaaSProvider>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `headers` | `HeaderRaw[]` | required | Column definitions |
| `items` | `Item[]` | required | Row data |
| `itemKey` | `string` | `'id'` | Unique key field for items |
| `sort` | `Sort \| null` | `null` | Current sort state |
| `showSelect` | `'none' \| 'one' \| 'multiple'` | `'none'` | Selection mode |
| `showResize` | `boolean` | `false` | Enable column resizing |
| `showManualSort` | `boolean` | `false` | Enable row drag-and-drop |
| `allowHeaderReorder` | `boolean` | `false` | Enable column reordering |
| `loading` | `boolean` | `false` | Show loading state |
| `loadingText` | `string` | dictionary `table.loading` | Loading state text |
| `noItemsText` | `string` | dictionary `table.noItems` | Empty state text |
| `translations` | `DeepPartial<TableTranslations>` | - | Per-instance overrides of the `table` dictionary namespace (prop > `BuildpadI18nProvider` > English defaults) |
| `disabled` | `boolean` | `false` | Disable interactions |
| `value` | `any[]` | `[]` | Selected items |
| `onUpdate` | `(value: any[]) => void` | - | Selection change handler |
| `onSortChange` | `(sort: Sort) => void` | - | Sort change handler |
| `onRowClick` | `(item: Item, event: MouseEvent) => void` | - | Row click handler |

## Types

```typescript
interface HeaderRaw {
  text: string;
  value: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: number | null;
  description?: string | null;
}

interface Item {
  [key: string]: any;
}

interface Sort {
  by: string | null;
  desc: boolean;
}
```

## Storybook

```bash
# Run Storybook for development
pnpm storybook

# Build static Storybook
pnpm build-storybook
```

## License

MIT

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react";
import {
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { VTable } from "./VTable";
import "./VTable.stories.css";
import type { Header, HeaderRaw, Item, Sort } from "./types";

/**
 * VTable - Dynamic Table Component
 *
 * The VTable component renders tabular data with powerful features like sorting,
 * selection, column resizing, and drag-and-drop row reordering.
 * Based on DaaS v-table component.
 *
 * ## Features
 * - Column sorting (click headers)
 * - Column resizing (drag borders)
 * - Column reordering (drag headers)
 * - Row selection (single/multiple)
 * - Row reordering (drag handles)
 * - Loading/empty states
 * - Custom cell rendering
 * - Fixed header on scroll
 */
const meta: Meta<typeof VTable> = {
  title: "Tables/VTable",
  component: VTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dynamic table component with sorting, selection, and drag-and-drop features.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    showSelect: {
      control: "select",
      options: ["none", "one", "multiple"],
      description: "Row selection mode",
    },
    loading: {
      control: "boolean",
      description: "Show loading state",
    },
    disabled: {
      control: "boolean",
      description: "Disable all interactions",
    },
    inline: {
      control: "boolean",
      description: "Add border around table",
    },
  },
};

export default meta;
type Story = StoryObj<typeof VTable>;

// ============================================================================
// Sample Data
// ============================================================================

const sampleHeaders: HeaderRaw[] = [
  { text: "Name", value: "name", width: 200 },
  { text: "Email", value: "email", width: 250 },
  { text: "Role", value: "role", width: 120 },
  { text: "Status", value: "status", width: 100 },
  { text: "Created", value: "created_at", width: 150 },
];

const sampleItems: Item[] = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "active",
    created_at: "2024-01-15",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Editor",
    status: "active",
    created_at: "2024-01-20",
  },
  {
    id: 3,
    name: "Bob Wilson",
    email: "bob@example.com",
    role: "Viewer",
    status: "inactive",
    created_at: "2024-02-01",
  },
  {
    id: 4,
    name: "Alice Brown",
    email: "alice@example.com",
    role: "Editor",
    status: "active",
    created_at: "2024-02-10",
  },
  {
    id: 5,
    name: "Charlie Davis",
    email: "charlie@example.com",
    role: "Viewer",
    status: "pending",
    created_at: "2024-02-15",
  },
];

const productHeaders: HeaderRaw[] = [
  { text: "Product", value: "name", width: 200 },
  { text: "SKU", value: "sku", width: 120 },
  { text: "Price", value: "price", align: "right", width: 100 },
  { text: "Stock", value: "stock", align: "right", width: 80 },
  { text: "Category", value: "category", width: 120 },
];

const productItems: Item[] = [
  {
    id: 1,
    name: "Wireless Mouse",
    sku: "WM-001",
    price: 29.99,
    stock: 150,
    category: "Electronics",
  },
  {
    id: 2,
    name: "USB-C Hub",
    sku: "UCH-002",
    price: 49.99,
    stock: 75,
    category: "Electronics",
  },
  {
    id: 3,
    name: "Mechanical Keyboard",
    sku: "MK-003",
    price: 129.99,
    stock: 30,
    category: "Electronics",
  },
  {
    id: 4,
    name: "Monitor Stand",
    sku: "MS-004",
    price: 39.99,
    stock: 200,
    category: "Accessories",
  },
  {
    id: 5,
    name: "Desk Lamp",
    sku: "DL-005",
    price: 24.99,
    stock: 100,
    category: "Office",
  },
];

// ============================================================================
// Stories
// ============================================================================

/**
 * Basic table with headers and items
 */
export const Basic: Story = {
  args: {
    headers: sampleHeaders,
    items: sampleItems,
    itemKey: "id",
  },
};

/**
 * Table with inline border styling
 */
export const InlineStyle: Story = {
  args: {
    headers: sampleHeaders,
    items: sampleItems,
    itemKey: "id",
    inline: true,
  },
};

/**
 * Table with column sorting
 */
export const WithSorting: Story = {
  render: () => {
    const [sort, setSort] = useState<Sort>({ by: "name", desc: false });

    // Sort items based on current sort state
    const sortedItems = [...sampleItems].sort((a, b) => {
      if (!sort.by) return 0;
      const aVal = String(a[sort.by] ?? "");
      const bVal = String(b[sort.by] ?? "");
      const cmp = aVal.localeCompare(bVal);
      return sort.desc ? -cmp : cmp;
    });

    return (
      <VTable
        headers={sampleHeaders}
        items={sortedItems}
        itemKey="id"
        sort={sort}
        onSortChange={(newSort) =>
          setSort(newSort ?? { by: null, desc: false })
        }
        inline
      />
    );
  },
};

/**
 * Table with multiple row selection
 */
export const WithMultipleSelection: Story = {
  render: () => {
    const [selected, setSelected] = useState<unknown[]>([]);

    return (
      <div>
        <p className="story-selection-info" role="status" aria-live="polite">
          Selected: {selected.length} items
          {selected.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setSelected([])}
              className="story-clear-btn"
            >
              Clear
            </Button>
          )}
        </p>
        <VTable
          headers={sampleHeaders}
          items={sampleItems}
          itemKey="id"
          showSelect="multiple"
          value={selected}
          onUpdate={setSelected}
          selectionUseKeys
          inline
        />
      </div>
    );
  },
};

/**
 * Table with single row selection (radio buttons)
 */
export const WithSingleSelection: Story = {
  render: () => {
    const [selected, setSelected] = useState<unknown[]>([]);

    return (
      <div>
        <p className="story-selection-info" role="status" aria-live="polite">
          Selected: {selected.length > 0 ? `ID ${selected[0]}` : "None"}
        </p>
        <VTable
          headers={sampleHeaders}
          items={sampleItems}
          itemKey="id"
          showSelect="one"
          value={selected}
          onUpdate={setSelected}
          selectionUseKeys
          inline
        />
      </div>
    );
  },
};

/**
 * Table with column resizing
 */
export const WithColumnResize: Story = {
  render: () => {
    const [headers, setHeaders] = useState<HeaderRaw[]>(sampleHeaders);

    return (
      <VTable
        headers={headers}
        items={sampleItems}
        itemKey="id"
        showResize
        onHeadersChange={setHeaders}
        inline
      />
    );
  },
};

/**
 * Table with manual row reordering
 */
export const WithManualSort: Story = {
  render: () => {
    const [items, setItems] = useState<Item[]>(productItems);
    const [sort, setSort] = useState<Sort>({ by: "sort", desc: false });

    return (
      <VTable
        headers={productHeaders}
        items={items}
        itemKey="id"
        showManualSort
        manualSortKey="sort"
        sort={sort}
        onSortChange={(s) => setSort(s ?? { by: null, desc: false })}
        onItemsChange={setItems}
        onManualSort={(e) => console.log("Manual sort:", e)}
        inline
      />
    );
  },
};

/**
 * Table with custom cell rendering
 */
export const WithCustomCells: Story = {
  render: () => {
    const headers: HeaderRaw[] = [
      { text: "Name", value: "name", width: 200 },
      { text: "Email", value: "email", width: 250 },
      { text: "Role", value: "role", width: 120 },
      { text: "Status", value: "status", width: 120 },
    ];

    const getStatusColor = (status: string) => {
      switch (status) {
        case "active":
          return "green";
        case "inactive":
          return "red";
        case "pending":
          return "yellow";
        default:
          return "gray";
      }
    };

    return (
      <VTable
        headers={headers}
        items={sampleItems}
        itemKey="id"
        renderCell={(item, header) => {
          if (header.value === "status") {
            return (
              <Badge
                color={getStatusColor(item.status as string)}
                variant="light"
              >
                {item.status as string}
              </Badge>
            );
          }
          if (header.value === "role") {
            return <Badge variant="outline">{item.role as string}</Badge>;
          }
          return null; // Use default rendering
        }}
        inline
      />
    );
  },
};

/**
 * Table with row actions
 */
export const WithRowActions: Story = {
  render: () => {
    return (
      <VTable
        headers={sampleHeaders}
        items={sampleItems}
        itemKey="id"
        renderRowAppend={(item) => (
          <Group gap="xs">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => alert(`View ${item.name}`)}
            >
              <IconEye size={16} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => alert(`Edit ${item.name}`)}
            >
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              onClick={() => alert(`Delete ${item.name}`)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
        inline
      />
    );
  },
};

/**
 * Table with clickable rows
 */
export const ClickableRows: Story = {
  render: () => {
    return (
      <VTable
        headers={sampleHeaders}
        items={sampleItems}
        itemKey="id"
        clickable
        onRowClick={({ item }) => alert(`Clicked: ${item.name}`)}
        inline
      />
    );
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    headers: sampleHeaders,
    items: [],
    itemKey: "id",
    loading: true,
    inline: true,
  },
};

/**
 * Loading state with existing data (overlay effect)
 */
export const LoadingWithData: Story = {
  args: {
    headers: sampleHeaders,
    items: sampleItems,
    itemKey: "id",
    loading: true,
    inline: true,
  },
};

/**
 * Empty state
 */
export const Empty: Story = {
  args: {
    headers: sampleHeaders,
    items: [],
    itemKey: "id",
    noItemsText: "No users found. Create your first user to get started.",
    inline: true,
  },
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    headers: sampleHeaders,
    items: sampleItems,
    itemKey: "id",
    disabled: true,
    showSelect: "multiple",
    inline: true,
  },
};

/**
 * Fixed header (scroll to see effect)
 */
export const FixedHeader: Story = {
  render: () => {
    // Generate more items for scrolling
    const manyItems: Item[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i % 3 === 0 ? "Admin" : i % 2 === 0 ? "Editor" : "Viewer",
      status: i % 4 === 0 ? "inactive" : "active",
      created_at: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(
        2,
        "0",
      )}`,
    }));

    return (
      <div className="story-scroll-container">
        <VTable
          headers={sampleHeaders}
          items={manyItems}
          itemKey="id"
          fixedHeader
          showSelect="multiple"
        />
      </div>
    );
  },
};

/**
 * Product table with different column alignments
 */
export const ProductTable: Story = {
  render: () => {
    const [sort, setSort] = useState<Sort>({ by: null, desc: false });

    return (
      <VTable
        headers={productHeaders}
        items={productItems}
        itemKey="id"
        sort={sort}
        onSortChange={(s) => setSort(s ?? { by: null, desc: false })}
        renderCell={(item, header) => {
          if (header.value === "price") {
            return <span>${(item.price as number).toFixed(2)}</span>;
          }
          if (header.value === "stock") {
            const stock = item.stock as number;
            return (
              <Badge
                color={stock < 50 ? "red" : stock < 100 ? "yellow" : "green"}
                variant="light"
              >
                {stock}
              </Badge>
            );
          }
          return null;
        }}
        inline
      />
    );
  },
};

/**
 * Full-featured table with all options enabled
 */
export const FullFeatured: Story = {
  render: () => {
    const [headers, setHeaders] = useState<HeaderRaw[]>(sampleHeaders);
    const [items, setItems] = useState<Item[]>(sampleItems);
    const [selected, setSelected] = useState<unknown[]>([]);
    const [sort, setSort] = useState<Sort>({ by: "name", desc: false });

    // Sort items
    const sortedItems = [...items].sort((a, b) => {
      if (!sort.by) return 0;
      const aVal = String(a[sort.by] ?? "");
      const bVal = String(b[sort.by] ?? "");
      const cmp = aVal.localeCompare(bVal);
      return sort.desc ? -cmp : cmp;
    });

    return (
      <div>
        <div className="story-toolbar">
          <span role="status" aria-live="polite">Selected: {selected.length} items</span>
          {selected.length > 0 && (
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => setSelected([])}
            >
              Clear Selection
            </Button>
          )}
        </div>
        <VTable
          headers={headers}
          items={sortedItems}
          itemKey="id"
          sort={sort}
          showSelect="multiple"
          showResize
          allowHeaderReorder
          value={selected}
          selectionUseKeys
          onUpdate={setSelected}
          onSortChange={(s) => setSort(s ?? { by: null, desc: false })}
          onHeadersChange={setHeaders}
          onItemsChange={setItems}
          onRowClick={({ item }) => console.log("Row clicked:", item)}
          renderRowAppend={(item) => (
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                alert(`Actions for ${item.name}`);
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          )}
          inline
        />
      </div>
    );
  },
};

// ============================================================================
// Additional coverage for recently-added and uncovered props
// ============================================================================

/**
 * Header append slot — renders custom content (e.g. "Add Field" button)
 * after the last header column. This is commonly used by CollectionList
 * to provide an inline "add field" button.
 */
export const WithHeaderAppend: Story = {
  render: () => {
    return (
      <VTable
        headers={sampleHeaders}
        items={sampleItems}
        itemKey="id"
        renderHeaderAppend={() => (
          <ActionIcon variant="subtle" color="gray" size="sm" title="Add field">
            <IconPlus size={16} />
          </ActionIcon>
        )}
        inline
      />
    );
  },
};

/**
 * Header context menu — renders a popup menu when right-clicking a column
 * header. Useful for sort, alignment, and visibility controls.
 */
export const WithHeaderContextMenu: Story = {
  render: () => {
    const [sort, setSort] = useState<Sort>({ by: null, desc: false });

    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Right-click any column header to see the context menu.
        </Text>
        <VTable
          headers={sampleHeaders}
          items={sampleItems}
          itemKey="id"
          sort={sort}
          onSortChange={(s) => setSort(s ?? { by: null, desc: false })}
          renderHeaderContextMenu={(header: Header) => (
            <Paper shadow="md" p="xs" withBorder style={{ minWidth: 180 }}>
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed" mb={4}>
                  {header.text}
                </Text>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  justify="flex-start"
                  leftSection={<IconSortAscending size={14} />}
                  onClick={() => setSort({ by: header.value, desc: false })}
                >
                  Sort ascending
                </Button>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  justify="flex-start"
                  leftSection={<IconSortDescending size={14} />}
                  onClick={() => setSort({ by: header.value, desc: true })}
                >
                  Sort descending
                </Button>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  justify="flex-start"
                  leftSection={<IconEyeOff size={14} />}
                  color="red"
                  onClick={() => alert(`Hide column: ${header.value}`)}
                >
                  Hide column
                </Button>
              </Stack>
            </Paper>
          )}
          inline
        />
      </Stack>
    );
  },
};

/**
 * Custom header rendering — replaces the default text with fully custom content.
 */
export const WithCustomHeaders: Story = {
  render: () => {
    return (
      <VTable
        headers={sampleHeaders}
        items={sampleItems}
        itemKey="id"
        renderHeader={(header: Header) => (
          <Group gap={4} wrap="nowrap">
            <Badge size="xs" variant="light" color="accent">
              {header.value}
            </Badge>
            <Text size="xs" fw={600} truncate>
              {header.text}
            </Text>
          </Group>
        )}
        inline
      />
    );
  },
};

/**
 * Footer slot — renders custom content below the table,
 * commonly used for pagination or summary rows.
 */
export const WithFooter: Story = {
  render: () => {
    return (
      <VTable
        headers={sampleHeaders}
        items={sampleItems}
        itemKey="id"
        renderFooter={() => (
          <Group
            justify="space-between"
            p="sm"
            style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
          >
            <Text size="sm" c="dimmed">
              Showing {sampleItems.length} of {sampleItems.length} items
            </Text>
            <Group gap="xs">
              <Button size="compact-xs" variant="default" disabled>
                Previous
              </Button>
              <Button size="compact-xs" variant="default" disabled>
                Next
              </Button>
            </Group>
          </Group>
        )}
        inline
      />
    );
  },
};

/**
 * Custom row height — larger rows for more visual weight.
 */
export const CustomRowHeight: Story = {
  args: {
    headers: sampleHeaders,
    items: sampleItems,
    itemKey: "id",
    rowHeight: 64,
    inline: true,
  },
};

/**
 * Must sort — at least one column must remain sorted at all times.
 * Clicking the active sort column toggles direction, never clears it.
 */
export const MustSort: Story = {
  render: () => {
    const [sort, setSort] = useState<Sort>({ by: "name", desc: false });

    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Sorting cannot be cleared — click the sorted column to toggle
          direction. Current: <strong>{sort.by}</strong> (
          {sort.desc ? "desc" : "asc"})
        </Text>
        <VTable
          headers={sampleHeaders}
          items={sampleItems}
          itemKey="id"
          sort={sort}
          mustSort
          onSortChange={(s) => setSort(s ?? { by: "name", desc: false })}
          inline
        />
      </Stack>
    );
  },
};

/**
 * Custom loading text.
 */
export const CustomLoadingText: Story = {
  args: {
    headers: sampleHeaders,
    items: [],
    itemKey: "id",
    loading: true,
    loadingText: "Fetching users from DaaS...",
    inline: true,
  },
};

/**
 * Item selected callback — fires each time a single item is toggled.
 * Useful for side effects like opening a detail panel.
 */
export const WithItemSelectedCallback: Story = {
  render: () => {
    const [selected, setSelected] = useState<unknown[]>([]);
    const [lastEvent, setLastEvent] = useState<string>("");

    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Last onItemSelected event: {lastEvent || "(none)"}
        </Text>
        <VTable
          headers={sampleHeaders}
          items={sampleItems}
          itemKey="id"
          showSelect="multiple"
          value={selected}
          selectionUseKeys
          onUpdate={setSelected}
          onItemSelected={({ value, item }) =>
            setLastEvent(`${value ? "Selected" : "Deselected"} → ${item.name}`)
          }
          inline
        />
      </Stack>
    );
  },
};

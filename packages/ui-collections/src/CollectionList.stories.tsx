// @ts-nocheck
import { Code, Paper, Stack, Text } from "@mantine/core";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { CollectionList } from "./CollectionList";

// ============================================================================
// Mock Data — stories work offline without a DaaS backend
// ============================================================================

const MOCK_FIELDS = [
  {
    field: "id",
    type: "integer",
    collection: "posts",
    meta: {
      id: 1,
      collection: "posts",
      field: "id",
      hidden: false,
      readonly: true,
    },
    schema: {
      name: "id",
      table: "posts",
      data_type: "integer",
      is_primary_key: true,
      is_nullable: false,
      is_unique: true,
      has_auto_increment: true,
    },
  },
  {
    field: "title",
    type: "string",
    collection: "posts",
    meta: {
      id: 2,
      collection: "posts",
      field: "title",
      hidden: false,
      readonly: false,
      note: "Title",
    },
    schema: {
      name: "title",
      table: "posts",
      data_type: "text",
      is_primary_key: false,
      is_nullable: false,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "status",
    type: "string",
    collection: "posts",
    meta: {
      id: 3,
      collection: "posts",
      field: "status",
      hidden: false,
      readonly: false,
      note: "Status",
    },
    schema: {
      name: "status",
      table: "posts",
      data_type: "text",
      is_primary_key: false,
      is_nullable: false,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "author",
    type: "string",
    collection: "posts",
    meta: {
      id: 4,
      collection: "posts",
      field: "author",
      hidden: false,
      readonly: false,
      note: "Author",
    },
    schema: {
      name: "author",
      table: "posts",
      data_type: "text",
      is_primary_key: false,
      is_nullable: true,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "category",
    type: "string",
    collection: "posts",
    meta: {
      id: 5,
      collection: "posts",
      field: "category",
      hidden: false,
      readonly: false,
      note: "Category",
    },
    schema: {
      name: "category",
      table: "posts",
      data_type: "text",
      is_primary_key: false,
      is_nullable: true,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "word_count",
    type: "integer",
    collection: "posts",
    meta: {
      id: 6,
      collection: "posts",
      field: "word_count",
      hidden: false,
      readonly: false,
      note: "Word Count",
    },
    schema: {
      name: "word_count",
      table: "posts",
      data_type: "integer",
      is_primary_key: false,
      is_nullable: true,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "published_at",
    type: "timestamp",
    collection: "posts",
    meta: {
      id: 7,
      collection: "posts",
      field: "published_at",
      hidden: false,
      readonly: false,
      note: "When the post was published",
    },
    schema: {
      name: "published_at",
      table: "posts",
      data_type: "timestamptz",
      is_primary_key: false,
      is_nullable: true,
      is_unique: false,
      has_auto_increment: false,
    },
  },
  {
    field: "featured",
    type: "boolean",
    collection: "posts",
    meta: {
      id: 8,
      collection: "posts",
      field: "featured",
      hidden: false,
      readonly: false,
      note: "Is this a featured post?",
    },
    schema: {
      name: "featured",
      table: "posts",
      data_type: "boolean",
      is_primary_key: false,
      is_nullable: false,
      is_unique: false,
      has_auto_increment: false,
    },
  },
];

const MOCK_ITEMS = [
  {
    id: 1,
    title: "Getting Started with Buildpad",
    status: "published",
    author: "Jane Smith",
    category: "Tutorial",
    word_count: 2400,
    published_at: "2025-06-01T10:30:00Z",
    featured: true,
  },
  {
    id: 2,
    title: "Building Dynamic Forms",
    status: "published",
    author: "John Doe",
    category: "Guide",
    word_count: 1800,
    published_at: "2025-06-10T14:00:00Z",
    featured: false,
  },
  {
    id: 3,
    title: "Advanced Table Patterns",
    status: "draft",
    author: "Alice Brown",
    category: "Tutorial",
    word_count: 3100,
    published_at: null,
    featured: false,
  },
  {
    id: 4,
    title: "Authentication & Permissions",
    status: "published",
    author: "Bob Wilson",
    category: "Security",
    word_count: 2200,
    published_at: "2025-07-01T09:00:00Z",
    featured: true,
  },
  {
    id: 5,
    title: "Relational Interfaces Guide",
    status: "review",
    author: "Charlie Davis",
    category: "Guide",
    word_count: 2750,
    published_at: null,
    featured: false,
  },
  {
    id: 6,
    title: "Deploying to Amplify",
    status: "published",
    author: "Jane Smith",
    category: "DevOps",
    word_count: 1600,
    published_at: "2025-07-15T16:30:00Z",
    featured: false,
  },
  {
    id: 7,
    title: "Custom Interface Components",
    status: "draft",
    author: "John Doe",
    category: "Advanced",
    word_count: 4200,
    published_at: null,
    featured: true,
  },
  {
    id: 8,
    title: "File Upload Patterns",
    status: "published",
    author: "Alice Brown",
    category: "Guide",
    word_count: 1950,
    published_at: "2025-08-01T11:00:00Z",
    featured: false,
  },
  {
    id: 9,
    title: "Workflow State Machines",
    status: "published",
    author: "Bob Wilson",
    category: "Advanced",
    word_count: 3600,
    published_at: "2025-08-15T08:45:00Z",
    featured: false,
  },
  {
    id: 10,
    title: "Multitenancy Best Practices",
    status: "review",
    author: "Charlie Davis",
    category: "Architecture",
    word_count: 2900,
    published_at: null,
    featured: true,
  },
];

/**
 * Decorator that intercepts fetch calls to /api/* and returns mock data
 * so the stories work without a running DaaS backend.
 * Supports pagination (limit/page), search, sort, and filter query params.
 * @param permissionsPayload - override the /api/permissions/me response data
 */
const createMockApiDecorator = (permissionsPayload: Record<string, unknown> = {}): Decorator => {
  const decorator: Decorator = (Story) => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url;

      // Mock permissions endpoint
      if (url.includes("/api/permissions/me")) {
        return new Response(JSON.stringify({ data: permissionsPayload }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

    // Mock fields endpoint
    if (url.includes("/api/fields/")) {
      return new Response(JSON.stringify({ data: MOCK_FIELDS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock items endpoint — with pagination, search, and sort support
    if (url.includes("/api/items/")) {
      const urlObj = new URL(url, window.location.origin);
      const params = urlObj.searchParams;
      let items = [...MOCK_ITEMS];

      // Search
      const searchTerm = params.get("search");
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        items = items.filter((item) =>
          Object.values(item).some(
            (v) => v !== null && String(v).toLowerCase().includes(lower),
          ),
        );
      }

      // Filter (basic support for _eq and _neq)
      const filterParam = params.get("filter");
      if (filterParam) {
        try {
          const filterObj = JSON.parse(filterParam);
          const applyFilter = (
            data: typeof MOCK_ITEMS,
            f: Record<string, unknown>,
          ): typeof MOCK_ITEMS => {
            if (f._and && Array.isArray(f._and)) {
              return (f._and as Record<string, unknown>[]).reduce(
                (acc, sub) => applyFilter(acc, sub),
                data,
              );
            }
            for (const [field, ops] of Object.entries(f)) {
              if (field.startsWith("_")) continue;
              if (typeof ops === "object" && ops !== null) {
                const opObj = ops as Record<string, unknown>;
                if ("_eq" in opObj) {
                  data = data.filter(
                    (item) =>
                      (item as Record<string, unknown>)[field] === opObj._eq,
                  );
                }
                if ("_neq" in opObj) {
                  data = data.filter(
                    (item) =>
                      (item as Record<string, unknown>)[field] !== opObj._neq,
                  );
                }
                if ("_contains" in opObj) {
                  data = data.filter((item) =>
                    String((item as Record<string, unknown>)[field] ?? "")
                      .toLowerCase()
                      .includes(String(opObj._contains).toLowerCase()),
                  );
                }
                if ("_gt" in opObj) {
                  data = data.filter(
                    (item) =>
                      Number((item as Record<string, unknown>)[field]) >
                      Number(opObj._gt),
                  );
                }
              }
            }
            return data;
          };
          items = applyFilter(items, filterObj);
        } catch {
          // Ignore invalid filter
        }
      }

      // Sort
      const sortParam = params.get("sort");
      if (sortParam) {
        const desc = sortParam.startsWith("-");
        const field = desc ? sortParam.slice(1) : sortParam;
        items.sort((a, b) => {
          const va = (a as Record<string, unknown>)[field];
          const vb = (b as Record<string, unknown>)[field];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          const cmp = String(va).localeCompare(String(vb), undefined, {
            numeric: true,
          });
          return desc ? -cmp : cmp;
        });
      }

      const totalCount = MOCK_ITEMS.length;
      const filterCount = items.length;

      // Pagination
      const limitVal = Number(params.get("limit")) || 25;
      const pageVal = Number(params.get("page")) || 1;
      const start = (pageVal - 1) * limitVal;
      const paged = items.slice(start, start + limitVal);

      return new Response(
        JSON.stringify({
          data: paged,
          meta: { total_count: totalCount, filter_count: filterCount },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return originalFetch(input, init);
  };

  React.useEffect(() => {
    return () => {
      window.fetch = originalFetch;
    };
  });

  return <Story />;
  };
  return decorator;
};

/** Default admin mock — empty access map → full access */
const withMockApi = createMockApiDecorator({});

/** Read-only mock — only read access, no create/update/delete */
const withReadOnlyPermissions = createMockApiDecorator({
  posts: {
    read: { fields: ["*"], permissions: {}, validation: null, presets: null },
  },
});

/** No-create mock — read + update + delete but NOT create */
const withNoCreatePermission = createMockApiDecorator({
  posts: {
    read: { fields: ["*"], permissions: {}, validation: null, presets: null },
    update: { fields: ["*"], permissions: {}, validation: null, presets: null },
    delete: { fields: ["*"], permissions: {}, validation: null, presets: null },
  },
});

/** Restricted fields mock — read limited to id, title, status only */
const withRestrictedFields = createMockApiDecorator({
  posts: {
    read: { fields: ["id", "title", "status"], permissions: {}, validation: null, presets: null },
    update: { fields: ["title", "status"], permissions: {}, validation: null, presets: null },
  },
});

// ============================================================================
// Meta
// ============================================================================

const meta = {
  title: "Collections/CollectionList",
  component: CollectionList,
  decorators: [withMockApi],
  tags: ["!autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A data-connected list that composes VTable for sorting, resize, reorder, and selection. " +
          "Features an integrated FilterPanel, action toolbar with create button, " +
          "and DaaS-style pagination. Right-click column headers for sort, align, and hide options. " +
          "These stories use mock data. For live DaaS data, use the **Playground** story.",
      },
    },
  },
  argTypes: {
    collection: { control: "text", description: "Collection name to display" },
    enableSelection: { control: "boolean" },
    enableSearch: { control: "boolean" },
    enableFilter: { control: "boolean" },
    enableSort: { control: "boolean" },
    enableResize: { control: "boolean" },
    enableReorder: { control: "boolean" },
    enableHeaderMenu: { control: "boolean" },
    enableAddField: { control: "boolean" },
    enableCreate: { control: "boolean" },
    limit: { control: "number", description: "Items per page" },
    tableSpacing: {
      control: "select",
      options: ["compact", "cozy", "comfortable"],
    },
  },
} satisfies Meta<typeof CollectionList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default list displaying collection items with VTable.
 * Supports sorting, column resize, and reorder out of the box.
 * Right-click a column header for sort/align/hide options.
 */
export const Default: Story = {
  args: {
    collection: "posts",
    enableSearch: true,
    enableSort: true,
    enableResize: true,
    enableReorder: true,
    enableHeaderMenu: true,
    enableAddField: true,
    limit: 25,
    tableSpacing: "cozy",
  },
};

/**
 * With row selection enabled for bulk actions.
 */
export const WithSelection: Story = {
  args: {
    collection: "posts",
    enableSelection: true,
    enableSearch: true,
    limit: 25,
    bulkActions: [
      {
        label: "Delete",
        color: "red",
        action: (ids) => alert(`Delete: ${ids.join(", ")}`),
      },
      {
        label: "Archive",
        action: (ids) => alert(`Archive: ${ids.join(", ")}`),
      },
    ],
  },
};

/**
 * Compact spacing with limited columns.
 */
export const CompactSpacing: Story = {
  args: {
    collection: "posts",
    tableSpacing: "compact",
    fields: ["id", "title", "status"],
    limit: 25,
  },
};

/**
 * Comfortable spacing for touch-friendly interfaces.
 */
export const ComfortableSpacing: Story = {
  args: {
    collection: "posts",
    tableSpacing: "comfortable",
    limit: 25,
  },
};

/**
 * With all interactive features disabled.
 */
export const ReadOnly: Story = {
  args: {
    collection: "posts",
    enableSort: false,
    enableResize: false,
    enableReorder: false,
    enableHeaderMenu: false,
    enableAddField: false,
    enableSearch: false,
    enableSelection: false,
    limit: 25,
  },
};

/**
 * With a DaaS-style filter applied.
 * Only items matching the filter are shown (mock data ignores the filter,
 * but the prop is passed through correctly to the API layer).
 */
export const WithFilter: Story = {
  args: {
    collection: "posts",
    filter: {
      _and: [{ status: { _eq: "published" } }, { word_count: { _gt: 2000 } }],
    },
    enableSearch: true,
    limit: 25,
  },
};

/**
 * Item click callback — fires when a row is clicked.
 * The clicked item data is displayed below the table.
 */
export const WithItemClick: Story = {
  render: () => {
    const [clicked, setClicked] = useState<Record<string, unknown> | null>(
      null,
    );

    return (
      <Stack gap="md">
        <CollectionList
          collection="posts"
          enableSearch
          limit={25}
          onItemClick={(item) => setClicked(item as Record<string, unknown>)}
        />
        <Paper p="sm" withBorder>
          <Text size="sm" fw={600} mb={4}>
            Last clicked item:
          </Text>
          <Code block style={{ maxHeight: 120, overflow: "auto" }}>
            {clicked ? JSON.stringify(clicked, null, 2) : "(click a row)"}
          </Code>
        </Paper>
      </Stack>
    );
  },
};

/**
 * Custom row height — override the spacing preset with an explicit pixel value.
 */
export const CustomRowHeight: Story = {
  args: {
    collection: "posts",
    rowHeight: 64,
    limit: 25,
  },
};

/**
 * Specific fields — display only a subset of columns.
 */
export const SpecificFields: Story = {
  args: {
    collection: "posts",
    fields: ["id", "title", "author", "published_at"],
    enableSort: true,
    enableResize: true,
    limit: 25,
  },
};

/**
 * With archive filter — shows a dropdown to filter by archive status.
 * Uses the `status` field as the archive field.
 */
export const WithArchiveFilter: Story = {
  args: {
    collection: "posts",
    archiveField: "status",
    archiveValue: "archived",
    enableSearch: true,
    limit: 25,
  },
};

/**
 * Type-aware cell rendering — boolean, timestamp, integer fields
 * render with proper formatting instead of raw text.
 */
export const TypeAwareRendering: Story = {
  args: {
    collection: "posts",
    fields: ["id", "title", "featured", "word_count", "published_at"],
    enableSort: true,
    limit: 25,
  },
};

/**
 * With inline FilterPanel — toggle the filter drawer from the toolbar.
 * Filter badge shows the number of active rules.
 */
export const WithFilterPanel: Story = {
  args: {
    collection: "posts",
    enableFilter: true,
    enableSearch: true,
    enableSelection: true,
    limit: 25,
  },
};

/**
 * With a Create button in the toolbar.
 * Clicking the button fires the `onCreate` callback.
 */
export const WithCreateButton: Story = {
  render: () => {
    const [count, setCount] = useState(0);
    return (
      <Stack gap="md">
        <CollectionList
          collection="posts"
          enableCreate
          enableSearch
          onCreate={() => setCount((c) => c + 1)}
          limit={25}
        />
        <Paper p="sm" withBorder>
          <Text size="sm">
            Create button clicked <strong>{count}</strong> time(s).
          </Text>
        </Paper>
      </Stack>
    );
  },
};

/**
 * Full-featured list matching the DaaS content module layout:
 * search, filter panel, selection with bulk actions, create button,
 * archive filter, and column management.
 */
export const FullFeatured: Story = {
  args: {
    collection: "posts",
    enableSearch: true,
    enableFilter: true,
    enableSelection: true,
    enableCreate: true,
    enableSort: true,
    enableResize: true,
    enableReorder: true,
    enableHeaderMenu: true,
    enableAddField: true,
    archiveField: "status",
    archiveValue: "archived",
    limit: 25,
    tableSpacing: "cozy",
    onCreate: () => alert("Create new item"),
    bulkActions: [
      {
        label: "Delete",
        color: "red",
        action: (ids) => alert(`Delete: ${ids.join(", ")}`),
      },
      {
        label: "Archive",
        action: (ids) => alert(`Archive: ${ids.join(", ")}`),
      },
    ],
  },
};

// ============================================================================
// Permission-Aware Stories
// ============================================================================

/**
 * No create permission — create button is rendered but disabled
 * with a "Not allowed" tooltip. Demonstrates DaaS-style permission gating.
 */
export const NoCreatePermission: Story = {
  decorators: [withNoCreatePermission],
  args: {
    collection: "posts",
    enableCreate: true,
    enableSearch: true,
    enableSelection: true,
    onCreate: () => alert("Should not fire"),
    limit: 25,
    bulkActions: [
      {
        label: "Delete",
        color: "red",
        requiredPermission: "delete",
        action: (ids) => alert(`Delete: ${ids.join(", ")}`),
      },
      {
        label: "Archive",
        requiredPermission: "update",
        action: (ids) => alert(`Archive: ${ids.join(", ")}`),
      },
    ],
  },
};

/**
 * Read-only permissions — no create, update, or delete.
 * Create button is disabled. All bulk actions with requiredPermission are disabled.
 */
export const ReadOnlyPermissions: Story = {
  decorators: [withReadOnlyPermissions],
  args: {
    collection: "posts",
    enableCreate: true,
    enableSearch: true,
    enableSelection: true,
    onCreate: () => alert("Should not fire"),
    limit: 25,
    bulkActions: [
      {
        label: "Delete",
        color: "red",
        requiredPermission: "delete",
        action: (ids) => alert(`Delete: ${ids.join(", ")}`),
      },
      {
        label: "Archive",
        requiredPermission: "update",
        action: (ids) => alert(`Archive: ${ids.join(", ")}`),
      },
      {
        label: "Export",
        action: (ids) => alert(`Export: ${ids.join(", ")}`),
      },
    ],
  },
};

/**
 * Restricted field access — only id, title, and status columns are visible.
 * Demonstrates field-level read permissions filtering displayed columns.
 */
export const RestrictedFields: Story = {
  decorators: [withRestrictedFields],
  args: {
    collection: "posts",
    enableSearch: true,
    enableCreate: false,
    limit: 25,
  },
};

// ============================================================================
// CRUD Stories
// ============================================================================

/**
 * Decorator that supports DELETE requests for CRUD stories.
 */
const createCrudApiDecorator = (): Decorator => {
  const decorator: Decorator = (Story) => {
    const originalFetch = window.fetch;
    let mockItems = [...MOCK_ITEMS];

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url;

      // Mock permissions — full CRUD access
      if (url.includes("/api/permissions/me")) {
        return new Response(
          JSON.stringify({
            data: {
              posts: {
                read: { fields: ["*"] },
                create: { fields: ["*"] },
                update: { fields: ["*"] },
                delete: { fields: ["*"] },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/api/fields/")) {
        return new Response(JSON.stringify({ data: MOCK_FIELDS }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // DELETE single or bulk
      if (url.includes("/api/items/") && init?.method === "DELETE") {
        const idMatch = url.match(/\/api\/items\/\w+\/(\d+)/);
        if (idMatch) {
          mockItems = mockItems.filter((item) => item.id !== Number(idMatch[1]));
        } else if (init.body) {
          const ids = JSON.parse(init.body as string) as number[];
          mockItems = mockItems.filter((item) => !ids.includes(item.id));
        }
        return new Response(JSON.stringify({}), {
          status: 204,
          headers: { "Content-Type": "application/json" },
        });
      }

      // LIST items
      if (url.includes("/api/items/")) {
        const urlObj = new URL(url, window.location.origin);
        const params = urlObj.searchParams;
        let items = [...mockItems];

        // Search
        const searchTerm = params.get("search");
        if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          items = items.filter((item) =>
            Object.values(item).some(
              (v) => v !== null && String(v).toLowerCase().includes(lower),
            ),
          );
        }

        // Sort
        const sortParam = params.get("sort");
        if (sortParam) {
          const desc = sortParam.startsWith("-");
          const field = desc ? sortParam.slice(1) : sortParam;
          items.sort((a, b) => {
            const va = (a as Record<string, unknown>)[field];
            const vb = (b as Record<string, unknown>)[field];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
            return desc ? -cmp : cmp;
          });
        }

        const totalCount = mockItems.length;
        const filterCount = items.length;
        const limitVal = Number(params.get("limit")) || 25;
        const pageVal = Number(params.get("page")) || 1;
        const start = (pageVal - 1) * limitVal;
        const paged = items.slice(start, start + limitVal);

        return new Response(
          JSON.stringify({
            data: paged,
            meta: { total_count: totalCount, filter_count: filterCount },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    };

    React.useEffect(() => {
      return () => {
        window.fetch = originalFetch;
      };
    });

    return <Story />;
  };
  return decorator;
};

/**
 * Full CRUD list — select items and delete them with a confirmation dialog.
 * Uses built-in delete functionality with `enableDelete`.
 */
export const WithBuiltInDelete: Story = {
  decorators: [createCrudApiDecorator()],
  render: () => {
    const [log, setLog] = useState<string[]>([]);
    const addLog = (msg: string) =>
      setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

    return (
      <Stack gap="md">
        <CollectionList
          collection="posts"
          enableSelection
          enableDelete
          enableCreate
          enableSearch
          enableFilter
          limit={25}
          onCreate={() => addLog("Create button clicked")}
          onEdit={(item) => addLog(`Edit: ${(item as Record<string, unknown>).title}`)}
          onDeleteSuccess={(ids) => addLog(`Deleted items: ${ids.join(", ")}`)}
          onItemClick={(item) => addLog(`Clicked: ${(item as Record<string, unknown>).title}`)}
        />
        <Paper p="sm" withBorder mah={150} style={{ overflow: "auto" }}>
          <Text size="sm" fw={600} mb="xs">Event Log</Text>
          {log.length === 0 ? (
            <Text size="xs" c="dimmed">No events yet — try selecting items and deleting them</Text>
          ) : (
            log.map((entry, i) => (
              <Text key={i} size="xs" c="dimmed">{entry}</Text>
            ))
          )}
        </Paper>
      </Stack>
    );
  },
};

/**
 * Full CRUD demo — matches a complete content management interface.
 * Search, filter, select, delete, create, and column management.
 */
export const FullCrud: Story = {
  decorators: [createCrudApiDecorator()],
  args: {
    collection: "posts",
    enableSearch: true,
    enableFilter: true,
    enableSelection: true,
    enableCreate: true,
    enableDelete: true,
    enableSort: true,
    enableResize: true,
    enableReorder: true,
    enableHeaderMenu: true,
    enableAddField: true,
    limit: 25,
    tableSpacing: "cozy",
    onCreate: () => alert("Navigate to create form"),
    onDeleteSuccess: (ids) => alert(`Deleted: ${ids.join(", ")}`),
  },
};

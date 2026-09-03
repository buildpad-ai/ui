/**
 * CollectionList Component Tests
 *
 * Tests rendering, data fetching, delete flow, search, pagination,
 * and permission enforcement.
 * Mocks @buildpad/services, @buildpad/ui-form, @buildpad/ui-table, and FilterPanel.
 */

import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MantineProvider } from "@mantine/core";

// -------------------------------------------------------------------
// Service mocks — use vi.hoisted so they are available in vi.mock factories
// -------------------------------------------------------------------
const {
  mockFieldsReadAll,
  mockPermissionsGetAccess,
  mockItemsDeleteMany,
  mockApiRequest,
} = vi.hoisted(() => ({
  mockFieldsReadAll: vi.fn(),
  mockPermissionsGetAccess: vi.fn(),
  mockItemsDeleteMany: vi.fn(),
  mockApiRequest: vi.fn(),
}));

vi.mock("@buildpad/services", async (importOriginal) => ({
  // Keep the real i18n hooks (they fall back to the English defaults without a
  // provider); only the data services are replaced.
  ...(await importOriginal<typeof import("@buildpad/services")>()),
  FieldsService: vi.fn().mockImplementation(() => ({
    readAll: mockFieldsReadAll,
  })),
  ItemsService: vi.fn().mockImplementation(() => ({
    deleteMany: mockItemsDeleteMany,
    readByQuery: vi.fn(),
  })),
  PermissionsService: {
    getMyCollectionAccess: mockPermissionsGetAccess,
  },
  apiRequest: mockApiRequest,
}));

// Mock VTable to render items as a simple table
vi.mock("@buildpad/ui-table", () => ({
  VTable: vi.fn(({
    items,
    headers,
    loading,
    showSelect,
    value,
    onUpdate,
    onRowClick,
    renderFooter,
    noItemsText,
    renderCell,
  }: {
    items: Array<Record<string, unknown>>;
    headers: Array<{ text: string; value: string }>;
    loading: boolean;
    showSelect?: string;
    value?: unknown[];
    onUpdate?: (items: unknown[]) => void;
    onRowClick?: (args: { item: Record<string, unknown> }) => void;
    renderFooter?: () => React.ReactNode;
    noItemsText?: string;
    renderCell?: (item: Record<string, unknown>, header: any) => React.ReactNode;
  }) => (
    <div data-testid="vtable-mock">
      {loading && <div data-testid="vtable-loading">Loading...</div>}
      {!loading && items.length === 0 && (
        <div data-testid="vtable-empty">{noItemsText || "No items"}</div>
      )}
      <table>
        <thead>
          <tr>
            {showSelect === "multiple" && <th>Select</th>}
            {headers.map((h) => (
              <th key={h.value}>{h.text}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={i}
              data-testid={`vtable-row-${i}`}
              onClick={() => onRowClick?.({ item })}
            >
              {showSelect === "multiple" && (
                <td>
                  <input
                    type="checkbox"
                    data-testid={`vtable-select-${i}`}
                    onChange={(e) => {
                      if (!onUpdate) return;
                      const current = (value || []) as Record<string, unknown>[];
                      if (e.target.checked) {
                        onUpdate([...current, item]);
                      } else {
                        onUpdate(current.filter((v) => v !== item));
                      }
                    }}
                  />
                </td>
              )}
              {headers.map((h) => {
                const cellContent = renderCell ? renderCell(item, h) : null;
                return (
                  <td key={h.value} data-testid={`cell-${i}-${h.value}`}>
                    {cellContent !== null && cellContent !== undefined ? cellContent : String(item[h.value] ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {renderFooter?.()}
    </div>
  )),
}));

// Mock FilterPanel to a no-op
vi.mock("../src/FilterPanel", () => ({
  FilterPanel: () => <div data-testid="filter-panel-mock" />,
}));

// Import component under test AFTER mocks
import { CollectionList } from "../src/CollectionList";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const SAMPLE_FIELDS = [
  { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
  { field: "title", type: "string", meta: { interface: "input", sort: 1, hidden: false } },
  { field: "status", type: "string", meta: { interface: "select-dropdown", sort: 2, hidden: false } },
  { field: "body", type: "text", meta: { interface: "input-multiline", sort: 3, hidden: false } },
];

const SAMPLE_ITEMS = {
  data: [
    { id: 1, title: "Post 1", status: "published", body: "Body 1" },
    { id: 2, title: "Post 2", status: "draft", body: "Body 2" },
    { id: 3, title: "Post 3", status: "published", body: "Body 3" },
  ],
  meta: { page: 1, limit: 25, total: 3 },
};

/** Aggregate count response matching DaaS format */
function makeCountResponse(count: number) {
  return { data: [{ count: { id: count } }] };
}

function setupDefaultMocks() {
  mockFieldsReadAll.mockResolvedValue(SAMPLE_FIELDS);
  mockPermissionsGetAccess.mockResolvedValue({});
  // apiRequest is called for items fetch AND aggregate count queries.
  // Route by URL: aggregate queries contain "aggregate", items queries don't.
  mockApiRequest.mockImplementation((url: string) => {
    if (url.includes("aggregate")) {
      return Promise.resolve(makeCountResponse(3));
    }
    return Promise.resolve(SAMPLE_ITEMS);
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

function renderList(props: Partial<React.ComponentProps<typeof CollectionList>> = {}) {
  return render(
    <CollectionList collection="posts" {...props} />,
    { wrapper },
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("CollectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // =====================================================================
  // Rendering
  // =====================================================================
  describe("rendering", () => {
    it("renders VTable with items after loading", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("vtable-mock")).toBeInTheDocument();
      });

      // Items should be rendered
      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toHaveTextContent("Post 1");
      });
    });

    it("shows error when fields fail to load", async () => {
      mockFieldsReadAll.mockRejectedValueOnce(new Error("Connection failed"));

      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-error")).toBeInTheDocument();
      });
    });

  });

  // =====================================================================
  // Search
  // =====================================================================
  describe("search", () => {
    it("renders search input when enableSearch is true", async () => {
      renderList({ enableSearch: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-search")).toBeInTheDocument();
      });
    });

    it("triggers data reload when search value changes", async () => {
      renderList({ enableSearch: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-search")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await userEvent.type(searchInput, "hello");

      // apiRequest should be called again with search param
      await waitFor(() => {
        const lastCall = mockApiRequest.mock.calls[mockApiRequest.mock.calls.length - 1];
        expect(lastCall?.[0]).toContain("search=hello");
      });
    });
  });

  // =====================================================================
  // Create button
  // =====================================================================
  describe("create button", () => {
    it("shows create button when enableCreate and onCreate are provided", async () => {
      const onCreate = vi.fn();
      renderList({ enableCreate: true, onCreate });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });
    });

    it("calls onCreate when create button is clicked", async () => {
      const onCreate = vi.fn();
      renderList({ enableCreate: true, onCreate });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("collection-list-create"));
      expect(onCreate).toHaveBeenCalled();
    });
  });

  // =====================================================================
  // Selection & Bulk Delete
  // =====================================================================
  describe("selection and bulk delete", () => {
    it("shows bulk actions with delete when items are selected", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select the first item
      const checkbox = screen.getByTestId("vtable-select-0");
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
      });

      expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
    });

    it("opens delete confirmation modal when bulk delete is clicked", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      });

      // Click delete
      await userEvent.click(screen.getByTestId("bulk-action-delete"));

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it("calls ItemsService.deleteMany and refreshes when confirmed", async () => {
      mockItemsDeleteMany.mockResolvedValueOnce(undefined);
      const onDeleteSuccess = vi.fn();

      renderList({
        enableSelection: true,
        enableDelete: true,
        onDeleteSuccess,
      });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("bulk-action-delete"));

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirm-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("delete-confirm-btn"));

      await waitFor(() => {
        expect(mockItemsDeleteMany).toHaveBeenCalled();
      });
    });

    it("shows selected count badge", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Refresh
  // =====================================================================
  describe("refresh", () => {
    it("reloads items when refresh button is clicked", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-refresh")).toBeInTheDocument();
      });

      const callsBefore = mockApiRequest.mock.calls.length;
      await userEvent.click(screen.getByTestId("collection-list-refresh"));

      await waitFor(() => {
        expect(mockApiRequest.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });

  // =====================================================================
  // Permissions
  // =====================================================================
  describe("permissions", () => {
    it("does not show create button when createAllowed is false", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          // no create key = not allowed
        },
      });

      renderList({ enableCreate: true, onCreate: vi.fn() });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });

      // Create button should be disabled
      expect(screen.getByTestId("collection-list-create")).toBeDisabled();
    });

    it("disables bulk delete when deleteAllowed is false", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          create: { fields: ["*"] },
          update: { fields: ["*"] },
          // no delete key
        },
      });

      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
      });

      // Bulk delete should be present but disabled because deleteAllowed is false
      expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      expect(screen.getByTestId("bulk-action-delete")).toBeDisabled();
    });

    it("disables bulk action buttons based on requiredPermission", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          // no create, update, or delete permissions
        },
      });

      const bulkActions = [
        {
          label: "Delete All",
          color: "red",
          requiredPermission: "delete" as const,
          action: vi.fn(),
        },
        {
          label: "Archive",
          requiredPermission: "update" as const,
          action: vi.fn(),
        },
        {
          label: "Export",
          action: vi.fn(),
        },
      ];

      renderList({ enableSelection: true, bulkActions });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
      });

      // Delete All (requiredPermission: delete) - should be disabled
      expect(screen.getByTestId("bulk-action-0")).toBeDisabled();

      // Archive (requiredPermission: update) - should be disabled
      expect(screen.getByTestId("bulk-action-1")).toBeDisabled();

      // Export (no requiredPermission) - should be enabled
      expect(screen.getByTestId("bulk-action-2")).toBeEnabled();
    });
  });

  // =====================================================================
  // Action Button Labels
  // =====================================================================
  describe("action button labels", () => {
    it("create button shows icon and label text", async () => {
      const onCreate = vi.fn();
      renderList({ enableCreate: true, onCreate });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });

      // Button should contain text "Create item"
      expect(screen.getByTestId("collection-list-create")).toHaveTextContent("Create item");
    });

    it("bulk delete button shows icon and label text", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      });

      // Button should contain text "Delete"
      expect(screen.getByTestId("bulk-action-delete")).toHaveTextContent("Delete");
    });

    it("custom bulk action buttons show labels", async () => {
      const bulkActions = [
        {
          label: "Archive",
          requiredPermission: "update" as const,
          action: vi.fn(),
        },
      ];

      renderList({ enableSelection: true, bulkActions });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-0")).toBeInTheDocument();
      });

      // Button should contain text "Archive"
      expect(screen.getByTestId("bulk-action-0")).toHaveTextContent("Archive");
    });
  });

  // =====================================================================
  // Pagination (inside VTable footer)
  // =====================================================================
  describe("pagination", () => {
    it("shows pagination when there are multiple pages", async () => {
      // Return enough items to require pagination (more than 25)
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) {
          return Promise.resolve(makeCountResponse(50));
        }
        return Promise.resolve({
          data: Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            title: `Post ${i + 1}`,
            status: "published",
          })),
          meta: { page: 1, limit: 25, total: 50 },
        });
      });

      renderList({ limit: 25 });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-footer")).toBeInTheDocument();
      });

      // Should show item count
      expect(screen.getByTestId("collection-list-footer-count")).toBeInTheDocument();
    });

    it("does not show pagination control when only one page", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("vtable-mock")).toBeInTheDocument();
      });

      // Default mock data has 3 items with limit 25 = 1 page — no pagination control
      expect(screen.queryByTestId("collection-list-pagination-control")).not.toBeInTheDocument();
    });
  });

  // =====================================================================
  // Filter
  // =====================================================================
  describe("filter", () => {
    it("shows filter toggle when enableFilter is true", async () => {
      renderList({ enableFilter: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-filter-toggle")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Empty state
  // =====================================================================
  describe("empty state", () => {
    it("shows empty message when no items", async () => {
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) {
          return Promise.resolve(makeCountResponse(0));
        }
        return Promise.resolve({ data: [], meta: { page: 1, limit: 25, total: 0 } });
      });

      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("vtable-empty")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Cell Renderers
  // =====================================================================
  describe("collection-item-dropdown cell rendering", () => {
    it("renders collection-item-dropdown values appropriately", async () => {
      const dropdownFields = [
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        { field: "relation_non_uuid", type: "string", meta: { interface: "collection-item-dropdown", sort: 1, hidden: false } },
        { field: "relation_uuid", type: "string", meta: { interface: "collection-item-dropdown", sort: 2, hidden: false } },
        { field: "relation_raw", type: "string", meta: { interface: "collection-item-dropdown", sort: 3, hidden: false } },
      ];

      const dropdownItems = {
        data: [
          {
            id: 1,
            relation_non_uuid: { key: "non-uuid-key" },
            relation_uuid: '{"key":"12345678-abcd-1234-abcd-123456789abc"}',
            relation_raw: "raw-string-val",
          },
        ],
        meta: { page: 1, limit: 25, total: 1 },
      };

      mockFieldsReadAll.mockResolvedValue(dropdownFields);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) {
          return Promise.resolve(makeCountResponse(1));
        }
        return Promise.resolve(dropdownItems);
      });

      renderList();

      // Wait for table to load and cells to be rendered
      const nonUuidCell = await screen.findByTestId("cell-0-relation_non_uuid");
      expect(nonUuidCell).toHaveTextContent("non-uuid-key");
      // It should render a Badge
      expect(nonUuidCell.querySelector('[data-component="Badge"]')).toBeInTheDocument();

      // 2. UUID key JSON string should be rendered as a Badge with truncated key text
      const uuidCell = screen.getByTestId("cell-0-relation_uuid");
      expect(uuidCell).toHaveTextContent("12345678…");
      expect(uuidCell.querySelector('[data-component="Badge"]')).toBeInTheDocument();

      // 3. Raw value should be rendered as a Text component
      const rawCell = screen.getByTestId("cell-0-relation_raw");
      expect(rawCell).toHaveTextContent("raw-string-val");
      expect(rawCell.querySelector('[data-component="Text"]')).toBeInTheDocument();
    });
  });

  // S8.3: a select/radio/multi-select field's raw stored value must resolve
  // to its configured choice label instead of showing the raw value (scalar)
  // or a content-less "JSON" badge (array/csv multi-select).
  describe("choice-label resolution (S8.3)", () => {
    it("resolves a scalar select-dropdown value to its choice label, not the raw stored value", async () => {
      const choiceFields = [
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "status",
          type: "string",
          meta: {
            interface: "select-dropdown",
            sort: 1,
            hidden: false,
            options: {
              choices: [
                { text: "Draft", value: "draft" },
                { text: "Published", value: "published" },
              ],
            },
          },
        },
      ];
      const choiceItems = {
        data: [{ id: 1, status: "draft" }],
        meta: { page: 1, limit: 25, total: 1 },
      };

      mockFieldsReadAll.mockResolvedValue(choiceFields);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve(choiceItems);
      });

      renderList();

      const statusCell = await screen.findByTestId("cell-0-status");
      expect(statusCell).toHaveTextContent("Draft");
      expect(statusCell).not.toHaveTextContent("draft");
    });

    it("resolves each entry of an array-stored multi-select value to its choice label instead of a bare JSON badge", async () => {
      const choiceFields = [
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type: "json",
          meta: {
            interface: "select-multiple-checkbox",
            sort: 1,
            hidden: false,
            options: {
              choices: [
                { text: "Urgent", value: "urgent" },
                { text: "Blocked", value: "blocked" },
              ],
            },
          },
        },
      ];
      const choiceItems = {
        data: [{ id: 1, tags: ["urgent", "blocked"] }],
        meta: { page: 1, limit: 25, total: 1 },
      };

      mockFieldsReadAll.mockResolvedValue(choiceFields);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve(choiceItems);
      });

      renderList();

      const tagsCell = await screen.findByTestId("cell-0-tags");
      expect(tagsCell).toHaveTextContent("Urgent");
      expect(tagsCell).toHaveTextContent("Blocked");
      expect(tagsCell).not.toHaveTextContent("JSON");
    });

    it("falls back to the raw value when no configured choice matches", async () => {
      const choiceFields = [
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "status",
          type: "string",
          meta: {
            interface: "select-dropdown",
            sort: 1,
            hidden: false,
            options: { choices: [{ text: "Draft", value: "draft" }] },
          },
        },
      ];
      const choiceItems = {
        data: [{ id: 1, status: "archived" }],
        meta: { page: 1, limit: 25, total: 1 },
      };

      mockFieldsReadAll.mockResolvedValue(choiceFields);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve(choiceItems);
      });

      renderList();

      const statusCell = await screen.findByTestId("cell-0-status");
      expect(statusCell).toHaveTextContent("archived");
      // Assert the CELL RENDERER produced this, not the table's own fallback:
      // with the resolution reverted, `status` falls through to `return null`
      // and the test double prints the raw value itself, so a text-content
      // assertion alone passes either way.
      expect(statusCell.querySelector('[data-component="Text"]')).toBeInTheDocument();
    });

    // The resolution keys on the field's interface, not its column type, so it
    // has to work for every column type that interface is declared for.
    // interface-catalog declares select-dropdown for string, integer,
    // bigInteger, float and decimal; placed inside the type chain, the numeric
    // branch returned first and none of those resolved.
    it.each([
      ["integer", 2, [{ text: "Low", value: 1 }, { text: "High", value: 2 }], "High"],
      ["bigInteger", 1, [{ text: "Low", value: 1 }], "Low"],
      ["float", 0.5, [{ text: "Half", value: 0.5 }], "Half"],
      ["decimal", 10, [{ text: "Ten", value: 10 }], "Ten"],
      ["boolean", true, [{ text: "Enabled", value: true }], "Enabled"],
    ])("resolves a %s-typed choice field to its label", async (type, stored, choices, expected) => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "status",
          type,
          meta: {
            interface: "select-dropdown",
            sort: 1,
            hidden: false,
            options: { choices },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, status: stored }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const statusCell = await screen.findByTestId("cell-0-status");
      expect(statusCell).toHaveTextContent(expected as string);
    });

    // An exact match anywhere must beat a stringified match earlier in the
    // list, or the list and the form disagree about which choice a value means.
    it("prefers an exact value match over an earlier stringified one", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "status",
          type: "integer",
          meta: {
            interface: "select-dropdown",
            sort: 1,
            hidden: false,
            options: {
              choices: [
                { text: "STRING-ONE", value: "1" },
                { text: "NUMBER-ONE", value: 1 },
              ],
            },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, status: 1 }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const statusCell = await screen.findByTestId("cell-0-status");
      expect(statusCell).toHaveTextContent("NUMBER-ONE");
    });

    // The three storage shapes a multi-select arrives in: a real array, a
    // JSON array still encoded as a string, and csv.
    it.each([
      ["a real array", "json", ["draft", "review"]],
      ["a json array encoded as a string", "json", '["draft","review"]'],
      ["a csv string", "csv", "draft,review"],
    ])("renders labels for a multi-select stored as %s", async (_name, type, stored) => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type,
          meta: {
            interface: "select-multiple-checkbox",
            sort: 1,
            hidden: false,
            options: {
              choices: [
                { text: "Draft", value: "draft" },
                { text: "In Review", value: "review" },
              ],
            },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, tags: stored }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const cell = await screen.findByTestId("cell-0-tags");
      expect(cell).toHaveTextContent("Draft");
      expect(cell).toHaveTextContent("In Review");
      // Never the encoding itself.
      expect(cell).not.toHaveTextContent("[");
      expect(cell).not.toHaveTextContent("draft,review");
    });

    // A choice value that itself contains a comma must not be split apart.
    it("does not split a single choice whose value contains a comma", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type: "csv",
          meta: {
            interface: "select-dropdown",
            sort: 1,
            hidden: false,
            options: { choices: [{ text: "Amsterdam", value: "Amsterdam, NL" }] },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, tags: "Amsterdam, NL" }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const cell = await screen.findByTestId("cell-0-tags");
      expect(cell).toHaveTextContent("Amsterdam");
      expect(cell).not.toHaveTextContent("NL");
    });

    // Only three badges are shown; the rest are reported as a count.
    it("counts the entries beyond the first three", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type: "json",
          meta: {
            interface: "select-multiple-checkbox",
            sort: 1,
            hidden: false,
            options: {
              choices: [1, 2, 3, 4, 5].map((n) => ({ text: `Tag ${n}`, value: `t${n}` })),
            },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, tags: ["t1", "t2", "t3", "t4", "t5"] }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const cell = await screen.findByTestId("cell-0-tags");
      expect(cell).toHaveTextContent("Tag 3");
      expect(cell).toHaveTextContent("+2");
      expect(cell).not.toHaveTextContent("Tag 4");
      // That the counter also survives a narrow column is a flex-shrink
      // property; jsdom does no layout and the Mantine test double drops
      // style, so it is not assertable here.
    });

    // Empty and nullish entries must not render as badges reading "null".
    it.each([
      ["an empty array", []],
      ["entries that are all nullish", [null, undefined]],
    ])("renders no badges for %s", async (_name, stored) => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type: "json",
          meta: {
            interface: "select-multiple-checkbox",
            sort: 1,
            hidden: false,
            options: { choices: [{ text: "Draft", value: "draft" }] },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, tags: stored }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const cell = await screen.findByTestId("cell-0-tags");
      expect(cell.querySelector('[data-component="Badge"]')).toBeNull();
      expect(cell).not.toHaveTextContent("null");
      expect(cell).not.toHaveTextContent("[]");
      // No empty badge row either: the renderer has to hand the cell back to
      // the table so it paints its own placeholder, not emit a Group holding
      // nothing. Both are visually blank, so assert on the structure.
      expect(cell.querySelector('[data-component="Group"]')).toBeNull();
    });

    // An unrecognised json payload keeps the JSON badge it had before the
    // resolution existed, rather than spilling raw JSON into the cell.
    it("leaves an unresolvable json payload to the JSON badge", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "tags",
          type: "json",
          meta: {
            interface: "select-multiple-checkbox",
            sort: 1,
            hidden: false,
            options: { choices: [{ text: "Draft", value: "draft" }] },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, tags: '{"nested":{"a":1}}' }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const cell = await screen.findByTestId("cell-0-tags");
      expect(cell).toHaveTextContent("JSON");
      expect(cell).not.toHaveTextContent("nested");
    });

    // A field that merely carries options.choices but is not a choice
    // interface must keep its own renderer.
    it("leaves a non-choice interface's rendering alone even if it carries choices", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
        {
          field: "status",
          type: "string",
          meta: {
            interface: "input",
            sort: 1,
            hidden: false,
            options: { choices: [{ text: "Draft", value: "draft" }] },
          },
        },
      ]);
      mockApiRequest.mockImplementation((url: string) => {
        if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(1));
        return Promise.resolve({
          data: [{ id: 1, status: "draft" }],
          meta: { page: 1, limit: 25, total: 1 },
        });
      });

      renderList();

      const statusCell = await screen.findByTestId("cell-0-status");
      expect(statusCell).toHaveTextContent("draft");
      expect(statusCell).not.toHaveTextContent("Draft");
    });
  });
});

describe("relational-field exclusion in the items query", () => {
  // Top-level sibling of the CollectionList describe, so that block's
  // beforeEach never runs here: without this the shared mock still holds
  // every call from the preceding tests, the "did we fetch?" gate is
  // already satisfied by those leftovers, and the assertion reads a stale
  // URL — which is why this file failed intermittently.
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("omits O2M/M2M/M2A fields from fields= even when their type is not alias", async () => {
    mockFieldsReadAll.mockResolvedValue([
      ...SAMPLE_FIELDS,
      // Mirrors the live-instance shape: an M2A field whose column type
      // reports "text", flagged only via meta.special / meta.interface.
      { field: "blocks", type: "text", meta: { special: ["m2a"], interface: "list-m2a", sort: 4, hidden: false } },
      { field: "comments", type: "text", meta: { interface: "list-o2m", sort: 5, hidden: false } },
    ]);
    mockPermissionsGetAccess.mockResolvedValue({});
    mockApiRequest.mockImplementation((url: string) => {
      if (url.includes("aggregate")) return Promise.resolve(makeCountResponse(3));
      return Promise.resolve(SAMPLE_ITEMS);
    });

    renderList();

    await waitFor(() => {
      const itemCalls = mockApiRequest.mock.calls.filter(
        ([url]) => !String(url).includes("aggregate"),
      );
      expect(itemCalls.length).toBeGreaterThan(0);
    });

    const itemUrl = String(
      mockApiRequest.mock.calls.filter(([url]) => !String(url).includes("aggregate")).at(-1)![0],
    );
    expect(itemUrl).toContain("title");
    expect(itemUrl).not.toContain("blocks");
    expect(itemUrl).not.toContain("comments");
    expect(screen.queryByText("Blocks")).not.toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// Estimated totals (meta.total_estimated)
//
// On large collections DaaS reports the query planner's estimate as
// meta.total and marks it total_estimated: true; a page that disproves the
// estimate comes back with the exact total and total_estimated: false. The
// component must step off pages that turn out not to exist, and must pin a
// proven total so estimates cannot resurrect phantom pages afterwards.
// -------------------------------------------------------------------
describe("CollectionList estimated totals", () => {
  /**
   * Simulates the server behavior: planner estimate 40, real total 23,
   * page size 10. Pages 1–2 are full and carry the estimate; page 3 is the
   * real last page (short, so the server proves 23 exact); anything past it
   * is empty with the recounted exact total.
   */
  function largeCollectionApi(url: string) {
    if (String(url).includes("aggregate")) {
      return Promise.resolve(makeCountResponse(23));
    }
    const page = Number(
      new URLSearchParams(String(url).split("?")[1] ?? "").get("page") ?? 1,
    );
    const row = (i: number) => ({
      id: i,
      title: `Post ${i}`,
      status: "published",
      body: `Body ${i}`,
    });
    if (page <= 2) {
      return Promise.resolve({
        data: Array.from({ length: 10 }, (_, i) => row((page - 1) * 10 + i + 1)),
        meta: { page, limit: 10, total: 40, total_estimated: true },
      });
    }
    if (page === 3) {
      return Promise.resolve({
        data: [row(21), row(22), row(23)],
        meta: { page, limit: 10, total: 23, total_estimated: false },
      });
    }
    return Promise.resolve({
      data: [],
      meta: { page, limit: 10, total: 23, total_estimated: false },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockFieldsReadAll.mockResolvedValue(SAMPLE_FIELDS);
    mockPermissionsGetAccess.mockResolvedValue({});
    mockApiRequest.mockImplementation(largeCollectionApi);
  });

  it("steps back off a phantom page and shows the corrected total", async () => {
    renderList({ limit: 10 });

    // The estimate builds 4 pages (40 / 10).
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 40 items",
      );
    });
    expect(screen.getByTestId("collection-list-pagination-control")).toHaveAttribute(
      "data-total",
      "4",
    );

    // Page 4 does not exist: the server answers it with the exact total, and
    // the component must land the user on the real last page instead.
    fireEvent.click(screen.getByTestId("pagination-page-4"));

    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "21–23 of 23 items",
      );
    });
    expect(screen.getByTestId("cell-0-title")).toHaveTextContent("Post 21");
    expect(screen.getByTestId("collection-list-pagination-control")).toHaveAttribute(
      "data-total",
      "3",
    );
    expect(screen.queryByTestId("pagination-page-4")).not.toBeInTheDocument();
  });

  it("pins a proven total so estimates cannot resurrect phantom pages", async () => {
    renderList({ limit: 10 });

    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 40 items",
      );
    });

    // Visiting the real last page proves the total is 23.
    fireEvent.click(screen.getByTestId("pagination-page-3"));
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "21–23 of 23 items",
      );
    });

    // Going back to page 1 returns the stale estimate (40) — the pinned
    // proof must win, keeping the pager at 3 pages.
    fireEvent.click(screen.getByTestId("pagination-page-1"));
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 23 items",
      );
    });
    expect(screen.getByTestId("collection-list-pagination-control")).toHaveAttribute(
      "data-total",
      "3",
    );
    expect(screen.queryByTestId("pagination-page-4")).not.toBeInTheDocument();
  });

  it("drops the pinned total on manual refresh", async () => {
    renderList({ limit: 10 });

    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 40 items",
      );
    });

    // Pin via the real last page, then return to page 1 with the pin held.
    fireEvent.click(screen.getByTestId("pagination-page-3"));
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "21–23 of 23 items",
      );
    });
    fireEvent.click(screen.getByTestId("pagination-page-1"));
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 23 items",
      );
    });

    // Refresh is the escape hatch: it re-syncs with the server, estimate and
    // all, until a page proves the total again.
    fireEvent.click(screen.getByTestId("collection-list-refresh"));
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "1–10 of 40 items",
      );
    });
  });

  it("ignores a non-finite total instead of building page math on it", async () => {
    mockApiRequest.mockImplementation((url: string) => {
      if (String(url).includes("aggregate")) {
        return Promise.resolve(makeCountResponse(3));
      }
      return Promise.resolve({
        data: [
          { id: 1, title: "Post 1", status: "published", body: "" },
          { id: 2, title: "Post 2", status: "draft", body: "" },
          { id: 3, title: "Post 3", status: "published", body: "" },
        ],
        meta: { page: 1, limit: 10, total: Number.NaN },
      });
    });

    renderList({ limit: 10 });

    // Falls back to counting the rows it received — no crash, no NaN pages.
    await waitFor(() => {
      expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent(
        "3 items",
      );
    });
    expect(screen.getByTestId("cell-0-title")).toHaveTextContent("Post 1");
  });
});

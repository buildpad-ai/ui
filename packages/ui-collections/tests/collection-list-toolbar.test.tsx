import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { CollectionListToolbar } from "../src/CollectionListToolbar";

const defaultProps: React.ComponentProps<typeof CollectionListToolbar> = {
  enableSearch: true,
  search: "",
  onSearchChange: vi.fn(),
  enableFilter: false,
  filterPanelOpen: false,
  activeFilterCount: 0,
  onToggleFilterPanel: vi.fn(),
  archiveFilterMode: "all" as const,
  onArchiveFilterChange: vi.fn(),
  onRefresh: vi.fn(),
  enableSelection: false,
  selectedIds: [],
  enableDelete: false,
  deleteAllowed: true,
  createAllowed: true,
  updateAllowed: true,
  bulkActions: [],
  onDeleteRequest: vi.fn(),
  onClearSelection: vi.fn(),
  enableCreate: false,
};

function renderToolbar(props: Partial<React.ComponentProps<typeof CollectionListToolbar>> = {}) {
  return render(<CollectionListToolbar {...defaultProps} {...props} />);
}

describe("CollectionListToolbar", () => {
  // ── Search ──
  describe("search", () => {
    it("renders search input when enableSearch is true", () => {
      renderToolbar({ enableSearch: true });
      expect(screen.getByTestId("collection-list-search")).toBeInTheDocument();
    });

    it("does not render search input when enableSearch is false", () => {
      renderToolbar({ enableSearch: false });
      expect(screen.queryByTestId("collection-list-search")).not.toBeInTheDocument();
    });

    it("calls onSearchChange when typing in search", async () => {
      const onSearchChange = vi.fn();
      renderToolbar({ onSearchChange });
      const input = screen.getByPlaceholderText("Search...");
      await userEvent.type(input, "a");
      expect(onSearchChange).toHaveBeenCalled();
    });
  });

  // ── Filter ──
  describe("filter", () => {
    it("renders filter toggle when enableFilter is true", () => {
      renderToolbar({ enableFilter: true });
      expect(screen.getByTestId("collection-list-filter-toggle")).toBeInTheDocument();
    });

    it("does not render filter toggle when enableFilter is false", () => {
      renderToolbar({ enableFilter: false });
      expect(screen.queryByTestId("collection-list-filter-toggle")).not.toBeInTheDocument();
    });

    it("calls onToggleFilterPanel when filter toggle is clicked", () => {
      const onToggleFilterPanel = vi.fn();
      renderToolbar({ enableFilter: true, onToggleFilterPanel });
      fireEvent.click(screen.getByTestId("collection-list-filter-toggle"));
      expect(onToggleFilterPanel).toHaveBeenCalled();
    });

    it("shows filter count badge when activeFilterCount > 0", () => {
      renderToolbar({ enableFilter: true, activeFilterCount: 3 });
      expect(screen.getByTestId("collection-list-filter-count")).toHaveTextContent("3");
    });

    it("does not show filter count badge when activeFilterCount is 0", () => {
      renderToolbar({ enableFilter: true, activeFilterCount: 0 });
      expect(screen.queryByTestId("collection-list-filter-count")).not.toBeInTheDocument();
    });
  });

  // ── Archive ──
  describe("archive filter", () => {
    it("renders archive filter when archiveField is set", () => {
      renderToolbar({ archiveField: "status" });
      expect(screen.getByTestId("collection-list-archive-filter")).toBeInTheDocument();
    });

    it("does not render archive filter when archiveField is not set", () => {
      renderToolbar({ archiveField: undefined });
      expect(screen.queryByTestId("collection-list-archive-filter")).not.toBeInTheDocument();
    });
  });

  // ── Refresh ──
  describe("refresh", () => {
    it("renders refresh button", () => {
      renderToolbar();
      expect(screen.getByTestId("collection-list-refresh")).toBeInTheDocument();
    });

    it("calls onRefresh when clicked", () => {
      const onRefresh = vi.fn();
      renderToolbar({ onRefresh });
      fireEvent.click(screen.getByTestId("collection-list-refresh"));
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  // ── Bulk Actions ──
  describe("bulk actions", () => {
    it("shows bulk actions when items are selected", () => {
      renderToolbar({
        enableSelection: true,
        selectedIds: [1],
        enableDelete: true,
      });
      expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
    });

    it("does not show bulk actions when no items are selected", () => {
      renderToolbar({
        enableSelection: true,
        selectedIds: [],
        enableDelete: true,
      });
      expect(screen.queryByTestId("collection-list-bulk-actions")).not.toBeInTheDocument();
    });

    it("does not show bulk actions when enableSelection is false", () => {
      renderToolbar({
        enableSelection: false,
        selectedIds: [1],
        enableDelete: true,
      });
      expect(screen.queryByTestId("collection-list-bulk-actions")).not.toBeInTheDocument();
    });
  });

  // ── Create Button ──
  describe("create button", () => {
    it("shows create button when enableCreate and onCreate are provided", () => {
      renderToolbar({ enableCreate: true, onCreate: vi.fn() });
      expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      expect(screen.getByTestId("collection-list-create")).toHaveTextContent("Create item");
    });

    it("does not show create button when enableCreate is false", () => {
      renderToolbar({ enableCreate: false, onCreate: vi.fn() });
      expect(screen.queryByTestId("collection-list-create")).not.toBeInTheDocument();
    });

    it("does not show create button when onCreate is not provided", () => {
      renderToolbar({ enableCreate: true, onCreate: undefined });
      expect(screen.queryByTestId("collection-list-create")).not.toBeInTheDocument();
    });

    it("disables create button when createAllowed is false", () => {
      renderToolbar({ enableCreate: true, onCreate: vi.fn(), createAllowed: false });
      expect(screen.getByTestId("collection-list-create")).toBeDisabled();
    });

    it("calls onCreate when create button is clicked", () => {
      const onCreate = vi.fn();
      renderToolbar({ enableCreate: true, onCreate, createAllowed: true });
      fireEvent.click(screen.getByTestId("collection-list-create"));
      expect(onCreate).toHaveBeenCalled();
    });
  });
});

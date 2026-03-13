import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { BulkActionsBar } from "../src/BulkActionsBar";
import type { BulkAction } from "../src/CollectionList";

function renderBar(props: Partial<React.ComponentProps<typeof BulkActionsBar>> = {}) {
  const defaults: React.ComponentProps<typeof BulkActionsBar> = {
    selectedIds: [1, 2],
    enableDelete: true,
    deleteAllowed: true,
    createAllowed: true,
    updateAllowed: true,
    bulkActions: [],
    onDeleteRequest: vi.fn(),
    onClearSelection: vi.fn(),
    ...props,
  };
  return render(<BulkActionsBar {...defaults} />);
}

describe("BulkActionsBar", () => {
  it("renders selected count", () => {
    renderBar({ selectedIds: [1, 2, 3] });
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("renders delete button when enableDelete is true", () => {
    renderBar({ enableDelete: true });
    expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-action-delete")).toHaveTextContent("Delete");
  });

  it("does not render delete button when enableDelete is false", () => {
    renderBar({ enableDelete: false });
    expect(screen.queryByTestId("bulk-action-delete")).not.toBeInTheDocument();
  });

  it("disables delete button when deleteAllowed is false", () => {
    renderBar({ deleteAllowed: false });
    expect(screen.getByTestId("bulk-action-delete")).toBeDisabled();
  });

  it("calls onDeleteRequest with selectedIds when delete is clicked", () => {
    const onDeleteRequest = vi.fn();
    renderBar({ selectedIds: [5, 10], onDeleteRequest });
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    expect(onDeleteRequest).toHaveBeenCalledWith([5, 10]);
  });

  it("does not call onDeleteRequest when deleteAllowed is false", () => {
    const onDeleteRequest = vi.fn();
    renderBar({ deleteAllowed: false, onDeleteRequest });
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    expect(onDeleteRequest).not.toHaveBeenCalled();
  });

  it("renders custom bulk actions with labels", () => {
    const bulkActions: BulkAction[] = [
      { label: "Archive", action: vi.fn() },
      { label: "Export", color: "green", action: vi.fn() },
    ];
    renderBar({ bulkActions });
    expect(screen.getByTestId("bulk-action-0")).toHaveTextContent("Archive");
    expect(screen.getByTestId("bulk-action-1")).toHaveTextContent("Export");
  });

  it("disables bulk actions based on requiredPermission", () => {
    const bulkActions: BulkAction[] = [
      { label: "Create Copy", requiredPermission: "create", action: vi.fn() },
      { label: "Edit All", requiredPermission: "update", action: vi.fn() },
      { label: "Remove", requiredPermission: "delete", action: vi.fn() },
    ];
    renderBar({
      createAllowed: false,
      updateAllowed: true,
      deleteAllowed: false,
      bulkActions,
    });
    expect(screen.getByTestId("bulk-action-0")).toBeDisabled(); // create - not allowed
    expect(screen.getByTestId("bulk-action-1")).toBeEnabled();  // update - allowed
    expect(screen.getByTestId("bulk-action-2")).toBeDisabled(); // delete - not allowed
  });

  it("enables bulk actions without requiredPermission regardless of permissions", () => {
    const action = vi.fn();
    const bulkActions: BulkAction[] = [
      { label: "Export", action },
    ];
    renderBar({ createAllowed: false, updateAllowed: false, deleteAllowed: false, bulkActions });
    expect(screen.getByTestId("bulk-action-0")).toBeEnabled();
  });

  it("calls bulk action handler with selectedIds when clicked", () => {
    const action = vi.fn();
    const bulkActions: BulkAction[] = [{ label: "Export", action }];
    renderBar({ selectedIds: [1, 2], bulkActions });
    fireEvent.click(screen.getByTestId("bulk-action-0"));
    expect(action).toHaveBeenCalledWith([1, 2]);
  });

  it("calls onClearSelection when clear button is clicked", () => {
    const onClearSelection = vi.fn();
    renderBar({ onClearSelection });
    fireEvent.click(screen.getByTestId("collection-list-clear-selection"));
    expect(onClearSelection).toHaveBeenCalled();
  });
});

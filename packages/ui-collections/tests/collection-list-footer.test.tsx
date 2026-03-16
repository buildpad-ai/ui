import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { CollectionListFooter } from "../src/CollectionListFooter";

const defaultProps: React.ComponentProps<typeof CollectionListFooter> = {
  itemCountDisplay: "1–25 of 100 items",
  limit: 25,
  onLimitChange: vi.fn(),
  page: 1,
  onPageChange: vi.fn(),
  totalPages: 4,
};

function renderFooter(props: Partial<React.ComponentProps<typeof CollectionListFooter>> = {}) {
  return render(<CollectionListFooter {...defaultProps} {...props} />);
}

describe("CollectionListFooter", () => {
  it("renders item count display", () => {
    renderFooter({ itemCountDisplay: "1–25 of 100 items" });
    expect(screen.getByTestId("collection-list-footer-count")).toHaveTextContent("1–25 of 100 items");
  });

  it("renders per-page selector", () => {
    renderFooter();
    expect(screen.getByTestId("collection-list-per-page")).toBeInTheDocument();
  });

  it("calls onLimitChange when per-page is changed", () => {
    const onLimitChange = vi.fn();
    renderFooter({ onLimitChange, limit: 25 });
    const select = screen.getByTestId("collection-list-per-page") as HTMLSelectElement;
    // The mock Select renders a native <select> whose onChange calls the Mantine
    // onChange(value) callback with e.target.value.  We need to set the value
    // property *before* firing so the synthetic event carries it.
    Object.defineProperty(select, "value", { writable: true, value: "50" });
    fireEvent.change(select);
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it("shows pagination when totalPages > 1", () => {
    renderFooter({ totalPages: 3 });
    expect(screen.getByTestId("collection-list-pagination-control")).toBeInTheDocument();
  });

  it("does not show pagination when totalPages is 1", () => {
    renderFooter({ totalPages: 1 });
    expect(screen.queryByTestId("collection-list-pagination-control")).not.toBeInTheDocument();
  });

  it("renders footer container", () => {
    renderFooter();
    expect(screen.getByTestId("collection-list-footer")).toBeInTheDocument();
  });
});

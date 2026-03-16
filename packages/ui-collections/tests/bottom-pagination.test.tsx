import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { BottomPagination } from "../src/BottomPagination";

const defaultProps: React.ComponentProps<typeof BottomPagination> = {
  itemCountDisplay: "1–25 of 50 items",
  page: 1,
  onPageChange: vi.fn(),
  totalPages: 2,
};

function renderPagination(props: Partial<React.ComponentProps<typeof BottomPagination>> = {}) {
  return render(<BottomPagination {...defaultProps} {...props} />);
}

describe("BottomPagination", () => {
  it("renders when totalPages > 1", () => {
    renderPagination({ totalPages: 3 });
    expect(screen.getByTestId("collection-list-bottom-pagination")).toBeInTheDocument();
  });

  it("returns null when totalPages is 1", () => {
    const { container } = renderPagination({ totalPages: 1 });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalPages is 0", () => {
    const { container } = renderPagination({ totalPages: 0 });
    expect(container.innerHTML).toBe("");
  });

  it("displays item count text", () => {
    renderPagination({ itemCountDisplay: "26–50 of 75 items" });
    expect(screen.getByTestId("collection-list-bottom-count")).toHaveTextContent("26–50 of 75 items");
  });

  it("renders pagination control", () => {
    renderPagination({ totalPages: 5 });
    expect(screen.getByTestId("collection-list-bottom-pagination-control")).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { DeleteConfirmModal } from "../src/DeleteConfirmModal";

const defaultProps: React.ComponentProps<typeof DeleteConfirmModal> = {
  opened: true,
  count: 3,
  loading: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderModal(props: Partial<React.ComponentProps<typeof DeleteConfirmModal>> = {}) {
  return render(<DeleteConfirmModal {...defaultProps} {...props} />);
}

describe("DeleteConfirmModal", () => {
  it("renders when opened is true", () => {
    renderModal({ opened: true });
    expect(screen.getByTestId("delete-confirm-modal")).toBeInTheDocument();
  });

  it("does not render when opened is false", () => {
    renderModal({ opened: false });
    expect(screen.queryByTestId("delete-confirm-modal")).not.toBeInTheDocument();
  });

  it("shows correct plural message for multiple items", () => {
    renderModal({ count: 5 });
    expect(screen.getByText(/delete 5 items/i)).toBeInTheDocument();
  });

  it("shows correct singular message for one item", () => {
    renderModal({ count: 1 });
    expect(screen.getByText(/delete 1 item\?/i)).toBeInTheDocument();
  });

  it("calls onConfirm when Delete button is clicked", () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });
    fireEvent.click(screen.getByTestId("delete-confirm-btn"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables Cancel button when loading", () => {
    renderModal({ loading: true });
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("disables Delete button when loading", () => {
    renderModal({ loading: true });
    expect(screen.getByTestId("delete-confirm-btn")).toBeDisabled();
  });
});

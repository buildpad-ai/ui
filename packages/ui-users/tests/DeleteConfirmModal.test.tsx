/**
 * DeleteConfirmModal unit tests: visibility, labels, confirm/cancel actions.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { DeleteConfirmModal } from '../src/DeleteConfirmModal';

const defaultProps: React.ComponentProps<typeof DeleteConfirmModal> = {
  opened: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

function renderModal(props: Partial<React.ComponentProps<typeof DeleteConfirmModal>> = {}) {
  return render(
    <MantineProvider>
      <DeleteConfirmModal {...defaultProps} {...props} />
    </MantineProvider>
  );
}

describe('DeleteConfirmModal', () => {
  it('renders when opened', () => {
    renderModal();
    expect(screen.getByTestId('users-delete-confirm-modal')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    // Mantine keeps an empty portal-target root mounted for exit transitions,
    // but the actual dialog (role="dialog") only renders while opened.
    renderModal({ opened: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders custom title/description/confirmLabel', () => {
    renderModal({ title: 'Delete role', description: 'Users in this role will need reassignment.', confirmLabel: 'Remove' });
    expect(screen.getByText('Delete role')).toBeInTheDocument();
    expect(screen.getByText('Users in this role will need reassignment.')).toBeInTheDocument();
    expect(screen.getByTestId('users-delete-confirm-btn')).toHaveTextContent('Remove');
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });
    fireEvent.click(screen.getByTestId('users-delete-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while loading', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByTestId('users-delete-confirm-btn')).toBeDisabled();
  });
});

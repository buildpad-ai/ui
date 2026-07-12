/**
 * RolesManager unit tests: headerless mode, page-size selector, and the
 * deliberate absence of column sorting (the roles API ignores `sort`,
 * hardcoding name-asc — Req 20.6). `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RolesManager } from '../src/RolesManager';
import { mockRoles } from '../src/_fixtures';

const { fetchRolesMock, deleteRoleMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchRolesMock: vi.fn(),
  deleteRoleMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  useRoles: () => ({ fetchRoles: fetchRolesMock, deleteRole: deleteRoleMock }),
  usePermissions: usePermissionsMock,
}));

function renderManager(props: Partial<React.ComponentProps<typeof RolesManager>> = {}) {
  return render(
    <MantineProvider>
      <RolesManager {...props} />
    </MantineProvider>
  );
}

beforeEach(() => {
  fetchRolesMock.mockReset().mockResolvedValue({ roles: mockRoles, total: mockRoles.length, totalPages: 1 });
  deleteRoleMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('RolesManager', () => {
  it('renders the roles list from fetchRoles', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
    expect(screen.getByText('Editor')).toBeInTheDocument();
  });

  it('hideHeader hides the heading + subtitle but keeps the Add button', async () => {
    renderManager({ hideHeader: true, onCreateRole: vi.fn() });
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Roles' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Define roles to group users and assign permissions')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('roles-manager-add-btn')).toBeInTheDocument();
  });

  it('offers no column sorting (roles API hardcodes name-asc)', async () => {
    const { container } = renderManager();
    await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
    expect(container.querySelector('th[aria-sort]')).toBeNull();
  });

  it('changing the page size refetches with the new limit at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('roles-manager-page-size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

    await waitFor(() =>
      expect(fetchRolesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, page: 1 })
      )
    );
  });
});

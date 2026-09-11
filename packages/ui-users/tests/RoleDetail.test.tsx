/**
 * RoleDetail — scope pattern list identity.
 *
 * scopePatterns has no natural id (plain strings), so removing a row by
 * index alone would misattribute a later row's typed value/focus to the
 * wrong pattern once indices shift. RoleDetail keeps a parallel
 * patternKeysRef in lockstep with add/remove so each row's React key stays
 * stable across removals — this exercises that behavior end-to-end via the
 * rendered inputs rather than inspecting React internals directly.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoleDetail } from '../src/RoleDetail';

const { fetchRolesMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchRolesMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  useRoles: () => ({
    getRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    fetchRoles: fetchRolesMock,
  }),
  usePermissions: usePermissionsMock,
}));

function renderDetail(props: Partial<React.ComponentProps<typeof RoleDetail>> = {}) {
  return render(
    <MantineProvider>
      <RoleDetail id="new" {...props} />
    </MantineProvider>,
  );
}

beforeEach(() => {
  fetchRolesMock.mockReset().mockResolvedValue({ roles: [], total: 0 });
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('RoleDetail — scope pattern rows', () => {
  it('preserves each remaining row\'s value when a row above it is removed', async () => {
    renderDetail();

    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('role-detail-scope-switch'));

    const addButton = screen.getByTestId('role-detail-scope-add-pattern');
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const inputs = () => [0, 1, 2].map((i) => screen.getByTestId(`role-detail-scope-pattern-${i}`) as HTMLInputElement);

    fireEvent.change(inputs()[0], { target: { value: 'pattern-a' } });
    fireEvent.change(inputs()[1], { target: { value: 'pattern-b' } });
    fireEvent.change(inputs()[2], { target: { value: 'pattern-c' } });

    expect(inputs().map((i) => i.value)).toEqual(['pattern-a', 'pattern-b', 'pattern-c']);

    // Remove the first row (index 0) — the remaining two should shift up as
    // "pattern-b" then "pattern-c", not be corrupted or duplicated.
    fireEvent.click(screen.getByLabelText('Remove pattern 1'));

    await waitFor(() => {
      expect(screen.queryByTestId('role-detail-scope-pattern-2')).not.toBeInTheDocument();
    });

    const remaining = [0, 1].map((i) => screen.getByTestId(`role-detail-scope-pattern-${i}`) as HTMLInputElement);
    expect(remaining.map((i) => i.value)).toEqual(['pattern-b', 'pattern-c']);
  });

  it('adds a new empty pattern row via the Add pattern button', async () => {
    renderDetail();
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('role-detail-scope-switch'));
    expect(screen.queryByTestId('role-detail-scope-pattern-0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('role-detail-scope-add-pattern'));

    expect((screen.getByTestId('role-detail-scope-pattern-0') as HTMLInputElement).value).toBe('');
  });
});

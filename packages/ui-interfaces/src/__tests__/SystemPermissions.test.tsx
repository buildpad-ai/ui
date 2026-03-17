import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SystemPermissions, SystemPermissionsProps, PermissionAlterations } from '../system-permissions';
import type { Collection } from '@buildpad/types';

// Mock @buildpad/services apiRequest
jest.mock('@buildpad/services', () => ({
  apiRequest: jest.fn(),
}));

import { apiRequest } from '@buildpad/services';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const MOCK_COLLECTIONS: Collection[] = [
  { collection: 'articles', meta: { collection: 'Articles' } as any, schema: { name: 'articles' } },
  { collection: 'products', meta: { collection: 'Products' } as any, schema: { name: 'products' } },
  { collection: 'daas_users', meta: { collection: 'Users' } as any, schema: { name: 'daas_users' } },
  { collection: 'daas_files', meta: { collection: 'Files' } as any, schema: { name: 'daas_files' } },
  { collection: 'daas_extensions', meta: { collection: 'Extensions' } as any, schema: { name: 'daas_extensions' } },
];

async function renderWithProvider(component: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<MantineProvider>{component}</MantineProvider>);
  });
  return result!;
}

const defaultProps: SystemPermissionsProps = {
  primaryKey: 'test-policy-1',
  collections: MOCK_COLLECTIONS,
  'data-testid': 'sp',
};

describe('SystemPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiRequest.mockResolvedValue({ data: [] });
  });

  // ───────────────────────────────────────────────────────────
  // Basic Rendering
  // ───────────────────────────────────────────────────────────
  describe('Basic Rendering', () => {
    it('renders with label', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} label="Permissions" />);
      expect(screen.getByText('Permissions')).toBeInTheDocument();
    });

    it('renders with description', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} description="Configure access" />);
      expect(screen.getByText('Configure access')).toBeInTheDocument();
    });

    it('renders table headers', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByText('Collection')).toBeInTheDocument();
      expect(screen.getByText('create')).toBeInTheDocument();
      expect(screen.getByText('read')).toBeInTheDocument();
      expect(screen.getByText('update')).toBeInTheDocument();
      expect(screen.getByText('delete')).toBeInTheDocument();
      expect(screen.getByText('share')).toBeInTheDocument();
    });

    it('renders empty state when no permissions', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp-empty')).toBeInTheDocument();
      expect(screen.getByText(/No permissions configured/)).toBeInTheDocument();
    });

    it('renders with error message', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} error="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders with data-testid', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Admin Access
  // ───────────────────────────────────────────────────────────
  describe('Admin Access', () => {
    it('shows admin notice when adminAccess is true', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} adminAccess label="Permissions" />);
      expect(screen.getByTestId('sp-admin-notice')).toBeInTheDocument();
      expect(screen.getByText(/Admin Access is enabled/)).toBeInTheDocument();
    });

    it('does not show table when adminAccess is true', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} adminAccess />);
      expect(screen.queryByText('Collection')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Permission Display
  // ───────────────────────────────────────────────────────────
  describe('Permission Display', () => {
    it('renders permission rows for configured collections', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
          { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-row-articles')).toBeInTheDocument();
    });

    it('shows "all" level chips for full-access permissions', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const toggle = screen.getByTestId('sp-toggle-articles-read');
      expect(toggle).toHaveAttribute('data-level', 'all');
    });

    it('shows "custom" level for partial permissions', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['title', 'body'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const toggle = screen.getByTestId('sp-toggle-articles-read');
      expect(toggle).toHaveAttribute('data-level', 'custom');
    });

    it('shows "none" level for unconfigured actions', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const toggle = screen.getByTestId('sp-toggle-articles-create');
      expect(toggle).toHaveAttribute('data-level', 'none');
    });

    it('shows "custom" when permissions filter is set', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } as any, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const toggle = screen.getByTestId('sp-toggle-articles-read');
      expect(toggle).toHaveAttribute('data-level', 'custom');
    });

    it('shows "custom" when validation is set', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: { title: { _nnull: true } } as any, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const toggle = screen.getByTestId('sp-toggle-articles-create');
      expect(toggle).toHaveAttribute('data-level', 'custom');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Collection Grouping
  // ───────────────────────────────────────────────────────────
  describe('Collection Grouping', () => {
    it('separates regular and system collections', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
          { collection: 'daas_users', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-row-articles')).toBeInTheDocument();
      expect(screen.getByTestId('sp-row-daas_users')).toBeInTheDocument();
      const dividerLabel = document.querySelector('.mantine-Divider-label');
      expect(dividerLabel).not.toBeNull();
      expect(dividerLabel!.textContent).toBe('System Collections');
    });

    it('does not show system divider with only regular collections', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const dividerLabel = document.querySelector('.mantine-Divider-label');
      expect(dividerLabel).toBeNull();
    });

    it('does not show system divider with only system collections', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'daas_users', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      const dividerLabel = document.querySelector('.mantine-Divider-label');
      expect(dividerLabel).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Setting Full Access
  // ───────────────────────────────────────────────────────────
  describe('Setting Full Access', () => {
    it('calls onChange when setting full access via All shortcut', async () => {
      const onChange = jest.fn();
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(
        <SystemPermissions {...defaultProps} value={value} onChange={onChange} />,
      );

      const allButton = screen.getByTestId('sp-all-articles');
      await act(async () => { fireEvent.click(allButton); });

      // setFullAccessAll batches all changes into a single emit
      expect(onChange).toHaveBeenCalledTimes(1);
      const emitted = onChange.mock.calls[0][0] as PermissionAlterations;
      // Should have all 5 actions in create (read already existed so it stays, plus 4 new)
      expect(emitted.create.length).toBeGreaterThanOrEqual(5);
      const actions = emitted.create.map((p: Partial<typeof emitted.create[0]>) => p.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('share');
    });

    it('calls onChange when setting no access via None shortcut', async () => {
      const onChange = jest.fn();
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
          { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(
        <SystemPermissions {...defaultProps} value={value} onChange={onChange} />,
      );

      const noneButton = screen.getByTestId('sp-none-articles');
      await act(async () => { fireEvent.click(noneButton); });

      // setNoAccessAll batches all removals into a single emit
      expect(onChange).toHaveBeenCalledTimes(1);
      const emitted = onChange.mock.calls[0][0];
      // Both created items should be removed, resulting in null (empty alterations)
      expect(emitted).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Remove Collection
  // ───────────────────────────────────────────────────────────
  describe('Remove Collection', () => {
    it('renders remove button for each collection row', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-remove-articles')).toBeInTheDocument();
    });

    it('calls onChange when removing a collection', async () => {
      const onChange = jest.fn();
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(
        <SystemPermissions {...defaultProps} value={value} onChange={onChange} />,
      );

      const removeBtn = screen.getByTestId('sp-remove-articles');
      await act(async () => { fireEvent.click(removeBtn); });

      expect(onChange).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Disabled State
  // ───────────────────────────────────────────────────────────
  describe('Disabled State', () => {
    it('does not render remove buttons when disabled', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} disabled />);
      expect(screen.queryByTestId('sp-remove-articles')).not.toBeInTheDocument();
    });

    it('does not render All/None shortcuts when disabled', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} disabled />);
      expect(screen.queryByTestId('sp-all-articles')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sp-none-articles')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Disabled Actions
  // ───────────────────────────────────────────────────────────
  describe('Disabled Actions', () => {
    it('shows disabled indicator for daas_extensions create and delete', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'daas_extensions', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-disabled-daas_extensions-create')).toBeInTheDocument();
      expect(screen.getByTestId('sp-disabled-daas_extensions-delete')).toBeInTheDocument();
      // read should still be a toggle
      expect(screen.getByTestId('sp-toggle-daas_extensions-read')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // App Access
  // ───────────────────────────────────────────────────────────
  describe('App Access', () => {
    it('shows reset controls when appAccess is true', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} appAccess />);
      expect(screen.getByTestId('sp-reset-minimum')).toBeInTheDocument();
      expect(screen.getByTestId('sp-reset-recommended')).toBeInTheDocument();
    });

    it('does not show reset controls when appAccess is false', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.queryByTestId('sp-reset-minimum')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sp-reset-recommended')).not.toBeInTheDocument();
    });

    it('opens reset dialog when clicking reset minimum', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} appAccess />);
      const resetBtn = screen.getByTestId('sp-reset-minimum');
      await act(async () => { fireEvent.click(resetBtn); });
      expect(screen.getByTestId('sp-reset-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('sp-reset-confirm')).toBeInTheDocument();
    });

    it('opens reset dialog when clicking reset recommended', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} appAccess />);
      const resetBtn = screen.getByTestId('sp-reset-recommended');
      await act(async () => { fireEvent.click(resetBtn); });
      expect(screen.getByTestId('sp-reset-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('sp-reset-confirm')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Add Collection
  // ───────────────────────────────────────────────────────────
  describe('Add Collection', () => {
    it('renders add collection button', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp-add-btn')).toBeInTheDocument();
    });

    it('opens add collection modal on click', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      const addBtn = screen.getByTestId('sp-add-btn');
      await act(async () => { fireEvent.click(addBtn); });
      expect(screen.getByTestId('sp-add-modal')).toBeInTheDocument();
      expect(screen.getByTestId('sp-add-search')).toBeInTheDocument();
    });

    it('does not show add button when disabled', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} disabled />);
      expect(screen.queryByTestId('sp-add-btn')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Permission Toggle (via Menu)
  // ───────────────────────────────────────────────────────────
  describe('Permission Toggle', () => {
    it('renders all 5 action toggles per collection row', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);

      for (const action of ['create', 'read', 'update', 'delete', 'share']) {
        expect(screen.getByTestId(`sp-toggle-articles-${action}`)).toBeInTheDocument();
      }
    });

    it('toggles display correct action text', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);

      const readToggle = screen.getByTestId('sp-toggle-articles-read');
      expect(readToggle).toHaveTextContent('R');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Multiple Collections
  // ───────────────────────────────────────────────────────────
  describe('Multiple Collections', () => {
    it('sorts collections alphabetically', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'products', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);

      const rows = screen.getAllByText(/^(articles|products)$/);
      expect(rows[0]).toHaveTextContent('articles');
      expect(rows[1]).toHaveTextContent('products');
    });
  });

  // ───────────────────────────────────────────────────────────
  // API Fetch
  // ───────────────────────────────────────────────────────────
  describe('API Fetch', () => {
    it('fetches permissions on mount when primaryKey is provided', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: [] });
      await renderWithProvider(<SystemPermissions {...defaultProps} />);

      await waitFor(() => {
        expect(mockedApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/api/permissions'),
        );
      });
    });

    it('does not fetch when primaryKey is "+"', async () => {
      await renderWithProvider(
        <SystemPermissions {...defaultProps} primaryKey="+" />,
      );
      expect(mockedApiRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/permissions'),
      );
    });

    it('does not fetch when primaryKey is null', async () => {
      await renderWithProvider(
        <SystemPermissions {...defaultProps} primaryKey={null} />,
      );
      expect(mockedApiRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/permissions'),
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles null value gracefully', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} value={null} />);
      expect(screen.getByTestId('sp')).toBeInTheDocument();
    });

    it('handles undefined value gracefully', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} value={undefined} />);
      expect(screen.getByTestId('sp')).toBeInTheDocument();
    });

    it('handles missing onChange gracefully', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      // Should not throw when clicking All shortcut
      const allBtn = screen.getByTestId('sp-all-articles');
      expect(() => fireEvent.click(allBtn)).not.toThrow();
    });

    it('handles empty collections array', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} collections={[]} />);
      expect(screen.getByTestId('sp')).toBeInTheDocument();
    });

    it('renders collection name even without meta', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'unknown_table', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByText('unknown_table')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Test ID Support
  // ───────────────────────────────────────────────────────────
  describe('Test ID Support', () => {
    it('passes data-testid to main container', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp')).toBeInTheDocument();
    });

    it('sets data-testid on empty state', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp-empty')).toBeInTheDocument();
    });

    it('sets data-testid on admin notice', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} adminAccess />);
      expect(screen.getByTestId('sp-admin-notice')).toBeInTheDocument();
    });

    it('sets data-testid on add collection button', async () => {
      await renderWithProvider(<SystemPermissions {...defaultProps} />);
      expect(screen.getByTestId('sp-add-btn')).toBeInTheDocument();
    });

    it('sets data-testid on row elements', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-row-articles')).toBeInTheDocument();
    });

    it('sets data-testid on toggle elements', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-toggle-articles-read')).toBeInTheDocument();
    });

    it('sets data-testid on remove button', async () => {
      const value: PermissionAlterations = {
        create: [
          { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        ],
        update: [],
        delete: [],
      };
      await renderWithProvider(<SystemPermissions {...defaultProps} value={value} />);
      expect(screen.getByTestId('sp-remove-articles')).toBeInTheDocument();
    });
  });
});

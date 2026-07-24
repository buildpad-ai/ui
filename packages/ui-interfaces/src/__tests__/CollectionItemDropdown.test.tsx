import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { CollectionItemDropdown } from '../collection-item-dropdown/CollectionItemDropdown';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('CollectionItemDropdown', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Basic Rendering', () => {
    it('renders with label and placeholder', () => {
      renderWithProvider(
        <CollectionItemDropdown
          label="Select Item"
          placeholder="Choose from collection"
          selectedCollection="users"
        />
      );

      expect(screen.getByText('Select Item')).toBeInTheDocument();
      expect(screen.getByTestId('collection-item-dropdown-placeholder')).toHaveTextContent('Choose from collection');
    });
  });

  describe('Value Normalization', () => {
    it('normalizes standard value object', async () => {
      const mockItems = [{ id: 'user-1', name: 'Alice' }];
      renderWithProvider(
        <CollectionItemDropdown
          value={{ key: 'user-1', collection: 'users' }}
          mockItems={mockItems}
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Alice');
      });
    });

    it('normalizes parsable JSON string value', async () => {
      const mockItems = [{ id: 'user-1', name: 'Alice' }];
      renderWithProvider(
        <CollectionItemDropdown
          value={'{"key":"user-1","collection":"users"}' as any}
          mockItems={mockItems}
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Alice');
      });
    });

    it('normalizes primitive string value using selectedCollection', async () => {
      const mockItems = [{ id: 'user-2', name: 'Bob' }];
      renderWithProvider(
        <CollectionItemDropdown
          value={'user-2' as any}
          mockItems={mockItems}
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Bob');
      });
    });

    it('normalizes full item object using primaryKey or id', async () => {
      const mockItems = [{ id: 'user-3', name: 'Charlie' }];
      renderWithProvider(
        <CollectionItemDropdown
          value={{ id: 'user-3', name: 'Charlie' } as any}
          mockItems={mockItems}
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Charlie');
      });
    });

    it('normalizes full item object using custom primaryKey', async () => {
      const mockItems = [{ custom_id: 'custom-1', name: 'Charlie' }];
      renderWithProvider(
        <CollectionItemDropdown
          value={{ custom_id: 'custom-1', name: 'Charlie' } as any}
          mockItems={mockItems}
          primaryKey="custom_id"
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Charlie');
      });
    });
  });

  describe('Display Item Resolution and Fetching', () => {
    it('fetches display item from API when not found in memory', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'user-9', name: 'Fetched User' } })
      });
      global.fetch = mockFetch;

      renderWithProvider(
        <CollectionItemDropdown
          value={{ key: 'user-9', collection: 'users' }}
          selectedCollection="users"
          template="{{name}}"
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/items/users/user-9');
      });

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('Fetched User');
      });
    });

    it('handles api fetch error gracefully and shows ID/Key', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Not Found'
      });
      global.fetch = mockFetch;

      renderWithProvider(
        <CollectionItemDropdown
          value={{ key: 'user-99', collection: 'users' }}
          selectedCollection="users"
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/items/users/user-99');
      });

      await waitFor(() => {
        expect(screen.getByTestId('collection-item-dropdown-selected-value')).toHaveTextContent('user-99');
      });
    });
  });
});

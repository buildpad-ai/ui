import React, { useState, useEffect, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Button,
  Stack,
  Alert,
  Code,
  Group,
  Text,
  Paper,
  Badge,
  Divider,
  Select,
  NumberInput,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconCloudDownload,
  IconUser,
  IconShield,
  IconLock,
  IconExternalLink,
  IconTable,
  IconDatabase,
} from '@tabler/icons-react';
import { VTable } from './VTable';
import type { HeaderRaw, Item, Sort } from './types';
import { DaaSProvider, useDaaSContext } from '@buildpad/services';

/**
 * VTable - DaaS Connected Playground
 *
 * This story connects to a real DaaS instance to fetch items and test
 * the VTable component with actual collection data.
 *
 * ## How It Works
 *
 * All API requests go through the **Storybook Host** app (`apps/storybook-host`),
 * a Next.js app that acts as an authentication proxy:
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:table`
 * 4. Open this story → select a collection → data loads from real DaaS
 *
 * In production (Amplify), the Storybook is served from the same origin
 * as the host app, so the proxy works without any configuration.
 */
const meta: Meta<typeof VTable> = {
  title: 'Tables/VTable',
  component: VTable,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect VTable to a real DaaS instance and test with actual collection data. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

// ============================================================================
// API Helpers — all requests go through /api/* (proxied to host app)
// ============================================================================

interface ConnectionStatus {
  connected: boolean;
  url: string | null;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    admin_access: boolean;
    status: string;
  } | null;
  error?: string;
}

async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) {
      return { connected: false, url: null, user: null, error: `Status check failed: ${response.status}` };
    }
    return await response.json();
  } catch {
    return {
      connected: false,
      url: null,
      user: null,
      error: 'Storybook Host app is not running. Start it with: pnpm dev:host',
    };
  }
}

interface FieldInfo {
  field: string;
  type: string;
  meta?: {
    interface?: string;
    hidden?: boolean;
    width?: string;
  };
}

async function fetchCollectionsFromDaaS(): Promise<string[]> {
  const response = await fetch('/api/collections', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || [])
    .map((c: { collection: string }) => c.collection)
    .filter((name: string) => name === 'daas_users' || !name.startsWith('daas_'));
}

async function fetchFieldsFromDaaS(collection: string): Promise<FieldInfo[]> {
  const response = await fetch(`/api/fields/${collection}`, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.data || [];
}

async function fetchItemsFromDaaS(
  collection: string,
  options: { limit?: number; offset?: number; sort?: string } = {},
): Promise<{ items: Item[]; total: number }> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.sort) params.set('sort', options.sort);
  params.set('meta', 'total_count');

  const response = await fetch(`/api/items/${collection}?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status}`);
  }
  const data = await response.json();
  return {
    items: data.data || [],
    total: data.meta?.total_count || data.data?.length || 0,
  };
}

// ============================================================================
// Auth Status Component
// ============================================================================

const AuthStatus: React.FC = () => {
  const { user, isAdmin, authLoading, authError } = useDaaSContext();

  if (authLoading) {
    return (
      <Paper p="sm" withBorder>
        <Group gap="xs">
          <IconUser size={16} />
          <Text size="sm" c="dimmed">Loading user...</Text>
        </Group>
      </Paper>
    );
  }

  if (authError) {
    return (
      <Alert color="red" icon={<IconLock size={16} />} title="Auth Error">
        {authError}
      </Alert>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between">
        <Group gap="sm">
          <IconUser size={20} />
          <div>
            <Text size="sm" fw={600}>
              {user.first_name} {user.last_name}
            </Text>
            <Text size="xs" c="dimmed">{user.email}</Text>
          </div>
        </Group>
        <Group gap="xs">
          {isAdmin && (
            <Badge color="green" leftSection={<IconShield size={10} />}>
              Admin
            </Badge>
          )}
          <Badge color={user.status === 'active' ? 'accent' : 'gray'}>
            {user.status}
          </Badge>
        </Group>
      </Group>
    </Paper>
  );
};

// ============================================================================
// DaaS Table Playground
// ============================================================================

const DaaSTablePlayground: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [headers, setHeaders] = useState<HeaderRaw[]>([]);
  const [activeCollection, setActiveCollection] = useState('');
  const [totalItems, setTotalItems] = useState(0);

  const [collection, setCollection] = useState(() =>
    localStorage.getItem('storybook_daas_table_collection') || 'interface_showcase',
  );
  const [collections, setCollections] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [selectedItems, setSelectedItems] = useState<unknown[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSelect, setShowSelect] = useState<'none' | 'one' | 'multiple'>('multiple');

  // Check connection and load collections on mount
  useEffect(() => {
    const init = async () => {
      const status = await checkConnection();
      setConnectionStatus(status);

      if (status.connected) {
        try {
          const cols = await fetchCollectionsFromDaaS();
          setCollections(cols);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load collections');
        }
      }

      setIsLoading(false);
    };
    init();
  }, []);

  // Persist selected collection
  useEffect(() => {
    localStorage.setItem('storybook_daas_table_collection', collection);
  }, [collection]);

  const loadData = useCallback(async () => {
    if (!collection) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch fields to generate headers
      const fields = await fetchFieldsFromDaaS(collection);

      const newHeaders: HeaderRaw[] = fields
        .filter((f) => !f.meta?.hidden && f.field !== 'id')
        .slice(0, 8)
        .map((f) => ({
          text: f.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          value: f.field,
          sortable: true,
          width: f.meta?.width === 'full' ? 300 : f.meta?.width === 'half' ? 200 : 150,
        }));

      newHeaders.unshift({ text: 'ID', value: 'id', sortable: true, width: 80 });

      const sortString = sort ? `${sort.desc ? '-' : ''}${sort.by}` : undefined;
      const { items: fetchedItems, total } = await fetchItemsFromDaaS(collection, {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        sort: sortString,
      });

      setHeaders(newHeaders);
      setItems(fetchedItems);
      setActiveCollection(collection);
      setTotalItems(total);
      setSelectedItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [collection, pageSize, currentPage, sort]);

  const handleRefreshConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const status = await checkConnection();
    setConnectionStatus(status);
    if (status.connected) {
      try {
        const cols = await fetchCollectionsFromDaaS();
        setCollections(cols);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      }
    }
    setIsLoading(false);
  }, []);

  const handleSortChange = (newSort: Sort | null) => {
    setSort(newSort);
    setCurrentPage(1);
  };

  const handleSelect = (item: Item) => {
    const itemId = item.id as string | number;
    if (showSelect === 'one') {
      setSelectedItems((selectedItems as (string | number)[]).includes(itemId) ? [] : [itemId]);
    } else if (showSelect === 'multiple') {
      setSelectedItems(
        (selectedItems as (string | number)[]).includes(itemId)
          ? (selectedItems as (string | number)[]).filter((id) => id !== itemId)
          : [...selectedItems, itemId],
      );
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // ── Loading state ──
  if (isLoading && !connectionStatus) {
    return (
      <Alert color="info">
        <Text size="sm">Checking connection to Storybook Host...</Text>
      </Alert>
    );
  }

  // ── Not connected ──
  if (!connectionStatus?.connected) {
    return (
      <Stack gap="md">
        <Alert
          color="yellow"
          title="Not Connected to DaaS"
          icon={<IconPlugConnectedX size={16} />}
        >
          <Stack gap="sm">
            <Text size="sm">
              Configure your DaaS connection in the <strong>Storybook Host</strong> app
              to use this playground.
            </Text>
            <Divider />
            <Text size="sm" fw={600}>Quick Start:</Text>
            <Code block style={{ fontSize: '11px' }}>
{`# 1. Start the host app
pnpm dev:host

# 2. Visit http://localhost:3000 and enter your DaaS URL + token

# 3. Refresh this page`}
            </Code>
            {connectionStatus?.error && (
              <Text size="sm" c="red">{connectionStatus.error}</Text>
            )}
          </Stack>
        </Alert>
        <Button
          variant="light"
          onClick={handleRefreshConnection}
          leftSection={<IconRefresh size={16} />}
          loading={isLoading}
        >
          Retry Connection
        </Button>
      </Stack>
    );
  }

  // ── Connected ──
  return (
    <DaaSProvider autoFetchUser>
      <Stack gap="lg">
        {/* Connection Info */}
        <Paper p="md" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600} size="lg">🔌 DaaS Connection</Text>
              <Badge color="green" leftSection={<IconPlugConnected size={12} />}>
                Connected
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">{connectionStatus.url}</Text>
              <Button
                variant="subtle"
                size="compact-xs"
                component="a"
                href="http://localhost:3000"
                target="_blank"
                leftSection={<IconExternalLink size={12} />}
              >
                Settings
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Auth Status */}
        <AuthStatus />

        {/* Collection Picker */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Divider label="Load Collection Data" labelPosition="center" />

            {collections.length > 0 ? (
              <Select
                label="Collection"
                placeholder="Select a collection..."
                data={collections}
                value={collection}
                onChange={(val) => setCollection(val || '')}
                searchable
                description={`${collections.length} collections available`}
                leftSection={<IconDatabase size={16} />}
              />
            ) : (
              <Alert color="yellow">
                No collections found. Check your DaaS connection.
              </Alert>
            )}

            <Group>
              <Button
                onClick={loadData}
                loading={isLoading}
                leftSection={<IconCloudDownload size={16} />}
                disabled={!collection}
              >
                Load Data
              </Button>

              {headers.length > 0 && (
                <Button
                  variant="light"
                  onClick={loadData}
                  leftSection={<IconRefresh size={16} />}
                >
                  Refresh
                </Button>
              )}
            </Group>

            {headers.length > 0 && (
              <Alert color="green" title={`Loaded ${headers.length} columns, ${totalItems} items from "${activeCollection}"`}>
                <Code block style={{ fontSize: '11px', maxHeight: '100px', overflow: 'auto' }}>
                  {headers.map((h) => h.value).join(', ')}
                </Code>
              </Alert>
            )}
          </Stack>
        </Paper>

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {/* Table + Settings */}
        {headers.length > 0 ? (
          <>
            {/* Table Settings */}
            <Paper p="md" withBorder>
              <Group gap="xl">
                <Select
                  label="Selection Mode"
                  data={[
                    { value: 'none', label: 'No Selection' },
                    { value: 'one', label: 'Single Selection' },
                    { value: 'multiple', label: 'Multiple Selection' },
                  ]}
                  value={showSelect}
                  onChange={(val) => setShowSelect(val as 'none' | 'one' | 'multiple')}
                  style={{ width: 180 }}
                />

                <NumberInput
                  label="Page Size"
                  value={pageSize}
                  onChange={(val) => {
                    setPageSize(Number(val) || 10);
                    setCurrentPage(1);
                  }}
                  min={5}
                  max={100}
                  step={5}
                  style={{ width: 100 }}
                />

                <Stack gap={4}>
                  <Text size="sm" fw={500}>Pagination</Text>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <Text size="sm">
                      Page {currentPage} of {totalPages || 1}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </Group>
                </Stack>
              </Group>
            </Paper>

            {/* Selection Status */}
            {showSelect !== 'none' && (
              <Text size="sm" c="dimmed">
                Selected: {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}
                {selectedItems.length > 0 && (
                  <>
                    {' '}— IDs: {selectedItems.slice(0, 5).join(', ')}
                    {selectedItems.length > 5 ? '...' : ''}
                  </>
                )}
              </Text>
            )}

            {/* Table */}
            <Paper p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <IconTable size={20} />
                  <Text fw={600}>Table: {activeCollection}</Text>
                </Group>
                <Badge color="accent">{totalItems} total items</Badge>
              </Group>

              <VTable
                headers={headers}
                items={items}
                showSelect={showSelect}
                value={selectedItems}
                sort={sort}
                onItemSelected={({ item }) => handleSelect(item)}
                onUpdate={setSelectedItems}
                onSortChange={handleSortChange}
                itemKey="id"
                fixedHeader
              />
            </Paper>

            {/* Current Sort */}
            {sort && (
              <Paper p="sm" withBorder>
                <Text size="sm">
                  <strong>Current Sort:</strong> {sort.by} ({sort.desc ? 'descending' : 'ascending'})
                </Text>
              </Paper>
            )}

            {/* Raw Data Preview */}
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                Raw Data {items.length > 0 ? `(first ${Math.min(3, items.length)} items)` : '(empty collection)'}:
              </Text>
              <Code block style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                {items.length > 0 ? JSON.stringify(items.slice(0, 3), null, 2) : '[]'}
              </Code>
            </Paper>
          </>
        ) : (
          <Alert color="info" title="Select a Collection" icon={<IconDatabase size={16} />}>
            <Text size="sm">
              Select a collection from the dropdown and click &quot;Load Data&quot; to see the table.
            </Text>
            <Text size="sm" mt="xs">
              <strong>Tip:</strong> The <Code>daas_users</Code> collection has sample data for testing.
            </Text>
          </Alert>
        )}
      </Stack>
    </DaaSProvider>
  );
};

// ============================================================================
// Story Export
// ============================================================================

/**
 * DaaS Connected Playground
 *
 * Connect to a real DaaS instance and test VTable with actual collection data.
 * Features pagination, sorting, and selection.
 */
export const Playground: StoryObj<typeof VTable> = {
  render: () => <DaaSTablePlayground />,
  parameters: {
    docs: {
      description: {
        story: `
## Authentication via Storybook Host

This playground uses the **Storybook Host** app as an authentication proxy:

1. The host app is a Next.js server with a catch-all \`/api/[...path]\` route
2. You configure DaaS URL + static token at the host's settings page
3. Credentials are stored in an encrypted httpOnly cookie
4. All \`/api/*\` requests are proxied through the host to DaaS with Bearer auth
5. **No CORS issues** — the browser never talks directly to DaaS

### Getting Started

\`\`\`bash
pnpm dev:host          # Start the host app (port 3000)
# Visit http://localhost:3000 to configure DaaS connection
pnpm storybook:table   # Start this Storybook (port 6007)
\`\`\`

### Production (AWS Amplify)

When deployed, the built Storybook is served from \`/storybook/table/\` on the
same origin as the host app — no proxy configuration needed.
        `,
      },
    },
  },
};

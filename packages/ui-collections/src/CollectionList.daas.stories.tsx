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
  ScrollArea,
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
  IconDatabase,
  IconList,
} from '@tabler/icons-react';
import { CollectionList } from './CollectionList';
import { DaaSProvider, useDaaSContext } from '@buildpad/services';

/**
 * CollectionList - DaaS Connected Playground
 *
 * This story connects to a real DaaS instance to test CollectionList
 * with actual collection data.
 *
 * ## How It Works
 *
 * All API requests go through the **Storybook Host** app (`apps/storybook-host`),
 * a Next.js app that acts as an authentication proxy:
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:collections`
 * 4. Open this story → select a collection → list loads from real DaaS
 *
 * In production (Amplify), the Storybook is served from the same origin
 * as the host app, so the proxy works without any configuration.
 */
const meta: Meta<typeof CollectionList> = {
  title: 'Collections/CollectionList',
  component: CollectionList,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect CollectionList to a real DaaS instance and browse collection data with search, pagination, and selection. Authentication is handled by the Storybook Host app.',
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

async function fetchCollectionsFromDaaS(): Promise<string[]> {
  const response = await fetch('/api/collections', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || [])
    .map((c: { collection: string }) => c.collection)
    .filter((name: string) => !name.startsWith('daas_'));
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
          <Badge color={user.status === 'active' ? 'blue' : 'gray'}>
            {user.status}
          </Badge>
        </Group>
      </Group>
    </Paper>
  );
};

// ============================================================================
// DaaS CollectionList Playground
// ============================================================================

const DaaSListPlayground: React.FC = () => {
  const [collection, setCollection] = useState(() =>
    localStorage.getItem('storybook_daas_collist_collection') || 'interface_showcase',
  );
  const [collections, setCollections] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const addLog = (msg: string) =>
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 50));

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
    localStorage.setItem('storybook_daas_collist_collection', collection);
  }, [collection]);

  const handleLoadCollection = useCallback(async () => {
    if (!collection) return;
    setShowList(true);
    setListKey((k) => k + 1);
  }, [collection]);

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

  // ── Loading state ──
  if (isLoading && !connectionStatus) {
    return (
      <Alert color="blue">
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
            <Divider label="Load Collection" labelPosition="center" />

            {collections.length > 0 ? (
              <Select
                label="Collection"
                placeholder="Select a collection..."
                data={collections}
                value={collection}
                onChange={(val) => {
                  setCollection(val || '');
                  setShowList(false);
                }}
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
                onClick={handleLoadCollection}
                loading={isLoading}
                leftSection={<IconCloudDownload size={16} />}
                disabled={!collection}
              >
                Load Collection
              </Button>

              {showList && (
                <Button
                  variant="light"
                  onClick={handleLoadCollection}
                  leftSection={<IconRefresh size={16} />}
                >
                  Refresh
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {/* Collection List */}
        {showList ? (
          <>
          <Paper p="md" withBorder>
            <Group gap="xs" mb="md">
              <IconList size={20} />
              <Text fw={600}>List: {collection}</Text>
            </Group>
            <CollectionList
              key={listKey}
              collection={collection}
              enableSearch
              enableSelection
              enableFilter
              enableCreate
              enableDelete
              enableSort
              enableResize
              enableReorder
              enableHeaderMenu
              limit={10}
              onCreate={() => addLog(`Create new item in "${collection}"`)}
              onItemClick={(item) => addLog(`Clicked: ${JSON.stringify(item)?.slice(0, 80)}`)}
              onEdit={(item) => addLog(`Edit: ${JSON.stringify(item)?.slice(0, 80)}`)}
              onDeleteSuccess={(ids) => addLog(`Deleted items: ${ids.join(', ')}`)}
            />
          </Paper>

          {/* Event Log */}
          <Paper p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>Event Log</Text>
              <Button variant="subtle" size="compact-xs" onClick={() => setEventLog([])}>
                Clear
              </Button>
            </Group>
            <ScrollArea h={120}>
              {eventLog.length === 0 ? (
                <Text size="xs" c="dimmed">No events yet — click rows, create, or delete to see callbacks</Text>
              ) : (
                eventLog.map((entry, i) => (
                  <Text key={i} size="xs" c="dimmed">{entry}</Text>
                ))
              )}
            </ScrollArea>
          </Paper>
          </>
        ) : (
          <Alert color="blue" title="Select a Collection" icon={<IconDatabase size={16} />}>
            <Text size="sm">
              Select a collection from the dropdown and click &quot;Load Collection&quot; to see the list.
            </Text>
            <Text size="sm" mt="xs">
              <strong>Tip:</strong> The <Code>interface_showcase</Code> collection has
              diverse field types for testing.
            </Text>
          </Alert>
        )}
      </Stack>
    </DaaSProvider>
  );
};

/**
 * DaaS Connected Playground
 *
 * Connect to a real DaaS instance and browse collection data with
 * search, pagination, and selection.
 */
export const Playground: StoryObj<typeof CollectionList> = {
  render: () => <DaaSListPlayground />,
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
pnpm dev:host               # Start the host app (port 3000)
# Visit http://localhost:3000 to configure DaaS connection
pnpm storybook:collections  # Start this Storybook (port 6008)
\`\`\`

### Production (AWS Amplify)

When deployed, the built Storybook is served from \`/storybook/collections/\` on the
same origin as the host app — no proxy configuration needed.
        `,
      },
    },
  },
};

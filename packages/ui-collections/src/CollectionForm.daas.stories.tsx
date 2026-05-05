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
  Switch,
  ScrollArea,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconCloudDownload,
  IconUser,
  IconShield,
  IconExternalLink,
  IconDatabase,
} from '@tabler/icons-react';
import { CollectionForm } from './CollectionForm';
import { DaaSProvider } from '@buildpad/services';

/** Stable config reference for proxy mode — empty URL produces relative /api/* paths */
const PROXY_DAAS_CONFIG = { url: '' } as const;

/**
 * CollectionForm - DaaS Connected Playground
 *
 * This story connects to a real DaaS instance to test CollectionForm
 * with actual collection schemas and data.
 *
 * ## How It Works
 *
 * All API requests go through the **Storybook Host** app (`apps/storybook-host`),
 * a Next.js app that acts as an authentication proxy:
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:collections`
 * 4. Open this story → select a collection → form loads from real DaaS
 *
 * In production (Amplify), the Storybook is served from the same origin
 * as the host app, so the proxy works without any configuration.
 */
const meta: Meta<typeof CollectionForm> = {
  title: 'Collections/CollectionForm',
  component: CollectionForm,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect CollectionForm to a real DaaS instance and test CRUD operations with actual collection schemas. Authentication is handled by the Storybook Host app.',
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
    .map((c: { collection: string }) => c.collection);
}

async function fetchItemIdsFromDaaS(collection: string): Promise<(string | number)[]> {
  const response = await fetch(`/api/items/${collection}?limit=20&fields=id`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || []).map((item: { id: string | number }) => item.id);
}

// ============================================================================
// Auth Status Component
// ============================================================================

interface AuthStatusProps {
  user: ConnectionStatus['user'] | null;
}

const AuthStatus: React.FC<AuthStatusProps> = ({ user }) => {
  if (!user) {
    return null;
  }

  const isAdmin = user.admin_access;

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
// DaaS CollectionForm Playground
// ============================================================================

const DaaSFormPlayground: React.FC = () => {
  const [collection, setCollection] = useState(() =>
    localStorage.getItem('storybook_daas_colform_collection') || 'interface_showcase',
  );
  const [collections, setCollections] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form controls
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [itemIds, setItemIds] = useState<(string | number)[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [formKey, setFormKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(true);
  const [showSaveOptions, setShowSaveOptions] = useState(true);
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
    localStorage.setItem('storybook_daas_colform_collection', collection);
  }, [collection]);

  const handleLoadCollection = useCallback(async () => {
    if (!collection) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch item IDs for edit mode
      const ids = await fetchItemIdsFromDaaS(collection);
      setItemIds(ids);
      if (ids.length > 0) {
        setSelectedItemId(String(ids[0]));
      }
      setShowForm(true);
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setIsLoading(false);
    }
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
          color="warning"
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
    <DaaSProvider config={PROXY_DAAS_CONFIG} autoFetchUser={false}>
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
        <AuthStatus user={connectionStatus.user} />

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
                  setShowForm(false);
                }}
                searchable
                description={`${collections.length} collections available`}
                leftSection={<IconDatabase size={16} />}
              />
            ) : (
              <Alert color="warning">
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

              {showForm && (
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

        {/* Form Controls + Rendering */}
        {showForm ? (
          <>
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Divider label="Form Settings" labelPosition="center" />

                <Group gap="xl">
                  <Switch
                    label="Edit Mode"
                    description={formMode === 'edit' ? 'Editing existing item' : 'Creating new item'}
                    checked={formMode === 'edit'}
                    onChange={(e) => {
                      setFormMode(e.currentTarget.checked ? 'edit' : 'create');
                      setFormKey((k) => k + 1);
                    }}
                  />
                  <Switch
                    label="Show Delete"
                    description="Show the delete button (edit mode)"
                    checked={showDelete}
                    onChange={(e) => {
                      setShowDelete(e.currentTarget.checked);
                      setFormKey((k) => k + 1);
                    }}
                  />
                  <Switch
                    label="Save Options"
                    description="Show save dropdown menu"
                    checked={showSaveOptions}
                    onChange={(e) => {
                      setShowSaveOptions(e.currentTarget.checked);
                      setFormKey((k) => k + 1);
                    }}
                  />

                  {formMode === 'edit' && itemIds.length > 0 && (
                    <Select
                      label="Item ID"
                      placeholder="Select an item..."
                      data={itemIds.map((id) => ({ value: String(id), label: String(id) }))}
                      value={selectedItemId}
                      onChange={(val) => {
                        setSelectedItemId(val || '');
                        setFormKey((k) => k + 1);
                      }}
                      description={`${itemIds.length} items available`}
                      style={{ width: 200 }}
                    />
                  )}
                </Group>
              </Stack>
            </Paper>

            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                📝 {formMode === 'create' ? 'Create' : 'Edit'}: {collection}
              </Text>
              <CollectionForm
                key={formKey}
                collection={collection}
                mode={formMode}
                id={formMode === 'edit' ? selectedItemId : undefined}
                showDelete={showDelete}
                showSaveOptions={showSaveOptions}
                onSuccess={(data) => addLog(`Saved: ${JSON.stringify(data)?.slice(0, 100)}`)}
                onCancel={() => addLog('Cancelled')}
                onDelete={() => addLog('Deleted item')}
                onNavigateToCreate={() => addLog('Navigate → new create form')}
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
                  <Text size="xs" c="dimmed">No events yet — save, cancel, or delete to see callbacks</Text>
                ) : (
                  eventLog.map((entry, i) => (
                    <Text key={i} size="xs" c="dimmed">{entry}</Text>
                  ))
                )}
              </ScrollArea>
            </Paper>
          </>
        ) : (
          <Alert color="info" title="Select a Collection" icon={<IconDatabase size={16} />}>
            <Text size="sm">
              Select a collection from the dropdown and click &quot;Load Collection&quot; to see the form.
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
 * Connect to a real DaaS instance and test CollectionForm with actual
 * collection schemas. Supports both create and edit modes.
 */
export const Playground: StoryObj<typeof CollectionForm> = {
  render: () => <DaaSFormPlayground />,
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

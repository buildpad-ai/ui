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
  Accordion,
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
} from '@tabler/icons-react';
import { VForm } from './VForm';
import type { Field } from '@buildpad/types';
import type { FieldValues } from './types';
import { DaaSProvider, useDaaSContext } from '@buildpad/services';

/**
 * VForm - DaaS Connected Playground
 *
 * This story connects to a real DaaS instance to fetch fields and test
 * the VForm component with actual collection schemas.
 *
 * ## How It Works
 *
 * All API requests go through the **Storybook Host** app (`apps/storybook-host`),
 * a Next.js app that acts as an authentication proxy:
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:form`
 * 4. Open this story → select a collection → fields load from real DaaS
 *
 * In production (Amplify), the Storybook is served from the same origin
 * as the host app, so the proxy works without any configuration.
 */
const meta: Meta<typeof VForm> = {
  title: 'Forms/VForm',
  component: VForm,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect VForm to a real DaaS instance and test with actual collection schemas. Authentication is handled by the Storybook Host app.',
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

async function fetchFieldsFromDaaS(collection: string): Promise<Field[]> {
  const response = await fetch(`/api/fields/${collection}`, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.data || [];
}

async function fetchCollectionsFromDaaS(): Promise<string[]> {
  const response = await fetch('/api/collections', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || [])
    .map((c: any) => c.collection)
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
// DaaS Playground
// ============================================================================

const DaaSPlayground: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [collection, setCollection] = useState(() =>
    localStorage.getItem('storybook_daas_collection') || 'interface_showcase'
  );
  const [values, setValues] = useState<FieldValues>({});
  const [collections, setCollections] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enforcePermissions, setEnforcePermissions] = useState(false);
  const [formAction, setFormAction] = useState<'create' | 'update' | 'read'>('create');
  const [accessibleFields, setAccessibleFields] = useState<string[]>([]);

  // Check connection and load collections on mount
  useEffect(() => {
    const init = async () => {
      const status = await checkConnection();
      setConnectionStatus(status);

      if (status.connected) {
        try {
          const cols = await fetchCollectionsFromDaaS();
          setCollections(cols);

          if (collection && cols.includes(collection)) {
            const loadedFields = await fetchFieldsFromDaaS(collection);
            setFields(loadedFields);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load collections');
        }
      }

      setIsLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selected collection
  useEffect(() => {
    localStorage.setItem('storybook_daas_collection', collection);
  }, [collection]);

  const handleLoadCollection = useCallback(async () => {
    if (!collection) return;
    setIsLoading(true);
    setError(null);
    try {
      const loadedFields = await fetchFieldsFromDaaS(collection);
      setFields(loadedFields);
      setValues({});
      setAccessibleFields([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fields');
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

  const handlePermissionsLoaded = useCallback((perms: string[]) => {
    setAccessibleFields(perms);
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
                onChange={(val) => setCollection(val || '')}
                searchable
                description={`${collections.length} collections available`}
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
                Load Fields
              </Button>

              {fields.length > 0 && (
                <Button
                  variant="light"
                  onClick={handleLoadCollection}
                  leftSection={<IconRefresh size={16} />}
                >
                  Refresh
                </Button>
              )}
            </Group>

            {fields.length > 0 && (
              <Alert color="green" title={`Loaded ${fields.length} fields from "${collection}"`}>
                <Code block style={{ fontSize: '11px', maxHeight: '100px', overflow: 'auto' }}>
                  {fields
                    .map((f) => `${f.field} (${f.type} → ${f.meta?.interface || 'auto'})`)
                    .join('\n')}
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

        {/* Form + Permission Settings */}
        {fields.length > 0 ? (
          <>
            <Accordion>
              <Accordion.Item value="permissions">
                <Accordion.Control icon={<IconShield size={16} />}>
                  Permission Settings
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <Switch
                      label="Enforce Field Permissions"
                      description="When enabled, only fields you have permission to access will be shown."
                      checked={enforcePermissions}
                      onChange={(e) => setEnforcePermissions(e.currentTarget.checked)}
                    />

                    <Select
                      label="Form Action"
                      description="The action type determines which permissions are checked"
                      data={[
                        { value: 'create', label: 'Create - Check create permissions' },
                        { value: 'update', label: 'Update - Check update permissions' },
                        { value: 'read', label: 'Read - Check read permissions' },
                      ]}
                      value={formAction}
                      onChange={(val) =>
                        setFormAction(val as 'create' | 'update' | 'read')
                      }
                    />

                    {enforcePermissions && accessibleFields.length > 0 && (
                      <Alert color="info" icon={<IconShield size={16} />}>
                        <Text size="sm" fw={600}>
                          {accessibleFields.includes('*')
                            ? 'Full field access (admin or wildcard permission)'
                            : `${accessibleFields.length} fields accessible for ${formAction}`}
                        </Text>
                        {!accessibleFields.includes('*') && (
                          <Code block style={{ fontSize: '11px', marginTop: '8px' }}>
                            {accessibleFields.join(', ')}
                          </Code>
                        )}
                      </Alert>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            <Paper p="md" withBorder>
              <Text fw={600} mb="md">📝 Form: {collection}</Text>
              <VForm
                fields={fields}
                modelValue={values}
                onUpdate={setValues}
                primaryKey={formAction === 'create' ? '+' : '1'}
                collection={collection}
                action={formAction}
                enforcePermissions={enforcePermissions}
                onPermissionsLoaded={handlePermissionsLoaded}
              />
            </Paper>

            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">Current Form Values:</Text>
              <Code block style={{ fontSize: '12px' }}>
                {JSON.stringify(values, null, 2)}
              </Code>
            </Paper>
          </>
        ) : (
          <Alert color="info" title="Select a Collection">
            <Text size="sm">
              Select a collection from the dropdown and click Load Fields to see the form.
            </Text>
            <Text size="sm" mt="xs">
              <strong>Tip:</strong> The <Code>interface_showcase</Code> collection has
              diverse field types including relational fields.
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
 * Connect to a real DaaS instance and test VForm with actual collection schemas.
 */
export const Playground: StoryObj<typeof VForm> = {
  render: () => <DaaSPlayground />,
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
pnpm storybook:form    # Start this Storybook (port 6006)
\`\`\`

### Production (AWS Amplify)

When deployed, the built Storybook is served from \`/storybook/form/\` on the
same origin as the host app — no proxy configuration needed.

### Permission Enforcement

Enable "Enforce Field Permissions" to test RBAC:

- **Field-Level Permissions**: Only show fields the user can access
- **Action-Based Filtering**: Different fields for create vs update vs read
- **Admin Bypass**: Admins see all fields regardless of permissions
        `,
      },
    },
  },
};

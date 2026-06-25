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
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconUser,
  IconShield,
  IconExternalLink,
  IconCloudDownload,
  IconFile,
} from '@tabler/icons-react';
import { DaaSProvider } from '@buildpad/services';
import { FileDetail } from './FileDetail';

/** Stable config reference for proxy mode — empty URL produces relative /api/* paths */
const PROXY_DAAS_CONFIG = { url: '' } as const;

/**
 * FileDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy), lists files
 * to pick from, then renders the detail view (preview + editable metadata).
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:files`
 */
const meta: Meta<typeof FileDetail> = {
  title: 'Files/FileDetail (DaaS)',
  component: FileDetail,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect FileDetail to a real DaaS instance, pick a file, and edit its metadata. Authentication is handled by the Storybook Host app.',
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

interface FileOption {
  value: string;
  label: string;
}

async function fetchFileOptionsFromDaaS(): Promise<FileOption[]> {
  const response = await fetch(
    '/api/files?limit=25&fields=id,title,filename_download&sort=-uploaded_on',
    { cache: 'no-store' },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || []).map(
    (f: { id: string; title?: string | null; filename_download?: string | null }) => ({
      value: f.id,
      label: f.title || f.filename_download || f.id,
    }),
  );
}

// ============================================================================
// Auth Status Component
// ============================================================================

const AuthStatus: React.FC<{ user: ConnectionStatus['user'] | null }> = ({ user }) => {
  if (!user) return null;
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
          {user.admin_access && (
            <Badge color="green" variant="light" leftSection={<IconShield size={10} />}>
              Admin
            </Badge>
          )}
          <Badge color={user.status === 'active' ? 'blue' : 'gray'} variant="light">{user.status}</Badge>
        </Group>
      </Group>
    </Paper>
  );
};

// ============================================================================
// DaaS FileDetail Playground
// ============================================================================

const DaaSFileDetailPlayground: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fileOptions, setFileOptions] = useState<FileOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeId, setActiveId] = useState<string>('');

  const loadFiles = useCallback(async () => {
    setError(null);
    try {
      const options = await fetchFileOptionsFromDaaS();
      setFileOptions(options);
      if (options.length > 0) setSelectedId((prev) => prev || options[0].value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const status = await checkConnection();
      setConnectionStatus(status);
      if (status.connected) await loadFiles();
      setIsLoading(false);
    };
    void init();
  }, [loadFiles]);

  const handleRefreshConnection = useCallback(async () => {
    setIsLoading(true);
    const status = await checkConnection();
    setConnectionStatus(status);
    if (status.connected) await loadFiles();
    setIsLoading(false);
  }, [loadFiles]);

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
        <Alert color="yellow" title="Not Connected to DaaS" icon={<IconPlugConnectedX size={16} />}>
          <Stack gap="sm">
            <Text size="sm">
              Configure your DaaS connection in the <strong>Storybook Host</strong> app to use
              this playground.
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
              <Badge color="green" variant="light" leftSection={<IconPlugConnected size={12} />}>Connected</Badge>
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

        {/* File Picker */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Divider label="Pick a File" labelPosition="center" />
            {fileOptions.length > 0 ? (
              <Select
                label="File"
                placeholder="Select a file..."
                data={fileOptions}
                value={selectedId}
                onChange={(val) => setSelectedId(val || '')}
                searchable
                description={`${fileOptions.length} most recent files`}
                leftSection={<IconFile size={16} />}
              />
            ) : (
              <Alert color="yellow">No files found in this instance. Upload one first.</Alert>
            )}
            <Group>
              <Button
                onClick={() => setActiveId(selectedId)}
                leftSection={<IconCloudDownload size={16} />}
                disabled={!selectedId}
              >
                Load File
              </Button>
              <Button variant="light" onClick={loadFiles} leftSection={<IconRefresh size={16} />}>
                Refresh list
              </Button>
            </Group>
          </Stack>
        </Paper>

        {error && (
          <Alert color="red" title="Error">{error}</Alert>
        )}

        {/* File Detail */}
        {activeId ? (
          <Paper p="md" withBorder>
            <FileDetail
              key={activeId}
              id={activeId}
              onDeleted={() => {
                setActiveId('');
                void loadFiles();
              }}
            />
          </Paper>
        ) : (
          <Alert color="blue" title="Select a File" icon={<IconFile size={16} />}>
            <Text size="sm">Pick a file above and click &quot;Load File&quot; to see the detail view.</Text>
          </Alert>
        )}
      </Stack>
    </DaaSProvider>
  );
};

/**
 * DaaS Connected Playground
 *
 * Connect to a real DaaS instance, pick a file, and edit its metadata.
 */
export const Playground: StoryObj<typeof FileDetail> = {
  render: () => <DaaSFileDetailPlayground />,
};

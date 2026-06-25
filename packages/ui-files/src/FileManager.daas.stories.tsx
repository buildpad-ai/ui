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
  SegmentedControl,
  Switch,
  NumberInput,
  VisuallyHidden,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconUser,
  IconShield,
  IconExternalLink,
  IconLayoutGrid,
  IconList,
} from '@tabler/icons-react';
import { DaaSProvider } from '@buildpad/services';
import { FileManager } from './FileManager';
import type { FilesView } from './FilesToolbar';

/** Stable config reference for proxy mode — empty URL produces relative /api/* paths */
const PROXY_DAAS_CONFIG = { url: '' } as const;

/**
 * FileManager — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the full file manager: upload, folders, grid/list, search, and bulk delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:files`
 */
const meta: Meta<typeof FileManager> = {
  title: 'Files/FileManager (DaaS)',
  component: FileManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect FileManager to a real DaaS instance and manage files end-to-end. Authentication is handled by the Storybook Host app.',
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
// DaaS FileManager Playground
// ============================================================================

const DaaSFileManagerPlayground: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Manager controls — changes remount FileManager via the derived key.
  const [view, setView] = useState<FilesView>('grid');
  const [enableFolders, setEnableFolders] = useState(true);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    checkConnection().then((status) => {
      setConnectionStatus(status);
      setIsLoading(false);
    });
  }, []);

  const handleRefreshConnection = useCallback(async () => {
    setIsLoading(true);
    const status = await checkConnection();
    setConnectionStatus(status);
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

        {/* Manager Settings */}
        <Paper p="md" withBorder>
          <Group gap="xl" align="flex-end">
            <Stack gap={4}>
              <Text size="sm" fw={500}>View</Text>
              <SegmentedControl
                value={view}
                onChange={(v) => setView(v as FilesView)}
                data={[
                  {
                    value: 'grid',
                    label: (
                      <>
                        <IconLayoutGrid size={16} />
                        <VisuallyHidden>Grid view</VisuallyHidden>
                      </>
                    ),
                  },
                  {
                    value: 'list',
                    label: (
                      <>
                        <IconList size={16} />
                        <VisuallyHidden>List view</VisuallyHidden>
                      </>
                    ),
                  },
                ]}
              />
            </Stack>
            <Switch
              label="Enable folders"
              checked={enableFolders}
              onChange={(e) => setEnableFolders(e.currentTarget.checked)}
            />
            <NumberInput
              label="Page size"
              value={pageSize}
              onChange={(val) => setPageSize(Number(val) || 24)}
              min={6}
              max={96}
              step={6}
              style={{ width: 110 }}
            />
          </Group>
        </Paper>

        {/* File Manager */}
        <Paper p="md" withBorder>
          <FileManager
            key={`${view}-${enableFolders}-${pageSize}`}
            pageSize={pageSize}
            defaultView={view}
            enableFolders={enableFolders}
          />
        </Paper>
      </Stack>
    </DaaSProvider>
  );
};

/**
 * DaaS Connected Playground
 *
 * Connect to a real DaaS instance and manage files with the full FileManager.
 */
export const Playground: StoryObj<typeof FileManager> = {
  render: () => <DaaSFileManagerPlayground />,
};

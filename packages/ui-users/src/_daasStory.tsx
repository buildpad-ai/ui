/**
 * Shared scaffolding for the `*.daas.stories.tsx` live-backend stories —
 * connection check against the Storybook Host proxy, connected/disconnected
 * states, and the DaaSProvider wrapper. Internal to the stories only
 * (underscore-prefixed, not exported from `index.ts`, not bundled by tsup).
 *
 * Mirrors the scaffold in `ui-files/src/FileManager.daas.stories.tsx`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconExternalLink,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconShield,
  IconUser,
} from '@tabler/icons-react';
import { DaaSProvider } from '@buildpad/services';

/** Stable config reference for proxy mode — empty URL produces relative /api/* paths */
export const PROXY_DAAS_CONFIG = { url: '' } as const;

export interface ConnectionStatus {
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

export async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) {
      return {
        connected: false,
        url: null,
        user: null,
        error: `Status check failed: ${response.status}`,
      };
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
            <Text size="xs" c="dimmed">
              {user.email}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          {user.admin_access && (
            <Badge color="green" variant="light" leftSection={<IconShield size={10} />}>
              Admin
            </Badge>
          )}
          <Badge color={user.status === 'active' ? 'blue' : 'gray'} variant="light">
            {user.status}
          </Badge>
        </Group>
      </Group>
    </Paper>
  );
};

/**
 * Wraps a live playground: checks the Storybook Host connection, renders
 * the disconnected/help states, and provides the DaaSProvider once connected.
 */
export const DaaSConnectionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading && !connectionStatus) {
    return (
      <Alert color="blue">
        <Text size="sm">Checking connection to Storybook Host...</Text>
      </Alert>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <Stack gap="md">
        <Alert color="yellow" title="Not Connected to DaaS" icon={<IconPlugConnectedX size={16} />}>
          <Stack gap="sm">
            <Text size="sm">
              Configure your DaaS connection in the <strong>Storybook Host</strong> app to use this
              playground.
            </Text>
            <Divider />
            <Text size="sm" fw={600}>
              Quick Start:
            </Text>
            <Code block style={{ fontSize: '11px' }}>
              {`# 1. Start the host app
pnpm dev:host

# 2. Visit http://localhost:3000 and enter your DaaS URL + token

# 3. Refresh this page`}
            </Code>
            {connectionStatus?.error && (
              <Text size="sm" c="red">
                {connectionStatus.error}
              </Text>
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

  return (
    <DaaSProvider config={PROXY_DAAS_CONFIG} autoFetchUser={false}>
      <Stack gap="lg">
        <Paper p="md" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600} size="lg">
                🔌 DaaS Connection
              </Text>
              <Badge color="green" variant="light" leftSection={<IconPlugConnected size={12} />}>
                Connected
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {connectionStatus.url}
              </Text>
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

        <AuthStatus user={connectionStatus.user} />

        {children}
      </Stack>
    </DaaSProvider>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
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
  TextInput,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
} from '@tabler/icons-react';
import { DaaSProvider } from '@buildpad/services';
import { FormBuilder } from './FormBuilder';

/**
 * FormBuilder — DaaS Connected Playground
 *
 * Drives the full builder against a real DaaS instance (via the Storybook Host
 * proxy): loads the target collection's field schema, places fields into
 * sections, sets width/required/readonly/hidden, authors conditions, and saves
 * a definition into the definitions collection.
 *
 * The Target collection is OPTIONAL and blank by default, so the playground
 * opens on the auto-create path: add fields, then Save, and the builder
 * provisions a `fb_` full collection (named from the screen name) and its
 * columns before persisting the definition. Enter an existing collection to
 * bind to it (hybrid) instead. Auto-create needs DaaS schema rights.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:forms` (port 6010)
 */

/** Stable config reference for proxy mode — empty URL produces relative /api/* paths. */
const PROXY_DAAS_CONFIG = { url: '' } as const;

interface ConnectionStatus {
  connected: boolean;
  url: string | null;
  error?: string;
}

async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) {
      return { connected: false, url: null, error: `Status check failed: ${response.status}` };
    }
    return await response.json();
  } catch {
    return {
      connected: false,
      url: null,
      error: 'Storybook Host app is not running. Start it with: pnpm dev:host',
    };
  }
}

const NotConnected: React.FC<{ status: ConnectionStatus | null; onRetry: () => void; loading: boolean }> = ({
  status,
  onRetry,
  loading,
}) => (
  <Stack gap="md">
    <Alert color="yellow" title="Not Connected to DaaS" icon={<IconPlugConnectedX size={16} />}>
      <Stack gap="sm">
        <Text size="sm">
          Configure your DaaS connection in the <strong>Storybook Host</strong> app to use this
          playground.
        </Text>
        <Divider />
        <Code block style={{ fontSize: 11 }}>
{`# 1. Start the host app
pnpm dev:host

# 2. Visit http://localhost:3000 and enter your DaaS URL + token

# 3. Refresh this page`}
        </Code>
        {status?.error && <Text size="sm" c="red">{status.error}</Text>}
      </Stack>
    </Alert>
    <Button variant="light" onClick={onRetry} leftSection={<IconRefresh size={16} />} loading={loading}>
      Retry Connection
    </Button>
  </Stack>
);

const DaaSFormBuilderPlayground: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Builder inputs. Target collection is OPTIONAL and blank by default: with it
  // empty the builder opens on the auto-create path (a `fb_` full collection is
  // provisioned from the screen name on the first save). Empty definitionId
  // means "create new" (the empty state).
  const [targetCollection, setTargetCollection] = useState('');
  const [formsCollection, setFormsCollection] = useState('fb_definitions');
  const [definitionId, setDefinitionId] = useState('');
  // Applied values drive the remount key so edits don't reload mid-build.
  const [applied, setApplied] = useState({ targetCollection: '', formsCollection: 'fb_definitions', definitionId: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(await checkConnection());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !status) {
    return <Alert color="blue"><Text size="sm">Checking connection to Storybook Host…</Text></Alert>;
  }
  if (!status?.connected) {
    return <NotConnected status={status} onRetry={refresh} loading={loading} />;
  }

  return (
    <DaaSProvider config={PROXY_DAAS_CONFIG} autoFetchUser={false}>
      <Stack gap="lg">
        <Paper p="md" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={600} size="lg">🔌 DaaS Connection</Text>
              <Badge color="green" variant="light" leftSection={<IconPlugConnected size={12} />}>Connected</Badge>
            </Group>
            <Text size="xs" c="dimmed">{status.url}</Text>
          </Group>
        </Paper>

        <Paper p="md" withBorder>
          <Group align="flex-end" gap="md">
            <TextInput
              label="Target collection"
              description="Blank = auto-create an fb_ collection on save"
              placeholder="blank = auto-create (needs schema rights)"
              value={targetCollection}
              onChange={(e) => setTargetCollection(e.currentTarget.value)}
            />
            <TextInput
              label="Definitions collection"
              value={formsCollection}
              onChange={(e) => setFormsCollection(e.currentTarget.value)}
            />
            <TextInput
              label="Definition id (blank = new)"
              placeholder="edit existing screen"
              value={definitionId}
              onChange={(e) => setDefinitionId(e.currentTarget.value)}
            />
            <Button onClick={() => setApplied({ targetCollection, formsCollection, definitionId })}>
              Load builder
            </Button>
          </Group>
        </Paper>

        <Paper p="md" withBorder>
          <FormBuilder
            key={`${applied.targetCollection}-${applied.formsCollection}-${applied.definitionId}`}
            targetCollection={applied.targetCollection || undefined}
            formsCollection={applied.formsCollection}
            definitionId={applied.definitionId || undefined}
            onSaved={(def) => console.log('Saved definition:', def)}
          />
        </Paper>
      </Stack>
    </DaaSProvider>
  );
};

const meta: Meta<typeof FormBuilder> = {
  title: 'Forms/FormBuilder (DaaS)',
  component: FormBuilder,
  tags: ['!autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;

/**
 * Connected playground. Leave the target collection blank to author a NEW screen
 * on the auto-create path (a `fb_` full collection is provisioned on save); enter
 * an existing collection to bind to it (hybrid). Leave the definition id blank to
 * create, or enter an existing id to EDIT a saved screen (populated canvas).
 */
export const Playground: StoryObj<typeof FormBuilder> = {
  render: () => <DaaSFormBuilderPlayground />,
};

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
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
} from '@tabler/icons-react';
import { DaaSProvider } from '@buildpad/services';
import type { FormDefinition } from '@buildpad/types';
import { DynamicForm } from './DynamicForm';
import { FormPreview } from './FormPreview';

/**
 * DynamicForm / FormPreview — DaaS Connected Playground
 *
 * `DynamicForm` loads a saved definition by id and renders the runtime form
 * (creating a real item on submit). `FormPreview` renders an in-memory draft
 * definition against empty values without persisting — the same surface the
 * builder shows while editing.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Configure the DaaS URL + token at http://localhost:3000
 * 3. Start this Storybook: `pnpm storybook:forms` (port 6010)
 */

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

/** A small in-memory draft for FormPreview — a `severity` conditional on `issue_type`. */
const sampleDefinition: FormDefinition = {
  name: 'Bug create screen (draft)',
  target_collection: 'issues',
  sections: [
    {
      id: 'main',
      title: 'Details',
      fields: [
        { field: 'title', width: 'full', required: true },
        { field: 'issue_type', width: 'half' },
        {
          field: 'severity',
          width: 'half',
          conditions: [
            {
              name: 'Show only for bugs',
              rule: { issue_type: { _eq: 'bug' } },
              hidden: false,
            },
            {
              name: 'Hide by default',
              rule: { issue_type: { _neq: 'bug' } },
              hidden: true,
            },
          ],
        },
      ],
    },
  ],
};

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

const DaaSDynamicFormPlayground: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [formsCollection, setFormsCollection] = useState('fb_definitions');
  const [definitionId, setDefinitionId] = useState('');
  const [applied, setApplied] = useState({ formsCollection: 'fb_definitions', definitionId: '' });

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

        <Tabs defaultValue="preview">
          <Tabs.List>
            <Tabs.Tab value="preview">FormPreview (draft)</Tabs.Tab>
            <Tabs.Tab value="fill">DynamicForm (fill by id)</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="preview" pt="md">
            <Paper p="md" withBorder>
              <Text size="sm" c="dimmed" mb="sm">
                Live preview of an in-memory draft. Set <Code>issue_type</Code> to <Code>bug</Code> to
                reveal the conditional <Code>severity</Code> field. Submitting does not persist.
              </Text>
              <FormPreview definition={sampleDefinition} />
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="fill" pt="md">
            <Paper p="md" withBorder>
              <Group align="flex-end" gap="md" mb="md">
                <TextInput
                  label="Definitions collection"
                  value={formsCollection}
                  onChange={(e) => setFormsCollection(e.currentTarget.value)}
                />
                <TextInput
                  label="Definition id"
                  placeholder="saved screen id"
                  value={definitionId}
                  onChange={(e) => setDefinitionId(e.currentTarget.value)}
                />
                <Button onClick={() => setApplied({ formsCollection, definitionId })}>
                  Load form
                </Button>
              </Group>
              {applied.definitionId ? (
                <DynamicForm
                  key={`${applied.formsCollection}-${applied.definitionId}`}
                  definitionId={applied.definitionId}
                  formsCollection={applied.formsCollection}
                  onSuccess={(data) => console.log('Created item:', data)}
                />
              ) : (
                <Alert color="blue" variant="light">
                  Enter a saved definition id and click “Load form”.
                </Alert>
              )}
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </DaaSProvider>
  );
};

const meta: Meta<typeof DynamicForm> = {
  title: 'Forms/DynamicForm (DaaS)',
  component: DynamicForm,
  tags: ['!autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;

/** Connected playground for the runtime renderer and the live preview. */
export const Playground: StoryObj<typeof DynamicForm> = {
  render: () => <DaaSDynamicFormPlayground />,
};

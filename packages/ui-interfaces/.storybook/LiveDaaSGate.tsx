import React, { useEffect, useState } from 'react';
import { Alert, Button, Code, Loader, Text } from '@mantine/core';

type HostStatus = 'checking' | 'connected' | 'disconnected' | 'unreachable';

// One status request per page load, shared by every live story on a docs page.
let statusRequest: Promise<HostStatus> | null = null;

function fetchHostStatus(): Promise<HostStatus> {
  statusRequest ??= fetch('/api/status', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return 'unreachable' as const;
      const data = (await res.json()) as { connected?: boolean };
      return data.connected ? ('connected' as const) : ('disconnected' as const);
    })
    .catch(() => 'unreachable' as const);
  return statusRequest;
}

/**
 * The host app's home page, where a DaaS instance is connected. On
 * ui.buildpad.ai the Storybooks are served under /storybook/ on the host's own
 * origin; in local dev the host runs on :3000 beside this Storybook.
 */
function connectUrl(): string {
  return window.location.pathname.startsWith('/storybook/')
    ? '/#connect'
    : 'http://localhost:3000/#connect';
}

/**
 * Renders a story that loads real DaaS data (`parameters: { liveDaaS: true }`)
 * only when the Storybook host app reports a connected instance. Otherwise it
 * explains how to connect, in place of the component's own configuration
 * error and its error toast.
 */
export function LiveDaaSGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [status, setStatus] = useState<HostStatus>(enabled ? 'checking' : 'connected');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchHostStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (status === 'connected') return <>{children}</>;

  if (status === 'checking') {
    return (
      <Text size="sm" c="dimmed">
        <Loader size="xs" mr="xs" />
        Checking the DaaS connection…
      </Text>
    );
  }

  return (
    <Alert color="primary" title="This story uses live DaaS data" maw={520}>
      {status === 'disconnected' ? (
        <Text size="sm" mb="sm">
          It loads a real relation and its items, and no DaaS instance is connected. Connect one on the Storybook home
          page, then come back to this story. The other stories use example data and work without one.
        </Text>
      ) : (
        <Text size="sm" mb="sm">
          It loads real data through the Storybook host app, which isn&apos;t reachable. Start it with{' '}
          <Code>pnpm dev:host</Code>, connect a DaaS instance at localhost:3000, then reload this story.
        </Text>
      )}
      <Button component="a" href={connectUrl()} target="_top" size="xs">
        Connect DaaS
      </Button>
    </Alert>
  );
}

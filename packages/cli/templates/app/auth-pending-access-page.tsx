/**
 * Pending Access Page (Engine project: My Apps sign-in)
 *
 * The callback route sends a My Apps user here when their account exists in
 * the project's Engine but holds no role yet. Their first sign-in created the
 * account; an administrator gives it a role in the Studio. The session was
 * ended, so signing in again after that lets them in.
 *
 * Under `/auth`, which the middleware serves without a session.
 *
 * @buildpad/origin: external-oauth-engine/pending-access
 * @buildpad/version: 1.0.0
 */

'use client';

import { Alert, Box, Button, Stack, Text, Title } from '@mantine/core';
import { IconClockHour4 } from '@tabler/icons-react';

export default function PendingAccessPage() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Stack gap="md" maw={480}>
        <Title order={2}>Your account is waiting for access</Title>
        <Alert icon={<IconClockHour4 size={18} />} color="yellow" variant="light">
          You signed in with My Apps, and your account in this application has been created. An
          administrator has not given it access yet.
        </Alert>
        <Text c="dimmed" size="sm">
          Ask an administrator of this application to give your account a role. Then sign in
          again with My Apps.
        </Text>
        <Button component="a" href="/login" variant="filled">
          Back to sign-in
        </Button>
      </Stack>
    </Box>
  );
}

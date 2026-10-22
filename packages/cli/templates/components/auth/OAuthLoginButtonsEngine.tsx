/**
 * OAuth Login Buttons Component (Engine project: XAppHub sign-in)
 *
 * Renders the "Continue with XAppHub" button, which starts the flow at
 * `/api/auth/oauth/my-apps`, and explains a failed sign-in from the
 * `?error=` code the callback route sets. On an Engine project XAppHub is the
 * only external sign-in.
 *
 * Usage (same props as the Supabase project's component):
 *   <OAuthLoginButtons showDivider />
 *   <OAuthLoginButtons returnTo="/dashboard" />
 *
 * @buildpad/origin: external-oauth-engine/OAuthLoginButtons
 * @buildpad/version: 1.0.0
 */

'use client';

import { Button, Stack, Divider, Text, Alert } from '@mantine/core';
import { IconKey, IconAlertCircle } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';

interface OAuthLoginButtonsProps {
  /**
   * Kept for the Supabase component's signature. Only `my-apps` is
   * available on an Engine project; any other list hides the button.
   */
  providers?: string[];

  /** Path to open after a successful sign-in. */
  returnTo?: string;

  /** Show "Or continue with" divider above the button. */
  showDivider?: boolean;
}

/** The callback's error codes (lib/oauth/engine.ts), in words for the user. */
const ERROR_MESSAGES: Record<string, string> = {
  sign_in_cancelled: 'The sign-in with XAppHub was cancelled.',
  sign_in_expired: 'The sign-in took too long or was started in another browser. Try again.',
  sign_in_failed: 'The sign-in with XAppHub did not complete. Try again.',
  sign_in_refused:
    'This application did not accept your XAppHub account. If you already have an account here with the same email, or you administer this project, sign in with your email and password instead.',
  account_disabled: 'Your account in this application is disabled. Contact an administrator.',
  engine_unavailable: 'The sign-in service is not available right now. Try again in a few minutes.',
  configuration_error: 'XAppHub sign-in is not set up for this application yet. Contact an administrator.',
};

export function OAuthLoginButtons({
  providers,
  returnTo,
  showDivider = false,
}: OAuthLoginButtonsProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (providers && !providers.includes('my-apps')) {
    return null;
  }

  const handleLogin = () => {
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    window.location.href = `/api/auth/oauth/my-apps${params.toString() ? `?${params}` : ''}`;
  };

  return (
    <Stack gap="sm">
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Sign-in failed">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.sign_in_failed}
        </Alert>
      )}

      {showDivider && (
        <Divider
          label={
            <Text size="sm" c="dimmed">
              Or continue with
            </Text>
          }
          labelPosition="center"
          my="md"
        />
      )}

      <Button variant="outline" leftSection={<IconKey size={20} />} onClick={handleLogin} fullWidth>
        Continue with XAppHub
      </Button>
    </Stack>
  );
}

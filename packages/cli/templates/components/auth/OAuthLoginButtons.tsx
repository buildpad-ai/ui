/**
 * OAuth Login Buttons Component
 *
 * Renders login buttons for configured OAuth providers.
 * Works with the `/api/auth/oauth/[provider]` route.
 *
 * Usage:
 *   <OAuthLoginButtons showDivider />
 *   <OAuthLoginButtons providers={['azure', 'google']} returnTo="/dashboard" />
 *
 * @buildpad/origin: components/auth/OAuthLoginButtons
 * @buildpad/version: 1.0.0
 */

'use client';

import { Button, Stack, Divider, Text, Alert } from '@mantine/core';
import {
  IconBrandAzure,
  IconBrandGoogle,
  IconKey,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

interface OAuthProviderUI {
  id: string;
  name: string;
  icon: ReactNode;
  color?: string;
}

/**
 * Available OAuth providers with their display metadata.
 * Add new providers here when you add them to /api/auth/oauth/[provider].
 */
const PROVIDERS: OAuthProviderUI[] = [
  {
    id: 'azure',
    name: 'Microsoft',
    icon: <IconBrandAzure size={20} />,
    color: '#0078d4',
  },
  {
    id: 'google',
    name: 'Google',
    icon: <IconBrandGoogle size={20} />,
    color: '#4285f4',
  },
  {
    id: 'okta',
    name: 'Okta',
    icon: <IconKey size={20} />,
    color: '#007dc1',
  },
  {
    id: 'auth0',
    name: 'Auth0',
    icon: <IconKey size={20} />,
    color: '#eb5424',
  },
  {
    id: 'generic',
    name: 'SSO',
    icon: <IconKey size={20} />,
  },
];

interface OAuthLoginButtonsProps {
  /**
   * Which providers to show. Shows all by default.
   * Example: providers={['azure', 'google']}
   */
  providers?: string[];

  /**
   * URL to redirect after successful login.
   */
  returnTo?: string;

  /**
   * Show "Or continue with" divider above buttons.
   */
  showDivider?: boolean;
}

/**
 * OAuth login buttons.
 *
 * @example
 * // Show all configured providers
 * <OAuthLoginButtons showDivider />
 *
 * // Show only Microsoft SSO
 * <OAuthLoginButtons providers={['azure']} />
 */
export function OAuthLoginButtons({
  providers,
  returnTo,
  showDivider = false,
}: OAuthLoginButtonsProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const availableProviders = providers
    ? PROVIDERS.filter((p) => providers.includes(p.id))
    : PROVIDERS;

  // Hide generic 'SSO' button when specific branded providers are also shown
  const displayProviders =
    availableProviders.length > 1
      ? availableProviders.filter((p) => p.id !== 'generic')
      : availableProviders;

  const handleOAuthLogin = (providerId: string) => {
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);

    const url = `/api/auth/oauth/${providerId}${params.toString() ? `?${params}` : ''}`;
    window.location.href = url;
  };

  if (displayProviders.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Login failed"
        >
          {decodeURIComponent(error)}
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

      {displayProviders.map((provider) => (
        <Button
          key={provider.id}
          variant="outline"
          leftSection={provider.icon}
          onClick={() => handleOAuthLogin(provider.id)}
          fullWidth
          styles={{
            root: provider.color
              ? {
                  borderColor: provider.color,
                  color: provider.color,
                  '&:hover': {
                    backgroundColor: `${provider.color}10`,
                  },
                }
              : undefined,
          }}
        >
          Continue with {provider.name}
        </Button>
      ))}
    </Stack>
  );
}

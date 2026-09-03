/**
 * Select Scope Page
 *
 * Onboarding page shown when a user has no active scope cookie:
 *  - Loading state while fetching available scopes
 *  - Auto-redirect when only one scope is available
 *  - Selection list when multiple scopes are available
 *  - "Contact admin" message when the user has no scope access at all
 *
 * Route: /select-scope
 * Add to middleware / layout to redirect here when daas_resource_uri is absent.
 *
 * @buildpad/origin: scope-routes/select-scope-page
 * @buildpad/version: 2.0.0
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocaleRouter } from '@/lib/i18n/navigation';
import { useI18n } from '@/lib/i18n/provider';
import {
  Stack,
  Title,
  Text,
  Button,
  Alert,
  Loader,
  Center,
  Paper,
  Group,
} from '@mantine/core';
import { IconAlertCircle, IconSitemap } from '@tabler/icons-react';
import { useDaaSContext } from '@/lib/buildpad/services';

const COOKIE_NAME = 'daas_resource_uri';
const COOKIE_MAX_AGE = 30 * 24 * 3600;

interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  selectable?: boolean;
  scope_type?: { name: string } | null;
}

export default function SelectScopePage() {
  const [scopes, setScopes] = useState<ScopeItem[] | null>(null); // null = loading
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useLocaleRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const { buildUrl, getHeaders } = useDaaSContext();

  useEffect(() => {
    fetch(buildUrl('/api/scope/available'), { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const selectable: ScopeItem[] = (data.data ?? []).filter(
          (s: ScopeItem) => s.selectable !== false,
        );

        // Auto-select if only one option
        if (selectable.length === 1) {
          document.cookie = `${COOKIE_NAME}=${encodeURIComponent(selectable[0].uri_path)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
          router.replace('/');
          return;
        }

        setScopes(selectable);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : t('app.scope.loadFailed'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectScope = (uri: string) => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(uri)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    router.push('/');
  };

  if (fetchError) {
    return (
      <Center h="100vh">
        <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('app.scope.errorTitle')}>
          {fetchError}
        </Alert>
      </Center>
    );
  }

  if (scopes === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (scopes.length === 0) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <IconSitemap size={48} stroke={1} color="var(--mantine-color-gray-5)" />
          <Title order={3}>{t('app.scope.noAccessTitle')}</Title>
          <Text c="dimmed" ta="center">
            {t('app.scope.noAccessBody')}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Center h="100vh">
      <Stack gap="lg" w={400}>
        <Stack gap={4}>
          <Title order={2}>{t('app.scope.selectTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('app.scope.selectSubtitle')}
          </Text>
        </Stack>

        {errorParam === 'access_denied' && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />}>
            {t('app.scope.accessDenied')}
          </Alert>
        )}
        {errorParam === 'invalid_scope' && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            {t('app.scope.invalidScope')}
          </Alert>
        )}

        <Stack gap="sm">
          {scopes.map((s) => (
            <Paper key={s.id} withBorder p="md" radius="md" style={{ cursor: 'pointer' }}>
              <Group justify="space-between" onClick={() => selectScope(s.uri_path)}>
                <Stack gap={2}>
                  <Text fw={500}>{s.name}</Text>
                  {s.scope_type && (
                    <Text size="xs" c="dimmed">
                      {s.scope_type.name}
                    </Text>
                  )}
                </Stack>
                <Button size="xs" variant="light">
                  {t('app.scope.select')}
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Center>
  );
}

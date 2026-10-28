/**
 * Login Page Template
 * 
 * Server-side proxy login page that uses the /api/auth/login proxy route
 * instead of calling Supabase directly from the browser.
 * This avoids CORS issues in the two-tier architecture.
 * 
 * Pattern: Browser → /api/auth/login (same origin) → Supabase Auth (server-side)
 * 
 * @buildpad/origin: pages/login
 * @buildpad/version: 2.0.0
 */

'use client';

import { useState } from 'react';
import {
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Box,
  Group,
  Anchor,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useI18n } from '@/lib/i18n/provider';
import { useLocaleRouter } from '@/lib/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { IconMail, IconLock, IconCheck, IconShield } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useLocaleRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) =>
        !value ? t('app.login.emailRequired') : /^\S+@\S+$/.test(value) ? null : t('app.login.emailInvalid'), // NOSONAR: simple two-quantifier regex on a short, self-typed form field, no exponential backtracking
      password: (value) => (!value ? t('app.login.passwordRequired') : null),
    },
  });

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);

    try {
      // Use the proxy route — NOT the Supabase client directly
      // This avoids CORS issues because the request stays same-origin
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include', // Include cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || t('app.login.failed'));
      }

      notifications.show({
        title: t('app.login.successTitle'),
        message: t('app.login.successMessage'),
        color: 'green',
      });

      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);
      notifications.show({
        title: t('app.login.errorTitle'),
        message: error instanceof Error ? error.message : t('app.login.errorMessage'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Left Column - Branding & Features (Visible from MD screen size up) */}
      <Box
        visibleFrom="md"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px 60px',
          // Fixed (non-inverting) brand hero: ink panel with an ember glow.
          // The panel stays dark in both colour schemes, so the copy below
          // uses fixed on-dark values rather than scheme-flipping tokens.
          background: 'var(--ds-brand-hero)',
          borderRight: '1px solid #23242a',
          color: '#f4f4f6',
        }}
      >
        {/* Brand Logo */}
        <Group gap="xs">
          <Box
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--ds-brand-mark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--ds-cta-shadow)',
            }}
          >
            <IconShield size={18} color="#ffffff" stroke={2} />
          </Box>
          <Text
            size="lg"
            fw={600}
            style={{
              fontFamily: 'var(--ds-font-display)',
              letterSpacing: 'var(--ds-letter-spacing-tight, -0.02em)',
            }}
          >
            Buildpad
          </Text>
        </Group>

        {/* Feature Presentation */}
        <Stack gap="xl" style={{ maxWidth: 460 }}>
          <Stack gap="xs">
            <Group gap="xs">
              <Box
                style={{
                  background: 'rgb(253 127 21 / 0.10)',
                  border: '1px solid rgb(253 127 21 / 0.30)',
                  borderRadius: 'var(--ds-radius-pill, 999px)',
                  padding: '4px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fd9843',
                    marginRight: 6,
                    animation: 'pulse 2s infinite',
                  }}
                />
                <Text size="xs" fw={500} style={{ color: '#feaa6b' }}>
                  {t('app.login.hero.badge')}
                </Text>
              </Box>
            </Group>
            <Title
              order={1}
              size="h1"
              style={{
                color: '#ffffff',
                fontFamily: 'var(--ds-font-display)',
                fontSize: 36,
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: 'var(--ds-letter-spacing-tighter, -0.03em)',
              }}
            >
              {t('app.login.hero.title')}
            </Title>
            <Text style={{ color: 'var(--ds-hero-sub)' }} size="md" lh={1.6}>
              {t('app.login.hero.subtitle')}
            </Text>
          </Stack>

          <Stack gap="lg" style={{ marginTop: 10 }}>
            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fd9843', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">{t('app.login.hero.feature1Title')}</Text>
                <Text size="xs" style={{ color: 'var(--ds-hero-sub)' }} lh={1.4}>
                  {t('app.login.hero.feature1Body')}
                </Text>
              </Box>
            </Group>

            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fd9843', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">{t('app.login.hero.feature2Title')}</Text>
                <Text size="xs" style={{ color: 'var(--ds-hero-sub)' }} lh={1.4}>
                  {t('app.login.hero.feature2Body')}
                </Text>
              </Box>
            </Group>

            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fd9843', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">{t('app.login.hero.feature3Title')}</Text>
                <Text size="xs" style={{ color: 'var(--ds-hero-sub)' }} lh={1.4}>
                  {t('app.login.hero.feature3Body')}
                </Text>
              </Box>
            </Group>
          </Stack>
        </Stack>

        {/* Footer / Trust Badge */}
        <Group justify="space-between" align="center" style={{ borderTop: '1px solid #23242a', paddingTop: 20 }}>
          <Text size="xs" style={{ color: '#8a8b94' }}>
            {t('app.login.hero.trust')}
          </Text>
          <Text size="xs" style={{ color: '#8a8b94' }} fw={600}>
            {t('app.login.hero.compliance')}
          </Text>
        </Group>
      </Box>

      {/* Right Column - Form Panel */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--mantine-color-body)',
          padding: '40px var(--mantine-spacing-xl)',
        }}
      >
        <Box style={{ width: '100%', maxWidth: 440 }}>
          {/* Logo representation on Mobile */}
          <Group gap="xs" mb={40} hiddenFrom="md" justify="center">
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--ds-brand-mark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--ds-cta-shadow)',
              }}
            >
              <IconShield size={16} color="#ffffff" stroke={2} />
            </Box>
            <Text
              size="md"
              fw={600}
              style={{
                fontFamily: 'var(--ds-font-display)',
                letterSpacing: 'var(--ds-letter-spacing-tight, -0.02em)',
              }}
            >
              Buildpad
            </Text>
          </Group>

          {/* Form card — hairline border + soft long shadow from the card tokens */}
          <Box
            p={{ base: 'lg', sm: 32 }}
            style={{
              background: 'var(--ds-card-bg)',
              border: '1px solid var(--ds-card-border)',
              borderRadius: 'var(--ds-radius-card)',
              boxShadow: 'var(--ds-card-shadow)',
            }}
          >
            <Group justify="space-between" align="flex-start" mb={30} wrap="nowrap">
              <Stack gap="xs" ta={{ base: 'center', md: 'left' }} style={{ flex: 1 }}>
                <Title order={2} style={{ letterSpacing: 'var(--ds-letter-spacing-tight, -0.02em)' }}>
                  {t('app.login.welcome')}
                </Title>
                <Text c="dimmed" size="sm">
                  {t('app.login.subtitle')}
                </Text>
              </Stack>
              <LanguageSwitcher />
            </Group>

            <form onSubmit={form.onSubmit(handleLogin)}>
              <Stack gap="md">
                <TextInput
                  label={t('app.login.email')}
                  placeholder={t('app.login.emailPlaceholder')}
                  required
                  size="md"
                  leftSection={<IconMail size={18} stroke={1.5} />}
                  {...form.getInputProps('email')}
                />

                <PasswordInput
                  label={t('app.login.password')}
                  placeholder="••••••••"
                  required
                  size="md"
                  leftSection={<IconLock size={18} stroke={1.5} />}
                  {...form.getInputProps('password')}
                />

                <Group justify="flex-end" mt={-5}>
                  <Anchor component="button" type="button" c="dimmed" size="xs" style={{ textDecoration: 'none' }}>
                    {t('app.login.forgotPassword')}
                  </Anchor>
                </Group>

                {/* No colour prop: the theme renders the default filled
                    Button as the ink CTA pill. */}
                <Button type="submit" fullWidth size="md" loading={loading}>
                  {t('app.login.submit')}
                </Button>
              </Stack>
            </form>
          </Box>

          {/* 
            Optional SSO Section. 
            If you have installed the `external-oauth` package, you can uncomment 
            the block below to integrate Single Sign-On.
          */}
          {/*
          <OAuthLoginButtons showDivider />
          */}

          <Text size="xs" c="dimmed" ta="center" mt={40}>
            {t('app.login.footer')}
          </Text>
        </Box>
      </Box>

      {/* Keyframe animation injected inline */}
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgb(253 152 67 / 0.4);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgb(253 152 67 / 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgb(253 152 67 / 0);
          }
        }
      `}</style>
    </Box>
  );
}

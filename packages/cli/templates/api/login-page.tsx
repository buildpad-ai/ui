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
 * @buildpad/version: 1.1.0
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
import { useRouter } from 'next/navigation';
import { IconMail, IconLock, IconCheck, IconShield } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (!value ? 'Email is required' : /^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (!value ? 'Password is required' : null),
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
        throw new Error(data.errors?.[0]?.message || 'Login failed');
      }

      notifications.show({
        title: 'Success',
        message: 'Logged in successfully',
        color: 'green',
      });

      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to login',
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
          background: 'radial-gradient(circle at 10% 20%, rgba(234, 88, 12, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(37, 99, 235, 0.12) 0%, transparent 45%), #030712',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
        }}
      >
        {/* Brand Logo */}
        <Group gap="xs">
          <Box
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
            }}
          >
            <IconShield size={18} color="#ffffff" stroke={2} />
          </Box>
          <Text size="lg" fw={700} style={{ letterSpacing: '0.5px' }}>
            Buildpad
          </Text>
        </Group>

        {/* Feature Presentation */}
        <Stack gap="xl" style={{ maxWidth: 460 }}>
          <Stack gap="xs">
            <Group gap="xs">
              <Box
                style={{
                  background: 'rgba(254, 215, 170, 0.1)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  borderRadius: 20,
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
                    background: '#fb923c',
                    marginRight: 6,
                    animation: 'pulse 2s infinite',
                  }}
                />
                <Text size="xs" fw={600} style={{ color: '#fdba74' }}>
                  Enterprise Platform
                </Text>
              </Box>
            </Group>
            <Title order={1} size="h1" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
              The design system for professional web apps.
            </Title>
            <Text style={{ color: '#cbd5e1' }} size="md" lh={1.6}>
              A comprehensive UI registry of copy-and-own components designed for high-performance enterprise applications.
            </Text>
          </Stack>

          <Stack gap="lg" style={{ marginTop: 10 }}>
            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fb923c', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">Role-Based Access Control</Text>
                <Text size="xs" style={{ color: '#cbd5e1' }} lh={1.4}>
                  Manage fine-grained permissions, roles, and users in real-time with an intuitive dashboard interface.
                </Text>
              </Box>
            </Group>

            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fb923c', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">Unified Design Tokens</Text>
                <Text size="xs" style={{ color: '#cbd5e1' }} lh={1.4}>
                  Maintain brand consistency using Tailwind slate neutrals, orange primary accents, and responsive typography.
                </Text>
              </Box>
            </Group>

            <Group align="flex-start" gap="md">
              <Box style={{ color: '#fb923c', marginTop: 2 }}>
                <IconCheck size={20} stroke={2.5} />
              </Box>
              <Box>
                <Text fw={600} size="sm">Secure Two-Tier Auth Proxy</Text>
                <Text size="xs" style={{ color: '#cbd5e1' }} lh={1.4}>
                  Avoid CORS issues with direct browser-to-proxy route mapping, providing enhanced security out of the box.
                </Text>
              </Box>
            </Group>
          </Stack>
        </Stack>

        {/* Footer / Trust Badge */}
        <Group justify="space-between" align="center" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 20 }}>
          <Text size="xs" style={{ color: '#94a3b8' }}>
            Protected by industry-standard encryption
          </Text>
          <Text size="xs" style={{ color: '#94a3b8' }} fw={600}>
            SOC2 & ISO 27001
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
        <Box style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo representation on Mobile */}
          <Group gap="xs" mb={40} hiddenFrom="md" justify="center">
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconShield size={16} color="#ffffff" stroke={2} />
            </Box>
            <Text size="md" fw={700}>
              Buildpad
            </Text>
          </Group>

          <Stack gap="xs" mb={30} ta={{ base: 'center', md: 'left' }}>
            <Title order={2} style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              Welcome back
            </Title>
            <Text c="dimmed" size="sm">
              Please sign in to access your account console
            </Text>
          </Stack>

          <form onSubmit={form.onSubmit(handleLogin)}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="you@company.com"
                required
                size="md"
                radius="md"
                leftSection={<IconMail size={18} stroke={1.5} />}
                {...form.getInputProps('email')}
              />

              <PasswordInput
                label="Password"
                placeholder="••••••••"
                required
                size="md"
                radius="md"
                leftSection={<IconLock size={18} stroke={1.5} />}
                {...form.getInputProps('password')}
              />

              <Group justify="flex-end" mt={-5}>
                <Anchor component="button" type="button" c="dimmed" size="xs" style={{ textDecoration: 'none' }}>
                  Forgot password?
                </Anchor>
              </Group>

              <Button
                type="submit"
                fullWidth
                size="md"
                radius="md"
                loading={loading}
                style={{
                  background: 'var(--ds-primary, #ea580c)',
                  transition: 'background-color 0.2s ease',
                }}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          {/* 
            Optional SSO Section. 
            If you have installed the `external-oauth` package, you can uncomment 
            the block below to integrate Single Sign-On.
          */}
          {/*
          <OAuthLoginButtons showDivider />
          */}

          <Text size="xs" c="dimmed" ta="center" mt={40}>
            Protected by Buildpad Secure Auth. Security policies apply.
          </Text>
        </Box>
      </Box>

      {/* Keyframe animation injected inline */}
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.4);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(251, 146, 60, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(251, 146, 60, 0);
          }
        }
      `}</style>
    </Box>
  );
}

'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  Notification,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBrandAzure,
  IconBrandGoogle,
  IconCheck,
  IconClockHour4,
  IconKey,
  IconLock,
  IconMail,
  IconShield,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import { CURRENT_USER } from '../data';
import styles from './sign-in.module.css';

/** Copy as shipped in lib/i18n/dictionaries/en.json (app.login.*). */
const COPY = {
  welcome: 'Welcome back',
  subtitle: 'Please sign in to access your account console',
  email: 'Email',
  emailPlaceholder: 'you@company.com',
  password: 'Password',
  forgotPassword: 'Forgot password?',
  submit: 'Sign In',
  footer: 'Protected by Buildpad Secure Auth. Security policies apply.',
  hero: {
    badge: 'Enterprise Platform',
    title: 'The design system for professional web apps.',
    subtitle:
      'A comprehensive UI registry of copy-and-own components designed for high-performance enterprise applications.',
    features: [
      {
        title: 'Role-Based Access Control',
        body: 'Manage fine-grained permissions, roles, and users in real-time with an intuitive dashboard interface.',
      },
      {
        title: 'Unified Design Tokens',
        body: 'Maintain brand consistency with ink and ember accents on cool neutral greys, and Inter typography.',
      },
      {
        title: 'Secure Two-Tier Auth Proxy',
        body: 'Avoid CORS issues with direct browser-to-proxy route mapping, providing enhanced security out of the box.',
      },
    ],
    trust: 'Protected by industry-standard encryption',
    compliance: 'SOC2 & ISO 27001',
  },
} as const;

/**
 * external-oauth's PROVIDERS, narrowed with providers={['azure', 'google']}.
 * The brand colours are the component's own, not theme tokens.
 */
const OAUTH_PROVIDERS: Array<{ id: string; name: string; icon: ReactNode; color?: string }> = [
  { id: 'azure', name: 'Microsoft', icon: <IconBrandAzure size={20} />, color: '#0078d4' },
  { id: 'google', name: 'Google', icon: <IconBrandGoogle size={20} />, color: '#4285f4' },
];

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  return {
    email: !email ? 'Email is required' : /^\S+@\S+$/.test(email) ? undefined : 'Invalid email',
    password: !password ? 'Password is required' : undefined,
  };
}

function BrandMark({ size }: { size: 'lg' | 'md' }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <div className="bp-brand-icon">
        <IconShield size={size === 'lg' ? 18 : 16} stroke={2} />
      </div>
      <Text size={size} fw={600} className={styles.brandName}>
        Buildpad
      </Text>
    </Group>
  );
}

function Hero() {
  return (
    <div className={styles.hero} data-mantine-color-scheme="dark">
      <BrandMark size="lg" />

      <Stack gap="xl" maw={460}>
        <Stack gap="xs">
          <Group gap="xs">
            <span className={styles.heroBadge}>
              <span className={styles.pulse} />
              <Text size="xs" fw={500} component="span">
                {COPY.hero.badge}
              </Text>
            </span>
          </Group>
          <Title order={1} className={styles.heroTitle}>
            {COPY.hero.title}
          </Title>
          <Text size="md" lh={1.6} className={styles.heroSub}>
            {COPY.hero.subtitle}
          </Text>
        </Stack>

        <Stack gap="lg" mt={10}>
          {COPY.hero.features.map((feature) => (
            <Group key={feature.title} align="flex-start" gap="md" wrap="nowrap">
              <IconCheck size={20} stroke={2.5} className={styles.heroCheck} />
              <Box>
                <Text fw={600} size="sm">
                  {feature.title}
                </Text>
                <Text size="xs" lh={1.4} className={styles.heroSub}>
                  {feature.body}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Stack>

      <div className={styles.heroFooter}>
        <Text size="xs">{COPY.hero.trust}</Text>
        <Text size="xs" fw={600}>
          {COPY.hero.compliance}
        </Text>
      </div>
    </div>
  );
}

/**
 * The form card from login-page.tsx. Submitting runs the same validation
 * rules and loading state; nothing is sent anywhere.
 */
function LoginCard({
  defaults,
  errors: presetErrors,
  loading: presetLoading = false,
}: {
  defaults?: { email?: string; password?: string };
  errors?: FieldErrors;
  loading?: boolean;
}) {
  const [errors, setErrors] = useState<FieldErrors>(presetErrors ?? {});
  const [loading, setLoading] = useState(presetLoading);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (presetLoading) return;
    const data = new FormData(event.currentTarget);
    const next = validate(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    timer.current = window.setTimeout(() => setLoading(false), 1400);
  };

  return (
    <div className={styles.card}>
      <Group justify="space-between" align="flex-start" mb={30} wrap="nowrap">
        <Stack gap="xs" className={styles.cardHeading}>
          <Title order={2}>{COPY.welcome}</Title>
          <Text c="dimmed" size="sm">
            {COPY.subtitle}
          </Text>
        </Stack>
      </Group>

      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            name="email"
            label={COPY.email}
            placeholder={COPY.emailPlaceholder}
            required
            size="md"
            autoComplete="off"
            defaultValue={defaults?.email}
            error={errors.email}
            onChange={() => errors.email && setErrors((e) => ({ ...e, email: undefined }))}
            leftSection={<IconMail size={18} stroke={1.5} />}
          />
          <PasswordInput
            name="password"
            label={COPY.password}
            placeholder="••••••••"
            required
            size="md"
            autoComplete="off"
            defaultValue={defaults?.password}
            error={errors.password}
            onChange={() => errors.password && setErrors((e) => ({ ...e, password: undefined }))}
            leftSection={<IconLock size={18} stroke={1.5} />}
          />
          <Group justify="flex-end" mt={-5}>
            <Anchor component="button" type="button" c="dimmed" size="xs">
              {COPY.forgotPassword}
            </Anchor>
          </Group>
          <Button type="submit" fullWidth size="md" loading={loading}>
            {COPY.submit}
          </Button>
        </Stack>
      </form>
    </div>
  );
}

function OAuthDivider() {
  return (
    <Divider
      label={
        <Text size="sm" c="dimmed">
          Or continue with
        </Text>
      }
      labelPosition="center"
      my="md"
    />
  );
}

/** external-oauth's OAuthLoginButtons with showDivider. */
function OAuthLoginButtons({ error }: { error?: string }) {
  return (
    <Stack gap="sm">
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Login failed">
          {error}
        </Alert>
      )}
      <OAuthDivider />
      {OAUTH_PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          variant="outline"
          leftSection={provider.icon}
          fullWidth
          styles={{
            root: provider.color ? { borderColor: provider.color, color: provider.color } : undefined,
          }}
        >
          Continue with {provider.name}
        </Button>
      ))}
    </Stack>
  );
}

/** external-oauth-engine's OAuthLoginButtons (XAppHub) with an ?error= code. */
function EngineOAuthButtons({ error }: { error?: string }) {
  return (
    <Stack gap="sm">
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Sign-in failed">
          {error}
        </Alert>
      )}
      <OAuthDivider />
      <Button variant="outline" leftSection={<IconKey size={20} />} fullWidth>
        Continue with XAppHub
      </Button>
    </Stack>
  );
}

function LoginPage() {
  return (
    <div className={styles.screen}>
      <div className={styles.split}>
        <Hero />
        <div className={styles.formSide}>
          <div className={styles.formColumn}>
            <div className={styles.mobileBrand}>
              <BrandMark size="md" />
            </div>
            <LoginCard />
            <OAuthLoginButtons />
            <Text size="xs" c="dimmed" ta="center" className={styles.footer}>
              {COPY.footer}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameCaption({ children }: { children: ReactNode }) {
  return <p className={styles.frameLabel}>{children}</p>;
}

/** The generated /login page: brand hero beside the sign-in card. */
export function SignInScreen() {
  return (
    <Gallery>
      <BrowserFrame url="/en/login" height={820}>
        <LoginPage />
      </BrowserFrame>
      <FrameCaption>
        <strong>Sign in, desktop.</strong> The hero is a fixed ink panel (<code>--ds-brand-hero</code>)
        that stays dark in both schemes; the submit button has no <code>color</code>, so it renders as
        the ink CTA pill. The SSO buttons are <code>OAuthLoginButtons showDivider</code> from{' '}
        <code>external-oauth</code>, which overrides the outline&apos;s border and text with each
        provider&apos;s brand colour through <code>styles.root</code>. With more than one locale, a <code>LanguageSwitcher</code> select
        also appears at the card&apos;s top right. Fields, validation and the loading state are live.
      </FrameCaption>
    </Gallery>
  );
}

/** The states the sign-in card moves through. */
export function SignInStates() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Invalid email"
          note={
            <>
              <code>useForm</code> validation: <code>error</code> on the field turns the border and
              message to <code>--ds-danger</code>. Empty fields are caught first by the native{' '}
              <code>required</code> check.
            </>
          }
        >
          <div className={styles.stateStage}>
            <LoginCard defaults={{ email: 'amelia.hart', password: 'correct-horse' }} errors={{ email: 'Invalid email' }} />
          </div>
        </Specimen>

        <Specimen
          label="Signing in"
          note={
            <>
              <code>loading</code> on the submit button while <code>/api/auth/login</code> answers —
              the pill keeps its width and the label is replaced by a loader.
            </>
          }
        >
          <div className={styles.stateStage}>
            <LoginCard defaults={{ email: CURRENT_USER.email, password: 'correct-horse' }} loading />
          </div>
        </Specimen>

        <Specimen
          label="Wrong password"
          note={
            <>
              A failed login calls <code>notifications.show(&#123; color: &apos;red&apos; &#125;)</code>,
              top-right. <code>@mantine/notifications</code> is not loaded here, so this is the core{' '}
              <code>Notification</code> it renders.
            </>
          }
        >
          <div className={styles.stateStage}>
            <Stack gap="md">
              <Notification color="red" title="Error" closeButtonProps={{ 'aria-label': 'Dismiss' }}>
                Invalid login credentials
              </Notification>
              <LoginCard defaults={{ email: CURRENT_USER.email, password: 'wrong-password' }} />
            </Stack>
          </div>
        </Specimen>

        <Specimen
          label="SSO sign-in failed"
          note={
            <>
              The callback redirects back with <code>?error=</code>; the OAuth buttons show it as a{' '}
              <code>color=&quot;red&quot;</code> Alert — here the XAppHub variant from{' '}
              <code>external-oauth-engine</code>.
            </>
          }
        >
          <div className={styles.stateStage}>
            <EngineOAuthButtons error="The sign-in took too long or was started in another browser. Try again." />
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The sign-in page at phone width, beside the XAppHub pending-access page. */
export function SignInPhoneAndPending() {
  return (
    <Gallery>
      <div className={styles.frameRow}>
        <div>
          <BrowserFrame url="/en/login" height={800}>
            <LoginPage />
          </BrowserFrame>
          <FrameCaption>
            <strong>Phone width.</strong> Below <code>md</code> the hero is hidden and a compact brand
            mark sits above the card, which tightens to <code>lg</code> padding and centres its heading.
          </FrameCaption>
        </div>
        <div>
          <BrowserFrame url="/en/auth/pending-access" height={800}>
            <div className={styles.pending}>
              <Stack gap="md" maw={480}>
                <Title order={2}>Your account is waiting for access</Title>
                <Alert icon={<IconClockHour4 size={18} />} color="yellow" variant="light">
                  You signed in with XAppHub, and your account in this application has been created. An
                  administrator has not given it access yet.
                </Alert>
                <Text c="dimmed" size="sm">
                  Ask an administrator of this application to give your account a role. Then sign in
                  again with XAppHub.
                </Text>
                <Button component="a" href="#" onClick={(e) => e.preventDefault()} variant="filled">
                  Back to sign-in
                </Button>
              </Stack>
            </div>
          </BrowserFrame>
          <FrameCaption>
            <strong>Pending access.</strong> Where the XAppHub callback sends a user whose account has
            no role yet: a warning Alert (<code>color=&quot;yellow&quot;</code>) and an ink{' '}
            <code>variant=&quot;filled&quot;</code> button back to sign-in.
          </FrameCaption>
        </div>
      </div>
    </Gallery>
  );
}

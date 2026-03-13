/**
 * OAuth Provider Configuration
 *
 * Generic OAuth2/OIDC configuration for external identity providers.
 * Next.js acts as the OAuth client, handling the full OAuth flow.
 *
 * @buildpad/origin: lib/oauth/config
 * @buildpad/version: 1.0.0
 * @see .github/skills/add-external-oauth/SKILL.md for architecture details
 */

export interface OAuthProviderConfig {
  /** OAuth client ID registered with the provider */
  clientId: string;
  /** OAuth client secret (keep secure, never expose to browser) */
  clientSecret: string;
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** UserInfo endpoint URL (optional, if ID token doesn't have enough claims) */
  userInfoUrl?: string;
  /** JWKS URI for ID token validation */
  jwksUri?: string;
  /** Expected issuer in ID token */
  issuer?: string;
  /** OAuth scopes to request */
  scopes: string[];
  /** Additional authorization parameters */
  authParams?: Record<string, string>;
}

export type SupportedProvider = 'generic' | 'azure' | 'google' | 'okta' | 'auth0';

/**
 * Generic OAuth2/OIDC provider configuration.
 * All settings come from environment variables.
 */
export function getGenericOAuthConfig(): OAuthProviderConfig {
  const baseUrl = process.env.OAUTH_PROVIDER_BASE_URL;

  return {
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    authorizationUrl:
      process.env.OAUTH_AUTHORIZATION_URL ||
      `${baseUrl}/oauth2/authorize`,
    tokenUrl:
      process.env.OAUTH_TOKEN_URL ||
      `${baseUrl}/oauth2/token`,
    userInfoUrl: process.env.OAUTH_USERINFO_URL,
    jwksUri: process.env.OAUTH_JWKS_URI,
    issuer: process.env.OAUTH_ISSUER,
    scopes: (process.env.OAUTH_SCOPES || 'openid email profile').split(' '),
    authParams: process.env.OAUTH_AUTH_PARAMS
      ? JSON.parse(process.env.OAUTH_AUTH_PARAMS)
      : undefined,
  };
}

/**
 * Azure AD / Entra ID configuration.
 */
export function getAzureADConfig(): OAuthProviderConfig {
  const tenantId = process.env.AZURE_AD_TENANT_ID || 'common';

  return {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    authParams: {
      prompt: 'select_account', // Force account selection
    },
  };
}

/**
 * Google OAuth configuration.
 */
export function getGoogleConfig(): OAuthProviderConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    scopes: ['openid', 'email', 'profile'],
  };
}

/**
 * Okta configuration.
 */
export function getOktaConfig(): OAuthProviderConfig {
  const domain = process.env.OKTA_DOMAIN!; // e.g., dev-123456.okta.com

  return {
    clientId: process.env.OKTA_CLIENT_ID!,
    clientSecret: process.env.OKTA_CLIENT_SECRET!,
    authorizationUrl: `https://${domain}/oauth2/default/v1/authorize`,
    tokenUrl: `https://${domain}/oauth2/default/v1/token`,
    userInfoUrl: `https://${domain}/oauth2/default/v1/userinfo`,
    jwksUri: `https://${domain}/oauth2/default/v1/keys`,
    issuer: `https://${domain}/oauth2/default`,
    scopes: ['openid', 'email', 'profile'],
  };
}

/**
 * Auth0 configuration.
 */
export function getAuth0Config(): OAuthProviderConfig {
  const domain = process.env.AUTH0_DOMAIN!; // e.g., myapp.auth0.com

  return {
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    authorizationUrl: `https://${domain}/authorize`,
    tokenUrl: `https://${domain}/oauth/token`,
    userInfoUrl: `https://${domain}/userinfo`,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    issuer: `https://${domain}/`,
    scopes: ['openid', 'email', 'profile'],
  };
}

/**
 * Get provider configuration by name.
 * Falls back to generic config if provider-specific env vars are not set.
 */
export function getProviderConfig(provider: string): OAuthProviderConfig {
  switch (provider) {
    case 'azure':
      if (!process.env.AZURE_AD_CLIENT_ID) {
        throw new Error('AZURE_AD_CLIENT_ID is required for Azure AD provider');
      }
      return getAzureADConfig();

    case 'google':
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID is required for Google provider');
      }
      return getGoogleConfig();

    case 'okta':
      if (!process.env.OKTA_CLIENT_ID || !process.env.OKTA_DOMAIN) {
        throw new Error('OKTA_CLIENT_ID and OKTA_DOMAIN are required for Okta provider');
      }
      return getOktaConfig();

    case 'auth0':
      if (!process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_DOMAIN) {
        throw new Error('AUTH0_CLIENT_ID and AUTH0_DOMAIN are required for Auth0 provider');
      }
      return getAuth0Config();

    case 'generic':
    default:
      if (!process.env.OAUTH_CLIENT_ID) {
        throw new Error('OAUTH_CLIENT_ID is required for generic OAuth provider');
      }
      return getGenericOAuthConfig();
  }
}

/**
 * Validate that required environment variables are set for a provider.
 */
export function validateProviderEnv(provider: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  switch (provider) {
    case 'azure':
      if (!process.env.AZURE_AD_CLIENT_ID) missing.push('AZURE_AD_CLIENT_ID');
      if (!process.env.AZURE_AD_CLIENT_SECRET) missing.push('AZURE_AD_CLIENT_SECRET');
      break;

    case 'google':
      if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
      if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
      break;

    case 'okta':
      if (!process.env.OKTA_CLIENT_ID) missing.push('OKTA_CLIENT_ID');
      if (!process.env.OKTA_CLIENT_SECRET) missing.push('OKTA_CLIENT_SECRET');
      if (!process.env.OKTA_DOMAIN) missing.push('OKTA_DOMAIN');
      break;

    case 'auth0':
      if (!process.env.AUTH0_CLIENT_ID) missing.push('AUTH0_CLIENT_ID');
      if (!process.env.AUTH0_CLIENT_SECRET) missing.push('AUTH0_CLIENT_SECRET');
      if (!process.env.AUTH0_DOMAIN) missing.push('AUTH0_DOMAIN');
      break;

    case 'generic':
    default:
      if (!process.env.OAUTH_CLIENT_ID) missing.push('OAUTH_CLIENT_ID');
      if (!process.env.OAUTH_CLIENT_SECRET) missing.push('OAUTH_CLIENT_SECRET');
      if (!process.env.OAUTH_AUTHORIZATION_URL && !process.env.OAUTH_PROVIDER_BASE_URL) {
        missing.push('OAUTH_AUTHORIZATION_URL or OAUTH_PROVIDER_BASE_URL');
      }
      if (!process.env.OAUTH_TOKEN_URL && !process.env.OAUTH_PROVIDER_BASE_URL) {
        missing.push('OAUTH_TOKEN_URL or OAUTH_PROVIDER_BASE_URL');
      }
      break;
  }

  // Common required variable
  if (!process.env.OAUTH_STATE_SECRET) missing.push('OAUTH_STATE_SECRET');

  return { valid: missing.length === 0, missing };
}

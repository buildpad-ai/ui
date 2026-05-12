import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

/**
 * Playwright Configuration for buildpad-ui
 * 
 * Supports two testing modes:
 * 1. DaaS E2E Tests - Against the hosted DaaS instance (requires auth)
 * 2. Storybook Component Tests - Against local Storybook (no auth needed)
 * 
 * @see https://playwright.dev/docs/test-configuration
 */

// URLs from environment
const DAAS_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL || 'http://localhost:3000';
const STORYBOOK_FORM_URL = process.env.STORYBOOK_FORM_URL || 'http://localhost:6006';
const STORYBOOK_TABLE_URL = process.env.STORYBOOK_TABLE_URL || 'http://localhost:6007';
const STORYBOOK_INTERFACES_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';
const STORYBOOK_COLLECTIONS_URL = process.env.STORYBOOK_COLLECTIONS_URL || 'http://localhost:6008';

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL - uses remote DaaS instance from .env.local */
    baseURL: DAAS_URL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project - runs once before DaaS tests (authentication)
    { 
      name: 'setup', 
      testMatch: /.*\.setup\.ts/ 
    },
    
    // DaaS E2E Tests - requires authentication
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
      testIgnore: /.*storybook.*\.spec\.ts/,  // Exclude Storybook tests
    },

    // Storybook Component Tests - no auth needed
    {
      name: 'storybook-form',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_FORM_URL,
      },
      testMatch: /ui-form\/.*storybook.*\.spec\.ts/,
      // No setup dependency - Storybook tests don't need auth
    },

    // Storybook Table Component Tests - no auth needed
    {
      name: 'storybook-table',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_TABLE_URL,
      },
      testMatch: /ui-table\/.*storybook.*\.spec\.ts/,
      // No setup dependency - Storybook tests don't need auth
    },

    // Storybook Interfaces Component Tests - no auth needed
    {
      name: 'storybook-interfaces',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_INTERFACES_URL,
      },
      testMatch: /ui-interfaces\/.*storybook.*\.spec\.ts/,
      // No setup dependency - Storybook tests don't need auth
    },

    // Storybook Collections Component Tests - no auth needed
    {
      name: 'storybook-collections',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_COLLECTIONS_URL,
      },
      testMatch: /ui-collections\/.*storybook.*\.spec\.ts/,
      // No setup dependency - Storybook tests don't need auth
    },
  ],

  /* 
   * Web server configuration for Storybook tests
   * Automatically starts Storybook when running storybook project
   * Set SKIP_WEBSERVER=true to skip starting web servers (useful when already running)
   */
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      command: 'cd packages/ui-form && npx storybook dev -p 6006 --ci',
      url: STORYBOOK_FORM_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 minutes to start Storybook
    },
    {
      command: 'cd packages/ui-table && npx storybook dev -p 6007 --ci',
      url: STORYBOOK_TABLE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 minutes to start Storybook
    },
    {
      command: 'cd packages/ui-interfaces && npx storybook dev -p 6005 --ci',
      url: STORYBOOK_INTERFACES_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 minutes to start Storybook
    },
    {
      command: 'cd packages/ui-collections && npx storybook dev -p 6008 --ci',
      url: STORYBOOK_COLLECTIONS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 minutes to start Storybook
    },
  ],
});

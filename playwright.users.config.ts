import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const STORYBOOK_USERS_URL = process.env.STORYBOOK_USERS_URL || 'http://localhost:6011';
const HOST_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/ui-users',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report-users' }]],

  globalSetup: './tests/ui-users/helpers/users-rbac-setup.ts',
  globalTeardown: './tests/ui-users/helpers/users-rbac-teardown.ts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'users-api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No baseURL — specs hit USERS_DAAS_URL directly via fetch
      },
    },
    {
      name: 'users-storybook',
      testMatch: /.*\.storybook\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_USERS_URL,
      },
    },
  ],

  /*
   * Web servers for the storybook project.
   * Set SKIP_WEBSERVER=true if both are already running.
   */
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'cd packages/ui-users && npx storybook dev -p 6011 --ci',
          url: STORYBOOK_USERS_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter storybook-host dev',
          url: HOST_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const STORYBOOK_FILES_URL = process.env.STORYBOOK_FILES_URL || 'http://localhost:6009';
const HOST_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/ui-files',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report-files' }]],

  globalSetup: './tests/ui-files/helpers/files-rbac-setup.ts',
  globalTeardown: './tests/ui-files/helpers/files-rbac-teardown.ts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'files-api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No baseURL — specs hit FILES_DAAS_URL directly via request
      },
    },
    {
      name: 'files-storybook',
      testMatch: /.*\.storybook\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: STORYBOOK_FILES_URL,
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
          command: 'cd packages/ui-files && npx storybook dev -p 6009 --ci',
          url: STORYBOOK_FILES_URL,
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

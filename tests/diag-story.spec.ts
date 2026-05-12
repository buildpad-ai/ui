import { test } from '@playwright/test';
test('diagnostic', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('http://localhost:6009/iframe.html?id=collections-collectionform--create-mode&viewMode=story');
  await page.waitForTimeout(3000);
  const errorMsg = await page.locator('#error-message').textContent().catch(() => 'no error element');
  const errorStack = await page.locator('#error-stack').textContent().catch(() => 'no stack');
  const root = await page.locator('#storybook-root').innerHTML().catch(() => 'failed');
  console.log('ERROR MESSAGE:', errorMsg);
  console.log('ERROR STACK:', errorStack?.substring(0, 500));
  console.log('CONSOLE ERRORS:', errors.slice(0, 5));
  console.log('ROOT HTML (first 500 chars):', root.substring(0, 500));
});

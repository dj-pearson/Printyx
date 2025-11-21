import { test, expect } from '@playwright/test';

test('homepage unauthenticated loads marketing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Printyx/i);
});

test('login form renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});

test('app shell loads after auth cookie (smoke)', async ({ page, context }) => {
  // Set demo auth localStorage to simulate demo mode paths
  await page.addInitScript(() => {
    localStorage.setItem('demo-authenticated', 'true');
    localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
  });
  await page.goto('/');
  // Navigate to CRM Dashboard if accessible
  await page.goto('/crm');
  await expect(page.locator('text=CRM')).toBeVisible({ timeout: 5000 });
});



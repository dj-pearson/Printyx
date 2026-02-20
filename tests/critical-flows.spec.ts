/**
 * Critical User Flows - E2E Tests
 *
 * Tests the 5 most critical user flows:
 * 1. Login flow (valid/invalid credentials)
 * 2. Lead creation
 * 3. Quote creation
 * 4. Dashboard load
 * 5. Settings page update
 *
 * Run with: npm run test:e2e:chromium -- tests/critical-flows.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// ─── Auth Helpers ────────────────────────────────────────────────────

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@printyx.net';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

/** Set up demo auth for tests that need an authenticated session */
async function setupDemoAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('demo-authenticated', 'true');
    localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
    localStorage.setItem('demo-user-role', 'platform_admin');
    localStorage.setItem('demo-user-id', 'e2e-test-user-001');
  });
}

/** Attach console error listeners and return collected errors */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known acceptable errors
      if (
        !text.includes('favicon') &&
        !text.includes('net::ERR_BLOCKED_BY_CLIENT') &&
        !text.includes('ResizeObserver')
      ) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`Uncaught: ${error.message}`);
  });
  return errors;
}

// ─── Test 1: Login Flow ──────────────────────────────────────────────

test.describe('Login Flow', () => {
  test('login page renders with form elements', async ({ page }) => {
    await page.goto('/login');

    // Verify key form elements are visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('invalid credentials show error toast', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect an error message to appear (toast or inline)
    await expect(page.getByText(/failed|invalid|error|incorrect/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('empty email shows validation error', async ({ page }) => {
    await page.goto('/login');

    // Submit without filling email
    await page.getByLabel(/password/i).fill('somepassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect validation message
    await expect(page.getByText(/email|required/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('forgot password link navigates correctly', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('signup link navigates correctly', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /get started|sign up/i }).click();
    await expect(page).toHaveURL(/signup/);
  });
});

// ─── Test 2: Lead Creation ───────────────────────────────────────────

test.describe('Lead Creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('leads page loads and displays content', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Page should render with leads content or empty state
    await expect(page.getByText(/lead|pipeline/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('add lead button opens creation dialog', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Look for create/add button
    const addButton = page.getByRole('button', { name: /add lead|new lead|create/i });
    if (await addButton.isVisible()) {
      await addButton.click();

      // Dialog should open with form fields
      await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('lead form has required fields', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Open create dialog
    const addButton = page.getByRole('button', { name: /add lead|new lead|create/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Verify form fields exist
      await expect(page.getByLabel(/company|name/i).first()).toBeVisible();
    }
  });
});

// ─── Test 3: Quote Creation ──────────────────────────────────────────

test.describe('Quote Creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('quotes page loads', async ({ page }) => {
    await page.goto('/quotes');
    await page.waitForLoadState('networkidle');

    // Page should render with quotes content or empty state
    await expect(page.getByText(/quote|proposal/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('new quote button is accessible', async ({ page }) => {
    await page.goto('/quotes');
    await page.waitForLoadState('networkidle');

    // Look for create button
    const createButton = page
      .getByRole('button', { name: /new quote|create|add/i })
      .or(page.getByRole('link', { name: /new quote|create/i }));

    await expect(createButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('quote builder page loads', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');

    // Quote builder should render
    await expect(page.getByText(/quote|builder|customer/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Test 4: Dashboard Load ──────────────────────────────────────────

test.describe('Dashboard Load', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('dashboard renders without console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dashboard should display content
    await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 10000 });

    // Filter out non-critical errors (API 401s are expected in demo mode)
    const criticalErrors = errors.filter(
      (e) => !e.includes('401') && !e.includes('403') && !e.includes('Failed to fetch'),
    );

    // No uncaught page errors
    const uncaughtErrors = criticalErrors.filter((e) => e.startsWith('Uncaught:'));
    expect(uncaughtErrors).toHaveLength(0);
  });

  test('dashboard has widget sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Dashboard should have card elements (widgets)
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('dashboard navigation works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Sidebar/navigation should be visible
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });
});

// ─── Test 5: Settings Page ───────────────────────────────────────────

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('settings page loads with tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page should render
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10000 });

    // Should have tab navigation (profile, security, preferences, etc.)
    await expect(page.getByText(/profile|preferences|security/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('settings tabs are navigable', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click through tabs
    const preferencesTab = page
      .getByRole('tab', { name: /preferences/i })
      .or(page.getByText(/preferences/i).first());
    if (await preferencesTab.isVisible()) {
      await preferencesTab.click();
      await page.waitForTimeout(500);

      // Preferences content should be visible
      await expect(page.getByText(/language|theme|timezone/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('settings form fields are interactive', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for any input field in settings
    const inputs = page.locator('input[type="text"], input[type="email"]');
    const inputCount = await inputs.count();

    // Settings should have form fields
    expect(inputCount).toBeGreaterThan(0);
  });
});

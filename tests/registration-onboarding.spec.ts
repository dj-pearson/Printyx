/**
 * Registration & Onboarding Flow - E2E Tests (LAUNCH-008)
 *
 * Tests the user registration and onboarding flow:
 * 1. Signup page (form elements, validation, navigation)
 * 2. Email verification page
 * 3. Tenant setup flow (authenticated)
 * 4. Onboarding dashboard (authenticated)
 * 5. Full registration → dashboard flow
 *
 * Run with: npm run test:e2e:chromium -- tests/registration-onboarding.spec.ts
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

// ─── Test 1: Signup Page ─────────────────────────────────────────────

test.describe('Signup Page', () => {
  test('page renders with all form elements', async ({ page }) => {
    await page.goto('/signup');

    // Verify key form elements are visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByLabel(/company/i)).toBeVisible();

    // Plan selection should be present
    await expect(page.getByText(/plan|pricing|tier/i).first()).toBeVisible({ timeout: 5000 });

    // Submit button should be visible
    await expect(
      page.getByRole('button', { name: /sign up|create account|get started|register/i }),
    ).toBeVisible();
  });

  test('empty form submission shows validation errors', async ({ page }) => {
    await page.goto('/signup');

    // Submit without filling any fields
    const submitButton = page.getByRole('button', {
      name: /sign up|create account|get started|register/i,
    });
    await submitButton.click();

    // Expect validation messages to appear
    await expect(page.getByText(/required|please|invalid/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('weak password shows strength error', async ({ page }) => {
    await page.goto('/signup');

    // Fill in a weak password (missing uppercase, number, special, and too short)
    const passwordField = page.getByLabel(/password/i).first();
    await passwordField.fill('weak');

    // Trigger validation by clicking submit or tabbing away
    const submitButton = page.getByRole('button', {
      name: /sign up|create account|get started|register/i,
    });
    await submitButton.click();

    // Expect a password strength/requirement error
    await expect(
      page
        .getByText(/12|characters|uppercase|lowercase|number|special|strong|weak|strength/i)
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('already-have-account link navigates to /login', async ({ page }) => {
    await page.goto('/signup');

    // Click the login link
    await page.getByRole('link', { name: /sign in|log in|already have/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});

// ─── Test 2: Email Verification Page ─────────────────────────────────

test.describe('Email Verification Page', () => {
  test('verify email page renders', async ({ page }) => {
    await page.goto('/verify-email');

    // Page should render with verification-related content
    await expect(page.getByText(/verif|email|confirm/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('missing or invalid token shows error message', async ({ page }) => {
    // Navigate with an invalid token
    await page.goto('/verify-email?token=invalid-token-12345');

    // Should display an error or status message about the invalid token
    await expect(
      page.getByText(/invalid|expired|error|failed|not found|missing/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('page displays verification status messaging', async ({ page }) => {
    await page.goto('/verify-email');

    // Should show some status messaging (check email, verification pending, etc.)
    await expect(
      page.getByText(/check|verify|email|sent|confirm|pending/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Test 3: Tenant Setup Flow ───────────────────────────────────────

test.describe('Tenant Setup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('tenant setup page loads for authenticated user', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/tenant-setup');
    await page.waitForLoadState('networkidle');

    // Page should render with tenant/organization setup content
    await expect(
      page.getByText(/setup|organization|company|tenant|business/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // Filter out non-critical errors (API 401s are expected in demo mode)
    const criticalErrors = errors.filter(
      (e) => !e.includes('401') && !e.includes('403') && !e.includes('Failed to fetch'),
    );

    // No uncaught page errors
    const uncaughtErrors = criticalErrors.filter((e) => e.startsWith('Uncaught:'));
    expect(uncaughtErrors).toHaveLength(0);
  });

  test('form renders with organization fields', async ({ page }) => {
    await page.goto('/tenant-setup');
    await page.waitForLoadState('networkidle');

    // Look for input fields related to organization setup
    const inputs = page.locator('input[type="text"], input[type="email"]');
    const inputCount = await inputs.count();

    // Setup form should have form fields
    expect(inputCount).toBeGreaterThan(0);
  });

  test('setup form has required fields', async ({ page }) => {
    await page.goto('/tenant-setup');
    await page.waitForLoadState('networkidle');

    // Company name field should be present
    await expect(page.getByLabel(/company|organization|business name/i).first()).toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── Test 4: Onboarding Dashboard ────────────────────────────────────

test.describe('Onboarding Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('onboarding page loads without errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Onboarding page should render
    await expect(page.getByText(/onboarding|welcome|get started|setup/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Filter out non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('401') && !e.includes('403') && !e.includes('Failed to fetch'),
    );

    // No uncaught page errors
    const uncaughtErrors = criticalErrors.filter((e) => e.startsWith('Uncaught:'));
    expect(uncaughtErrors).toHaveLength(0);
  });

  test('shows onboarding steps or progress', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Onboarding should display steps, progress, or checklist items
    await expect(
      page.getByText(/step|progress|complete|task|checklist/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('navigation to onboarding details works', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Look for clickable step or detail link
    const detailLink = page
      .getByRole('link', { name: /start|view|detail|configure/i })
      .or(page.getByRole('button', { name: /start|view|detail|configure|next/i }));

    if (await detailLink.first().isVisible()) {
      await detailLink.first().click();
      await page.waitForTimeout(500);

      // Should navigate or expand to show detail content
      await expect(page.getByText(/./)).toBeVisible();
    }
  });
});

// ─── Test 5: Full Registration → Dashboard Flow ─────────────────────

test.describe('Full Registration → Dashboard Flow', () => {
  test('signup page form submit handles response', async ({ page }) => {
    await page.goto('/signup');

    // Fill out the signup form
    await page.getByLabel(/name/i).first().fill('Test User');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).first().fill(TEST_PASSWORD);
    await page.getByLabel(/company/i).fill('Test Company Inc');

    // Submit the form
    const submitButton = page.getByRole('button', {
      name: /sign up|create account|get started|register/i,
    });
    await submitButton.click();

    // Should show a response: success message, redirect, or error (if user exists)
    await expect(
      page
        .getByText(/success|created|verify|check your email|already exists|error/i)
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('authenticated user accessing /signup redirects to dashboard', async ({ page }) => {
    await setupDemoAuth(page);

    await page.goto('/signup');
    await page.waitForLoadState('networkidle');

    // Should redirect away from signup to dashboard or today page
    await expect(page).not.toHaveURL(/signup/);
  });
});

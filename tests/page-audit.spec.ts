/**
 * Page Audit Tests
 *
 * Playwright tests that verify each page loads without console or network errors.
 * Run with: npm run test:e2e -- tests/page-audit.spec.ts
 *
 * This test file generates one test per route, making it easy to identify
 * which specific pages have issues.
 */

import { test, expect, Page, ConsoleMessage, Response } from '@playwright/test';

// Types for error tracking
interface PageErrors {
  consoleErrors: string[];
  networkErrors: string[];
}

// Auth setup for protected routes
async function setupAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('demo-authenticated', 'true');
    localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
    localStorage.setItem('demo-user-role', 'platform_admin');
    localStorage.setItem('demo-user-id', 'audit-user-001');
  });
}

// Helper to attach error listeners to a page
function attachErrorListeners(page: Page): PageErrors {
  const errors: PageErrors = {
    consoleErrors: [],
    networkErrors: [],
  };

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out some known/acceptable errors
      if (
        !text.includes('favicon') &&
        !text.includes('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT')
      ) {
        errors.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error: Error) => {
    errors.consoleErrors.push(`Uncaught: ${error.message}`);
  });

  page.on('response', (response: Response) => {
    const status = response.status();
    if (status >= 400) {
      const url = response.url();
      // Filter out non-critical assets
      if (!url.includes('favicon') && !url.includes('.map') && !url.includes('__vite')) {
        errors.networkErrors.push(`[${status}] ${response.request().method()} ${url}`);
      }
    }
  });

  return errors;
}

// PUBLIC ROUTES - No auth required
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/eula',
  '/privacy',
  '/terms',
  '/accessibility',
  '/p/copier-dealer-crm',
  '/predictive-intelligence',
  '/modern-architecture',
  '/integration-marketplace',
  '/dealer-expertise',
  '/roi-calculator',
  '/case-studies',
  '/blog',
];

test.describe('Public Pages - No Errors', () => {
  for (const route of publicRoutes) {
    test(`${route} loads without errors`, async ({ page }) => {
      const errors = attachErrorListeners(page);

      await page.goto(route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // Let async content settle

      // Check for console errors
      if (errors.consoleErrors.length > 0) {
        console.log(`Console errors on ${route}:`, errors.consoleErrors);
      }
      expect(errors.consoleErrors, `Console errors on ${route}`).toHaveLength(0);

      // Check for network errors
      if (errors.networkErrors.length > 0) {
        console.log(`Network errors on ${route}:`, errors.networkErrors);
      }
      expect(errors.networkErrors, `Network errors on ${route}`).toHaveLength(0);
    });
  }
});

// AUTHENTICATED ROUTES - Require localStorage auth
const authenticatedRoutes = [
  '/today',
  '/crm',
  '/customers',
  '/business-records',
  '/contacts',
  '/leads-management',
  '/deals',
  '/opportunities',
  '/sales-pipeline',
  '/quotes',
  '/quotes/new',
  '/deal-desk',
  '/equipment-lifecycle',
  '/preventive-maintenance',
  '/service-dispatch',
  '/product-hub',
  '/product-catalog',
  '/inventory',
  '/pricing',
  '/billing',
  '/meter-billing',
  '/vendors',
  '/reports',
  '/task-hub',
  '/tasks',
  '/technician-management',
  '/vehicle-management',
  '/customer-portal',
  '/leases',
  '/integrations',
  '/autopilot',
  '/calendar',
  '/settings',
  '/ai-hub',
  '/knowledge-base',
  '/import',
  '/onboarding',
  '/role-management',
];

test.describe('Authenticated Pages - No Errors', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  for (const route of authenticatedRoutes) {
    test(`${route} loads without errors`, async ({ page }) => {
      const errors = attachErrorListeners(page);

      await page.goto(route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      if (errors.consoleErrors.length > 0) {
        console.log(`Console errors on ${route}:`, errors.consoleErrors);
      }
      expect(errors.consoleErrors, `Console errors on ${route}`).toHaveLength(0);

      if (errors.networkErrors.length > 0) {
        console.log(`Network errors on ${route}:`, errors.networkErrors);
      }
      expect(errors.networkErrors, `Network errors on ${route}`).toHaveLength(0);
    });
  }
});

// ADMIN ROUTES - Require admin permissions
const adminRoutes = [
  '/admin-hub',
  '/admin-command-center',
  '/admin/tenant-management',
  '/admin/user-management',
  '/admin/system-settings',
  '/admin/platform-analytics',
  '/admin/knowledge-base',
  '/root-admin-dashboard',
  '/platform-crm',
  '/platform-crm/dashboard',
];

test.describe('Admin Pages - No Errors', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  for (const route of adminRoutes) {
    test(`${route} loads without errors`, async ({ page }) => {
      const errors = attachErrorListeners(page);

      await page.goto(route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      if (errors.consoleErrors.length > 0) {
        console.log(`Console errors on ${route}:`, errors.consoleErrors);
      }
      expect(errors.consoleErrors, `Console errors on ${route}`).toHaveLength(0);

      if (errors.networkErrors.length > 0) {
        console.log(`Network errors on ${route}:`, errors.networkErrors);
      }
      expect(errors.networkErrors, `Network errors on ${route}`).toHaveLength(0);
    });
  }
});

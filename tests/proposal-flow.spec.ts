/**
 * Proposal Module E2E — PROP-010 (proposal/templates/branding/share track).
 *
 * Smoke-walks the reusable-branded-template flow built in PROP-001..008:
 *   Proposal Templates → Branding → Generate Proposal → Share link → public view.
 *
 * Conventions match tests/quote-flow.spec.ts: demo-auth via localStorage, resilient
 * assertions (seed data varies by environment), smoke-level rendering checks. The
 * data-dependent legs (generate→PDF→share→accept) need seeded quotes/templates +
 * applied migrations 0015/0016/0017, so they live in the manual checklist below.
 *
 * NOTE: the quote-flow legs of the original PROP-010 spec (server-side product
 * search, per-line discounts, recurring lines, autosave/recovery) depend on the
 * QUOTE-011..020 track, which is not yet implemented — see that track before
 * extending this spec to cover them.
 *
 * Run: npm run test:e2e:chromium -- tests/proposal-flow.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

async function setupDemoAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('demo-authenticated', 'true');
    localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
    localStorage.setItem('demo-user-role', 'platform_admin');
    localStorage.setItem('demo-user-id', 'e2e-test-user-001');
  });
}

test.describe('Proposal templates', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('templates page renders with a New Template action', async ({ page }) => {
    await page.goto('/proposal-templates');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/proposal templates/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /new template/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('New Template dialog collects a name and type', async ({ page }) => {
    await page.goto('/proposal-templates');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /new template/i })
      .first()
      .click();
    // Dialog with the type select + name input.
    await expect(page.getByText(/new proposal template/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Branding', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('branding settings page renders the editor', async ({ page }) => {
    await page.goto('/proposals/branding');
    await page.waitForLoadState('networkidle');

    // Either the BrandManager (Brand Manager / Company tab) or an empty-state prompt.
    await expect(page.getByText(/branding|brand/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Generate + share actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoAuth(page);
  });

  test('quotes row menu exposes Generate Proposal + Copy Share Link', async ({ page }) => {
    await page.goto('/quotes');
    await page.waitForLoadState('networkidle');

    // Page renders (table or empty state).
    await expect(page.getByText(/quote|proposal/i).first()).toBeVisible({ timeout: 10000 });

    // If at least one row menu is present, it should offer the new actions.
    const menuTrigger = page.getByRole('button', { name: /open menu|actions|more/i }).first();
    if (await menuTrigger.isVisible().catch(() => false)) {
      await menuTrigger.click();
      await expect(page.getByText(/generate proposal/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/copy share link/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Public proposal view', () => {
  test('an invalid/expired share token shows the unavailable state, not the app', async ({
    page,
  }) => {
    // No auth on purpose — the public route must work logged-out.
    await page.goto('/p/this-is-not-a-real-share-token-000000000000');
    await page.waitForLoadState('networkidle');

    // Token is long enough to hit the public view (not a marketing slug) and
    // resolves to the "no longer available" state (404 from the edge route).
    await expect(
      page.getByText(/no longer available|something went wrong|loading/i).first(),
    ).toBeVisible({ timeout: 10000 });
    // The authenticated app shell (sidebar nav) must NOT render here.
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });
});

/**
 * Manual verification checklist (needs seeded quotes/templates/branding + applied
 * migrations 0015/0016/0017; some legs need a configured SendGrid key):
 *
 * 1. Branding: create a profile, upload a logo (persists as a Storage URL), set default.
 * 2. Templates: create a template, add library sections, insert merge fields, Save;
 *    reload → content round-trips. Clone + set-default per type work.
 * 3. Generate: from a quote's row menu (or Review step) → Generate Proposal → pick the
 *    type-default template + branding → Generate. proposal_sections are written.
 * 4. Branded PDF: download the customer PDF → logo in header, brand colors, footer with
 *    company contact; sections render. CONFIRM no cost/margin anywhere (QUOTE-007/PROP-007).
 * 5. Manager PDF: still role-gated (sales-only → 403) and includes cost/margin.
 * 6. Share: "Copy Share Link" → open /p/<token> logged-out → branded sections render with
 *    NO cost/margin/internal notes; open_count increments; status → viewed.
 * 7. Accept: enter name → Accept → status=accepted, deal marked won + contract created.
 *    Decline → status=rejected.
 */

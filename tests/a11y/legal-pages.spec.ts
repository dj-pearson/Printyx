/**
 * Accessibility smoke tests (WCAG 2.0/2.1 A & AA) for the public legal and
 * compliance pages, using axe-core. These pages require no authentication, so
 * they are a reliable, fast guardrail against serious a11y regressions on the
 * content that the compliance audit added or revised.
 *
 * Run with: npm run test:a11y   (requires the app running at BASE_URL)
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_PAGES = [
  '/privacy',
  '/terms',
  '/eula',
  '/cookies',
  '/dpa',
  '/subprocessors',
  '/accessibility',
  '/do-not-sell',
];

for (const path of PUBLIC_PAGES) {
  test(`no serious/critical a11y violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Gate only on serious/critical impacts so minor/moderate cosmetic findings
    // don't make the smoke test flaky while still catching real blockers.
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    expect(blocking, blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual(
      [],
    );
  });
}

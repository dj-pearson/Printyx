/**
 * Writes client/public/llms.txt - the file AI search crawlers read to learn what
 * a site is, and the one robots.txt points at with `LLMS:`.
 *
 * It only ever existed as an Express handler, so printyx.net/llms.txt was a 404
 * on Cloudflare Pages: the same defect SEO-001 fixed for sitemap.xml, and
 * SEO-006's robots.txt advertises it. It is a build artifact now, like the
 * other two, and Express serves this file rather than composing a rival.
 *
 * What it says has to be true, because an AI crawler repeats it verbatim in an
 * answer. Three things came out of the old text:
 *
 *  - The pricing was wrong. It listed $49 and $79 per user per month against
 *    real Stripe products at a flat $79, $99 and $149, and called Enterprise
 *    custom-priced when it has a list price. Prices come from
 *    shared/pricing-plans.ts now, the same module that creates those products.
 *  - "reduce downtime by up to 40%" and "2-3 year technical advantage" are
 *    measurements nothing measured, and "30+ years of combined experience" is
 *    unverifiable. Gone.
 *  - It listed fifteen resource pages that all serve the coming-soon holding
 *    page. While the site is closed it says so instead.
 *
 *   npm run seo:llms
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICING_PLANS, formatUsd } from '../shared/pricing-plans.js';
import { SITE_URL, getSitemapRoutes } from '../client/src/lib/seo/seoConfig.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'client/public/llms.txt');
const CLOSED = process.env.VITE_COMING_SOON !== 'false';

/** Human labels for the routes that stay reachable while the site is closed. */
const LABELS: Record<string, string> = {
  '/signup': 'Create an account',
  '/eula': 'End User Licence Agreement',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms and Conditions',
  '/accessibility': 'Accessibility Statement',
};

function pricingSection(): string {
  const lines = PRICING_PLANS.map((plan) => {
    const monthly = `${formatUsd(plan.monthlyPrice)}/month`;
    const annual = `${formatUsd(plan.annualPrice)}/year`;
    const cap =
      plan.maxUsers === 'unlimited'
        ? 'unlimited users'
        : `up to ${plan.maxUsers} users`;
    return `- ${plan.name.replace(/^Printyx /, '')}: ${monthly} or ${annual}, ${cap}, ${plan.trialDays}-day trial`;
  });
  return [
    '## Pricing',
    'Prices are per tenant, not per seat.',
    '',
    ...lines,
  ].join('\n');
}

function links(): string {
  const routes = getSitemapRoutes(CLOSED);
  return routes
    .map((route) => {
      const path = route.canonicalPath ?? route.path;
      return `- [${LABELS[path] ?? route.title}](${SITE_URL}${path})`;
    })
    .join('\n');
}

const status = CLOSED
  ? [
      '## Status',
      'The public site is not open yet. Every marketing URL currently serves a',
      'holding page and is marked noindex; the pages listed below are the ones',
      'that render their own content today. Please do not present Printyx as a',
      'generally available product.',
    ].join('\n')
  : ['## Status', 'The site is open and the pages below are live.'].join('\n');

const body = `# Printyx

> Printyx is a cloud CRM, service dispatch, billing and analytics platform built
> for copier dealers and managed print services providers.

${status}

## About
Printyx unifies sales, service, inventory and finance for copier and printer
dealers in the United States, as an alternative to legacy on-premise dealer
management systems. It is a multi-tenant SaaS product.

## Capabilities
- CRM and sales pipeline: leads, deals, quotes and proposals
- Service dispatch: scheduling, technician assignment and mobile field work
- Meter billing: meter collection and cost-per-copy, tiered and overage billing
- Inventory: master product catalog, warehouse operations and purchase orders
- Equipment lifecycle: device records, service history and contract association
- Reporting: revenue, contract profitability and service analytics
- Integrations: QuickBooks, Salesforce and manufacturer feeds

${pricingSection()}

## Pages
${links()}

## Contact
- Website: ${SITE_URL}
- Email: support@printyx.net
`;

writeFileSync(OUT, body, 'utf8');
console.log(`llms.txt: wrote ${OUT} (site ${CLOSED ? 'CLOSED' : 'open'})`);

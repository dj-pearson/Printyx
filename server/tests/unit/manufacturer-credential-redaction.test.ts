/**
 * SEC-EDGE-001: manufacturer API credentials were readable by any tenant member.
 *
 * `manufacturer_integrations` stores the dealer's keys for HP, Canon, Xerox and
 * the rest - `api_key`, `api_secret`, `client_secret`, `access_token`,
 * `refresh_token` - and every read was a bare `select('*')` handed straight to
 * the caller. `/manufacturer-integration` is `minLevel: 4` with
 * `admin.settings.integrations`, so the navigation said manager and the
 * endpoint said anyone: this story's own headline shape, a nav gate hiding a
 * menu item and protecting nothing.
 *
 * TWO CONTROLS, AND THE ORDER OF IMPORTANCE MATTERS. Redaction is structural -
 * a response should not carry a secret whoever asked for it, which is the rule
 * `_shared/webhook-view.ts` already encodes one table over. The role gate is
 * the second control, not a substitute for the first.
 *
 * The audit-log branch is the one a redactor applied only to the obvious read
 * would have missed: it embeds `integration:manufacturer_integrations(*)`, so
 * every log row carried the full credential set through a different path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const strip = (src: string) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fn = read('supabase/functions/manufacturer-integrations/index.ts');
const software = read('supabase/functions/software-products/index.ts');

describe('credentials never leave the function', () => {
  it('names every secret column the table carries', () => {
    for (const column of [
      'api_key',
      'api_secret',
      'client_secret',
      'access_token',
      'refresh_token',
      'webhook_secret',
    ]) {
      expect(fn).toContain(`'${column}'`);
    }
  });

  it('answers a set/not-set marker instead of deleting the field silently', () => {
    // The settings page has to show whether a credential is configured
    // without ever receiving it.
    expect(fn).toContain('_set`] = Boolean(');
  });

  it('the list, the single read and the connect response all go through the view', () => {
    expect(fn).toContain('toIntegrationViews(integrations)');
    expect(fn).toContain('...toIntegrationView(integration),');
    expect(fn).toContain('integration: toIntegrationView(integration)');
  });

  it('including the audit embed, which is a second path to the same row', () => {
    const audit = fn.slice(fn.indexOf('integration:manufacturer_integrations(*)'));
    const mapper = audit.slice(0, audit.indexOf('200,'));
    expect(mapper).toContain('toIntegrationView(integration)');
  });

  it('but the internal resolve keeps the full row, or the adapter cannot authenticate', () => {
    const resolve = fn.slice(
      fn.indexOf('async function resolveIntegration'),
      fn.indexOf('export default'),
    );
    expect(resolve).toContain("select('*')");
    expect(strip(resolve)).not.toContain('toIntegrationView');
  });
});

describe('and the writes need the role the page already claims', () => {
  it('every non-GET is gated at manager', () => {
    expect(fn).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
    expect(fn).toContain('ROLE_LEVEL.MANAGER');
  });

  it('the gate sits above the routing, so no write branch can miss it', () => {
    const gateAt = fn.indexOf("if (req.method !== 'GET' && req.method !== 'HEAD')");
    const firstWrite = fn.indexOf("endpoint === 'connect'");
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(firstWrite);
  });

  it('denyManager rethrows what is not a role refusal', () => {
    const deny = fn.slice(fn.indexOf('const denyManager'), fn.indexOf("if (req.method !== 'GET'"));
    expect(deny).toContain('err instanceof RbacError');
    expect(deny).toContain('throw err;');
  });
});

describe('software-products matches the sibling catalogue it was written beside', () => {
  it('gates writes on the same permission product-models uses', () => {
    const models = read('supabase/functions/product-models/index.ts');
    expect(models).toContain("'operations.inventory.manage'");
    expect(software).toContain("'operations.inventory.manage'");
    expect(software).toContain('denyWithoutPermission(admin, user, WRITE_PERMISSION)');
  });

  it('leaves reads open, because a quote is built from the catalogue', () => {
    expect(software).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
  });

  it('and the gate precedes the CSV import, the bulk delete and the dedupe', () => {
    const gateAt = software.indexOf("if (req.method !== 'GET' && req.method !== 'HEAD')");
    for (const branch of [
      "productId === 'import'",
      "productId === 'bulk-delete'",
      "productId === 'dedupe'",
    ]) {
      expect(software.indexOf(branch), branch).toBeGreaterThan(gateAt);
    }
  });
});

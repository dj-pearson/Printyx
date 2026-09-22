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
 *
 * CORRECTED ROUND 125: THE REDACTOR THIS FILE WAS WRITTEN AGAINST REDACTED
 * NOTHING, and two of these assertions were pinning the defect. Its
 * SECRET_COLUMNS named seven columns `manufacturer_integrations` has never
 * had - they were copied from the `connect` branch's upsert, itself a
 * guaranteed PGRST204 - so `column in view` was false every time and the row
 * came back whole. The credentials are one level down, in the NOT NULL
 * `credentials` jsonb the adapters read. The two assertions below now state
 * the PROPERTY (a secret value does not appear in a response) rather than the
 * shape of a list that was wrong, and they run the view against real rows
 * instead of reading the source for a string.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { toManufacturerIntegrationView } from '@shared/manufacturer-integration-view';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const strip = (src: string) => src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fn = read('supabase/functions/manufacturer-integrations/index.ts');
const software = read('supabase/functions/software-products/index.ts');

describe('credentials never leave the function', () => {
  it('no credential value survives the view, whatever it is called', () => {
    // Called, not read as text: proving the string is in the file is what let
    // a list of seven columns that do not exist pass for a redactor.
    const view = toManufacturerIntegrationView({
      id: 'i1',
      manufacturer: 'hp',
      credentials: {
        apiKey: 'AK-SECRET',
        apiSecret: 'AS-SECRET',
        clientSecret: 'CS-SECRET',
        accessToken: 'AT-SECRET',
        refreshToken: 'RT-SECRET',
        webhookSecret: 'WS-SECRET',
        password: 'PW-SECRET',
      },
    })!;
    const body = JSON.stringify(view);
    for (const secret of [
      'AK-SECRET',
      'AS-SECRET',
      'CS-SECRET',
      'AT-SECRET',
      'RT-SECRET',
      'WS-SECRET',
      'PW-SECRET',
    ]) {
      expect({ secret, leaked: body.includes(secret) }).toEqual({ secret, leaked: false });
    }
  });

  it('answers a set/not-set marker instead of deleting the field silently', () => {
    // The settings page has to show whether a credential is configured
    // without ever receiving it.
    const configured = toManufacturerIntegrationView({ id: 'i', credentials: { apiKey: 'k' } })!;
    expect(configured.credentialsSet).toBe(true);
    expect(configured.credentialKeys).toEqual(['apiKey']);

    const blank = toManufacturerIntegrationView({ id: 'i', credentials: {} })!;
    expect(blank.credentialsSet).toBe(false);
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

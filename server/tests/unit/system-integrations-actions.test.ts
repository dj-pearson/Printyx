import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 199. SystemIntegrations: Add Webhook, the webhook active Switch, Edit
 * and "open in a new tab" did nothing, and the Platform API Keys card showed
 * two typed-in keys ("Created: Dec 15, 2024 - Last used: 2 hours ago") over
 * dead Generate / Regenerate / Revoke buttons.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/SystemIntegrations.tsx'), 'utf8'));
const WEBHOOKS = strip(readFileSync(join(root, 'supabase/functions/webhooks/index.ts'), 'utf8'));

describe('webhooks', () => {
  it('Add Webhook posts to the webhooks function and shows the secret once', () => {
    expect(PAGE).toMatch(/apiRequest\('\/api\/webhooks', 'POST', newWebhook\)/);
    expect(PAGE).toMatch(/setIssuedSecret\(created\?\.secret \?\? null\)/);
    expect(WEBHOOKS).toMatch(/\{ \.\.\.toWebhookView\(webhook\), secret \}, 201/);
  });
  it('offers the events the function publishes', () => {
    expect(PAGE).toContain("queryKey: ['/api/webhooks/events']");
    expect(WEBHOOKS).toMatch(/webhookId === 'events'/);
  });
  it('the Switch toggles the webhook', () => {
    expect(PAGE).toMatch(/apiRequest\(`\/api\/webhooks\/\$\{id\}`, 'PUT', \{ isActive \}\)/);
    expect(PAGE).toMatch(/onCheckedChange=\{\(isActive\) =>\s*toggleWebhook\.mutate/);
  });
});

describe('API keys', () => {
  it('lists the real keys instead of typed-in ones', () => {
    expect(PAGE).toContain("queryKey: ['/api/api-keys']");
    for (const s of [
      'pk_live_',
      'pk_test_',
      'Dec 15, 2024',
      '2 hours ago',
      'Regenerate',
      'Revoke',
    ]) {
      expect(PAGE, s).not.toContain(s);
    }
  });
  it('sends key management to the page that already does it', () => {
    expect(PAGE).toContain('<Link href="/settings/api-keys">');
  });
});

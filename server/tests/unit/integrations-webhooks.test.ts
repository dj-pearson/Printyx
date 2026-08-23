/**
 * PA-046's no-fabrication guarantee, moved to the code that now serves it.
 *
 * PA-046 rewrote Express GET /api/webhooks to stop returning invented delivery
 * stats (98.5% / 99.2% success rates that read as real). PROD-008b then removed
 * that handler: /api/webhooks is in crmProxies, so it was shadowed in dev and
 * unreachable in production, and this test was asserting against code that
 * could not run.
 *
 * The surface still exists - supabase/functions/webhooks/ serves it - so the
 * guarantee moves rather than being deleted with the handler. It now covers
 * _shared/webhook-view.ts, the mapper that shapes every read response.
 *
 * Two things the Express handler never had to worry about and this one does:
 * the row is snake_case from PostgREST while the page reads camelCase and a
 * `status` string, and the row carries the HMAC signing secret, which used to
 * go out with select('*') on every list.
 */
import { describe, it, expect } from 'vitest';
import { toWebhookView, toWebhookViews } from '../../../supabase/functions/_shared/webhook-view';

const row = {
  id: 'wh-1',
  tenant_id: 't-1',
  name: 'Billing sync',
  url: 'https://example.test/hooks/billing',
  events: ['invoice.paid', 'invoice.overdue'],
  secret: 'super-secret-signing-key',
  headers: { 'X-Env': 'prod' },
  retry_count: 5,
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-02T00:00:00.000Z',
};

describe('PA-046: the webhook list does not fabricate delivery stats', () => {
  it('reports no delivery history rather than inventing one', () => {
    const view = toWebhookView(row);
    expect(view.successRate).toBeNull();
    expect(view.lastTriggered).toBeNull();
    expect(view.lastDelivery).toBeNull();
    expect(view.deliveryStatsTracked).toBe(false);
  });

  it('never returns the signing secret', () => {
    const view = toWebhookView(row) as Record<string, unknown>;
    expect('secret' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('super-secret-signing-key');
  });
});

describe('webhook row to the shape the page reads', () => {
  it('derives status from is_active', () => {
    expect(toWebhookView(row).status).toBe('active');
    expect(toWebhookView({ ...row, is_active: false }).status).toBe('inactive');
    expect(toWebhookView({ ...row, is_active: false }).isActive).toBe(false);
  });

  it('camelCases the fields the page binds', () => {
    const view = toWebhookView(row);
    expect(view).toMatchObject({
      id: 'wh-1',
      name: 'Billing sync',
      url: 'https://example.test/hooks/billing',
      events: ['invoice.paid', 'invoice.overdue'],
      retryCount: 5,
      createdBy: 'user-1',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  it('keeps a malformed events jsonb from breaking the list render', () => {
    expect(toWebhookView({ ...row, events: null }).events).toEqual([]);
    expect(toWebhookView({ ...row, events: 'invoice.paid' }).events).toEqual([]);
    expect(toWebhookView({ ...row, events: ['ok', 7, null] }).events).toEqual(['ok']);
  });

  it('falls back to the column default when retry_count is missing', () => {
    expect(toWebhookView({ ...row, retry_count: null }).retryCount).toBe(3);
  });

  it('maps a list and tolerates a null query result', () => {
    expect(toWebhookViews([row, { ...row, id: 'wh-2' }]).map((w) => w.id)).toEqual([
      'wh-1',
      'wh-2',
    ]);
    expect(toWebhookViews(null)).toEqual([]);
  });
});

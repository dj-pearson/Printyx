/**
 * PA-046 — GET /api/webhooks returns real, honest webhook status (no fabricated
 * delivery stats), and the static /api/deployment-readiness mock is gone.
 *
 * Before: the handler returned a hardcoded 2-item sample with invented success
 * rates (98.5% / 99.2%) that read as real, and a sibling /api/deployment-readiness
 * returned static mock metrics with no frontend caller.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../replitAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../storage', () => ({ storage: {} }));

import { registerIntegrationRoutes } from '../../routes-integrations';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntegrationRoutes(app);
  return app;
}

describe('PA-046: /api/webhooks is honest', () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.SALESFORCE_WEBHOOK_SECRET;
    delete process.env.MICROSOFT_WEBHOOK_SECRET;
    delete process.env.QUICKBOOKS_WEBHOOK_TOKEN;
    delete process.env.GOOGLE_WEBHOOK_TOKEN;
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it('lists the real provider endpoints with no fabricated delivery stats', async () => {
    const res = await request(buildApp()).get('/api/webhooks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);

    for (const wh of res.body) {
      // No invented success rate / last-delivery — the old mock's tell.
      expect(wh.successRate).toBeNull();
      expect(wh.lastTriggered).toBeNull();
      expect(wh.deliveryStatsTracked).toBe(false);
      expect(wh.url).toContain('/api/webhooks/');
    }
    // The fabricated numbers from the old mock must not appear anywhere.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('98.5');
    expect(body).not.toContain('99.2');
  });

  it("marks a provider 'active' only when its signing secret is configured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    const res = await request(buildApp()).get('/api/webhooks');
    const byId = Object.fromEntries(res.body.map((w: { id: string }) => [w.id, w]));
    expect(byId['webhook-stripe'].status).toBe('active');
    expect(byId['webhook-salesforce'].status).toBe('inactive');
  });

  it('no longer serves the static /api/deployment-readiness mock', async () => {
    const res = await request(buildApp()).get('/api/deployment-readiness');
    expect(res.status).toBe(404);
  });
});

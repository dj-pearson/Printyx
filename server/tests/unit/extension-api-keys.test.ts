/**
 * PA-044 — the extension API key is persisted (hashed) on generation and
 * validated on subsequent requests, with expiry/revoke honored.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  selectResult: [] as unknown[],
}));

vi.mock('../../db', () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.inserted.push(v);
        return Promise.resolve([]);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(state.selectResult) }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

// Session auth: pass-through that stamps a browser user (for generate-key).
vi.mock('../../replitAuth', () => ({
  isAuthenticated: (req: express.Request, _res: express.Response, next: () => void) => {
    (req as express.Request & { user?: unknown }).user = {
      tenantId: 'T1',
      id: 'U1',
      claims: { sub: 'U1' },
    };
    next();
  },
}));

import extensionRouter, {
  hashExtensionKey,
  validateExtensionApiKey,
  extensionAuth,
} from '../../routes/chrome-extension-routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/extension', extensionRouter);
  return app;
}

const activeRow = () => ({
  id: 'k1',
  tenantId: 'T1',
  userId: 'U1',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
});

describe('PA-044: extension API keys', () => {
  beforeEach(() => {
    state.inserted = [];
    state.selectResult = [];
  });

  it('generate-key persists a HASH of the key (never the raw key) with an expiry', async () => {
    const res = await request(buildApp()).post('/api/extension/auth/generate-key');
    expect(res.status).toBe(200);
    expect(res.body.apiKey).toMatch(/^pyx_ext_/);
    expect(res.body.expiresAt).toBeTruthy();

    expect(state.inserted).toHaveLength(1);
    const stored = state.inserted[0];
    expect(stored.keyHash).toBe(hashExtensionKey(res.body.apiKey));
    // The raw key is never stored.
    expect(stored.keyHash).not.toBe(res.body.apiKey);
    expect(stored.keyPrefix).toBe(res.body.apiKey.slice(0, 16));
    expect(stored.tenantId).toBe('T1');
    expect(stored.expiresAt).toBeInstanceOf(Date);
  });

  describe('validateExtensionApiKey', () => {
    it('rejects a key without the pyx_ext_ prefix (no lookup)', async () => {
      expect(await validateExtensionApiKey('not-a-key')).toBeNull();
      expect(await validateExtensionApiKey(undefined)).toBeNull();
    });

    it('accepts an active stored key', async () => {
      state.selectResult = [activeRow()];
      expect(await validateExtensionApiKey('pyx_ext_abc')).toEqual({
        tenantId: 'T1',
        userId: 'U1',
      });
    });

    it('rejects an unknown key', async () => {
      state.selectResult = [];
      expect(await validateExtensionApiKey('pyx_ext_abc')).toBeNull();
    });

    it('rejects an expired key', async () => {
      state.selectResult = [{ ...activeRow(), expiresAt: new Date(Date.now() - 1000) }];
      expect(await validateExtensionApiKey('pyx_ext_abc')).toBeNull();
    });

    it('rejects a revoked key', async () => {
      state.selectResult = [{ ...activeRow(), revokedAt: new Date() }];
      expect(await validateExtensionApiKey('pyx_ext_abc')).toBeNull();
    });
  });

  describe('extensionAuth middleware', () => {
    const run = (headers: Record<string, string>) => {
      const req = { headers, user: undefined } as unknown as express.Request & { user?: unknown };
      let statusCode = 0;
      let nextCalled = false;
      const res = {
        status(c: number) {
          statusCode = c;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as express.Response;
      return extensionAuth(req, res, () => {
        nextCalled = true;
      }).then(() => ({ req, statusCode, nextCalled }));
    };

    it('authenticates a valid key header and stamps the tenant/user', async () => {
      state.selectResult = [activeRow()];
      const { req, nextCalled, statusCode } = await run({ 'x-extension-api-key': 'pyx_ext_abc' });
      expect(nextCalled).toBe(true);
      expect(statusCode).toBe(0);
      expect((req.user as { tenantId: string }).tenantId).toBe('T1');
    });

    it('rejects an invalid key header with 401', async () => {
      state.selectResult = [];
      const { nextCalled, statusCode } = await run({ 'x-extension-api-key': 'pyx_ext_bad' });
      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
    });

    it('falls back to session auth when no key header is present', async () => {
      const { nextCalled, req } = await run({});
      // The mocked isAuthenticated stamps the browser user and calls next.
      expect(nextCalled).toBe(true);
      expect((req.user as { tenantId: string }).tenantId).toBe('T1');
    });
  });
});

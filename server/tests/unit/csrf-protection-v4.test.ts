/**
 * Round 230: csrf-protection was written against csrf-csrf v3 and ran on v4.
 * The token endpoint answered 200 { csrfToken: null } ("generateToken is not a
 * function"), and any cookie-authenticated mutation threw inside validation
 * because v4 needs getSessionIdentifier and req.cookies, and neither existed.
 * These run the real middleware on a real Express app with a real session.
 */
import { describe, expect, it } from 'vitest';
import express from 'express';
import session from 'express-session';
import type { AddressInfo } from 'node:net';
import { csrfProtection, csrfTokenHandler, ensureCookies } from '../../middleware/csrf-protection';

async function withApp<T>(useSession: boolean, fn: (base: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  if (useSession) {
    app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  }
  app.get('/api/csrf-token', csrfTokenHandler);
  app.use(csrfProtection);
  app.post('/api/thing', (_req, res) => res.json({ ok: true }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _n: express.NextFunction) =>
    res.status(500).json({ err: String(err) }),
  );
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

const cookiesFrom = (res: Response) =>
  (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

describe('CSRF protection on csrf-csrf v4 (round 230)', () => {
  it('issues a real token, and a mutation carrying it passes', async () => {
    await withApp(true, async (base) => {
      const t = await fetch(`${base}/api/csrf-token`);
      expect(t.status).toBe(200);
      const { csrfToken } = (await t.json()) as { csrfToken: string | null };
      expect(typeof csrfToken).toBe('string');
      expect(csrfToken!.length).toBeGreaterThan(10);

      const ok = await fetch(`${base}/api/thing`, {
        method: 'POST',
        headers: { cookie: cookiesFrom(t), 'x-csrf-token': csrfToken! },
      });
      expect(ok.status).toBe(200);
    });
  });

  it('refuses a cookie mutation with no token as 403, not a 500', async () => {
    await withApp(true, async (base) => {
      const t = await fetch(`${base}/api/csrf-token`);
      const res = await fetch(`${base}/api/thing`, {
        method: 'POST',
        headers: { cookie: cookiesFrom(t) },
      });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe('CSRF_ERROR');
    });
  });

  it('still skips a Bearer-authenticated mutation', async () => {
    await withApp(true, async (base) => {
      const res = await fetch(`${base}/api/thing`, {
        method: 'POST',
        headers: { authorization: 'Bearer x' },
      });
      expect(res.status).toBe(200);
    });
  });

  it('refuses to mint a token with no session rather than answering null at 200', async () => {
    await withApp(false, async (base) => {
      const res = await fetch(`${base}/api/csrf-token`);
      expect(res.status).toBe(503);
    });
  });

  it('parses the Cookie header when nothing else has', () => {
    const req = { headers: { cookie: 'a=1; __csrf=x%3Dy; bad; b=' } } as unknown as express.Request;
    expect(ensureCookies(req)).toEqual({ a: '1', __csrf: 'x=y', b: '' });
  });
});

describe('import wizard polls a running job (round 230)', () => {
  it('reads the job status from the query state, not the query', async () => {
    const { importJobPollInterval } = await import('@/components/import/CsvImportWizard');
    expect(importJobPollInterval('processing')).toBe(1000);
    expect(importJobPollInterval('completed')).toBe(false);
    expect(importJobPollInterval(undefined)).toBe(false);
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('client/src/components/import/CsvImportWizard.tsx', 'utf8');
    expect(src).toMatch(
      /refetchInterval: \(query\) => importJobPollInterval\(query\.state\.data\?\.status\)/,
    );
  });
});

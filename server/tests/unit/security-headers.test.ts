import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { randomUUID } from 'crypto';

/**
 * Creates a test Express app with the same security header configuration
 * as server/index.ts (production mode).
 */
function createProductionApp() {
  const app = express();

  // CSP nonce generation middleware
  app.use((req, res, next) => {
    (res as any).cspNonce = randomUUID().replace(/-/g, '');
    next();
  });

  // Security headers (production config)
  app.use((req, res, next) => {
    const nonce = (res as any).cspNonce;

    const helmetMiddleware = helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", `'nonce-${nonce}'`],
          'style-src': ["'self'", "'unsafe-inline'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'https:', 'data:'],
          'connect-src': [
            "'self'",
            'wss:',
            'https://api.printyx.net',
            'https://functions.printyx.net',
          ],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'report-uri': ['/api/csp-report'],
          'report-to': ['csp-endpoint'],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      hidePoweredBy: true,
      xContentTypeOptions: true,
    });

    helmetMiddleware(req, res, next);
  });

  // Permissions-Policy header
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(self)',
    );
    next();
  });

  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

/**
 * Creates a test Express app with development mode config (CSP disabled).
 */
function createDevelopmentApp() {
  const app = express();

  app.use((req, res, next) => {
    (res as any).cspNonce = randomUUID().replace(/-/g, '');
    next();
  });

  // In development, CSP is disabled (false)
  app.use((req, res, next) => {
    const helmetMiddleware = helmet({
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      hidePoweredBy: true,
      xContentTypeOptions: true,
    });

    helmetMiddleware(req, res, next);
  });

  app.get('/test', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('Security Headers (SEC-003)', () => {
  describe('Production mode', () => {
    const app = createProductionApp();

    it('should set Content-Security-Policy header', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
    });

    it('should include nonce in script-src directive', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toMatch(/script-src[^;]*'nonce-[a-f0-9]+'/);
    });

    it('should restrict default-src to self only', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    it('should restrict connect-src to specific domains', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("connect-src 'self' wss: https://api.printyx.net https://functions.printyx.net");
    });

    it('should block all frame ancestors (X-Frame-Options: DENY)', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should disallow object-src', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("object-src 'none'");
    });

    it('should restrict base-uri to self', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("base-uri 'self'");
    });

    it('should restrict form-action to self', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("form-action 'self'");
    });

    it('should include CSP report-uri', async () => {
      const res = await request(app).get('/test');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain('report-uri /api/csp-report');
    });

    it('should set X-Content-Type-Options to nosniff', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options to DENY', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should set HSTS with max-age=31536000 (1 year), includeSubDomains, and preload', async () => {
      const res = await request(app).get('/test');
      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should remove X-Powered-By header', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should set Permissions-Policy header', async () => {
      const res = await request(app).get('/test');
      const pp = res.headers['permissions-policy'];
      expect(pp).toBeDefined();
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
      expect(pp).toContain('payment=(self)');
    });

    it('should set Cross-Origin-Opener-Policy to same-origin', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('should set Cross-Origin-Resource-Policy to cross-origin', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('should generate unique nonces per request', async () => {
      const res1 = await request(app).get('/test');
      const res2 = await request(app).get('/test');
      const csp1 = res1.headers['content-security-policy'];
      const csp2 = res2.headers['content-security-policy'];
      const nonce1 = csp1.match(/nonce-([a-f0-9]+)/)?.[1];
      const nonce2 = csp2.match(/nonce-([a-f0-9]+)/)?.[1];
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('Development mode', () => {
    const app = createDevelopmentApp();

    it('should NOT set Content-Security-Policy in development', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('should still set X-Content-Type-Options in development', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should still remove X-Powered-By in development', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should still set HSTS in development', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should still set Referrer-Policy in development', async () => {
      const res = await request(app).get('/test');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('CSP violation reporting endpoint', () => {
    it('should accept CSP violation reports', async () => {
      const reportApp = express();
      reportApp.post(
        '/api/csp-report',
        express.json({ type: ['application/csp-report', 'application/json'], limit: '16kb' }),
        (req, res) => {
          const report = req.body?.['csp-report'] || req.body;
          if (!report) {
            return res.status(400).json({ message: 'No CSP report payload' });
          }
          res.status(204).end();
        },
      );

      const report = {
        'csp-report': {
          'document-uri': 'https://printyx.net/dashboard',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/malicious.js',
          'original-policy': "default-src 'self'; script-src 'self'",
          'source-file': 'https://printyx.net/dashboard',
          'line-number': 42,
          'column-number': 10,
        },
      };

      const res = await request(reportApp)
        .post('/api/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify(report));

      expect(res.status).toBe(204);
    });

    it('should return 400 for empty CSP report', async () => {
      const reportApp = express();
      reportApp.post(
        '/api/csp-report',
        express.json({ type: ['application/csp-report', 'application/json'], limit: '16kb' }),
        (req, res) => {
          const report = req.body?.['csp-report'] || req.body;
          if (!report || Object.keys(report).length === 0) {
            return res.status(400).json({ message: 'No CSP report payload' });
          }
          res.status(204).end();
        },
      );

      const res = await request(reportApp)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

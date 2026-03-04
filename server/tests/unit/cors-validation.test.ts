import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCorsConfig,
  isAllowedOrigin,
  getValidatedOrigin,
  isMutationMethod,
} from '../../config/cors';

// Mock the logger to prevent actual log output during tests
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

describe('SEC-010: CORS Hardening and Origin Validation', () => {
  const originalEnv = process.env.CORS_ADDITIONAL_ORIGINS;

  beforeEach(() => {
    delete process.env.CORS_ADDITIONAL_ORIGINS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CORS_ADDITIONAL_ORIGINS = originalEnv;
    } else {
      delete process.env.CORS_ADDITIONAL_ORIGINS;
    }
  });

  describe('getCorsConfig', () => {
    it('returns development config with localhost origins', () => {
      const config = getCorsConfig('development');
      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowedOrigins).toContain('http://localhost:5000');
      expect(config.allowedOrigins).toContain('http://localhost:5173');
      expect(config.allowedOrigins).toContain('http://127.0.0.1:3000');
      expect(config.allowedOrigins).toContain('http://127.0.0.1:5000');
      expect(config.allowedOrigins).toContain('http://127.0.0.1:5173');
      expect(config.enforceMutationOrigin).toBe(false);
    });

    it('returns staging config with staging.printyx.net only', () => {
      const config = getCorsConfig('staging');
      expect(config.allowedOrigins).toEqual(['https://staging.printyx.net']);
      expect(config.allowedPatterns).toEqual([]);
      expect(config.enforceMutationOrigin).toBe(true);
    });

    it('returns production config with printyx.net origins only', () => {
      const config = getCorsConfig('production');
      expect(config.allowedOrigins).toContain('https://printyx.net');
      expect(config.allowedOrigins).toContain('https://api.printyx.net');
      expect(config.enforceMutationOrigin).toBe(true);
    });

    it('never includes wildcard * in any environment', () => {
      for (const env of ['development', 'staging', 'production', 'test']) {
        const config = getCorsConfig(env);
        expect(config.allowedOrigins).not.toContain('*');
      }
    });

    it('always sets credentials to true', () => {
      for (const env of ['development', 'staging', 'production', 'test']) {
        const config = getCorsConfig(env);
        expect(config.credentials).toBe(true);
      }
    });

    it('defaults to production config for unknown environments', () => {
      const config = getCorsConfig('unknown-env');
      expect(config.enforceMutationOrigin).toBe(true);
      expect(config.allowedOrigins).toContain('https://printyx.net');
    });
  });

  describe('isAllowedOrigin', () => {
    // --- Allowed origins pass ---
    it('allows printyx.net in production', () => {
      expect(isAllowedOrigin('https://printyx.net', 'production')).toBe(true);
    });

    it('allows api.printyx.net in production', () => {
      expect(isAllowedOrigin('https://api.printyx.net', 'production')).toBe(true);
    });

    it('allows subdomain patterns in production', () => {
      expect(isAllowedOrigin('https://app.printyx.net', 'production')).toBe(true);
      expect(isAllowedOrigin('https://dashboard.printyx.net', 'production')).toBe(true);
    });

    it('allows staging.printyx.net in staging', () => {
      expect(isAllowedOrigin('https://staging.printyx.net', 'staging')).toBe(true);
    });

    // --- Unknown origins blocked ---
    it('blocks unknown origin in production', () => {
      expect(isAllowedOrigin('https://evil.com', 'production')).toBe(false);
    });

    it('blocks unknown origin in staging', () => {
      expect(isAllowedOrigin('https://evil.com', 'staging')).toBe(false);
    });

    it('blocks unknown origin in development', () => {
      expect(isAllowedOrigin('https://evil.com', 'development')).toBe(false);
    });

    // --- Wildcard not reflected ---
    it('does not accept wildcard * as an origin', () => {
      expect(isAllowedOrigin('*', 'development')).toBe(false);
      expect(isAllowedOrigin('*', 'production')).toBe(false);
    });

    // --- localhost allowed in development ---
    it('allows localhost:3000 in development', () => {
      expect(isAllowedOrigin('http://localhost:3000', 'development')).toBe(true);
    });

    it('allows localhost:5000 in development', () => {
      expect(isAllowedOrigin('http://localhost:5000', 'development')).toBe(true);
    });

    it('allows localhost:5173 in development', () => {
      expect(isAllowedOrigin('http://localhost:5173', 'development')).toBe(true);
    });

    it('allows 127.0.0.1 variants in development', () => {
      expect(isAllowedOrigin('http://127.0.0.1:3000', 'development')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:5000', 'development')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:5173', 'development')).toBe(true);
    });

    it('allows replit.dev subdomains in development', () => {
      expect(
        isAllowedOrigin('https://my-project-abc123.replit.dev', 'development'),
      ).toBe(true);
    });

    // --- localhost NOT allowed in production ---
    it('blocks localhost in production', () => {
      expect(isAllowedOrigin('http://localhost:3000', 'production')).toBe(false);
      expect(isAllowedOrigin('http://localhost:5000', 'production')).toBe(false);
      expect(isAllowedOrigin('http://localhost:5173', 'production')).toBe(false);
    });

    it('blocks 127.0.0.1 in production', () => {
      expect(isAllowedOrigin('http://127.0.0.1:3000', 'production')).toBe(false);
      expect(isAllowedOrigin('http://127.0.0.1:5000', 'production')).toBe(false);
    });

    it('blocks replit.dev in production', () => {
      expect(
        isAllowedOrigin('https://my-project.replit.dev', 'production'),
      ).toBe(false);
    });

    // --- Origin reflection attack blocked ---
    it('blocks origin reflection attack with similar domain', () => {
      expect(isAllowedOrigin('https://evil-printyx.net', 'production')).toBe(false);
    });

    it('blocks origin reflection attack with prefix', () => {
      expect(isAllowedOrigin('https://notprintyx.net', 'production')).toBe(false);
    });

    it('blocks origin reflection attack with path manipulation', () => {
      expect(
        isAllowedOrigin('https://printyx.net.evil.com', 'production'),
      ).toBe(false);
    });

    it('blocks HTTP protocol for production domains', () => {
      // Production pattern requires https
      expect(isAllowedOrigin('http://printyx.net', 'production')).toBe(false);
    });

    // --- Empty/null origin ---
    it('rejects empty string origin', () => {
      expect(isAllowedOrigin('', 'production')).toBe(false);
      expect(isAllowedOrigin('', 'development')).toBe(false);
    });

    // --- CORS_ADDITIONAL_ORIGINS support ---
    it('allows additional origins from environment variable', () => {
      process.env.CORS_ADDITIONAL_ORIGINS = 'https://custom.example.com';
      expect(isAllowedOrigin('https://custom.example.com', 'production')).toBe(true);
    });
  });

  describe('getValidatedOrigin', () => {
    it('returns the origin string for allowed origins', () => {
      expect(getValidatedOrigin('https://printyx.net', 'production')).toBe(
        'https://printyx.net',
      );
    });

    it('returns false for disallowed origins', () => {
      expect(getValidatedOrigin('https://evil.com', 'production')).toBe(false);
    });

    it('returns false for undefined origin (same-origin request)', () => {
      expect(getValidatedOrigin(undefined, 'production')).toBe(false);
    });

    // --- Credentials not sent to unknown origins ---
    it('does not return a truthy value for unknown origins (no credentials exposure)', () => {
      const result = getValidatedOrigin('https://evil.com', 'production');
      // If result is false, the CORS middleware will not set
      // Access-Control-Allow-Credentials header
      expect(result).toBe(false);
    });
  });

  describe('isMutationMethod', () => {
    it('identifies POST as mutation', () => {
      expect(isMutationMethod('POST')).toBe(true);
    });

    it('identifies PUT as mutation', () => {
      expect(isMutationMethod('PUT')).toBe(true);
    });

    it('identifies PATCH as mutation', () => {
      expect(isMutationMethod('PATCH')).toBe(true);
    });

    it('identifies DELETE as mutation', () => {
      expect(isMutationMethod('DELETE')).toBe(true);
    });

    it('does not identify GET as mutation', () => {
      expect(isMutationMethod('GET')).toBe(false);
    });

    it('does not identify OPTIONS as mutation', () => {
      expect(isMutationMethod('OPTIONS')).toBe(false);
    });

    it('does not identify HEAD as mutation', () => {
      expect(isMutationMethod('HEAD')).toBe(false);
    });
  });

  describe('Production mutation origin enforcement', () => {
    it('production config enforces mutation origin', () => {
      const config = getCorsConfig('production');
      expect(config.enforceMutationOrigin).toBe(true);
    });

    it('staging config enforces mutation origin', () => {
      const config = getCorsConfig('staging');
      expect(config.enforceMutationOrigin).toBe(true);
    });

    it('development config does NOT enforce mutation origin', () => {
      const config = getCorsConfig('development');
      expect(config.enforceMutationOrigin).toBe(false);
    });

    // Missing origin on mutation blocked in production
    // (This tests the logic that the middleware uses; the actual middleware
    // integration is verified by checking enforceMutationOrigin + getValidatedOrigin)
    it('missing origin on mutation should be blocked in production (enforceMutationOrigin is true and getValidatedOrigin returns false for undefined)', () => {
      const config = getCorsConfig('production');
      expect(config.enforceMutationOrigin).toBe(true);
      // The middleware checks: if enforceMutationOrigin && isMutationMethod && !origin -> 403
      expect(isMutationMethod('POST')).toBe(true);
      expect(getValidatedOrigin(undefined, 'production')).toBe(false);
    });

    it('non-allowlisted origin on mutation should be blocked in production', () => {
      const config = getCorsConfig('production');
      expect(config.enforceMutationOrigin).toBe(true);
      expect(isMutationMethod('DELETE')).toBe(true);
      expect(getValidatedOrigin('https://evil.com', 'production')).toBe(false);
    });
  });
});

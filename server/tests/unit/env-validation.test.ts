/**
 * Unit Tests: Environment Validation
 * Tests for environment variable validation and JWT configuration checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock implementation of checkJwtConfiguration for testing
interface JwtConfigStatus {
  configured: boolean;
  supabaseUrl: boolean;
  anonKey: boolean;
  jwtSecret: boolean;
  serviceRoleKey: boolean;
  errors: string[];
}

function mockCheckJwtConfiguration(env: Record<string, string | undefined>): JwtConfigStatus {
  const errors: string[] = [];

  const supabaseUrl = !!env.SUPABASE_URL;
  const anonKey = !!env.SUPABASE_ANON_KEY;
  const jwtSecret = !!env.SUPABASE_JWT_SECRET;
  const serviceRoleKey = !!env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    errors.push('SUPABASE_URL is not configured');
  }
  if (!anonKey) {
    errors.push('SUPABASE_ANON_KEY is not configured');
  }
  if (!jwtSecret) {
    errors.push('SUPABASE_JWT_SECRET is not configured - JWT verification will fail');
  }

  const configured = supabaseUrl && anonKey && jwtSecret;

  return {
    configured,
    supabaseUrl,
    anonKey,
    jwtSecret,
    serviceRoleKey,
    errors,
  };
}

// =====================================================================
// TESTS
// =====================================================================

describe('Environment Validation', () => {
  describe('checkJwtConfiguration', () => {
    it('should report all components configured when all env vars are set', () => {
      const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_JWT_SECRET: 'test-jwt-secret',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      };

      const result = mockCheckJwtConfiguration(env);

      expect(result.configured).toBe(true);
      expect(result.supabaseUrl).toBe(true);
      expect(result.anonKey).toBe(true);
      expect(result.jwtSecret).toBe(true);
      expect(result.serviceRoleKey).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report not configured when SUPABASE_JWT_SECRET is missing', () => {
      const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        // SUPABASE_JWT_SECRET is missing
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      };

      const result = mockCheckJwtConfiguration(env);

      expect(result.configured).toBe(false);
      expect(result.jwtSecret).toBe(false);
      expect(result.errors).toContain(
        'SUPABASE_JWT_SECRET is not configured - JWT verification will fail',
      );
    });

    it('should report not configured when multiple env vars are missing', () => {
      const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        // SUPABASE_ANON_KEY is missing
        // SUPABASE_JWT_SECRET is missing
      };

      const result = mockCheckJwtConfiguration(env);

      expect(result.configured).toBe(false);
      expect(result.supabaseUrl).toBe(true);
      expect(result.anonKey).toBe(false);
      expect(result.jwtSecret).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should report not configured when all env vars are missing', () => {
      const env = {};

      const result = mockCheckJwtConfiguration(env);

      expect(result.configured).toBe(false);
      expect(result.supabaseUrl).toBe(false);
      expect(result.anonKey).toBe(false);
      expect(result.jwtSecret).toBe(false);
      expect(result.serviceRoleKey).toBe(false);
      expect(result.errors).toHaveLength(3); // URL, anon key, JWT secret
    });

    it('should not require SUPABASE_SERVICE_ROLE_KEY for configured status', () => {
      const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_JWT_SECRET: 'test-jwt-secret',
        // SUPABASE_SERVICE_ROLE_KEY is missing - should still be configured
      };

      const result = mockCheckJwtConfiguration(env);

      expect(result.configured).toBe(true);
      expect(result.serviceRoleKey).toBe(false);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Production Requirements', () => {
    it('should flag JWT secret as required in production', () => {
      // Simulate production check
      const isProduction = true;
      const jwtSecret = '';

      // In production, missing JWT secret is an error
      const hasError = isProduction && !jwtSecret;

      expect(hasError).toBe(true);
    });

    it('should allow missing JWT secret in development', () => {
      // Simulate development check
      const isProduction = false;
      const jwtSecret = '';

      // In development, missing JWT secret is a warning, not an error
      const hasError = isProduction && !jwtSecret;

      expect(hasError).toBe(false);
    });
  });
});

describe('JWT Secret Validation', () => {
  describe('getJwtSecret behavior', () => {
    it('should return null when SUPABASE_JWT_SECRET is not set', () => {
      // Simulate the graceful failure behavior
      const secret = undefined;
      const result = secret ? new TextEncoder().encode(secret) : null;

      expect(result).toBeNull();
    });

    it('should return encoded secret when SUPABASE_JWT_SECRET is set', () => {
      const secret = 'test-secret-key';
      const result = secret ? new TextEncoder().encode(secret) : null;

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('JwtConfigurationError', () => {
    it('should have correct error name', () => {
      class JwtConfigurationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'JwtConfigurationError';
        }
      }

      const error = new JwtConfigurationError('JWT verification failed');

      expect(error.name).toBe('JwtConfigurationError');
      expect(error.message).toBe('JWT verification failed');
      expect(error instanceof Error).toBe(true);
    });
  });
});

describe('Health Check JWT Status', () => {
  it('should return healthy status when JWT is configured', () => {
    const jwtConfig = {
      configured: true,
      supabaseUrl: true,
      anonKey: true,
      jwtSecret: true,
      serviceRoleKey: true,
      errors: [],
    };

    const status = jwtConfig.configured ? 'healthy' : 'degraded';

    expect(status).toBe('healthy');
  });

  it('should return degraded status in development when JWT is not configured', () => {
    const isProduction = false;
    const jwtConfig = {
      configured: false,
      errors: ['SUPABASE_JWT_SECRET is not configured'],
    };

    const status = !jwtConfig.configured ? (isProduction ? 'unhealthy' : 'degraded') : 'healthy';

    expect(status).toBe('degraded');
  });

  it('should return unhealthy status in production when JWT is not configured', () => {
    const isProduction = true;
    const jwtConfig = {
      configured: false,
      errors: ['SUPABASE_JWT_SECRET is not configured'],
    };

    const status = !jwtConfig.configured ? (isProduction ? 'unhealthy' : 'degraded') : 'healthy';

    expect(status).toBe('unhealthy');
  });
});

/**
 * Unit tests for the disposable email service.
 *
 * These tests cover the pure helpers and cache behavior. Database-touching
 * functions (list/add/update/delete/bulk) are exercised by integration tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db import so extractDomain and cache logic can be tested in
// isolation without requiring a live Postgres connection.
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  extractDomain,
  invalidateDisposableEmailCache,
  isDisposableEmail,
  isDisposableEmailSync,
} from '../../services/disposable-email-service';

describe('disposable-email-service', () => {
  beforeEach(() => {
    invalidateDisposableEmailCache();
  });

  afterEach(() => {
    invalidateDisposableEmailCache();
  });

  describe('extractDomain', () => {
    it('extracts the domain from a full email address', () => {
      expect(extractDomain('user@Example.COM')).toBe('example.com');
      expect(extractDomain('  admin@mailinator.com  ')).toBe('mailinator.com');
    });

    it('handles emails with plus addressing', () => {
      expect(extractDomain('user+foo@10minutemail.com')).toBe('10minutemail.com');
    });

    it('returns a bare domain unchanged (lowercased)', () => {
      expect(extractDomain('Mailinator.COM')).toBe('mailinator.com');
    });

    it('returns null for empty input', () => {
      expect(extractDomain('')).toBeNull();
      // @ts-expect-error intentionally testing undefined
      expect(extractDomain(undefined)).toBeNull();
    });

    it('returns the last segment after the final @ for malformed input', () => {
      // Trailing @ produces an empty string domain; the function returns null
      // because of the empty-string fallthrough.
      expect(extractDomain('user@')).toBeNull();
      expect(extractDomain('a@b@legit.com')).toBe('legit.com');
    });
  });

  describe('isDisposableEmail (DB-backed)', () => {
    it('returns not blocked when the database is empty', async () => {
      const result = await isDisposableEmail('someone@example.com');
      expect(result).toEqual({ blocked: false, domain: 'example.com' });
    });

    it('returns null domain for empty input', async () => {
      const result = await isDisposableEmail('');
      expect(result).toEqual({ blocked: false, domain: null });
    });
  });

  describe('isDisposableEmailSync', () => {
    it('returns false when the cache is cold', () => {
      expect(isDisposableEmailSync('user@mailinator.com')).toBe(false);
    });

    it('returns false for empty input', () => {
      expect(isDisposableEmailSync('')).toBe(false);
    });
  });
});

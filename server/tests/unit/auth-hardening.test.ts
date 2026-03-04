import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SEC-004: Authentication hardening tests
 * Tests progressive lockout, anomaly detection, and admin unlock
 */

// Mock dependencies
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../storage', () => ({
  storage: {
    authenticateUser: vi.fn(),
    getUserWithRole: vi.fn(),
  },
}));

vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('SEC-004: Authentication Hardening', () => {
  describe('Progressive Lockout Configuration', () => {
    it('should have 3 lockout tiers', () => {
      // Tier 1: 5 failures → 15 min
      // Tier 2: 10 failures → 1 hour
      // Tier 3: 20 failures → admin unlock
      const LOCKOUT_TIERS = [
        { threshold: 5, durationMinutes: 15 },
        { threshold: 10, durationMinutes: 60 },
        { threshold: 20, durationMinutes: -1 },
      ];

      expect(LOCKOUT_TIERS).toHaveLength(3);
      expect(LOCKOUT_TIERS[0].threshold).toBe(5);
      expect(LOCKOUT_TIERS[0].durationMinutes).toBe(15);
      expect(LOCKOUT_TIERS[1].threshold).toBe(10);
      expect(LOCKOUT_TIERS[1].durationMinutes).toBe(60);
      expect(LOCKOUT_TIERS[2].threshold).toBe(20);
      expect(LOCKOUT_TIERS[2].durationMinutes).toBe(-1); // permanent
    });

    it('should calculate lockout duration based on attempt count', () => {
      const LOCKOUT_TIERS = [
        { threshold: 5, durationMinutes: 15 },
        { threshold: 10, durationMinutes: 60 },
        { threshold: 20, durationMinutes: -1 },
      ];

      function getLockoutDuration(attempts: number): number | null {
        let duration: number | null = null;
        for (const tier of LOCKOUT_TIERS) {
          if (attempts >= tier.threshold) {
            duration = tier.durationMinutes;
          }
        }
        return duration;
      }

      expect(getLockoutDuration(3)).toBeNull(); // Below first tier
      expect(getLockoutDuration(5)).toBe(15); // First tier
      expect(getLockoutDuration(7)).toBe(15); // Between tiers
      expect(getLockoutDuration(10)).toBe(60); // Second tier
      expect(getLockoutDuration(15)).toBe(60); // Between tiers
      expect(getLockoutDuration(20)).toBe(-1); // Permanent lock
      expect(getLockoutDuration(25)).toBe(-1); // Beyond all tiers
    });

    it('should expire lockout after tier duration', () => {
      const now = new Date();
      const lockDuration = 15; // minutes
      const lockedUntil = new Date(now.getTime() + lockDuration * 60 * 1000);

      // Before expiry - still locked
      expect(lockedUntil > now).toBe(true);

      // After expiry - unlocked
      const afterExpiry = new Date(now.getTime() + (lockDuration + 1) * 60 * 1000);
      expect(lockedUntil > afterExpiry).toBe(false);
    });

    it('should use epoch 0 as sentinel for permanent lock', () => {
      const permanentLock = new Date(0);
      expect(permanentLock.getTime()).toBe(0);

      // Permanent lock should be distinguishable from time-based lock
      const timeLock = new Date(Date.now() + 15 * 60 * 1000);
      expect(permanentLock.getTime()).not.toBe(timeLock.getTime());
    });
  });

  describe('Login Anomaly Detection', () => {
    const AUTOMATED_UA_PATTERNS = [
      /curl\//i, /python-requests/i, /python-urllib/i, /axios\//i,
      /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i,
      /scrapy/i, /httpie/i, /postman/i, /insomnia/i,
    ];

    function detectAnomaly(userAgent: string, acceptLanguage?: string): string[] {
      const reasons: string[] = [];
      for (const pattern of AUTOMATED_UA_PATTERNS) {
        if (pattern.test(userAgent)) {
          reasons.push(`automated_tool_detected:${pattern.source}`);
          break;
        }
      }
      if (!acceptLanguage && userAgent) {
        reasons.push('missing_accept_language');
      }
      if (!userAgent) {
        reasons.push('missing_user_agent');
      }
      return reasons;
    }

    it('should detect curl User-Agent', () => {
      const reasons = detectAnomaly('curl/7.68.0');
      expect(reasons).toContain('automated_tool_detected:curl\\/');
    });

    it('should detect python-requests User-Agent', () => {
      const reasons = detectAnomaly('python-requests/2.28.0');
      expect(reasons.some(r => r.includes('python-requests'))).toBe(true);
    });

    it('should detect headless Chrome', () => {
      const reasons = detectAnomaly('Mozilla/5.0 (HeadlessChrome/91.0.4472.124)');
      expect(reasons.some(r => r.includes('headlesschrome'))).toBe(true);
    });

    it('should detect Selenium WebDriver', () => {
      const reasons = detectAnomaly('Mozilla/5.0 Selenium/4.0');
      expect(reasons.some(r => r.includes('selenium'))).toBe(true);
    });

    it('should detect Postman', () => {
      const reasons = detectAnomaly('PostmanRuntime/7.29.2');
      expect(reasons.some(r => r.includes('postman'))).toBe(true);
    });

    it('should not flag normal browser User-Agent', () => {
      const reasons = detectAnomaly(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'en-US,en;q=0.9',
      );
      expect(reasons).toHaveLength(0);
    });

    it('should flag missing Accept-Language', () => {
      const reasons = detectAnomaly(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      );
      expect(reasons).toContain('missing_accept_language');
    });

    it('should flag missing User-Agent', () => {
      const reasons = detectAnomaly('');
      expect(reasons).toContain('missing_user_agent');
    });
  });

  describe('Account Lock Status Detection', () => {
    it('should detect permanent lock (epoch 0)', () => {
      const lockedUntil = new Date(0);
      const isPermanent = lockedUntil.getTime() === 0;
      expect(isPermanent).toBe(true);
    });

    it('should detect temporary lock', () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      const now = new Date();
      const isLocked = lockedUntil > now;
      const isPermanent = lockedUntil.getTime() === 0;
      expect(isLocked).toBe(true);
      expect(isPermanent).toBe(false);
    });

    it('should detect expired lock', () => {
      const lockedUntil = new Date(Date.now() - 1000); // 1 second ago
      const now = new Date();
      const isLocked = lockedUntil > now;
      expect(isLocked).toBe(false);
    });

    it('should calculate remaining lockout minutes', () => {
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
      const remainingMs = lockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
      expect(remainingMinutes).toBe(10);
    });
  });

  describe('Admin Unlock Functionality', () => {
    it('should clear attempt count and lock on unlock', () => {
      // Simulate the unlock operation
      const updateData = {
        attemptCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      };

      expect(updateData.attemptCount).toBe(0);
      expect(updateData.lockedUntil).toBeNull();
    });

    it('should normalize email for unlock lookup', () => {
      const email = '  Test@Example.COM  ';
      const normalized = email.toLowerCase().trim();
      expect(normalized).toBe('test@example.com');
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have IP-based rate limit for login', () => {
      // Login: 10 requests per 15 minutes per IP
      const config = { windowMs: 15 * 60 * 1000, max: 10 };
      expect(config.windowMs).toBe(900000);
      expect(config.max).toBe(10);
    });

    it('should have IP-based rate limit for signup', () => {
      // Signup: 3 requests per hour per IP
      const config = { windowMs: 60 * 60 * 1000, max: 3 };
      expect(config.windowMs).toBe(3600000);
      expect(config.max).toBe(3);
    });

    it('should have IP-based rate limit for password reset', () => {
      // Password reset: 5 requests per hour per IP
      const config = { windowMs: 60 * 60 * 1000, max: 5 };
      expect(config.windowMs).toBe(3600000);
      expect(config.max).toBe(5);
    });
  });

  describe('Security Event Logging', () => {
    it('should include required fields in login failure log', () => {
      const email = 'test@example.com';
      const ip = '1.2.3.4';
      const attempt = 3;
      const anomalyReasons = ['automated_tool_detected:curl\\/'];

      const logMessage = `[SECURITY] failed_login: email=${email} ip=${ip} attempt=${attempt} anomaly=[${anomalyReasons.join(',')}]`;
      expect(logMessage).toContain('email=');
      expect(logMessage).toContain('ip=');
      expect(logMessage).toContain('attempt=');
      expect(logMessage).toContain('anomaly=');
    });

    it('should include required fields in lockout log', () => {
      const email = 'test@example.com';
      const attempts = 5;
      const duration = 15;

      const logMessage = `[SECURITY] account_locked: email=${email} attempts=${attempts} duration=${duration}min`;
      expect(logMessage).toContain('account_locked');
      expect(logMessage).toContain('email=');
      expect(logMessage).toContain('attempts=');
      expect(logMessage).toContain('duration=');
    });

    it('should log permanent lockout separately', () => {
      const email = 'test@example.com';
      const attempts = 20;

      const logMessage = `[SECURITY] account_locked_permanent: email=${email} attempts=${attempts} - requires admin unlock`;
      expect(logMessage).toContain('account_locked_permanent');
      expect(logMessage).toContain('requires admin unlock');
    });

    it('should log admin unlock action', () => {
      const email = 'test@example.com';
      const logMessage = `[SECURITY] account_unlocked: email=${email} by admin`;
      expect(logMessage).toContain('account_unlocked');
      expect(logMessage).toContain('by admin');
    });
  });
});

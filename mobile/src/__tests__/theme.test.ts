import { colors, spacing, typography, touchTargets } from '@/theme';

describe('theme', () => {
  describe('colors', () => {
    it('has primary color scale', () => {
      expect(colors.primary[500]).toBe('#3b82f6');
      expect(colors.primary[600]).toBe('#2563eb');
    });

    it('has semantic colors', () => {
      expect(colors.success.main).toBeTruthy();
      expect(colors.warning.main).toBeTruthy();
      expect(colors.error.main).toBeTruthy();
      expect(colors.info.main).toBeTruthy();
    });

    it('has dark mode colors', () => {
      expect(colors.dark.background.default).toBeTruthy();
      expect(colors.dark.text.primary).toBeTruthy();
    });
  });

  describe('spacing', () => {
    it('has progressive scale', () => {
      expect(spacing.xs).toBeLessThan(spacing.sm);
      expect(spacing.sm).toBeLessThan(spacing.md);
      expect(spacing.md).toBeLessThan(spacing.lg);
      expect(spacing.lg).toBeLessThan(spacing.xl);
    });
  });

  describe('typography', () => {
    it('has heading styles', () => {
      expect(typography.h1.fontSize).toBeGreaterThan(typography.h2.fontSize);
      expect(typography.h2.fontSize).toBeGreaterThan(typography.h3.fontSize);
    });

    it('has body styles', () => {
      expect(typography.body.fontSize).toBe(16);
      expect(typography.bodySmall.fontSize).toBe(14);
    });
  });

  describe('touchTargets', () => {
    it('meets minimum accessibility requirements', () => {
      // iOS requires 44pt, Android requires 48dp
      expect(touchTargets.minimum).toBeGreaterThanOrEqual(44);
      expect(touchTargets.comfortable).toBeGreaterThanOrEqual(48);
    });
  });
});

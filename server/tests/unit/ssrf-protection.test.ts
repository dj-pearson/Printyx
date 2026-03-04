import { describe, it, expect } from 'vitest';
import { validateUrl, isPrivateIP } from '../../middleware/ssrf-protection';

describe('SSRF Protection', () => {
  describe('validateUrl', () => {
    describe('blocks private/internal IPs', () => {
      const blockedIPs = [
        { ip: '10.0.0.1', label: '10.x range (RFC 1918)' },
        { ip: '10.255.255.255', label: '10.x range upper bound' },
        { ip: '172.16.0.1', label: '172.16.x range (RFC 1918)' },
        { ip: '172.31.255.255', label: '172.31.x range upper bound' },
        { ip: '192.168.1.1', label: '192.168.x range (RFC 1918)' },
        { ip: '192.168.0.100', label: '192.168.x range' },
        { ip: '127.0.0.1', label: 'Loopback' },
        { ip: '127.255.255.255', label: 'Loopback range upper bound' },
      ];

      for (const { ip, label } of blockedIPs) {
        it(`should block ${ip} (${label})`, () => {
          const result = validateUrl(`http://${ip}/path`);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('private');
        });
      }
    });

    describe('blocks cloud metadata endpoints', () => {
      it('should block 169.254.169.254 (AWS/GCP metadata)', () => {
        const result = validateUrl('http://169.254.169.254/latest/meta-data/');
        expect(result.valid).toBe(false);
      });

      it('should block link-local range 169.254.x.x', () => {
        const result = validateUrl('http://169.254.1.1/');
        expect(result.valid).toBe(false);
      });

      it('should block metadata.google.internal', () => {
        const result = validateUrl('http://metadata.google.internal/computeMetadata/v1/');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('cloud metadata');
      });
    });

    describe('blocks non-http schemes', () => {
      const blockedSchemes = [
        'file:///etc/passwd',
        'ftp://evil.com/data',
        'gopher://evil.com:70/',
        'data:text/html,<script>alert(1)</script>',
        'javascript:alert(1)',
      ];

      for (const url of blockedSchemes) {
        it(`should block ${url.split(':')[0]}:// scheme`, () => {
          const result = validateUrl(url);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('Blocked scheme');
        });
      }
    });

    describe('blocks IPv6 loopback and link-local', () => {
      it('should block IPv6 loopback [::1]', () => {
        const result = validateUrl('http://[::1]/');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('private');
      });

      it('should block IPv6 link-local [fe80::1]', () => {
        const result = validateUrl('http://[fe80::1]/');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('private');
      });
    });

    describe('allows valid external URLs', () => {
      const allowedUrls = [
        'https://api.example.com/data',
        'https://www.google.com',
        'http://example.com:8080/path?query=1',
        'https://1.1.1.1/dns-query',
        'https://8.8.8.8/',
        'https://203.0.114.1/', // Just outside documentation range
      ];

      for (const url of allowedUrls) {
        it(`should allow ${url}`, () => {
          const result = validateUrl(url);
          expect(result.valid).toBe(true);
        });
      }
    });

    describe('blocks invalid URLs', () => {
      it('should reject malformed URLs', () => {
        const result = validateUrl('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Invalid URL');
      });

      it('should reject numeric IP obfuscation', () => {
        const result = validateUrl('http://0x7f000001/');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('isPrivateIP', () => {
    describe('IPv4 private ranges', () => {
      it('should identify 10.0.0.1 as private', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
      });

      it('should identify 172.16.0.1 as private', () => {
        expect(isPrivateIP('172.16.0.1')).toBe(true);
      });

      it('should identify 192.168.1.1 as private', () => {
        expect(isPrivateIP('192.168.1.1')).toBe(true);
      });

      it('should identify 127.0.0.1 as private', () => {
        expect(isPrivateIP('127.0.0.1')).toBe(true);
      });

      it('should identify 169.254.169.254 as private', () => {
        expect(isPrivateIP('169.254.169.254')).toBe(true);
      });

      it('should not flag 8.8.8.8 as private', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false);
      });

      it('should not flag 1.1.1.1 as private', () => {
        expect(isPrivateIP('1.1.1.1')).toBe(false);
      });

      it('should not flag 203.0.114.1 as private', () => {
        expect(isPrivateIP('203.0.114.1')).toBe(false);
      });
    });

    describe('IPv6 addresses', () => {
      it('should identify ::1 as private (loopback)', () => {
        expect(isPrivateIP('::1')).toBe(true);
      });

      it('should identify fe80::1 as private (link-local)', () => {
        expect(isPrivateIP('fe80::1')).toBe(true);
      });

      it('should identify fd00::1 as private (unique local)', () => {
        expect(isPrivateIP('fd00::1')).toBe(true);
      });

      it('should identify fc00::1 as private (unique local)', () => {
        expect(isPrivateIP('fc00::1')).toBe(true);
      });
    });

    describe('IPv4-mapped IPv6', () => {
      it('should identify ::ffff:127.0.0.1 as private', () => {
        expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
      });

      it('should identify ::ffff:10.0.0.1 as private', () => {
        expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
      });

      it('should not flag ::ffff:8.8.8.8 as private', () => {
        expect(isPrivateIP('::ffff:8.8.8.8')).toBe(false);
      });
    });
  });
});

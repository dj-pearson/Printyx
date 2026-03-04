/**
 * SSRF Protection Middleware
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks by blocking:
 * - Private/internal IP ranges (RFC 1918, loopback, link-local)
 * - IPv6 loopback and link-local addresses
 * - Cloud metadata endpoints (AWS, GCP, Azure)
 * - Non-HTTP(S) schemes (file://, ftp://, gopher://, etc.)
 */

import { createModuleLogger } from '../lib/logger';
import * as net from 'net';

const log = createModuleLogger('ssrf-protection');

/**
 * Private and reserved IPv4 CIDR ranges that should be blocked.
 * Each entry contains the base address as a 32-bit integer and the subnet mask.
 */
const PRIVATE_IPV4_RANGES: Array<{ base: number; mask: number; label: string }> = [
  { base: ipToInt('10.0.0.0'), mask: 0xff000000, label: '10.0.0.0/8 (RFC 1918)' },
  { base: ipToInt('172.16.0.0'), mask: 0xfff00000, label: '172.16.0.0/12 (RFC 1918)' },
  { base: ipToInt('192.168.0.0'), mask: 0xffff0000, label: '192.168.0.0/16 (RFC 1918)' },
  { base: ipToInt('127.0.0.0'), mask: 0xff000000, label: '127.0.0.0/8 (Loopback)' },
  { base: ipToInt('169.254.0.0'), mask: 0xffff0000, label: '169.254.0.0/16 (Link-local)' },
  { base: ipToInt('0.0.0.0'), mask: 0xff000000, label: '0.0.0.0/8 (Current network)' },
  { base: ipToInt('100.64.0.0'), mask: 0xffc00000, label: '100.64.0.0/10 (Shared address space)' },
  { base: ipToInt('192.0.0.0'), mask: 0xffffff00, label: '192.0.0.0/24 (IETF Protocol)' },
  { base: ipToInt('192.0.2.0'), mask: 0xffffff00, label: '192.0.2.0/24 (Documentation)' },
  { base: ipToInt('198.51.100.0'), mask: 0xffffff00, label: '198.51.100.0/24 (Documentation)' },
  { base: ipToInt('203.0.113.0'), mask: 0xffffff00, label: '203.0.113.0/24 (Documentation)' },
  { base: ipToInt('224.0.0.0'), mask: 0xf0000000, label: '224.0.0.0/4 (Multicast)' },
  { base: ipToInt('240.0.0.0'), mask: 0xf0000000, label: '240.0.0.0/4 (Reserved)' },
];

/** Blocked hostnames known to serve cloud metadata */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'kubernetes.default.svc',
  'kubernetes.default',
]);

/** Allowed URL schemes */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Convert a dotted-quad IPv4 address to a 32-bit integer.
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  return ((parseInt(parts[0]) << 24) | (parseInt(parts[1]) << 16) | (parseInt(parts[2]) << 8) | parseInt(parts[3])) >>> 0;
}

/**
 * Check if an IP address (IPv4 or IPv6) is in a private/reserved range.
 */
export function isPrivateIP(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  const ipv4Mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4Mapped) {
    return isPrivateIPv4(ipv4Mapped[1]);
  }

  // Pure IPv4
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }

  // If we can't parse it, treat as private (fail closed)
  return true;
}

/**
 * Check if an IPv4 address is in a private/reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const ipInt = ipToInt(ip);
  for (const range of PRIVATE_IPV4_RANGES) {
    if ((ipInt & range.mask) === (range.base & range.mask)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an IPv6 address is private/reserved.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1)
  if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return true;
  }

  // Unspecified address (::)
  if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') {
    return true;
  }

  // Link-local (fe80::/10)
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // Unique local (fc00::/7 - fd00::/8 and fc00::/8)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a URL for SSRF safety. Returns valid: true if the URL is safe to request.
 * Blocks private IPs, cloud metadata, and non-HTTP(S) schemes.
 */
export function validateUrl(url: string): UrlValidationResult {
  // Parse the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { valid: false, reason: `Blocked scheme: ${parsed.protocol} (only http/https allowed)` };
  }

  // Extract hostname (strip brackets from IPv6 literals)
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return { valid: false, reason: `Blocked hostname: ${hostname} (cloud metadata endpoint)` };
  }

  // If hostname is an IP address, check if it's private
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, reason: `Blocked private/reserved IP: ${hostname}` };
    }
  }

  // Check for decimal/octal/hex IP encoding tricks
  // e.g., 0x7f000001, 2130706433 (decimal for 127.0.0.1), 0177.0.0.1 (octal)
  if (/^(0x[0-9a-f]+|[0-9]+)$/i.test(hostname)) {
    return { valid: false, reason: 'Blocked numeric IP encoding (possible obfuscation)' };
  }

  // Block hostnames that resolve to metadata IPs explicitly
  if (hostname === '169.254.169.254') {
    return { valid: false, reason: 'Blocked cloud metadata IP: 169.254.169.254' };
  }

  log.debug({ url: parsed.toString(), hostname }, 'URL passed SSRF validation');
  return { valid: true };
}

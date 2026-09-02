// SSRF protection for edge functions.
//
// PA-052: a faithful Deno port of server/middleware/ssrf-protection.ts, needed
// because the social-media function posts to a tenant-supplied webhook URL and
// runs with the service-role key. Without this, "broadcast this post" is an
// arbitrary outbound request from inside the cluster.
//
// Two deliberate differences from the Node original, both mechanical:
//   - `net.isIPv4` / `net.isIPv6` / `net.isIP` are Node-only, so IP detection is
//     done with regexes here. The IPv6 test is deliberately loose (hex groups and
//     colons) because everything it feeds is fail-closed.
//   - No logger; callers log.
//
// The ranges, blocked hostnames and allowed schemes are duplicated, and
// server/tests/unit/ssrf-parity.test.ts fails if the two lists drift.

/** Private and reserved IPv4 CIDR ranges that should be blocked. */
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

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

function ipToInt(ip: string): number {
  const parts = ip.split('.');
  return (
    ((parseInt(parts[0]) << 24) |
      (parseInt(parts[1]) << 16) |
      (parseInt(parts[2]) << 8) |
      parseInt(parts[3])) >>>
    0
  );
}

export function isIPv4(value: string): boolean {
  if (!IPV4_RE.test(value)) return false;
  return value.split('.').every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255 && String(n) === String(Number(o));
  });
}

export function isIPv6(value: string): boolean {
  return value.includes(':') && IPV6_RE.test(value);
}

export function isIP(value: string): boolean {
  return isIPv4(value) || isIPv6(value);
}

function isPrivateIPv4(ip: string): boolean {
  const ipInt = ipToInt(ip);
  for (const range of PRIVATE_IPV4_RANGES) {
    if ((ipInt & range.mask) === (range.base & range.mask)) return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

  // Link-local (fe80::/10)
  if (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // Unique local (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  return false;
}

/** Is this IP (v4 or v6) in a private/reserved range? Unparseable fails CLOSED. */
export function isPrivateIP(ip: string): boolean {
  const ipv4Mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4Mapped) return isPrivateIPv4(ipv4Mapped[1]);

  if (isIPv4(ip)) return isPrivateIPv4(ip);
  if (isIPv6(ip)) return isPrivateIPv6(ip);

  // Cannot parse it: treat as private.
  return true;
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate a URL for SSRF safety before requesting it. */
export function validateUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { valid: false, reason: `Blocked scheme: ${parsed.protocol} (only http/https allowed)` };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return { valid: false, reason: `Blocked hostname: ${hostname} (cloud metadata endpoint)` };
  }

  if (isIP(hostname) && isPrivateIP(hostname)) {
    return { valid: false, reason: `Blocked private/reserved IP: ${hostname}` };
  }

  // Decimal/octal/hex IP encoding tricks, e.g. 0x7f000001 or 2130706433.
  if (/^(0x[0-9a-f]+|[0-9]+)$/i.test(hostname)) {
    return { valid: false, reason: 'Blocked numeric IP encoding (possible obfuscation)' };
  }

  if (hostname === '169.254.169.254') {
    return { valid: false, reason: 'Blocked cloud metadata IP: 169.254.169.254' };
  }

  return { valid: true };
}

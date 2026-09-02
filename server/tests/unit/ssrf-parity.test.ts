/**
 * The SSRF blocklist exists twice and must stay one list.
 *
 * PA-052 ported server/middleware/ssrf-protection.ts to
 * supabase/functions/_shared/ssrf.ts so the social-media edge function can post
 * to a tenant-supplied webhook URL. A blocklist that drifts is worse than one
 * that was never copied: the Node side keeps passing its own tests while the
 * edge side quietly stops blocking a range.
 *
 * The Deno file cannot be imported from vitest (it uses .ts specifiers and
 * Deno globals), so this compares the two SOURCES textually for the parts that
 * must agree, and separately re-implements nothing - the behavioural assertions
 * run against the Node copy, which the edge copy is asserted to match.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPrivateIP, validateUrl } from '../../middleware/ssrf-protection';

const repo = join(__dirname, '../../..');
const nodeSrc = readFileSync(join(repo, 'server/middleware/ssrf-protection.ts'), 'utf8');
const edgeSrc = readFileSync(join(repo, 'supabase/functions/_shared/ssrf.ts'), 'utf8');

/** Every `ipToInt('x.x.x.x'), mask: 0x...` pair, in order. */
function ranges(src: string): string[] {
  return [...src.matchAll(/base:\s*ipToInt\('([\d.]+)'\),\s*mask:\s*(0x[0-9a-f]+)/g)].map(
    (m) => `${m[1]}/${m[2]}`,
  );
}

function blockedHostnames(src: string): string[] {
  const block = src.match(/BLOCKED_HOSTNAMES = new Set\(\[([\s\S]*?)\]\)/);
  if (!block) return [];
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

function allowedSchemes(src: string): string[] {
  const block = src.match(/ALLOWED_SCHEMES = new Set\(\[([\s\S]*?)\]\)/);
  if (!block) return [];
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('the two SSRF blocklists agree', () => {
  it('blocks the same IPv4 ranges, in the same order', () => {
    const node = ranges(nodeSrc);
    expect(node.length).toBe(13);
    expect(ranges(edgeSrc)).toEqual(node);
  });

  it('blocks the same metadata hostnames', () => {
    expect(blockedHostnames(edgeSrc)).toEqual(blockedHostnames(nodeSrc));
    expect(blockedHostnames(nodeSrc)).toContain('metadata.google.internal');
  });

  it('allows the same schemes', () => {
    expect(allowedSchemes(edgeSrc)).toEqual(allowedSchemes(nodeSrc));
    expect(allowedSchemes(nodeSrc)).toEqual(['http:', 'https:']);
  });

  it('keeps the same IPv6 prefixes', () => {
    for (const prefix of ['fe80:', 'fe8', 'fe9', 'fea', 'feb', 'fc', 'fd']) {
      expect(edgeSrc).toContain(`startsWith('${prefix}')`);
    }
  });

  it('fails closed on an address it cannot parse, on both sides', () => {
    // The Node copy's behaviour; the edge copy carries the same final return.
    expect(isPrivateIP('not-an-ip')).toBe(true);
    expect(edgeSrc).toMatch(/\/\/ Cannot parse it: treat as private\.\s*\n\s*return true;/);
  });
});

describe('the control the port exists for', () => {
  it('blocks the cloud metadata IP and loopback', () => {
    expect(validateUrl('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
    expect(validateUrl('http://127.0.0.1:5432/').valid).toBe(false);
    expect(validateUrl('http://[::1]/').valid).toBe(false);
  });

  it('blocks non-http schemes and numeric encodings', () => {
    expect(validateUrl('file:///etc/passwd').valid).toBe(false);
    expect(validateUrl('http://2130706433/').valid).toBe(false);
    expect(validateUrl('http://0x7f000001/').valid).toBe(false);
  });

  it('allows an ordinary public webhook URL', () => {
    expect(validateUrl('https://hook.us1.make.com/abc123').valid).toBe(true);
  });
});

describe('the edge copy still validates redirect targets', () => {
  const fetchSrc = readFileSync(join(repo, 'supabase/functions/_shared/safe-fetch.ts'), 'utf8');

  it('re-runs URL validation and DNS on every hop', () => {
    // Following a redirect without re-checking is how steps 1 and 2 get bypassed.
    expect(fetchSrc).toContain("redirect: 'manual'");
    expect(fetchSrc).toMatch(/validateUrl\(redirectUrl\)/);
    expect(fetchSrc).toMatch(/validateDnsResolution\(new URL\(redirectUrl\)\.hostname\)/);
  });

  it('treats a DNS permission failure as a refusal, not as no records', () => {
    expect(fetchSrc).toMatch(/PermissionDenied/);
    expect(fetchSrc).toMatch(/refusing the request/);
  });
});

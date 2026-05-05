/**
 * Unit Tests: supabase/functions/_shared/path.ts (EDGE-002m)
 *
 * Verifies normalizePath handles both calling conventions:
 *  - Coolify dispatch (server.ts strips the function name): pathname doesn't
 *    contain the prefix, so the helper is a no-op.
 *  - Supabase native runtime (function name preserved): pathname starts with
 *    /<name>, so the helper strips it.
 *
 * The point: handler code can rely on parts[0] being the resource ID
 * regardless of how the function was invoked.
 */

import { describe, it, expect } from 'vitest';
import { normalizePath } from '../../../supabase/functions/_shared/path';

describe('normalizePath — Supabase native runtime (prefix preserved)', () => {
  it('strips function name from /notifications', () => {
    const { sub, parts } = normalizePath('/notifications', 'notifications');
    expect(sub).toBe('/');
    expect(parts).toEqual([]);
  });

  it('strips function name from /notifications/abc-123', () => {
    const { sub, parts } = normalizePath('/notifications/abc-123', 'notifications');
    expect(sub).toBe('/abc-123');
    expect(parts).toEqual(['abc-123']);
  });

  it('strips function name from /notifications/abc-123/mark-read', () => {
    const { sub, parts } = normalizePath('/notifications/abc-123/mark-read', 'notifications');
    expect(sub).toBe('/abc-123/mark-read');
    expect(parts).toEqual(['abc-123', 'mark-read']);
  });

  it('strips function name from deep nested path', () => {
    const { parts } = normalizePath('/purchase-orders/po-1/line-items/li-2', 'purchase-orders');
    expect(parts).toEqual(['po-1', 'line-items', 'li-2']);
  });
});

describe('normalizePath — Coolify dispatch (server.ts already stripped)', () => {
  it('handles already-stripped /', () => {
    const { sub, parts } = normalizePath('/', 'notifications');
    expect(sub).toBe('/');
    expect(parts).toEqual([]);
  });

  it('handles already-stripped /abc-123', () => {
    const { sub, parts } = normalizePath('/abc-123', 'notifications');
    expect(sub).toBe('/abc-123');
    expect(parts).toEqual(['abc-123']);
  });

  it('handles already-stripped /abc-123/mark-read', () => {
    const { parts } = normalizePath('/abc-123/mark-read', 'notifications');
    expect(parts).toEqual(['abc-123', 'mark-read']);
  });
});

describe('normalizePath — boundary cases (does not match prefix-collisions)', () => {
  it('does NOT strip /notifications-archive/foo when functionName=notifications', () => {
    const { parts } = normalizePath('/notifications-archive/foo', 'notifications');
    // The hyphen prevents the word-boundary match, so the path is left intact.
    expect(parts).toEqual(['notifications-archive', 'foo']);
  });

  it('does NOT strip /notifications2/foo (no separator)', () => {
    const { parts } = normalizePath('/notifications2/foo', 'notifications');
    expect(parts).toEqual(['notifications2', 'foo']);
  });

  it('matches when functionName has hyphens (e.g. company-contacts)', () => {
    const { parts } = normalizePath('/company-contacts/contact-id-1', 'company-contacts');
    expect(parts).toEqual(['contact-id-1']);
  });

  it('handles trailing slash', () => {
    const { sub, parts } = normalizePath('/notifications/', 'notifications');
    expect(sub).toBe('/');
    expect(parts).toEqual([]);
  });

  it('handles double slashes', () => {
    const { parts } = normalizePath('//notifications//abc//mark-read', 'notifications');
    expect(parts).toEqual(['abc', 'mark-read']);
  });

  it('handles empty pathname', () => {
    const { sub, parts } = normalizePath('', 'notifications');
    expect(sub).toBe('/');
    expect(parts).toEqual([]);
  });

  it('omitting functionName treats path as-is', () => {
    const { parts } = normalizePath('/notifications/abc', '');
    expect(parts).toEqual(['notifications', 'abc']);
  });
});

describe('normalizePath — regex special chars in functionName', () => {
  it('escapes dots in functionName', () => {
    // Hypothetical: a function name with a dot. Should match literal dot, not any char.
    const { parts } = normalizePath('/foo.bar/x', 'foo.bar');
    expect(parts).toEqual(['x']);
    // And should NOT match /fooXbar/x (where . would be wildcard if unescaped)
    const { parts: p2 } = normalizePath('/fooXbar/x', 'foo.bar');
    expect(p2).toEqual(['fooXbar', 'x']);
  });
});

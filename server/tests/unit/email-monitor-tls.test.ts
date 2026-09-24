/**
 * Round 251: the IMAP email monitor connected with
 * `tlsOptions: config.tlsOptions || { rejectUnauthorized: false }`, so unless a
 * config said otherwise the mailbox password went to whichever server
 * answered, certificate unchecked. It also loaded imap/mailparser with a
 * top-level await, which tsc's module setting refuses; the load is lazy now.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('server/services/email-monitor-service.ts', 'utf8')
  .replace(/(?<![:/])\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('email monitor', () => {
  it('verifies the IMAP certificate unless a config opts out', () => {
    expect(src).not.toMatch(/rejectUnauthorized:\s*false/);
    expect(src).toMatch(/tlsOptions: this\.config\.tlsOptions \?\? \{\}/);
  });

  it('loads its optional packages lazily, not at module top level', () => {
    const top = src.slice(0, src.indexOf('function loadImap'));
    expect(top).not.toMatch(/await import\(/);
    expect(src).toMatch(/await loadImap\(\)/);
  });
});

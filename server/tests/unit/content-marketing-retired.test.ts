/**
 * The content-marketing router is gone, which makes the blog_posts collision
 * one-sided (AUDIT-037).
 *
 * `blog_posts` is declared twice. shared/drizzle-schema.ts resolves the
 * collision in favour of content-marketing-schema, so that is the shape
 * migration 0000 built and the shape every database has. The other declaration,
 * blog-schema's, is what 37 blog-* edge functions and the platform-admin blog UI
 * read - which is why 97 phantom-column references sit on this one table.
 *
 * PROD-013 framed it as "which system owns the name", a decision between two
 * live systems. It is not one: server/routes-content-marketing.ts was the ONLY
 * consumer of the winning shape, and its twelve endpoints under /api/content had
 * no caller in any of the seven client trees and no edge function behind them.
 * PROD-013 had already deleted the single beacon that used to reach the prefix
 * and called retiring the router routine cleanup.
 *
 * Deleting it does not decide the schema question - that is still the owner's
 * call, and the 97 references stay in the baseline until it is made. It removes
 * the reason the question looked balanced.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the router is gone and unmounted', () => {
  it('deletes the file', () => {
    expect(existsSync(join(repo, 'server/routes-content-marketing.ts'))).toBe(false);
  });

  it('leaves no export and no mount', () => {
    expect(stripComments(read('server/domains/content.ts'))).not.toMatch(/contentMarketingRoutes/);
    expect(stripComments(read('server/routes-registry.ts'))).not.toMatch(/contentMarketingRoutes/);
  });

  it('leaves nothing serving /api/content', () => {
    // No edge function of that name either, so the prefix is honestly absent
    // rather than moved.
    expect(existsSync(join(repo, 'supabase/functions/content'))).toBe(false);
  });
});

describe('the collision it was half of is RESOLVED now', () => {
  // CORRECTED 2026-09-18 (AUDIT-037). This block used to assert the opposite -
  // that blog_posts was still in the phantom baseline and still a declared
  // duplicate - on the reasoning that resolving it was the owner's decision and
  // deleting a dead router was not. The decision turned out to be settled by
  // evidence rather than preference: the US-BLOG table has never physically
  // existed anywhere, so there were no rows on that side to weigh, and the
  // content-marketing side had exactly one consumer. Migration 0082 renames it
  // to content_marketing_posts.
  it('leaves no blog_posts entry in the phantom baseline', () => {
    const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));
    expect(JSON.stringify(baseline.allowed)).not.toMatch(/blog_posts\./);
  });

  it('keeps both declarations, each owning its own table name', () => {
    expect(existsSync(join(repo, 'shared/content-marketing-schema.ts'))).toBe(true);
    expect(existsSync(join(repo, 'shared/blog-schema.ts'))).toBe(true);
    const dups = JSON.parse(read('docs/duplicate-tables-baseline.json'));
    expect(dups.allowed).not.toContain('blog_posts :: blog-schema.ts|content-marketing-schema.ts');
  });
});

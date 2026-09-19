/**
 * One table name, two declarations, and only one of them ever had a table
 * (AUDIT-037).
 *
 * shared/schema.ts re-exported content-marketing-schema's `blogPosts` BY NAME
 * and then did `export * from './blog-schema'`. A named re-export beats a later
 * `export *`, so drizzle-kit only ever saw the content-marketing shape and
 * migration 0000 built it. The US-BLOG subsystem - 22 edge functions - is
 * written against the OTHER declaration: body_markdown, body_html, deleted_at,
 * canonical_url, brief_id, cluster_id, brand_voice_id, cms_post_url. Every read
 * returned nothing and no insert could work at all, because the physical table
 * has `content` NOT NULL and `category` NOT NULL and the blog code sets neither.
 * That one table was 103 of the 195 entries in the phantom-column baseline.
 *
 * WHY THE CONTENT-MARKETING SIDE MOVED. It is the side with one consumer: a
 * single image-sitemap query in server/routes-seo.ts. And it is not a data
 * migration, which is what made this tractable at all - the US-BLOG table has
 * never physically existed anywhere. _backfill_blog_tables.sql creates it with
 * CREATE TABLE IF NOT EXISTS, a silent no-op on any database that ran 0000, and
 * 0008 only ever added foreign keys TO it. So there are no rows on that side to
 * lose, and the rows on the other side follow an ALTER TABLE ... RENAME TO.
 *
 * Migration 0082 was applied to a real Postgres 16 twice, with a content-marketing
 * row inserted first: the row followed the rename, the new blog_posts came up
 * empty in the US-BLOG shape, and a US-BLOG insert - impossible before - succeeded.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { blogPosts, contentMarketingPosts } from '../../../shared/drizzle-schema';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const migration = read('drizzle/migrations/0082_audit037_blog_posts_table_split.sql');

describe('the name resolves to the US-BLOG declaration', () => {
  it('blogPosts is the blog-schema table', () => {
    const config = getTableConfig(blogPosts);
    expect(config.name).toBe('blog_posts');
    const columns = config.columns.map((c) => c.name);
    for (const column of [
      'body_markdown',
      'body_html',
      'deleted_at',
      'canonical_url',
      'brief_id',
    ]) {
      expect(columns, column).toContain(column);
    }
    // The content-marketing columns that made every blog insert impossible.
    for (const column of ['content', 'category', 'featured_image']) {
      expect(columns, column).not.toContain(column);
    }
  });

  it('the content-marketing table has its own name now', () => {
    const config = getTableConfig(contentMarketingPosts);
    expect(config.name).toBe('content_marketing_posts');
    expect(config.columns.map((c) => c.name)).toContain('content');
  });

  it('schema.ts re-exports the renamed one, not a second blogPosts', () => {
    // The named re-export IS the defect: it shadowed `export * from
    // './blog-schema'` and that is why drizzle-kit never saw the blog shape.
    const schema = read('shared/schema.ts');
    expect(schema).toContain('contentMarketingPosts,');
    expect(schema).not.toMatch(/^\s*blogPosts,$/m);
    expect(schema).toContain("export * from './blog-schema'");
  });
});

describe('the migration renames rather than rewrites', () => {
  it('renames the table instead of dropping its columns', () => {
    expect(migration).toContain('ALTER TABLE "blog_posts" RENAME TO "content_marketing_posts"');
    // drizzle-kit's own generated version dropped 23 columns in place, which
    // would have destroyed every content-marketing row.
    expect(migration).not.toMatch(/ALTER TABLE "blog_posts" DROP COLUMN "content"/);
  });

  it('detaches the children BEFORE the rename, or they follow it', () => {
    const rename = migration.indexOf('RENAME TO "content_marketing_posts"');
    const detach = migration.indexOf('DROP CONSTRAINT IF EXISTS');
    expect(detach).toBeGreaterThan(-1);
    expect(detach).toBeLessThan(rename);
  });

  it('re-points all five blog_* foreign keys at the new table', () => {
    for (const child of [
      'blog_citations',
      'blog_distributions',
      'blog_performance_metrics',
      'blog_post_revisions',
      'blog_refresh_queue',
    ]) {
      expect(migration, child).toContain(`${child}_post_id_blog_posts_id_fk`);
    }
  });

  it('is guarded on a condition that is false once it has run', () => {
    expect(migration).toContain("column_name = 'content'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "blog_posts"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "content_marketing_posts"');
  });

  it('does not assume the blog_* children exist', () => {
    // A database that never ran the unjournaled backfill has none of them, and
    // DROP CONSTRAINT IF EXISTS still raises undefined_table when the TABLE is
    // what is missing.
    expect(migration).toContain("to_regclass('public.' || quote_ident(child))");
  });
});

describe('the one content-marketing consumer follows the rename', () => {
  it('the image sitemap reads content_marketing_posts', () => {
    const seo = read('server/routes-seo.ts');
    expect(seo).toContain('contentMarketingPosts.featuredImage');
    expect(seo).toContain('.from(contentMarketingPosts)');
  });
});

describe('the journal replay can follow a rename', () => {
  it('check:declared-cols handles RENAME TO and applies statements in order', () => {
    // Without either half it reported 23 columns "the database has and the
    // schema does not" for a table that no longer holds any of them - the guard
    // accusing correct code, which this story has now done four times.
    const guard = read('scripts/check-declared-columns.mts');
    expect(guard).toContain('RENAME TO');
    expect(guard).toContain('RENAME COLUMN');
    expect(guard).toContain('steps.sort((a, b) => a.at - b.at)');
  });
});

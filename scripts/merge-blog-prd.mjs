#!/usr/bin/env node
// merge-blog-prd.mjs
//
// Reads blog-system-prd.json (canonical source for the Universal Blog System
// PRD, 85 stories) and merges it into Printyx's prd.json under category "blog"
// with Printyx-specific adaptations.
//
// Re-runnable: preserves `passes: true` on any BLOG-* story already in prd.json
// so you can re-run after upstream PRD edits without losing Ralph progress.
//
// Adaptations applied:
//   - Drop the standalone monorepo scaffold (US-BLOG-001) — Printyx already exists
//   - Replace it with US-BLOG-001 = "Blog module foundation in Printyx"
//   - Rewrite US-BLOG-002 (schema), US-BLOG-003 (auth), US-BLOG-006 (CMS adapters
//     limited to WP+Ghost in v1), US-BLOG-007 (admin UI shell integrated into
//     Platform Admin), US-BLOG-066 (auto-refresh agent — autonomous mode), and
//     append a new US-BLOG-086 "Agent kill switch + global pause/rollback"
//   - Add `category: "blog"` to every entry
//   - Renumber priorities to slot after the ABK stories (start at 35)
//
// Usage: node scripts/merge-blog-prd.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const blogPath = resolve(repoRoot, 'blog-system-prd.json');
const printyxPath = resolve(repoRoot, 'prd.json');

const blog = JSON.parse(readFileSync(blogPath, 'utf8'));
const printyx = JSON.parse(readFileSync(printyxPath, 'utf8'));

const PRIORITY_BASE = 35; // ABK ended at 34

const overrides = {
  'US-BLOG-001': {
    title: 'Blog module foundation in Printyx (directory structure + sidebar entry)',
    description:
      "As a developer, I need the blog module's file/folder layout established within the existing Printyx repo so subsequent BLOG-### stories have a consistent home and the Platform Admin sidebar entry exists.",
    acceptanceCriteria: [
      'Create directories: shared/blog/ (drizzle schemas), supabase/functions/_shared/blog/ (parser/generator helpers + adapter interfaces), supabase/functions/blog/ (edge function entrypoints), client/src/pages/platform-admin/blog/ (admin UI pages), client/src/lib/blog/ (frontend helpers)',
      'New shared/blog-schema.ts as a barrel for blog-related drizzle schemas; re-exported from shared/schema.ts',
      'New sidebar entry "Blog" under Platform Admin in client/src/components/RoleAwareCollapsibleSidebar.tsx, gated to platform admin role only — placeholder route /platform-admin/blog renders an empty page in this story',
      'New section in CLAUDE.md describing blog module layout, RBAC scope, and that BLOG-### stories build on this foundation',
      'Typecheck passes: npm run check',
    ],
    notes:
      'Foundation story for the blog module — replaces the original PRD\'s standalone monorepo scaffold (US-BLOG-001 in blog-system-prd.json) since we are integrating into the existing Printyx repo. Source PRD: blog-system-prd.json US-BLOG-001 (adapted).',
  },

  'US-BLOG-002': {
    description:
      'As a platform operator, I need a clean Drizzle schema for the blog module that integrates with the existing Printyx tenant model so the blog system inherits Printyx\'s multi-tenant isolation guarantees.',
    acceptanceCriteria: [
      'New file shared/blog-schema.ts (or split across shared/blog/*.ts files) defines Drizzle tables: blog_brand_voices, blog_style_guides, blog_keyword_clusters, blog_keywords, blog_briefs, blog_posts, blog_post_revisions, blog_assets, blog_citations, blog_distributions, blog_distribution_targets, blog_performance_metrics, blog_refresh_queue, blog_audit_log',
      'Every blog_* table has tenant_id NOT NULL with FK to tenants and an index on (tenant_id) — single Printyx blog workspace per tenant in v1, but the column is enforced for future multi-tenant work',
      'Each table also has created_at, updated_at (timestamptz), created_by_user_id (FK users)',
      'Indices on hot paths: blog_posts(tenant_id, status, published_at), blog_keywords(tenant_id, cluster_id), blog_distributions(post_id, platform), blog_refresh_queue(tenant_id, scheduled_at)',
      'RLS policies on every blog_* table enforce tenant_id matches the JWT app_metadata.tenantId claim — matches existing Printyx RLS pattern',
      'Schema re-exported from shared/schema.ts so drizzle-kit picks it up',
      'npm run db:generate produces a clean migration in drizzle/migrations/',
      'Migration applies cleanly with npm run db:migrate against a clean dev DB',
      'Typecheck passes: npm run check',
    ],
    notes:
      'Source PRD: blog-system-prd.json US-BLOG-002 (adapted to Printyx tenant model). The original PRD\'s "workspaces" table is replaced by Printyx\'s existing tenants table — there is no separate workspace concept in Printyx blog v1.',
  },

  'US-BLOG-003': {
    title: 'Auth + RBAC: gate blog access via Printyx Supabase auth and platform roles',
    description:
      "As a platform admin, I need every blog endpoint and UI route gated to the right Printyx role so editorial workflow respects existing permissions without inventing a parallel auth system.",
    acceptanceCriteria: [
      'New blog permissions added to RBAC seed: blog.post.view, blog.post.edit, blog.post.publish, blog.post.delete, blog.brand_voice.edit, blog.style_guide.edit, blog.distribution.publish, blog.analytics.view, blog.refresh.manage, blog.agent.toggle',
      'Default grants — Platform Admin: all blog.* permissions; Company Admin: view + edit + publish + analytics within their tenant; all other roles: none in v1',
      'Every blog edge function authenticates via supabase.auth.getUser(jwt), pulls tenantId from app_metadata, and checks the relevant blog.* permission before performing any work',
      'Permission checks are server-side; UI gating in client/src/pages/platform-admin/blog/* is convenience only',
      'Every mutating action writes a row to blog_audit_log (action, actor_user_id, target_type, target_id, before_jsonb, after_jsonb, tenant_id, created_at)',
      'No invite flow is needed in v1 — workspace membership maps 1:1 to existing Printyx role assignment',
      'Integration test: a non-platform-admin user calling a blog endpoint receives 403',
      'Typecheck passes: npm run check',
    ],
    notes:
      'Source PRD: blog-system-prd.json US-BLOG-003 (adapted to Printyx auth). The original PRD\'s pluggable auth + invite flow is replaced by Printyx\'s existing Supabase Auth + tenant role assignment.',
  },

  'US-BLOG-006': {
    title: 'CMS adapter interface + WordPress and Ghost adapters (v1 set)',
    description:
      "As a developer publishing blog posts to Printyx's marketing site (and later to other CMS targets), I want a stable adapter interface so v1 can ship WordPress + Ghost and phase 2 can add Webflow + custom-REST + native-render without changing call sites.",
    acceptanceCriteria: [
      'New file supabase/functions/_shared/blog/cms-adapter.ts defines the adapter contract: createPost, updatePost, deletePost, getPost, listPosts, uploadAsset, healthCheck',
      'v1 adapters implemented: wordpress (REST API + JWT/application-password auth), ghost (Admin API + JWT)',
      'Adapter selection per tenant via cms_adapter (enum: wordpress|ghost) and cms_config (jsonb, encrypted at column level via Printyx credential vault) on a new blog_cms_targets table',
      'Markdown-to-CMS transform layer normalizes output for each CMS\'s quirks (Gutenberg blocks for WP, mobiledoc/Lexical for Ghost)',
      'Shared contract test suite asserts every adapter satisfies the same behavioral spec',
      'Phase 2 adapters (Webflow, custom-REST, native-render) are explicitly out of scope for this story — capture in notes as follow-up',
      'Never log decrypted CMS credentials',
      'Typecheck passes: npm run check',
    ],
    notes:
      'Source PRD: blog-system-prd.json US-BLOG-006 (narrowed to WP+Ghost for v1 per scope decision 4B). Phase 2 extensions: webflow, custom-rest, and native-render-into-printyx.net are tracked as follow-ups under category blog-phase-2.',
  },

  'US-BLOG-007': {
    title: 'Platform Admin → Blog admin shell integrated into existing Printyx UI',
    description:
      'As a platform admin, I want the blog admin UI to feel like part of Printyx (same header, sidebar, theming) so I never context-switch out of the product to manage content.',
    acceptanceCriteria: [
      'New route prefix /platform-admin/blog/* registered in client/src/App.tsx with lazy imports',
      'Reuses existing Printyx layout (header, RoleAwareCollapsibleSidebar, theming) — no separate shell',
      'Sub-navigation inside the blog module rendered as a secondary nav: Ideas, Briefs, Posts, Distribution, Analytics, Refresh, Settings',
      'Tailwind + shadcn/ui (already in Printyx) — no new dependencies',
      'No workspace switcher needed in v1 (single workspace per tenant)',
      'Each section has an empty state with helpful CTA',
      'Keyboard shortcuts within the blog module: g+i (Ideas), g+b (Briefs), g+p (Posts), / (search) — registered only when the user is on a /platform-admin/blog/* route',
      'Typecheck passes: npm run check',
      'Verify in browser using dev-browser skill',
    ],
    notes:
      'Source PRD: blog-system-prd.json US-BLOG-007 (integrated into Printyx admin shell instead of a standalone admin app).',
  },

  'US-BLOG-066': {
    title: 'Auto-refresh agent — fully autonomous SERP-decay-triggered re-editing',
    description:
      'As a platform admin, I want the auto-refresh agent to detect SERP decay and re-edit posts WITHOUT human review (per scope decision 5D), with every change captured in the audit log and revertable, so content stays competitive without operator overhead.',
    acceptanceCriteria: [
      'Auto-refresh agent runs on a schedule (cron via Supabase scheduled functions) and via blog_refresh_queue triggers',
      'For each candidate post, the agent: (1) re-runs SERP analysis, (2) diffs against the prior SERP snapshot, (3) generates revised sections, (4) commits a new revision to blog_post_revisions with revision_source="auto_refresh_agent", (5) re-publishes via the configured CMS adapter, (6) writes a blog_audit_log entry summarizing what changed and why',
      'No human-approval step in the default path; admin can opt back into manual review per-tenant via a flag on a new blog_agent_settings row (auto_refresh_requires_review boolean, default false)',
      'Hard guardrails: agent will NOT auto-publish if (a) the predicted change exceeds N% of the post body (configurable, default 40%), (b) the SEO score would drop, or (c) brand-voice or style-guide violations are introduced — these cases land in a review queue surfaced on the Refresh page',
      'Every auto-refresh run respects the global agent kill switch (US-BLOG-086) — if paused, run is skipped and a blog_audit_log entry records the skip',
      'Cost-per-run captured in the AI cost dashboard (US-BLOG-079)',
      'Integration test: simulate SERP decay → assert revision created → assert CMS adapter called → assert audit log entry exists',
      'Typecheck passes: npm run check',
    ],
    notes:
      'Source PRD: blog-system-prd.json US-BLOG-066 (elevated from "proposed edits" to "autonomous re-editing" per scope decision 5D). Full autonomy in production requires the kill switch in US-BLOG-086 to land first.',
  },
};

// New story to append (was not in the original PRD)
const additionalStories = [
  {
    id: 'US-BLOG-086',
    title: 'Global agent kill switch + per-action rollback',
    description:
      'As a platform admin running the blog system in fully autonomous mode (per scope decision 5D), I need a single "pause all agents" toggle and per-action rollback so any AI-driven publish or re-edit can be halted or reverted in seconds when something goes wrong.',
    acceptanceCriteria: [
      'New blog_agent_settings table per tenant: agents_paused (boolean, default false), paused_at, paused_by_user_id, paused_reason',
      'New endpoint POST /blog/agents/pause and POST /blog/agents/resume (platform admin only) — flips agents_paused atomically',
      'Every agent entry point (auto-refresh, draft pipeline, distribution scheduler, outreach agent, etc.) checks agents_paused at the start of each run; paused state short-circuits with a blog_audit_log entry',
      'Settings page in /platform-admin/blog/settings shows the kill switch as a prominent toggle with last-paused-at + reason',
      'Per-action rollback: every blog_post_revisions row created by an agent is reversible via a "Revert to previous revision" button on the post detail page; revert re-publishes via CMS adapter and writes an audit log entry',
      'Bulk rollback: from the Audit Log page, an admin can select a time range and an agent type and revert every change in that window in one click; confirmation dialog requires typing the tenant name',
      'Typecheck passes: npm run check',
      'Verify in browser using dev-browser skill',
    ],
    priority: 0, // assigned below
    passes: false,
    notes:
      'Added beyond the original 85-story PRD because scope decision 5D enables fully autonomous re-editing — production-safe autonomy requires a panic button. Treat as a hard gate before US-BLOG-066 ships.',
    category: 'blog',
  },
];

// Build the new BLOG entries
const existingPasses = new Map(
  printyx.userStories
    .filter((s) => typeof s.id === 'string' && s.id.startsWith('US-BLOG-'))
    .map((s) => [s.id, s.passes]),
);

const transformed = blog.userStories.map((story, idx) => {
  const override = overrides[story.id] ?? {};
  const merged = {
    ...story,
    ...override,
    priority: PRIORITY_BASE + idx,
    passes: existingPasses.get(story.id) ?? false,
    category: 'blog',
  };
  // Override may not include all fields — preserve title/description/AC from original where not overridden
  if (override.title) merged.title = override.title;
  if (override.description) merged.description = override.description;
  if (override.acceptanceCriteria) merged.acceptanceCriteria = override.acceptanceCriteria;
  if (override.notes) merged.notes = override.notes;
  return merged;
});

// Append the additional stories with priorities continuing from there
additionalStories.forEach((extra, i) => {
  extra.priority = PRIORITY_BASE + transformed.length + i;
  extra.passes = existingPasses.get(extra.id) ?? false;
});

const newBlogStories = [...transformed, ...additionalStories];

// Remove any prior BLOG entries from prd.json and append fresh ones
const filteredExisting = printyx.userStories.filter(
  (s) => !(typeof s.id === 'string' && s.id.startsWith('US-BLOG-')),
);

printyx.userStories = [...filteredExisting, ...newBlogStories];

writeFileSync(printyxPath, JSON.stringify(printyx, null, 2) + '\n', 'utf8');

console.log(
  `Merged ${newBlogStories.length} blog stories into prd.json (${transformed.length} from blog-system-prd.json + ${additionalStories.length} additions). Preserved passes:true for ${[...existingPasses.values()].filter(Boolean).length} prior entries.`,
);
console.log(`Total userStories now: ${printyx.userStories.length}`);
console.log(
  `Categories: ${[...new Set(printyx.userStories.map((s) => s.category).filter(Boolean))].join(', ')}`,
);

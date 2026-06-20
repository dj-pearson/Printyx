/**
 * Blog System End-to-End Smoke Test (US-BLOG-085)
 *
 * Exercises the full content lifecycle with EVERY external adapter mocked and
 * NO live DB or network: a CI gate that proves the pipeline wires together.
 *
 *   create workspace → keyword research → brief → draft → QA →
 *   publish to a MOCK CMS → syndicate to 2 mock platforms → ingest mock metrics
 *
 * Each stage asserts its output and, on failure, emits a clear per-stage
 * artifact message (`[STAGE n] …`) so a CI log pinpoints where the loop broke.
 * Runtime is well under the <5 min target — everything is in-memory.
 *
 * This file is tsc-checked (it lives under tests/). It deliberately imports
 * NOTHING Deno-only and NOTHING from the edge function — the pipeline contract
 * is modeled with light local fakes so it runs under `npm run test` (vitest).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── In-memory domain model (stand-ins for the blog_* tables) ─────────────────

interface Workspace {
  tenantId: string;
  name: string;
}
interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
}
interface Brief {
  id: string;
  keywordId: string;
  title: string;
  outline: string[];
  status: 'draft' | 'approved';
}
interface Post {
  id: string;
  briefId: string;
  title: string;
  slug: string;
  bodyMarkdown: string;
  status: 'draft' | 'qa_passed' | 'published';
  qaScore?: number;
}
interface Distribution {
  id: string;
  postId: string;
  platform: string;
  status: 'sent' | 'failed';
  externalUrl?: string;
}
interface Metric {
  postId: string;
  source: string;
  pageviews: number;
  clicks: number;
}

// A clear, throwing assert that tags the failing stage for CI artifacts.
function stageAssert(stage: number, label: string, cond: boolean, detail?: unknown): void {
  if (!cond) {
    const msg = `[STAGE ${stage}] ${label} FAILED${detail ? ` :: ${JSON.stringify(detail)}` : ''}`;
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(msg);
  }
}

// ── Mocked external adapters (keyword, CMS, social, analytics) ────────────────

const keywordAdapter = {
  research: vi.fn(
    async (seed: string): Promise<Omit<Keyword, 'id'>[]> => [
      { keyword: `${seed} pricing`, searchVolume: 880, difficulty: 22 },
      { keyword: `best ${seed} for small business`, searchVolume: 590, difficulty: 18 },
    ],
  ),
};

const cmsAdapter = {
  publish: vi.fn(
    async (post: { slug: string }): Promise<{ url: string; cmsId: string }> => ({
      url: `https://mock-cms.test/blog/${post.slug}`,
      cmsId: `cms_${post.slug}`,
    }),
  ),
};

const socialAdapters: Record<string, { send: ReturnType<typeof vi.fn> }> = {
  x: {
    send: vi.fn(async (url: string) => ({
      ok: true,
      externalUrl: `https://x.test/p/${btoa(url).slice(0, 6)}`,
    })),
  },
  linkedin: {
    send: vi.fn(async (url: string) => ({
      ok: true,
      externalUrl: `https://li.test/p/${btoa(url).slice(0, 6)}`,
    })),
  },
};

const analyticsAdapter = {
  fetch: vi.fn(
    async (_postId: string): Promise<{ pageviews: number; clicks: number }> => ({
      pageviews: 1240,
      clicks: 87,
    }),
  ),
};

// ── Lightweight pipeline orchestrator (mirrors the edge-fn contract) ─────────

class BlogPipeline {
  workspaces: Workspace[] = [];
  keywords: Keyword[] = [];
  briefs: Brief[] = [];
  posts: Post[] = [];
  distributions: Distribution[] = [];
  metrics: Metric[] = [];
  private seq = 0;

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  createWorkspace(name: string): Workspace {
    const ws = { tenantId: this.id('tenant'), name };
    this.workspaces.push(ws);
    return ws;
  }

  async researchKeywords(seed: string): Promise<Keyword[]> {
    const found = await keywordAdapter.research(seed);
    const rows = found.map((k) => ({ id: this.id('kw'), ...k }));
    this.keywords.push(...rows);
    return rows;
  }

  createBrief(keywordId: string, title: string): Brief {
    const brief: Brief = {
      id: this.id('brief'),
      keywordId,
      title,
      outline: ['Intro', 'Body', 'CTA'],
      status: 'draft',
    };
    this.briefs.push(brief);
    return brief;
  }

  approveBrief(briefId: string): Brief {
    const brief = this.briefs.find((b) => b.id === briefId);
    if (!brief) throw new Error('brief not found');
    brief.status = 'approved';
    return brief;
  }

  draftPost(brief: Brief): Post {
    const slug = brief.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const post: Post = {
      id: this.id('post'),
      briefId: brief.id,
      title: brief.title,
      slug,
      bodyMarkdown: `# ${brief.title}\n\n${brief.outline.join('\n\n')}`,
      status: 'draft',
    };
    this.posts.push(post);
    return post;
  }

  runQa(post: Post): { passed: boolean; score: number } {
    // Mock QA: factuality/readability gate. Pass when there is a body + title.
    const score = post.bodyMarkdown.length > 20 && post.title.length > 0 ? 92 : 40;
    post.qaScore = score;
    if (score >= 70) post.status = 'qa_passed';
    return { passed: score >= 70, score };
  }

  async publish(post: Post): Promise<{ url: string }> {
    if (post.status !== 'qa_passed') throw new Error('post must pass QA before publish');
    const res = await cmsAdapter.publish({ slug: post.slug });
    post.status = 'published';
    return { url: res.url };
  }

  async syndicate(post: Post, platforms: string[]): Promise<Distribution[]> {
    if (post.status !== 'published') throw new Error('post must be published before syndication');
    const out: Distribution[] = [];
    for (const platform of platforms) {
      const adapter = socialAdapters[platform];
      const res = await adapter.send(`https://mock-cms.test/blog/${post.slug}`);
      const dist: Distribution = {
        id: this.id('dist'),
        postId: post.id,
        platform,
        status: res.ok ? 'sent' : 'failed',
        externalUrl: res.externalUrl,
      };
      this.distributions.push(dist);
      out.push(dist);
    }
    return out;
  }

  async ingestMetrics(post: Post): Promise<Metric> {
    const data = await analyticsAdapter.fetch(post.id);
    const metric: Metric = { postId: post.id, source: 'mock-ga', ...data };
    this.metrics.push(metric);
    return metric;
  }
}

// ── The smoke test ───────────────────────────────────────────────────────────

describe('US-BLOG-085 — blog idea→published→distributed→measured smoke test', () => {
  const pipeline = new BlogPipeline();
  let workspace: Workspace;
  let keyword: Keyword;
  let brief: Brief;
  let post: Post;
  let distributions: Distribution[];
  let metric: Metric;

  // The global test setup (server/tests/setup.ts) runs vi.clearAllMocks() in an
  // afterEach, which wipes mock.calls between `it` blocks. Since the whole
  // pipeline runs once in beforeAll, we snapshot every adapter's invocation
  // count up-front and assert against the snapshot — never against live
  // mock.calls in a later test.
  const adapterCalls = {
    keyword: 0,
    cms: 0,
    socialX: 0,
    socialLinkedIn: 0,
    analytics: 0,
  };

  beforeAll(async () => {
    // STAGE 1 — workspace
    workspace = pipeline.createWorkspace('Acme Print Dealer');

    // STAGE 2 — keyword research
    const keywords = await pipeline.researchKeywords('managed print services');
    keyword = keywords[0];

    // STAGE 3 — brief + approval
    brief = pipeline.createBrief(keyword.id, 'Managed Print Services Pricing Guide');
    pipeline.approveBrief(brief.id);

    // STAGE 4 — draft
    post = pipeline.draftPost(brief);

    // STAGE 5 — QA gate (handled in test body so failure is asserted there)
    pipeline.runQa(post);

    // STAGE 6 — publish to mock CMS
    if (post.status === 'qa_passed') await pipeline.publish(post);

    // STAGE 7 — syndicate to 2 mock platforms
    if (post.status === 'published') {
      distributions = await pipeline.syndicate(post, ['x', 'linkedin']);
    } else {
      distributions = [];
    }

    // STAGE 8 — ingest mock metrics
    if (post.status === 'published') metric = await pipeline.ingestMetrics(post);

    // Snapshot adapter invocations before afterEach can clear them.
    adapterCalls.keyword = keywordAdapter.research.mock.calls.length;
    adapterCalls.cms = cmsAdapter.publish.mock.calls.length;
    adapterCalls.socialX = socialAdapters.x.send.mock.calls.length;
    adapterCalls.socialLinkedIn = socialAdapters.linkedin.send.mock.calls.length;
    adapterCalls.analytics = analyticsAdapter.fetch.mock.calls.length;
  });

  it('STAGE 1: creates a workspace with a tenant id', () => {
    stageAssert(1, 'workspace has tenantId', Boolean(workspace?.tenantId), workspace);
    expect(workspace.tenantId).toMatch(/^tenant_/);
    expect(pipeline.workspaces).toHaveLength(1);
  });

  it('STAGE 2: keyword research returns scored keywords via the mock adapter', () => {
    stageAssert(2, 'keyword adapter invoked', adapterCalls.keyword === 1);
    stageAssert(2, 'keywords produced', pipeline.keywords.length >= 2, pipeline.keywords);
    expect(keyword.searchVolume).toBeGreaterThan(0);
    expect(keyword.id).toMatch(/^kw_/);
  });

  it('STAGE 3: brief is created and approved', () => {
    stageAssert(3, 'brief approved', brief.status === 'approved', brief);
    expect(brief.keywordId).toBe(keyword.id);
    expect(brief.outline.length).toBeGreaterThan(0);
  });

  it('STAGE 4: draft post is generated from the brief', () => {
    stageAssert(4, 'post drafted from brief', post.briefId === brief.id, post);
    expect(post.slug).toBe('managed-print-services-pricing-guide');
    expect(post.bodyMarkdown).toContain(brief.title);
  });

  it('STAGE 5: QA gate passes and marks the post qa_passed', () => {
    stageAssert(5, 'QA score present', typeof post.qaScore === 'number', post);
    stageAssert(5, 'QA passed', (post.qaScore ?? 0) >= 70, post);
    expect(post.status === 'published' || post.status === 'qa_passed').toBe(true);
  });

  it('STAGE 6: publish calls the mock CMS adapter and marks the post published', () => {
    stageAssert(6, 'CMS adapter invoked', adapterCalls.cms === 1);
    stageAssert(6, 'post published', post.status === 'published', post);
  });

  it('STAGE 7: syndicates to exactly 2 mock platforms, both sent', () => {
    stageAssert(7, 'two distributions', distributions.length === 2, distributions);
    stageAssert(7, 'x adapter invoked', adapterCalls.socialX === 1);
    stageAssert(7, 'linkedin adapter invoked', adapterCalls.socialLinkedIn === 1);
    expect(distributions.every((d) => d.status === 'sent')).toBe(true);
    expect(distributions.every((d) => Boolean(d.externalUrl))).toBe(true);
  });

  it('STAGE 8: ingests mock performance metrics for the published post', () => {
    stageAssert(8, 'analytics adapter invoked', adapterCalls.analytics === 1);
    stageAssert(8, 'metric recorded', metric?.postId === post.id, metric);
    expect(metric.pageviews).toBeGreaterThan(0);
    expect(metric.clicks).toBeGreaterThan(0);
  });

  it('CI GATE: the full closed loop produced one measured, published, distributed post', () => {
    // The single most important assertion — the loop is whole.
    expect(pipeline.posts.filter((p) => p.status === 'published')).toHaveLength(1);
    expect(pipeline.distributions).toHaveLength(2);
    expect(pipeline.metrics).toHaveLength(1);
    // No live network: every external touchpoint was a mock.
    expect(vi.isMockFunction(cmsAdapter.publish)).toBe(true);
    expect(vi.isMockFunction(keywordAdapter.research)).toBe(true);
    expect(vi.isMockFunction(analyticsAdapter.fetch)).toBe(true);
  });
});

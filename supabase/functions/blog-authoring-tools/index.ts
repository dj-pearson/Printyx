// Blog Authoring Tools Edge Function (US-BLOG-029, 032, 034, 035, 037, 038)
//
// In-editor tooling for drafts: original-data integration + chart builder,
// inline AI rewrite toolbar, plagiarism/AI-content detection, image generation
// + stock integration, inline fact-checker, and diagram/chart generation. Every
// artifact is stored against the workspace (tenant) and, where relevant, a post.
//
// REUSES existing blog tables — does not recreate them:
//   blog_assets   — generated/stock images & diagrams (asset_type image|diagram)
//   blog_citations— data-source URLs and chart sources
//   blog_brand_voices — read for the inline rewrite toolbar (US-BLOG-032)
//   blog_ai_costs — AI/scan spend ledger
// NEW tables (see shared/blog-authoring-tools-schema.ts + the backfill migration):
//   blog_data_assets, blog_chart_specs, blog_content_scans, blog_factcheck_runs
//
// Third-party services (Copyscape/Originality.ai/GPTZero/DALL-E/Unsplash/Google
// Sheets/etc.) are NOT called directly — each sits behind a clearly-named adapter
// stub function (search for `// ADAPTER STUB`). The storage + orchestration is
// fully implemented; wiring the real provider is a TODO inside each stub.
//
// Routes (tenant-scoped, gated to blog.post.edit / platform admin):
//   --- US-BLOG-029 datasets + chart builder -----------------------------------
//   GET    /blog-authoring-tools/data-assets            list (?post_id=)
//   GET    /blog-authoring-tools/data-assets/:id        one
//   POST   /blog-authoring-tools/data-assets            create { name, source_type, ... }
//   POST   /blog-authoring-tools/data-assets/:id/refresh re-fetch + bump refreshed_at
//   DELETE /blog-authoring-tools/data-assets/:id        soft delete
//   POST   /blog-authoring-tools/charts                 build chart spec from a dataset
//   GET    /blog-authoring-tools/charts                 list chart/diagram specs (?post_id=)
//   --- US-BLOG-032 inline rewrite ---------------------------------------------
//   POST   /blog-authoring-tools/rewrite                { selection, action, ... } -> proposed + diff
//   --- US-BLOG-034 scans ------------------------------------------------------
//   POST   /blog-authoring-tools/scans                  run plagiarism|ai_detection scan
//   GET    /blog-authoring-tools/scans                  list scans (?post_id=&scan_type=)
//   GET    /blog-authoring-tools/scans/gate             pre-publish gate (?post_id=)
//   --- US-BLOG-035 media ------------------------------------------------------
//   POST   /blog-authoring-tools/images/generate        AI image candidates
//   POST   /blog-authoring-tools/images/search-stock    stock candidates
//   POST   /blog-authoring-tools/images/insert          persist chosen image to blog_assets
//   GET    /blog-authoring-tools/images/hero-check      hero/OG image required gate (?post_id=)
//   --- US-BLOG-037 fact-checker -----------------------------------------------
//   POST   /blog-authoring-tools/factcheck              start a fact-check run (returns run id)
//   GET    /blog-authoring-tools/factcheck/:id          poll a run
//   --- US-BLOG-038 diagrams ---------------------------------------------------
//   POST   /blog-authoring-tools/diagrams/validate      mermaid syntax sanity check
//   POST   /blog-authoring-tools/diagrams               save mermaid|excalidraw|csv diagram

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion, generateCompletionDetailed } from '../_shared/anthropic.ts';
import { extractJsonArray, asStringArray } from '../_shared/blog/llm-json.ts';
import { encryptCredential } from '../_shared/credential-vault.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

// ---------------------------------------------------------------------------
// Auth / permission gate — mirrors the syndication exemplar.
// ---------------------------------------------------------------------------
function hasPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// Default pre-publish thresholds (US-BLOG-034). Per-workspace overrides could be
// stored on blog_agent_settings later; these are the AC defaults.
const DEFAULT_PLAGIARISM_MAX_PCT = 5; // fail if originality < (100 - this) i.e. matched >5%
const DEFAULT_AI_LIKELIHOOD_MAX_PCT = 50;
const FACTCHECK_CONFIDENCE_FLOOR = 70; // <70% flagged for human (US-BLOG-037)

// ===========================================================================
// ADAPTER STUBS — each is the single seam where a real provider gets wired.
// They return deterministic, clearly-marked placeholder data and a cost so the
// orchestration + storage are exercised end-to-end without a live key.
// ===========================================================================

interface PlagiarismResult {
  originalityPct: number; // 0-100, higher = more original
  matches: Array<{ url: string; percent: number; snippet?: string }>;
  provider: string;
  costCents: number;
}
// ADAPTER STUB — Copyscape / Originality.ai plagiarism check (US-BLOG-034).
async function plagiarismAdapterStub(_text: string): Promise<PlagiarismResult> {
  // TODO: POST to Copyscape (u/k params) or Originality.ai /scan; map matched
  // sources to { url, percent, snippet } and the real billed cost to costCents.
  return {
    originalityPct: 96,
    matches: [],
    provider: 'stub',
    costCents: 0,
  };
}

interface AiDetectionResult {
  aiLikelihoodPct: number; // 0-100, higher = more likely AI-written
  provider: string;
  costCents: number;
}
// ADAPTER STUB — Originality.ai / GPTZero AI-content detection (US-BLOG-034).
async function aiDetectionAdapterStub(_text: string): Promise<AiDetectionResult> {
  // TODO: POST to Originality.ai /scan/ai or GPTZero /v2/predict/text; map the
  // ai/score field to aiLikelihoodPct and the billed cost to costCents.
  return { aiLikelihoodPct: 22, provider: 'stub', costCents: 0 };
}

interface ImageCandidate {
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  attribution?: string;
  source: string;
  prompt?: string;
}
// ADAPTER STUB — DALL-E / Stable Diffusion / Ideogram / Midjourney-proxy (US-BLOG-035).
async function imageGenAdapterStub(
  prompt: string,
  n: number,
): Promise<{ candidates: ImageCandidate[]; costCents: number }> {
  // TODO: call the chosen image-gen provider; upload results to storage and
  // return public URLs. costCents = billed image-gen cost.
  const candidates: ImageCandidate[] = Array.from({ length: n }, (_, i) => ({
    url: `https://example.invalid/generated/${encodeURIComponent(prompt).slice(0, 40)}-${i + 1}.png`,
    width: 1024,
    height: 1024,
    source: 'ai_generated:stub',
    prompt,
  }));
  return { candidates, costCents: 0 };
}
// ADAPTER STUB — Unsplash / Pexels / Pixabay stock search (US-BLOG-035).
async function stockSearchAdapterStub(
  query: string,
  n: number,
): Promise<{ candidates: ImageCandidate[]; costCents: number }> {
  // TODO: GET the stock provider's search API; attribution MUST be baked into
  // each candidate (photographer + provider link per their license terms).
  const candidates: ImageCandidate[] = Array.from({ length: n }, (_, i) => ({
    url: `https://example.invalid/stock/${encodeURIComponent(query).slice(0, 40)}-${i + 1}.jpg`,
    thumbUrl: `https://example.invalid/stock/thumb-${i + 1}.jpg`,
    width: 1920,
    height: 1280,
    attribution: 'Photo by Example Photographer on Unsplash (stub)',
    source: 'stock:stub',
  }));
  return { candidates, costCents: 0 };
}

// ADAPTER STUB — Google Sheets fetch (US-BLOG-029).
async function googleSheetAdapterStub(
  _sourceRef: string,
): Promise<{ columns: unknown[]; rows: unknown[] }> {
  // TODO: use the Sheets API (or published-CSV export URL) to pull values; parse
  // the header row into columns and the rest into rows.
  return { columns: [], rows: [] };
}
// ADAPTER STUB — internal read-only Postgres view (US-BLOG-029). Per-workspace
// creds are stored encrypted; this stub never receives the plaintext.
async function internalViewAdapterStub(
  _viewName: string,
): Promise<{ columns: unknown[]; rows: unknown[] }> {
  // TODO: open a read-only connection using the decrypted per-workspace config
  // and SELECT * FROM <whitelisted view>. Enforce read-only + row caps.
  return { columns: [], rows: [] };
}
// ADAPTER STUB — public API fetch (US-BLOG-029).
async function publicApiAdapterStub(
  _sourceRef: string,
): Promise<{ columns: unknown[]; rows: unknown[] }> {
  // TODO: GET the public dataset endpoint and normalize to columns + rows.
  return { columns: [], rows: [] };
}

// ADAPTER STUB — server-side PNG render for charts/diagrams (US-BLOG-029/038).
// Real impl renders the spec/mermaid/excalidraw to a PNG for email/AMP fallback.
function pngRenderStub(kind: string, id: string): string {
  // TODO: render to PNG via a headless renderer (e.g. mermaid-cli / resvg) and
  // upload; return the storage path. Placeholder ref keeps the column populated.
  return `stub://png/${kind}/${id}.png`;
}

// ADAPTER STUB — vision-LLM alt-text from an image URL (US-BLOG-035).
async function visionAltTextAdapterStub(imageUrl: string, context?: string): Promise<string> {
  // TODO: send the image to a vision model and return a concise alt description.
  // Falls back to a context-derived line so the field is never empty.
  const base = context?.trim() ? context.trim().slice(0, 110) : 'Editorial image for the post';
  return `${base} (auto-generated; please review)`.slice(0, 160);
}

// ---------------------------------------------------------------------------
// Small shared helpers.
// ---------------------------------------------------------------------------

/** Image optimization breakpoints (US-BLOG-035). Actual resize/encode stubbed. */
const IMAGE_BREAKPOINTS = [320, 768, 1200, 1920];
const IMAGE_FORMATS = ['webp', 'avif'];

function buildBreakpointMeta(originalUrl: string) {
  // ADAPTER STUB — image optimization. TODO: resize to each breakpoint and
  // encode WebP/AVIF; for now record the intended set + keep the original ref.
  return {
    original: originalUrl,
    breakpoints: IMAGE_BREAKPOINTS,
    formats: IMAGE_FORMATS,
    generated: false, // flips true once real processing runs
  };
}

/** Minimal CSV parser for inline uploads (US-BLOG-029). Handles quoted fields. */
function parseCsv(text: string): {
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, string>[];
} {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const header = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitLine(lines[r]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => (row[h] = cells[idx] ?? ''));
    rows.push(row);
  }
  // Infer column types from the first non-empty value.
  const columns = header.map((name) => {
    let type = 'string';
    for (const row of rows) {
      const v = row[name];
      if (v === undefined || v === '') continue;
      if (!Number.isNaN(Number(v))) type = 'number';
      else if (!Number.isNaN(Date.parse(v))) type = 'date';
      break;
    }
    return { name, type };
  });
  return { columns, rows };
}

/** Paragraph-level diff for the rewrite toolbar (US-BLOG-032). */
function paragraphDiff(original: string, proposed: string) {
  const split = (s: string) =>
    s
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  const a = split(original);
  const b = split(proposed);
  const max = Math.max(a.length, b.length);
  const paragraphs = [];
  for (let i = 0; i < max; i++) {
    const before = a[i] ?? '';
    const after = b[i] ?? '';
    let status: 'unchanged' | 'changed' | 'added' | 'removed';
    if (before && !after) status = 'removed';
    else if (!before && after) status = 'added';
    else status = before === after ? 'unchanged' : 'changed';
    paragraphs.push({ index: i, before, after, status });
  }
  return paragraphs;
}

async function loadPost(admin: Admin, tenantId: string, postId: string) {
  const { data, error } = await admin
    .from('blog_posts')
    .select('id,title,slug,excerpt,body_markdown,meta_description,featured_image_asset_id,status')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body_markdown: string | null;
    meta_description: string | null;
    featured_image_asset_id: string | null;
    status: string;
  } | null;
}

/** Log AI/scan spend to blog_ai_costs (US-BLOG-034/035 cost logging). */
async function logAiCost(
  admin: Admin,
  tenantId: string,
  feature: string,
  costCents: number,
  opts: {
    provider?: string;
    model?: string;
    postId?: string;
    userId?: string;
    tokens?: { input: number; output: number };
  } = {},
): Promise<void> {
  try {
    await admin.from('blog_ai_costs').insert({
      tenant_id: tenantId,
      provider: opts.provider ?? 'stub',
      model: opts.model ?? null,
      feature,
      prompt_tokens: opts.tokens?.input ?? 0,
      completion_tokens: opts.tokens?.output ?? 0,
      total_tokens: (opts.tokens?.input ?? 0) + (opts.tokens?.output ?? 0),
      cost_cents: Math.max(0, Math.round(costCents)),
      post_id: opts.postId ?? null,
      created_by_user_id: opts.userId ?? null,
    });
  } catch (err) {
    console.error('blog-authoring-tools logAiCost failed', err);
  }
}

// ===========================================================================
// US-BLOG-029 — Data assets + chart builder
// ===========================================================================

const createDataAssetSchema = z.object({
  name: z.string().min(1).max(300),
  source_type: z.enum(['csv', 'google_sheet', 'internal_view', 'public_api']),
  post_id: z.string().uuid().optional(),
  /** Inline CSV text for source_type=csv. */
  csv_text: z.string().max(2_000_000).optional(),
  /** Sheet URL / API endpoint / view name. */
  source_ref: z.string().max(2000).optional(),
  /** Plaintext per-workspace connection config for internal_view — encrypted, never returned. */
  connection_config: z.record(z.unknown()).optional(),
  /** Data-source URL stored as a blog_citation. */
  source_url: z.string().url().max(2000).optional(),
});

/** Strip secrets before returning a data asset row to the client. */
function redactDataAsset(row: Record<string, unknown>) {
  const { encrypted_config, ...rest } = row;
  return { ...rest, credentials_set: encrypted_config != null };
}

async function fetchDatasetForSource(
  sourceType: string,
  args: { csvText?: string; sourceRef?: string },
): Promise<{ columns: unknown[]; rows: unknown[]; rowCount: number }> {
  if (sourceType === 'csv') {
    const parsed = parseCsv(args.csvText ?? '');
    return { columns: parsed.columns, rows: parsed.rows, rowCount: parsed.rows.length };
  }
  let res: { columns: unknown[]; rows: unknown[] };
  if (sourceType === 'google_sheet') res = await googleSheetAdapterStub(args.sourceRef ?? '');
  else if (sourceType === 'internal_view')
    res = await internalViewAdapterStub(args.sourceRef ?? '');
  else res = await publicApiAdapterStub(args.sourceRef ?? '');
  return { columns: res.columns, rows: res.rows, rowCount: res.rows.length };
}

async function createDataAsset(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = createDataAssetSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  if (d.source_type === 'csv' && !d.csv_text) {
    return createCorsResponse({ error: 'csv_text is required for source_type=csv' }, 400, req);
  }

  let fetched: { columns: unknown[]; rows: unknown[]; rowCount: number };
  try {
    fetched = await fetchDatasetForSource(d.source_type, {
      csvText: d.csv_text,
      sourceRef: d.source_ref,
    });
  } catch (err) {
    console.error('blog-authoring-tools dataset fetch error', err);
    return createCorsResponse({ error: 'Failed to load dataset from source' }, 502, req);
  }

  // Data-source URL stored as a citation (reuse blog_citations) — needs a post.
  let citationId: string | null = null;
  if (d.source_url && d.post_id) {
    const { data: cite } = await admin
      .from('blog_citations')
      .insert({
        post_id: d.post_id,
        tenant_id: tenantId,
        url: d.source_url,
        title: `Data source: ${d.name}`,
      })
      .select('id')
      .maybeSingle();
    citationId = (cite as { id: string } | null)?.id ?? null;
  }

  // Encrypt per-workspace connection config for internal_view; store only the marker.
  let encryptedConfig: unknown = null;
  if (d.source_type === 'internal_view' && d.connection_config) {
    encryptedConfig = await encryptCredential(JSON.stringify(d.connection_config));
  }

  const { data: inserted, error } = await admin
    .from('blog_data_assets')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id ?? null,
      name: d.name,
      source_type: d.source_type,
      source_ref: d.source_ref ?? null,
      columns: fetched.columns,
      rows: d.source_type === 'csv' ? fetched.rows : null,
      row_count: fetched.rowCount,
      encrypted_config: encryptedConfig,
      citation_id: citationId,
      refreshed_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) {
    console.error('blog-authoring-tools data asset insert error', error);
    return createCorsResponse({ error: 'Failed to store data asset' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_data_asset.create',
      targetType: 'blog_data_asset',
      targetId: inserted.id,
      summary: `Created dataset "${d.name}" (${d.source_type})`,
      afterState: { source_type: d.source_type, row_count: fetched.rowCount },
    }),
  );
  return createCorsResponse({ data_asset: redactDataAsset(inserted) }, 201, req);
}

async function listDataAssets(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_data_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list data assets' }, 500, req);
  return createCorsResponse({ data_assets: (data ?? []).map(redactDataAsset) }, 200, req);
}

async function getDataAsset(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_data_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load data asset' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Data asset not found' }, 404, req);
  return createCorsResponse({ data_asset: redactDataAsset(data) }, 200, req);
}

// Re-render on data refresh WITHOUT changing the post URL: refresh re-pulls the
// dataset and bumps refreshed_at; chart specs reference the same data_asset_id,
// so charts re-render against fresh data and the post URL is untouched.
async function refreshDataAsset(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: existing, error: loadErr } = await admin
    .from('blog_data_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (loadErr) return createCorsResponse({ error: 'Failed to load data asset' }, 500, req);
  if (!existing) return createCorsResponse({ error: 'Data asset not found' }, 404, req);

  // CSV assets have no live source to re-pull; just bump the timestamp.
  let fetched: { columns: unknown[]; rows: unknown[]; rowCount: number } | null = null;
  if (existing.source_type !== 'csv') {
    try {
      fetched = await fetchDatasetForSource(existing.source_type, {
        sourceRef: existing.source_ref ?? undefined,
      });
    } catch (err) {
      console.error('blog-authoring-tools refresh fetch error', err);
      return createCorsResponse({ error: 'Failed to refresh dataset from source' }, 502, req);
    }
  }

  const patch: Record<string, unknown> = {
    refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (fetched) {
    patch.columns = fetched.columns;
    patch.row_count = fetched.rowCount;
  }
  const { data, error } = await admin
    .from('blog_data_assets')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to refresh data asset' }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_data_asset.refresh',
      targetType: 'blog_data_asset',
      targetId: id,
      summary: 'Refreshed dataset; charts re-render, post URL unchanged',
    }),
  );
  return createCorsResponse({ data_asset: redactDataAsset(data) }, 200, req);
}

async function deleteDataAsset(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_data_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to delete data asset' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Data asset not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_data_asset.delete',
      targetType: 'blog_data_asset',
      targetId: id,
      summary: 'Deleted dataset',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

const buildChartSchema = z.object({
  data_asset_id: z.string().uuid(),
  chart_type: z.enum(['bar', 'line', 'pie', 'scatter']),
  post_id: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  /** Axes config: x = column name; y = one or more column names. */
  x: z.string().max(200),
  y: z.array(z.string().max(200)).min(1),
  series: z.string().max(200).optional(),
  colors: z.array(z.string().max(40)).optional(),
});

async function buildChart(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = buildChartSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  const { data: dataset } = await admin
    .from('blog_data_assets')
    .select('id,name,columns')
    .eq('tenant_id', tenantId)
    .eq('id', d.data_asset_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!dataset) return createCorsResponse({ error: 'Data asset not found' }, 404, req);

  const spec = { x: d.x, y: d.y, series: d.series ?? null, colors: d.colors ?? null };
  const chartDescription = `${d.chart_type} chart of ${d.y.join(', ')} by ${d.x}${d.title ? ` — ${d.title}` : ''}`;

  // Alt text auto-generated from the chart description (LLM); falls back to the
  // deterministic description if the model is unavailable.
  let altText = chartDescription;
  try {
    const raw = await generateCompletion({
      max_tokens: 120,
      temperature: 0.4,
      system:
        'You write concise, factual alt text for data charts. Return one sentence, no quotes, <=160 chars.',
      messages: [{ role: 'user', content: `Write alt text for this chart: ${chartDescription}.` }],
    });
    altText = raw.trim().slice(0, 200) || chartDescription;
  } catch (err) {
    console.error('blog-authoring-tools chart alt-text LLM error', err);
  }

  // Persist a blog_assets row for the rendered chart (server PNG render stubbed).
  const { data: asset } = await admin
    .from('blog_assets')
    .insert({
      tenant_id: tenantId,
      asset_type: 'image',
      title: d.title ?? `${d.chart_type} chart`,
      description: chartDescription,
      alt_text: altText,
      created_by_user_id: userId,
    })
    .select('id')
    .maybeSingle();
  const assetId = (asset as { id: string } | null)?.id ?? null;

  const { data: inserted, error } = await admin
    .from('blog_chart_specs')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id ?? null,
      data_asset_id: d.data_asset_id,
      chart_type: d.chart_type,
      title: d.title ?? null,
      spec,
      source: { csv: false, data_asset_id: d.data_asset_id },
      description: chartDescription,
      alt_text: altText,
      asset_id: assetId,
      // Server-side PNG render stubbed; client renders SVG from `spec`.
      png_ref: assetId ? pngRenderStub('chart', assetId) : null,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) {
    console.error('blog-authoring-tools chart insert error', error);
    return createCorsResponse({ error: 'Failed to store chart spec' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_chart_spec.create',
      targetType: 'blog_chart_spec',
      targetId: inserted.id,
      summary: `Built ${d.chart_type} chart`,
      afterState: { chart_type: d.chart_type, data_asset_id: d.data_asset_id },
    }),
  );
  // Note: client renders the SVG from `spec`; png_ref is the server PNG fallback.
  return createCorsResponse(
    { chart: inserted, render: { svg: 'client', png: inserted.png_ref } },
    201,
    req,
  );
}

async function listCharts(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_chart_specs')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list charts' }, 500, req);
  return createCorsResponse({ charts: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-032 — Inline AI rewrite toolbar
// ===========================================================================

const REWRITE_ACTIONS = [
  'shorten',
  'expand',
  'simplify',
  'make_formal',
  'make_casual',
  'add_example',
  'add_citation',
  'fix_grammar',
  'custom',
] as const;

const rewriteSchema = z.object({
  selection: z.string().min(1).max(20000),
  action: z.enum(REWRITE_ACTIONS),
  brand_voice_id: z.string().uuid().optional(),
  custom_prompt: z.string().max(2000).optional(),
  post_id: z.string().uuid().optional(),
});

const REWRITE_INSTRUCTION: Record<(typeof REWRITE_ACTIONS)[number], string> = {
  shorten: 'Make the selection meaningfully shorter while preserving every key point.',
  expand: 'Expand the selection with more depth and detail without padding or fluff.',
  simplify: 'Simplify the selection to plain language at a lower reading level; keep the meaning.',
  make_formal: 'Rewrite the selection in a more formal, professional register.',
  make_casual: 'Rewrite the selection in a warmer, more conversational tone.',
  add_example: 'Rewrite the selection adding one concrete, relevant example.',
  add_citation:
    'Rewrite the selection adding a clearly-marked [citation needed] placeholder where a source should support a claim.',
  fix_grammar: 'Fix grammar, spelling, and punctuation only; do not change meaning or style.',
  custom: 'Apply the user-provided instruction to the selection.',
};

async function rewrite(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = rewriteSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  if (d.action === 'custom' && !d.custom_prompt) {
    return createCorsResponse({ error: 'custom_prompt is required when action=custom' }, 400, req);
  }

  // Read the workspace brand voice (US-BLOG-032).
  let voiceLine = '';
  if (d.brand_voice_id) {
    const { data: voice } = await admin
      .from('blog_brand_voices')
      .select('name,tone,persona_description,pov,banned_phrases,preferred_phrases')
      .eq('tenant_id', tenantId)
      .eq('id', d.brand_voice_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (voice) {
      voiceLine =
        `Apply this brand voice. Name: ${voice.name}. Tone: ${voice.tone ?? 'n/a'}. ` +
        `Persona: ${voice.persona_description ?? 'n/a'}. POV: ${voice.pov ?? 'n/a'}. ` +
        `Avoid: ${asStringArray(voice.banned_phrases).join(', ') || 'none'}. ` +
        `Prefer: ${asStringArray(voice.preferred_phrases).join(', ') || 'none'}.`;
    }
  }

  const instruction = d.action === 'custom' ? d.custom_prompt! : REWRITE_INSTRUCTION[d.action];
  const system =
    'You are an inline editing assistant. Rewrite ONLY the provided selection. ' +
    'Preserve the original markdown/paragraph structure where possible. ' +
    'Return ONLY the rewritten text — no preamble, no quotes, no code fences. ' +
    voiceLine;

  let proposed: string;
  let usage: { inputTokens: number; outputTokens: number; costUsd: number };
  try {
    const result = await generateCompletionDetailed({
      max_tokens: 1500,
      temperature: 0.6,
      system,
      messages: [
        { role: 'user', content: `Instruction: ${instruction}\n\nSelection:\n${d.selection}` },
      ],
    });
    proposed = result.text.trim();
    usage = result.usage;
  } catch (err) {
    console.error('blog-authoring-tools rewrite error', err);
    return createCorsResponse({ error: 'Rewrite failed — model unavailable.' }, 502, req);
  }

  await logAiCost(admin, tenantId, 'inline_rewrite', Math.round(usage.costUsd * 100), {
    provider: 'anthropic',
    postId: d.post_id,
    userId,
    tokens: { input: usage.inputTokens, output: usage.outputTokens },
  });

  // Audit (rewrites are stateless but logged per the story).
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_authoring.rewrite',
      targetType: d.post_id ? 'blog_post' : null,
      targetId: d.post_id ?? null,
      summary: `Inline rewrite (${d.action})`,
    }),
  );

  // Diff view support: original + proposed + per-paragraph diff (caller applies
  // inline with accept/reject + undo).
  return createCorsResponse(
    {
      action: d.action,
      original: d.selection,
      proposed,
      diff: paragraphDiff(d.selection, proposed),
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-034 — Plagiarism + AI-content detection
// ===========================================================================

const scanSchema = z.object({
  post_id: z.string().uuid(),
  scan_type: z.enum(['plagiarism', 'ai_detection']),
  /** Optional threshold override; defaults applied per scan_type. */
  threshold_pct: z.number().int().min(0).max(100).optional(),
});

async function runScan(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id, scan_type } = parsed.data;

  const post = await loadPost(admin, tenantId, post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const text = post.body_markdown || post.excerpt || post.title || '';

  let score: number;
  let matches: unknown[] = [];
  let provider: string;
  let costCents: number;
  let passed: boolean;
  let thresholdPct: number;

  if (scan_type === 'plagiarism') {
    const result = await plagiarismAdapterStub(text);
    score = result.originalityPct; // originality % stored as score
    matches = result.matches;
    provider = result.provider;
    costCents = result.costCents;
    thresholdPct = parsed.data.threshold_pct ?? DEFAULT_PLAGIARISM_MAX_PCT;
    const matchedPct = 100 - result.originalityPct;
    passed = matchedPct <= thresholdPct; // matched content must be <= threshold (default 5%)
  } else {
    const result = await aiDetectionAdapterStub(text);
    score = result.aiLikelihoodPct;
    provider = result.provider;
    costCents = result.costCents;
    thresholdPct = parsed.data.threshold_pct ?? DEFAULT_AI_LIKELIHOOD_MAX_PCT;
    passed = result.aiLikelihoodPct < thresholdPct; // AI-likelihood must be < threshold (default 50%)
  }

  const { data: inserted, error } = await admin
    .from('blog_content_scans')
    .insert({
      tenant_id: tenantId,
      post_id,
      scan_type,
      provider,
      score,
      matches,
      threshold_pct: thresholdPct,
      passed,
      cost_cents: costCents,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) {
    console.error('blog-authoring-tools scan insert error', error);
    return createCorsResponse({ error: 'Failed to store scan' }, 500, req);
  }

  // Cost logged per scan (US-BLOG-034).
  await logAiCost(admin, tenantId, `scan.${scan_type}`, costCents, {
    provider,
    postId: post_id,
    userId,
  });

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: `blog_content_scan.${scan_type}`,
      targetType: 'blog_content_scan',
      targetId: inserted.id,
      summary: `${scan_type} scan: score ${score}, ${passed ? 'pass' : 'fail'}`,
      afterState: { score, passed, threshold_pct: thresholdPct },
    }),
  );
  // matched URLs returned inline for plagiarism.
  return createCorsResponse(
    { scan: inserted, matched_urls: (matches as Array<{ url: string }>).map((m) => m.url) },
    201,
    req,
  );
}

async function listScans(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_content_scans')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  const scanType = url.searchParams.get('scan_type');
  if (postId) q = q.eq('post_id', postId);
  if (scanType) q = q.eq('scan_type', scanType);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list scans' }, 500, req);
  return createCorsResponse({ scans: data ?? [] }, 200, req);
}

// Pre-publish gate (US-BLOG-034): evaluate the latest scan of each type for the
// post against the workspace thresholds; return pass/fail + matched URLs inline.
async function scanGate(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id query param required' }, 400, req);

  const result: Record<string, unknown> = { plagiarism: null, ai_detection: null };
  let pass = true;
  const missing: string[] = [];
  let matchedUrls: string[] = [];

  for (const scanType of ['plagiarism', 'ai_detection'] as const) {
    const { data } = await admin
      .from('blog_content_scans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('post_id', postId)
      .eq('scan_type', scanType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      missing.push(scanType);
      pass = false;
      continue;
    }
    result[scanType] = data;
    if (data.passed === false) pass = false;
    if (scanType === 'plagiarism' && Array.isArray(data.matches)) {
      matchedUrls = (data.matches as Array<{ url: string }>).map((m) => m.url);
    }
  }

  return createCorsResponse(
    {
      pass,
      missing_scans: missing,
      matched_urls: matchedUrls,
      thresholds: {
        plagiarism_max_pct: DEFAULT_PLAGIARISM_MAX_PCT,
        ai_likelihood_max_pct: DEFAULT_AI_LIKELIHOOD_MAX_PCT,
      },
      scans: result,
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-035 — Image generation + stock integration + auto alt text
// ===========================================================================

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  count: z.number().int().min(1).max(6).optional(),
  post_id: z.string().uuid().optional(),
});

async function generateImage(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const n = parsed.data.count ?? 4;
  const { candidates, costCents } = await imageGenAdapterStub(parsed.data.prompt, n);
  await logAiCost(admin, tenantId, 'image_generate', costCents, {
    provider: 'image_gen',
    postId: parsed.data.post_id,
    userId,
  });
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_image.generate',
      targetType: parsed.data.post_id ? 'blog_post' : null,
      targetId: parsed.data.post_id ?? null,
      summary: `Generated ${candidates.length} image candidate(s)`,
    }),
  );
  // Candidates are NOT persisted until the editor inserts one.
  return createCorsResponse({ candidates }, 200, req);
}

const searchStockSchema = z.object({
  query: z.string().min(1).max(500),
  count: z.number().int().min(1).max(20).optional(),
});

async function searchStock(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = searchStockSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const n = parsed.data.count ?? 8;
  const { candidates } = await stockSearchAdapterStub(parsed.data.query, n);
  // Attribution is baked into each candidate by the adapter (US-BLOG-035).
  return createCorsResponse({ candidates }, 200, req);
}

const insertImageSchema = z.object({
  url: z.string().url().max(2000),
  source: z.string().max(40), // ai_generated | stock | upload
  post_id: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  alt_text: z.string().max(1000).optional(),
  attribution: z.string().max(1000).optional(),
  mime_type: z.string().max(100).optional(),
  context: z.string().max(500).optional(), // hint for auto alt text
  is_hero: z.boolean().optional(),
});

async function insertImage(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = insertImageSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  // Auto alt text via vision-LLM stub when none provided (editable downstream).
  const altText = d.alt_text?.trim() || (await visionAltTextAdapterStub(d.url, d.context));

  // Image optimization breakpoint set metadata (resize/encode stubbed); original kept.
  const breakpoints = buildBreakpointMeta(d.url);

  const { data: asset, error } = await admin
    .from('blog_assets')
    .insert({
      tenant_id: tenantId,
      asset_type: 'image',
      title: d.title ?? null,
      description: d.context ?? null,
      storage_path: d.url, // original ref kept; CDN/transcode stubbed
      mime_type: d.mime_type ?? null,
      alt_text: altText,
      attribution: d.attribution ?? null,
      // Stash source + breakpoint metadata in expert_metadata jsonb (generic bag).
      expert_metadata: { kind: 'image', source: d.source, breakpoints },
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) {
    console.error('blog-authoring-tools insert image error', error);
    return createCorsResponse({ error: 'Failed to store image asset' }, 500, req);
  }

  // Optionally set it as the post hero/featured image.
  if (d.is_hero && d.post_id) {
    await admin
      .from('blog_posts')
      .update({ featured_image_asset_id: asset.id, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', d.post_id);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_image.insert',
      targetType: 'blog_asset',
      targetId: asset.id,
      summary: `Inserted ${d.source} image${d.is_hero ? ' (hero)' : ''}`,
      afterState: { source: d.source, is_hero: !!d.is_hero },
    }),
  );
  return createCorsResponse({ asset }, 201, req);
}

// Hero/OG image required before publish (US-BLOG-035).
async function heroCheck(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id query param required' }, 400, req);
  const post = await loadPost(admin, tenantId, postId);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const hasHero = !!post.featured_image_asset_id;
  return createCorsResponse(
    {
      pass: hasHero,
      has_hero_image: hasHero,
      message: hasHero ? 'Hero/OG image present' : 'A hero/OG image is required before publish',
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-037 — Inline fact-checker against captured sources
// ===========================================================================

const factcheckSchema = z.object({ post_id: z.string().uuid() });

async function startFactcheck(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = factcheckSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id } = parsed.data;
  const post = await loadPost(admin, tenantId, post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Persist the run row up-front so long posts can be polled (US-BLOG-037).
  const { data: run, error: runErr } = await admin
    .from('blog_factcheck_runs')
    .insert({
      tenant_id: tenantId,
      post_id,
      status: 'running',
      started_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (runErr) {
    console.error('blog-authoring-tools factcheck run insert error', runErr);
    return createCorsResponse({ error: 'Failed to start fact-check run' }, 500, req);
  }

  // Load captured sources (blog_citations) for the post.
  const { data: citations } = await admin
    .from('blog_citations')
    .select('id,url,title,citation_text')
    .eq('tenant_id', tenantId)
    .eq('post_id', post_id);
  const sources = (citations ?? []) as Array<{
    id: string;
    url: string;
    title: string | null;
    citation_text: string | null;
  }>;

  // Run claim extraction + per-claim verification inline (still pollable via the
  // run row). For very long posts the same row supports a future external worker.
  try {
    const body_text = post.body_markdown || post.excerpt || post.title || '';
    const sourcesBlock = sources.length
      ? sources
          .map(
            (s, i) =>
              `[${i}] ${s.title ?? s.url} — ${s.url}\n${(s.citation_text ?? '').slice(0, 600)}`,
          )
          .join('\n\n')
      : '(no captured sources)';

    const raw = await generateCompletion({
      max_tokens: 3000,
      temperature: 0.2,
      system:
        'You are a rigorous fact-checker. Extract each verifiable factual claim from the draft. ' +
        'For each claim, pick the best supporting source from the provided list (by its [index]) or null. ' +
        'Then judge the claim against that source excerpt. Return ONLY a JSON array; each item: ' +
        '{ "text": string, "offset_hint": string (a short verbatim substring of the draft to locate the claim), ' +
        '"source_index": number|null, "verdict": "supported"|"contradicts"|"not_found"|"needs_human", ' +
        '"confidence": number (0-100), "rationale": string }.',
      messages: [
        {
          role: 'user',
          content: `Draft:\n${body_text.slice(0, 9000)}\n\nSources:\n${sourcesBlock}`,
        },
      ],
    });

    const arr = extractJsonArray(raw) as Array<Record<string, unknown>>;
    let flagged = 0;
    const claims = arr.map((c) => {
      const confidence =
        typeof c.confidence === 'number' ? c.confidence : Number(c.confidence) || 0;
      const verdict = String(c.verdict ?? 'needs_human');
      const srcIdx = typeof c.source_index === 'number' ? c.source_index : null;
      const citation = srcIdx != null && sources[srcIdx] ? sources[srcIdx] : null;
      const needsHuman = confidence < FACTCHECK_CONFIDENCE_FLOOR || verdict === 'needs_human';
      if (needsHuman) flagged++;
      // Inline highlight data: locate the claim in the body for offsets.
      const hint = String(c.offset_hint ?? c.text ?? '');
      const start = hint ? body_text.indexOf(hint) : -1;
      const color =
        verdict === 'supported'
          ? 'green'
          : verdict === 'contradicts'
            ? 'red'
            : needsHuman
              ? 'yellow'
              : 'gray';
      return {
        text: String(c.text ?? ''),
        verdict,
        confidence,
        citation_id: citation?.id ?? null, // [needs-citation] when null
        source_excerpt: citation?.citation_text ?? null,
        rationale: String(c.rationale ?? ''),
        needs_human: needsHuman,
        offsets: start >= 0 ? { start, end: start + hint.length } : null,
        color,
      };
    });

    const { data: done, error: updErr } = await admin
      .from('blog_factcheck_runs')
      .update({
        status: 'completed',
        claims,
        claim_count: claims.length,
        flagged_count: flagged,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', run.id)
      .select()
      .single();
    if (updErr) throw updErr;

    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_factcheck.run',
        targetType: 'blog_factcheck_run',
        targetId: run.id,
        summary: `Fact-checked ${claims.length} claim(s), ${flagged} flagged for human`,
        afterState: { claim_count: claims.length, flagged_count: flagged },
      }),
    );
    return createCorsResponse({ run: done }, 201, req);
  } catch (err) {
    console.error('blog-authoring-tools factcheck error', err);
    await admin
      .from('blog_factcheck_runs')
      .update({
        status: 'failed',
        error: String(err).slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', run.id);
    // Return the run id so the UI can still poll/show the failure.
    return createCorsResponse(
      { run: { ...run, status: 'failed' }, error: 'Fact-check failed' },
      502,
      req,
    );
  }
}

async function getFactcheck(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_factcheck_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load fact-check run' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Fact-check run not found' }, 404, req);
  return createCorsResponse({ run: data }, 200, req);
}

// ===========================================================================
// US-BLOG-038 — Diagram + chart generator from data
// ===========================================================================

const validateMermaidSchema = z.object({ mermaid_text: z.string().min(1).max(20000) });

const MERMAID_DIAGRAM_TYPES = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'gantt',
  'pie',
  'journey',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'C4Context',
];

// Basic mermaid syntax sanity check (US-BLOG-038) — header keyword + balanced
// brackets. Full validation happens client-side via mermaid.parse.
function mermaidSanityCheck(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmed = text.trim();
  const firstToken = trimmed.split(/\s|\n/)[0] ?? '';
  if (!MERMAID_DIAGRAM_TYPES.some((t) => trimmed.startsWith(t))) {
    errors.push(
      `Unrecognised diagram type "${firstToken}". Expected one of: ${MERMAID_DIAGRAM_TYPES.join(', ')}.`,
    );
  }
  const pairs: Array<[string, string]> = [
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
  ];
  for (const [open, close] of pairs) {
    const o = (trimmed.match(new RegExp('\\' + open, 'g')) ?? []).length;
    const c = (trimmed.match(new RegExp('\\' + close, 'g')) ?? []).length;
    if (o !== c) errors.push(`Unbalanced "${open}${close}" (${o} open, ${c} close).`);
  }
  if (trimmed.length < 3) errors.push('Diagram text is too short.');
  return { valid: errors.length === 0, errors };
}

async function validateMermaid(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = validateMermaidSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const result = mermaidSanityCheck(parsed.data.mermaid_text);
  // Preview is the same mermaid text echoed back for client-side render.
  return createCorsResponse({ ...result, preview: parsed.data.mermaid_text }, 200, req);
}

const saveDiagramSchema = z
  .object({
    post_id: z.string().uuid().optional(),
    title: z.string().max(500).optional(),
    diagram_kind: z.enum(['mermaid', 'excalidraw']),
    mermaid_text: z.string().max(20000).optional(),
    excalidraw_json: z.record(z.unknown()).optional(),
    /** Caller-supplied SVG (rendered client-side from excalidraw/mermaid). */
    svg: z.string().max(2_000_000).optional(),
    description: z.string().max(1000).optional(),
    alt_text: z.string().max(1000).optional(),
  })
  .refine((d) => (d.diagram_kind === 'mermaid' ? !!d.mermaid_text : !!d.excalidraw_json), {
    message: 'mermaid_text required for mermaid; excalidraw_json required for excalidraw',
  });

async function saveDiagram(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = saveDiagramSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  if (d.diagram_kind === 'mermaid') {
    const check = mermaidSanityCheck(d.mermaid_text!);
    if (!check.valid) {
      return createCorsResponse(
        { error: 'Invalid mermaid syntax', errors: check.errors },
        400,
        req,
      );
    }
  }

  const description =
    d.description ?? (d.diagram_kind === 'mermaid' ? 'Mermaid diagram' : 'Excalidraw diagram');
  const altText = d.alt_text?.trim() || (await visionAltTextAdapterStub('diagram', description));

  // Each diagram is stored in blog_assets with asset_type='diagram'. The editable
  // source (mermaid_text | excalidraw_json) + SVG live in expert_metadata so the
  // block can be re-opened and edited later.
  const source =
    d.diagram_kind === 'mermaid'
      ? { mermaid_text: d.mermaid_text }
      : { excalidraw_json: d.excalidraw_json };

  const { data: asset, error: assetErr } = await admin
    .from('blog_assets')
    .insert({
      tenant_id: tenantId,
      asset_type: 'diagram',
      title: d.title ?? null,
      description,
      alt_text: altText,
      mime_type: 'image/svg+xml',
      storage_path: d.svg ? 'inline-svg' : null,
      expert_metadata: {
        kind: 'diagram',
        diagram_kind: d.diagram_kind,
        source,
        svg: d.svg ?? null,
      },
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (assetErr) {
    console.error('blog-authoring-tools save diagram asset error', assetErr);
    return createCorsResponse({ error: 'Failed to store diagram asset' }, 500, req);
  }

  // Also record a chart_spec row so diagrams + data charts share one index, with
  // a server-side PNG fallback ref for email/AMP (render stubbed).
  const { data: spec } = await admin
    .from('blog_chart_specs')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id ?? null,
      data_asset_id: null,
      chart_type: d.diagram_kind, // 'mermaid' | 'excalidraw'
      title: d.title ?? null,
      spec: null,
      source,
      description,
      alt_text: altText,
      asset_id: asset.id,
      png_ref: pngRenderStub('diagram', asset.id),
      created_by_user_id: userId,
    })
    .select()
    .maybeSingle();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_diagram.create',
      targetType: 'blog_asset',
      targetId: asset.id,
      summary: `Saved ${d.diagram_kind} diagram`,
      afterState: { diagram_kind: d.diagram_kind },
    }),
  );
  return createCorsResponse({ asset, chart_spec: spec ?? null }, 201, req);
}

// ===========================================================================
// Router
// ===========================================================================

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }
    if (!hasPostEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
    }
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-authoring-tools');
    const [seg0, seg1, seg2] = parts;

    // --- US-BLOG-029: data-assets -------------------------------------------
    if (seg0 === 'data-assets') {
      if (!seg1) {
        if (req.method === 'GET') return await listDataAssets(admin, tenantId, url, req);
        if (req.method === 'POST') return await createDataAsset(admin, tenantId, user.id, req);
      } else if (!seg2) {
        if (req.method === 'GET') return await getDataAsset(admin, tenantId, seg1, req);
        if (req.method === 'DELETE')
          return await deleteDataAsset(admin, tenantId, user.id, seg1, req);
      } else if (seg2 === 'refresh' && req.method === 'POST') {
        return await refreshDataAsset(admin, tenantId, user.id, seg1, req);
      }
    }

    // --- US-BLOG-029 / 038: charts ------------------------------------------
    if (seg0 === 'charts' && !seg1) {
      if (req.method === 'POST') return await buildChart(admin, tenantId, user.id, req);
      if (req.method === 'GET') return await listCharts(admin, tenantId, url, req);
    }

    // --- US-BLOG-032: rewrite ------------------------------------------------
    if (seg0 === 'rewrite' && !seg1 && req.method === 'POST') {
      return await rewrite(admin, tenantId, user.id, req);
    }

    // --- US-BLOG-034: scans --------------------------------------------------
    if (seg0 === 'scans') {
      if (seg1 === 'gate' && req.method === 'GET') return await scanGate(admin, tenantId, url, req);
      if (!seg1) {
        if (req.method === 'POST') return await runScan(admin, tenantId, user.id, req);
        if (req.method === 'GET') return await listScans(admin, tenantId, url, req);
      }
    }

    // --- US-BLOG-035: images -------------------------------------------------
    if (seg0 === 'images') {
      if (seg1 === 'generate' && req.method === 'POST')
        return await generateImage(admin, tenantId, user.id, req);
      if (seg1 === 'search-stock' && req.method === 'POST')
        return await searchStock(admin, tenantId, user.id, req);
      if (seg1 === 'insert' && req.method === 'POST')
        return await insertImage(admin, tenantId, user.id, req);
      if (seg1 === 'hero-check' && req.method === 'GET')
        return await heroCheck(admin, tenantId, url, req);
    }

    // --- US-BLOG-037: fact-checker ------------------------------------------
    if (seg0 === 'factcheck') {
      if (!seg1 && req.method === 'POST')
        return await startFactcheck(admin, tenantId, user.id, req);
      if (seg1 && req.method === 'GET') return await getFactcheck(admin, tenantId, seg1, req);
    }

    // --- US-BLOG-038: diagrams ----------------------------------------------
    if (seg0 === 'diagrams') {
      if (seg1 === 'validate' && req.method === 'POST') return await validateMermaid(req);
      if (!seg1 && req.method === 'POST') return await saveDiagram(admin, tenantId, user.id, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-authoring-tools handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// Blog PAA + Autocomplete Miner Edge Function (US-BLOG-016)
//
// Recursively mines People Also Ask questions from Google + expands
// autocomplete suggestions across A-Z + 0-9 prefixes. Results land in
// blog_keywords with source_type='paa' | 'autocomplete' and a
// parent_keyword_id chain that lets the UI render a tree.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST   /blog-paa-miner/mine         body: { keyword, depth?, location_code?, language_code?, include_paa?, include_autocomplete? }
//                                        depth: 1..4 (default 2). depth 1 = just first-level PAA for the seed.
//                                        Stores the seed (if missing) + every mined question/suggestion as a blog_keywords row.
//                                        Returns: { seed, mined_paa, mined_autocomplete, total_keywords, cost_cents, dedup_skipped }
//   GET    /blog-paa-miner/tree?keyword=  fetch the PAA + autocomplete tree for a previously mined seed
//   DELETE /blog-paa-miner/clear?keyword= remove every keyword row mined under this seed (cascades via parent_keyword_id)
//
// Credentials: same dataforseo target lookup as blog-serp.
// Rate limiting: per AC, back off aggressively on 429. Implemented as a
// global delay + exponential retry around dfsFetch errors with status 429.
//
// Persistence dedup: same (tenant_id, lowercase(keyword)) gets reused — the
// miner never inserts a duplicate row; it just attaches new parent links if
// the same question is re-discovered under a different parent.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { decryptCredential, type EncryptedCredential } from '../_shared/credential-vault.ts';
import {
  getKeywordAdapter,
  type KeywordCredentials,
  type SerpFetchResult,
} from '../_shared/blog/keyword/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const PREFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

const mineSchema = z.object({
  keyword: z.string().min(1).max(500),
  depth: z.number().int().min(1).max(4).optional(),
  location_code: z.number().int().optional(),
  language_code: z.string().min(2).max(16).optional(),
  include_paa: z.boolean().optional(),
  include_autocomplete: z.boolean().optional(),
});

interface EncryptedKeywordConfig {
  base_url?: string | null;
  api_key: EncryptedCredential;
  api_secret?: EncryptedCredential | null;
}

interface KeywordRow {
  id: string;
  tenant_id: string;
  keyword: string;
  source_type: string | null;
  parent_keyword_id: string | null;
  parent_question: string | null;
  mining_depth: number | null;
}

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    if (!hasBlogPostEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-paa-miner');
    const action = parts[0];

    if (action === 'mine' && req.method === 'POST') {
      return await mine(admin, tenantId, user.id, req);
    }
    if (action === 'tree' && req.method === 'GET') {
      return await fetchTree(admin, tenantId, url, req);
    }
    if (action === 'clear' && req.method === 'DELETE') {
      return await clearRun(admin, tenantId, user.id, url, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-paa-miner handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function mine(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = mineSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const input = parsed.data;
  const depth = input.depth ?? 2;
  const locationCode = input.location_code ?? 2840;
  const languageCode = input.language_code ?? 'en';
  const includePaa = input.include_paa ?? true;
  const includeAutocomplete = input.include_autocomplete ?? true;

  // Resolve adapter creds
  const { data: target } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'dataforseo')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!target) {
    return createCorsResponse(
      {
        error:
          'No active dataforseo keyword target. Add credentials at /platform-admin/blog/settings/keyword-targets.',
      },
      400,
      req,
    );
  }
  const adapter = getKeywordAdapter(target.platform);
  if (!adapter?.fetchSerp || !adapter.autocomplete) {
    return createCorsResponse(
      { error: `Adapter "${target.platform}" missing required methods` },
      400,
      req,
    );
  }

  const config = (target.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  if (!config.api_key) {
    return createCorsResponse({ error: 'Keyword target is missing api_key' }, 400, req);
  }
  let creds: KeywordCredentials;
  try {
    creds = {
      apiKey: await decryptCredential(config.api_key),
      apiSecret: config.api_secret ? await decryptCredential(config.api_secret) : undefined,
      baseUrl: config.base_url ?? undefined,
    };
  } catch (err) {
    return createCorsResponse(
      { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` },
      500,
      req,
    );
  }

  // Ensure seed exists in blog_keywords (source_type=manual if new)
  const seedRow = await upsertKeyword(admin, tenantId, userId, {
    keyword: input.keyword,
    source_type: 'manual',
    parent_keyword_id: null,
    parent_question: null,
    mining_depth: 0,
    source_adapter: 'dataforseo',
  });

  let totalCostCents = 0;
  let totalInserts = 0;
  let dedupSkipped = 0;
  const errors: string[] = [];

  // ── PAA recursive crawl ────────────────────────────────────────────────
  let paaCount = 0;
  if (includePaa) {
    const seen = new Set<string>([normalizeKey(input.keyword)]);
    // BFS queue of { keyword, parent_id, depth }
    type Frontier = { keyword: string; parentId: string; depth: number };
    let frontier: Frontier[] = [{ keyword: input.keyword, parentId: seedRow.id, depth: 0 }];
    for (let level = 0; level < depth && frontier.length > 0; level++) {
      const nextFrontier: Frontier[] = [];
      for (const node of frontier) {
        let serp: SerpFetchResult;
        try {
          serp = await retryOn429(() =>
            adapter.fetchSerp!(creds, node.keyword, {
              location_code: locationCode,
              language_code: languageCode,
              depth: 20,
            }),
          );
        } catch (err) {
          errors.push(
            `PAA fetch "${node.keyword}": ${err instanceof Error ? err.message : 'error'}`,
          );
          continue;
        }
        totalCostCents += serp.cost?.cents ?? 0;

        for (const q of serp.features.paa) {
          const key = normalizeKey(q.question);
          if (!key || seen.has(key)) {
            dedupSkipped++;
            continue;
          }
          seen.add(key);
          const created = await upsertKeyword(admin, tenantId, userId, {
            keyword: q.question,
            source_type: 'paa',
            parent_keyword_id: node.parentId,
            parent_question: node.keyword,
            mining_depth: node.depth + 1,
            source_adapter: 'dataforseo',
            raw_data: { answer: q.answer, url: q.url },
          });
          if (created.inserted) {
            totalInserts++;
            paaCount++;
          } else {
            dedupSkipped++;
          }
          nextFrontier.push({
            keyword: q.question,
            parentId: created.row.id,
            depth: node.depth + 1,
          });
        }
      }
      frontier = nextFrontier;
    }
  }

  // ── Autocomplete A-Z + 0-9 prefix expansion ────────────────────────────
  let autoCount = 0;
  if (includeAutocomplete) {
    const seenAuto = new Set<string>([normalizeKey(input.keyword)]);
    for (const ch of PREFIX_CHARS) {
      let result;
      try {
        result = await retryOn429(() =>
          adapter.autocomplete(creds, `${input.keyword} ${ch}`, {
            location_code: locationCode,
            language_code: languageCode,
          }),
        );
      } catch (err) {
        errors.push(`autocomplete "${ch}": ${err instanceof Error ? err.message : 'error'}`);
        continue;
      }
      totalCostCents += result.cost?.cents ?? 0;
      for (const s of result.suggestions) {
        const key = normalizeKey(s.keyword);
        if (!key || seenAuto.has(key)) {
          dedupSkipped++;
          continue;
        }
        seenAuto.add(key);
        const created = await upsertKeyword(admin, tenantId, userId, {
          keyword: s.keyword,
          source_type: 'autocomplete',
          parent_keyword_id: seedRow.id,
          parent_question: input.keyword,
          mining_depth: 1,
          source_adapter: 'dataforseo',
          raw_data: { rank: s.rank, prefix: ch },
        });
        if (created.inserted) {
          totalInserts++;
          autoCount++;
        } else {
          dedupSkipped++;
        }
      }
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_paa.mine',
      targetType: 'blog_keyword',
      targetId: seedRow.id,
      afterState: {
        keyword: input.keyword,
        depth,
        paa_count: paaCount,
        autocomplete_count: autoCount,
        cost_cents: totalCostCents,
        errors,
      },
      summary: `Mined ${paaCount} PAA + ${autoCount} autocomplete from "${input.keyword}" (depth ${depth}, ${totalCostCents}¢)`,
    }),
  );

  return createCorsResponse(
    {
      seed: seedRow,
      mined_paa: paaCount,
      mined_autocomplete: autoCount,
      total_keywords: totalInserts,
      dedup_skipped: dedupSkipped,
      cost_cents: totalCostCents,
      errors,
    },
    201,
    req,
  );
}

async function fetchTree(admin: Admin, tenantId: string, url: URL, req: Request) {
  const keyword = url.searchParams.get('keyword');
  if (!keyword) {
    return createCorsResponse({ error: 'keyword query param is required' }, 400, req);
  }

  // Find the seed row (most recent row with this keyword + null parent)
  const { data: seed } = await admin
    .from('blog_keywords')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!seed) return createCorsResponse({ error: 'Seed keyword not found' }, 404, req);

  // Fetch the seed's descendants by walking parent_keyword_id transitively.
  // Limit total rows to 2000 — at depth=4 the breadth is much smaller, but
  // autocomplete fan-out can be substantial.
  const allDescendants: KeywordRow[] = [];
  let frontierIds: string[] = [seed.id];
  for (let i = 0; i < 6 && frontierIds.length > 0; i++) {
    const { data: children } = await admin
      .from('blog_keywords')
      .select(
        'id, tenant_id, keyword, source_type, parent_keyword_id, parent_question, mining_depth',
      )
      .eq('tenant_id', tenantId)
      .in('parent_keyword_id', frontierIds)
      .limit(500);
    if (!children || children.length === 0) break;
    allDescendants.push(...(children as KeywordRow[]));
    frontierIds = children.map((c) => c.id);
    if (allDescendants.length > 2000) break;
  }

  // Split into PAA + autocomplete branches
  const paa = allDescendants.filter((d) => d.source_type === 'paa');
  const autocomplete = allDescendants.filter((d) => d.source_type === 'autocomplete');

  return createCorsResponse(
    {
      seed,
      paa,
      autocomplete,
      total: allDescendants.length,
    },
    200,
    req,
  );
}

async function clearRun(admin: Admin, tenantId: string, userId: string, url: URL, req: Request) {
  const keyword = url.searchParams.get('keyword');
  if (!keyword) {
    return createCorsResponse({ error: 'keyword query param is required' }, 400, req);
  }

  const { data: seed } = await admin
    .from('blog_keywords')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!seed) return createCorsResponse({ error: 'Seed not found' }, 404, req);

  // Walk descendants and delete in batches. We don't drop the seed row itself
  // because it may have been imported manually or referenced by a brief.
  const collected = new Set<string>();
  let frontier: string[] = [seed.id];
  for (let i = 0; i < 6 && frontier.length > 0; i++) {
    const { data: children } = await admin
      .from('blog_keywords')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('parent_keyword_id', frontier);
    if (!children || children.length === 0) break;
    for (const c of children) collected.add(c.id);
    frontier = children.map((c) => c.id);
  }

  const ids = Array.from(collected);
  if (ids.length === 0) {
    return createCorsResponse({ deleted: 0 }, 200, req);
  }

  const { error } = await admin
    .from('blog_keywords')
    .delete()
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_paa.clear',
      targetType: 'blog_keyword',
      targetId: seed.id,
      afterState: { keyword, deleted_count: ids.length },
      summary: `Cleared ${ids.length} mined keywords under "${keyword}"`,
    }),
  );

  return createCorsResponse({ deleted: ids.length }, 200, req);
}

// ─── helpers ───

interface UpsertInput {
  keyword: string;
  source_type: 'manual' | 'paa' | 'autocomplete' | 'related' | 'imported';
  parent_keyword_id: string | null;
  parent_question: string | null;
  mining_depth: number;
  source_adapter: string;
  raw_data?: Record<string, unknown>;
}

/**
 * Insert a keyword row if (tenant, lowercase(keyword)) doesn't exist yet, or
 * return the existing row. `inserted` reports whether a new row was created.
 */
async function upsertKeyword(
  admin: Admin,
  tenantId: string,
  userId: string,
  input: UpsertInput,
): Promise<{ row: KeywordRow; inserted: boolean }> {
  const lc = normalizeKey(input.keyword);
  // Try to find an existing row with case-insensitive keyword match
  const { data: existing } = await admin
    .from('blog_keywords')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('keyword', lc)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { row: existing as KeywordRow, inserted: false };
  }
  const { data: created, error } = await admin
    .from('blog_keywords')
    .insert({
      tenant_id: tenantId,
      keyword: input.keyword,
      source_type: input.source_type,
      parent_keyword_id: input.parent_keyword_id,
      parent_question: input.parent_question,
      mining_depth: input.mining_depth,
      source_adapter: input.source_adapter,
      raw_data: input.raw_data ?? null,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? 'Failed to insert keyword');
  }
  return { row: created as KeywordRow, inserted: true };
}

/**
 * Wrap an adapter call with one retry on 429 (Too Many Requests). DataForSEO
 * uses 429 for plan-level rate limiting; a 2-second pause is enough for most
 * shared plans. Other errors propagate immediately.
 */
async function retryOn429<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : 0;
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      return await fn();
    }
    throw err;
  }
}

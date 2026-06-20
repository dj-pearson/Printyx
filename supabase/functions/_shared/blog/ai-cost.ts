// Blog Module — AI cost ledger + quota helpers (US-BLOG-078)
//
// Every blog LLM/adapter call should record its spend so the cost dashboard
// (blog-ai-costs) can slice by workspace, feature, and model, and so the
// per-workspace monthly quota can warn / hard-stop runaway jobs.
//
// Usage from any blog edge function that calls an LLM:
//
//   import { logAiCost, getQuotaStatus } from '../_shared/blog/ai-cost.ts';
//
//   const status = await getQuotaStatus(admin, tenantId);
//   if (status.blocked) return createCorsResponse({ error: 'ai_quota_exceeded' }, 429, req);
//   const { text, usage } = await generateCompletionDetailed({ ... });
//   await logAiCost(admin, {
//     tenantId, feature: 'pipeline.drafter', provider: 'anthropic', model,
//     promptTokens: usage.inputTokens, completionTokens: usage.outputTokens,
//     costCents: usdToCents(usage.costUsd), userId, postId, pipelineRunId,
//   });
//
// blog_ai_costs is append-only; blog_ai_quotas holds exactly one row per tenant.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AiCostEntry {
  tenantId: string;
  provider: string; // anthropic | openai | dataforseo | ...
  model?: string | null;
  feature: string; // 'draft' | 'brief' | 'pipeline.drafter' | ...
  promptTokens?: number;
  completionTokens?: number;
  costCents: number;
  requestId?: string | null;
  postId?: string | null;
  pipelineRunId?: string | null;
  userId?: string | null;
}

export interface QuotaRow {
  id: string;
  tenant_id: string;
  monthly_limit_cents: number | null;
  warn_threshold_pct: number;
  hard_stop: boolean;
  anomaly_multiplier: string | number;
  alert_email: string | null;
  alert_slack_webhook: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotaStatus {
  limitCents: number | null;
  spentCents: number;
  /** 0..100+ percent of the monthly limit consumed; null when unlimited. */
  pct: number | null;
  warn: boolean;
  /** True when hard_stop is on AND spend has reached/exceeded the limit. */
  blocked: boolean;
  warnThresholdPct: number;
  hardStop: boolean;
  monthStart: string;
}

/** Convert a USD estimate into integer cents (rounded, never negative). */
export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.max(0, Math.round(usd * 100));
}

/** First day of the current UTC month as an ISO timestamp. */
export function currentMonthStart(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Insert one cost row. Never throws — cost logging must not break the
 * underlying generation. totalTokens is derived if not supplied.
 */
export async function logAiCost(admin: SupabaseClient, entry: AiCostEntry): Promise<void> {
  try {
    const prompt = Math.max(0, Math.round(entry.promptTokens ?? 0));
    const completion = Math.max(0, Math.round(entry.completionTokens ?? 0));
    const { error } = await admin.from('blog_ai_costs').insert({
      tenant_id: entry.tenantId,
      provider: entry.provider,
      model: entry.model ?? null,
      feature: entry.feature,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      cost_cents: Math.max(0, Math.round(entry.costCents)),
      request_id: entry.requestId ?? null,
      post_id: entry.postId ?? null,
      pipeline_run_id: entry.pipelineRunId ?? null,
      created_by_user_id: entry.userId ?? null,
    });
    if (error) console.error('logAiCost failed:', error.message, { feature: entry.feature });
  } catch (err) {
    console.error('logAiCost threw:', err, { feature: entry.feature });
  }
}

/**
 * Read the tenant quota row, creating a default (unlimited) row on first read.
 * Idempotent under concurrent reads (upsert on tenant_id).
 */
export async function getQuotaRow(admin: SupabaseClient, tenantId: string): Promise<QuotaRow> {
  const { data: existing } = await admin
    .from('blog_ai_quotas')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing) return existing as QuotaRow;

  const { data: created, error } = await admin
    .from('blog_ai_quotas')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id' })
    .select('*')
    .single();
  if (error || !created) {
    // Fall back to an in-memory default so callers never crash.
    return {
      id: '',
      tenant_id: tenantId,
      monthly_limit_cents: null,
      warn_threshold_pct: 80,
      hard_stop: true,
      anomaly_multiplier: 3,
      alert_email: null,
      alert_slack_webhook: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return created as QuotaRow;
}

/** Sum cost_cents for a tenant since a given ISO timestamp. */
export async function getSpendSinceCents(
  admin: SupabaseClient,
  tenantId: string,
  sinceIso: string,
): Promise<number> {
  // Paginate defensively — a busy month could exceed the default 1k cap.
  let total = 0;
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await admin
      .from('blog_ai_costs')
      .select('cost_cents')
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .range(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as Array<{ cost_cents: number | null }>) total += r.cost_cents ?? 0;
    if (data.length < page) break;
    from += page;
  }
  return total;
}

/**
 * Compute the current month's quota status for a tenant. `blocked` is true only
 * when hard_stop is enabled and the limit has been reached.
 */
export async function getQuotaStatus(
  admin: SupabaseClient,
  tenantId: string,
): Promise<QuotaStatus> {
  const quota = await getQuotaRow(admin, tenantId);
  const monthStart = currentMonthStart();
  const spentCents = await getSpendSinceCents(admin, tenantId, monthStart);
  const limit = quota.monthly_limit_cents;
  if (limit == null || limit <= 0) {
    return {
      limitCents: null,
      spentCents,
      pct: null,
      warn: false,
      blocked: false,
      warnThresholdPct: quota.warn_threshold_pct,
      hardStop: quota.hard_stop,
      monthStart,
    };
  }
  const pct = (spentCents / limit) * 100;
  return {
    limitCents: limit,
    spentCents,
    pct,
    warn: pct >= quota.warn_threshold_pct,
    blocked: quota.hard_stop && spentCents >= limit,
    warnThresholdPct: quota.warn_threshold_pct,
    hardStop: quota.hard_stop,
    monthStart,
  };
}

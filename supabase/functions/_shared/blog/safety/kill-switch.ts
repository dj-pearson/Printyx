// Blog Module — Agent Kill Switch (US-BLOG-086)
//
// Helpers used by every blog agent entry point (auto-refresh, draft pipeline,
// distribution scheduler, outreach agent) to honor the global kill switch
// configured per tenant in `blog_agent_settings`.
//
// Usage from an agent edge function:
//
//   import { assertAgentsActive } from '../_shared/blog/safety/kill-switch.ts';
//
//   const settings = await assertAgentsActive(admin, tenantId, 'auto_refresh_agent');
//   if (!settings) {
//     // Paused — short-circuit. assertAgentsActive already wrote the audit
//     // log entry. Return early without doing work.
//     return createCorsResponse({ error: 'agents_paused' }, 423, req);
//   }
//
// Pause/resume are handled by the blog-agents edge function. This module is
// concerned only with the read path used at the start of every agent run.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeAuditLog } from '../audit-log.ts';

export interface AgentSettings {
  id: string;
  tenant_id: string;
  agents_paused: boolean;
  paused_at: string | null;
  paused_by_user_id: string | null;
  paused_reason: string | null;
  auto_refresh_requires_review: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the agent settings row for a tenant. Creates a default row on first
 * read (idempotent — safe to call from concurrent agent runs).
 */
export async function getAgentSettings(
  admin: SupabaseClient,
  tenantId: string,
): Promise<AgentSettings> {
  const { data: existing, error: readError } = await admin
    .from('blog_agent_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (readError) {
    throw new Error(`getAgentSettings read failed: ${readError.message}`);
  }

  if (existing) {
    return existing as AgentSettings;
  }

  // First-time read — insert default row. Use upsert on tenant_id so two
  // concurrent agents don't both try to insert.
  const { data: created, error: insertError } = await admin
    .from('blog_agent_settings')
    .upsert(
      {
        tenant_id: tenantId,
        agents_paused: false,
        auto_refresh_requires_review: false,
      },
      { onConflict: 'tenant_id' },
    )
    .select('*')
    .single();

  if (insertError || !created) {
    throw new Error(`getAgentSettings insert failed: ${insertError?.message ?? 'no row returned'}`);
  }

  return created as AgentSettings;
}

/**
 * Lightweight read for callers that only care about the boolean.
 */
export async function isAgentsPaused(admin: SupabaseClient, tenantId: string): Promise<boolean> {
  const settings = await getAgentSettings(admin, tenantId);
  return settings.agents_paused;
}

/**
 * Gate every agent entry point with this helper. If agents are paused for the
 * tenant, writes a `agent.run.skipped_kill_switch` audit log entry and returns
 * `null`. Otherwise returns the settings row so callers can read flags like
 * `auto_refresh_requires_review` without a second roundtrip.
 *
 * Callers MUST handle the null return by exiting early.
 */
export async function assertAgentsActive(
  admin: SupabaseClient,
  tenantId: string,
  agentKind: string,
  context: { agentRunId?: string; reason?: string } = {},
): Promise<AgentSettings | null> {
  const settings = await getAgentSettings(admin, tenantId);

  if (settings.agents_paused) {
    await writeAuditLog(admin, {
      tenantId,
      actorUserId: null,
      actorType: 'agent',
      agentKind,
      action: 'agent.run.skipped_kill_switch',
      targetType: 'blog_agent_settings',
      targetId: settings.id,
      summary:
        `Agent run skipped because the global kill switch is engaged. ` +
        `Paused since ${settings.paused_at ?? 'unknown'}: ${settings.paused_reason ?? 'no reason given'}.` +
        (context.reason ? ` Trigger context: ${context.reason}.` : '') +
        (context.agentRunId ? ` Run id: ${context.agentRunId}.` : ''),
    });
    return null;
  }

  return settings;
}

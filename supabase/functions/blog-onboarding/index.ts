// Blog Onboarding Status Edge Function (US-BLOG-082)
//
// Read-only status endpoint that powers the Onboarding Checklist on the Blog
// Dashboard. Returns the configuration completeness across every settings
// surface so admins see a single "what's left to wire up" view.
//
// Routes (gated to platform admin OR company admin):
//   GET /blog-onboarding              full status across every step
//
// Each step has: { key, label, complete, count?, healthy?, action_path }
// Frontend renders as a checklist + progress bar.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { CMS_PLATFORMS } from '../_shared/blog/cms/index.ts';
import { KEYWORD_PLATFORMS } from '../_shared/blog/keyword/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

interface StepStatus {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  count: number;
  healthy_count?: number;
  action_label: string;
  action_path: string;
  /** When false, the step itself isn't shipped yet — placeholder + story ID. */
  available: boolean;
  story_id?: string;
}

function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

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
    if (!isAdmin(user)) {
      return createCorsResponse({ error: 'Forbidden: platform/company admin required' }, 403, req);
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
    const steps = await collectSteps(admin, tenantId);

    const totalAvailable = steps.filter((s) => s.available).length;
    const completed = steps.filter((s) => s.available && s.complete).length;
    const percent = totalAvailable === 0 ? 0 : Math.round((completed / totalAvailable) * 100);

    return createCorsResponse(
      {
        steps,
        summary: {
          total: totalAvailable,
          completed,
          percent_complete: percent,
          all_done: completed === totalAvailable && totalAvailable > 0,
        },
      },
      200,
      req,
    );
  } catch (err) {
    console.error('blog-onboarding handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function collectSteps(admin: Admin, tenantId: string): Promise<StepStatus[]> {
  // Brand voices
  const voices = await admin
    .from('blog_brand_voices')
    .select('id, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  const voiceCount = voices.data?.length ?? 0;
  const hasDefaultVoice = (voices.data ?? []).some((v) => v.is_default);

  // Style guides
  const guides = await admin
    .from('blog_style_guides')
    .select('id, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  const guideCount = guides.data?.length ?? 0;
  const hasDefaultGuide = (guides.data ?? []).some((g) => g.is_default);

  // CMS targets
  const cms = await admin
    .from('blog_distribution_targets')
    .select('id, is_active, last_health_check_ok')
    .eq('tenant_id', tenantId)
    .in('platform', CMS_PLATFORMS as unknown as string[])
    .is('deleted_at', null);
  const cmsCount = cms.data?.length ?? 0;
  const cmsHealthyCount = (cms.data ?? []).filter(
    (t) => t.is_active && t.last_health_check_ok === true,
  ).length;

  // Keyword research targets
  const keyword = await admin
    .from('blog_distribution_targets')
    .select('id, is_active, last_health_check_ok')
    .eq('tenant_id', tenantId)
    .in('platform', KEYWORD_PLATFORMS as unknown as string[])
    .is('deleted_at', null);
  const keywordCount = keyword.data?.length ?? 0;
  const keywordHealthyCount = (keyword.data ?? []).filter(
    (t) => t.is_active && t.last_health_check_ok === true,
  ).length;

  // Posts (post count is part of "first content created" milestone)
  const posts = await admin
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  const postCount = posts.count ?? 0;

  // Agent settings — row is auto-created on first read of /blog-agents/settings,
  // so its presence means the admin has visited the settings page.
  const agentSettings = await admin
    .from('blog_agent_settings')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const agentSettingsVisited = agentSettings.data != null;

  return [
    {
      key: 'brand_voice',
      label: 'Configure a brand voice',
      description:
        'AI draft generation, rewrite, and auto-refresh all prepend this voice profile to every model call.',
      complete: voiceCount > 0 && hasDefaultVoice,
      count: voiceCount,
      action_label: voiceCount > 0 ? 'Manage voices' : 'Add brand voice',
      action_path: '/platform-admin/blog/settings/brand-voices',
      available: true,
    },
    {
      key: 'style_guide',
      label: 'Set up a style guide',
      description:
        'Built-in rule packs (AP, Chicago, plain-language, inclusive) plus custom regex/substring rules.',
      complete: guideCount > 0 && hasDefaultGuide,
      count: guideCount,
      action_label: guideCount > 0 ? 'Manage guides' : 'Add style guide',
      action_path: '/platform-admin/blog/settings/style-guides',
      available: true,
    },
    {
      key: 'cms_target',
      label: 'Connect a CMS target',
      description:
        'WordPress or Ghost endpoint where the publish flow pushes posts. Health-checked on save.',
      complete: cmsCount > 0 && cmsHealthyCount > 0,
      count: cmsCount,
      healthy_count: cmsHealthyCount,
      action_label: cmsCount > 0 ? 'Manage targets' : 'Add CMS target',
      action_path: '/platform-admin/blog/settings/cms-targets',
      available: true,
    },
    {
      key: 'keyword_research',
      label: 'Connect a keyword research provider',
      description:
        'DataForSEO API for search volume, related keywords, and SERP autocomplete. Required by the Ideas surface and auto-brief generator.',
      complete: keywordCount > 0 && keywordHealthyCount > 0,
      count: keywordCount,
      healthy_count: keywordHealthyCount,
      action_label: keywordCount > 0 ? 'Manage targets' : 'Add keyword target',
      action_path: '/platform-admin/blog/settings/keyword-targets',
      available: true,
    },
    {
      key: 'agent_settings',
      label: 'Review agent kill switch + auto-refresh policy',
      description:
        'Set whether the auto-refresh agent requires human review for SERP-decay edits. Default is fully autonomous (off).',
      complete: agentSettingsVisited,
      count: agentSettingsVisited ? 1 : 0,
      action_label: 'Review settings',
      action_path: '/platform-admin/blog/settings',
      available: true,
    },
    {
      key: 'first_post',
      label: 'Write your first post',
      description: 'The Posts surface lands when the editor (US-BLOG-008) ships.',
      complete: postCount > 0,
      count: postCount,
      action_label: 'Open Posts',
      action_path: '/platform-admin/blog/posts',
      available: false,
      story_id: 'US-BLOG-008',
    },
    {
      key: 'analytics',
      label: 'Connect GA4 + Search Console',
      description: 'Pulls page-level performance and surfaces decaying posts in the refresh queue.',
      complete: false,
      count: 0,
      action_label: 'Coming soon',
      action_path: '/platform-admin/blog/settings',
      available: false,
      story_id: 'US-BLOG-059',
    },
    {
      key: 'social',
      label: 'Connect at least one social platform',
      description: 'Per-platform syndication: X/Twitter threads, LinkedIn long-form, etc.',
      complete: false,
      count: 0,
      action_label: 'Coming soon',
      action_path: '/platform-admin/blog/distribution',
      available: false,
      story_id: 'US-BLOG-043',
    },
  ];
}

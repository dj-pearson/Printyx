// SEO Edge Function
// Handles SEO settings, pages, analytics, sitemaps, and redirects
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  evaluateSecurityHeaders,
  MAX_REDIRECTS,
  readPageSpeedVitals,
  type RedirectStep,
  summariseRedirectChain,
} from '../../../shared/seo-checks.ts';
import {
  projectAlert,
  projectAudit,
  projectCompetitor,
  projectCrawlResult,
  projectKeyword,
  projectPageScore,
} from '../_shared/seo-projection.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import { subtractMonths } from '../_shared/date-months.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    // `: undefined` rather than `: null` — auth.getUser takes string | undefined, so
    // null trips TS2345. This is the pre-existing pattern across ~40 edge fns that
    // CLAUDE.md documents; its guidance is to fix it in the files you touch.
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // SEC-EDGE-001. Its page is `/root-admin/seo`, minLevel 7. The function served settings, pages, sitemaps and redirects to any tenant member.
    try {
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        7,
      );
    } catch (err) {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Requires role level 7 or higher',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    }

    const url = new URL(req.url);

    // EVERY route in this function 404'd in production before this.
    //
    // It used to do `pathParts = url.pathname.split('/')` and read the resource from
    // pathParts[1], on the assumption that pathParts[0] === 'seo' — i.e. that the
    // request still carried the /seo prefix. It does not: the Coolify dispatcher
    // (supabase/functions/server.ts) STRIPS the function-name segment before invoking
    // the handler (stripSegments = 1; it rewrites the path to
    // `'/' + pathParts.slice(1).join('/')`). So /seo/settings arrived here as
    // /settings, pathParts[1] was undefined, and every `resource === '...'` guard below
    // was false — all six endpoints 404'd.
    //
    // It went unnoticed because '/api/seo' is NOT in crmProxies: dev serves SEO from
    // Express and never touches this function, so the breakage was prod-only and
    // invisible locally.
    //
    // normalizePath strips an OPTIONAL leading /seo, so it is idempotent — the routes
    // resolve identically whether the prefix is present (a direct/native call) or has
    // already been stripped (the Coolify dispatcher). Same fix EDGE-002m applied
    // elsewhere; the sibling `integrations` fn still carries this bug (see CLAUDE.md).
    const { parts } = normalizePath(url.pathname, 'seo');
    const resource = parts[0];
    const resourceId = parts[1];
    const action = parts[2];

    // ========================================================================
    // The SEODashboard read path (PROD-014).
    //
    // The page loads seven lists; this function implemented two of them, so in
    // production five panels 404'd. Every row goes through
    // _shared/seo-projection.ts, because PostgREST returns snake_case and the
    // page reads camelCase — handing rows back raw is a screen of blank cells
    // with no error anywhere.
    // ========================================================================

    // GET /seo/audit/history - newest audits first
    if (req.method === 'GET' && resource === 'audit' && resourceId === 'history') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const { data, error } = await admin
        .from('seo_audit_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching audit history:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectAudit), 200, req);
    }

    // GET /seo/keywords - tracked keywords, highest priority first
    if (req.method === 'GET' && resource === 'keywords' && !resourceId) {
      const { data, error } = await admin
        .from('seo_keywords')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching keywords:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectKeyword), 200, req);
    }

    // GET /seo/competitors - most recent competitor analyses
    if (req.method === 'GET' && resource === 'competitors' && !resourceId) {
      const { data, error } = await admin
        .from('seo_competitor_analysis')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('analyzed_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching competitors:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectCompetitor), 200, req);
    }

    // GET /seo/alerts - newest alerts first
    if (req.method === 'GET' && resource === 'alerts' && !resourceId) {
      const { data, error } = await admin
        .from('seo_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching SEO alerts:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectAlert), 200, req);
    }

    // GET /seo/page-scores - per-page scores
    //
    // Distinct from /seo/pages, which is a different (and broken) thing on both
    // backends — see the note on that branch.
    if (req.method === 'GET' && resource === 'page-scores' && !resourceId) {
      const { data, error } = await admin
        .from('seo_page_scores')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_analyzed', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching page scores:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectPageScore), 200, req);
    }

    // GET /seo/crawl/results - the latest crawl's pages
    //
    // MUST precede /seo/crawl/:crawlId. Express had only the :crawlId form, so
    // this request filtered crawl_id = 'results' and returned [] forever — the
    // panel was empty in dev too, not just in production.
    if (req.method === 'GET' && resource === 'crawl' && resourceId === 'results') {
      const { data: latest } = await admin
        .from('seo_crawl_results')
        .select('crawl_id')
        .eq('tenant_id', tenantId)
        .order('crawled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest?.crawl_id) return createCorsResponse([], 200, req);

      const { data, error } = await admin
        .from('seo_crawl_results')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('crawl_id', latest.crawl_id)
        .order('crawl_depth', { ascending: true });

      if (error) {
        console.error('Error fetching crawl results:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectCrawlResult), 200, req);
    }

    // GET /seo/crawl/:crawlId - one crawl's pages
    if (req.method === 'GET' && resource === 'crawl' && resourceId) {
      const { data, error } = await admin
        .from('seo_crawl_results')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('crawl_id', resourceId)
        .order('crawl_depth', { ascending: true });

      if (error) {
        console.error('Error fetching crawl results:', error);
        return createCorsResponse({ message: 'An internal error occurred' }, 500, req);
      }

      return createCorsResponse((data ?? []).map(projectCrawlResult), 200, req);
    }

    // ============= SETTINGS =============

    // GET /seo/settings - Get SEO settings
    if (req.method === 'GET' && resource === 'settings') {
      const { data: settings, error } = await admin
        .from('seo_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching SEO settings:', error);
        return createCorsResponse({ error: 'Failed to fetch SEO settings' }, 500, req);
      }

      return createCorsResponse(settings || {}, 200, req);
    }

    // PUT /seo/settings - Update SEO settings
    if (req.method === 'PUT' && resource === 'settings') {
      const body = await req.json();

      // Validate allowed fields
      const allowedFields = [
        'site_url',
        'site_name',
        'default_title',
        'default_description',
        'default_keywords',
        'default_og_image',
        'robots_txt',
        'llms_txt',
        'sitemap_url',
        'twitter_handle',
        'facebook_app_id',
        'monitoring_enabled',
        'monitoring_frequency',
        'google_analytics_id',
        'gsc_verification',
      ];

      const settingsData: Record<string, unknown> = {
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      };

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          settingsData[field] = body[field];
        }
      }

      // Check if settings exist
      const { data: existing } = await admin
        .from('seo_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await admin
          .from('seo_settings')
          .update(settingsData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating SEO settings:', error);
          return createCorsResponse({ error: 'Failed to update SEO settings' }, 500, req);
        }
        result = data;
      } else {
        const { data, error } = await admin
          .from('seo_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) {
          console.error('Error creating SEO settings:', error);
          return createCorsResponse({ error: 'Failed to create SEO settings' }, 500, req);
        }
        result = data;
      }

      return createCorsResponse(result, 200, req);
    }

    // ============= PAGES =============

    // GET /seo/pages - List SEO pages
    if (req.method === 'GET' && resource === 'pages' && !resourceId) {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const {
        data: pages,
        error,
        count,
      } = await admin
        .from('seo_page_scores')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('last_analyzed', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching SEO pages:', error);
        return createCorsResponse({ error: 'Failed to fetch SEO pages' }, 500, req);
      }

      return createCorsResponse({ data: pages, total: count }, 200, req);
    }

    // GET /seo/pages/:id - Get page SEO details
    if (req.method === 'GET' && resource === 'pages' && resourceId) {
      const { data: page, error } = await admin
        .from('seo_page_scores')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return createCorsResponse({ error: 'Page not found' }, 404, req);
        }
        console.error('Error fetching page SEO:', error);
        return createCorsResponse({ error: 'Failed to fetch page SEO' }, 500, req);
      }

      return createCorsResponse(page, 200, req);
    }

    // PUT /seo/pages/:id - Update page SEO
    if (req.method === 'PUT' && resource === 'pages' && resourceId) {
      const body = await req.json();

      const allowedFields = [
        'url',
        'title',
        'seo_score',
        'content_quality',
        'technical_seo',
        'user_experience',
        'word_count',
        'reading_level',
        'unique_content_percentage',
        'load_time_ms',
        'mobile_score',
        'accessibility_score',
        'issues',
      ];

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        last_analyzed: new Date().toISOString(),
      };

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      const { data: page, error } = await admin
        .from('seo_page_scores')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return createCorsResponse({ error: 'Page not found' }, 404, req);
        }
        console.error('Error updating page SEO:', error);
        return createCorsResponse({ error: 'Failed to update page SEO' }, 500, req);
      }

      return createCorsResponse(page, 200, req);
    }

    // ============= ANALYTICS =============

    // GET /seo/analytics - Get SEO analytics data
    if (req.method === 'GET' && resource === 'analytics') {
      const period = url.searchParams.get('period') || 'month';

      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        // setMonth OVERFLOWS rather than clamping (DATE-SETMONTH-001): on
        // 31 March, month - 1 asks for "31 February" and lands on 3 March, so
        // `period=month` returned a 28-day window sitting entirely inside the
        // CURRENT month with February excluded outright.
        case 'month':
          startDate.setTime(subtractMonths(now, 1).getTime());
          break;
        case 'quarter':
          startDate.setTime(subtractMonths(now, 3).getTime());
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Fetch analytics data in parallel
      const [pageScores, auditHistory, keywords, coreWebVitals] = await Promise.all([
        admin
          .from('seo_page_scores')
          .select('seo_score, content_quality, technical_seo, user_experience, mobile_score')
          .eq('tenant_id', tenantId)
          .gte('last_analyzed', startDate.toISOString()),
        admin
          .from('seo_audit_history')
          .select(
            'overall_score, technical_score, content_score, performance_score, status, critical_issues, high_issues, medium_issues, low_issues',
          )
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),
        admin
          .from('seo_keywords')
          // seo_keywords has no previous_position column — rank history lives in
          // seo_keyword_history — so naming it here nulled this whole query and
          // the gain/loss counters below silently read 0.
          .select('id, keyword, current_position, search_volume')
          .eq('tenant_id', tenantId)
          .limit(20),
        admin
          .from('seo_core_web_vitals')
          .select('lcp, fid, cls, ttfb, fcp, device')
          .eq('tenant_id', tenantId)
          .gte('measured_at', startDate.toISOString())
          .order('measured_at', { ascending: false })
          .limit(30),
      ]);

      // Calculate averages from page scores
      const avgSeoScore = pageScores.data?.length
        ? pageScores.data.reduce((sum, p) => sum + (p.seo_score || 0), 0) / pageScores.data.length
        : 0;

      const avgMobileScore = pageScores.data?.length
        ? pageScores.data.reduce((sum, p) => sum + (p.mobile_score || 0), 0) /
          pageScores.data.length
        : 0;

      // Get latest audit
      const latestAudit = auditHistory.data?.[0];

      // Calculate total issues
      const totalIssues =
        auditHistory.data?.reduce((sum, a) => {
          return (
            sum +
            (a.critical_issues || 0) +
            (a.high_issues || 0) +
            (a.medium_issues || 0) +
            (a.low_issues || 0)
          );
        }, 0) || 0;

      // Calculate keyword performance.
      //
      // The baseline is each keyword's EARLIEST recorded position inside the
      // selected period, so a "gain" means the rank improved over that period
      // rather than since some unspecified earlier reading.
      const keywordIds = (keywords.data ?? []).map((k: any) => k.id).filter(Boolean);
      const baselinePosition = new Map<string, number>();
      if (keywordIds.length > 0) {
        const { data: history } = await admin
          .from('seo_keyword_history')
          .select('keyword_id, position, recorded_at')
          .in('keyword_id', keywordIds)
          .gte('recorded_at', startDate.toISOString())
          .order('recorded_at', { ascending: true });
        for (const row of history ?? []) {
          // Ascending by recorded_at, so the first row seen per keyword is the
          // oldest one in the window.
          if (!baselinePosition.has(row.keyword_id) && typeof row.position === 'number') {
            baselinePosition.set(row.keyword_id, row.position);
          }
        }
      }

      const keywordGains =
        keywords.data?.filter((k: any) => {
          const before = baselinePosition.get(k.id);
          return k.current_position && before && k.current_position < before;
        }).length || 0;

      const keywordLosses =
        keywords.data?.filter((k: any) => {
          const before = baselinePosition.get(k.id);
          return k.current_position && before && k.current_position > before;
        }).length || 0;

      // Calculate Core Web Vitals averages
      const mobileVitals = coreWebVitals.data?.filter((v) => v.device === 'mobile') || [];
      const avgLcp = mobileVitals.length
        ? mobileVitals.reduce((sum, v) => sum + (parseFloat(v.lcp) || 0), 0) / mobileVitals.length
        : 0;
      const avgFid = mobileVitals.length
        ? mobileVitals.reduce((sum, v) => sum + (parseFloat(v.fid) || 0), 0) / mobileVitals.length
        : 0;
      const avgCls = mobileVitals.length
        ? mobileVitals.reduce((sum, v) => sum + (parseFloat(v.cls) || 0), 0) / mobileVitals.length
        : 0;

      return createCorsResponse(
        {
          period,
          overview: {
            avgSeoScore: Math.round(avgSeoScore),
            avgMobileScore: Math.round(avgMobileScore),
            totalPages: pageScores.data?.length || 0,
            totalAudits: auditHistory.data?.length || 0,
            totalIssues,
          },
          latestAudit: latestAudit
            ? {
                overallScore: latestAudit.overall_score,
                technicalScore: latestAudit.technical_score,
                contentScore: latestAudit.content_score,
                performanceScore: latestAudit.performance_score,
                criticalIssues: latestAudit.critical_issues,
                highIssues: latestAudit.high_issues,
              }
            : null,
          keywords: {
            total: keywords.data?.length || 0,
            gains: keywordGains,
            losses: keywordLosses,
            topKeywords: keywords.data?.slice(0, 5) || [],
          },
          coreWebVitals: {
            lcp: Math.round(avgLcp),
            fid: Math.round(avgFid),
            cls: avgCls.toFixed(3),
          },
        },
        200,
        req,
      );
    }

    // ============= HEADER- AND JSON-ONLY CHECKS (SEO-TRANSPORT-001 AC3) =============
    //
    // Three of the seven endpoints SEODashboard calls that this function did not
    // serve. They read response headers and a JSON API, so they port with no HTML
    // parser; the other four (analyze/images, check/broken-links, check/mobile,
    // validate/structured-data) parse markup and are recorded against the story
    // rather than half-built here.

    // POST /seo/check/security - Response-header security posture
    if (req.method === 'POST' && resource === 'check' && resourceId === 'security') {
      const body = await req.json();
      const targetUrl = body.url || body.pageUrl;
      if (!targetUrl) {
        return createCorsResponse({ error: 'URL is required' }, 400, req);
      }

      let response: Response;
      try {
        response = await fetch(targetUrl);
      } catch (err) {
        return createCorsResponse(
          { error: `Could not reach ${targetUrl}: ${err instanceof Error ? err.message : err}` },
          502,
          req,
        );
      }

      // httpsRedirect is MEASURED rather than inferred from the scheme: probe the
      // http:// form and see where it lands. null when that probe itself failed,
      // because "we could not look" is not "it does not redirect".
      let httpsRedirect: boolean | null = null;
      try {
        const insecure = new URL(targetUrl);
        insecure.protocol = 'http:';
        const probe = await fetch(insecure.href, { redirect: 'manual' });
        const location = probe.headers.get('location');
        httpsRedirect =
          probe.status >= 300 && probe.status < 400 && !!location
            ? new URL(location, insecure.href).protocol === 'https:'
            : false;
      } catch {
        httpsRedirect = null;
      }

      const result = evaluateSecurityHeaders(
        targetUrl,
        [...response.headers.entries()],
        httpsRedirect,
      );

      // certificate_valid is deliberately NOT written: nothing here measures it,
      // and a column left null says that where a false would claim a finding.
      const { error: insertError } = await admin.from('seo_security_analysis').insert({
        tenant_id: tenantId,
        url: targetUrl,
        has_https: result.hasHttps,
        https_redirect: result.httpsRedirect,
        has_hsts: result.hasHsts,
        has_x_frame_options: result.hasXFrameOptions,
        has_x_content_type_options: result.hasXContentTypeOptions,
        has_csp: result.hasCsp,
        headers: result.headers,
        security_score: result.securityScore,
        issues: result.issues,
        checked_at: new Date().toISOString(),
      });
      if (insertError) {
        return createCorsResponse(
          { error: 'Security check ran but could not be stored', details: insertError.message },
          500,
          req,
        );
      }

      return createCorsResponse(result, 200, req);
    }

    // POST /seo/detect/redirect-chains - Follow and summarise a redirect chain
    if (req.method === 'POST' && resource === 'detect' && resourceId === 'redirect-chains') {
      const body = await req.json();
      const sourceUrl = body.sourceUrl || body.url;
      if (!sourceUrl) {
        return createCorsResponse({ error: 'Source URL is required' }, 400, req);
      }

      const steps: RedirectStep[] = [];
      let currentUrl = sourceUrl;
      let loop = false;
      let truncated = false;

      try {
        for (let hop = 0; ; hop += 1) {
          const hopResponse = await fetch(currentUrl, { redirect: 'manual' });
          const location = hopResponse.headers.get('location');
          steps.push({ url: currentUrl, statusCode: hopResponse.status, location });

          const redirecting = hopResponse.status >= 300 && hopResponse.status < 400 && !!location;
          if (!redirecting) break;

          const next = new URL(location as string, currentUrl).href;
          if (steps.some((step) => step.url === next)) {
            loop = true;
            break;
          }
          // The hop limit is REPORTED rather than silently treated as the
          // destination: stopping at ten and returning the tenth URL is a claim
          // that the redirect ended there.
          if (hop + 1 >= MAX_REDIRECTS) {
            truncated = true;
            break;
          }
          currentUrl = next;
        }
      } catch (err) {
        if (steps.length === 0) {
          return createCorsResponse(
            { error: `Could not reach ${sourceUrl}: ${err instanceof Error ? err.message : err}` },
            502,
            req,
          );
        }
      }

      const result = summariseRedirectChain(steps, { loop, truncated });

      const { error: insertError } = await admin.from('seo_redirect_analysis').insert({
        tenant_id: tenantId,
        source_url: sourceUrl,
        destination_url: result.destinationUrl,
        redirect_chain: result.redirectChain,
        chain_length: result.chainLength,
        status_code: result.statusCode,
        redirect_type: result.redirectType,
        has_redirect_loop: result.hasRedirectLoop,
        has_multiple_redirects: result.hasMultipleRedirects,
        issues: result.issues,
        checked_at: new Date().toISOString(),
      });
      if (insertError) {
        return createCorsResponse(
          { error: 'Redirect check ran but could not be stored', details: insertError.message },
          500,
          req,
        );
      }

      return createCorsResponse(result, 200, req);
    }

    // POST /seo/core-web-vitals - PageSpeed Insights
    if (req.method === 'POST' && resource === 'core-web-vitals' && !resourceId) {
      const body = await req.json();
      const targetUrl = body.url || body.pageUrl;
      const device = body.device === 'desktop' ? 'desktop' : 'mobile';
      if (!targetUrl) {
        return createCorsResponse({ error: 'URL is required' }, 400, req);
      }

      // No key means no measurement. Answering 501 beats inventing timings, which
      // is what the five SEO-008 stubs were doing when they stored a readability
      // score nobody computed.
      const apiKey = Deno.env.get('PAGESPEED_INSIGHTS_API_KEY');
      if (!apiKey) {
        return createCorsResponse(
          {
            error: 'PageSpeed Insights API key not configured',
            code: 'NOT_CONFIGURED',
            unbacked: ['Core Web Vitals need PAGESPEED_INSIGHTS_API_KEY in the edge environment.'],
          },
          501,
          req,
        );
      }

      const apiUrl =
        'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
        `?url=${encodeURIComponent(targetUrl)}&strategy=${device}&key=${apiKey}`;

      let payload: any;
      try {
        const psi = await fetch(apiUrl);
        payload = await psi.json();
        if (!psi.ok) {
          return createCorsResponse(
            { error: payload?.error?.message || 'PageSpeed API request failed' },
            502,
            req,
          );
        }
      } catch (err) {
        return createCorsResponse(
          { error: `PageSpeed request failed: ${err instanceof Error ? err.message : err}` },
          502,
          req,
        );
      }

      const vitals = readPageSpeedVitals(payload);

      const { error: insertError } = await admin.from('seo_core_web_vitals').insert({
        tenant_id: tenantId,
        url: targetUrl,
        lcp: vitals.lcp === null ? null : Math.round(vitals.lcp),
        fid: vitals.fid === null ? null : Math.round(vitals.fid),
        cls: vitals.cls,
        fcp: vitals.fcp === null ? null : Math.round(vitals.fcp),
        ttfb: vitals.ttfb === null ? null : Math.round(vitals.ttfb),
        tti: vitals.tti === null ? null : Math.round(vitals.tti),
        tbt: vitals.tbt === null ? null : Math.round(vitals.tbt),
        si: vitals.si,
        performance_score: vitals.performanceScore,
        accessibility_score: vitals.accessibilityScore,
        best_practices_score: vitals.bestPracticesScore,
        seo_score: vitals.seoScore,
        device,
        measured_at: new Date().toISOString(),
      });
      if (insertError) {
        return createCorsResponse(
          { error: 'Vitals measured but could not be stored', details: insertError.message },
          500,
          req,
        );
      }

      return createCorsResponse(vitals, 200, req);
    }

    // ============= SITEMAP =============

    // POST /seo/sitemap/generate - Generate sitemap
    if (req.method === 'POST' && resource === 'sitemap' && resourceId === 'generate') {
      const body = await req.json();
      const baseUrl = body.baseUrl || body.base_url;

      if (!baseUrl) {
        return createCorsResponse({ error: 'Base URL is required' }, 400, req);
      }

      // Fetch pages for sitemap
      const { data: pages } = await admin
        .from('seo_page_scores')
        .select('url, updated_at')
        .eq('tenant_id', tenantId)
        .order('seo_score', { ascending: false })
        .limit(500);

      // Build sitemap XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Add homepage
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // Add pages
      for (const page of pages || []) {
        const pageUrl = page.url.startsWith('http') ? page.url : `${baseUrl}${page.url}`;
        const lastmod = page.updated_at
          ? new Date(page.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        xml += '  <url>\n';
        xml += `    <loc>${pageUrl}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }

      xml += '</urlset>';

      // Store sitemap URL in settings
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      await admin
        .from('seo_settings')
        .update({ sitemap_url: sitemapUrl, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          sitemap: xml,
          sitemapUrl,
          pageCount: (pages?.length || 0) + 1,
          generatedAt: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // ============= REDIRECTS =============

    // GET /seo/redirects - Get URL redirects
    if (req.method === 'GET' && resource === 'redirects' && !resourceId) {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const hasIssues = url.searchParams.get('has_issues');

      let query = admin
        .from('seo_redirect_analysis')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      if (hasIssues === 'true') {
        query = query.or('has_redirect_loop.eq.true,has_multiple_redirects.eq.true');
      }

      const {
        data: redirects,
        error,
        count,
      } = await query.order('checked_at', { ascending: false }).range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching redirects:', error);
        return createCorsResponse({ error: 'Failed to fetch redirects' }, 500, req);
      }

      return createCorsResponse({ data: redirects, total: count }, 200, req);
    }

    // POST /seo/redirects - Create redirect (analyze a redirect chain)
    if (req.method === 'POST' && resource === 'redirects' && !resourceId) {
      const body = await req.json();
      const { sourceUrl, source_url } = body;
      const url = sourceUrl || source_url;

      if (!url) {
        return createCorsResponse({ error: 'Source URL is required' }, 400, req);
      }

      // Create a redirect analysis entry
      const redirectData = {
        tenant_id: tenantId,
        source_url: url,
        destination_url: body.destinationUrl || body.destination_url || url,
        redirect_chain: body.redirectChain || body.redirect_chain || [],
        chain_length: body.chainLength || body.chain_length || 0,
        status_code: body.statusCode || body.status_code || 200,
        redirect_type: body.redirectType || body.redirect_type || null,
        has_redirect_loop: body.hasRedirectLoop || body.has_redirect_loop || false,
        has_multiple_redirects: body.hasMultipleRedirects || body.has_multiple_redirects || false,
        issues: body.issues || [],
        total_time_ms: body.totalTime || body.total_time_ms || null,
        checked_at: new Date().toISOString(),
      };

      const { data: redirect, error } = await admin
        .from('seo_redirect_analysis')
        .insert(redirectData)
        .select()
        .single();

      if (error) {
        console.error('Error creating redirect:', error);
        return createCorsResponse({ error: 'Failed to create redirect' }, 500, req);
      }

      return createCorsResponse(redirect, 201, req);
    }

    // DELETE /seo/redirects/:id - Delete redirect
    if (req.method === 'DELETE' && resource === 'redirects' && resourceId) {
      const { error } = await admin
        .from('seo_redirect_analysis')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting redirect:', error);
        return createCorsResponse({ error: 'Failed to delete redirect' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Invalid SEO endpoint or method' }, 400, req);
  } catch (error) {
    console.error('Error in SEO function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// SEO Edge Function
// Handles SEO settings, pages, analytics, sitemaps, redirects, and the
// SEODashboard monitoring surface (audit history, keywords, competitors,
// alerts, crawl results) plus the RootAdminSEO regenerate-* actions.
//
// Routing uses normalizePath so it is robust under BOTH the native Supabase
// runtime (keeps the `seo` function-name prefix) and Coolify's server.ts
// dispatcher (strips it). parts[0] = resource, parts[1] = id/action,
// parts[2] = sub-action.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';

// Real seo_settings columns (snake_case). Frontend speaks camelCase; we snake
// each incoming key and whitelist against this set so phantom fields (e.g.
// SEODashboard's metaTitle / monitoringFrequency, which have no column) are
// dropped instead of triggering a PostgREST PGRST204.
const SETTINGS_COLUMNS = new Set([
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
  'google_analytics_id',
  'gsc_verification',
]);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()).replace(/^_+/, '');
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'seo');
    const resource = parts[0];
    const resourceId = parts[1];
    const action = parts[2];

    // ============= SETTINGS =============

    // GET /seo/settings - Get SEO settings (camelCase for RootAdminSEO/SEODashboard)
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

      return createCorsResponse(settings ? toCamelShallow(settings) : {}, 200, req);
    }

    // PUT or POST /seo/settings - Upsert SEO settings.
    // Both RootAdminSEO (POST) and SEODashboard (POST) and the older PUT
    // caller converge here.
    if ((req.method === 'PUT' || req.method === 'POST') && resource === 'settings') {
      const body = await req.json();

      const settingsData: Record<string, unknown> = {
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      };

      for (const [key, value] of Object.entries(body)) {
        if (value === undefined) continue;
        const column = camelToSnake(key);
        if (SETTINGS_COLUMNS.has(column)) {
          settingsData[column] = value;
        }
      }

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

      return createCorsResponse(toCamelShallow(result), 200, req);
    }

    // ============= PAGES =============

    // GET /seo/pages - List page scores (client auto-unwraps {data:[...]})
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

      return createCorsResponse(
        { data: (pages || []).map(toCamelShallow), total: count },
        200,
        req,
      );
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

      return createCorsResponse(toCamelShallow(page), 200, req);
    }

    // POST /seo/pages - Upsert a page record by URL (RootAdminSEO "Add / Update
    // Page"). The legacy seo_pages marketing table does not exist; the only real
    // pages table is seo_page_scores, keyed by url. We accept the page form's
    // `path` as the url and persist the minimal {url, title} so the list
    // reflects the add. Fields with no column (schemaType/schemaData) are dropped.
    if (req.method === 'POST' && resource === 'pages' && !resourceId) {
      const body = await req.json();
      const pageUrl = body.url || body.path;

      if (!pageUrl) {
        return createCorsResponse({ error: 'Page URL/path is required' }, 400, req);
      }

      const { data: existing } = await admin
        .from('seo_page_scores')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('url', pageUrl)
        .maybeSingle();

      const pageData: Record<string, unknown> = {
        tenant_id: tenantId,
        url: pageUrl,
        title: body.title ?? null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existing) {
        const { data, error } = await admin
          .from('seo_page_scores')
          .update(pageData)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) {
          console.error('Error updating SEO page:', error);
          return createCorsResponse({ error: 'Failed to save SEO page' }, 500, req);
        }
        result = data;
      } else {
        const { data, error } = await admin
          .from('seo_page_scores')
          .insert(pageData)
          .select()
          .single();
        if (error) {
          console.error('Error creating SEO page:', error);
          return createCorsResponse({ error: 'Failed to save SEO page' }, 500, req);
        }
        result = data;
      }

      return createCorsResponse(toCamelShallow(result), 200, req);
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

      return createCorsResponse(toCamelShallow(page), 200, req);
    }

    // ============= AUDIT HISTORY =============

    // GET /seo/audit/history - SEODashboard audit history (bare camelCase array)
    if (req.method === 'GET' && resource === 'audit' && resourceId === 'history') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const { data: audits, error } = await admin
        .from('seo_audit_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching audit history:', error);
        return createCorsResponse({ error: 'Failed to fetch audit history' }, 500, req);
      }

      return createCorsResponse((audits || []).map(toCamelShallow), 200, req);
    }

    // ============= KEYWORDS =============

    // GET /seo/keywords - tracked keywords (bare camelCase array)
    if (req.method === 'GET' && resource === 'keywords' && !resourceId) {
      const { data: keywords, error } = await admin
        .from('seo_keywords')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching keywords:', error);
        return createCorsResponse({ error: 'Failed to fetch keywords' }, 500, req);
      }

      return createCorsResponse((keywords || []).map(toCamelShallow), 200, req);
    }

    // ============= COMPETITORS =============

    // GET /seo/competitors - competitor analyses (bare camelCase array)
    if (req.method === 'GET' && resource === 'competitors' && !resourceId) {
      const { data: competitors, error } = await admin
        .from('seo_competitor_analysis')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('analyzed_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching competitors:', error);
        return createCorsResponse({ error: 'Failed to fetch competitors' }, 500, req);
      }

      return createCorsResponse((competitors || []).map(toCamelShallow), 200, req);
    }

    // ============= ALERTS =============

    // GET /seo/alerts - monitoring alerts (bare camelCase array)
    if (req.method === 'GET' && resource === 'alerts' && !resourceId) {
      const status = url.searchParams.get('status');

      let query = admin.from('seo_alerts').select('*').eq('tenant_id', tenantId);
      if (status) {
        query = query.eq('status', status);
      }

      const { data: alerts, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching alerts:', error);
        return createCorsResponse({ error: 'Failed to fetch alerts' }, 500, req);
      }

      return createCorsResponse((alerts || []).map(toCamelShallow), 200, req);
    }

    // ============= CRAWL RESULTS =============

    // GET /seo/crawl/results (or /seo/crawl/:crawlId) - recent crawl results.
    // SEODashboard queries /crawl/results; we return the tenant's most recent
    // crawl rows (bare camelCase array) rather than 404.
    if (req.method === 'GET' && resource === 'crawl') {
      let query = admin.from('seo_crawl_results').select('*').eq('tenant_id', tenantId);

      // If a real crawl id (not the literal "results") is supplied, scope to it.
      if (resourceId && resourceId !== 'results') {
        query = query.eq('crawl_id', resourceId);
      }

      const { data: results, error } = await query
        .order('crawled_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching crawl results:', error);
        return createCorsResponse({ error: 'Failed to fetch crawl results' }, 500, req);
      }

      return createCorsResponse((results || []).map(toCamelShallow), 200, req);
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
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
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
          .select('keyword, current_position, previous_position, search_volume')
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

      // Calculate keyword performance
      const keywordGains =
        keywords.data?.filter(
          (k) =>
            k.current_position && k.previous_position && k.current_position < k.previous_position,
        ).length || 0;

      const keywordLosses =
        keywords.data?.filter(
          (k) =>
            k.current_position && k.previous_position && k.current_position > k.previous_position,
        ).length || 0;

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

    // ============= REGENERATE STATIC FILES (RootAdminSEO) =============
    // The actual sitemap.xml / robots.txt / llms.txt are served dynamically by
    // the SPA origin; these endpoints just acknowledge the regenerate action
    // (parity with the Express routes-seo-core.ts handlers).
    if (req.method === 'POST' && resource === 'regenerate-sitemap') {
      return createCorsResponse({ message: 'Sitemap regenerated successfully' }, 200, req);
    }
    if (req.method === 'POST' && resource === 'regenerate-robots') {
      return createCorsResponse({ message: 'Robots.txt regenerated successfully' }, 200, req);
    }
    if (req.method === 'POST' && resource === 'regenerate-llms') {
      return createCorsResponse({ message: 'LLMs.txt regenerated successfully' }, 200, req);
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

      return createCorsResponse(
        { data: (redirects || []).map(toCamelShallow), total: count },
        200,
        req,
      );
    }

    // POST /seo/redirects - Create redirect (analyze a redirect chain)
    if (req.method === 'POST' && resource === 'redirects' && !resourceId) {
      const body = await req.json();
      const sourceUrl = body.sourceUrl || body.source_url;

      if (!sourceUrl) {
        return createCorsResponse({ error: 'Source URL is required' }, 400, req);
      }

      // Create a redirect analysis entry
      const redirectData = {
        tenant_id: tenantId,
        source_url: sourceUrl,
        destination_url: body.destinationUrl || body.destination_url || sourceUrl,
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

      return createCorsResponse(toCamelShallow(redirect), 201, req);
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

    return createCorsResponse(
      {
        error: 'Invalid SEO endpoint or method',
        resource: resource || null,
        action: action || null,
      },
      404,
      req,
    );
  } catch (error) {
    console.error('Error in SEO function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

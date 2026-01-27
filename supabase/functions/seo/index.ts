// SEO Edge Function
// Handles SEO settings, pages, analytics, sitemaps, and redirects
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts[0] = 'seo', pathParts[1] = resource, pathParts[2] = id or action
    const resource = pathParts[1];
    const resourceId = pathParts[2];
    const action = pathParts[3];

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

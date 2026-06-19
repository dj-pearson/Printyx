// Social Media Edge Function
// Handles social media post generation and scheduling
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// Send a broadcast webhook (Make.com etc). fetch is available in Deno.
// Mirrors server/routes-social-media.ts sendWebhook: on success marks the
// post published/sent, on failure marks it failed.
async function sendWebhook(admin: any, webhookUrl: string, post: any, tenantId: string) {
  const payload = {
    id: post.id,
    title: post.title,
    shortContent: post.short_content,
    longContent: post.long_content,
    websiteLink: post.website_link,
    platforms: post.target_platforms,
    timestamp: new Date().toISOString(),
    generationType: post.generation_type,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
    await admin
      .from('social_media_posts')
      .update({
        webhook_status: 'sent',
        webhook_sent_at: new Date().toISOString(),
        webhook_payload: payload,
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
      .eq('tenant_id', tenantId);
    return true;
  } catch (error) {
    console.error('Webhook Error:', error);
    await admin
      .from('social_media_posts')
      .update({ webhook_status: 'failed', status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', post.id)
      .eq('tenant_id', tenantId);
    return false;
  }
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID
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
    // Coolify-safe routing: parts[0] = resource, parts[1] = id, parts[2] = action.
    const { parts } = normalizePath(url.pathname, 'social-media');
    const endpoint = parts[0];
    const postId = parts[1];
    const action = parts[2];

    // GET /social-media/posts/:id - Get single post (named/id before list)
    if (req.method === 'GET' && endpoint === 'posts' && postId) {
      const { data: post, error } = await admin
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Post not found' }, 404, req);
      }

      return createCorsResponse(post, 200, req);
    }

    // GET /social-media/posts - List social media posts
    if (req.method === 'GET' && endpoint === 'posts') {
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = admin
        .from('social_media_posts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);

      const { data: posts, error } = await query;

      if (error) {
        console.error('Error fetching social media posts:', error);
        return createCorsResponse({ error: 'Failed to fetch posts' }, 500, req);
      }

      return createCorsResponse(posts || [], 200, req);
    }

    // POST /social-media/posts/:id/broadcast - Manually broadcast post to webhook
    if (req.method === 'POST' && endpoint === 'posts' && postId && action === 'broadcast') {
      const body = await req.json().catch(() => ({}));
      const webhookUrl = body.webhookUrl || body.webhook_url;

      if (!webhookUrl) {
        return createCorsResponse({ message: 'Webhook URL required' }, 400, req);
      }

      const { data: post, error } = await admin
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !post) {
        return createCorsResponse({ message: 'Post not found' }, 404, req);
      }

      await admin
        .from('social_media_posts')
        .update({ webhook_url: webhookUrl })
        .eq('id', postId)
        .eq('tenant_id', tenantId);

      const success = await sendWebhook(
        admin,
        webhookUrl,
        { ...post, webhook_url: webhookUrl },
        tenantId,
      );

      return createCorsResponse(
        { success, message: success ? 'Post broadcasted successfully' : 'Broadcast failed' },
        200,
        req,
      );
    }

    // POST /social-media/posts/:id/publish - Publish post
    if (req.method === 'POST' && endpoint === 'posts' && postId && action === 'publish') {
      const { data: post, error } = await admin
        .from('social_media_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to publish post' }, 500, req);
      }

      return createCorsResponse(post, 200, req);
    }

    // POST /social-media/posts - Create social media post
    if (req.method === 'POST' && endpoint === 'posts' && !postId) {
      const body = await req.json();

      const postData = {
        tenant_id: tenantId,
        title: body.title,
        short_content: body.shortContent || body.short_content,
        long_content: body.longContent || body.long_content,
        target_platforms: body.targetPlatforms || body.target_platforms || ['twitter', 'linkedin'],
        website_link: body.websiteLink || body.website_link || 'https://printyx.net',
        status: body.status || 'draft',
        scheduled_for: body.scheduledAt || body.scheduled_at || body.scheduledFor || null,
        generation_type: body.generationType || body.generation_type || 'manual',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: post, error } = await admin
        .from('social_media_posts')
        .insert(postData)
        .select()
        .single();

      if (error) {
        console.error('Error creating social media post:', error);
        return createCorsResponse({ error: 'Failed to create post' }, 500, req);
      }

      return createCorsResponse(post, 201, req);
    }

    // PUT /social-media/posts/:id - Update post
    if (req.method === 'PUT' && endpoint === 'posts' && postId) {
      const body = await req.json();

      const { data: post, error } = await admin
        .from('social_media_posts')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating social media post:', error);
        return createCorsResponse({ error: 'Failed to update post' }, 500, req);
      }

      return createCorsResponse(post, 200, req);
    }

    // DELETE /social-media/posts/:id - Delete post
    if (req.method === 'DELETE' && endpoint === 'posts' && postId) {
      const { error } = await admin
        .from('social_media_posts')
        .delete()
        .eq('id', postId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete post' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Post deleted' }, 200, req);
    }

    // POST /social-media/generate - Generate content using AI (degraded: Claude is Node-only)
    if (req.method === 'POST' && endpoint === 'generate') {
      const body = await req.json();
      const { topic } = body;

      return createCorsResponse(
        {
          title: `${topic || 'Industry'} Insights`,
          shortContent: `Discover how ${topic || 'modern technology'} can transform your business. Visit https://printyx.net`,
          longContent: `Looking to improve efficiency and reduce costs? Our ${topic || 'solutions'} help businesses streamline operations and achieve their goals. Learn more at https://printyx.net`,
          generated: true,
          note: 'AI generation service integration required',
        },
        200,
        req,
      );
    }

    // ----------------------------------------------------------------
    // CRON JOBS
    // ----------------------------------------------------------------

    // POST /social-media/cron-jobs/:id/execute - Execute cron job manually
    // Real DB writes: create a draft post from the template + bump execution
    // stats + fire the webhook. Claude content generation is Node-only so the
    // post body is a degraded template placeholder.
    if (req.method === 'POST' && endpoint === 'cron-jobs' && postId && action === 'execute') {
      const cronId = postId;
      const { data: cronJob, error: jobErr } = await admin
        .from('social_media_cron_jobs')
        .select('*')
        .eq('id', cronId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (jobErr || !cronJob) {
        return createCorsResponse({ message: 'Cron job not found' }, 404, req);
      }
      if (!cronJob.is_active) {
        return createCorsResponse({ message: 'Cron job is not active' }, 400, req);
      }

      // Degraded content (Claude unavailable in Deno edge runtime).
      const template: string = cronJob.prompt_template || '';
      const generated = {
        title: 'Scheduled Industry Insights',
        shortContent: `Discover how modern technology can transform your business. Visit https://printyx.net`,
        longContent: `Looking to improve efficiency and reduce costs? Our solutions help businesses streamline operations and achieve their goals. Learn more at https://printyx.net`,
        note: 'AI generation service integration required',
      };

      const postData = {
        tenant_id: tenantId,
        generation_type: 'cron',
        status: 'generated',
        claude_prompt: template,
        title: generated.title,
        short_content: generated.shortContent,
        long_content: generated.longContent,
        website_link: 'https://printyx.net',
        target_platforms: cronJob.target_platforms,
        webhook_url: cronJob.webhook_url,
        webhook_status: cronJob.webhook_url ? 'pending' : null,
        cron_expression: cronJob.cron_expression,
        is_recurring: true,
        created_by: cronJob.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newPost, error: postErr } = await admin
        .from('social_media_posts')
        .insert(postData)
        .select()
        .single();

      if (postErr) {
        console.error('Error creating post from cron job:', postErr);
        return createCorsResponse({ message: 'Failed to execute cron job' }, 500, req);
      }

      // Fire webhook if configured.
      let webhookSuccess = true;
      if (cronJob.webhook_url) {
        webhookSuccess = await sendWebhook(admin, cronJob.webhook_url, newPost, tenantId);
      }

      // Bump execution stats.
      await admin
        .from('social_media_cron_jobs')
        .update({
          last_executed: new Date().toISOString(),
          execution_count: (cronJob.execution_count || 0) + 1,
          failure_count: webhookSuccess
            ? cronJob.failure_count || 0
            : (cronJob.failure_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cronId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          success: webhookSuccess,
          post: newPost,
          message: webhookSuccess
            ? 'Cron job executed successfully'
            : 'Cron job executed but webhook failed',
          degraded: true,
        },
        200,
        req,
      );
    }

    // GET /social-media/cron-jobs - List scheduled jobs
    if (req.method === 'GET' && endpoint === 'cron-jobs') {
      const { data: jobs, error } = await admin
        .from('social_media_cron_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cron jobs:', error);
        return createCorsResponse({ error: 'Failed to fetch cron jobs' }, 500, req);
      }

      return createCorsResponse(jobs || [], 200, req);
    }

    // POST /social-media/cron-jobs - Create cron job
    if (req.method === 'POST' && endpoint === 'cron-jobs' && !postId) {
      const body = await req.json();

      const cronJobData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        cron_expression: body.cronExpression || body.cron_expression,
        is_active: body.isActive !== undefined ? body.isActive : true,
        prompt_template: body.promptTemplate || body.prompt_template,
        target_platforms: body.targetPlatforms ||
          body.platforms ||
          body.target_platforms || ['twitter', 'linkedin'],
        webhook_url: body.webhookUrl || body.webhook_url || '',
        execution_count: 0,
        failure_count: 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: cronJob, error } = await admin
        .from('social_media_cron_jobs')
        .insert(cronJobData)
        .select()
        .single();

      if (error) {
        console.error('Error creating cron job:', error);
        return createCorsResponse({ error: 'Failed to create cron job' }, 500, req);
      }

      return createCorsResponse(cronJob, 201, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in social-media function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

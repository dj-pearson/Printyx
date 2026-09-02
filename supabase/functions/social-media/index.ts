// Social Media Edge Function
// Handles social media post generation and scheduling
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { safeFetch, SSRFError } from '../_shared/safe-fetch.ts';
import { validateUrl } from '../_shared/ssrf.ts';
import { generateCompletion } from '../_shared/anthropic.ts';

/**
 * Deliver a post to a tenant-supplied webhook (Make.com and friends).
 *
 * PA-052: mirrors sendWebhook in server/routes-social-media.ts, safeFetch and
 * all. The URL comes from the tenant, so a plain fetch() here would be an
 * arbitrary outbound request from a function holding the service-role key.
 */
async function sendWebhook(
  webhookUrl: string,
  post: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: post.id,
        title: post.title,
        shortContent: post.short_content ?? post.shortContent,
        longContent: post.long_content ?? post.longContent,
        websiteLink: post.website_link ?? post.websiteLink,
        platforms: post.target_platforms ?? post.targetPlatforms,
        timestamp: new Date().toISOString(),
        generationType: post.generation_type ?? post.generationType,
      }),
    });
    return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (err) {
    if (err instanceof SSRFError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const SOCIAL_SYSTEM_PROMPT = `You are a social media content expert specializing in B2B copier dealer marketing. 
  Generate engaging social media content that highlights the value and expertise of copier dealers.
  
  Create:
  1. A compelling title (max 60 characters)
  2. Short content for Twitter (under 200 characters including the link https://printyx.net)
  3. Long content for Facebook/LinkedIn (300-500 characters including the link https://printyx.net)
  
  Focus on: industry expertise, customer success, technology solutions, business efficiency, cost savings.
  Tone: Professional but approachable, informative, solution-focused.
  
  Always include the website link https://printyx.net naturally in the content.
  
  Respond in JSON format:
  {
    "title": "your title here",
    "shortContent": "Twitter content here",
    "longContent": "Facebook/LinkedIn content here"
  }`;

/** Generate one post from a prompt. Throws rather than inventing copy. */
async function generatePost(prompt: string) {
  const raw = await generateCompletion({
    system: SOCIAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  });

  // The model is asked for JSON; tolerate a fenced block around it.
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(json);

  if (!parsed.title || !parsed.shortContent || !parsed.longContent) {
    throw new Error('Generated content was missing title, shortContent or longContent');
  }

  return {
    title: parsed.title as string,
    shortContent: parsed.shortContent as string,
    longContent: parsed.longContent as string,
    claudeResponse: parsed,
  };
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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /social-media, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'social-media');
    const endpoint = parts[0];
    const postId = parts[1];

    // GET /social-media/posts - List social media posts
    // PA-052: `!postId` was missing, so this matched /posts/:id too and the
    // single-post branch below was unreachable.
    if (req.method === 'GET' && endpoint === 'posts' && !postId) {
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

    // GET /social-media/posts/:id - Get single post
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

    // POST /social-media/posts - Create social media post
    // PA-052: `!postId` was missing, so POST /posts/generate - which is the
    // path the page actually calls - landed HERE and wrote a post out of the
    // generate form's body instead of generating one.
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
        // The column is scheduled_for; scheduled_at does not exist, so this
        // insert was a PGRST204 and no post could be created (PA-052).
        scheduled_for: body.scheduledFor || body.scheduled_for || body.scheduledAt || null,
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

    // POST /social-media/generate - Generate content
    //
    // PA-052: this returned hand-written marketing copy - "Discover how modern
    // technology can transform your business" - with `generated: true` on it,
    // under a comment saying a real AI service would go here. Now it calls the
    // model, and a failure is a failure rather than a template.
    // The page calls /posts/generate; /generate is the older shape. Both land
    // here, and both RECORD the post - Express's /posts/generate does, and the
    // page invalidates the posts list on success expecting to see it.
    if (
      req.method === 'POST' &&
      (endpoint === 'generate' || (endpoint === 'posts' && postId === 'generate'))
    ) {
      const body = await req.json().catch(() => ({}));
      const prompt = body.prompt || body.topic;

      if (!prompt) {
        return createCorsResponse({ error: 'A prompt or topic is required' }, 400, req);
      }

      const webhookUrl = body.webhookUrl ?? body.webhook_url ?? null;
      if (webhookUrl) {
        const urlCheck = validateUrl(String(webhookUrl));
        if (!urlCheck.valid) {
          return createCorsResponse({ error: `Invalid webhook URL: ${urlCheck.reason}` }, 400, req);
        }
      }

      let generated;
      try {
        generated = await generatePost(prompt);
      } catch (err) {
        console.error('Error generating social content:', err);
        return createCorsResponse(
          {
            error: 'Failed to generate content',
            details: err instanceof Error ? err.message : String(err),
          },
          502,
          req,
        );
      }

      const { data: newPost, error: insertError } = await admin
        .from('social_media_posts')
        .insert({
          tenant_id: tenantId,
          generation_type: body.generationType ?? body.generation_type ?? 'manual',
          status: 'generated',
          claude_prompt: prompt,
          claude_response: generated.claudeResponse,
          title: generated.title,
          short_content: generated.shortContent,
          long_content: generated.longContent,
          website_link: 'https://printyx.net',
          target_platforms: body.platforms ??
            body.targetPlatforms ?? ['twitter', 'facebook', 'linkedin'],
          webhook_url: webhookUrl,
          webhook_status: webhookUrl ? 'pending' : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error recording generated post:', insertError);
        return createCorsResponse({ error: 'Failed to record generated post' }, 500, req);
      }

      if (webhookUrl) {
        const delivery = await sendWebhook(webhookUrl, newPost);
        await admin
          .from('social_media_posts')
          .update({
            webhook_status: delivery.success ? 'sent' : 'failed',
            webhook_sent_at: delivery.success ? new Date().toISOString() : null,
          })
          .eq('id', newPost.id)
          .eq('tenant_id', tenantId);
      }

      return createCorsResponse(newPost, 201, req);
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

    // POST /social-media/posts/:id/publish - Publish post
    if (req.method === 'POST' && endpoint === 'posts' && postId && parts[2] === 'publish') {
      // social_media_posts has no published_at, so this update 42703'd and no
      // post could be published. The table's only send timestamp is
      // webhook_sent_at, which belongs to the webhook delivery path — this
      // endpoint sends nothing, so setting it would be a lie. status and
      // updated_at are real and carry the state change.
      const { data: post, error } = await admin
        .from('social_media_posts')
        .update({
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to publish post' }, 500, req);
      }

      return createCorsResponse(
        {
          ...post,
          unpersisted: [
            'publishedAt: social_media_posts has no published_at column (webhook_sent_at ' +
              'belongs to the webhook delivery path, which this endpoint does not use)',
          ],
        },
        200,
        req,
      );
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

    // GET /social-media/cron-jobs - List scheduled jobs
    if (req.method === 'GET' && endpoint === 'cron-jobs') {
      const { data: jobs } = await admin
        .from('social_media_cron_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        // The column is next_execution; next_run_at does not exist, so the
        // scheduled-jobs list 42703'd.
        .order('next_execution', { ascending: true });

      return createCorsResponse(jobs || [], 200, req);
    }

    // POST /social-media/posts/:id/broadcast - Deliver a post to its webhook
    //
    // PA-052: the page has always called this and there was no branch, so it
    // 404'd in production while Express served it. Note the verb: the existing
    // /publish branch only moves `status`, it sends nothing.
    if (req.method === 'POST' && endpoint === 'posts' && postId && parts[2] === 'broadcast') {
      const body = await req.json().catch(() => ({}));
      const webhookUrl = body.webhookUrl ?? body.webhook_url;

      if (!webhookUrl) {
        return createCorsResponse({ error: 'Webhook URL required' }, 400, req);
      }

      const { data: post, error: findError } = await admin
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (findError) {
        console.error('Error loading post for broadcast:', findError);
        return createCorsResponse({ error: 'Failed to load post' }, 500, req);
      }

      if (!post) {
        return createCorsResponse({ error: 'Post not found' }, 404, req);
      }

      const result = await sendWebhook(webhookUrl, post);

      // webhook_status and webhook_sent_at are real columns and this path is
      // the one that earns them, unlike /publish.
      await admin
        .from('social_media_posts')
        .update({
          webhook_url: webhookUrl,
          webhook_status: result.success ? 'sent' : 'failed',
          webhook_sent_at: result.success ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          success: result.success,
          message: result.success ? 'Post broadcasted successfully' : 'Broadcast failed',
          error: result.error ?? null,
        },
        200,
        req,
      );
    }

    // POST /social-media/cron-jobs - Create a scheduled job
    if (req.method === 'POST' && endpoint === 'cron-jobs' && !postId) {
      const body = await req.json().catch(() => ({}));

      // name, cron_expression, prompt_template, target_platforms and webhook_url
      // are all NOT NULL; naming them beats an unreadable 23502.
      const row = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description ?? null,
        cron_expression: body.cronExpression ?? body.cron_expression,
        prompt_template: body.promptTemplate ?? body.prompt_template,
        target_platforms: body.targetPlatforms ?? body.target_platforms,
        webhook_url: body.webhookUrl ?? body.webhook_url,
        is_active: body.isActive ?? body.is_active ?? true,
        created_by: user.id,
      };

      const missing = [
        'name',
        'cron_expression',
        'prompt_template',
        'target_platforms',
        'webhook_url',
      ].filter(
        (k) => row[k as keyof typeof row] === undefined || row[k as keyof typeof row] === null,
      );
      if (missing.length) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}` },
          400,
          req,
        );
      }

      // The job posts to this URL on every run, so refuse an unsafe one at
      // creation rather than at 3am.
      const urlCheck = validateUrl(String(row.webhook_url));
      if (!urlCheck.valid) {
        return createCorsResponse({ error: `Invalid webhook URL: ${urlCheck.reason}` }, 400, req);
      }

      const { data: job, error } = await admin
        .from('social_media_cron_jobs')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('Error creating cron job:', error);
        return createCorsResponse({ error: 'Failed to create cron job' }, 500, req);
      }

      return createCorsResponse(job, 201, req);
    }

    // PUT /social-media/cron-jobs/:id - Update a scheduled job
    if (req.method === 'PUT' && endpoint === 'cron-jobs' && postId) {
      const body = await req.json().catch(() => ({}));

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        cronExpression: 'cron_expression',
        promptTemplate: 'prompt_template',
        targetPlatforms: 'target_platforms',
        webhookUrl: 'webhook_url',
        isActive: 'is_active',
      };
      for (const [camel, snake] of Object.entries(fieldMap)) {
        if (body[camel] !== undefined) update[snake] = body[camel];
        else if (body[snake] !== undefined) update[snake] = body[snake];
      }

      if (update.webhook_url !== undefined) {
        const urlCheck = validateUrl(String(update.webhook_url));
        if (!urlCheck.valid) {
          return createCorsResponse({ error: `Invalid webhook URL: ${urlCheck.reason}` }, 400, req);
        }
      }

      const { data: job, error } = await admin
        .from('social_media_cron_jobs')
        .update(update)
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating cron job:', error);
        return createCorsResponse({ error: 'Failed to update cron job' }, 500, req);
      }

      if (!job) return createCorsResponse({ error: 'Cron job not found' }, 404, req);

      return createCorsResponse(job, 200, req);
    }

    // DELETE /social-media/cron-jobs/:id
    if (req.method === 'DELETE' && endpoint === 'cron-jobs' && postId) {
      const { error } = await admin
        .from('social_media_cron_jobs')
        .delete()
        .eq('id', postId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting cron job:', error);
        return createCorsResponse({ error: 'Failed to delete cron job' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Cron job deleted' }, 200, req);
    }

    // POST /social-media/cron-jobs/:id/execute - Run a scheduled job now
    //
    // PA-052: no branch existed, so Run Now 404'd in production. Generates from
    // the job's template, records the post, delivers it, and counts the run.
    if (req.method === 'POST' && endpoint === 'cron-jobs' && postId && parts[2] === 'execute') {
      const { data: job, error: findError } = await admin
        .from('social_media_cron_jobs')
        .select('*')
        .eq('id', postId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (findError) {
        console.error('Error loading cron job:', findError);
        return createCorsResponse({ error: 'Failed to load cron job' }, 500, req);
      }

      if (!job) return createCorsResponse({ error: 'Cron job not found' }, 404, req);
      if (!job.is_active) {
        return createCorsResponse({ error: 'Cron job is not active' }, 400, req);
      }

      let generated;
      try {
        generated = await generatePost(job.prompt_template);
      } catch (err) {
        // A generation failure counts as a failed run. Recording it is the point
        // of failure_count; leaving the counters untouched would hide it.
        await admin
          .from('social_media_cron_jobs')
          .update({
            last_executed: new Date().toISOString(),
            execution_count: (job.execution_count ?? 0) + 1,
            failure_count: (job.failure_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId)
          .eq('tenant_id', tenantId);

        console.error('Error generating content for cron job:', err);
        return createCorsResponse(
          {
            error: 'Failed to generate content',
            details: err instanceof Error ? err.message : String(err),
          },
          502,
          req,
        );
      }

      const { data: newPost, error: insertError } = await admin
        .from('social_media_posts')
        .insert({
          tenant_id: tenantId,
          generation_type: 'cron',
          status: 'generated',
          claude_prompt: job.prompt_template,
          claude_response: generated.claudeResponse,
          title: generated.title,
          short_content: generated.shortContent,
          long_content: generated.longContent,
          website_link: 'https://printyx.net',
          target_platforms: job.target_platforms,
          webhook_url: job.webhook_url,
          webhook_status: 'pending',
          cron_expression: job.cron_expression,
          is_recurring: true,
          created_by: job.created_by,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error recording generated post:', insertError);
        return createCorsResponse({ error: 'Failed to record generated post' }, 500, req);
      }

      const delivery = await sendWebhook(job.webhook_url, newPost);

      await admin
        .from('social_media_posts')
        .update({
          webhook_status: delivery.success ? 'sent' : 'failed',
          webhook_sent_at: delivery.success ? new Date().toISOString() : null,
        })
        .eq('id', newPost.id)
        .eq('tenant_id', tenantId);

      await admin
        .from('social_media_cron_jobs')
        .update({
          last_executed: new Date().toISOString(),
          execution_count: (job.execution_count ?? 0) + 1,
          failure_count: delivery.success ? (job.failure_count ?? 0) : (job.failure_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        {
          success: delivery.success,
          post: newPost,
          webhookError: delivery.error ?? null,
          message: delivery.success
            ? 'Cron job executed and post broadcast'
            : 'Post generated, but the webhook delivery failed',
        },
        200,
        req,
      );
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

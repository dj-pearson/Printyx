// Social Media Edge Function
// Handles social media post generation and scheduling
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    if (req.method === 'POST' && endpoint === 'posts') {
      const body = await req.json();

      const postData = {
        tenant_id: tenantId,
        title: body.title,
        short_content: body.shortContent || body.short_content,
        long_content: body.longContent || body.long_content,
        target_platforms: body.targetPlatforms || body.target_platforms || ['twitter', 'linkedin'],
        website_link: body.websiteLink || body.website_link || 'https://printyx.net',
        status: body.status || 'draft',
        scheduled_at: body.scheduledAt || body.scheduled_at,
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

    // POST /social-media/generate - Generate content using AI (placeholder)
    if (req.method === 'POST' && endpoint === 'generate') {
      const body = await req.json();
      const { prompt, topic } = body;

      // Placeholder for AI content generation
      // In production, this would call an AI service
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

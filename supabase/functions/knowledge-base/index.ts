// Knowledge Base Edge Function
// Handles knowledge base article and category management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { handleBookmarks } from './handlers/bookmarks.ts';
import { handleRatings } from './handlers/ratings.ts';
import { handleReadingHistory } from './handlers/reading-history.ts';
import { generateRequestId } from '../_shared/http.ts';
import { normalizePath } from '../_shared/path.ts';

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200);
}

// Helper to check if user has admin role (role level >= 6)
async function isAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data: user } = await admin
    .from('users')
    .select('role_id, roles(level)')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .single();

  return user?.roles?.level >= 6;
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'knowledge-base');
    // parts: [...rest after function-name strip]
    const resource = parts[0]; // Could be 'categories', 'popular', 'search', or article ID
    const subResource = parts[1]; // Could be 'rate' for articles or category ID

    // ─── Engagement dispatch (Phase 6 US-025) ────────────────────────────────
    // Routes /bookmarks, /ratings, /votes, /reading-history to their handlers.
    const engagementParts = parts;
    const engagementFirst = engagementParts[0];
    if (
      engagementFirst === 'bookmarks' ||
      engagementFirst === 'ratings' ||
      engagementFirst === 'votes' ||
      engagementFirst === 'reading-history'
    ) {
      const requestId = generateRequestId();
      const engagementCtx = {
        tenantId,
        userId: user.id,
        db: admin,
        requestId,
        pathParts: engagementParts,
        method: req.method.toUpperCase(),
        url,
      };

      let engagementResult: Response | null = null;
      if (engagementFirst === 'bookmarks') {
        engagementResult = await handleBookmarks(req, engagementCtx);
      } else if (engagementFirst === 'ratings' || engagementFirst === 'votes') {
        engagementResult = await handleRatings(req, engagementCtx);
      } else if (engagementFirst === 'reading-history') {
        engagementResult = await handleReadingHistory(req, engagementCtx);
      }

      if (engagementResult) return engagementResult;
      return createCorsResponse({ error: 'Engagement endpoint not found' }, 404, req);
    }

    // ==================== CATEGORIES ENDPOINTS ====================

    // GET /knowledge-base/categories - List all categories
    if (req.method === 'GET' && resource === 'categories' && !subResource) {
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const parentId = url.searchParams.get('parentId') || url.searchParams.get('parent_id');

      let query = admin
        .from('knowledge_categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('category_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (parentId) {
        query = query.eq('parent_category_id', parentId);
      } else if (url.searchParams.has('rootOnly')) {
        query = query.is('parent_category_id', null);
      }

      const { data: categories, error } = await query;

      if (error) {
        console.error('Error fetching categories:', error);
        return createCorsResponse({ error: 'Failed to fetch categories' }, 500, req);
      }

      return createCorsResponse(categories || [], 200, req);
    }

    // POST /knowledge-base/categories - Create category (admin only)
    if (req.method === 'POST' && resource === 'categories' && !subResource) {
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      const body = await req.json();

      const slug = body.slug || generateSlug(body.name);

      // Check for duplicate slug
      const { data: existing } = await admin
        .from('knowledge_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', slug)
        .single();

      if (existing) {
        return createCorsResponse({ error: 'Category with this slug already exists' }, 409, req);
      }

      const categoryData = {
        tenant_id: tenantId,
        name: body.name,
        slug,
        description: body.description || null,
        icon: body.icon || null,
        parent_category_id: body.parentCategoryId || body.parent_category_id || null,
        category_order: body.categoryOrder || body.category_order || 0,
        category_level: body.categoryLevel || body.category_level || 0,
        is_public:
          body.isPublic !== undefined
            ? body.isPublic
            : body.is_public !== undefined
              ? body.is_public
              : true,
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: category, error } = await admin
        .from('knowledge_categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) {
        console.error('Error creating category:', error);
        return createCorsResponse({ error: 'Failed to create category', details: error }, 500, req);
      }

      return createCorsResponse(category, 201, req);
    }

    // PUT/PATCH /knowledge-base/categories/:id - Update category
    if (
      (req.method === 'PUT' || req.method === 'PATCH') &&
      resource === 'categories' &&
      subResource
    ) {
      const categoryId = subResource;
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.parentCategoryId !== undefined || body.parent_category_id !== undefined) {
        updateData.parent_category_id = body.parentCategoryId || body.parent_category_id;
      }
      if (body.categoryOrder !== undefined || body.category_order !== undefined) {
        updateData.category_order = body.categoryOrder ?? body.category_order;
      }
      if (body.categoryLevel !== undefined || body.category_level !== undefined) {
        updateData.category_level = body.categoryLevel ?? body.category_level;
      }
      if (body.isPublic !== undefined || body.is_public !== undefined) {
        updateData.is_public = body.isPublic ?? body.is_public;
      }
      if (body.isActive !== undefined || body.is_active !== undefined) {
        updateData.is_active = body.isActive ?? body.is_active;
      }

      const { data: category, error } = await admin
        .from('knowledge_categories')
        .update(updateData)
        .eq('id', categoryId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating category:', error);
        return createCorsResponse({ error: 'Failed to update category' }, 500, req);
      }

      return createCorsResponse(category, 200, req);
    }

    // DELETE /knowledge-base/categories/:id - Delete category
    if (req.method === 'DELETE' && resource === 'categories' && subResource) {
      const categoryId = subResource;
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      // Check if category has articles
      const { data: articles } = await admin
        .from('knowledge_articles')
        .select('id')
        .eq('category_id', categoryId)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (articles && articles.length > 0) {
        return createCorsResponse(
          { error: 'Cannot delete category with articles. Please move or delete articles first.' },
          400,
          req,
        );
      }

      // Check if category has subcategories
      const { data: subcategories } = await admin
        .from('knowledge_categories')
        .select('id')
        .eq('parent_category_id', categoryId)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (subcategories && subcategories.length > 0) {
        return createCorsResponse(
          {
            error: 'Cannot delete category with subcategories. Please delete subcategories first.',
          },
          400,
          req,
        );
      }

      const { error } = await admin
        .from('knowledge_categories')
        .delete()
        .eq('id', categoryId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting category:', error);
        return createCorsResponse({ error: 'Failed to delete category' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Category deleted' }, 200, req);
    }

    // ==================== POPULAR ARTICLES ENDPOINT ====================

    // GET /knowledge-base/popular - Get most viewed articles
    if (req.method === 'GET' && resource === 'popular') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category_id');

      let query = admin
        .from('knowledge_articles')
        .select(
          `
          id, title, slug, excerpt, view_count, helpful_votes, unhelpful_votes,
          category:knowledge_categories(id, name, slug),
          content_type, difficulty_level, estimated_reading_time, featured_image,
          published_at
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .eq('is_public', true)
        .order('view_count', { ascending: false })
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data: articles, error } = await query;

      if (error) {
        console.error('Error fetching popular articles:', error);
        return createCorsResponse({ error: 'Failed to fetch popular articles' }, 500, req);
      }

      return createCorsResponse(articles || [], 200, req);
    }

    // ==================== SEARCH ENDPOINT ====================

    // GET /knowledge-base/search - Full-text search
    if (req.method === 'GET' && resource === 'search') {
      const query = url.searchParams.get('q') || url.searchParams.get('query') || '';
      const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category_id');
      const contentType =
        url.searchParams.get('contentType') || url.searchParams.get('content_type');
      const difficultyLevel =
        url.searchParams.get('difficultyLevel') || url.searchParams.get('difficulty_level');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      if (!query) {
        return createCorsResponse({ error: 'Search query is required' }, 400, req);
      }

      let searchQuery = admin
        .from('knowledge_articles')
        .select(
          `
          id, title, slug, excerpt, view_count, helpful_votes, unhelpful_votes, tags,
          category:knowledge_categories(id, name, slug),
          content_type, difficulty_level, estimated_reading_time, featured_image,
          published_at, average_rating
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .eq('is_public', true)
        .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,plain_text_content.ilike.%${query}%`)
        .order('view_count', { ascending: false })
        .range(offset, offset + limit - 1);

      if (categoryId) {
        searchQuery = searchQuery.eq('category_id', categoryId);
      }

      if (contentType) {
        searchQuery = searchQuery.eq('content_type', contentType);
      }

      if (difficultyLevel) {
        searchQuery = searchQuery.eq('difficulty_level', difficultyLevel);
      }

      const { data: articles, error, count } = await searchQuery;

      if (error) {
        console.error('Error searching articles:', error);
        return createCorsResponse({ error: 'Failed to search articles' }, 500, req);
      }

      // Log search query for analytics
      await admin.from('knowledge_search_queries').insert({
        tenant_id: tenantId,
        query_text: query,
        user_id: user.id,
        results_count: count || 0,
        top_result_ids: (articles || []).slice(0, 5).map((a: any) => a.id),
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          data: articles || [],
          total: count || 0,
          page,
          limit,
          query,
        },
        200,
        req,
      );
    }

    // ==================== ARTICLE ENDPOINTS ====================

    // GET /knowledge-base - List articles with filters
    if (req.method === 'GET' && !resource) {
      const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category_id');
      const status = url.searchParams.get('status');
      const contentType =
        url.searchParams.get('contentType') || url.searchParams.get('content_type');
      const difficultyLevel =
        url.searchParams.get('difficultyLevel') || url.searchParams.get('difficulty_level');
      const featured = url.searchParams.get('featured');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;
      const sortBy =
        url.searchParams.get('sortBy') || url.searchParams.get('sort_by') || 'published_at';
      const sortOrder =
        url.searchParams.get('sortOrder') || url.searchParams.get('sort_order') || 'desc';

      let query = admin
        .from('knowledge_articles')
        .select(
          `
          id, title, slug, excerpt, view_count, helpful_votes, unhelpful_votes, tags,
          category:knowledge_categories(id, name, slug),
          content_type, difficulty_level, estimated_reading_time, featured_image, featured,
          status, published_at, created_at, updated_at, average_rating,
          author:users!knowledge_articles_created_by_fkey(id, first_name, last_name)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId);

      // Default to only showing published articles unless status filter is specified
      if (status) {
        query = query.eq('status', status);
      } else {
        query = query.eq('status', 'published');
      }

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (difficultyLevel) {
        query = query.eq('difficulty_level', difficultyLevel);
      }

      if (featured === 'true') {
        query = query.eq('featured', true);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      // Apply sorting
      const validSortColumns = [
        'published_at',
        'created_at',
        'updated_at',
        'view_count',
        'title',
        'helpful_votes',
      ];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'published_at';
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      query = query.range(offset, offset + limit - 1);

      const { data: articles, error, count } = await query;

      if (error) {
        console.error('Error fetching articles:', error);
        return createCorsResponse({ error: 'Failed to fetch articles' }, 500, req);
      }

      return createCorsResponse(
        {
          data: articles || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /knowledge-base/:id - Get single article (increment view count)
    if (
      req.method === 'GET' &&
      resource &&
      resource !== 'categories' &&
      resource !== 'popular' &&
      resource !== 'search' &&
      !subResource
    ) {
      const articleId = resource;

      // Check if it's a UUID or slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        articleId,
      );

      let articleQuery = admin
        .from('knowledge_articles')
        .select(
          `
          *,
          category:knowledge_categories(id, name, slug, description, icon),
          author:users!knowledge_articles_created_by_fkey(id, first_name, last_name, email)
        `,
        )
        .eq('tenant_id', tenantId);

      if (isUuid) {
        articleQuery = articleQuery.eq('id', articleId);
      } else {
        articleQuery = articleQuery.eq('slug', articleId);
      }

      const { data: article, error } = await articleQuery.single();

      if (error || !article) {
        console.error('Error fetching article:', error);
        return createCorsResponse({ error: 'Article not found' }, 404, req);
      }

      // Increment view count
      await admin
        .from('knowledge_articles')
        .update({
          view_count: (article.view_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id)
        .eq('tenant_id', tenantId);

      // Log view for analytics
      const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
      await admin.from('article_views').insert({
        tenant_id: tenantId,
        article_id: article.id,
        user_id: user.id,
        session_id: sessionId,
        viewed_at: new Date().toISOString(),
        referrer: req.headers.get('referer') || null,
        device_type: req.headers.get('x-device-type') || null,
        created_at: new Date().toISOString(),
      });

      // Get related articles
      const relatedIds = article.related_articles || [];
      let relatedArticles: any[] = [];
      if (relatedIds.length > 0) {
        const { data: related } = await admin
          .from('knowledge_articles')
          .select('id, title, slug, excerpt, featured_image')
          .in('id', relatedIds)
          .eq('tenant_id', tenantId)
          .eq('status', 'published')
          .limit(5);
        relatedArticles = related || [];
      }

      return createCorsResponse(
        {
          ...article,
          view_count: (article.view_count || 0) + 1,
          relatedArticles,
        },
        200,
        req,
      );
    }

    // POST /knowledge-base - Create article (admin only)
    if (req.method === 'POST' && !resource) {
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      const body = await req.json();

      const slug = body.slug || generateSlug(body.title);

      // Check for duplicate slug
      const { data: existing } = await admin
        .from('knowledge_articles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', slug)
        .single();

      if (existing) {
        return createCorsResponse({ error: 'Article with this slug already exists' }, 409, req);
      }

      // Calculate word count and reading time
      const plainText = body.plainTextContent || body.plain_text_content || '';
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;
      const readingTime = Math.ceil(wordCount / 200); // ~200 words per minute

      const articleData = {
        tenant_id: tenantId,
        title: body.title,
        slug,
        excerpt: body.excerpt || null,
        content: body.content || {},
        plain_text_content: plainText || null,
        html_content: body.htmlContent || body.html_content || null,
        category_id: body.categoryId || body.category_id,
        subcategory: body.subcategory || null,
        content_type: body.contentType || body.content_type || 'tutorial',
        difficulty_level: body.difficultyLevel || body.difficulty_level || 'beginner',
        status: body.status || 'draft',
        version: 1,
        ai_generated: body.aiGenerated || body.ai_generated || false,
        meta_title: body.metaTitle || body.meta_title || null,
        meta_description: body.metaDescription || body.meta_description || null,
        keywords: body.keywords || [],
        tags: body.tags || [],
        word_count: wordCount,
        estimated_reading_time: readingTime,
        related_articles: body.relatedArticles || body.related_articles || [],
        prerequisites: body.prerequisites || [],
        featured_image: body.featuredImage || body.featured_image || null,
        media_attachments: body.mediaAttachments || body.media_attachments || [],
        featured: body.featured || false,
        is_public:
          body.isPublic !== undefined
            ? body.isPublic
            : body.is_public !== undefined
              ? body.is_public
              : true,
        allow_comments:
          body.allowComments !== undefined
            ? body.allowComments
            : body.allow_comments !== undefined
              ? body.allow_comments
              : true,
        allow_feedback:
          body.allowFeedback !== undefined
            ? body.allowFeedback
            : body.allow_feedback !== undefined
              ? body.allow_feedback
              : true,
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: body.status === 'published' ? new Date().toISOString() : null,
      };

      const { data: article, error } = await admin
        .from('knowledge_articles')
        .insert(articleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating article:', error);
        return createCorsResponse({ error: 'Failed to create article', details: error }, 500, req);
      }

      // Update category article count
      await admin
        .from('knowledge_categories')
        .update({
          article_count: admin.raw('article_count + 1'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', articleData.category_id)
        .eq('tenant_id', tenantId);

      return createCorsResponse(article, 201, req);
    }

    // PUT/PATCH /knowledge-base/:id - Update article
    if (
      (req.method === 'PUT' || req.method === 'PATCH') &&
      resource &&
      resource !== 'categories' &&
      resource !== 'popular' &&
      resource !== 'search' &&
      !subResource
    ) {
      const articleId = resource;
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      const body = await req.json();

      // Get current article for version tracking
      const { data: currentArticle } = await admin
        .from('knowledge_articles')
        .select('*')
        .eq('id', articleId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentArticle) {
        return createCorsResponse({ error: 'Article not found' }, 404, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      // Map all possible fields
      const fieldMap: Record<string, string> = {
        title: 'title',
        slug: 'slug',
        excerpt: 'excerpt',
        content: 'content',
        plainTextContent: 'plain_text_content',
        htmlContent: 'html_content',
        categoryId: 'category_id',
        subcategory: 'subcategory',
        contentType: 'content_type',
        difficultyLevel: 'difficulty_level',
        status: 'status',
        metaTitle: 'meta_title',
        metaDescription: 'meta_description',
        keywords: 'keywords',
        tags: 'tags',
        relatedArticles: 'related_articles',
        prerequisites: 'prerequisites',
        featuredImage: 'featured_image',
        mediaAttachments: 'media_attachments',
        featured: 'featured',
        isPublic: 'is_public',
        allowComments: 'allow_comments',
        allowFeedback: 'allow_feedback',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      // Update word count and reading time if content changed
      if (updateData.plain_text_content) {
        const wordCount = updateData.plain_text_content.split(/\s+/).filter(Boolean).length;
        updateData.word_count = wordCount;
        updateData.estimated_reading_time = Math.ceil(wordCount / 200);
      }

      // Handle status change to published
      if (updateData.status === 'published' && currentArticle.status !== 'published') {
        updateData.published_at = new Date().toISOString();
        updateData.published_version = (currentArticle.version || 0) + 1;
      }

      // Increment version if content changed
      if (updateData.content || updateData.title) {
        updateData.version = (currentArticle.version || 0) + 1;

        // Create version history entry
        await admin.from('article_versions').insert({
          tenant_id: tenantId,
          article_id: articleId,
          version: currentArticle.version || 1,
          title: currentArticle.title,
          content: currentArticle.content,
          plain_text_content: currentArticle.plain_text_content,
          change_description:
            body.changeDescription || body.change_description || 'Updated article',
          change_type: body.changeType || body.change_type || 'minor',
          created_by: user.id,
          created_at: new Date().toISOString(),
        });
      }

      const { data: article, error } = await admin
        .from('knowledge_articles')
        .update(updateData)
        .eq('id', articleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating article:', error);
        return createCorsResponse({ error: 'Failed to update article' }, 500, req);
      }

      return createCorsResponse(article, 200, req);
    }

    // DELETE /knowledge-base/:id - Delete article
    if (
      req.method === 'DELETE' &&
      resource &&
      resource !== 'categories' &&
      resource !== 'popular' &&
      resource !== 'search' &&
      !subResource
    ) {
      const articleId = resource;
      const userIsAdmin = await isAdmin(admin, user.id, tenantId);
      if (!userIsAdmin) {
        return createCorsResponse({ error: 'Admin access required' }, 403, req);
      }

      // Get article to update category count
      const { data: article } = await admin
        .from('knowledge_articles')
        .select('category_id')
        .eq('id', articleId)
        .eq('tenant_id', tenantId)
        .single();

      if (!article) {
        return createCorsResponse({ error: 'Article not found' }, 404, req);
      }

      // Delete related data
      await Promise.all([
        admin.from('article_views').delete().eq('article_id', articleId).eq('tenant_id', tenantId),
        admin
          .from('article_feedback')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
        admin
          .from('article_versions')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
        admin
          .from('article_bookmarks')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
        admin
          .from('reading_history')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
        admin
          .from('article_ratings')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
        admin.from('article_votes').delete().eq('article_id', articleId).eq('tenant_id', tenantId),
        admin
          .from('article_embeddings')
          .delete()
          .eq('article_id', articleId)
          .eq('tenant_id', tenantId),
      ]);

      // Delete article
      const { error } = await admin
        .from('knowledge_articles')
        .delete()
        .eq('id', articleId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting article:', error);
        return createCorsResponse({ error: 'Failed to delete article' }, 500, req);
      }

      // Update category article count
      await admin
        .from('knowledge_categories')
        .update({
          article_count: admin.raw('GREATEST(article_count - 1, 0)'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.category_id)
        .eq('tenant_id', tenantId);

      return createCorsResponse({ success: true, message: 'Article deleted' }, 200, req);
    }

    // POST /knowledge-base/:id/rate - Rate an article (helpful/not helpful)
    if (req.method === 'POST' && resource && subResource === 'rate') {
      const articleId = resource;
      const body = await req.json();

      const voteType = body.voteType || body.vote_type || body.type;
      if (!voteType || !['helpful', 'not_helpful', 'outdated', 'inaccurate'].includes(voteType)) {
        return createCorsResponse(
          { error: 'Invalid vote type. Must be: helpful, not_helpful, outdated, or inaccurate' },
          400,
          req,
        );
      }

      // Check if article exists
      const { data: article } = await admin
        .from('knowledge_articles')
        .select('id, helpful_votes, unhelpful_votes')
        .eq('id', articleId)
        .eq('tenant_id', tenantId)
        .single();

      if (!article) {
        return createCorsResponse({ error: 'Article not found' }, 404, req);
      }

      // Check if user already voted
      const { data: existingVote } = await admin
        .from('article_votes')
        .select('id, vote_type')
        .eq('article_id', articleId)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        // Update existing vote
        const { error: voteError } = await admin
          .from('article_votes')
          .update({
            vote_type: voteType,
            comment: body.comment || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingVote.id);

        if (voteError) {
          console.error('Error updating vote:', voteError);
          return createCorsResponse({ error: 'Failed to update vote' }, 500, req);
        }

        // Update article vote counts
        const helpfulDelta =
          voteType === 'helpful' ? 1 : existingVote.vote_type === 'helpful' ? -1 : 0;
        const unhelpfulDelta =
          voteType === 'not_helpful' ? 1 : existingVote.vote_type === 'not_helpful' ? -1 : 0;

        if (helpfulDelta !== 0 || unhelpfulDelta !== 0) {
          await admin
            .from('knowledge_articles')
            .update({
              helpful_votes: (article.helpful_votes || 0) + helpfulDelta,
              unhelpful_votes: (article.unhelpful_votes || 0) + unhelpfulDelta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', articleId)
            .eq('tenant_id', tenantId);
        }

        return createCorsResponse({ success: true, message: 'Vote updated', voteType }, 200, req);
      }

      // Create new vote
      const { error: voteError } = await admin.from('article_votes').insert({
        tenant_id: tenantId,
        article_id: articleId,
        user_id: user.id,
        vote_type: voteType,
        comment: body.comment || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (voteError) {
        console.error('Error creating vote:', voteError);
        return createCorsResponse({ error: 'Failed to create vote' }, 500, req);
      }

      // Update article vote counts
      const updateField =
        voteType === 'helpful'
          ? 'helpful_votes'
          : voteType === 'not_helpful'
            ? 'unhelpful_votes'
            : null;
      if (updateField) {
        await admin
          .from('knowledge_articles')
          .update({
            [updateField]: ((article[updateField as keyof typeof article] as number) || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', articleId)
          .eq('tenant_id', tenantId);
      }

      // Also log to article_views if this was a helpfulness vote
      if (voteType === 'helpful' || voteType === 'not_helpful') {
        await admin
          .from('article_views')
          .update({
            was_helpful: voteType === 'helpful',
          })
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(1);
      }

      return createCorsResponse({ success: true, message: 'Vote recorded', voteType }, 201, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in knowledge-base function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// Article bookmarks — /knowledge-base/bookmarks[/:id|/collections|/check/:articleId]
// Replaces server/routes/article-bookmarks-routes.ts (6 endpoints).
//
// Scoped by (tenant_id, user_id). The article_bookmarks table has a UNIQUE
// (user_id, article_id) constraint, so duplicate POSTs return 409.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { SupabaseClient } from '../../_shared/db.ts';

export interface EngagementCtx {
  tenantId: string;
  userId: string;
  db: SupabaseClient;
  requestId: string;
  pathParts: string[];
  method: string;
  url: URL;
}

export async function handleBookmarks(req: Request, ctx: EngagementCtx): Promise<Response | null> {
  const { method, tenantId, userId, db, requestId, pathParts, url } = ctx;
  // pathParts: ['bookmarks', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  // GET /bookmarks/collections — list distinct collection names with counts
  if (method === 'GET' && sub === 'collections') {
    const { data, error } = await db
      .from('article_bookmarks')
      .select('collection_name')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .not('collection_name', 'is', null);

    if (error) {
      return errorResponse(500, 'Failed to fetch collections', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const name = row.collection_name as string | null;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const collections = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return jsonResponse({ success: true, collections }, 200, req, requestId);
  }

  // GET /bookmarks/check/:articleId — is-bookmarked check
  if (method === 'GET' && sub === 'check' && sub2) {
    const { data, error } = await db
      .from('article_bookmarks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('article_id', sub2)
      .maybeSingle();

    if (error) {
      return errorResponse(500, 'Failed to check bookmark', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, bookmarked: !!data, bookmark: data ?? null },
      200,
      req,
      requestId,
    );
  }

  // GET /bookmarks — list user's bookmarks (optionally filtered by collection)
  if (method === 'GET' && !sub) {
    const collection = url.searchParams.get('collection');
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

    let query = db
      .from('article_bookmarks')
      .select(
        '*, article:article_id (id, title, slug, excerpt, category_id, estimated_reading_time, featured_image)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (collection) query = query.eq('collection_name', collection);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(500, 'Failed to fetch bookmarks', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      {
        success: true,
        bookmarks: data ?? [],
        total: count ?? data?.length ?? 0,
        limit,
        offset,
      },
      200,
      req,
      requestId,
    );
  }

  // POST /bookmarks — create
  if (method === 'POST' && !sub) {
    let body: {
      articleId?: string;
      notes?: string | null;
      tags?: string[];
      collectionName?: string | null;
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.articleId) {
      return errorResponse(400, 'Article ID is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    // Duplicate check to preserve Express 409 response shape.
    const { data: existing } = await db
      .from('article_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', body.articleId)
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        { success: false, message: 'Bookmark already exists', bookmark: existing },
        409,
        req,
        requestId,
      );
    }

    const { data, error } = await db
      .from('article_bookmarks')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        article_id: body.articleId,
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        collection_name: body.collectionName ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create bookmark', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, message: 'Bookmark created successfully', bookmark: data },
      201,
      req,
      requestId,
    );
  }

  // PUT /bookmarks/:id — update notes/tags/collection
  if (method === 'PUT' && sub && !sub2) {
    let body: { notes?: string; tags?: string[]; collectionName?: string | null } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.collectionName !== undefined) updates.collection_name = body.collectionName;

    const { data, error } = await db
      .from('article_bookmarks')
      .update(updates)
      .eq('id', sub)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      // PostgREST returns 'PGRST116' when no row matched (treated as 404).
      if ((error as { code?: string }).code === 'PGRST116') {
        return jsonResponse({ success: false, message: 'Bookmark not found' }, 404, req, requestId);
      }
      return errorResponse(500, 'Failed to update bookmark', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, message: 'Bookmark updated successfully', bookmark: data },
      200,
      req,
      requestId,
    );
  }

  // DELETE /bookmarks/:id
  if (method === 'DELETE' && sub && !sub2) {
    const { data: existing } = await db
      .from('article_bookmarks')
      .select('id')
      .eq('id', sub)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return jsonResponse({ success: false, message: 'Bookmark not found' }, 404, req, requestId);
    }

    const { error } = await db.from('article_bookmarks').delete().eq('id', sub);

    if (error) {
      return errorResponse(500, 'Failed to delete bookmark', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      { success: true, message: 'Bookmark removed successfully' },
      200,
      req,
      requestId,
    );
  }

  return null;
}

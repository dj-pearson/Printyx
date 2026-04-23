// Task comments.
//
// Paths (dispatcher passes full pathParts):
//   GET    /:taskId/comments
//   POST   /:taskId/comments
//   PATCH  /:taskId/comments/:commentId
//   DELETE /:taskId/comments/:commentId

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleComments(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const taskId = pathParts[0];
  // pathParts[1] === 'comments'
  const commentId = pathParts[2];
  if (!taskId) return null;

  if (method === 'GET' && !commentId) {
    const { data, error } = await db
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: true });
    if (error) return dbErr(req, requestId, 'Failed to fetch comments', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !commentId) {
    const body = (await req.json().catch(() => null)) as { comment?: string } | null;
    if (!body?.comment) {
      return errorResponse(400, 'comment is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('task_comments')
      .insert({
        tenant_id: auth.tenantId,
        task_id: taskId,
        user_id: auth.userId,
        comment: body.comment,
      })
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to add comment', error);
    await bumpCommentCount(db, auth.tenantId, taskId);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && commentId) {
    const body = (await req.json().catch(() => null)) as { comment?: string } | null;
    if (!body?.comment) {
      return errorResponse(400, 'comment is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('task_comments')
      .update({ comment: body.comment })
      .eq('id', commentId)
      .eq('task_id', taskId)
      .eq('tenant_id', auth.tenantId)
      // Own-comment check — users can only edit their own comments
      .eq('user_id', auth.userId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update comment', error);
    if (!data) {
      return errorResponse(404, 'Comment not found or not owned by user', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && commentId) {
    const { error } = await db
      .from('task_comments')
      .delete()
      .eq('id', commentId)
      .eq('task_id', taskId)
      .eq('tenant_id', auth.tenantId)
      .eq('user_id', auth.userId);
    if (error) return dbErr(req, requestId, 'Failed to delete comment', error);
    await bumpCommentCount(db, auth.tenantId, taskId);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// deno-lint-ignore no-explicit-any
async function bumpCommentCount(db: any, tenantId: string, taskId: string) {
  const { count } = await db
    .from('task_comments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('task_id', taskId);
  await db
    .from('tasks')
    .update({ comment_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('tenant_id', tenantId);
}

function dbErr(req: Request, requestId: string, msg: string, err: unknown): Response {
  return errorResponse(500, msg, req, { code: 'DB_ERROR', details: err, requestId });
}

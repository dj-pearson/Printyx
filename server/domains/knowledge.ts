/**
 * Knowledge Base & Content Domain
 * Articles, admin, bookmarks, ratings, reading history
 */
export { default as knowledgeBaseAdminRoutes } from '../routes/knowledge-base-admin-routes';
// Round 147: contentGapAnalysisRoutes retired. /api/content-gap-analysis is
// proxied to supabase/functions/content-gap-analysis/, which is the port of the
// deleted service; the Express router could never authenticate (it read
// req.session.userId, which nothing sets) and fell back to a zero-uuid tenant.

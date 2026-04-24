// Knowledge entities CRUD + graph — /ai-search/knowledge/entities, /knowledge/graph
// Ported from server/routes/ai-search-knowledge-routes.ts::152-554 + 635-743.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';

const createEntitySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
  facts: z.array(z.string()).optional(),
  relatedEntities: z.array(z.string()).optional(),
});

export async function handleEntities(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['knowledge', 'entities', ...] or ['knowledge', 'graph']
  const sub = pathParts[1];

  if (sub === 'graph' && method === 'GET') {
    const centerEntity = url.searchParams.get('centerEntity');
    const minImportance = Number(url.searchParams.get('minImportance') ?? '0.5');
    const includeRelationships = url.searchParams.get('includeRelationships') !== 'false';

    const { data: entities, error } = await db
      .from('knowledge_entities')
      .select(
        'id, entity_name, entity_type, entity_category, importance_score, trending_score, entity_description, related_entities',
      )
      .eq('tenant_id', auth.tenantId)
      .gte('importance_score', minImportance)
      .order('importance_score', { ascending: false })
      .limit(50);

    if (error) {
      return errorResponse(500, 'Failed to fetch knowledge graph', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const typeColor: Record<string, string> = {
      product: '#3B82F6',
      technology: '#8B5CF6',
      concept: '#10B981',
      person: '#F59E0B',
      organization: '#EF4444',
      location: '#14B8A6',
      event: '#EC4899',
    };

    const nodes = (entities ?? []).map((e) => ({
      id: e.id,
      name: e.entity_name,
      type: e.entity_type,
      category: e.entity_category,
      importance: Number(e.importance_score ?? 0),
      size: Math.round(Number(e.importance_score ?? 0.5) * 100),
      color: typeColor[e.entity_type] ?? '#6B7280',
      description: e.entity_description ?? '',
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      relationship: string;
      strength: number;
      width: number;
    }> = [];

    if (includeRelationships) {
      for (const e of entities ?? []) {
        const related = Array.isArray(e.related_entities) ? e.related_entities : [];
        for (const otherId of related) {
          if (typeof otherId !== 'string' || !nodeIds.has(otherId)) continue;
          edges.push({
            id: `edge-${e.id}-${otherId}`,
            source: e.id,
            target: otherId,
            relationship: 'related',
            strength: 0.7,
            width: 2,
          });
        }
      }
    }

    return jsonResponse(
      {
        nodes,
        edges,
        metadata: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          centerNode: centerEntity ?? nodes[0]?.id,
          generatedAt: new Date().toISOString(),
          layout: 'force-directed',
        },
      },
      200,
      req,
      requestId,
    );
  }

  if (sub !== 'entities') return null;

  const entityId = pathParts[2];

  // POST /knowledge/entities
  if (method === 'POST' && !entityId) {
    let body;
    try {
      body = await validateBody(createEntitySchema, req);
    } catch (err) {
      return errorResponse(400, 'Invalid entity payload', req, {
        code: 'VALIDATION',
        details: (err as { issues?: unknown }).issues,
        requestId,
      });
    }

    const { data, error } = await db
      .from('knowledge_entities')
      .insert({
        tenant_id: auth.tenantId,
        entity_name: body.name,
        entity_type: body.type,
        entity_description: body.description ?? null,
        entity_summary: body.description?.slice(0, 200) ?? null,
        entity_category: body.category ?? null,
        entity_attributes: body.attributes ?? {},
        entity_facts: body.facts ?? [],
        related_entities: body.relatedEntities ?? [],
        importance_score: 0.5,
        trending_score: 0,
        ai_confidence_score: 0.8,
        entity_status: 'active',
        quality_score: 0.75,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create knowledge entity', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(data, 201, req, requestId);
  }

  // GET /knowledge/entities
  if (method === 'GET' && !entityId) {
    const q = url.searchParams;
    const page = Number(q.get('page') ?? '1');
    const limit = Math.min(100, Number(q.get('limit') ?? '20'));
    const type = q.get('type');
    const category = q.get('category');
    const search = q.get('search');
    const sortBy = q.get('sortBy') ?? 'importance';
    const sortOrder = q.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const sortColumn =
      sortBy === 'name'
        ? 'entity_name'
        : sortBy === 'trending'
          ? 'trending_score'
          : sortBy === 'mentions'
            ? 'mention_frequency'
            : sortBy === 'updated'
              ? 'updated_at'
              : 'importance_score';

    let query = db
      .from('knowledge_entities')
      .select('*', { count: 'exact' })
      .eq('tenant_id', auth.tenantId)
      .order(sortColumn, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    if (type) query = query.eq('entity_type', type);
    if (category) query = query.eq('entity_category', category);
    if (search) query = query.ilike('entity_name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      return errorResponse(500, 'Failed to fetch entities', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const total = count ?? data?.length ?? 0;
    return jsonResponse(
      {
        entities: data ?? [],
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        filters: { type, category, search, sortBy, sortOrder },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /knowledge/entities/:id
  if (method === 'GET' && entityId) {
    const { data, error } = await db
      .from('knowledge_entities')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('id', entityId)
      .maybeSingle();

    if (error) {
      return errorResponse(500, 'Failed to fetch entity', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    if (!data) {
      return errorResponse(404, 'Entity not found', req, {
        code: 'NOT_FOUND',
        requestId,
      });
    }

    return jsonResponse(data, 200, req, requestId);
  }

  return null;
}

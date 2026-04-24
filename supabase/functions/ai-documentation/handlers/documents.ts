// Documents CRUD + AI operations for ai-documentation.
//
// Paths:
//   GET  /documents                              — list (mock)
//   POST /documents                              — create (echo; no table)
//   GET  /documents/:documentId                  — detail (mock)
//   POST /documents/search                       — keyword search (mock)
//   POST /documents/from-meeting                 — Claude: meeting → structured doc
//   POST /documents/:documentId/sections/generate — Claude: section content
//   POST /documents/:documentId/improve          — Claude: improve prose
//
// The underlying `ai_documents` table is not present in migrations/, so list
// and detail endpoints return the same mock shapes the Express route returned.
// Only the three Claude endpoints exercise the Anthropic API.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { generateCompletion } from '../../_shared/anthropic.ts';
import { buildMockDocuments } from '../_mock.ts';

export async function handleDocuments(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, requestId, pathParts, url } = ctx;
  // pathParts: ['documents', ...]
  const documentId = pathParts[1];
  const sub = pathParts[2];
  const sub2 = pathParts[3];

  // POST /documents
  if (method === 'POST' && !documentId) {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.title || typeof body.title !== 'string') {
      return errorResponse(400, 'Document title is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const document = {
      id: `doc-${Date.now()}`,
      tenantId: auth.tenantId,
      title: body.title,
      description: body.description ?? null,
      documentTypeId: body.documentTypeId ?? null,
      status: 'draft',
      version: 1,
      content: body.initialContent ?? {},
      sourceType: body.sourceType ?? 'manual',
      sourceId: body.sourceId ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return jsonResponse(document, 201, req, requestId);
  }

  // GET /documents
  if (method === 'GET' && !documentId) {
    const q = url.searchParams;
    const page = Number(q.get('page') ?? '1');
    const limit = Number(q.get('limit') ?? '20');
    const status = q.get('status');
    const search = q.get('search');

    let docs = buildMockDocuments(auth.tenantId, auth.userId);
    if (status) docs = docs.filter((d) => d.status === status);
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          (d.description ?? '').toLowerCase().includes(s) ||
          d.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }

    const start = (page - 1) * limit;
    const paged = docs.slice(start, start + limit);

    return jsonResponse(
      {
        documents: paged,
        pagination: {
          page,
          limit,
          total: docs.length,
          pages: Math.ceil(docs.length / limit),
        },
        filters: { status, search },
      },
      200,
      req,
      requestId,
    );
  }

  // POST /documents/from-meeting — Claude
  if (method === 'POST' && documentId === 'from-meeting') {
    let body: {
      meetingId?: string;
      transcriptionData?: Record<string, unknown>;
      documentType?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.meetingId || !body.transcriptionData) {
      return errorResponse(400, 'meetingId and transcriptionData are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const docType = body.documentType ?? 'meeting_minutes';
    const transcript = (body.transcriptionData as { fullTranscript?: string }).fullTranscript ?? '';
    const speakers =
      (body.transcriptionData as { speakers?: Array<{ name?: string }> }).speakers
        ?.map((s) => s.name)
        .filter(Boolean)
        .join(', ') ?? '';

    const prompt =
      `Generate a professional ${docType.replace('_', ' ')} from this meeting transcription:\n\n` +
      `MEETING TRANSCRIPTION:\n${transcript}\n\n` +
      `SPEAKERS:\n${speakers}\n\n` +
      'Generate structured content in JSON format:\n' +
      '{\n  "title": "Meeting title",\n  "content": {\n    "summary": "Brief meeting summary",\n' +
      '    "attendees": ["List of attendees"],\n    "keyPoints": ["Key discussion points"],\n' +
      '    "decisions": ["Decisions made"],\n    "actionItems": [\n      {\n        "task": "Action item description",\n' +
      '        "assignee": "Person responsible",\n        "dueDate": "Due date if mentioned"\n      }\n    ],\n' +
      '    "nextSteps": ["Next steps and follow-ups"]\n  }\n}';

    try {
      const raw = await generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      let generated: { title?: string; content?: Record<string, unknown> } = {};
      try {
        generated = JSON.parse(raw);
      } catch {
        return errorResponse(502, 'AI produced non-JSON output', req, {
          code: 'AI_PARSE_ERROR',
          details: { preview: raw.slice(0, 200) },
          requestId,
        });
      }

      return jsonResponse(
        {
          id: `doc-${Date.now()}`,
          tenantId: auth.tenantId,
          title: generated.title ?? 'Meeting Document',
          description: `AI-generated ${docType.replace('_', ' ')} from meeting`,
          status: 'draft',
          version: 1,
          content: generated.content ?? {},
          sourceType: 'meeting_transcription',
          sourceId: body.meetingId,
          aiModelUsed: 'claude-3-5-sonnet-20241022',
          tags: ['meeting', docType, 'ai-generated'],
          createdBy: auth.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        201,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(503, 'Failed to generate document from meeting', req, {
        code: 'AI_UNAVAILABLE',
        details: String(err),
        requestId,
      });
    }
  }

  // POST /documents/search — mock keyword search
  if (method === 'POST' && documentId === 'search') {
    let body: { query?: string } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }
    if (!body.query || body.query.trim().length === 0) {
      return errorResponse(400, 'Search query is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const start = Date.now();
    const docs = buildMockDocuments(auth.tenantId, auth.userId);
    const q = body.query.toLowerCase();
    const results = docs
      .filter(
        (d) => d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q),
      )
      .map((d) => ({
        document: d,
        relevanceScore: 0.8,
        matchedContent: [d.description ?? ''],
        highlights: [body.query!],
      }));

    return jsonResponse(
      {
        results,
        totalResults: results.length,
        searchTime: Date.now() - start,
        suggestions: ['meeting minutes', 'project reports', 'client proposals'],
      },
      200,
      req,
      requestId,
    );
  }

  // POST /documents/:id/sections/generate — Claude
  if (method === 'POST' && documentId && sub === 'sections' && sub2 === 'generate') {
    let body: {
      sectionType?: string;
      prompt?: string;
      context?: { documentTitle?: string; tone?: string; length?: string };
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.sectionType || !body.prompt) {
      return errorResponse(400, 'Section type and prompt are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const ctxInput = body.context ?? {};
    const enhanced =
      `Generate ${body.sectionType} content for a business document:\n\n` +
      `USER REQUEST: ${body.prompt}\n\n` +
      `CONTEXT:\n- Document Title: ${ctxInput.documentTitle ?? 'Business Document'}\n` +
      `- Desired Tone: ${ctxInput.tone ?? 'Professional'}\n` +
      `- Length: ${ctxInput.length ?? 'Medium'}\n\n` +
      'Generate content in JSON format:\n' +
      '{\n  "content": { "text": "The generated content text", "formatting": { "style": "paragraph", "emphasis": [] } },\n' +
      '  "plainText": "Plain text version for search",\n  "confidenceScore": 0.85\n}';

    try {
      const raw = await generateCompletion({
        messages: [{ role: 'user', content: enhanced }],
        temperature: 0.4,
        max_tokens: 2000,
      });

      let parsed: {
        content?: Record<string, unknown>;
        plainText?: string;
        confidenceScore?: number;
      } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { content: { text: raw }, plainText: raw, confidenceScore: 0.6 };
      }

      return jsonResponse(
        {
          content: parsed.content ?? {},
          plainText: parsed.plainText ?? '',
          confidenceScore: parsed.confidenceScore ?? 0.85,
          suggestions: [],
        },
        200,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(503, 'Failed to generate section content', req, {
        code: 'AI_UNAVAILABLE',
        details: String(err),
        requestId,
      });
    }
  }

  // POST /documents/:id/improve — Claude
  if (method === 'POST' && documentId && sub === 'improve') {
    let body: {
      content?: string;
      improvementType?: string;
      context?: { targetAudience?: string; purpose?: string; tone?: string };
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.content) {
      return errorResponse(400, 'Content to improve is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const improvementType = body.improvementType ?? 'grammar';
    const ctxIn = body.context ?? {};
    const prompt =
      `Improve the following content for ${improvementType}:\n\n` +
      `ORIGINAL CONTENT:\n${body.content}\n\n` +
      `CONTEXT:\n- Target Audience: ${ctxIn.targetAudience ?? 'General business audience'}\n` +
      `- Purpose: ${ctxIn.purpose ?? 'Professional communication'}\n` +
      `- Desired Tone: ${ctxIn.tone ?? 'Professional'}\n\n` +
      'Provide improvements and explain each change. Return JSON format:\n' +
      '{\n  "improvedContent": "The improved version of the content",\n' +
      '  "changes": [\n    {\n      "type": "' +
      improvementType +
      '",\n      "original": "original text",\n      "improved": "improved text",\n' +
      '      "reasoning": "explanation of why this change improves the content"\n    }\n  ],\n' +
      '  "overallAssessment": "Overall assessment of content quality",\n  "confidenceScore": 0.85\n}';

    try {
      const raw = await generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000,
      });

      let parsed: {
        improvedContent?: string;
        changes?: Array<{ type: string; original: string; improved: string; reasoning: string }>;
        confidenceScore?: number;
      } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return errorResponse(502, 'AI produced non-JSON output', req, {
          code: 'AI_PARSE_ERROR',
          details: { preview: raw.slice(0, 200) },
          requestId,
        });
      }

      const changes = parsed.changes ?? [];
      const confidence = parsed.confidenceScore ?? 0.85;
      const suggestions = changes.map((c, i) => ({
        id: `suggestion-${Date.now()}-${i}`,
        documentId,
        suggestionType: improvementType,
        suggestionTitle: `${improvementType[0].toUpperCase()}${improvementType.slice(1)} Improvement`,
        suggestionDescription: c.reasoning,
        originalContent: c.original,
        suggestedContent: c.improved,
        changeType: 'replacement',
        confidenceScore: confidence,
        importanceLevel: 'medium',
        reasoning: c.reasoning,
        status: 'pending',
        tags: [improvementType],
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        generatedAt: new Date().toISOString(),
      }));

      return jsonResponse(
        {
          improvedContent: parsed.improvedContent ?? body.content,
          suggestions,
          confidenceScore: confidence,
          changes,
        },
        200,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(503, 'Failed to improve content', req, {
        code: 'AI_UNAVAILABLE',
        details: String(err),
        requestId,
      });
    }
  }

  // GET /documents/:id — detail (mock)
  if (method === 'GET' && documentId) {
    const [first] = buildMockDocuments(auth.tenantId, auth.userId);
    return jsonResponse({ ...first, id: documentId }, 200, req, requestId);
  }

  return null;
}

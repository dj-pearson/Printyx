// Knowledge articles — /ai-documentation/knowledge/articles
// Ported from server/routes/ai-documentation-routes.ts::499-668.
//
// No `ai_document_knowledge_articles` table exists; list endpoint returns the
// same mock catalog the Express version did. POST echoes back an AI-enhanced
// article shape without persisting.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

function buildMockArticles(tenantId: string, userId: string) {
  const d = new Date();
  return [
    {
      id: 'article-1',
      tenantId,
      title: 'How to Set Up AI-Powered Meeting Transcription',
      slug: 'how-to-set-up-ai-powered-meeting-transcription',
      category: 'tutorials',
      subcategory: 'meeting_management',
      excerpt:
        'Learn how to configure and use AI-powered meeting transcription for automatic note generation and action item tracking.',
      content: {
        introduction:
          'AI-powered meeting transcription transforms how teams capture and process meeting information...',
        steps: [
          'Configure your meeting platform integration',
          'Set up automatic recording and transcription',
          'Customize AI note generation settings',
          'Review and edit AI-generated content',
        ],
      },
      wordCount: 1456,
      estimatedReadingTime: 7,
      aiDifficultyLevel: 'intermediate',
      aiContentQualityScore: 0.91,
      tags: ['tutorial', 'meetings', 'AI', 'transcription', 'setup'],
      status: 'published',
      featured: true,
      isPublic: true,
      viewCount: 234,
      helpfulVotes: 45,
      unhelpfulVotes: 3,
      averageRating: 4.7,
      createdBy: userId,
      createdAt: d,
      updatedAt: d,
      publishedAt: d,
    },
    {
      id: 'article-2',
      tenantId,
      title: 'Best Practices for AI Document Generation',
      slug: 'best-practices-for-ai-document-generation',
      category: 'best_practices',
      subcategory: 'documentation',
      excerpt:
        'Essential best practices for creating high-quality documents using AI assistance and maintaining consistency.',
      content: {
        introduction:
          'AI document generation can significantly improve productivity when used effectively...',
        practices: [
          'Define clear document templates and structures',
          'Provide context and specific instructions to AI',
          'Review and refine AI-generated content',
          'Maintain consistent tone and style',
        ],
      },
      wordCount: 892,
      estimatedReadingTime: 4,
      aiDifficultyLevel: 'beginner',
      aiContentQualityScore: 0.88,
      tags: ['best-practices', 'AI', 'documentation', 'quality'],
      status: 'published',
      featured: false,
      isPublic: true,
      viewCount: 156,
      helpfulVotes: 32,
      unhelpfulVotes: 1,
      averageRating: 4.5,
      createdBy: userId,
      createdAt: d,
      updatedAt: d,
      publishedAt: d,
    },
  ];
}

export async function handleKnowledge(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, requestId, pathParts, url } = ctx;
  // pathParts: ['knowledge', 'articles', ...]
  if (pathParts[1] !== 'articles') return null;

  // POST /knowledge/articles
  if (method === 'POST') {
    let body: {
      title?: string;
      category?: string;
      subcategory?: string;
      content?: Record<string, unknown>;
      tags?: string[];
      targetAudience?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.title || !body.category || !body.content) {
      return errorResponse(400, 'Title, category, and content are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const plainText = extractPlainText(body.content);
    const wordCount = plainText.trim().split(/\s+/).length;

    const result = {
      id: `article-${Date.now()}`,
      aiEnhancements: {
        summary: `This article covers ${body.title.toLowerCase()} with practical examples and step-by-step guidance for ${
          body.targetAudience ?? 'users'
        }.`,
        keywords: ['tutorial', 'guide', 'how-to', body.category.toLowerCase()],
        relatedTopics: [
          `Advanced ${body.category}`,
          `${body.category} Best Practices`,
          `Common ${body.category} Issues`,
        ],
        difficultyLevel: 'intermediate',
        qualityScore: 0.88,
      },
      title: body.title,
      slug: slugify(body.title),
      wordCount,
      estimatedReadingTime: Math.ceil(wordCount / 200),
      tags: body.tags ?? [],
      status: 'draft',
      createdBy: auth.userId,
      tenantId: auth.tenantId,
      createdAt: new Date().toISOString(),
    };

    return jsonResponse(result, 201, req, requestId);
  }

  // GET /knowledge/articles
  if (method === 'GET') {
    const q = url.searchParams;
    const page = Number(q.get('page') ?? '1');
    const limit = Number(q.get('limit') ?? '20');
    const category = q.get('category');
    const featured = q.get('featured');
    const search = q.get('search');

    let articles = buildMockArticles(auth.tenantId, auth.userId);
    if (category) articles = articles.filter((a) => a.category === category);
    if (featured === 'true') articles = articles.filter((a) => a.featured);
    if (search) {
      const s = search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(s) ||
          a.excerpt.toLowerCase().includes(s) ||
          a.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }

    const start = (page - 1) * limit;
    const paged = articles.slice(start, start + limit);

    return jsonResponse(
      {
        articles: paged,
        pagination: {
          page,
          limit,
          total: articles.length,
          pages: Math.ceil(articles.length / limit),
        },
        filters: { category, featured, search },
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractPlainText(content: Record<string, unknown> | string): string {
  if (typeof content === 'string') return content;
  const c = content as { text?: string; sections?: Array<{ content?: string }> };
  if (c.text) return c.text;
  if (Array.isArray(c.sections)) {
    return c.sections.map((s) => s.content ?? '').join(' ');
  }
  return JSON.stringify(content);
}

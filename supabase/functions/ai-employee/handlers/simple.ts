// Simple AI endpoints — /ai-employee/ai/health + /ai-employee/ai/leads/analyze
// Replaces server/routes/ai-routes-simple.ts. Merged into ai-employee because
// both deal with AI-backed analysis for employees (lead scoring hook).

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { generateCompletion } from '../../_shared/anthropic.ts';

export async function handleSimple(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  // pathParts: ['ai', ...]
  if (pathParts[0] !== 'ai') return null;
  const sub = pathParts[1];

  // GET /ai/health
  if (method === 'GET' && sub === 'health') {
    try {
      const response = await generateCompletion({
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 10,
      });
      return jsonResponse(
        { status: 'healthy', ai: 'available', response: response.slice(0, 50) },
        200,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(503, 'Claude API unavailable', req, {
        code: 'AI_UNAVAILABLE',
        details: String(err),
        requestId,
      });
    }
  }

  // POST /ai/leads/analyze
  if (method === 'POST' && sub === 'leads' && pathParts[2] === 'analyze') {
    let body: { leadData?: Record<string, unknown> } = {};
    try {
      body = await req.json();
    } catch {
      /* treat as empty */
    }

    const lead = body.leadData ?? {
      companyName: 'Sample Company',
      industry: 'Manufacturing',
      employeeCount: 100,
    };

    const system =
      'You are an AI sales assistant for copier dealers. Analyze lead data and return JSON with lead scoring and recommendations.';
    const prompt =
      `Analyze this lead: ${JSON.stringify(lead)}. Return JSON with keys: ` +
      'score (0-100), conversionProbability (0-100), insights (string[]), recommendedActions (string[]), optimalContactTimes (string[])';

    try {
      const raw = await generateCompletion({
        system,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      let analysis: {
        score?: number;
        conversionProbability?: number;
        insights?: string[];
        recommendedActions?: string[];
        optimalContactTimes?: string[];
      } = {};
      try {
        analysis = JSON.parse(raw);
      } catch {
        // Model didn't return JSON — degrade to the same defaults the Express
        // service used so the frontend still renders.
      }

      return jsonResponse(
        {
          score: Math.min(100, Math.max(0, Number(analysis.score ?? 50))),
          conversionProbability: Math.min(
            100,
            Math.max(0, Number(analysis.conversionProbability ?? 25)),
          ),
          insights: Array.isArray(analysis.insights) ? analysis.insights : [],
          recommendedActions: Array.isArray(analysis.recommendedActions)
            ? analysis.recommendedActions
            : [],
          optimalContactTimes: Array.isArray(analysis.optimalContactTimes)
            ? analysis.optimalContactTimes
            : ['Tuesday-Thursday 10am-4pm'],
        },
        200,
        req,
        requestId,
      );
    } catch (err) {
      return errorResponse(503, 'Failed to analyze lead', req, {
        code: 'AI_UNAVAILABLE',
        details: String(err),
        requestId,
      });
    }
  }

  return null;
}

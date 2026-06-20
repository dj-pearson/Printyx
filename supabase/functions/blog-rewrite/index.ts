// Blog Inline AI Rewrite Toolbar Edge Function (US-BLOG-032)
//
// Powers the editor's selection toolbar: rewrite a highlighted passage to be
// shorter, longer, simpler, or in a different tone. Stateless — takes the text
// and returns the rewrite; the editor applies it. No persistence, no schema.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-rewrite          body: { text, action, tone?, instructions? }
//        action ∈ shorter | longer | simplify | tone | continue | rephrase
//
// One LLM call per request; preserves meaning and any facts/numbers.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';

const rewriteSchema = z.object({
  text: z.string().min(1).max(20_000),
  action: z.enum(['shorter', 'longer', 'simplify', 'tone', 'continue', 'rephrase']),
  tone: z.string().max(120).optional(),
  instructions: z.string().max(500).optional(),
});

const ACTION_PROMPT: Record<z.infer<typeof rewriteSchema>['action'], string> = {
  shorter: 'Rewrite the passage to be noticeably more concise without losing meaning.',
  longer:
    'Expand the passage with relevant detail, examples, or explanation — do not pad with fluff.',
  simplify:
    'Rewrite the passage in plain language at roughly an 8th-grade reading level. Keep all facts.',
  tone: 'Rewrite the passage in the requested tone while preserving meaning.',
  continue: 'Continue the passage naturally for one to two more paragraphs in the same voice.',
  rephrase: 'Rephrase the passage in fresh wording while keeping the same meaning and length.',
};

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }
    if (!hasBlogPostEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-rewrite');
    if (parts.length > 0 && parts[0]) {
      return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
    }
    if (req.method !== 'POST') {
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
    const parsed = rewriteSchema.safeParse(body);
    if (!parsed.success) {
      return createCorsResponse(
        { error: 'Validation failed', details: parsed.error.flatten() },
        400,
        req,
      );
    }
    const { text, action, tone, instructions } = parsed.data;
    if (action === 'tone' && !tone) {
      return createCorsResponse({ error: 'tone is required for the "tone" action' }, 400, req);
    }

    const directive =
      ACTION_PROMPT[action] +
      (action === 'tone' && tone ? ` Target tone: ${tone}.` : '') +
      (instructions ? ` Additional instruction: ${instructions}.` : '');

    const rewritten = await generateCompletion({
      max_tokens: 2000,
      temperature: 0.6,
      system:
        'You are an inline writing assistant inside a blog editor. ' +
        directive +
        ' Return ONLY the rewritten passage as markdown — no preamble, no quotes, no explanation.',
      messages: [{ role: 'user', content: text }],
    });

    return createCorsResponse(
      { action, original: text, result: rewritten.trim() },
      200,
      req,
    );
  } catch (err) {
    console.error('blog-rewrite handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

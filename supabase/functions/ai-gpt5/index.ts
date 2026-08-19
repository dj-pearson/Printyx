// AI GPT-5 Edge Function (AI-001)
//
// Serves /api/ai/gpt5/* in production. The Express router (server/routes-ai-gpt5.ts)
// only ever ran in dev: getApiUrl() rewrites /api/ai/gpt5/... to
// functions.printyx.net/ai/gpt5/..., segment 0 is `ai`, and no `ai` function
// directory exists — so every button on /gpt5-dashboard 404'd in production.
// supabase/functions/server.ts aliases `ai` + `gpt5` to this directory, and the
// dev proxy forwards /api/ai/gpt5 here so both environments run one code path.
//
// The prompt text, model configs, request body and response parser come from
// _shared/gpt5-prompts.ts, which server/tests/unit/gpt5-prompts-parity.test.ts
// locks against the Node service.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  GPT5_CONFIGS,
  GPT5_CONFIG_DESCRIPTIONS,
  buildAutomationCodePrompt,
  buildBusinessAnalyticsPrompt,
  buildInquiryClassificationPrompt,
  buildLeadAnalysisPrompt,
  buildProposalPrompt,
  buildResponsesRequest,
  buildServiceAnalysisPrompt,
  buildSupportResponsePrompt,
  extractResponseText,
  type GPT5Config,
  type GPT5ConfigName,
} from '../_shared/gpt5-prompts.ts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type ValidationIssue = { path: string[]; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(body: any, key: string, issues: ValidationIssue[]) {
  if (!isRecord(body?.[key])) {
    issues.push({ path: [key], message: 'Expected object' });
  }
  return body?.[key];
}

function optionalRecord(body: any, key: string, issues: ValidationIssue[]) {
  const value = body?.[key];
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) issues.push({ path: [key], message: 'Expected object' });
  return value;
}

function requireString(body: any, key: string, issues: ValidationIssue[]) {
  const value = body?.[key];
  if (typeof value !== 'string') issues.push({ path: [key], message: 'Expected string' });
  return value;
}

function invalid(issues: ValidationIssue[], req: Request) {
  return createCorsResponse({ error: 'Invalid request data', details: issues }, 400, req);
}

/**
 * Call the Responses API. Mirrors GPT5Service.generateResponse: a missing key
 * or an API error becomes { success: false } rather than a thrown exception, so
 * the route handlers below can return the same 500 body the Express ones do.
 */
async function generateResponse(
  input: string,
  config: GPT5Config,
  previousResponseId?: string,
): Promise<
  | { success: true; responseId: string; content: string; reasoning: any; usage: any }
  | { success: false; error: string }
> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'OpenAI API key not configured' };
  }

  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildResponsesRequest(input, config, previousResponseId)),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const message = payload?.error?.message || `OpenAI request failed with status ${res.status}`;
      console.error('[AI-GPT5] OpenAI error:', message);
      return { success: false, error: message };
    }

    return {
      success: true,
      responseId: payload?.id,
      content: extractResponseText(payload),
      reasoning: payload?.reasoning,
      usage: payload?.usage,
    };
  } catch (error) {
    console.error('[AI-GPT5] Responses API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Authentication required' }, 401, req);
    }

    // Tenant comes from the verified JWT. The x-tenant-id header is a fallback
    // only and must never override it.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;

    if (!tenantId) {
      const admin = createSupabaseServiceClient();
      const { data: dbUser } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    // The Express router 401s when either the user id or the tenant is missing.
    if (!tenantId) {
      return createCorsResponse({ error: 'Authentication required' }, 401, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'gpt5');
    const action = parts[0];

    // GET /gpt5/configs
    if (req.method === 'GET' && action === 'configs') {
      return createCorsResponse(
        {
          configs: Object.keys(GPT5_CONFIGS),
          descriptions: GPT5_CONFIG_DESCRIPTIONS,
        },
        200,
        req,
      );
    }

    if (req.method !== 'POST') {
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const issues: ValidationIssue[] = [];

    switch (action) {
      case 'analyze-lead': {
        const leadData = requireRecord(body, 'leadData', issues);
        const customerHistory = optionalRecord(body, 'customerHistory', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildLeadAnalysisPrompt(leadData, customerHistory),
          GPT5_CONFIGS.LEAD_ANALYSIS,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { analysis: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'generate-proposal': {
        const customerData = requireRecord(body, 'customerData', issues);
        const equipmentRequirements = requireRecord(body, 'equipmentRequirements', issues);
        const pricingData = requireRecord(body, 'pricingData', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildProposalPrompt(customerData, equipmentRequirements, pricingData),
          GPT5_CONFIGS.PROPOSAL_GENERATION,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { proposal: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'analyze-service': {
        const ticketData = requireRecord(body, 'ticketData', issues);
        const equipmentHistory = optionalRecord(body, 'equipmentHistory', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildServiceAnalysisPrompt(ticketData, equipmentHistory),
          GPT5_CONFIGS.SERVICE_ANALYSIS,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { analysis: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'support-response': {
        const customerQuery = requireString(body, 'customerQuery', issues);
        const customerContext = optionalRecord(body, 'customerContext', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildSupportResponsePrompt(customerQuery, customerContext),
          GPT5_CONFIGS.CUSTOMER_SUPPORT,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { response: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'business-analytics': {
        const salesData = requireRecord(body, 'salesData', issues);
        const serviceData = requireRecord(body, 'serviceData', issues);
        const timeframe = requireString(body, 'timeframe', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildBusinessAnalyticsPrompt(salesData, serviceData, timeframe),
          GPT5_CONFIGS.BUSINESS_ANALYTICS,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { analysis: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'classify-inquiry': {
        const inquiry = requireString(body, 'inquiry', issues);
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildInquiryClassificationPrompt(inquiry),
          GPT5_CONFIGS.CLASSIFICATION,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { classification: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'generate-code': {
        const requirements = requireString(body, 'requirements', issues);
        const codeType = body?.codeType;
        if (codeType !== 'javascript' && codeType !== 'python' && codeType !== 'sql') {
          issues.push({
            path: ['codeType'],
            message: "Expected one of 'javascript' | 'python' | 'sql'",
          });
        }
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(
          buildAutomationCodePrompt(requirements, codeType),
          GPT5_CONFIGS.CODE_GENERATION,
        );
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          { code: result.content, responseId: result.responseId, usage: result.usage },
          200,
          req,
        );
      }

      case 'custom-prompt': {
        const prompt = requireString(body, 'prompt', issues);
        const configType = (body?.configType ?? 'LEAD_ANALYSIS') as GPT5ConfigName;
        if (!(configType in GPT5_CONFIGS)) {
          issues.push({
            path: ['configType'],
            message: `Expected one of ${Object.keys(GPT5_CONFIGS).join(' | ')}`,
          });
        }
        const previousResponseId = body?.previousResponseId;
        if (previousResponseId !== undefined && typeof previousResponseId !== 'string') {
          issues.push({ path: ['previousResponseId'], message: 'Expected string' });
        }
        if (issues.length) return invalid(issues, req);

        const result = await generateResponse(prompt, GPT5_CONFIGS[configType], previousResponseId);
        if (!result.success) return createCorsResponse({ error: result.error }, 500, req);
        return createCorsResponse(
          {
            response: result.content,
            responseId: result.responseId,
            reasoning: result.reasoning,
            usage: result.usage,
          },
          200,
          req,
        );
      }

      default:
        return createCorsResponse({ error: 'Not found' }, 404, req);
    }
  } catch (error) {
    console.error('[AI-GPT5] Unexpected error:', error);
    return createCorsResponse({ error: 'Internal server error' }, 500, req);
  }
}

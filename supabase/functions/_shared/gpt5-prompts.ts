/**
 * GPT-5 prompt builders, model configs and response parsing (AI-001).
 *
 * Deno copy of the logic in server/services/gpt5-service.ts. The two are locked
 * together by server/tests/unit/gpt5-prompts-parity.test.ts, which imports both
 * and asserts identical output — a prompt edit that lands in only one file
 * fails CI.
 *
 * Deliberately free of any OpenAI SDK dependency: the Node service talks to the
 * API through the `openai` package and the edge function talks to the same REST
 * endpoint through fetch, so the only thing that can be shared is the part that
 * decides WHAT to send and how to read WHAT COMES BACK.
 */

import { withCrisisGuardrail } from './crisis-response.ts';

export interface GPT5Config {
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning?: { effort: 'minimal' | 'low' | 'medium' | 'high' };
  text?: { verbosity: 'low' | 'medium' | 'high' };
  tools?: Array<any>;
  allowedTools?: {
    type: 'allowed_tools';
    mode: 'auto' | 'required';
    tools: Array<any>;
  };
}

export const GPT5_CONFIGS = {
  LEAD_ANALYSIS: {
    model: 'gpt-5-mini' as const,
    reasoning: { effort: 'medium' as const },
    text: { verbosity: 'medium' as const },
  },
  PROPOSAL_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const },
  },
  SERVICE_ANALYSIS: {
    model: 'gpt-5-mini' as const,
    reasoning: { effort: 'medium' as const },
    text: { verbosity: 'medium' as const },
  },
  CUSTOMER_SUPPORT: {
    model: 'gpt-5-nano' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'low' as const },
  },
  BUSINESS_ANALYTICS: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const },
  },
  CODE_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'medium' as const },
  },
  CLASSIFICATION: {
    model: 'gpt-5-nano' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'low' as const },
  },
} as const;

export type GPT5ConfigName = keyof typeof GPT5_CONFIGS;

export const GPT5_CONFIG_DESCRIPTIONS: Record<GPT5ConfigName, string> = {
  LEAD_ANALYSIS: 'For CRM lead analysis and customer insights',
  PROPOSAL_GENERATION: 'For quote and proposal generation',
  SERVICE_ANALYSIS: 'For service ticket analysis and predictive maintenance',
  CUSTOMER_SUPPORT: 'For quick customer support responses',
  BUSINESS_ANALYTICS: 'For complex business analytics and forecasting',
  CODE_GENERATION: 'For code generation and technical tasks',
  CLASSIFICATION: 'For high-throughput classification tasks',
};

// ── Prompt builders ────────────────────────────────────────────────────────

export function buildLeadAnalysisPrompt(leadData: any, customerHistory?: any): string {
  return `You are a copier dealer sales analyst. Analyze this lead and provide insights:

Lead Information:
${JSON.stringify(leadData, null, 2)}

${customerHistory ? `Customer History: ${JSON.stringify(customerHistory, null, 2)}` : ''}

Please provide:
1. Lead qualification score (1-10)
2. Recommended next actions
3. Potential deal size estimate
4. Risk factors to consider
5. Equipment recommendations based on their needs

Format your response as structured JSON with clear recommendations.`;
}

export function buildProposalPrompt(
  customerData: any,
  equipmentRequirements: any,
  pricingData: any,
): string {
  return `You are a professional proposal writer for a copier dealer. Create a comprehensive proposal:

Customer: ${JSON.stringify(customerData, null, 2)}
Equipment Requirements: ${JSON.stringify(equipmentRequirements, null, 2)}
Pricing Data: ${JSON.stringify(pricingData, null, 2)}

Generate a professional proposal with:
1. Executive summary
2. Understanding of customer needs
3. Recommended solution details
4. Pricing breakdown
5. Implementation timeline
6. Support and maintenance terms
7. Next steps

Use professional business language and format appropriately.`;
}

export function buildServiceAnalysisPrompt(ticketData: any, equipmentHistory?: any): string {
  return `You are a service analysis expert for copier equipment. Analyze this service ticket:

Ticket: ${JSON.stringify(ticketData, null, 2)}
${equipmentHistory ? `Equipment History: ${JSON.stringify(equipmentHistory, null, 2)}` : ''}

Provide:
1. Problem severity assessment
2. Predicted resolution time
3. Required parts and technician skills
4. Preventive maintenance recommendations
5. Risk of equipment failure
6. Customer communication suggestions

Format as actionable insights for service management.`;
}

export function buildSupportResponsePrompt(customerQuery: string, customerContext?: any): string {
  // LEGAL-012: a support surface takes free text from a person, so it can
  // receive a disclosure the product has no business answering past.
  return `${withCrisisGuardrail('You are a helpful customer support representative for a copier dealer.')}

Customer Query: ${customerQuery}
${customerContext ? `Customer Context: ${JSON.stringify(customerContext, null, 2)}` : ''}

Provide a helpful, professional response that addresses their concern and offers next steps if needed.`;
}

export function buildBusinessAnalyticsPrompt(
  salesData: any,
  serviceData: any,
  timeframe: string,
): string {
  return `You are a business intelligence analyst for a copier dealer. Analyze these metrics:

Sales Data: ${JSON.stringify(salesData, null, 2)}
Service Data: ${JSON.stringify(serviceData, null, 2)}
Analysis Period: ${timeframe}

Provide:
1. Key performance insights
2. Trend analysis
3. Revenue forecasting
4. Areas for improvement
5. Strategic recommendations
6. Risk factors and opportunities

Present findings with actionable business recommendations.`;
}

export function buildInquiryClassificationPrompt(inquiry: string): string {
  return `Classify this customer inquiry into one of these categories:
- SALES: New equipment sales inquiry
- SERVICE: Equipment service or repair request  
- BILLING: Billing or payment related question
- SUPPORT: General product support question
- COMPLAINT: Customer complaint or issue
- OTHER: Does not fit other categories

Inquiry: "${inquiry}"

Respond with just the category name and confidence score (0-1).`;
}

export function buildAutomationCodePrompt(
  requirements: string,
  codeType: 'javascript' | 'python' | 'sql',
): string {
  return `You are an expert developer creating automation code for a copier dealer management platform.

Requirements: ${requirements}
Code Type: ${codeType}

Generate clean, well-documented code that:
1. Follows best practices for ${codeType}
2. Includes error handling
3. Has clear comments explaining the logic
4. Is production-ready

Before calling any tools, explain why you're generating this specific code approach.`;
}

// ── Request / response plumbing ────────────────────────────────────────────

/** Body for POST https://api.openai.com/v1/responses. */
export function buildResponsesRequest(
  input: string,
  config: GPT5Config = GPT5_CONFIGS.LEAD_ANALYSIS,
  previousResponseId?: string,
): Record<string, any> {
  const requestData: Record<string, any> = {
    model: config.model,
    input,
    ...config,
  };
  // Passing the previous response id carries the model's reasoning forward.
  if (previousResponseId) {
    requestData.previous_response_id = previousResponseId;
  }
  return requestData;
}

/**
 * Pull the assistant text out of a Responses API result.
 *
 * The obvious-looking `response.output.content` is always undefined: `output`
 * is an ARRAY of output items (reasoning items included), not an object. The
 * SDK exposes a flattened `output_text` convenience property, but the raw REST
 * payload the edge function receives does not carry it, so both shapes are
 * handled here.
 */
export function extractResponseText(response: any): string {
  if (!response) return '';

  if (typeof response.output_text === 'string' && response.output_text.length > 0) {
    return response.output_text;
  }

  const output = response.output;
  if (typeof output === 'string') return output;

  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const item of output) {
      const content = item?.content;
      if (typeof content === 'string') {
        parts.push(content);
        continue;
      }
      if (!Array.isArray(content)) continue;
      for (const chunk of content) {
        if (typeof chunk?.text === 'string') parts.push(chunk.text);
        else if (typeof chunk?.output_text === 'string') parts.push(chunk.output_text);
      }
    }
    return parts.join('');
  }

  // Last resort for a hand-rolled { output: { content } } shape.
  if (output && typeof output.content === 'string') return output.content;
  return '';
}

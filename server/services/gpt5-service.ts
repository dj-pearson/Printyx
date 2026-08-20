import OpenAI from 'openai';
import { createModuleLogger } from '../lib/logger';
import { withCrisisGuardrail } from '../lib/crisis-response';
const log = createModuleLogger('gpt5-service');

// AI-001: the prompt text, the model configs, the request body and the response
// parser below are mirrored in supabase/functions/_shared/gpt5-prompts.ts, which
// the ai-gpt5 edge function uses to serve the same endpoints in production.
// server/tests/unit/gpt5-prompts-parity.test.ts imports both and fails on drift.

// Configuration for different use cases in the Printyx platform
interface GPT5Config {
  model: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
  reasoning?: {
    effort: 'minimal' | 'low' | 'medium' | 'high';
  };
  text?: {
    verbosity: 'low' | 'medium' | 'high';
  };
  tools?: Array<any>;
  allowedTools?: {
    type: 'allowed_tools';
    mode: 'auto' | 'required';
    tools: Array<any>;
  };
}

// Pre-configured settings for different Printyx use cases
export const GPT5_CONFIGS = {
  // For CRM lead analysis and customer insights
  LEAD_ANALYSIS: {
    model: 'gpt-5-mini' as const,
    reasoning: { effort: 'medium' as const },
    text: { verbosity: 'medium' as const },
  },

  // For quote and proposal generation
  PROPOSAL_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const },
  },

  // For service ticket analysis and predictive maintenance
  SERVICE_ANALYSIS: {
    model: 'gpt-5-mini' as const,
    reasoning: { effort: 'medium' as const },
    text: { verbosity: 'medium' as const },
  },

  // For quick customer support responses
  CUSTOMER_SUPPORT: {
    model: 'gpt-5-nano' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'low' as const },
  },

  // For complex business analytics and forecasting
  BUSINESS_ANALYTICS: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const },
  },

  // For code generation and technical tasks
  CODE_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'medium' as const },
  },

  // For high-throughput classification tasks
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

// Custom tools for Printyx business operations
export const PRINTYX_TOOLS = {
  CRM_DATA_LOOKUP: {
    type: 'custom' as const,
    name: 'crm_data_lookup',
    description:
      'Looks up customer data, lead information, and business records from the Printyx CRM system',
  },

  EQUIPMENT_LOOKUP: {
    type: 'custom' as const,
    name: 'equipment_lookup',
    description: 'Retrieves equipment information, service history, and maintenance data',
  },

  FINANCIAL_ANALYSIS: {
    type: 'custom' as const,
    name: 'financial_analysis',
    description: 'Performs financial calculations, revenue analysis, and commission calculations',
  },

  PROPOSAL_BUILDER: {
    type: 'custom' as const,
    name: 'proposal_builder',
    description:
      'Generates professional proposals and quotes based on customer requirements and pricing data',
  },

  SERVICE_SCHEDULER: {
    type: 'custom' as const,
    name: 'service_scheduler',
    description: 'Schedules service appointments and optimizes technician routes',
  },
} as const;

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

/** Body for the Responses API call. */
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
 * This used to read `response.output?.content`, which is ALWAYS undefined:
 * `output` is an array of output items (reasoning items included), not an
 * object with a `content` string. Every endpoint therefore returned an empty
 * analysis/proposal/classification even when the API call succeeded. The SDK
 * exposes a flattened `output_text`; the raw REST payload the edge function
 * receives does not, so both shapes are handled.
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

export class GPT5Service {
  private openai: OpenAI | null = null;
  private isEnabled: boolean = false;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      log.warn('[GPT5Service] OPENAI_API_KEY not set - AI features will be disabled');
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.isEnabled = true;
  }

  private checkEnabled() {
    if (!this.isEnabled || !this.openai) {
      return { success: false as const, error: 'OpenAI API key not configured' };
    }
    return null;
  }

  /**
   * Generate response using GPT-5 Responses API
   * Recommended for most use cases as it supports chain of thought passing
   */
  async generateResponse(
    input: string,
    config: GPT5Config = GPT5_CONFIGS.LEAD_ANALYSIS,
    previousResponseId?: string,
  ) {
    const disabled = this.checkEnabled();
    if (disabled) return disabled;

    try {
      const requestData = buildResponsesRequest(input, config, previousResponseId);

      const response = await this.openai!.responses.create(requestData as any);

      return {
        success: true as const,
        data: response,
        responseId: response.id,
        content: extractResponseText(response),
        reasoning: (response as any).reasoning,
        usage: response.usage,
      };
    } catch (error) {
      log.error('GPT-5 Responses API error:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate response using Chat Completions API (fallback)
   * Use when Responses API is not suitable for the use case
   */
  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>,
    config: GPT5Config = GPT5_CONFIGS.LEAD_ANALYSIS,
  ) {
    const disabled = this.checkEnabled();
    if (disabled) return disabled;

    try {
      const requestData: any = {
        model: config.model,
        messages,
      };

      // Add GPT-5 specific parameters for Chat Completions
      if (config.reasoning?.effort) {
        requestData.reasoning_effort = config.reasoning.effort;
      }

      if (config.text?.verbosity) {
        requestData.verbosity = config.text.verbosity;
      }

      if (config.tools) {
        requestData.tools = config.tools;
      }

      const response = await this.openai!.chat.completions.create(requestData);

      return {
        success: true as const,
        data: response,
        content: response.choices[0]?.message?.content || '',
        usage: response.usage,
      };
    } catch (error) {
      log.error('GPT-5 Chat Completions error:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Analyze customer lead for qualification and insights
   */
  async analyzeCustomerLead(leadData: any, customerHistory?: any) {
    return this.generateResponse(
      buildLeadAnalysisPrompt(leadData, customerHistory),
      GPT5_CONFIGS.LEAD_ANALYSIS,
    );
  }

  /**
   * Generate professional proposal content
   */
  async generateProposal(customerData: any, equipmentRequirements: any, pricingData: any) {
    return this.generateResponse(
      buildProposalPrompt(customerData, equipmentRequirements, pricingData),
      GPT5_CONFIGS.PROPOSAL_GENERATION,
    );
  }

  /**
   * Analyze service ticket for predictive maintenance insights
   */
  async analyzeServiceTicket(ticketData: any, equipmentHistory?: any) {
    return this.generateResponse(
      buildServiceAnalysisPrompt(ticketData, equipmentHistory),
      GPT5_CONFIGS.SERVICE_ANALYSIS,
    );
  }

  /**
   * Generate customer support response
   */
  async generateSupportResponse(customerQuery: string, customerContext?: any) {
    return this.generateResponse(
      buildSupportResponsePrompt(customerQuery, customerContext),
      GPT5_CONFIGS.CUSTOMER_SUPPORT,
    );
  }

  /**
   * Perform business analytics and forecasting
   */
  async analyzeBusinessMetrics(salesData: any, serviceData: any, timeframe: string) {
    return this.generateResponse(
      buildBusinessAnalyticsPrompt(salesData, serviceData, timeframe),
      GPT5_CONFIGS.BUSINESS_ANALYTICS,
    );
  }

  /**
   * Classify and categorize customer inquiries
   */
  async classifyInquiry(inquiry: string) {
    return this.generateResponse(
      buildInquiryClassificationPrompt(inquiry),
      GPT5_CONFIGS.CLASSIFICATION,
    );
  }

  /**
   * Generate code for automation tasks
   */
  async generateAutomationCode(requirements: string, codeType: 'javascript' | 'python' | 'sql') {
    return this.generateResponse(
      buildAutomationCodePrompt(requirements, codeType),
      GPT5_CONFIGS.CODE_GENERATION,
    );
  }
}

export const gpt5Service = new GPT5Service();

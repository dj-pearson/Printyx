import OpenAI from "openai";

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
    text: { verbosity: 'medium' as const }
  },
  
  // For quote and proposal generation
  PROPOSAL_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const }
  },
  
  // For service ticket analysis and predictive maintenance
  SERVICE_ANALYSIS: {
    model: 'gpt-5-mini' as const,
    reasoning: { effort: 'medium' as const },
    text: { verbosity: 'medium' as const }
  },
  
  // For quick customer support responses
  CUSTOMER_SUPPORT: {
    model: 'gpt-5-nano' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'low' as const }
  },
  
  // For complex business analytics and forecasting
  BUSINESS_ANALYTICS: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'high' as const },
    text: { verbosity: 'high' as const }
  },
  
  // For code generation and technical tasks
  CODE_GENERATION: {
    model: 'gpt-5' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'medium' as const }
  },
  
  // For high-throughput classification tasks
  CLASSIFICATION: {
    model: 'gpt-5-nano' as const,
    reasoning: { effort: 'minimal' as const },
    text: { verbosity: 'low' as const }
  }
} as const;

// Custom tools for Printyx business operations
export const PRINTYX_TOOLS = {
  CRM_DATA_LOOKUP: {
    type: "custom" as const,
    name: "crm_data_lookup",
    description: "Looks up customer data, lead information, and business records from the Printyx CRM system"
  },
  
  EQUIPMENT_LOOKUP: {
    type: "custom" as const,
    name: "equipment_lookup", 
    description: "Retrieves equipment information, service history, and maintenance data"
  },
  
  FINANCIAL_ANALYSIS: {
    type: "custom" as const,
    name: "financial_analysis",
    description: "Performs financial calculations, revenue analysis, and commission calculations"
  },
  
  PROPOSAL_BUILDER: {
    type: "custom" as const,
    name: "proposal_builder",
    description: "Generates professional proposals and quotes based on customer requirements and pricing data"
  },
  
  SERVICE_SCHEDULER: {
    type: "custom" as const,
    name: "service_scheduler",
    description: "Schedules service appointments and optimizes technician routes"
  }
} as const;

export class GPT5Service {
  private openai: OpenAI;
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate response using GPT-5 Responses API
   * Recommended for most use cases as it supports chain of thought passing
   */
  async generateResponse(
    input: string,
    config: GPT5Config = GPT5_CONFIGS.LEAD_ANALYSIS,
    previousResponseId?: string
  ) {
    try {
      const requestData: any = {
        model: config.model,
        input,
        ...config
      };

      // Pass previous reasoning for better performance
      if (previousResponseId) {
        requestData.previous_response_id = previousResponseId;
      }

      const response = await this.openai.responses.create(requestData);
      
      return {
        success: true,
        data: response,
        responseId: response.id,
        content: response.output?.content || '',
        reasoning: response.reasoning,
        usage: response.usage
      };
    } catch (error) {
      console.error('GPT-5 Responses API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate response using Chat Completions API (fallback)
   * Use when Responses API is not suitable for the use case
   */
  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>,
    config: GPT5Config = GPT5_CONFIGS.LEAD_ANALYSIS
  ) {
    try {
      const requestData: any = {
        model: config.model,
        messages
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

      const response = await this.openai.chat.completions.create(requestData);
      
      return {
        success: true,
        data: response,
        content: response.choices[0]?.message?.content || '',
        usage: response.usage
      };
    } catch (error) {
      console.error('GPT-5 Chat Completions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Analyze customer lead for qualification and insights
   */
  async analyzeCustomerLead(leadData: any, customerHistory?: any) {
    const prompt = `You are a copier dealer sales analyst. Analyze this lead and provide insights:

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

    return this.generateResponse(prompt, GPT5_CONFIGS.LEAD_ANALYSIS);
  }

  /**
   * Generate professional proposal content
   */
  async generateProposal(customerData: any, equipmentRequirements: any, pricingData: any) {
    const prompt = `You are a professional proposal writer for a copier dealer. Create a comprehensive proposal:

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

    return this.generateResponse(prompt, GPT5_CONFIGS.PROPOSAL_GENERATION);
  }

  /**
   * Analyze service ticket for predictive maintenance insights
   */
  async analyzeServiceTicket(ticketData: any, equipmentHistory?: any) {
    const prompt = `You are a service analysis expert for copier equipment. Analyze this service ticket:

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

    return this.generateResponse(prompt, GPT5_CONFIGS.SERVICE_ANALYSIS);
  }

  /**
   * Generate customer support response
   */
  async generateSupportResponse(customerQuery: string, customerContext?: any) {
    const prompt = `You are a helpful customer support representative for a copier dealer. 
    
Customer Query: ${customerQuery}
${customerContext ? `Customer Context: ${JSON.stringify(customerContext, null, 2)}` : ''}

Provide a helpful, professional response that addresses their concern and offers next steps if needed.`;

    return this.generateResponse(prompt, GPT5_CONFIGS.CUSTOMER_SUPPORT);
  }

  /**
   * Perform business analytics and forecasting
   */
  async analyzeBusinessMetrics(salesData: any, serviceData: any, timeframe: string) {
    const prompt = `You are a business intelligence analyst for a copier dealer. Analyze these metrics:

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

    return this.generateResponse(prompt, GPT5_CONFIGS.BUSINESS_ANALYTICS);
  }

  /**
   * Classify and categorize customer inquiries
   */
  async classifyInquiry(inquiry: string) {
    const prompt = `Classify this customer inquiry into one of these categories:
- SALES: New equipment sales inquiry
- SERVICE: Equipment service or repair request  
- BILLING: Billing or payment related question
- SUPPORT: General product support question
- COMPLAINT: Customer complaint or issue
- OTHER: Does not fit other categories

Inquiry: "${inquiry}"

Respond with just the category name and confidence score (0-1).`;

    return this.generateResponse(prompt, GPT5_CONFIGS.CLASSIFICATION);
  }

  /**
   * Generate code for automation tasks
   */
  async generateAutomationCode(requirements: string, codeType: 'javascript' | 'python' | 'sql') {
    const prompt = `You are an expert developer creating automation code for a copier dealer management platform.

Requirements: ${requirements}
Code Type: ${codeType}

Generate clean, well-documented code that:
1. Follows best practices for ${codeType}
2. Includes error handling
3. Has clear comments explaining the logic
4. Is production-ready

Before calling any tools, explain why you're generating this specific code approach.`;

    return this.generateResponse(prompt, GPT5_CONFIGS.CODE_GENERATION);
  }
}

export const gpt5Service = new GPT5Service();
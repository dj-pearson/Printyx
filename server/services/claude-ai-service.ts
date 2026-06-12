/**

 * Claude AI Service
 * Handles all interactions with Claude API for Motion AI features
 */

import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('claude-ai-service');

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: string;
  stop_sequence: null;
  type: 'message';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeRequestOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
}

class ClaudeAIService {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';
  private defaultModel: string = 'claude-3-5-sonnet-20241022';

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    if (!this.apiKey) {
      log.warn('CLAUDE_API_KEY not found in environment variables');
    }
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error: any) {
      log.error('Claude API request failed:', error.message);
      throw error;
    }
  }

  async generateCompletion(options: ClaudeRequestOptions): Promise<string> {
    const requestData = {
      model: options.model || this.defaultModel,
      max_tokens: options.max_tokens || 4000,
      temperature: options.temperature || 0.7,
      system: options.system,
      messages: options.messages,
    };

    try {
      const response: ClaudeResponse = await this.makeRequest('/messages', requestData);
      return response.content[0]?.text || '';
    } catch (error) {
      log.error('Claude API error:', error);
      throw error;
    }
  }

  async analyzeLeadData(leadData: any): Promise<{
    score: number;
    conversionProbability: number;
    insights: string[];
    recommendedActions: string[];
    optimalContactTimes: string[];
  }> {
    try {
      const systemPrompt = `You are an AI sales assistant for copier dealers. Analyze lead data and return JSON with lead scoring and recommendations.`;

      const userPrompt = `Analyze this lead: ${JSON.stringify(leadData)}. Return JSON with keys: score, conversionProbability, insights, recommendedActions, optimalContactTimes`;

      const response = await this.generateCompletion({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
      });

      const analysis = JSON.parse(response);
      return {
        score: Math.min(100, Math.max(0, analysis.score || 50)),
        conversionProbability: Math.min(100, Math.max(0, analysis.conversionProbability || 25)),
        insights: Array.isArray(analysis.insights) ? analysis.insights : [],
        recommendedActions: Array.isArray(analysis.recommendedActions)
          ? analysis.recommendedActions
          : [],
        optimalContactTimes: Array.isArray(analysis.optimalContactTimes)
          ? analysis.optimalContactTimes
          : [],
      };
    } catch (error) {
      log.error('Error analyzing lead data:', error);
      return {
        score: 50,
        conversionProbability: 25,
        insights: ['AI analysis temporarily unavailable'],
        recommendedActions: ['Schedule initial contact call'],
        optimalContactTimes: ['Tuesday-Thursday 10am-4pm'],
      };
    }
  }
}

export default new ClaudeAIService();

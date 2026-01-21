/**
 * AI CSV Refinement Service
 *
 * Uses Claude AI to intelligently:
 * - Map columns from any CSV format to database fields
 * - Clean and normalize messy data
 * - Detect potential duplicates with AI-powered matching
 * - Suggest data transformations and enrichments
 *
 * Available only for Professional and Enterprise subscriptions
 */

import {
  ENTITY_TEMPLATES,
  type ColumnMapping,
  type TemplateColumn,
} from '@shared/csv-import-schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { csvImportJobs } from '@shared/csv-import-schema';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AIMappingResult {
  mappings: ColumnMapping[];
  unmappedColumns: string[];
  suggestions: AIColumnSuggestion[];
  confidence: number;
  tokensUsed: number;
}

interface AIColumnSuggestion {
  sourceColumn: string;
  suggestedField: string;
  reasoning: string;
  confidence: number;
  alternativeFields?: string[];
}

interface AIDataCleaningResult {
  cleanedData: Record<string, any>[];
  transformations: DataTransformation[];
  issues: DataIssue[];
  tokensUsed: number;
}

interface DataTransformation {
  rowNumber: number;
  field: string;
  originalValue: any;
  cleanedValue: any;
  transformationType: string;
  reason: string;
}

interface DataIssue {
  rowNumber: number;
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

interface AIDuplicateAnalysis {
  potentialDuplicates: AIDuplicateMatch[];
  tokensUsed: number;
}

interface AIDuplicateMatch {
  importRowNumber: number;
  existingRecordId: string;
  matchConfidence: number;
  reasoning: string;
  matchedFields: string[];
  suggestedAction: 'merge' | 'create_new' | 'skip' | 'review';
}

class AICsvRefinementService {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
  }

  private async makeRequest(
    messages: ClaudeMessage[],
    systemPrompt: string,
  ): Promise<ClaudeResponse> {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured. AI refinement requires CLAUDE_API_KEY.');
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3, // Lower temperature for more consistent mapping
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Use AI to intelligently map columns from a CSV to database fields
   */
  async aiMapColumns(
    sourceHeaders: string[],
    sampleData: Record<string, any>[],
    entityType: string,
  ): Promise<AIMappingResult> {
    const templateColumns = ENTITY_TEMPLATES[entityType] || [];

    // Build the prompt
    const systemPrompt = `You are a data import specialist. Your job is to map CSV columns to database fields for a ${entityType} import.

Available database fields and their descriptions:
${templateColumns.map((col) => `- ${col.dbField} (${col.type}): ${col.description}. Example: "${col.example}"`).join('\n')}

Rules:
1. Match columns based on meaning, not just exact name matching
2. Consider the sample data values when determining mappings
3. For each mapping, provide a confidence score (0-100)
4. If a column doesn't map to any field, mark it as unmapped
5. Provide reasoning for uncertain mappings

Respond with valid JSON only, no markdown formatting.`;

    const userMessage = `Map these CSV columns to database fields:

CSV Headers: ${JSON.stringify(sourceHeaders)}

Sample Data (first 3 rows):
${JSON.stringify(sampleData.slice(0, 3), null, 2)}

Respond with this exact JSON structure:
{
  "mappings": [
    {
      "sourceColumn": "column_name",
      "targetField": "db_field_name",
      "confidence": 95,
      "reasoning": "explanation"
    }
  ],
  "unmappedColumns": ["columns", "that", "dont", "map"],
  "suggestions": [
    {
      "sourceColumn": "ambiguous_column",
      "suggestedField": "best_guess_field",
      "reasoning": "why this might be the right field",
      "confidence": 70,
      "alternativeFields": ["other", "possible", "fields"]
    }
  ],
  "overallConfidence": 85
}`;

    try {
      const response = await this.makeRequest(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
      );

      const responseText = response.content[0]?.text || '{}';
      const parsed = JSON.parse(responseText);

      // Convert AI response to our ColumnMapping format
      const mappings: ColumnMapping[] = parsed.mappings.map((m: any) => {
        const templateCol = templateColumns.find((t) => t.dbField === m.targetField);
        return {
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          confidence: m.confidence,
          dataType: templateCol?.type || 'string',
          isRequired: templateCol?.required || false,
          aiSuggested: true,
          userConfirmed: m.confidence >= 90,
        };
      });

      return {
        mappings,
        unmappedColumns: parsed.unmappedColumns || [],
        suggestions: parsed.suggestions || [],
        confidence: parsed.overallConfidence || 0,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error: any) {
      console.error('AI column mapping failed:', error);
      throw new Error(`AI mapping failed: ${error.message}`);
    }
  }

  /**
   * Use AI to clean and normalize messy data
   */
  async aiCleanData(
    data: Record<string, any>[],
    mappings: ColumnMapping[],
    entityType: string,
  ): Promise<AIDataCleaningResult> {
    const systemPrompt = `You are a data cleaning specialist. Your job is to clean and normalize CSV data for a ${entityType} import.

Field types and expected formats:
${mappings.map((m) => `- ${m.sourceColumn} -> ${m.targetField} (${m.dataType})`).join('\n')}

Data cleaning rules:
1. Standardize phone numbers to format: (XXX) XXX-XXXX
2. Lowercase and validate email addresses
3. Standardize date formats to YYYY-MM-DD
4. Clean currency values (remove $, commas, convert to number)
5. Trim whitespace from all values
6. Fix common typos and inconsistencies
7. Identify potentially missing or invalid data

Respond with valid JSON only, no markdown formatting.`;

    // Process in batches of 20 rows to avoid token limits
    const batchSize = 20;
    const allTransformations: DataTransformation[] = [];
    const allIssues: DataIssue[] = [];
    const cleanedData: Record<string, any>[] = [];
    let totalTokens = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const startRow = i + 1;

      const userMessage = `Clean this batch of data (rows ${startRow}-${startRow + batch.length - 1}):

${JSON.stringify(batch, null, 2)}

Respond with this JSON structure:
{
  "cleanedRows": [
    { /* cleaned row data */ }
  ],
  "transformations": [
    {
      "rowOffset": 0,
      "field": "field_name",
      "originalValue": "original",
      "cleanedValue": "cleaned",
      "transformationType": "phone_format|email_lowercase|date_format|currency|whitespace|typo",
      "reason": "why this change was made"
    }
  ],
  "issues": [
    {
      "rowOffset": 0,
      "field": "field_name",
      "issue": "description of the problem",
      "severity": "error|warning|info",
      "suggestion": "how to fix it"
    }
  ]
}`;

      try {
        const response = await this.makeRequest(
          [{ role: 'user', content: userMessage }],
          systemPrompt,
        );

        const responseText = response.content[0]?.text || '{}';
        const parsed = JSON.parse(responseText);

        // Add cleaned rows
        cleanedData.push(...(parsed.cleanedRows || batch));

        // Add transformations with correct row numbers
        for (const t of parsed.transformations || []) {
          allTransformations.push({
            ...t,
            rowNumber: startRow + (t.rowOffset || 0),
          });
        }

        // Add issues with correct row numbers
        for (const issue of parsed.issues || []) {
          allIssues.push({
            ...issue,
            rowNumber: startRow + (issue.rowOffset || 0),
          });
        }

        totalTokens += response.usage.input_tokens + response.usage.output_tokens;
      } catch (error: any) {
        console.error(`AI data cleaning failed for batch starting at row ${startRow}:`, error);
        // Fall back to original data for this batch
        cleanedData.push(...batch);
      }
    }

    return {
      cleanedData,
      transformations: allTransformations,
      issues: allIssues,
      tokensUsed: totalTokens,
    };
  }

  /**
   * Use AI to analyze potential duplicates with intelligent matching
   */
  async aiAnalyzeDuplicates(
    importRow: Record<string, any>,
    potentialMatches: Record<string, any>[],
    entityType: string,
    rowNumber: number,
  ): Promise<AIDuplicateMatch[]> {
    if (potentialMatches.length === 0) {
      return [];
    }

    const systemPrompt = `You are a data deduplication specialist. Analyze whether the import row is a duplicate of any existing records for ${entityType}.

Consider:
1. Name variations (abbreviations, typos, different formats)
2. Phone number formats (may be formatted differently)
3. Email domain matches (same company)
4. Address variations
5. Whether new data adds value to existing record

Respond with valid JSON only, no markdown formatting.`;

    const userMessage = `Analyze this import row for duplicates:

Import Row:
${JSON.stringify(importRow, null, 2)}

Potential Existing Matches:
${JSON.stringify(potentialMatches, null, 2)}

For each potential match, respond with:
{
  "matches": [
    {
      "existingRecordId": "id of the existing record",
      "matchConfidence": 85,
      "reasoning": "Why these might be the same entity",
      "matchedFields": ["companyName", "email"],
      "suggestedAction": "merge|create_new|skip|review",
      "actionReasoning": "Why this action is recommended"
    }
  ]
}

If none are true duplicates, return { "matches": [] }`;

    try {
      const response = await this.makeRequest(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
      );

      const responseText = response.content[0]?.text || '{}';
      const parsed = JSON.parse(responseText);

      return (parsed.matches || []).map((m: any) => ({
        importRowNumber: rowNumber,
        existingRecordId: m.existingRecordId,
        matchConfidence: m.matchConfidence,
        reasoning: m.reasoning,
        matchedFields: m.matchedFields || [],
        suggestedAction: m.suggestedAction || 'review',
      }));
    } catch (error: any) {
      console.error('AI duplicate analysis failed:', error);
      return [];
    }
  }

  /**
   * Process an entire import job with AI refinement
   */
  async processImportWithAI(
    jobId: string,
    csvData: Record<string, any>[],
    headers: string[],
    entityType: string,
  ): Promise<{
    mappings: ColumnMapping[];
    cleanedData: Record<string, any>[];
    issues: DataIssue[];
    totalTokensUsed: number;
  }> {
    let totalTokens = 0;

    // Step 1: AI Column Mapping
    console.log(`[AI Import] Starting AI column mapping for job ${jobId}`);
    const mappingResult = await this.aiMapColumns(headers, csvData.slice(0, 5), entityType);
    totalTokens += mappingResult.tokensUsed;

    // Update job with AI mapping confidence
    await db
      .update(csvImportJobs)
      .set({
        columnMappings: mappingResult.mappings,
        unmappedColumns: mappingResult.unmappedColumns,
        aiMappingConfidence: mappingResult.confidence,
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));

    // Step 2: AI Data Cleaning (if we have high enough mapping confidence)
    let cleanedData = csvData;
    let issues: DataIssue[] = [];

    if (mappingResult.confidence >= 70) {
      console.log(`[AI Import] Starting AI data cleaning for job ${jobId}`);
      const cleaningResult = await this.aiCleanData(csvData, mappingResult.mappings, entityType);
      cleanedData = cleaningResult.cleanedData;
      issues = cleaningResult.issues;
      totalTokens += cleaningResult.tokensUsed;

      // Log transformations for audit
      if (cleaningResult.transformations.length > 0) {
        console.log(
          `[AI Import] Applied ${cleaningResult.transformations.length} data transformations`,
        );
      }
    }

    // Update job with token usage
    await db
      .update(csvImportJobs)
      .set({
        aiProcessingCost: totalTokens,
        transformedData: cleanedData,
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));

    return {
      mappings: mappingResult.mappings,
      cleanedData,
      issues,
      totalTokensUsed: totalTokens,
    };
  }

  /**
   * Generate a human-readable summary of AI processing
   */
  generateProcessingSummary(
    mappingResult: AIMappingResult,
    cleaningResult?: AIDataCleaningResult,
  ): string {
    const lines: string[] = [];

    lines.push('## AI Import Processing Summary\n');

    // Mapping summary
    lines.push('### Column Mapping');
    lines.push(`- Overall Confidence: ${mappingResult.confidence}%`);
    lines.push(`- Mapped Columns: ${mappingResult.mappings.length}`);
    lines.push(`- Unmapped Columns: ${mappingResult.unmappedColumns.length}`);

    if (mappingResult.unmappedColumns.length > 0) {
      lines.push(`- Unmapped: ${mappingResult.unmappedColumns.join(', ')}`);
    }

    if (mappingResult.suggestions.length > 0) {
      lines.push('\n**Suggestions for Review:**');
      for (const s of mappingResult.suggestions) {
        lines.push(
          `- ${s.sourceColumn}: Consider mapping to "${s.suggestedField}" (${s.confidence}% confidence)`,
        );
        lines.push(`  Reason: ${s.reasoning}`);
      }
    }

    // Cleaning summary
    if (cleaningResult) {
      lines.push('\n### Data Cleaning');
      lines.push(`- Transformations Applied: ${cleaningResult.transformations.length}`);
      lines.push(`- Issues Found: ${cleaningResult.issues.length}`);

      const errors = cleaningResult.issues.filter((i) => i.severity === 'error');
      const warnings = cleaningResult.issues.filter((i) => i.severity === 'warning');

      if (errors.length > 0) {
        lines.push(`- Errors: ${errors.length}`);
      }
      if (warnings.length > 0) {
        lines.push(`- Warnings: ${warnings.length}`);
      }
    }

    // Token usage
    const totalTokens = mappingResult.tokensUsed + (cleaningResult?.tokensUsed || 0);
    lines.push(`\n### Processing Cost`);
    lines.push(`- Tokens Used: ${totalTokens.toLocaleString()}`);
    lines.push(`- Estimated Cost: $${(totalTokens * 0.000003).toFixed(4)}`); // Rough estimate

    return lines.join('\n');
  }

  /**
   * Check if AI refinement is available (API key configured)
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const aiCsvRefinementService = new AICsvRefinementService();

export default AICsvRefinementService;

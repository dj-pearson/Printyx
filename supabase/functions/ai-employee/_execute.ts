// Task execution engine — ported from server/services/ai-employee-service.ts::249-551.
//
// Called asynchronously after a task row is inserted. Updates the row through
// its lifecycle (assigned → in_progress → completed|failed) and dispatches to a
// Claude-backed handler based on task_type. Non-Claude branches exist for
// task types whose "real work" is happening elsewhere (e.g. lead_qualification
// belongs to the lead-scoring edge function — we call it pseudo-synchronously
// by running a Claude analysis prompt and storing the structured result).

import type { SupabaseClient } from '../_shared/db.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('ai-employee-execute');

interface ExecutionResult {
  success: boolean;
  result: Record<string, unknown>;
  qualityScore: number;
  confidence: number;
  executionTimeMinutes: number;
  errors?: string[];
}

export async function executeTask(
  db: SupabaseClient,
  taskId: string,
  tenantId: string,
): Promise<void> {
  try {
    // Mark in_progress.
    await db
      .from('ai_employee_tasks')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        progress_percentage: 10,
      })
      .eq('id', taskId)
      .eq('tenant_id', tenantId);

    const { data: task, error: taskErr } = await db
      .from('ai_employee_tasks')
      .select('id, task_type, task_title, task_description, task_context, input_data, employee_id')
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (taskErr || !task) {
      log.error({ taskId, err: taskErr?.message }, 'task_not_found');
      return;
    }

    const result = await performTaskExecution(task);

    await db
      .from('ai_employee_tasks')
      .update({
        status: result.success ? 'completed' : 'failed',
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        task_result: result.result,
        quality_score: result.qualityScore,
        ai_confidence_score: result.confidence,
        execution_time_minutes: result.executionTimeMinutes,
        error_messages: result.errors ?? [],
      })
      .eq('id', taskId);

    if (task.employee_id) {
      await updateEmployeeStats(db, task.employee_id, tenantId);
    }
  } catch (err) {
    log.error({ taskId, err: String(err) }, 'execute_task_failed');
    await db
      .from('ai_employee_tasks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_messages: [String(err)],
      })
      .eq('id', taskId);
  }
}

async function performTaskExecution(task: {
  task_type: string;
  task_title: string;
  task_description: string | null;
  task_context: Record<string, unknown>;
  input_data: Record<string, unknown>;
}): Promise<ExecutionResult> {
  const t0 = Date.now();

  try {
    let result: Record<string, unknown>;
    let confidence = 0.8;
    let qualityScore = 75;

    switch (task.task_type) {
      case 'lead_qualification':
        result = await runLeadQualification(task.input_data);
        confidence = 0.85;
        qualityScore = 80;
        break;
      case 'customer_support':
        result = await runCustomerSupport(task.input_data);
        confidence = 0.82;
        qualityScore = 78;
        break;
      case 'data_analysis':
        result = await runDataAnalysis(task.input_data);
        confidence = 0.9;
        qualityScore = 85;
        break;
      case 'report_generation':
        result = await runReportGeneration(task.input_data);
        confidence = 0.88;
        qualityScore = 82;
        break;
      case 'email_outreach':
        result = await runEmailOutreach(task.input_data);
        confidence = 0.83;
        qualityScore = 79;
        break;
      default:
        result = await runGenericTask(task);
        confidence = 0.75;
        qualityScore = 70;
    }

    return {
      success: true,
      result,
      qualityScore,
      confidence,
      executionTimeMinutes: Math.max(1, Math.round((Date.now() - t0) / 60_000)),
    };
  } catch (err) {
    return {
      success: false,
      result: { error: 'Task execution failed' },
      qualityScore: 0,
      confidence: 0,
      executionTimeMinutes: Math.max(1, Math.round((Date.now() - t0) / 60_000)),
      errors: [String(err)],
    };
  }
}

async function runLeadQualification(
  leadData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const system =
    'You are an AI sales assistant for copier dealers. Analyze lead data and return JSON with lead scoring and recommendations.';
  const userPrompt =
    `Analyze this lead: ${JSON.stringify(leadData)}. Return JSON with keys: ` +
    'score (0-100), conversionProbability (0-100), insights (string[]), recommendedActions (string[]), optimalContactTimes (string[])';

  const raw = await generateCompletion({
    system,
    messages: [{ role: 'user', content: userPrompt }],
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
    // Model produced prose, not JSON — fall back to safe defaults.
  }

  const score = Math.min(100, Math.max(0, Number(analysis.score ?? 50)));
  return {
    leadScore: score,
    conversionProbability: Math.min(100, Math.max(0, Number(analysis.conversionProbability ?? 25))),
    qualificationStatus: score >= 70 ? 'qualified' : 'not_qualified',
    insights: Array.isArray(analysis.insights) ? analysis.insights : [],
    recommendedActions: Array.isArray(analysis.recommendedActions)
      ? analysis.recommendedActions
      : [],
    optimalContactTimes: Array.isArray(analysis.optimalContactTimes)
      ? analysis.optimalContactTimes
      : ['Tuesday-Thursday 10am-4pm'],
    aiRecommendation: score >= 70 ? 'Proceed with sales process' : 'Continue lead nurturing',
  };
}

async function runCustomerSupport(
  ticket: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const description = String(ticket.description ?? '');
  const response = await generateCompletion({
    system:
      'You are a customer support AI specialist. Analyze the support request and provide a comprehensive response with solution steps.',
    messages: [
      {
        role: 'user',
        content:
          `Support Request: ${description}\n` +
          `Customer: ${ticket.customerName ?? 'Unknown'}\n` +
          `Priority: ${ticket.priority ?? 'medium'}\n\n` +
          'Provide a detailed response with solution steps.',
      },
    ],
    temperature: 0.3,
  });

  return {
    ticketId: ticket.ticketId,
    customerName: ticket.customerName,
    issueCategory: categorizeIssue(description),
    priority: assessPriority(ticket),
    estimatedResolutionTime: estimateResolutionTime(description),
    solution: response,
    status: 'resolved',
    followUpRequired: /complex|multiple|ongoing|recurring/i.test(description),
  };
}

async function runDataAnalysis(req: Record<string, unknown>): Promise<Record<string, unknown>> {
  const insights = await generateCompletion({
    system:
      'You are a business intelligence analyst. Analyze the provided data and generate actionable insights.',
    messages: [
      {
        role: 'user',
        content:
          `Data Analysis Request: ${req.description ?? ''}\n` +
          `Data Source: ${req.dataSource ?? ''}\n` +
          `Analysis Type: ${req.analysisType ?? ''}\n\n` +
          'Provide detailed insights and recommendations.',
      },
    ],
    temperature: 0.2,
  });

  return {
    analysisType: req.analysisType,
    dataSource: req.dataSource,
    detailedAnalysis: insights,
    confidence: 0.88,
    dataQuality: 'high',
  };
}

async function runReportGeneration(req: Record<string, unknown>): Promise<Record<string, unknown>> {
  const content = await generateCompletion({
    system:
      'You are a business report writer. Generate a comprehensive report based on the requirements.',
    messages: [
      {
        role: 'user',
        content:
          `Report Request: ${req.reportType ?? ''}\n` +
          `Time Period: ${req.timePeriod ?? ''}\n` +
          `Audience: ${req.audience ?? ''}\n` +
          `Key Metrics: ${JSON.stringify(req.keyMetrics ?? {})}\n\n` +
          'Generate a professional business report.',
      },
    ],
    temperature: 0.3,
  });

  return {
    reportType: req.reportType,
    timePeriod: req.timePeriod,
    generatedAt: new Date().toISOString(),
    content,
    keyMetrics: req.keyMetrics ?? {},
  };
}

async function runEmailOutreach(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const content = await generateCompletion({
    system:
      'You are a professional sales email writer. Create personalized outreach emails that are engaging and professional.',
    messages: [
      {
        role: 'user',
        content:
          `Create an email for: ${data.recipientName ?? ''}\n` +
          `Company: ${data.company ?? ''}\n` +
          `Objective: ${data.objective ?? ''}\n` +
          `Personalization: ${JSON.stringify(data.personalization ?? {})}`,
      },
    ],
    temperature: 0.7,
  });

  return {
    recipientName: data.recipientName,
    recipientEmail: data.recipientEmail,
    subject: `${data.recipientName}, quick question about ${data.company}`,
    content,
    personalizedElements: data.personalization ?? {},
    followUpScheduled: true,
    followUpDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  };
}

async function runGenericTask(task: {
  task_type: string;
  task_title: string;
  task_description: string | null;
  task_context: Record<string, unknown>;
  input_data: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const response = await generateCompletion({
    system:
      'You are a versatile AI assistant. Complete the requested task professionally and thoroughly.',
    messages: [
      {
        role: 'user',
        content:
          `Task: ${task.task_title}\n` +
          `Description: ${task.task_description ?? ''}\n` +
          `Context: ${JSON.stringify(task.task_context)}\n` +
          `Input: ${JSON.stringify(task.input_data)}`,
      },
    ],
    temperature: 0.5,
  });

  return {
    taskType: task.task_type,
    result: response,
    completedAt: new Date().toISOString(),
    success: true,
  };
}

function categorizeIssue(description: string): string {
  const buckets: Record<string, string[]> = {
    technical: ['error', 'bug', 'crash', 'not working', 'broken'],
    billing: ['payment', 'invoice', 'charge', 'billing', 'cost'],
    account: ['login', 'password', 'access', 'account', 'profile'],
    feature: ['how to', 'tutorial', 'guide', 'help', 'feature'],
  };
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(buckets)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return 'general';
}

function assessPriority(ticket: Record<string, unknown>): string {
  if (ticket.priority) return String(ticket.priority);
  const description = String(ticket.description ?? '').toLowerCase();
  return /urgent|critical|down|broken|emergency/.test(description) ? 'high' : 'medium';
}

function estimateResolutionTime(description: string): number {
  const category = categorizeIssue(description);
  return { technical: 45, billing: 30, account: 20, feature: 15, general: 25 }[category] ?? 30;
}

async function updateEmployeeStats(
  db: SupabaseClient,
  employeeId: string,
  tenantId: string,
): Promise<void> {
  // Count completed tasks to recompute success_rate. This is the approach
  // used by the Express service; it's O(N) per task update, but N per
  // employee is small.
  const { data: rows } = await db
    .from('ai_employee_tasks')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);

  const total = rows?.length ?? 0;
  const completed = rows?.filter((r) => r.status === 'completed').length ?? 0;
  const successRate = total > 0 ? completed / total : 0;

  await db
    .from('ai_employees')
    .update({
      total_tasks_completed: completed,
      success_rate: successRate,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .eq('tenant_id', tenantId);
}

// server/services/ai-employee-service.ts
import { db } from '../db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import ClaudeAIService from './claude-ai-service';

// Mock schemas - in real implementation these would come from shared/ai-employee-schema.ts
const aiEmployees = {
  id: 'id',
  tenantId: 'tenant_id',
  employeeName: 'employee_name',
  employeeType: 'employee_type',
  employeeRole: 'employee_role',
  aiPersonality: 'ai_personality',
  aiExpertiseAreas: 'ai_expertise_areas',
  aiCapabilities: 'ai_capabilities',
  autonomyLevel: 'autonomy_level',
  decisionThreshold: 'decision_threshold',
  status: 'status',
  successRate: 'success_rate',
  totalTasksCompleted: 'total_tasks_completed',
  userSatisfactionRating: 'user_satisfaction_rating',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

const aiEmployeeTasks = {
  id: 'id',
  tenantId: 'tenant_id',
  employeeId: 'employee_id',
  taskType: 'task_type',
  taskTitle: 'task_title',
  taskDescription: 'task_description',
  taskPriority: 'task_priority',
  taskContext: 'task_context',
  inputData: 'input_data',
  status: 'status',
  progressPercentage: 'progress_percentage',
  taskResult: 'task_result',
  qualityScore: 'quality_score',
  aiConfidenceScore: 'ai_confidence_score',
  executionTimeMinutes: 'execution_time_minutes',
  assignedAt: 'assigned_at',
  completedAt: 'completed_at',
  dueDate: 'due_date'
};

const aiEmployeeWorkflows = {
  id: 'id',
  tenantId: 'tenant_id',
  workflowName: 'workflow_name',
  workflowType: 'workflow_type',
  workflowDescription: 'workflow_description',
  workflowSteps: 'workflow_steps',
  employeeAssignments: 'employee_assignments',
  status: 'status',
  successRate: 'success_rate',
  totalExecutions: 'total_executions'
};

interface AIEmployee {
  id: string;
  tenantId: string;
  employeeName: string;
  employeeType: string;
  employeeRole: string;
  aiPersonality: any;
  aiExpertiseAreas: string[];
  aiCapabilities: string[];
  autonomyLevel: string;
  decisionThreshold: number;
  status: string;
  successRate: number;
  totalTasksCompleted: number;
  userSatisfactionRating: number;
}

interface AIEmployeeTask {
  id: string;
  tenantId: string;
  employeeId: string;
  taskType: string;
  taskTitle: string;
  taskDescription: string;
  taskPriority: string;
  taskContext: any;
  inputData: any;
  status: string;
  progressPercentage: number;
  taskResult: any;
  qualityScore?: number;
  aiConfidenceScore?: number;
  executionTimeMinutes?: number;
  assignedAt: Date;
  completedAt?: Date;
  dueDate?: Date;
}

interface WorkflowExecution {
  workflowId: string;
  inputData: any;
  triggeredBy: string;
  triggerData?: any;
}

class AIEmployeeService {
  private claudeAIService: any;

  constructor() {
    this.claudeAIService = ClaudeAIService;
  }

  // --- Employee Management ---

  async createEmployee(tenantId: string, employeeData: {
    employeeName: string;
    employeeType: string;
    employeeRole: string;
    aiPersonality?: any;
    aiExpertiseAreas?: string[];
    aiCapabilities?: string[];
    autonomyLevel?: string;
    createdBy: string;
  }): Promise<AIEmployee> {
    try {
      // Use raw SQL since we don't have the actual schema imported
      const result = await db.execute(sql`
        INSERT INTO ai_employees (
          tenant_id, employee_name, employee_type, employee_role,
          ai_personality, ai_expertise_areas, ai_capabilities, autonomy_level, created_by
        ) VALUES (
          ${tenantId}, ${employeeData.employeeName}, ${employeeData.employeeType}, ${employeeData.employeeRole},
          ${JSON.stringify(employeeData.aiPersonality || {})}, ${JSON.stringify(employeeData.aiExpertiseAreas || [])},
          ${JSON.stringify(employeeData.aiCapabilities || [])}, ${employeeData.autonomyLevel || 'supervised'}, ${employeeData.createdBy}
        ) RETURNING *
      `);

      // Initialize default skills for the employee
      await this.initializeEmployeeSkills(tenantId, result.rows[0].id, employeeData.employeeType);

      return result.rows[0] as AIEmployee;
    } catch (error) {
      console.error('Error creating AI employee:', error);
      throw new Error('Failed to create AI employee');
    }
  }

  async getEmployee(tenantId: string, employeeId: string): Promise<AIEmployee | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM ai_employees 
        WHERE tenant_id = ${tenantId} AND id = ${employeeId}
      `);
      
      return result.rows[0] as AIEmployee || null;
    } catch (error) {
      console.error('Error fetching AI employee:', error);
      return null;
    }
  }

  async getEmployees(tenantId: string, filters?: {
    employeeType?: string;
    status?: string;
    autonomyLevel?: string;
  }): Promise<AIEmployee[]> {
    try {
      let query = `SELECT * FROM ai_employees WHERE tenant_id = '${tenantId}'`;
      
      if (filters?.employeeType) {
        query += ` AND employee_type = '${filters.employeeType}'`;
      }
      if (filters?.status) {
        query += ` AND status = '${filters.status}'`;
      }
      if (filters?.autonomyLevel) {
        query += ` AND autonomy_level = '${filters.autonomyLevel}'`;
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await db.execute(sql.raw(query));
      return result.rows as AIEmployee[];
    } catch (error) {
      console.error('Error fetching AI employees:', error);
      return [];
    }
  }

  // --- Task Management ---

  async assignTask(tenantId: string, taskData: {
    employeeId?: string;
    taskType: string;
    taskTitle: string;
    taskDescription: string;
    taskPriority?: string;
    taskContext: any;
    inputData?: any;
    dueDate?: Date;
  }): Promise<AIEmployeeTask> {
    try {
      // Auto-assign employee if not specified
      let employeeId = taskData.employeeId;
      if (!employeeId) {
        employeeId = await this.findBestEmployeeForTask(tenantId, taskData.taskType, taskData.taskContext);
      }

      const result = await db.execute(sql`
        INSERT INTO ai_employee_tasks (
          tenant_id, employee_id, task_type, task_title, task_description,
          task_priority, task_context, input_data, due_date, status
        ) VALUES (
          ${tenantId}, ${employeeId}, ${taskData.taskType}, ${taskData.taskTitle}, ${taskData.taskDescription},
          ${taskData.taskPriority || 'medium'}, ${JSON.stringify(taskData.taskContext)}, 
          ${JSON.stringify(taskData.inputData || {})}, ${taskData.dueDate}, 'assigned'
        ) RETURNING *
      `);

      const task = result.rows[0] as AIEmployeeTask;

      // Start task execution asynchronously
      this.executeTask(task.id, tenantId);

      return task;
    } catch (error) {
      console.error('Error assigning task:', error);
      throw new Error('Failed to assign task');
    }
  }

  async executeTask(taskId: string, tenantId: string): Promise<void> {
    try {
      // Update task status to in_progress
      await db.execute(sql`
        UPDATE ai_employee_tasks 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP, progress_percentage = 10
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `);

      // Get task and employee details
      const taskResult = await db.execute(sql`
        SELECT t.*, e.employee_type, e.ai_capabilities, e.ai_personality, e.autonomy_level, e.decision_threshold
        FROM ai_employee_tasks t
        JOIN ai_employees e ON t.employee_id = e.id
        WHERE t.id = ${taskId} AND t.tenant_id = ${tenantId}
      `);

      if (!taskResult.rows[0]) {
        throw new Error('Task or employee not found');
      }

      const taskData = taskResult.rows[0];
      
      // Execute task based on type
      const executionResult = await this.performTaskExecution(taskData);

      // Update task with results
      await db.execute(sql`
        UPDATE ai_employee_tasks 
        SET 
          status = ${executionResult.success ? 'completed' : 'failed'},
          progress_percentage = 100,
          completed_at = CURRENT_TIMESTAMP,
          task_result = ${JSON.stringify(executionResult.result)},
          quality_score = ${executionResult.qualityScore},
          ai_confidence_score = ${executionResult.confidence},
          execution_time_minutes = ${executionResult.executionTimeMinutes},
          error_messages = ${JSON.stringify(executionResult.errors || [])}
        WHERE id = ${taskId}
      `);

      // Update employee statistics
      await this.updateEmployeeStats(taskData.employee_id, tenantId, executionResult.success);

    } catch (error) {
      console.error('Error executing task:', error);
      
      // Mark task as failed
      await db.execute(sql`
        UPDATE ai_employee_tasks 
        SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_messages = ${JSON.stringify([error.message])}
        WHERE id = ${taskId}
      `);
    }
  }

  private async performTaskExecution(taskData: any): Promise<{
    success: boolean;
    result: any;
    qualityScore: number;
    confidence: number;
    executionTimeMinutes: number;
    errors?: string[];
  }> {
    const startTime = Date.now();

    try {
      let result;
      let confidence = 0.8;
      let qualityScore = 75;

      switch (taskData.task_type) {
        case 'lead_qualification':
          result = await this.performLeadQualification(taskData);
          confidence = 0.85;
          qualityScore = 80;
          break;

        case 'customer_support':
          result = await this.performCustomerSupport(taskData);
          confidence = 0.82;
          qualityScore = 78;
          break;

        case 'data_analysis':
          result = await this.performDataAnalysis(taskData);
          confidence = 0.90;
          qualityScore = 85;
          break;

        case 'report_generation':
          result = await this.performReportGeneration(taskData);
          confidence = 0.88;
          qualityScore = 82;
          break;

        case 'email_outreach':
          result = await this.performEmailOutreach(taskData);
          confidence = 0.83;
          qualityScore = 79;
          break;

        default:
          result = await this.performGenericTask(taskData);
          confidence = 0.75;
          qualityScore = 70;
      }

      const executionTimeMinutes = Math.round((Date.now() - startTime) / (1000 * 60));

      return {
        success: true,
        result,
        qualityScore,
        confidence,
        executionTimeMinutes: Math.max(1, executionTimeMinutes) // Minimum 1 minute
      };

    } catch (error) {
      const executionTimeMinutes = Math.round((Date.now() - startTime) / (1000 * 60));
      
      return {
        success: false,
        result: { error: 'Task execution failed' },
        qualityScore: 0,
        confidence: 0,
        executionTimeMinutes: Math.max(1, executionTimeMinutes),
        errors: [error.message]
      };
    }
  }

  // --- Specialized Task Execution Methods ---

  private async performLeadQualification(taskData: any): Promise<any> {
    const leadData = taskData.input_data;
    
    const analysis = await this.claudeAIService.analyzeLeadData(leadData);
    
    return {
      leadScore: analysis.score,
      conversionProbability: analysis.conversionProbability,
      qualificationStatus: analysis.score >= 70 ? 'qualified' : 'not_qualified',
      insights: analysis.insights,
      recommendedActions: analysis.recommendedActions,
      nextSteps: analysis.score >= 70 ? 
        ['Schedule discovery call', 'Send product information', 'Add to nurture sequence'] :
        ['Continue nurturing', 'Gather more information', 'Re-evaluate in 30 days'],
      aiRecommendation: analysis.score >= 70 ? 'Proceed with sales process' : 'Continue lead nurturing',
      confidence: 0.85
    };
  }

  private async performCustomerSupport(taskData: any): Promise<any> {
    const supportTicket = taskData.input_data;
    
    // Use AI to analyze the support request
    const response = await this.claudeAIService.generateCompletion({
      system: `You are a customer support AI specialist. Analyze the support request and provide a comprehensive response with solution steps.`,
      messages: [
        {
          role: 'user',
          content: `Support Request: ${supportTicket.description}\nCustomer: ${supportTicket.customerName}\nPriority: ${supportTicket.priority || 'medium'}\n\nProvide a detailed response with solution steps.`
        }
      ],
      temperature: 0.3
    });

    return {
      ticketId: supportTicket.ticketId,
      customerName: supportTicket.customerName,
      issueCategory: this.categorizeIssue(supportTicket.description),
      priority: this.assessPriority(supportTicket),
      estimatedResolutionTime: this.estimateResolutionTime(supportTicket),
      solution: response,
      status: 'resolved',
      followUpRequired: this.requiresFollowUp(supportTicket),
      customerSatisfactionPrediction: 4.2,
      escalationRecommended: false
    };
  }

  private async performDataAnalysis(taskData: any): Promise<any> {
    const analysisRequest = taskData.input_data;
    
    // Simulate data analysis
    const insights = await this.claudeAIService.generateCompletion({
      system: `You are a business intelligence analyst. Analyze the provided data and generate actionable insights.`,
      messages: [
        {
          role: 'user',
          content: `Data Analysis Request: ${analysisRequest.description}\nData Source: ${analysisRequest.dataSource}\nAnalysis Type: ${analysisRequest.analysisType}\n\nProvide detailed insights and recommendations.`
        }
      ],
      temperature: 0.2
    });

    return {
      analysisType: analysisRequest.analysisType,
      dataSource: analysisRequest.dataSource,
      keyInsights: [
        'Revenue increased 15% compared to last quarter',
        'Customer acquisition cost decreased by 8%',
        'Top performing product category: Office Equipment'
      ],
      trends: [
        { metric: 'Revenue', trend: 'increasing', change: '+15%' },
        { metric: 'Customer Count', trend: 'stable', change: '+2%' },
        { metric: 'Average Deal Size', trend: 'increasing', change: '+12%' }
      ],
      recommendations: [
        'Focus marketing budget on high-performing channels',
        'Expand office equipment product line',
        'Implement customer retention program'
      ],
      detailedAnalysis: insights,
      confidence: 0.88,
      dataQuality: 'high'
    };
  }

  private async performReportGeneration(taskData: any): Promise<any> {
    const reportRequest = taskData.input_data;
    
    const reportContent = await this.claudeAIService.generateCompletion({
      system: `You are a business report writer. Generate a comprehensive report based on the requirements.`,
      messages: [
        {
          role: 'user',
          content: `Report Request: ${reportRequest.reportType}\nTime Period: ${reportRequest.timePeriod}\nAudience: ${reportRequest.audience}\nKey Metrics: ${JSON.stringify(reportRequest.keyMetrics)}\n\nGenerate a professional business report.`
        }
      ],
      temperature: 0.3
    });

    return {
      reportType: reportRequest.reportType,
      timePeriod: reportRequest.timePeriod,
      generatedAt: new Date().toISOString(),
      content: reportContent,
      keyMetrics: reportRequest.keyMetrics,
      executiveSummary: 'Performance exceeded expectations with strong growth across all key metrics.',
      visualizations: [
        { type: 'bar_chart', title: 'Monthly Revenue', data: 'mock_data' },
        { type: 'line_chart', title: 'Customer Growth', data: 'mock_data' }
      ],
      recommendations: [
        'Continue current growth strategies',
        'Invest in customer retention programs',
        'Explore new market opportunities'
      ],
      confidence: 0.87
    };
  }

  private async performEmailOutreach(taskData: any): Promise<any> {
    const outreachData = taskData.input_data;
    
    const emailContent = await this.claudeAIService.generateCompletion({
      system: `You are a professional sales email writer. Create personalized outreach emails that are engaging and professional.`,
      messages: [
        {
          role: 'user',
          content: `Create an email for: ${outreachData.recipientName}\nCompany: ${outreachData.company}\nObjective: ${outreachData.objective}\nPersonalization: ${JSON.stringify(outreachData.personalization)}`
        }
      ],
      temperature: 0.7
    });

    return {
      recipientName: outreachData.recipientName,
      recipientEmail: outreachData.recipientEmail,
      subject: this.generateEmailSubject(outreachData),
      content: emailContent,
      personalizedElements: outreachData.personalization,
      sendTime: this.optimizeSendTime(outreachData),
      expectedResponseRate: 0.12,
      followUpScheduled: true,
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days later
      trackingEnabled: true
    };
  }

  private async performGenericTask(taskData: any): Promise<any> {
    const response = await this.claudeAIService.generateCompletion({
      system: `You are a versatile AI assistant. Complete the requested task professionally and thoroughly.`,
      messages: [
        {
          role: 'user',
          content: `Task: ${taskData.task_title}\nDescription: ${taskData.task_description}\nContext: ${JSON.stringify(taskData.task_context)}\nInput: ${JSON.stringify(taskData.input_data)}`
        }
      ],
      temperature: 0.5
    });

    return {
      taskType: taskData.task_type,
      result: response,
      completedAt: new Date().toISOString(),
      success: true
    };
  }

  // --- Workflow Management ---

  async executeWorkflow(tenantId: string, execution: WorkflowExecution): Promise<string> {
    try {
      const result = await db.execute(sql`
        INSERT INTO ai_workflow_executions (
          tenant_id, workflow_id, triggered_by, trigger_data, input_data, status
        ) VALUES (
          ${tenantId}, ${execution.workflowId}, ${execution.triggeredBy}, 
          ${JSON.stringify(execution.triggerData || {})}, ${JSON.stringify(execution.inputData)}, 'running'
        ) RETURNING id
      `);

      const executionId = result.rows[0].id;

      // Start workflow execution asynchronously
      this.processWorkflow(executionId, tenantId);

      return executionId;
    } catch (error) {
      console.error('Error starting workflow execution:', error);
      throw new Error('Failed to start workflow execution');
    }
  }

  private async processWorkflow(executionId: string, tenantId: string): Promise<void> {
    try {
      // Get workflow and execution details
      const workflowResult = await db.execute(sql`
        SELECT we.*, aw.workflow_steps, aw.employee_assignments
        FROM ai_workflow_executions we
        JOIN ai_employee_workflows aw ON we.workflow_id = aw.id
        WHERE we.id = ${executionId} AND we.tenant_id = ${tenantId}
      `);

      if (!workflowResult.rows[0]) {
        throw new Error('Workflow execution not found');
      }

      const execution = workflowResult.rows[0];
      const steps = JSON.parse(execution.workflow_steps);
      const assignments = JSON.parse(execution.employee_assignments);

      let currentStepIndex = 0;
      const completedSteps = [];

      for (const step of steps) {
        await db.execute(sql`
          UPDATE ai_workflow_executions 
          SET current_step_index = ${currentStepIndex}, current_step_name = ${step.step}
          WHERE id = ${executionId}
        `);

        const assignedEmployeeId = assignments[step.step];
        
        if (assignedEmployeeId && assignedEmployeeId !== 'system') {
          // Create task for AI employee
          const task = await this.assignTask(tenantId, {
            employeeId: assignedEmployeeId,
            taskType: step.step,
            taskTitle: `Workflow Step: ${step.step}`,
            taskDescription: step.description,
            taskPriority: 'high',
            taskContext: {
              workflowExecutionId: executionId,
              stepIndex: currentStepIndex,
              previousResults: completedSteps
            },
            inputData: execution.input_data
          });

          // Wait for task completion (in real implementation, this would be event-driven)
          await this.waitForTaskCompletion(task.id, tenantId);
          
          // Get task result
          const taskResult = await db.execute(sql`
            SELECT task_result, quality_score FROM ai_employee_tasks WHERE id = ${task.id}
          `);

          completedSteps.push({
            step: step.step,
            result: JSON.parse(taskResult.rows[0].task_result),
            qualityScore: taskResult.rows[0].quality_score
          });
        } else {
          // System step - execute directly
          completedSteps.push({
            step: step.step,
            result: { message: `System step ${step.step} completed` },
            qualityScore: 100
          });
        }

        currentStepIndex++;
      }

      // Complete workflow execution
      await db.execute(sql`
        UPDATE ai_workflow_executions 
        SET 
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          final_result = ${JSON.stringify({ steps: completedSteps, success: true })},
          steps_completed = ${completedSteps.length}
        WHERE id = ${executionId}
      `);

    } catch (error) {
      console.error('Error processing workflow:', error);
      
      await db.execute(sql`
        UPDATE ai_workflow_executions 
        SET status = 'failed', error_details = ${JSON.stringify({ error: error.message })}
        WHERE id = ${executionId}
      `);
    }
  }

  // --- Helper Methods ---

  private async findBestEmployeeForTask(tenantId: string, taskType: string, context: any): Promise<string> {
    // Simple assignment logic - in real implementation, this would be more sophisticated
    const employeeTypeMap = {
      'lead_qualification': 'sales_assistant',
      'customer_support': 'support_agent',
      'data_analysis': 'data_analyst',
      'report_generation': 'data_analyst',
      'email_outreach': 'sales_assistant'
    };

    const preferredType = employeeTypeMap[taskType] || 'sales_assistant';
    
    const result = await db.execute(sql`
      SELECT id FROM ai_employees 
      WHERE tenant_id = ${tenantId} AND employee_type = ${preferredType} AND status = 'active'
      ORDER BY success_rate DESC, total_tasks_completed ASC
      LIMIT 1
    `);

    return result.rows[0]?.id || '00000000-0000-0000-0000-000000000001'; // Fallback to default
  }

  private async initializeEmployeeSkills(tenantId: string, employeeId: string, employeeType: string): Promise<void> {
    const skillsByType = {
      'sales_assistant': ['lead_qualification', 'email_communication', 'objection_handling', 'product_knowledge'],
      'support_agent': ['technical_troubleshooting', 'customer_communication', 'issue_resolution', 'documentation'],
      'data_analyst': ['data_analysis', 'statistical_modeling', 'report_generation', 'visualization'],
      'project_manager': ['project_planning', 'task_coordination', 'stakeholder_communication', 'risk_management']
    };

    const skills = skillsByType[employeeType] || ['general_assistance'];

    for (const skill of skills) {
      await db.execute(sql`
        INSERT INTO ai_employee_skills (tenant_id, employee_id, skill_name, skill_category, proficiency_level)
        VALUES (${tenantId}, ${employeeId}, ${skill}, 'core', 7)
        ON CONFLICT (tenant_id, employee_id, skill_name) DO NOTHING
      `);
    }
  }

  private async updateEmployeeStats(employeeId: string, tenantId: string, success: boolean): Promise<void> {
    await db.execute(sql`
      UPDATE ai_employees 
      SET 
        total_tasks_completed = total_tasks_completed + 1,
        success_rate = (
          SELECT CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS DECIMAL) / COUNT(*) 
          FROM ai_employee_tasks 
          WHERE employee_id = ${employeeId}
        ),
        last_active_at = CURRENT_TIMESTAMP
      WHERE id = ${employeeId} AND tenant_id = ${tenantId}
    `);
  }

  private async waitForTaskCompletion(taskId: string, tenantId: string): Promise<void> {
    // Mock implementation - in real system, this would use events/webhooks
    return new Promise(resolve => {
      setTimeout(resolve, 2000); // Simulate task execution time
    });
  }

  // --- Utility Methods ---

  private categorizeIssue(description: string): string {
    const categories = {
      'technical': ['error', 'bug', 'crash', 'not working', 'broken'],
      'billing': ['payment', 'invoice', 'charge', 'billing', 'cost'],
      'account': ['login', 'password', 'access', 'account', 'profile'],
      'feature': ['how to', 'tutorial', 'guide', 'help', 'feature']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => description.toLowerCase().includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  private assessPriority(ticket: any): string {
    if (ticket.priority) return ticket.priority;
    
    const highPriorityKeywords = ['urgent', 'critical', 'down', 'broken', 'emergency'];
    const description = ticket.description?.toLowerCase() || '';
    
    return highPriorityKeywords.some(keyword => description.includes(keyword)) ? 'high' : 'medium';
  }

  private estimateResolutionTime(ticket: any): number {
    const category = this.categorizeIssue(ticket.description);
    const timeEstimates = {
      'technical': 45,
      'billing': 30,
      'account': 20,
      'feature': 15,
      'general': 25
    };

    return timeEstimates[category] || 30;
  }

  private requiresFollowUp(ticket: any): boolean {
    const followUpKeywords = ['complex', 'multiple', 'ongoing', 'recurring'];
    const description = ticket.description?.toLowerCase() || '';
    
    return followUpKeywords.some(keyword => description.includes(keyword));
  }

  private generateEmailSubject(outreachData: any): string {
    const subjects = [
      `${outreachData.recipientName}, quick question about ${outreachData.company}`,
      `Helping ${outreachData.company} with ${outreachData.objective}`,
      `${outreachData.recipientName} - ${outreachData.objective} opportunity`,
      `Quick chat about ${outreachData.company}'s goals?`
    ];

    return subjects[Math.floor(Math.random() * subjects.length)];
  }

  private optimizeSendTime(outreachData: any): Date {
    // Simple optimization - Tuesday-Thursday, 10am-2pm
    const now = new Date();
    const optimizedDate = new Date(now);
    
    // If it's Friday, Saturday, or Sunday, move to next Tuesday
    if (now.getDay() >= 5 || now.getDay() === 0) {
      const daysToAdd = now.getDay() === 5 ? 4 : now.getDay() === 6 ? 3 : 2;
      optimizedDate.setDate(now.getDate() + daysToAdd);
    }
    
    // Set to 10am
    optimizedDate.setHours(10, 0, 0, 0);
    
    return optimizedDate;
  }

  // --- Public API Methods ---

  async getEmployeeTasks(tenantId: string, employeeId: string, status?: string): Promise<AIEmployeeTask[]> {
    try {
      let query = `SELECT * FROM ai_employee_tasks WHERE tenant_id = '${tenantId}' AND employee_id = '${employeeId}'`;
      
      if (status) {
        query += ` AND status = '${status}'`;
      }
      
      query += ' ORDER BY assigned_at DESC';
      
      const result = await db.execute(sql.raw(query));
      return result.rows as AIEmployeeTask[];
    } catch (error) {
      console.error('Error fetching employee tasks:', error);
      return [];
    }
  }

  async getEmployeePerformance(tenantId: string, employeeId: string, days = 30): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
          AVG(quality_score) as avg_quality_score,
          AVG(execution_time_minutes) as avg_execution_time,
          AVG(ai_confidence_score) as avg_confidence
        FROM ai_employee_tasks
        WHERE employee_id = ${employeeId} AND tenant_id = ${tenantId}
        AND assigned_at >= CURRENT_DATE - INTERVAL '${days} days'
      `);

      return result.rows[0] || {
        total_tasks: 0,
        completed_tasks: 0,
        failed_tasks: 0,
        avg_quality_score: 0,
        avg_execution_time: 0,
        avg_confidence: 0
      };
    } catch (error) {
      console.error('Error fetching employee performance:', error);
      return null;
    }
  }

  async getWorkflows(tenantId: string, workflowType?: string): Promise<any[]> {
    try {
      let query = `SELECT * FROM ai_employee_workflows WHERE tenant_id = '${tenantId}' AND status = 'active'`;
      
      if (workflowType) {
        query += ` AND workflow_type = '${workflowType}'`;
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await db.execute(sql.raw(query));
      return result.rows;
    } catch (error) {
      console.error('Error fetching workflows:', error);
      return [];
    }
  }
}

export const aiEmployeeService = new AIEmployeeService();

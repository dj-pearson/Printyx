// server/routes/ai-employee-routes.ts
import express from 'express';
import { z } from 'zod';
import { aiEmployeeService } from '../services/ai-employee-service';
import { createModuleLogger } from '../lib/logger';
import { requireAuth } from '../replitAuth';
import { getUserId, getTenantId } from '../utils/auth-helpers';
const log = createModuleLogger('ai-employee-routes');

// CR-008: whitelist the create-employee body (createdBy is server-injected).
const createAiEmployeeSchema = z.object({
  employeeName: z.string().min(1),
  employeeType: z.string().min(1),
  employeeRole: z.string().min(1),
  aiPersonality: z.any().optional(),
  aiExpertiseAreas: z.array(z.string()).optional(),
  aiCapabilities: z.array(z.string()).optional(),
  autonomyLevel: z.string().optional(),
});

const router = express.Router();

// AUDIT-015 — this router previously stubbed auth:
//
//     router.use((req, res, next) => {
//       (req as any).userId = 'mock-user-id';
//       (req as any).tenantId = 'mock-tenant-id';
//       next();
//     });
//
// That was TWO live bugs, not a placeholder:
//
//  1. NO AUTHENTICATION. This router is mounted with app.use('/api', ...)
//     (routes-registry.ts), so every /api/ai-employees endpoint was reachable
//     unauthenticated and every row it wrote was scoped to a fabricated tenant.
//
//  2. IT LEAKED ONTO UNRELATED ROUTES. The `router.use` above had NO PATH, so in
//     Express it ran for EVERY /api/* request that reached this router and then fell
//     through to the routers/routes mounted after it. getTenantId()'s first priority
//     is `req.tenantId` (server/utils/auth-helpers.ts), so any /api route registered
//     later — /api/dashboards/today, /api/onboarding/*, /api/notifications/* — read
//     back 'mock-tenant-id' instead of the caller's real tenant. Verified with a
//     supertest reproduction of the real mount order.
//
// The replacement is PATH-SCOPED ('/ai-employees') precisely so it can never affect
// another router again, and resolves identity through the canonical helpers.
router.use('/ai-employees', requireAuth);

/** Resolve the caller's tenant/user, or 401. Never fabricate either. */
function requireIdentity(
  req: express.Request,
  res: express.Response,
): { tenantId: string; userId: string } | null {
  const tenantId = getTenantId(req);
  const userId = getUserId(req);
  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { tenantId, userId };
}

/**
 * @route POST /api/ai-employees
 * @description Create a new AI employee
 * @access Private
 */
router.post('/ai-employees', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId, userId } = identity;

    const parsed = createAiEmployeeSchema.parse(req.body ?? {});
    const employeeData = {
      ...parsed,
      createdBy: userId,
    };

    const employee = await aiEmployeeService.createEmployee(tenantId, employeeData);

    res.status(201).json({
      success: true,
      data: employee,
      message: 'AI employee created successfully',
    });
  } catch (error: any) {
    log.error('Error creating AI employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create AI employee',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees
 * @description Get all AI employees for a tenant
 * @access Private
 */
router.get('/ai-employees', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { employeeType, status, autonomyLevel } = req.query;

    const filters = {
      employeeType: employeeType as string,
      status: status as string,
      autonomyLevel: autonomyLevel as string,
    };

    const employees = await aiEmployeeService.getEmployees(tenantId, filters);

    res.json({
      success: true,
      data: employees,
      count: employees.length,
    });
  } catch (error: any) {
    log.error('Error fetching AI employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI employees',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/:employeeId
 * @description Get a specific AI employee
 * @access Private
 */
router.get('/ai-employees/:employeeId', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { employeeId } = req.params;

    const employee = await aiEmployeeService.getEmployee(tenantId, employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'AI employee not found',
      });
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error: any) {
    log.error('Error fetching AI employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI employee',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/ai-employees/tasks
 * @description Assign a task to an AI employee
 * @access Private
 */
router.post('/ai-employees/tasks', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;

    const task = await aiEmployeeService.assignTask(tenantId, req.body);

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task assigned successfully',
    });
  } catch (error: any) {
    log.error('Error assigning task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign task',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/:employeeId/tasks
 * @description Get tasks for a specific AI employee
 * @access Private
 */
router.get('/ai-employees/:employeeId/tasks', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { employeeId } = req.params;
    const { status } = req.query;

    const tasks = await aiEmployeeService.getEmployeeTasks(tenantId, employeeId, status as string);

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    log.error('Error fetching employee tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee tasks',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/:employeeId/performance
 * @description Get performance metrics for an AI employee
 * @access Private
 */
router.get('/ai-employees/:employeeId/performance', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { employeeId } = req.params;
    const { days } = req.query;

    const performance = await aiEmployeeService.getEmployeePerformance(
      tenantId,
      employeeId,
      days ? parseInt(days as string) : 30,
    );

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: 'Performance data not found',
      });
    }

    res.json({
      success: true,
      data: performance,
    });
  } catch (error: any) {
    log.error('Error fetching employee performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee performance',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/ai-employees/workflows/execute
 * @description Execute an AI workflow
 * @access Private
 */
router.post('/ai-employees/workflows/execute', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;

    const executionId = await aiEmployeeService.executeWorkflow(tenantId, req.body);

    res.status(201).json({
      success: true,
      data: { executionId },
      message: 'Workflow execution started',
    });
  } catch (error: any) {
    log.error('Error executing workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/workflows
 * @description Get available workflows
 * @access Private
 */
router.get('/ai-employees/workflows', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { workflowType } = req.query;

    const workflows = await aiEmployeeService.getWorkflows(tenantId, workflowType as string);

    res.json({
      success: true,
      data: workflows,
      count: workflows.length,
    });
  } catch (error: any) {
    log.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/analytics/overview
 * @description Get overall AI employee analytics
 * @access Private
 */
router.get('/ai-employees/analytics/overview', async (req, res) => {
  try {
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;

    // AUDIT-015: this block used to be a HARDCODED analyticsData object, so the
    // dashboard rendered invented figures (23 tasks today, 82% quality, $1,250 saved)
    // that were indistinguishable from real ones. Now aggregated from the actual
    // ai_employees / ai_employee_tasks rows, tenant-scoped. costSavings comes back
    // null because nothing records a saving — reported as unknown, never invented.
    const analyticsData = await aiEmployeeService.getAnalyticsOverview(tenantId);

    res.json({
      success: true,
      data: analyticsData,
    });
  } catch (error: any) {
    log.error('Error fetching analytics overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics overview',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/ai-employees/templates
 * @description Get AI employee templates
 * @access Private
 */
router.get('/ai-employees/templates', async (req, res) => {
  try {
    // Mock template data
    const templates = [
      {
        id: 'sales_assistant',
        name: 'Sales Assistant',
        description: 'AI specialist for lead qualification, outreach, and sales support',
        capabilities: [
          'lead_scoring',
          'email_outreach',
          'appointment_scheduling',
          'proposal_generation',
        ],
        expertiseAreas: [
          'lead_qualification',
          'product_knowledge',
          'pricing_strategies',
          'objection_handling',
        ],
        autonomyLevel: 'supervised',
        estimatedCostPerMonth: 89.99,
        expectedTasks: [
          'Lead qualification',
          'Email campaigns',
          'Follow-up scheduling',
          'Proposal creation',
        ],
      },
      {
        id: 'support_agent',
        name: 'Support Agent',
        description: 'AI customer support specialist for technical assistance and issue resolution',
        capabilities: [
          'ticket_triage',
          'solution_research',
          'customer_communication',
          'knowledge_base_updates',
        ],
        expertiseAreas: [
          'technical_troubleshooting',
          'product_support',
          'customer_communication',
          'issue_documentation',
        ],
        autonomyLevel: 'semi_autonomous',
        estimatedCostPerMonth: 79.99,
        expectedTasks: [
          'Ticket handling',
          'Customer inquiries',
          'Technical support',
          'Documentation updates',
        ],
      },
      {
        id: 'data_analyst',
        name: 'Data Analyst',
        description: 'AI business intelligence analyst for data analysis and reporting',
        capabilities: [
          'data_processing',
          'visualization_creation',
          'insight_generation',
          'predictive_modeling',
        ],
        expertiseAreas: [
          'data_analysis',
          'statistical_modeling',
          'report_generation',
          'trend_identification',
        ],
        autonomyLevel: 'autonomous',
        estimatedCostPerMonth: 129.99,
        expectedTasks: [
          'Data analysis',
          'Report generation',
          'Trend analysis',
          'Performance metrics',
        ],
      },
      {
        id: 'project_manager',
        name: 'Project Manager',
        description: 'AI project coordinator for task management and team coordination',
        capabilities: [
          'task_assignment',
          'progress_tracking',
          'risk_assessment',
          'status_reporting',
        ],
        expertiseAreas: [
          'project_planning',
          'resource_allocation',
          'timeline_management',
          'stakeholder_communication',
        ],
        autonomyLevel: 'semi_autonomous',
        estimatedCostPerMonth: 109.99,
        expectedTasks: [
          'Project planning',
          'Task coordination',
          'Progress tracking',
          'Team communication',
        ],
      },
    ];

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error: any) {
    log.error('Error fetching employee templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee templates',
      error: error.message,
    });
  }
});

export default router;

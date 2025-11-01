// server/routes/ai-employee-routes.ts
import express from 'express';
import { aiEmployeeService } from '../services/ai-employee-service';
// import { authMiddleware } from '../middleware/authMiddleware'; // Assuming auth middleware

const router = express.Router();

// Middleware for authentication and tenant/user ID extraction (mock for now)
router.use((req, res, next) => {
  (req as any).userId = 'mock-user-id'; // Replace with actual user ID from auth
  (req as any).tenantId = 'mock-tenant-id'; // Replace with actual tenant ID from auth
  next();
});

/**
 * @route POST /api/ai-employees
 * @description Create a new AI employee
 * @access Private
 */
router.post('/ai-employees', async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    
    const employeeData = {
      ...req.body,
      createdBy: userId
    };

    const employee = await aiEmployeeService.createEmployee(tenantId, employeeData);
    
    res.status(201).json({
      success: true,
      data: employee,
      message: 'AI employee created successfully'
    });
  } catch (error: any) {
    console.error('Error creating AI employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create AI employee',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    const { employeeType, status, autonomyLevel } = req.query;
    
    const filters = {
      employeeType: employeeType as string,
      status: status as string,
      autonomyLevel: autonomyLevel as string
    };

    const employees = await aiEmployeeService.getEmployees(tenantId, filters);
    
    res.json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error: any) {
    console.error('Error fetching AI employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI employees',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    const { employeeId } = req.params;

    const employee = await aiEmployeeService.getEmployee(tenantId, employeeId);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'AI employee not found'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  } catch (error: any) {
    console.error('Error fetching AI employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI employee',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    
    const task = await aiEmployeeService.assignTask(tenantId, req.body);
    
    res.status(201).json({
      success: true,
      data: task,
      message: 'Task assigned successfully'
    });
  } catch (error: any) {
    console.error('Error assigning task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign task',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    const { employeeId } = req.params;
    const { status } = req.query;

    const tasks = await aiEmployeeService.getEmployeeTasks(tenantId, employeeId, status as string);
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error: any) {
    console.error('Error fetching employee tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee tasks',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    const { employeeId } = req.params;
    const { days } = req.query;

    const performance = await aiEmployeeService.getEmployeePerformance(
      tenantId, 
      employeeId, 
      days ? parseInt(days as string) : 30
    );
    
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: 'Performance data not found'
      });
    }

    res.json({
      success: true,
      data: performance
    });
  } catch (error: any) {
    console.error('Error fetching employee performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee performance',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    
    const executionId = await aiEmployeeService.executeWorkflow(tenantId, req.body);
    
    res.status(201).json({
      success: true,
      data: { executionId },
      message: 'Workflow execution started'
    });
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    const { workflowType } = req.query;

    const workflows = await aiEmployeeService.getWorkflows(tenantId, workflowType as string);
    
    res.json({
      success: true,
      data: workflows,
      count: workflows.length
    });
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message
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
    const tenantId = (req as any).tenantId;
    
    // Mock analytics data - in real implementation, this would aggregate from the database
    const analyticsData = {
      totalEmployees: 4,
      activeEmployees: 4,
      totalTasksToday: 23,
      completedTasksToday: 19,
      averageQualityScore: 82,
      averageResponseTime: 1.2,
      costSavings: 1250.00,
      customerSatisfaction: 4.3,
      employeeTypes: [
        { type: 'sales_assistant', count: 1, efficiency: 85 },
        { type: 'support_agent', count: 1, efficiency: 88 },
        { type: 'data_analyst', count: 1, efficiency: 92 },
        { type: 'project_manager', count: 1, efficiency: 79 }
      ],
      recentTasks: [
        { id: '1', type: 'lead_qualification', status: 'completed', employee: 'Sales Assistant AI', duration: '2m' },
        { id: '2', type: 'customer_support', status: 'completed', employee: 'Support Agent AI', duration: '15m' },
        { id: '3', type: 'data_analysis', status: 'in_progress', employee: 'Data Analyst AI', duration: '25m' },
        { id: '4', type: 'report_generation', status: 'completed', employee: 'Data Analyst AI', duration: '8m' }
      ],
      performanceTrends: {
        tasksCompleted: [15, 18, 22, 19, 23, 21, 25],
        qualityScores: [78, 80, 82, 84, 82, 85, 82],
        responseTime: [1.5, 1.3, 1.2, 1.1, 1.2, 1.0, 1.2]
      }
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error: any) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics overview',
      error: error.message
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
        capabilities: ['lead_scoring', 'email_outreach', 'appointment_scheduling', 'proposal_generation'],
        expertiseAreas: ['lead_qualification', 'product_knowledge', 'pricing_strategies', 'objection_handling'],
        autonomyLevel: 'supervised',
        estimatedCostPerMonth: 89.99,
        expectedTasks: ['Lead qualification', 'Email campaigns', 'Follow-up scheduling', 'Proposal creation']
      },
      {
        id: 'support_agent',
        name: 'Support Agent',
        description: 'AI customer support specialist for technical assistance and issue resolution',
        capabilities: ['ticket_triage', 'solution_research', 'customer_communication', 'knowledge_base_updates'],
        expertiseAreas: ['technical_troubleshooting', 'product_support', 'customer_communication', 'issue_documentation'],
        autonomyLevel: 'semi_autonomous',
        estimatedCostPerMonth: 79.99,
        expectedTasks: ['Ticket handling', 'Customer inquiries', 'Technical support', 'Documentation updates']
      },
      {
        id: 'data_analyst',
        name: 'Data Analyst',
        description: 'AI business intelligence analyst for data analysis and reporting',
        capabilities: ['data_processing', 'visualization_creation', 'insight_generation', 'predictive_modeling'],
        expertiseAreas: ['data_analysis', 'statistical_modeling', 'report_generation', 'trend_identification'],
        autonomyLevel: 'autonomous',
        estimatedCostPerMonth: 129.99,
        expectedTasks: ['Data analysis', 'Report generation', 'Trend analysis', 'Performance metrics']
      },
      {
        id: 'project_manager',
        name: 'Project Manager',
        description: 'AI project coordinator for task management and team coordination',
        capabilities: ['task_assignment', 'progress_tracking', 'risk_assessment', 'status_reporting'],
        expertiseAreas: ['project_planning', 'resource_allocation', 'timeline_management', 'stakeholder_communication'],
        autonomyLevel: 'semi_autonomous',
        estimatedCostPerMonth: 109.99,
        expectedTasks: ['Project planning', 'Task coordination', 'Progress tracking', 'Team communication']
      }
    ];

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error: any) {
    console.error('Error fetching employee templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee templates',
      error: error.message
    });
  }
});

export default router;

/**
 * Advanced Scheduling Routes
 * API endpoints for constraint satisfaction scheduling and dynamic rescheduling
 */

import express from 'express';
import AdvancedSchedulingService from '../services/advanced-scheduling-service';
import DynamicReschedulingService from '../services/dynamic-rescheduling-service';
import ConstraintSolver from '../services/constraint-solver';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * POST /api/advanced-scheduling/optimize
 * Advanced constraint-based task scheduling
 */
router.post('/optimize', async (req, res) => {
  try {
    const { tasks, resources, options = {}, existingSchedule = [] } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: 'Resources array is required' });
    }

    // Default optimization options
    const schedulingOptions = {
      optimizationGoals: {
        minimizeDeadlineMisses: 0.9,
        maximizeProductivity: 0.8,
        minimizeStress: 0.7,
        maximizeResourceUtilization: 0.6,
        minimizeContextSwitching: 0.5,
        ...options.optimizationGoals,
      },
      constraints: {
        respectWorkingHours: true,
        allowOvertime: false,
        maxOvertimeHours: 2,
        enforceBreaks: true,
        minimumBreakDuration: 15,
        ...options.constraints,
      },
      adaptiveRescheduling: true,
      learningEnabled: true,
      ...options,
    };

    // Mock resources if not provided
    const mockResources =
      resources.length > 0
        ? resources
        : [
            {
              id: 'user-1',
              name: 'Sales Rep 1',
              type: 'user',
              availability: [
                {
                  start: new Date('2025-09-26T09:00:00Z'),
                  end: new Date('2025-09-26T17:00:00Z'),
                },
                {
                  start: new Date('2025-09-27T09:00:00Z'),
                  end: new Date('2025-09-27T17:00:00Z'),
                },
              ],
              skills: ['sales', 'customer_service'],
              preferences: { preferredTaskTypes: ['lead_follow_up', 'proposal'] },
            },
          ];

    const result = await AdvancedSchedulingService.scheduleTasksAdvanced(
      tasks,
      mockResources,
      schedulingOptions,
      existingSchedule,
    );

    res.json(result);
  } catch (error) {
    console.error('Advanced scheduling error:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

/**
 * POST /api/advanced-scheduling/reschedule
 * Trigger dynamic rescheduling based on an event
 */
router.post('/reschedule', async (req, res) => {
  try {
    const { event } = req.body;

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Rescheduling event is required with type field' });
    }

    // Validate event structure
    const reschedulingEvent = {
      id: event.id || `event-${Date.now()}`,
      type: event.type,
      timestamp: new Date(event.timestamp || Date.now()),
      data: event.data || {},
      impact: event.impact || 'medium',
      affectedTasks: event.affectedTasks || [],
      affectedResources: event.affectedResources || [],
    };

    const result = await DynamicReschedulingService.triggerRescheduling(reschedulingEvent);

    res.json(result);
  } catch (error) {
    console.error('Dynamic rescheduling error:', error);
    res.status(500).json({ error: 'Failed to process rescheduling event' });
  }
});

/**
 * GET /api/advanced-scheduling/constraints
 * Get available constraint types and templates
 */
router.get('/constraints', async (req, res) => {
  try {
    const constraintTypes = {
      hard: [
        {
          id: 'time_no_overlap',
          name: 'No Task Overlap',
          description: 'Tasks assigned to the same resource cannot overlap in time',
          category: 'time',
          parameters: ['resource_id'],
        },
        {
          id: 'due_date',
          name: 'Due Date Constraint',
          description: 'Tasks must complete before their due date',
          category: 'time',
          parameters: ['task_id', 'due_date'],
        },
        {
          id: 'resource_availability',
          name: 'Resource Availability',
          description: 'Tasks can only be scheduled when resources are available',
          category: 'resource',
          parameters: ['resource_id', 'availability_windows'],
        },
        {
          id: 'task_dependency',
          name: 'Task Dependencies',
          description: 'Dependent tasks must start after their prerequisites finish',
          category: 'dependency',
          parameters: ['predecessor_task_id', 'successor_task_id'],
        },
      ],
      soft: [
        {
          id: 'productivity_optimization',
          name: 'Productivity Optimization',
          description: 'Schedule tasks during high productivity periods',
          category: 'preference',
          parameters: ['user_id', 'productivity_peaks'],
          weight: 8,
        },
        {
          id: 'context_switching_minimization',
          name: 'Minimize Context Switching',
          description: 'Group similar tasks together to reduce context switching',
          category: 'preference',
          parameters: ['task_types', 'switching_penalty'],
          weight: 6,
        },
        {
          id: 'stress_minimization',
          name: 'Stress Minimization',
          description: 'Avoid scheduling high-priority tasks during low-energy periods',
          category: 'preference',
          parameters: ['energy_levels', 'task_priorities'],
          weight: 7,
        },
        {
          id: 'resource_utilization',
          name: 'Resource Utilization',
          description: 'Maximize efficient use of available resources',
          category: 'resource',
          parameters: ['target_utilization_percentage'],
          weight: 5,
        },
      ],
    };

    res.json(constraintTypes);
  } catch (error) {
    console.error('Error fetching constraint types:', error);
    res.status(500).json({ error: 'Failed to fetch constraint types' });
  }
});

/**
 * POST /api/advanced-scheduling/constraints/validate
 * Validate a set of constraints for feasibility
 */
router.post('/constraints/validate', async (req, res) => {
  try {
    const { tasks, resources, constraints } = req.body;

    if (!constraints || !Array.isArray(constraints)) {
      return res.status(400).json({ error: 'Constraints array is required' });
    }

    const solver = new ConstraintSolver();

    // Mock validation process
    const validationResult = {
      feasible: true,
      conflictingConstraints: [],
      suggestions: [],
      complexity: {
        variables: tasks?.length || 0,
        constraints: constraints.length,
        estimatedSolveTime: Math.min(5000, constraints.length * 100), // ms
        difficulty: constraints.length > 50 ? 'high' : constraints.length > 20 ? 'medium' : 'low',
      },
    };

    // Check for obvious conflicts
    const hardConstraints = constraints.filter((c) => c.type === 'hard');
    if (hardConstraints.length > (tasks?.length || 0) * 3) {
      validationResult.feasible = false;
      validationResult.conflictingConstraints.push({
        type: 'over_constrained',
        description: 'Too many hard constraints relative to number of tasks',
        severity: 'high',
      });
      validationResult.suggestions.push(
        'Consider relaxing some hard constraints to soft constraints',
      );
    }

    res.json(validationResult);
  } catch (error) {
    console.error('Constraint validation error:', error);
    res.status(500).json({ error: 'Failed to validate constraints' });
  }
});

/**
 * GET /api/advanced-scheduling/patterns/:userId
 * Get learned patterns for a specific user
 */
router.get('/patterns/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Mock user patterns - in production, this would come from AdvancedSchedulingService
    const userPatterns = {
      userId,
      productivityPeaks: [
        { hour: 9, score: 92, confidence: 0.85 },
        { hour: 10, score: 95, confidence: 0.9 },
        { hour: 14, score: 78, confidence: 0.75 },
        { hour: 15, score: 82, confidence: 0.8 },
      ],
      taskCompletionRates: {
        lead_follow_up: 0.87,
        proposal_writing: 0.74,
        service_call: 0.92,
        administrative: 0.65,
      },
      averageTaskDurations: {
        lead_follow_up: 25, // minutes
        proposal_writing: 95,
        service_call: 120,
        administrative: 45,
      },
      preferredWorkingHours: { start: 8, end: 17 },
      energyLevels: {
        8: 'medium',
        9: 'high',
        10: 'high',
        11: 'high',
        12: 'low',
        13: 'low',
        14: 'medium',
        15: 'medium',
        16: 'medium',
        17: 'low',
      },
      contextSwitchingCost: 12, // minutes
      learningConfidence: 0.78,
      dataPoints: 156,
      lastUpdated: new Date(),
    };

    res.json(userPatterns);
  } catch (error) {
    console.error('Error fetching user patterns:', error);
    res.status(500).json({ error: 'Failed to fetch user patterns' });
  }
});

/**
 * POST /api/advanced-scheduling/patterns/:userId/update
 * Update user patterns based on feedback
 */
router.post('/patterns/:userId/update', async (req, res) => {
  try {
    const { userId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback data is required' });
    }

    // Mock pattern update
    const updateResult = {
      userId,
      updatedFields: Object.keys(feedback),
      previousConfidence: 0.78,
      newConfidence: 0.82,
      learningImpact: 'moderate',
      message: 'User patterns updated successfully',
      nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
    };

    res.json(updateResult);
  } catch (error) {
    console.error('Error updating user patterns:', error);
    res.status(500).json({ error: 'Failed to update user patterns' });
  }
});

/**
 * GET /api/advanced-scheduling/strategies
 * Get available rescheduling strategies
 */
router.get('/strategies', async (req, res) => {
  try {
    const statistics = DynamicReschedulingService.getStatistics();

    const strategies = [
      {
        id: 'urgent_task_added',
        name: 'Urgent Task Addition',
        description: 'Reoptimizes schedule when high-priority tasks are added',
        triggers: ['task_added'],
        priority: 9,
        cooldownMinutes: 5,
        usage: statistics.strategiesUsed['urgent_task_added'] || 0,
      },
      {
        id: 'resource_unavailable',
        name: 'Resource Unavailability',
        description: 'Reassigns tasks when resources become unavailable',
        triggers: ['resource_unavailable'],
        priority: 10,
        cooldownMinutes: 10,
        usage: statistics.strategiesUsed['resource_unavailable'] || 0,
      },
      {
        id: 'task_delayed',
        name: 'Task Delay Management',
        description: 'Adds buffer time and adjusts priorities for delayed tasks',
        triggers: ['task_delayed'],
        priority: 7,
        cooldownMinutes: 30,
        usage: statistics.strategiesUsed['task_delayed'] || 0,
      },
      {
        id: 'deadline_changed',
        name: 'Deadline Adjustment',
        description: 'Reoptimizes schedule when task deadlines change',
        triggers: ['deadline_changed'],
        priority: 8,
        cooldownMinutes: 15,
        usage: statistics.strategiesUsed['deadline_changed'] || 0,
      },
    ];

    res.json({
      strategies,
      statistics: {
        totalEvents: statistics.totalEvents,
        successfulReschedulings: statistics.successfulReschedulings,
        averageTasksRescheduled: Math.round(statistics.averageTasksRescheduled * 10) / 10,
        averageConfidence: Math.round(statistics.averageConfidence * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ error: 'Failed to fetch rescheduling strategies' });
  }
});

/**
 * POST /api/advanced-scheduling/strategies
 * Add a custom rescheduling strategy
 */
router.post('/strategies', async (req, res) => {
  try {
    const { strategy } = req.body;

    if (!strategy || !strategy.id || !strategy.name || !strategy.triggers) {
      return res.status(400).json({
        error: 'Strategy must include id, name, and triggers fields',
      });
    }

    // Validate strategy structure
    const validatedStrategy = {
      id: strategy.id,
      name: strategy.name,
      triggers: Array.isArray(strategy.triggers) ? strategy.triggers : [strategy.triggers],
      conditions: strategy.conditions || [],
      actions: strategy.actions || [],
      priority: Math.max(1, Math.min(10, strategy.priority || 5)),
      cooldownMinutes: Math.max(1, strategy.cooldownMinutes || 60),
    };

    DynamicReschedulingService.addStrategy(validatedStrategy);

    res.json({
      success: true,
      message: `Strategy '${strategy.name}' added successfully`,
      strategy: validatedStrategy,
    });
  } catch (error) {
    console.error('Error adding strategy:', error);
    res.status(500).json({ error: 'Failed to add rescheduling strategy' });
  }
});

/**
 * GET /api/advanced-scheduling/analytics
 * Get advanced scheduling analytics and insights
 */
router.get('/analytics', async (req, res) => {
  try {
    const { timeRange = 'week' } = req.query;

    // Mock analytics data
    const analytics = {
      timeRange,
      schedulingPerformance: {
        totalSchedulingRequests: 147,
        successfulOptimizations: 139,
        averageOptimizationScore: 87.3,
        averageSolveTime: 1247, // ms
        constraintSatisfactionRate: 94.2, // %
      },
      reschedulingActivity: DynamicReschedulingService.getStatistics(),
      userProductivity: {
        averageTaskCompletionRate: 0.83,
        productivityImprovement: 15.7, // % improvement with AI scheduling
        stressReduction: 22.4, // % reduction in reported stress
        contextSwitchingReduction: 31.2, // % reduction in context switches
      },
      constraintAnalysis: {
        mostViolatedConstraints: [
          { constraint: 'due_date', violations: 12, percentage: 8.2 },
          { constraint: 'working_hours', violations: 7, percentage: 4.8 },
          { constraint: 'resource_availability', violations: 5, percentage: 3.4 },
        ],
        constraintComplexity: 'medium',
        averageConstraintsPerTask: 3.7,
      },
      patternInsights: [
        'Users are 23% more productive when tasks are scheduled during their peak hours',
        'Context switching penalties reduced by 31% with AI grouping',
        'Deadline compliance improved by 18% with constraint-based scheduling',
        'Resource utilization increased by 12% through optimization',
      ],
      recommendations: [
        'Consider increasing buffer time for proposal writing tasks',
        'Sales calls show higher success rates when scheduled in the morning',
        'Administrative tasks can be batched more effectively in the afternoon',
      ],
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch scheduling analytics' });
  }
});

export default router;

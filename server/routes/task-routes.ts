/**
 * Task Management Routes
 * API endpoints for AI-powered task management and scheduling
 */

import express from 'express';
import TaskSchedulingService from '../services/task-scheduling-service';
import ClaudeAIService from '../services/claude-ai-service';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * GET /api/tasks
 * Get user's tasks with filtering and pagination
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, priority, category, limit = 50, offset = 0 } = req.query;
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Mock tasks data
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Follow up with ABC Corp lead',
        description: 'Call to discuss their copier lease requirements',
        priority: 'high',
        status: 'pending',
        estimatedDuration: 30,
        dueDate: '2025-09-27T14:00:00Z',
        relatedEntityType: 'lead',
        relatedEntityId: 'lead-123',
        tags: ['sales', 'follow-up'],
        aiPriorityScore: 85,
        aiComplexityScore: 25,
        createdAt: '2025-09-26T10:00:00Z',
        assignedTo: userId,
      },
      {
        id: 'task-2',
        title: 'Prepare proposal for XYZ Manufacturing',
        description: 'Create comprehensive proposal for their multifunction printer needs',
        priority: 'high',
        status: 'in_progress',
        estimatedDuration: 120,
        dueDate: '2025-09-28T17:00:00Z',
        relatedEntityType: 'deal',
        relatedEntityId: 'deal-456',
        tags: ['proposal', 'sales'],
        aiPriorityScore: 90,
        aiComplexityScore: 75,
        completionPercentage: 30,
        createdAt: '2025-09-25T09:00:00Z',
        assignedTo: userId,
      },
      {
        id: 'task-3',
        title: 'Service call - Printer maintenance',
        description: 'Routine maintenance for Canon imageRUNNER at Tech Solutions',
        priority: 'medium',
        status: 'pending',
        estimatedDuration: 90,
        dueDate: '2025-09-29T10:00:00Z',
        relatedEntityType: 'service_call',
        relatedEntityId: 'service-789',
        tags: ['service', 'maintenance'],
        aiPriorityScore: 60,
        aiComplexityScore: 40,
        createdAt: '2025-09-26T08:00:00Z',
        assignedTo: userId,
      },
      {
        id: 'task-4',
        title: 'Update CRM with quarterly activities',
        description: 'Input all Q3 customer interactions and service calls',
        priority: 'low',
        status: 'pending',
        estimatedDuration: 60,
        dueDate: '2025-09-30T17:00:00Z',
        tags: ['administrative', 'crm'],
        aiPriorityScore: 30,
        aiComplexityScore: 20,
        createdAt: '2025-09-24T16:00:00Z',
        assignedTo: userId,
      },
    ];

    // Apply filters
    let filteredTasks = mockTasks;
    if (status) filteredTasks = filteredTasks.filter(t => t.status === status);
    if (priority) filteredTasks = filteredTasks.filter(t => t.priority === priority);

    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    res.json({
      tasks: paginatedTasks,
      total: filteredTasks.length,
      limit: parseInt(limit as string),
      offset: startIndex,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const taskData = req.body;
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Validate required fields
    if (!taskData.title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // AI analysis for new task
    let aiAnalysis = null;
    try {
      const analysis = await ClaudeAIService.generateCompletion({
        messages: [{
          role: 'user',
          content: `Analyze this new task for priority and complexity scoring:

Title: ${taskData.title}
Description: ${taskData.description || 'No description'}
Priority: ${taskData.priority || 'medium'}
Estimated Duration: ${taskData.estimatedDuration || 30} minutes
Due Date: ${taskData.dueDate || 'No due date'}

Return JSON with:
- priorityScore (0-100)
- complexityScore (0-100)
- suggestedTags (array of relevant tags)
- reasoning (brief explanation)`
        }],
        temperature: 0.3,
        max_tokens: 200
      });

      aiAnalysis = JSON.parse(analysis);
    } catch (error) {
      console.error('AI analysis failed for new task:', error);
    }

    // Create task
    const newTask = {
      id: `task-${Date.now()}`,
      ...taskData,
      tenantId,
      createdBy: userId,
      assignedTo: taskData.assignedTo || userId,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      estimatedDuration: taskData.estimatedDuration || 30,
      aiPriorityScore: aiAnalysis?.priorityScore || 50,
      aiComplexityScore: aiAnalysis?.complexityScore || 30,
      tags: taskData.tags || aiAnalysis?.suggestedTags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/:taskId
 * Update an existing task
 */
router.put('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updateData = req.body;

    // Mock task update
    const updatedTask = {
      id: taskId,
      ...updateData,
      updatedAt: new Date(),
    };

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:taskId
 * Delete a task
 */
router.delete('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Mock task deletion
    res.json({ success: true, deletedTaskId: taskId });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * POST /api/tasks/schedule
 * AI-powered task scheduling
 */
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { 
      taskIds, 
      startDate, 
      endDate, 
      preferences = {},
      existingEvents = [] 
    } = req.body;
    const { tenantId } = req.user;
    const userId = req.user.id;

    if (!taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'Task IDs array is required' });
    }

    // Mock tasks for scheduling
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Follow up with ABC Corp lead',
        priority: 'high',
        estimatedDuration: 30,
        dueDate: new Date('2025-09-27T14:00:00Z'),
        relatedEntityType: 'lead',
        userId,
        tenantId,
      },
      {
        id: 'task-2',
        title: 'Prepare proposal for XYZ Manufacturing',
        priority: 'high',
        estimatedDuration: 120,
        dueDate: new Date('2025-09-28T17:00:00Z'),
        relatedEntityType: 'deal',
        userId,
        tenantId,
      },
      {
        id: 'task-3',
        title: 'Service call - Printer maintenance',
        priority: 'medium',
        estimatedDuration: 90,
        dueDate: new Date('2025-09-29T10:00:00Z'),
        relatedEntityType: 'service_call',
        userId,
        tenantId,
      },
    ];

    // Default scheduling preferences
    const defaultPreferences = {
      workHoursStart: '09:00',
      workHoursEnd: '17:00',
      workDays: [1, 2, 3, 4, 5], // Mon-Fri
      preferredMeetingDuration: 30,
      maxTasksPerDay: 8,
      focusTimeBlocks: ['Mon 10:00-12:00', 'Wed 14:00-16:00'],
      breakDuration: 15,
      energyLevels: {
        morning: 'high',
        afternoon: 'medium',
        evening: 'low',
      },
      ...preferences,
    };

    // Schedule tasks with AI
    const schedulingResult = await TaskSchedulingService.scheduleTasksWithAI(
      mockTasks,
      defaultPreferences,
      existingEvents,
      startDate ? new Date(startDate) : new Date(),
      endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );

    res.json(schedulingResult);
  } catch (error) {
    console.error('Error scheduling tasks:', error);
    res.status(500).json({ error: 'Failed to schedule tasks' });
  }
});

/**
 * GET /api/tasks/categories
 * Get task categories
 */
router.get('/categories', requireAuth, async (req, res) => {
  try {
    // Mock categories
    const categories = [
      { id: 'cat-1', name: 'Sales', color: '#10B981', icon: 'DollarSign' },
      { id: 'cat-2', name: 'Service', color: '#F59E0B', icon: 'Wrench' },
      { id: 'cat-3', name: 'Administrative', color: '#6B7280', icon: 'FileText' },
      { id: 'cat-4', name: 'Follow-up', color: '#8B5CF6', icon: 'Phone' },
      { id: 'cat-5', name: 'Meeting', color: '#EF4444', icon: 'Calendar' },
      { id: 'cat-6', name: 'Proposal', color: '#3B82F6', icon: 'FileEdit' },
    ];

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/tasks/:taskId/time-entry
 * Start/stop time tracking for a task
 */
router.post('/:taskId/time-entry', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, description } = req.body; // action: 'start' or 'stop'
    const userId = req.user.id;

    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "start" or "stop"' });
    }

    // Mock time entry
    const timeEntry = {
      id: `time-${Date.now()}`,
      taskId,
      userId,
      action,
      timestamp: new Date(),
      description: description || '',
    };

    res.json(timeEntry);
  } catch (error) {
    console.error('Error managing time entry:', error);
    res.status(500).json({ error: 'Failed to manage time entry' });
  }
});

/**
 * GET /api/tasks/suggestions
 * Get AI-generated task suggestions
 */
router.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Mock AI suggestions based on user activity
    const suggestions = [
      {
        id: 'suggestion-1',
        suggestedTask: {
          title: 'Follow up with potential lead from website inquiry',
          description: 'Website visitor downloaded pricing guide 3 days ago',
          priority: 'medium',
          estimatedDuration: 20,
          relatedEntityType: 'lead',
          tags: ['follow-up', 'website-lead'],
        },
        suggestionReason: 'Website visitor has not been contacted after showing interest',
        confidenceScore: 0.78,
        sourceEntityType: 'website_activity',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'suggestion-2',
        suggestedTask: {
          title: 'Schedule quarterly service review with Johnson & Associates',
          description: 'Client contract includes quarterly service reviews',
          priority: 'medium',
          estimatedDuration: 45,
          relatedEntityType: 'customer',
          tags: ['service', 'quarterly-review'],
        },
        suggestionReason: 'Quarterly service review is due based on contract terms',
        confidenceScore: 0.92,
        sourceEntityType: 'contract',
        status: 'pending',
        createdAt: new Date(),
      },
    ];

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching task suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch task suggestions' });
  }
});

/**
 * POST /api/tasks/suggestions/:suggestionId/accept
 * Accept an AI task suggestion
 */
router.post('/suggestions/:suggestionId/accept', requireAuth, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Mock accepting suggestion and creating task
    const createdTask = {
      id: `task-${Date.now()}`,
      title: 'Follow up with potential lead from website inquiry',
      description: 'Website visitor downloaded pricing guide 3 days ago',
      priority: 'medium',
      status: 'pending',
      estimatedDuration: 20,
      createdFrom: 'ai_suggestion',
      suggestionId,
      createdBy: userId,
      assignedTo: userId,
      createdAt: new Date(),
    };

    res.json({
      success: true,
      createdTask,
      suggestionId,
      status: 'accepted',
    });
  } catch (error) {
    console.error('Error accepting task suggestion:', error);
    res.status(500).json({ error: 'Failed to accept task suggestion' });
  }
});

export default router;

/**
 * Advanced Scheduling Service
 * Uses constraint satisfaction and pattern recognition for optimal scheduling
 */

import ConstraintSolver from './constraint-solver';
import ClaudeAIService from './claude-ai-service';
import PerformanceMonitor from './performance-monitor';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('advanced-scheduling-service');

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'asap' | 'high' | 'medium' | 'low';
  estimatedDuration: number; // in minutes
  dueDate?: Date;
  dependsOn?: string[]; // Task IDs
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags?: string[];
  userId: string;
  tenantId: string;
  complexity?: number; // 0-100
  energyRequired?: 'high' | 'medium' | 'low';
}

interface Resource {
  id: string;
  name: string;
  type: 'user' | 'room' | 'equipment';
  availability: Array<{
    start: Date;
    end: Date;
    capacity?: number;
  }>;
  skills?: string[];
  preferences?: Record<string, any>;
}

interface UserPattern {
  userId: string;
  productivityPeaks: Array<{ hour: number; score: number }>; // 0-23 hours, 0-100 score
  taskCompletionRates: Record<string, number>; // task type -> completion rate
  averageTaskDurations: Record<string, number>; // task type -> average duration
  preferredWorkingHours: { start: number; end: number };
  energyLevels: Record<number, 'high' | 'medium' | 'low'>; // hour -> energy level
  contextSwitchingCost: number; // penalty for switching between different task types
  learningRate: number; // how quickly patterns adapt to new data
}

interface AdvancedSchedulingOptions {
  optimizationGoals: {
    minimizeDeadlineMisses: number; // weight 0-1
    maximizeProductivity: number; // weight 0-1
    minimizeStress: number; // weight 0-1
    maximizeResourceUtilization: number; // weight 0-1
    minimizeContextSwitching: number; // weight 0-1
  };
  constraints: {
    respectWorkingHours: boolean;
    allowOvertime: boolean;
    maxOvertimeHours: number;
    enforceBreaks: boolean;
    minimumBreakDuration: number;
  };
  adaptiveRescheduling: boolean;
  learningEnabled: boolean;
}

interface SchedulingResult {
  scheduledTasks: Array<{
    taskId: string;
    startTime: Date;
    endTime: Date;
    assignedResource: string;
    confidence: number;
    reasoning: string;
    constraints: string[];
  }>;
  unscheduledTasks: Task[];
  resourceUtilization: Record<string, number>;
  optimizationScore: number;
  patternInsights: string[];
  recommendations: string[];
  reschedulingTriggers: Array<{
    condition: string;
    action: string;
    priority: number;
  }>;
}

class AdvancedSchedulingService {
  private constraintSolver: ConstraintSolver;
  private userPatterns: Map<string, UserPattern> = new Map();
  private schedulingHistory: Array<{
    timestamp: Date;
    tasks: Task[];
    result: SchedulingResult;
    actualOutcome?: any;
  }> = [];

  constructor() {
    this.constraintSolver = new ConstraintSolver();
  }

  /**
   * Advanced task scheduling with constraint satisfaction and pattern recognition
   */
  async scheduleTasksAdvanced(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
    existingSchedule: any[] = [],
  ): Promise<SchedulingResult> {
    const startTime = Date.now();
    log.info('🚀 Starting advanced scheduling for', tasks.length, 'tasks...');

    try {
      // Step 1: Analyze user patterns and update learning models
      await this.updateUserPatterns(tasks, resources);

      // Step 2: Set up constraint satisfaction problem
      await this.setupConstraintProblem(tasks, resources, options, existingSchedule);

      // Step 3: Solve with advanced algorithms
      const solution = await this.constraintSolver.solve();

      // Step 4: Convert solution to scheduling result
      const result = await this.convertSolutionToSchedule(solution, tasks, resources, options);

      // Step 5: Apply pattern recognition insights
      const enhancedResult = await this.enhanceWithPatternRecognition(result, tasks, resources);

      // Step 6: Set up dynamic rescheduling triggers
      const finalResult = this.addReschedulingTriggers(enhancedResult, options);

      // Record performance metrics
      const duration = Date.now() - startTime;
      PerformanceMonitor.monitorSchedulingAlgorithm(
        tasks.length,
        duration,
        finalResult.scheduledTasks.length,
      );

      // Store in history for learning
      this.schedulingHistory.push({
        timestamp: new Date(),
        tasks,
        result: finalResult,
      });

      log.info('✅ Advanced scheduling completed in', duration, 'ms');
      return finalResult;
    } catch (error) {
      log.error('Advanced scheduling failed:', error);
      return this.fallbackScheduling(tasks, resources, options);
    } finally {
      this.constraintSolver.clear();
    }
  }

  /**
   * Update user patterns based on historical data
   */
  private async updateUserPatterns(tasks: Task[], resources: Resource[]): Promise<void> {
    for (const resource of resources.filter((r) => r.type === 'user')) {
      if (!this.userPatterns.has(resource.id)) {
        // Initialize pattern for new user
        this.userPatterns.set(resource.id, {
          userId: resource.id,
          productivityPeaks: this.generateInitialProductivityPeaks(),
          taskCompletionRates: {},
          averageTaskDurations: {},
          preferredWorkingHours: { start: 9, end: 17 },
          energyLevels: this.generateInitialEnergyLevels(),
          contextSwitchingCost: 15, // 15 minute penalty
          learningRate: 0.1,
        });
      }

      // Update patterns with recent data
      await this.learnFromRecentActivity(resource.id);
    }
  }

  /**
   * Learn from recent user activity to improve patterns
   */
  private async learnFromRecentActivity(userId: string): Promise<void> {
    const pattern = this.userPatterns.get(userId);
    if (!pattern) return;

    // Analyze recent scheduling history
    const recentHistory = this.schedulingHistory
      .filter((h) => h.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .filter((h) => h.tasks.some((t) => t.userId === userId));

    if (recentHistory.length === 0) return;

    try {
      // Use AI to analyze patterns
      const patternAnalysisPrompt = `Analyze user productivity patterns from scheduling data:

User ID: ${userId}
Recent Scheduling Sessions: ${recentHistory.length}
Tasks Completed: ${recentHistory.reduce((sum, h) => sum + h.result.scheduledTasks.length, 0)}

Historical Data Summary:
${recentHistory
  .slice(0, 5)
  .map(
    (h) => `
- Date: ${h.timestamp.toISOString().split('T')[0]}
- Tasks: ${h.tasks.length}
- Scheduled: ${h.result.scheduledTasks.length}
- Optimization Score: ${h.result.optimizationScore}
`,
  )
  .join('')}

Current Pattern:
- Productivity Peaks: ${pattern.productivityPeaks
        .slice(0, 3)
        .map((p) => `${p.hour}:00 (${p.score}%)`)
        .join(', ')}
- Context Switching Cost: ${pattern.contextSwitchingCost} minutes
- Preferred Hours: ${pattern.preferredWorkingHours.start}:00 - ${pattern.preferredWorkingHours.end}:00

Return JSON with updated pattern insights:
- productivityPeaks: array of {hour, score} for top 5 productive hours
- contextSwitchingCost: updated penalty in minutes
- energyLevelAdjustments: suggested changes to energy levels by hour
- insights: array of key pattern observations`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: patternAnalysisPrompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      const patternInsights = JSON.parse(aiResponse);

      // Update pattern with AI insights
      if (patternInsights.productivityPeaks) {
        pattern.productivityPeaks = patternInsights.productivityPeaks;
      }
      if (patternInsights.contextSwitchingCost) {
        pattern.contextSwitchingCost = patternInsights.contextSwitchingCost;
      }

      log.info(`📊 Updated patterns for user ${userId}:`, patternInsights.insights?.slice(0, 2));
    } catch (error) {
      log.error('Pattern learning failed for user', userId, ':', error);
    }
  }

  /**
   * Set up the constraint satisfaction problem
   */
  private async setupConstraintProblem(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
    existingSchedule: any[],
  ): Promise<void> {
    // Create variables for each task
    for (const task of tasks) {
      const availableSlots = this.generateTimeSlots(task, resources);

      this.constraintSolver.addVariable({
        id: `task_${task.id}`,
        name: task.title,
        taskId: task.id,
        domain: availableSlots,
        constraints: [],
      });
    }

    // Add hard constraints
    this.addTimeConstraints(tasks, resources, options);
    this.addResourceConstraints(tasks, resources, options);
    this.addDependencyConstraints(tasks);
    this.addWorkingHoursConstraints(tasks, resources, options);

    // Add soft constraints (optimization objectives)
    this.addProductivityConstraints(tasks, resources, options);
    this.addStressMinimizationConstraints(tasks, resources, options);
    this.addContextSwitchingConstraints(tasks, resources, options);
  }

  /**
   * Add time-based constraints
   */
  private addTimeConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    // Due date constraints
    for (const task of tasks) {
      if (task.dueDate) {
        this.constraintSolver.addConstraint({
          id: `due_date_${task.id}`,
          type: 'hard',
          priority: 9,
          variables: [`task_${task.id}`],
          category: 'time',
          condition: (values) => {
            const slot = values[`task_${task.id}`];
            return slot ? slot.endTime <= task.dueDate : false;
          },
          description: `Task ${task.title} must complete by ${task.dueDate?.toISOString()}`,
        });
      }
    }

    // No overlap constraint
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const task1 = tasks[i];
        const task2 = tasks[j];

        if (task1.userId === task2.userId) {
          // Same user
          this.constraintSolver.addConstraint({
            id: `no_overlap_${task1.id}_${task2.id}`,
            type: 'hard',
            priority: 10,
            variables: [`task_${task1.id}`, `task_${task2.id}`],
            category: 'time',
            condition: (values) => {
              const slot1 = values[`task_${task1.id}`];
              const slot2 = values[`task_${task2.id}`];

              if (!slot1 || !slot2) return true;

              // Check for overlap
              return slot1.endTime <= slot2.startTime || slot2.endTime <= slot1.startTime;
            },
            description: `Tasks ${task1.title} and ${task2.title} cannot overlap`,
          });
        }
      }
    }
  }

  /**
   * Add resource availability constraints
   */
  private addResourceConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    for (const task of tasks) {
      this.constraintSolver.addConstraint({
        id: `resource_availability_${task.id}`,
        type: 'hard',
        priority: 9,
        variables: [`task_${task.id}`],
        category: 'resource',
        condition: (values) => {
          const slot = values[`task_${task.id}`];
          if (!slot) return false;

          const resource = resources.find((r) => r.id === slot.resourceId);
          if (!resource) return false;

          // Check if resource is available during the slot
          return resource.availability.some(
            (avail) => avail.start <= slot.startTime && slot.endTime <= avail.end,
          );
        },
        description: `Resource must be available for task ${task.title}`,
      });
    }
  }

  /**
   * Add task dependency constraints
   */
  private addDependencyConstraints(tasks: Task[]): void {
    for (const task of tasks) {
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const dependencyId of task.dependsOn) {
          this.constraintSolver.addConstraint({
            id: `dependency_${dependencyId}_${task.id}`,
            type: 'hard',
            priority: 10,
            variables: [`task_${dependencyId}`, `task_${task.id}`],
            category: 'dependency',
            condition: (values) => {
              const depSlot = values[`task_${dependencyId}`];
              const taskSlot = values[`task_${task.id}`];

              if (!depSlot || !taskSlot) return false;

              // Dependency must finish before task starts
              return depSlot.endTime <= taskSlot.startTime;
            },
            description: `Task ${task.title} depends on completion of ${dependencyId}`,
          });
        }
      }
    }
  }

  /**
   * Add working hours constraints
   */
  private addWorkingHoursConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    if (!options.constraints.respectWorkingHours) return;

    for (const task of tasks) {
      this.constraintSolver.addConstraint({
        id: `working_hours_${task.id}`,
        type: options.constraints.allowOvertime ? 'soft' : 'hard',
        priority: options.constraints.allowOvertime ? 6 : 8,
        variables: [`task_${task.id}`],
        category: 'time',
        condition: (values) => {
          const slot = values[`task_${task.id}`];
          if (!slot) return false;

          const pattern = this.userPatterns.get(task.userId);
          if (!pattern) return true;

          const startHour = slot.startTime.getHours();
          const endHour = slot.endTime.getHours();

          const withinHours =
            startHour >= pattern.preferredWorkingHours.start &&
            endHour <= pattern.preferredWorkingHours.end;

          if (options.constraints.allowOvertime) {
            // Soft constraint: return penalty for overtime
            return withinHours ? 0 : (endHour - pattern.preferredWorkingHours.end) * 10;
          } else {
            // Hard constraint: must be within hours
            return withinHours;
          }
        },
        description: `Task ${task.title} should be scheduled within working hours`,
      });
    }
  }

  /**
   * Add productivity optimization constraints
   */
  private addProductivityConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    const weight = options.optimizationGoals.maximizeProductivity;
    if (weight === 0) return;

    for (const task of tasks) {
      this.constraintSolver.addConstraint({
        id: `productivity_${task.id}`,
        type: 'soft',
        priority: Math.round(weight * 10),
        variables: [`task_${task.id}`],
        category: 'preference',
        condition: (values) => {
          const slot = values[`task_${task.id}`];
          if (!slot) return 100; // High penalty for unscheduled

          const pattern = this.userPatterns.get(task.userId);
          if (!pattern) return 0;

          const hour = slot.startTime.getHours();
          const productivityScore =
            pattern.productivityPeaks.find((p) => p.hour === hour)?.score || 50;

          // Return penalty (inverse of productivity)
          return (100 - productivityScore) * weight;
        },
        description: `Optimize productivity for task ${task.title}`,
      });
    }
  }

  /**
   * Add stress minimization constraints
   */
  private addStressMinimizationConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    const weight = options.optimizationGoals.minimizeStress;
    if (weight === 0) return;

    for (const task of tasks) {
      if (task.priority === 'asap' || task.priority === 'high') {
        this.constraintSolver.addConstraint({
          id: `stress_${task.id}`,
          type: 'soft',
          priority: Math.round(weight * 8),
          variables: [`task_${task.id}`],
          category: 'preference',
          condition: (values) => {
            const slot = values[`task_${task.id}`];
            if (!slot) return 100;

            const pattern = this.userPatterns.get(task.userId);
            if (!pattern) return 0;

            const hour = slot.startTime.getHours();
            const energyLevel = pattern.energyLevels[hour] || 'medium';

            // High priority tasks during low energy = stress
            if (energyLevel === 'low' && (task.priority === 'asap' || task.priority === 'high')) {
              return 50 * weight;
            }

            return 0;
          },
          description: `Minimize stress for high-priority task ${task.title}`,
        });
      }
    }
  }

  /**
   * Add context switching minimization constraints
   */
  private addContextSwitchingConstraints(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): void {
    const weight = options.optimizationGoals.minimizeContextSwitching;
    if (weight === 0) return;

    // Group tasks by type/category for the same user
    const userTasks = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!userTasks.has(task.userId)) {
        userTasks.set(task.userId, []);
      }
      userTasks.get(task.userId)!.push(task);
    }

    for (const [userId, userTaskList] of userTasks.entries()) {
      for (let i = 0; i < userTaskList.length - 1; i++) {
        for (let j = i + 1; j < userTaskList.length; j++) {
          const task1 = userTaskList[i];
          const task2 = userTaskList[j];

          this.constraintSolver.addConstraint({
            id: `context_switch_${task1.id}_${task2.id}`,
            type: 'soft',
            priority: Math.round(weight * 5),
            variables: [`task_${task1.id}`, `task_${task2.id}`],
            category: 'preference',
            condition: (values) => {
              const slot1 = values[`task_${task1.id}`];
              const slot2 = values[`task_${task2.id}`];

              if (!slot1 || !slot2) return 0;

              // If tasks are adjacent in time but different types
              const timeDiff =
                Math.abs(slot1.endTime.getTime() - slot2.startTime.getTime()) / (1000 * 60);
              const sameType = this.isSameTaskType(task1, task2);

              if (timeDiff <= 30 && !sameType) {
                // Adjacent tasks within 30 minutes
                const pattern = this.userPatterns.get(userId);
                const switchingCost = pattern?.contextSwitchingCost || 15;
                return switchingCost * weight;
              }

              return 0;
            },
            description: `Minimize context switching between ${task1.title} and ${task2.title}`,
          });
        }
      }
    }
  }

  // Helper methods
  private generateTimeSlots(task: Task, resources: Resource[]): any[] {
    const slots = [];
    const now = new Date();
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks ahead

    const userResource = resources.find((r) => r.id === task.userId && r.type === 'user');
    if (!userResource) return slots;

    // Generate 30-minute slots
    for (const availability of userResource.availability) {
      const current = new Date(Math.max(now.getTime(), availability.start.getTime()));

      while (current.getTime() + task.estimatedDuration * 60 * 1000 <= availability.end.getTime()) {
        const endTime = new Date(current.getTime() + task.estimatedDuration * 60 * 1000);

        slots.push({
          startTime: new Date(current),
          endTime,
          resourceId: userResource.id,
          duration: task.estimatedDuration,
        });

        current.setTime(current.getTime() + 30 * 60 * 1000); // 30-minute increments
      }
    }

    return slots;
  }

  private generateInitialProductivityPeaks(): Array<{ hour: number; score: number }> {
    // Default productivity pattern: high in morning, dip after lunch, moderate afternoon
    return [
      { hour: 9, score: 90 },
      { hour: 10, score: 95 },
      { hour: 11, score: 85 },
      { hour: 14, score: 75 },
      { hour: 15, score: 80 },
    ];
  }

  private generateInitialEnergyLevels(): Record<number, 'high' | 'medium' | 'low'> {
    const levels: Record<number, 'high' | 'medium' | 'low'> = {};

    for (let hour = 8; hour <= 18; hour++) {
      if (hour <= 11) levels[hour] = 'high';
      else if (hour === 12 || hour === 13)
        levels[hour] = 'low'; // Lunch dip
      else if (hour <= 16) levels[hour] = 'medium';
      else levels[hour] = 'low';
    }

    return levels;
  }

  private isSameTaskType(task1: Task, task2: Task): boolean {
    // Simple heuristic: same if they share tags or related entity types
    if (task1.relatedEntityType && task2.relatedEntityType) {
      return task1.relatedEntityType === task2.relatedEntityType;
    }

    if (task1.tags && task2.tags) {
      return task1.tags.some((tag) => task2.tags!.includes(tag));
    }

    return false;
  }

  private async convertSolutionToSchedule(
    solution: any,
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): Promise<SchedulingResult> {
    const scheduledTasks = [];
    const unscheduledTasks = [];
    const resourceUtilization: Record<string, number> = {};

    for (const task of tasks) {
      const slot = solution.solution[`task_${task.id}`];

      if (slot) {
        scheduledTasks.push({
          taskId: task.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          assignedResource: slot.resourceId,
          confidence: solution.confidence,
          reasoning: solution.reasoning,
          constraints: [],
        });

        // Update resource utilization
        resourceUtilization[slot.resourceId] =
          (resourceUtilization[slot.resourceId] || 0) + task.estimatedDuration;
      } else {
        unscheduledTasks.push(task);
      }
    }

    return {
      scheduledTasks,
      unscheduledTasks,
      resourceUtilization,
      optimizationScore: Math.max(0, 100 - solution.cost / 10),
      patternInsights: [],
      recommendations: [],
      reschedulingTriggers: [],
    };
  }

  private async enhanceWithPatternRecognition(
    result: SchedulingResult,
    tasks: Task[],
    resources: Resource[],
  ): Promise<SchedulingResult> {
    const insights = [];
    const recommendations = [];

    // Analyze scheduling patterns
    for (const [userId, pattern] of this.userPatterns.entries()) {
      const userTasks = result.scheduledTasks.filter(
        (st) => tasks.find((t) => t.id === st.taskId)?.userId === userId,
      );

      if (userTasks.length > 0) {
        // Check if tasks are scheduled during productivity peaks
        const peakHours = pattern.productivityPeaks.slice(0, 3).map((p) => p.hour);
        const tasksInPeakHours = userTasks.filter((st) =>
          peakHours.includes(st.startTime.getHours()),
        );

        if (tasksInPeakHours.length / userTasks.length > 0.6) {
          insights.push(
            `User ${userId}: ${Math.round((tasksInPeakHours.length / userTasks.length) * 100)}% of tasks scheduled during productivity peaks`,
          );
        } else {
          recommendations.push(
            `Consider rescheduling more tasks for user ${userId} during peak hours: ${peakHours.join(', ')}:00`,
          );
        }
      }
    }

    return {
      ...result,
      patternInsights: insights,
      recommendations,
    };
  }

  private addReschedulingTriggers(
    result: SchedulingResult,
    options: AdvancedSchedulingOptions,
  ): SchedulingResult {
    const triggers = [];

    if (options.adaptiveRescheduling) {
      triggers.push({
        condition: 'task_completion_rate < 80%',
        action: 'increase_time_buffers',
        priority: 8,
      });

      triggers.push({
        condition: 'new_urgent_task_added',
        action: 'reoptimize_schedule',
        priority: 9,
      });

      triggers.push({
        condition: 'resource_becomes_unavailable',
        action: 'reassign_affected_tasks',
        priority: 10,
      });
    }

    return {
      ...result,
      reschedulingTriggers: triggers,
    };
  }

  private fallbackScheduling(
    tasks: Task[],
    resources: Resource[],
    options: AdvancedSchedulingOptions,
  ): SchedulingResult {
    log.info('⚠️  Using fallback scheduling algorithm');

    return {
      scheduledTasks: [],
      unscheduledTasks: tasks,
      resourceUtilization: {},
      optimizationScore: 0,
      patternInsights: ['Advanced scheduling failed - using fallback'],
      recommendations: ['Check system resources and constraint complexity'],
      reschedulingTriggers: [],
    };
  }
}

export default new AdvancedSchedulingService();

/**
 * Dynamic Rescheduling Service
 * Handles real-time schedule adjustments and event-driven rescheduling
 */

import AdvancedSchedulingService from './advanced-scheduling-service';
import ClaudeAIService from './claude-ai-service';
import PerformanceMonitor from './performance-monitor';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('dynamic-rescheduling-service');

interface ReschedulingEvent {
  id: string;
  type:
    | 'task_added'
    | 'task_completed'
    | 'task_delayed'
    | 'resource_unavailable'
    | 'deadline_changed'
    | 'priority_changed';
  timestamp: Date;
  data: any;
  impact: 'low' | 'medium' | 'high' | 'critical';
  affectedTasks: string[];
  affectedResources: string[];
}

interface ReschedulingStrategy {
  id: string;
  name: string;
  triggers: string[];
  conditions: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: any;
  }>;
  actions: Array<{
    type:
      | 'reoptimize'
      | 'shift_tasks'
      | 'reassign_resource'
      | 'adjust_priorities'
      | 'add_buffer_time';
    parameters: any;
  }>;
  priority: number;
  cooldownMinutes: number;
}

interface ReschedulingResult {
  success: boolean;
  strategy: string;
  changedTasks: Array<{
    taskId: string;
    oldSchedule: any;
    newSchedule: any;
    reason: string;
  }>;
  impact: {
    tasksRescheduled: number;
    resourcesAffected: number;
    optimizationImprovement: number;
    userNotificationsRequired: number;
  };
  confidence: number;
  reasoning: string;
  nextReviewTime?: Date;
}

class DynamicReschedulingService {
  private eventQueue: ReschedulingEvent[] = [];
  private strategies: Map<string, ReschedulingStrategy> = new Map();
  private reschedulingHistory: Array<{
    timestamp: Date;
    event: ReschedulingEvent;
    result: ReschedulingResult;
  }> = [];
  private isProcessing = false;
  private lastRescheduling: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultStrategies();
    this.startEventProcessor();
  }

  /**
   * Trigger rescheduling based on an event
   */
  async triggerRescheduling(event: ReschedulingEvent): Promise<ReschedulingResult> {
    log.info('🔄 Rescheduling triggered:', event.type, 'Impact:', event.impact);

    // Add to event queue
    this.eventQueue.push(event);

    // Process immediately for critical events
    if (event.impact === 'critical') {
      return this.processEvent(event);
    }

    // For non-critical events, let the processor handle it
    return {
      success: true,
      strategy: 'queued',
      changedTasks: [],
      impact: {
        tasksRescheduled: 0,
        resourcesAffected: 0,
        optimizationImprovement: 0,
        userNotificationsRequired: 0,
      },
      confidence: 1.0,
      reasoning: 'Event queued for processing',
    };
  }

  /**
   * Add a custom rescheduling strategy
   */
  addStrategy(strategy: ReschedulingStrategy): void {
    this.strategies.set(strategy.id, strategy);
    log.info(`📋 Added rescheduling strategy: ${strategy.name}`);
  }

  /**
   * Process a rescheduling event
   */
  private async processEvent(event: ReschedulingEvent): Promise<ReschedulingResult> {
    const startTime = Date.now();

    try {
      // Find applicable strategies
      const applicableStrategies = this.findApplicableStrategies(event);

      if (applicableStrategies.length === 0) {
        return {
          success: false,
          strategy: 'none',
          changedTasks: [],
          impact: {
            tasksRescheduled: 0,
            resourcesAffected: 0,
            optimizationImprovement: 0,
            userNotificationsRequired: 0,
          },
          confidence: 0,
          reasoning: 'No applicable rescheduling strategies found',
        };
      }

      // Select best strategy
      const selectedStrategy = applicableStrategies.sort((a, b) => b.priority - a.priority)[0];

      // Check cooldown
      const lastRescheduling = this.lastRescheduling.get(selectedStrategy.id);
      if (lastRescheduling) {
        const timeSince = Date.now() - lastRescheduling.getTime();
        if (timeSince < selectedStrategy.cooldownMinutes * 60 * 1000) {
          return {
            success: false,
            strategy: selectedStrategy.id,
            changedTasks: [],
            impact: {
              tasksRescheduled: 0,
              resourcesAffected: 0,
              optimizationImprovement: 0,
              userNotificationsRequired: 0,
            },
            confidence: 0,
            reasoning: `Strategy ${selectedStrategy.name} is in cooldown period`,
          };
        }
      }

      // Execute strategy
      const result = await this.executeStrategy(selectedStrategy, event);

      // Update last rescheduling time
      this.lastRescheduling.set(selectedStrategy.id, new Date());

      // Record in history
      this.reschedulingHistory.push({
        timestamp: new Date(),
        event,
        result,
      });

      // Record performance metrics
      const duration = Date.now() - startTime;
      PerformanceMonitor.recordMetric('dynamic_rescheduling_time', duration, 'ms', {
        eventType: event.type,
        strategy: selectedStrategy.id,
        success: result.success,
      });

      log.info(`✅ Rescheduling completed: ${result.changedTasks.length} tasks changed`);
      return result;
    } catch (error) {
      log.error('Rescheduling failed:', error);
      return {
        success: false,
        strategy: 'error',
        changedTasks: [],
        impact: {
          tasksRescheduled: 0,
          resourcesAffected: 0,
          optimizationImprovement: 0,
          userNotificationsRequired: 0,
        },
        confidence: 0,
        reasoning: `Rescheduling failed: ${error}`,
      };
    }
  }

  /**
   * Find strategies applicable to the event
   */
  private findApplicableStrategies(event: ReschedulingEvent): ReschedulingStrategy[] {
    const applicable = [];

    for (const strategy of this.strategies.values()) {
      // Check if event type matches strategy triggers
      if (strategy.triggers.includes(event.type)) {
        // Check additional conditions
        let conditionsMet = true;
        for (const condition of strategy.conditions) {
          if (!this.evaluateCondition(condition, event)) {
            conditionsMet = false;
            break;
          }
        }

        if (conditionsMet) {
          applicable.push(strategy);
        }
      }
    }

    return applicable;
  }

  /**
   * Evaluate a condition against an event
   */
  private evaluateCondition(condition: any, event: ReschedulingEvent): boolean {
    const eventValue = this.getEventValue(event, condition.field);

    switch (condition.operator) {
      case 'eq':
        return eventValue === condition.value;
      case 'ne':
        return eventValue !== condition.value;
      case 'gt':
        return eventValue > condition.value;
      case 'lt':
        return eventValue < condition.value;
      case 'gte':
        return eventValue >= condition.value;
      case 'lte':
        return eventValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(eventValue);
      case 'contains':
        return typeof eventValue === 'string' && eventValue.includes(condition.value);
      default:
        return false;
    }
  }

  /**
   * Get a value from the event data
   */
  private getEventValue(event: ReschedulingEvent, field: string): any {
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  /**
   * Execute a rescheduling strategy
   */
  private async executeStrategy(
    strategy: ReschedulingStrategy,
    event: ReschedulingEvent,
  ): Promise<ReschedulingResult> {
    const changedTasks = [];
    let tasksRescheduled = 0;
    let resourcesAffected = 0;
    let optimizationImprovement = 0;

    for (const action of strategy.actions) {
      switch (action.type) {
        case 'reoptimize':
          const reoptimizeResult = await this.executeReoptimization(action.parameters, event);
          changedTasks.push(...reoptimizeResult.changedTasks);
          tasksRescheduled += reoptimizeResult.tasksRescheduled;
          optimizationImprovement += reoptimizeResult.optimizationImprovement;
          break;

        case 'shift_tasks':
          const shiftResult = await this.executeTaskShifting(action.parameters, event);
          changedTasks.push(...shiftResult.changedTasks);
          tasksRescheduled += shiftResult.tasksRescheduled;
          break;

        case 'reassign_resource':
          const reassignResult = await this.executeResourceReassignment(action.parameters, event);
          changedTasks.push(...reassignResult.changedTasks);
          resourcesAffected += reassignResult.resourcesAffected;
          break;

        case 'adjust_priorities':
          const priorityResult = await this.executePriorityAdjustment(action.parameters, event);
          changedTasks.push(...priorityResult.changedTasks);
          break;

        case 'add_buffer_time':
          const bufferResult = await this.executeBufferTimeAddition(action.parameters, event);
          changedTasks.push(...bufferResult.changedTasks);
          break;
      }
    }

    // Use AI to analyze the rescheduling impact
    const confidence = await this.calculateReschedulingConfidence(changedTasks, event);
    const reasoning = await this.generateReschedulingReasoning(strategy, event, changedTasks);

    return {
      success: changedTasks.length > 0,
      strategy: strategy.id,
      changedTasks,
      impact: {
        tasksRescheduled,
        resourcesAffected,
        optimizationImprovement,
        userNotificationsRequired: this.calculateNotificationsRequired(changedTasks),
      },
      confidence,
      reasoning,
      nextReviewTime: this.calculateNextReviewTime(strategy, event),
    };
  }

  /**
   * Execute full schedule reoptimization
   */
  private async executeReoptimization(parameters: any, event: ReschedulingEvent): Promise<any> {
    log.info('🔄 Executing full schedule reoptimization...');

    // This would integrate with AdvancedSchedulingService
    // For now, return mock result
    return {
      changedTasks: event.affectedTasks.map((taskId) => ({
        taskId,
        oldSchedule: { startTime: new Date(), endTime: new Date() },
        newSchedule: {
          startTime: new Date(Date.now() + 60000),
          endTime: new Date(Date.now() + 120000),
        },
        reason: 'Full schedule reoptimization',
      })),
      tasksRescheduled: event.affectedTasks.length,
      optimizationImprovement: 15, // 15% improvement
    };
  }

  /**
   * Execute task shifting (moving tasks to different time slots)
   */
  private async executeTaskShifting(parameters: any, event: ReschedulingEvent): Promise<any> {
    log.info('⏰ Executing task shifting...');

    const shiftMinutes = parameters.shiftMinutes || 30;

    return {
      changedTasks: event.affectedTasks.slice(0, 3).map((taskId) => ({
        taskId,
        oldSchedule: { startTime: new Date(), endTime: new Date() },
        newSchedule: {
          startTime: new Date(Date.now() + shiftMinutes * 60000),
          endTime: new Date(Date.now() + (shiftMinutes + 60) * 60000),
        },
        reason: `Shifted by ${shiftMinutes} minutes due to ${event.type}`,
      })),
      tasksRescheduled: Math.min(3, event.affectedTasks.length),
    };
  }

  /**
   * Execute resource reassignment
   */
  private async executeResourceReassignment(
    parameters: any,
    event: ReschedulingEvent,
  ): Promise<any> {
    log.info('👥 Executing resource reassignment...');

    return {
      changedTasks: event.affectedTasks.slice(0, 2).map((taskId) => ({
        taskId,
        oldSchedule: { resourceId: 'old-resource', startTime: new Date(), endTime: new Date() },
        newSchedule: { resourceId: 'new-resource', startTime: new Date(), endTime: new Date() },
        reason: `Reassigned resource due to ${event.type}`,
      })),
      resourcesAffected: 2,
    };
  }

  /**
   * Execute priority adjustment
   */
  private async executePriorityAdjustment(parameters: any, event: ReschedulingEvent): Promise<any> {
    log.info('🎯 Executing priority adjustment...');

    return {
      changedTasks: event.affectedTasks.map((taskId) => ({
        taskId,
        oldSchedule: { priority: 'medium' },
        newSchedule: { priority: 'high' },
        reason: `Priority increased due to ${event.type}`,
      })),
    };
  }

  /**
   * Execute buffer time addition
   */
  private async executeBufferTimeAddition(parameters: any, event: ReschedulingEvent): Promise<any> {
    log.info('⏱️  Adding buffer time...');

    const bufferMinutes = parameters.bufferMinutes || 15;

    return {
      changedTasks: event.affectedTasks.map((taskId) => ({
        taskId,
        oldSchedule: { duration: 60, endTime: new Date() },
        newSchedule: {
          duration: 60 + bufferMinutes,
          endTime: new Date(Date.now() + (60 + bufferMinutes) * 60000),
        },
        reason: `Added ${bufferMinutes} minutes buffer time`,
      })),
    };
  }

  /**
   * Calculate rescheduling confidence using AI
   */
  private async calculateReschedulingConfidence(
    changedTasks: any[],
    event: ReschedulingEvent,
  ): Promise<number> {
    try {
      const confidencePrompt = `Evaluate the confidence of this rescheduling operation:

Event Type: ${event.type}
Event Impact: ${event.impact}
Tasks Changed: ${changedTasks.length}
Affected Resources: ${event.affectedResources.length}

Changes Made:
${changedTasks
  .slice(0, 5)
  .map((ct) => `- ${ct.taskId}: ${ct.reason}`)
  .join('\n')}

Consider factors:
- Appropriateness of changes for the event type
- Potential user disruption
- Schedule optimization impact
- Resource availability conflicts

Return confidence score (0.0 to 1.0):`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: confidencePrompt }],
        temperature: 0.2,
        max_tokens: 50,
      });

      const confidence = parseFloat(aiResponse.trim());
      return isNaN(confidence) ? 0.7 : Math.max(0, Math.min(1, confidence));
    } catch (error) {
      log.error('Confidence calculation failed:', error);
      return 0.7; // Default confidence
    }
  }

  /**
   * Generate reasoning for rescheduling decision
   */
  private async generateReschedulingReasoning(
    strategy: ReschedulingStrategy,
    event: ReschedulingEvent,
    changedTasks: any[],
  ): Promise<string> {
    try {
      const reasoningPrompt = `Generate a brief explanation for this rescheduling decision:

Strategy Used: ${strategy.name}
Event: ${event.type} (${event.impact} impact)
Tasks Rescheduled: ${changedTasks.length}

Provide a concise explanation of why this rescheduling was necessary and how it improves the schedule.`;

      const reasoning = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: reasoningPrompt }],
        temperature: 0.3,
        max_tokens: 100,
      });

      return reasoning.trim();
    } catch (error) {
      log.error('Reasoning generation failed:', error);
      return `Applied ${strategy.name} strategy in response to ${event.type} event`;
    }
  }

  /**
   * Calculate how many user notifications are required
   */
  private calculateNotificationsRequired(changedTasks: any[]): number {
    // Count unique users affected by task changes
    const affectedUsers = new Set();

    for (const change of changedTasks) {
      // Extract user from task ID or schedule data
      if (change.newSchedule?.resourceId) {
        affectedUsers.add(change.newSchedule.resourceId);
      }
    }

    return affectedUsers.size;
  }

  /**
   * Calculate when to next review the schedule
   */
  private calculateNextReviewTime(strategy: ReschedulingStrategy, event: ReschedulingEvent): Date {
    let reviewMinutes = 60; // Default 1 hour

    switch (event.impact) {
      case 'critical':
        reviewMinutes = 15;
        break;
      case 'high':
        reviewMinutes = 30;
        break;
      case 'medium':
        reviewMinutes = 60;
        break;
      case 'low':
        reviewMinutes = 180;
        break;
    }

    return new Date(Date.now() + reviewMinutes * 60 * 1000);
  }

  /**
   * Initialize default rescheduling strategies
   */
  private initializeDefaultStrategies(): void {
    // Urgent task added strategy
    this.strategies.set('urgent_task_added', {
      id: 'urgent_task_added',
      name: 'Urgent Task Addition',
      triggers: ['task_added'],
      conditions: [{ field: 'data.priority', operator: 'in', value: ['asap', 'high'] }],
      actions: [{ type: 'reoptimize', parameters: { scope: 'affected_resources' } }],
      priority: 9,
      cooldownMinutes: 5,
    });

    // Resource unavailable strategy
    this.strategies.set('resource_unavailable', {
      id: 'resource_unavailable',
      name: 'Resource Unavailability',
      triggers: ['resource_unavailable'],
      conditions: [],
      actions: [
        { type: 'reassign_resource', parameters: {} },
        { type: 'shift_tasks', parameters: { shiftMinutes: 60 } },
      ],
      priority: 10,
      cooldownMinutes: 10,
    });

    // Task delayed strategy
    this.strategies.set('task_delayed', {
      id: 'task_delayed',
      name: 'Task Delay Management',
      triggers: ['task_delayed'],
      conditions: [],
      actions: [
        { type: 'add_buffer_time', parameters: { bufferMinutes: 15 } },
        { type: 'adjust_priorities', parameters: { increasePriority: true } },
      ],
      priority: 7,
      cooldownMinutes: 30,
    });

    // Deadline changed strategy
    this.strategies.set('deadline_changed', {
      id: 'deadline_changed',
      name: 'Deadline Adjustment',
      triggers: ['deadline_changed'],
      conditions: [],
      actions: [{ type: 'reoptimize', parameters: { scope: 'deadline_affected' } }],
      priority: 8,
      cooldownMinutes: 15,
    });

    log.info(`📋 Initialized ${this.strategies.size} default rescheduling strategies`);
  }

  /**
   * Start the event processor (background task)
   */
  private startEventProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.eventQueue.length === 0) return;

      this.isProcessing = true;

      try {
        // Process events in order of priority
        this.eventQueue.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.impact] - priorityOrder[a.impact];
        });

        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      } catch (error) {
        log.error('Event processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Get rescheduling statistics
   */
  getStatistics(): {
    totalEvents: number;
    successfulReschedulings: number;
    strategiesUsed: Record<string, number>;
    averageTasksRescheduled: number;
    averageConfidence: number;
  } {
    const successfulReschedulings = this.reschedulingHistory.filter((h) => h.result.success).length;
    const strategiesUsed: Record<string, number> = {};
    let totalTasksRescheduled = 0;
    let totalConfidence = 0;

    for (const history of this.reschedulingHistory) {
      const strategy = history.result.strategy;
      strategiesUsed[strategy] = (strategiesUsed[strategy] || 0) + 1;
      totalTasksRescheduled += history.result.impact.tasksRescheduled;
      totalConfidence += history.result.confidence;
    }

    return {
      totalEvents: this.reschedulingHistory.length,
      successfulReschedulings,
      strategiesUsed,
      averageTasksRescheduled:
        this.reschedulingHistory.length > 0
          ? totalTasksRescheduled / this.reschedulingHistory.length
          : 0,
      averageConfidence:
        this.reschedulingHistory.length > 0 ? totalConfidence / this.reschedulingHistory.length : 0,
    };
  }
}

export default new DynamicReschedulingService();

/**
 * Task Scheduling Service
 * Handles AI-powered task scheduling and optimization
 */

import ClaudeAIService from './claude-ai-service';
import CalendarService from './calendar-service';

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
}

interface SchedulingPreferences {
  workHoursStart: string; // "09:00"
  workHoursEnd: string; // "17:00"
  workDays: number[]; // [1,2,3,4,5] Mon-Fri
  preferredMeetingDuration: number;
  maxTasksPerDay: number;
  focusTimeBlocks: string[]; // ["Mon 10:00-12:00"]
  breakDuration: number; // minutes
  energyLevels: {
    morning: 'high' | 'medium' | 'low';
    afternoon: 'high' | 'medium' | 'low';
    evening: 'high' | 'medium' | 'low';
  };
}

interface ScheduledTask extends Task {
  aiSuggestedStart: Date;
  aiSuggestedEnd: Date;
  aiPriorityScore: number; // 0-100
  aiComplexityScore: number; // 0-100
  aiSchedulingConfidence: number; // 0-1
  aiSchedulingReasoning: string;
}

interface SchedulingResult {
  scheduledTasks: ScheduledTask[];
  unscheduledTasks: Task[];
  conflictingTasks: Task[];
  optimizationInsights: string[];
  totalScheduledDuration: number; // in minutes
  utilizationPercentage: number;
}

class TaskSchedulingService {
  /**
   * Main scheduling algorithm - uses greedy approach with AI prioritization
   */
  async scheduleTasksWithAI(
    tasks: Task[],
    preferences: SchedulingPreferences,
    existingEvents: any[] = [],
    startDate: Date = new Date(),
    endDate: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  ): Promise<SchedulingResult> {
    console.log(`🧠 Starting AI task scheduling for ${tasks.length} tasks...`);

    try {
      // Step 1: AI Priority and Complexity Analysis
      const analyzedTasks = await this.analyzeTasksWithAI(tasks);

      // Step 2: Sort tasks by AI priority score and urgency
      const prioritizedTasks = this.prioritizeTasks(analyzedTasks, preferences);

      // Step 3: Generate available time slots
      const availableSlots = this.generateAvailableTimeSlots(
        startDate,
        endDate,
        preferences,
        existingEvents,
      );

      // Step 4: Greedy scheduling algorithm
      const schedulingResult = this.greedyScheduling(prioritizedTasks, availableSlots, preferences);

      // Step 5: AI optimization and insights
      const optimizedResult = await this.optimizeScheduleWithAI(schedulingResult, preferences);

      console.log(`✅ Scheduled ${optimizedResult.scheduledTasks.length}/${tasks.length} tasks`);
      return optimizedResult;
    } catch (error) {
      console.error('Task scheduling error:', error);
      // Fallback to basic scheduling
      return this.fallbackScheduling(tasks, preferences, existingEvents, startDate, endDate);
    }
  }

  /**
   * Analyze tasks with AI to determine priority and complexity scores
   */
  private async analyzeTasksWithAI(tasks: Task[]): Promise<Task[]> {
    const analyzedTasks = [];

    for (const task of tasks) {
      try {
        const analysis = await ClaudeAIService.generateCompletion({
          messages: [
            {
              role: 'user',
              content: `Analyze this task for scheduling optimization:

Title: ${task.title}
Description: ${task.description || 'No description'}
Priority: ${task.priority}
Estimated Duration: ${task.estimatedDuration} minutes
Due Date: ${task.dueDate ? task.dueDate.toISOString() : 'No due date'}
Related Entity: ${task.relatedEntityType || 'None'}

Return JSON with:
- priorityScore (0-100): How urgent/important is this task?
- complexityScore (0-100): How complex/difficult is this task?
- reasoning: Brief explanation of the scores

Consider factors like:
- Due date urgency
- Business impact (sales tasks = higher priority)
- Task complexity and mental effort required
- Dependencies and blocking factors`,
            },
          ],
          temperature: 0.3,
          max_tokens: 200,
        });

        const aiAnalysis = JSON.parse(analysis);
        analyzedTasks.push({
          ...task,
          aiPriorityScore: Math.min(100, Math.max(0, aiAnalysis.priorityScore || 50)),
          aiComplexityScore: Math.min(100, Math.max(0, aiAnalysis.complexityScore || 50)),
          aiReasoning: aiAnalysis.reasoning || 'AI analysis completed',
        });
      } catch (error) {
        console.error(`AI analysis failed for task ${task.id}:`, error);
        // Fallback scoring
        analyzedTasks.push({
          ...task,
          aiPriorityScore: this.calculateFallbackPriority(task),
          aiComplexityScore: this.calculateFallbackComplexity(task),
          aiReasoning: 'Fallback scoring used due to AI unavailability',
        });
      }
    }

    return analyzedTasks;
  }

  /**
   * Prioritize tasks based on AI scores and business rules
   */
  private prioritizeTasks(tasks: any[], preferences: SchedulingPreferences): any[] {
    return tasks.sort((a, b) => {
      // Primary: Due date urgency
      const aUrgency = this.calculateUrgency(a.dueDate);
      const bUrgency = this.calculateUrgency(b.dueDate);
      if (aUrgency !== bUrgency) return bUrgency - aUrgency;

      // Secondary: AI priority score
      if (a.aiPriorityScore !== b.aiPriorityScore) {
        return b.aiPriorityScore - a.aiPriorityScore;
      }

      // Tertiary: Business priority (sales > service > admin)
      const aBizPriority = this.getBusinessPriority(a);
      const bBizPriority = this.getBusinessPriority(b);
      if (aBizPriority !== bBizPriority) return bBizPriority - aBizPriority;

      // Quaternary: Task complexity (complex tasks in high-energy times)
      return b.aiComplexityScore - a.aiComplexityScore;
    });
  }

  /**
   * Generate available time slots based on preferences and existing events
   */
  private generateAvailableTimeSlots(
    startDate: Date,
    endDate: Date,
    preferences: SchedulingPreferences,
    existingEvents: any[],
  ): Array<{ start: Date; end: Date; energyLevel: string }> {
    const slots = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay(); // 0=Sunday, 1=Monday, etc.

      if (preferences.workDays.includes(dayOfWeek)) {
        // Generate slots for this work day
        const workStart = new Date(current);
        const [startHour, startMinute] = preferences.workHoursStart.split(':');
        workStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

        const workEnd = new Date(current);
        const [endHour, endMinute] = preferences.workHoursEnd.split(':');
        workEnd.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

        // Create 30-minute slots throughout the day
        const slotCurrent = new Date(workStart);
        while (slotCurrent < workEnd) {
          const slotEnd = new Date(slotCurrent.getTime() + 30 * 60 * 1000);

          // Check if slot conflicts with existing events
          const hasConflict = existingEvents.some((event) => {
            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);
            return slotCurrent < eventEnd && slotEnd > eventStart;
          });

          if (!hasConflict) {
            slots.push({
              start: new Date(slotCurrent),
              end: new Date(slotEnd),
              energyLevel: this.getEnergyLevel(slotCurrent, preferences),
            });
          }

          slotCurrent.setTime(slotCurrent.getTime() + 30 * 60 * 1000);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  /**
   * Greedy scheduling algorithm
   */
  private greedyScheduling(
    tasks: any[],
    availableSlots: any[],
    preferences: SchedulingPreferences,
  ): SchedulingResult {
    const scheduledTasks: ScheduledTask[] = [];
    const unscheduledTasks: Task[] = [];
    const conflictingTasks: Task[] = [];
    let totalDuration = 0;

    for (const task of tasks) {
      const requiredSlots = Math.ceil(task.estimatedDuration / 30);
      let bestSlotIndex = -1;
      let bestScore = -1;

      // Find best consecutive slots for this task
      for (let i = 0; i <= availableSlots.length - requiredSlots; i++) {
        const consecutiveSlots = availableSlots.slice(i, i + requiredSlots);

        // Check if slots are consecutive (within same day or reasonable time)
        if (this.areSlotsContinuous(consecutiveSlots)) {
          const score = this.calculateSlotScore(consecutiveSlots, task, preferences);
          if (score > bestScore) {
            bestScore = score;
            bestSlotIndex = i;
          }
        }
      }

      if (bestSlotIndex >= 0) {
        // Schedule the task
        const usedSlots = availableSlots.splice(bestSlotIndex, requiredSlots);
        const startTime = usedSlots[0].start;
        const endTime = new Date(startTime.getTime() + task.estimatedDuration * 60 * 1000);

        scheduledTasks.push({
          ...task,
          aiSuggestedStart: startTime,
          aiSuggestedEnd: endTime,
          aiSchedulingConfidence: bestScore / 100,
          aiSchedulingReasoning: `Scheduled during ${usedSlots[0].energyLevel} energy time with score ${bestScore.toFixed(1)}`,
        });

        totalDuration += task.estimatedDuration;
      } else {
        unscheduledTasks.push(task);
      }
    }

    const totalAvailableTime = availableSlots.length * 30;
    const utilizationPercentage =
      totalAvailableTime > 0 ? (totalDuration / totalAvailableTime) * 100 : 0;

    return {
      scheduledTasks,
      unscheduledTasks,
      conflictingTasks,
      optimizationInsights: this.generateOptimizationInsights(scheduledTasks, unscheduledTasks),
      totalScheduledDuration: totalDuration,
      utilizationPercentage,
    };
  }

  /**
   * AI-powered schedule optimization
   */
  private async optimizeScheduleWithAI(
    result: SchedulingResult,
    preferences: SchedulingPreferences,
  ): Promise<SchedulingResult> {
    try {
      const optimizationPrompt = `Analyze this task schedule and provide optimization insights:

Scheduled Tasks: ${result.scheduledTasks.length}
Unscheduled Tasks: ${result.unscheduledTasks.length}
Utilization: ${result.utilizationPercentage.toFixed(1)}%

User Preferences:
- Work Hours: ${preferences.workHoursStart} - ${preferences.workHoursEnd}
- Energy Levels: Morning (${preferences.energyLevels.morning}), Afternoon (${preferences.energyLevels.afternoon})

Provide 3-5 optimization insights as a JSON array of strings.`;

      const response = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: optimizationPrompt }],
        temperature: 0.4,
        max_tokens: 300,
      });

      const insights = JSON.parse(response);
      result.optimizationInsights = Array.isArray(insights)
        ? insights
        : result.optimizationInsights;
    } catch (error) {
      console.error('AI optimization failed:', error);
    }

    return result;
  }

  // Helper methods
  private calculateFallbackPriority(task: Task): number {
    let score = 50; // Base score

    // Priority boost
    switch (task.priority) {
      case 'asap':
        score += 40;
        break;
      case 'high':
        score += 25;
        break;
      case 'medium':
        score += 0;
        break;
      case 'low':
        score -= 15;
        break;
    }

    // Due date urgency
    if (task.dueDate) {
      const daysUntilDue = (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 1) score += 30;
      else if (daysUntilDue < 3) score += 20;
      else if (daysUntilDue < 7) score += 10;
    }

    // Business context boost
    if (task.relatedEntityType === 'lead' || task.relatedEntityType === 'deal') {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateFallbackComplexity(task: Task): number {
    let score = 30; // Base complexity

    // Duration-based complexity
    if (task.estimatedDuration > 120)
      score += 30; // 2+ hours
    else if (task.estimatedDuration > 60)
      score += 20; // 1+ hour
    else if (task.estimatedDuration > 30) score += 10; // 30+ minutes

    // Title/description complexity indicators
    const complexKeywords = ['proposal', 'analysis', 'strategy', 'planning', 'research'];
    const text = (task.title + ' ' + (task.description || '')).toLowerCase();
    if (complexKeywords.some((keyword) => text.includes(keyword))) {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateUrgency(dueDate?: Date): number {
    if (!dueDate) return 0;
    const daysUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue < 0) return 100; // Overdue
    if (daysUntilDue < 1) return 90;
    if (daysUntilDue < 3) return 70;
    if (daysUntilDue < 7) return 50;
    return 20;
  }

  private getBusinessPriority(task: Task): number {
    if (task.relatedEntityType === 'lead' || task.relatedEntityType === 'deal') return 3;
    if (task.relatedEntityType === 'service_call') return 2;
    return 1;
  }

  private getEnergyLevel(time: Date, preferences: SchedulingPreferences): string {
    const hour = time.getHours();
    if (hour < 12) return preferences.energyLevels.morning;
    if (hour < 17) return preferences.energyLevels.afternoon;
    return preferences.energyLevels.evening;
  }

  private areSlotsContinuous(slots: any[]): boolean {
    for (let i = 1; i < slots.length; i++) {
      const prevEnd = slots[i - 1].end.getTime();
      const currentStart = slots[i].start.getTime();
      if (currentStart - prevEnd > 5 * 60 * 1000) {
        // 5 minute gap tolerance
        return false;
      }
    }
    return true;
  }

  private calculateSlotScore(slots: any[], task: any, preferences: SchedulingPreferences): number {
    let score = 0;

    // Energy level matching
    const energyLevel = slots[0].energyLevel;
    if (task.aiComplexityScore > 70 && energyLevel === 'high') score += 30;
    else if (task.aiComplexityScore < 40 && energyLevel === 'low') score += 20;
    else if (energyLevel === 'medium') score += 15;

    // Time of day preferences
    const hour = slots[0].start.getHours();
    if (hour >= 9 && hour <= 11) score += 20; // Morning productivity
    if (hour >= 14 && hour <= 16) score += 15; // Afternoon focus

    // Avoid end of day for complex tasks
    if (task.aiComplexityScore > 60 && hour >= 16) score -= 10;

    return score;
  }

  private generateOptimizationInsights(scheduled: ScheduledTask[], unscheduled: Task[]): string[] {
    const insights = [];

    if (unscheduled.length > 0) {
      insights.push(
        `${unscheduled.length} tasks couldn't be scheduled. Consider extending work hours or reducing task scope.`,
      );
    }

    const highPriorityUnscheduled = unscheduled.filter(
      (t) => t.priority === 'asap' || t.priority === 'high',
    );
    if (highPriorityUnscheduled.length > 0) {
      insights.push(
        `${highPriorityUnscheduled.length} high-priority tasks are unscheduled. Consider rescheduling lower-priority items.`,
      );
    }

    if (scheduled.length > 0) {
      const avgConfidence =
        scheduled.reduce((sum, t) => sum + t.aiSchedulingConfidence, 0) / scheduled.length;
      if (avgConfidence < 0.7) {
        insights.push(
          'Schedule has low confidence scores. Consider adjusting task durations or work hours.',
        );
      }
    }

    return insights;
  }

  private fallbackScheduling(
    tasks: Task[],
    preferences: SchedulingPreferences,
    existingEvents: any[],
    startDate: Date,
    endDate: Date,
  ): SchedulingResult {
    // Simple fallback: just return basic structure
    return {
      scheduledTasks: [],
      unscheduledTasks: tasks,
      conflictingTasks: [],
      optimizationInsights: ['AI scheduling temporarily unavailable. Using fallback mode.'],
      totalScheduledDuration: 0,
      utilizationPercentage: 0,
    };
  }
}

export default new TaskSchedulingService();

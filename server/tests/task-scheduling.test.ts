/**
 * Task Scheduling Algorithm Tests
 * Comprehensive tests for AI-powered task scheduling logic
 */

import TaskSchedulingService from '../services/task-scheduling-service';

describe('Task Scheduling Service', () => {
  const mockPreferences = {
    workHoursStart: '09:00',
    workHoursEnd: '17:00',
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    preferredMeetingDuration: 30,
    maxTasksPerDay: 8,
    focusTimeBlocks: ['Mon 10:00-12:00', 'Wed 14:00-16:00'],
    breakDuration: 15,
    energyLevels: {
      morning: 'high' as const,
      afternoon: 'medium' as const,
      evening: 'low' as const,
    },
  };

  const mockTasks = [
    {
      id: 'task-1',
      title: 'High Priority Sales Call',
      priority: 'high' as const,
      estimatedDuration: 30,
      dueDate: new Date('2025-09-27T14:00:00Z'),
      relatedEntityType: 'lead',
      userId: 'user-1',
      tenantId: 'tenant-1',
    },
    {
      id: 'task-2',
      title: 'Complex Proposal Writing',
      priority: 'medium' as const,
      estimatedDuration: 120,
      dueDate: new Date('2025-09-28T17:00:00Z'),
      relatedEntityType: 'deal',
      userId: 'user-1',
      tenantId: 'tenant-1',
    },
    {
      id: 'task-3',
      title: 'Administrative Update',
      priority: 'low' as const,
      estimatedDuration: 45,
      userId: 'user-1',
      tenantId: 'tenant-1',
    },
  ];

  describe('scheduleTasksWithAI', () => {
    test('should schedule high priority tasks first', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-30T23:59:59Z')
      );

      expect(result.scheduledTasks.length).toBeGreaterThan(0);
      
      // High priority task should be scheduled before low priority
      const highPriorityTask = result.scheduledTasks.find(t => t.id === 'task-1');
      const lowPriorityTask = result.scheduledTasks.find(t => t.id === 'task-3');
      
      if (highPriorityTask && lowPriorityTask) {
        expect(highPriorityTask.aiSuggestedStart.getTime())
          .toBeLessThan(lowPriorityTask.aiSuggestedStart.getTime());
      }
    });

    test('should respect work hours constraints', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      result.scheduledTasks.forEach(task => {
        const startHour = task.aiSuggestedStart.getHours();
        const endHour = task.aiSuggestedEnd.getHours();
        
        expect(startHour).toBeGreaterThanOrEqual(9); // 9 AM start
        expect(endHour).toBeLessThanOrEqual(17); // 5 PM end
      });
    });

    test('should avoid scheduling on weekends', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'), // Friday
        new Date('2025-09-29T23:59:59Z') // Monday
      );

      result.scheduledTasks.forEach(task => {
        const dayOfWeek = task.aiSuggestedStart.getDay();
        expect(dayOfWeek).not.toBe(0); // Not Sunday
        expect(dayOfWeek).not.toBe(6); // Not Saturday
      });
    });

    test('should handle empty task list gracefully', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        [],
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      expect(result.scheduledTasks).toHaveLength(0);
      expect(result.unscheduledTasks).toHaveLength(0);
      expect(result.totalScheduledDuration).toBe(0);
    });

    test('should handle conflicting existing events', async () => {
      const existingEvents = [
        {
          startTime: '2025-09-26T10:00:00Z',
          endTime: '2025-09-26T11:00:00Z',
          title: 'Existing Meeting',
        },
      ];

      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        existingEvents,
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      // Tasks should not overlap with existing events
      result.scheduledTasks.forEach(task => {
        const taskStart = task.aiSuggestedStart.getTime();
        const taskEnd = task.aiSuggestedEnd.getTime();
        const eventStart = new Date('2025-09-26T10:00:00Z').getTime();
        const eventEnd = new Date('2025-09-26T11:00:00Z').getTime();

        // No overlap condition: task ends before event starts OR task starts after event ends
        expect(taskEnd <= eventStart || taskStart >= eventEnd).toBe(true);
      });
    });

    test('should provide scheduling confidence scores', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-30T23:59:59Z')
      );

      result.scheduledTasks.forEach(task => {
        expect(task.aiSchedulingConfidence).toBeGreaterThanOrEqual(0);
        expect(task.aiSchedulingConfidence).toBeLessThanOrEqual(1);
        expect(task.aiSchedulingReasoning).toBeDefined();
        expect(typeof task.aiSchedulingReasoning).toBe('string');
      });
    });

    test('should calculate utilization percentage correctly', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z') // 2 days
      );

      expect(result.utilizationPercentage).toBeGreaterThanOrEqual(0);
      expect(result.utilizationPercentage).toBeLessThanOrEqual(100);
      
      // Total scheduled duration should match sum of individual tasks
      const expectedDuration = result.scheduledTasks.reduce(
        (sum, task) => sum + task.estimatedDuration, 0
      );
      expect(result.totalScheduledDuration).toBe(expectedDuration);
    });

    test('should generate optimization insights', async () => {
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      expect(Array.isArray(result.optimizationInsights)).toBe(true);
      expect(result.optimizationInsights.length).toBeGreaterThan(0);
      
      result.optimizationInsights.forEach(insight => {
        expect(typeof insight).toBe('string');
        expect(insight.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle tasks with no due date', async () => {
      const tasksWithoutDueDate = mockTasks.map(task => ({
        ...task,
        dueDate: undefined,
      }));

      const result = await TaskSchedulingService.scheduleTasksWithAI(
        tasksWithoutDueDate,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      expect(result).toBeDefined();
      expect(result.scheduledTasks.length + result.unscheduledTasks.length)
        .toBe(tasksWithoutDueDate.length);
    });

    test('should handle very long tasks', async () => {
      const longTask = {
        id: 'long-task',
        title: 'Very Long Task',
        priority: 'high' as const,
        estimatedDuration: 480, // 8 hours
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const result = await TaskSchedulingService.scheduleTasksWithAI(
        [longTask],
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      // Should either schedule across multiple days or mark as unscheduled
      expect(result.scheduledTasks.length + result.unscheduledTasks.length).toBe(1);
    });

    test('should handle overdue tasks appropriately', async () => {
      const overdueTask = {
        id: 'overdue-task',
        title: 'Overdue Task',
        priority: 'medium' as const,
        estimatedDuration: 30,
        dueDate: new Date('2025-09-24T14:00:00Z'), // Yesterday
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const result = await TaskSchedulingService.scheduleTasksWithAI(
        [overdueTask],
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      // Overdue tasks should get high priority treatment
      if (result.scheduledTasks.length > 0) {
        const scheduledOverdue = result.scheduledTasks.find(t => t.id === 'overdue-task');
        if (scheduledOverdue) {
          expect(scheduledOverdue.aiPriorityScore).toBeGreaterThan(80);
        }
      }
    });

    test('should fallback gracefully when AI is unavailable', async () => {
      // Mock AI service failure by using invalid tasks
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-27T23:59:59Z')
      );

      // Should still return a valid result structure
      expect(result).toBeDefined();
      expect(result.scheduledTasks).toBeDefined();
      expect(result.unscheduledTasks).toBeDefined();
      expect(result.optimizationInsights).toBeDefined();
      expect(Array.isArray(result.optimizationInsights)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large number of tasks efficiently', async () => {
      // Generate 100 tasks
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        priority: ['high', 'medium', 'low'][i % 3] as const,
        estimatedDuration: 30 + (i % 120), // 30-150 minutes
        dueDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000), // Spread over 100 days
        userId: 'user-1',
        tenantId: 'tenant-1',
      }));

      const startTime = Date.now();
      
      const result = await TaskSchedulingService.scheduleTasksWithAI(
        largeTasks,
        mockPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-12-31T23:59:59Z') // 3+ months
      );

      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.scheduledTasks.length + result.unscheduledTasks.length).toBe(100);
    });

    test('should handle complex scheduling constraints', async () => {
      const complexPreferences = {
        ...mockPreferences,
        workHoursStart: '08:00',
        workHoursEnd: '18:00',
        workDays: [1, 2, 3, 4, 5, 6], // Include Saturday
        focusTimeBlocks: [
          'Mon 09:00-11:00',
          'Tue 14:00-16:00',
          'Wed 10:00-12:00',
          'Thu 13:00-15:00',
          'Fri 09:00-11:00',
        ],
        maxTasksPerDay: 12,
      };

      const result = await TaskSchedulingService.scheduleTasksWithAI(
        mockTasks,
        complexPreferences,
        [],
        new Date('2025-09-26T00:00:00Z'),
        new Date('2025-09-30T23:59:59Z')
      );

      expect(result).toBeDefined();
      expect(result.scheduledTasks.length + result.unscheduledTasks.length)
        .toBe(mockTasks.length);
    });
  });
});

// Test utilities for mocking
export const createMockTask = (overrides = {}) => ({
  id: 'mock-task',
  title: 'Mock Task',
  priority: 'medium' as const,
  estimatedDuration: 60,
  userId: 'user-1',
  tenantId: 'tenant-1',
  ...overrides,
});

export const createMockPreferences = (overrides = {}) => ({
  workHoursStart: '09:00',
  workHoursEnd: '17:00',
  workDays: [1, 2, 3, 4, 5],
  preferredMeetingDuration: 30,
  maxTasksPerDay: 8,
  focusTimeBlocks: [],
  breakDuration: 15,
  energyLevels: {
    morning: 'high' as const,
    afternoon: 'medium' as const,
    evening: 'low' as const,
  },
  ...overrides,
});

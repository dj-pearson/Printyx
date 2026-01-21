/**
 * API Endpoints Tests
 * Integration tests for Motion AI API endpoints
 */

import request from 'supertest';
import express from 'express';

// Mock app setup for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Import routes
  const aiRoutes = require('../routes/ai-routes-simple').default;
  const calendarRoutes = require('../routes/calendar-routes').default;
  const taskRoutes = require('../routes/task-routes').default;

  app.use('/api/ai', aiRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/tasks', taskRoutes);

  return app;
};

describe('Motion AI API Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('AI Routes', () => {
    describe('GET /api/ai/health', () => {
      test('should return health status', async () => {
        const response = await request(app).get('/api/ai/health').expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('ai');
      });
    });

    describe('POST /api/ai/leads/analyze', () => {
      test('should analyze lead data', async () => {
        const leadData = {
          companyName: 'Test Corp',
          industry: 'Manufacturing',
          employeeCount: 100,
        };

        const response = await request(app)
          .post('/api/ai/leads/analyze')
          .send({ leadData })
          .expect(200);

        expect(response.body).toHaveProperty('score');
        expect(response.body).toHaveProperty('conversionProbability');
        expect(response.body).toHaveProperty('insights');
        expect(response.body).toHaveProperty('recommendedActions');

        expect(typeof response.body.score).toBe('number');
        expect(response.body.score).toBeGreaterThanOrEqual(0);
        expect(response.body.score).toBeLessThanOrEqual(100);
      });

      test('should handle missing lead data', async () => {
        const response = await request(app).post('/api/ai/leads/analyze').send({}).expect(200);

        // Should still return analysis with default/mock data
        expect(response.body).toHaveProperty('score');
      });
    });
  });

  describe('Calendar Routes', () => {
    describe('GET /api/calendar/connections', () => {
      test('should return calendar connections', async () => {
        const response = await request(app).get('/api/calendar/connections').expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/calendar/connections', () => {
      test('should create calendar connection', async () => {
        const connectionData = {
          provider: 'google',
          accessToken: 'test-token',
          calendarId: 'primary',
        };

        const response = await request(app)
          .post('/api/calendar/connections')
          .send(connectionData)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('provider', 'google');
        expect(response.body).toHaveProperty('isConnected', true);
      });

      test('should validate required fields', async () => {
        const response = await request(app).post('/api/calendar/connections').send({}).expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/calendar/events', () => {
      test('should return calendar events', async () => {
        const response = await request(app)
          .get('/api/calendar/events')
          .query({
            start: '2025-09-26T00:00:00Z',
            end: '2025-09-27T23:59:59Z',
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        if (response.body.length > 0) {
          const event = response.body[0];
          expect(event).toHaveProperty('id');
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('startTime');
          expect(event).toHaveProperty('endTime');
        }
      });

      test('should validate date parameters', async () => {
        const response = await request(app).get('/api/calendar/events').expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/calendar/events', () => {
      test('should create calendar event', async () => {
        const eventData = {
          title: 'Test Meeting',
          startTime: '2025-09-26T10:00:00Z',
          endTime: '2025-09-26T11:00:00Z',
          description: 'Test meeting description',
        };

        const response = await request(app)
          .post('/api/calendar/events')
          .send(eventData)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', 'Test Meeting');
        expect(response.body).toHaveProperty('startTime');
        expect(response.body).toHaveProperty('endTime');
      });

      test('should validate required event fields', async () => {
        const response = await request(app).post('/api/calendar/events').send({}).expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/calendar/availability/:userId', () => {
      test('should return user availability', async () => {
        const response = await request(app)
          .get('/api/calendar/availability/test-user')
          .query({
            start: '2025-09-26T00:00:00Z',
            end: '2025-09-26T23:59:59Z',
          })
          .expect(200);

        expect(response.body).toHaveProperty('busy');
        expect(Array.isArray(response.body.busy)).toBe(true);
      });

      test('should validate time parameters', async () => {
        const response = await request(app).get('/api/calendar/availability/test-user').expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Task Routes', () => {
    describe('GET /api/tasks', () => {
      test('should return tasks list', async () => {
        const response = await request(app).get('/api/tasks').expect(200);

        expect(response.body).toHaveProperty('tasks');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('limit');
        expect(response.body).toHaveProperty('offset');
        expect(Array.isArray(response.body.tasks)).toBe(true);
      });

      test('should support filtering by status', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .query({ status: 'pending' })
          .expect(200);

        expect(response.body).toHaveProperty('tasks');
        expect(Array.isArray(response.body.tasks)).toBe(true);
      });

      test('should support filtering by priority', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .query({ priority: 'high' })
          .expect(200);

        expect(response.body).toHaveProperty('tasks');
      });

      test('should support pagination', async () => {
        const response = await request(app)
          .get('/api/tasks')
          .query({ limit: 10, offset: 0 })
          .expect(200);

        expect(response.body).toHaveProperty('limit', 10);
        expect(response.body).toHaveProperty('offset', 0);
      });
    });

    describe('POST /api/tasks', () => {
      test('should create new task', async () => {
        const taskData = {
          title: 'Test Task',
          description: 'Test task description',
          priority: 'medium',
          estimatedDuration: 60,
        };

        const response = await request(app).post('/api/tasks').send(taskData).expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', 'Test Task');
        expect(response.body).toHaveProperty('priority', 'medium');
        expect(response.body).toHaveProperty('status', 'pending');
        expect(response.body).toHaveProperty('aiPriorityScore');
        expect(response.body).toHaveProperty('aiComplexityScore');
      });

      test('should validate required fields', async () => {
        const response = await request(app).post('/api/tasks').send({}).expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should set default values', async () => {
        const taskData = {
          title: 'Minimal Task',
        };

        const response = await request(app).post('/api/tasks').send(taskData).expect(200);

        expect(response.body).toHaveProperty('status', 'pending');
        expect(response.body).toHaveProperty('priority', 'medium');
        expect(response.body).toHaveProperty('estimatedDuration', 30);
      });
    });

    describe('POST /api/tasks/schedule', () => {
      test('should schedule tasks with AI', async () => {
        const scheduleData = {
          taskIds: ['task-1', 'task-2'],
          startDate: '2025-09-26T00:00:00Z',
          endDate: '2025-09-30T23:59:59Z',
          preferences: {
            workHoursStart: '09:00',
            workHoursEnd: '17:00',
          },
        };

        const response = await request(app)
          .post('/api/tasks/schedule')
          .send(scheduleData)
          .expect(200);

        expect(response.body).toHaveProperty('scheduledTasks');
        expect(response.body).toHaveProperty('unscheduledTasks');
        expect(response.body).toHaveProperty('optimizationInsights');
        expect(response.body).toHaveProperty('totalScheduledDuration');
        expect(response.body).toHaveProperty('utilizationPercentage');

        expect(Array.isArray(response.body.scheduledTasks)).toBe(true);
        expect(Array.isArray(response.body.unscheduledTasks)).toBe(true);
        expect(Array.isArray(response.body.optimizationInsights)).toBe(true);
      });

      test('should validate required scheduling parameters', async () => {
        const response = await request(app).post('/api/tasks/schedule').send({}).expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should handle empty task list', async () => {
        const scheduleData = {
          taskIds: [],
          startDate: '2025-09-26T00:00:00Z',
          endDate: '2025-09-30T23:59:59Z',
        };

        const response = await request(app)
          .post('/api/tasks/schedule')
          .send(scheduleData)
          .expect(200);

        expect(response.body.scheduledTasks).toHaveLength(0);
        expect(response.body.unscheduledTasks).toHaveLength(0);
      });
    });

    describe('GET /api/tasks/categories', () => {
      test('should return task categories', async () => {
        const response = await request(app).get('/api/tasks/categories').expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        if (response.body.length > 0) {
          const category = response.body[0];
          expect(category).toHaveProperty('id');
          expect(category).toHaveProperty('name');
          expect(category).toHaveProperty('color');
          expect(category).toHaveProperty('icon');
        }
      });
    });

    describe('GET /api/tasks/suggestions', () => {
      test('should return AI task suggestions', async () => {
        const response = await request(app).get('/api/tasks/suggestions').expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        if (response.body.length > 0) {
          const suggestion = response.body[0];
          expect(suggestion).toHaveProperty('id');
          expect(suggestion).toHaveProperty('suggestedTask');
          expect(suggestion).toHaveProperty('suggestionReason');
          expect(suggestion).toHaveProperty('confidenceScore');
          expect(suggestion).toHaveProperty('status');
        }
      });
    });

    describe('POST /api/tasks/suggestions/:suggestionId/accept', () => {
      test('should accept task suggestion', async () => {
        const response = await request(app)
          .post('/api/tasks/suggestions/suggestion-1/accept')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('createdTask');
        expect(response.body).toHaveProperty('suggestionId');
        expect(response.body).toHaveProperty('status', 'accepted');
      });
    });

    describe('POST /api/tasks/:taskId/time-entry', () => {
      test('should start time tracking', async () => {
        const response = await request(app)
          .post('/api/tasks/task-1/time-entry')
          .send({ action: 'start' })
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('taskId', 'task-1');
        expect(response.body).toHaveProperty('action', 'start');
        expect(response.body).toHaveProperty('timestamp');
      });

      test('should stop time tracking', async () => {
        const response = await request(app)
          .post('/api/tasks/task-1/time-entry')
          .send({ action: 'stop' })
          .expect(200);

        expect(response.body).toHaveProperty('action', 'stop');
      });

      test('should validate action parameter', async () => {
        const response = await request(app)
          .post('/api/tasks/task-1/time-entry')
          .send({ action: 'invalid' })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app).get('/api/non-existent').expect(404);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app).post('/api/tasks').send('invalid json').expect(400);
    });

    test('should handle large request payloads gracefully', async () => {
      const largeData = {
        title: 'A'.repeat(10000), // Very long title
        description: 'B'.repeat(50000), // Very long description
      };

      const response = await request(app).post('/api/tasks').send(largeData);

      // Should either accept or reject gracefully, not crash
      expect([200, 400, 413]).toContain(response.status);
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () => request(app).get('/api/tasks'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app).get('/api/tasks').expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});

// Test data generators
export const generateMockTask = (overrides = {}) => ({
  title: 'Mock Task',
  description: 'Mock task description',
  priority: 'medium',
  estimatedDuration: 60,
  ...overrides,
});

export const generateMockEvent = (overrides = {}) => ({
  title: 'Mock Event',
  startTime: '2025-09-26T10:00:00Z',
  endTime: '2025-09-26T11:00:00Z',
  ...overrides,
});

export const generateMockCalendarConnection = (overrides = {}) => ({
  provider: 'google',
  accessToken: 'mock-token',
  calendarId: 'primary',
  ...overrides,
});

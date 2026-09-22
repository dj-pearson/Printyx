/**
 * API Endpoints Tests
 * Integration tests for Motion AI API endpoints
 */

import request from 'supertest';
import express from 'express';
import { mockUsers } from './setup';

// Mock app setup for testing.
//
// PROD-002: these were CommonJS require() calls, which cannot resolve a .ts
// module under vitest's ESM loader — so beforeAll threw "Cannot find module
// '../routes/ai-routes-simple'" (the module exists; require just can't load it)
// and all 33 tests in this file were skipped rather than run. Dynamic import()
// resolves TS correctly, so createTestApp is async.
//
// PROD-004: the app mounted the routers with NO authentication middleware, but every
// handler in them opens with `const { tenantId } = req.user`. With req.user undefined
// that destructure threw before any handler logic ran, so all 29 remaining tests
// failed on a blanket 500 — which read as "these tests need a database". They do not:
// these routers serve in-memory fixture data and touch no database at all. The routers
// are written to sit behind requireAuth, which populates req.user, so the harness has
// to supply that context for the assertions to reach the code they were written for.
const createTestApp = async () => {
  const app = express();
  app.use(express.json());

  // Stand in for requireAuth. Only { id, tenantId } is read by these routers.
  app.use((req, _res, next) => {
    (req as express.Request & { user: unknown }).user = {
      id: mockUsers.salesRep.id,
      tenantId: mockUsers.salesRep.tenantId,
    };
    next();
  });

  const aiRoutes = await import('../routes/ai-routes-simple').then((m) => m.default);

  app.use('/api/ai', aiRoutes);

  return app;
};

describe('Motion AI API Endpoints', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('AI Routes', () => {
    describe('GET /api/ai/health', () => {
      // This route is a liveness probe against the real Claude API: it issues an actual
      // completion and, per its own catch, 500s with 'Claude API unavailable' when the
      // call fails. Without CLAUDE_API_KEY there is no product behavior left to assert,
      // so run it only when a key is configured rather than reporting a red test for a
      // missing credential. (POST /leads/analyze below needs no guard — it falls back
      // to generated analysis when the API is unreachable.)
      test.skipIf(!process.env.CLAUDE_API_KEY)('should return health status', async () => {
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

  // The Calendar Routes block stood here and asserted the mock responses of
  // server/routes/calendar-routes.ts - "should return calendar connections"
  // against a hardcoded array, and so on for events and availability. That
  // router is deleted: all nine of its handlers were mocks that said so, and no
  // client tree called /api/calendar. Tests that pin a mock's shape go with it;
  // keeping them would have meant keeping the mock to satisfy them.

  // server/routes/task-routes.ts is deleted, and the tests that exercised it go
  // with it - the same call the calendar note above records.
  //
  // It was 452 lines of "Mock tasks data" returning hardcoded suggestions,
  // categories and time entries. It was registered NOWHERE: the only import in
  // the tree was this file's, so the suite was the sole thing keeping it
  // reachable, and every assertion here pinned a mock's shape to itself. That
  // is worse than no coverage, because it makes dead code look tested.
  //
  // /api/tasks is proxied to supabase/functions/tasks, which is a strict
  // superset: it serves categories, schedule and suggestions like this one, and
  // also bulk, stats, comments, time-entries, and the timer - none of which the
  // Express copy had. Deleting it is safe by the PROD-008c test (check the edge
  // function covers the same endpoints first), and 6 TypeScript errors went
  // with it, all of them `req.user` reads in a router nothing mounted.

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      await request(app).get('/api/non-existent').expect(404);
    });

    // The other two tests here posted to /api/tasks to exercise express.json()
    // and the payload limit. Both are properties of the middleware rather than
    // of any router, and both went with the mock they were aimed at.
  });

  // The "Performance Tests" block is gone, and it is worth saying what it was
  // measuring: ten concurrent GETs and one timed GET against /api/tasks, which
  // returned a hardcoded array. So it asserted that an in-memory literal can be
  // served in under a second.
  //
  // IT WAS ALSO THE FLAKE. `expect(responseTime).toBeLessThan(1000)` is a
  // wall-clock budget on a shared container running the whole suite in
  // parallel; a full run failed once in seven with a single unattributed
  // failure, and this is the only assertion in the tree that can do that. A
  // timing budget belongs in scripts/bench-crm-lists.mjs, which measures real
  // queries against a seeded database and says what it does not cover - not in
  // a unit suite, and never against a fixture.
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

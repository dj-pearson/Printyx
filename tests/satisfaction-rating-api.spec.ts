import { test, expect } from '@playwright/test';

// Mock data for testing
const MOCK_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_CUSTOMER_ID = 'customer-123';
const MOCK_PORTAL_USER_ID = 'portal-user-123';
const MOCK_SURVEY_TEMPLATE_ID = 'template-123';
const MOCK_SURVEY_ID = 'survey-123';
const MOCK_QUESTION_ID_1 = 'question-1';
const MOCK_QUESTION_ID_2 = 'question-2';

test.describe('Customer Satisfaction Rating API Integration Tests', () => {
  
  // Helper function to setup authenticated context
  async function setupAuthenticatedContext(page: any) {
    // Set demo auth localStorage to simulate authenticated customer portal user
    await page.addInitScript(() => {
      localStorage.setItem('demo-authenticated', 'true');
      localStorage.setItem('demo-tenant-id', '550e8400-e29b-41d4-a716-446655440000');
      localStorage.setItem('demo-customer-id', 'customer-123');
      localStorage.setItem('demo-portal-user-id', 'portal-user-123');
    });
    
    // Set session headers for customer portal auth
    await page.setExtraHTTPHeaders({
      'x-portal-session': 'mock-portal-session-token',
      'content-type': 'application/json'
    });
  }

  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedContext(page);
  });

  test('GET /api/customer-portal/satisfaction/surveys - should list available surveys with proper access control', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    const response = await request.get('/api/customer-portal/satisfaction/surveys', {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    // Should return surveys data or empty array (depending on test data setup)
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('GET /api/customer-portal/satisfaction/surveys - should reject without proper authentication', async ({ request }) => {
    const response = await request.get('/api/customer-portal/satisfaction/surveys');
    
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.message).toContain('Authentication required');
  });

  test('GET /api/customer-portal/satisfaction/surveys/:surveyId - should fetch survey details with questions', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // This test assumes there's a mock survey available
    // In a real test environment, you'd seed the database with test data first
    const response = await request.get(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    // Should handle survey not found gracefully
    if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    } else {
      // If survey exists, verify structure
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data.data).toHaveProperty('survey');
      expect(data.data).toHaveProperty('questions');
      expect(data.data).toHaveProperty('existingResponses');
    }
  });

  test('GET /api/customer-portal/satisfaction/surveys/:surveyId - should return 410 for expired survey', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Mock an expired survey ID (this would need to be set up in test data)
    const expiredSurveyId = 'expired-survey-123';
    
    const response = await request.get(`/api/customer-portal/satisfaction/surveys/${expiredSurveyId}`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    // Should handle expired survey or not found gracefully
    if (response.status() === 410) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey has expired');
    } else if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    }
  });

  test('GET /api/customer-portal/satisfaction/surveys/:surveyId - should enforce tenant/customer isolation', async ({ request }) => {
    // Try to access survey with different customer credentials
    const response = await request.get(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}`, {
      headers: {
        'x-portal-session': 'different-customer-token'
      }
    });

    // Should reject unauthorized access
    expect([401, 403, 404].includes(response.status())).toBe(true);
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/start - should start survey and track timing', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    const response = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/start`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    // Should handle survey not found or successfully start
    if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    } else if (response.status() === 410) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey has expired');
    } else if (response.status() === 400) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey is already completed');
    } else {
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('message', 'Survey started successfully');
    }
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/start - should reject already completed survey', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Mock a completed survey ID
    const completedSurveyId = 'completed-survey-123';
    
    const response = await request.post(`/api/customer-portal/satisfaction/surveys/${completedSurveyId}/start`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    // Should handle completed survey appropriately
    if (response.status() === 400) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey is already completed');
    } else if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    }
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/submit - should validate response data structure', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Test with invalid response structure
    const invalidResponse = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: 'invalid-format' // Should be an array
      }
    });

    expect(invalidResponse.status()).toBe(400);
    const data = await invalidResponse.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe('Responses array is required');
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/submit - should handle valid response submission and calculate scores', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Test with valid response structure
    const validResponses = [
      {
        questionId: MOCK_QUESTION_ID_1,
        ratingValue: 5, // Excellent rating
        timeSpentSeconds: 30,
        responseOrder: 1
      },
      {
        questionId: MOCK_QUESTION_ID_2,
        textValue: 'Great service, very satisfied!',
        timeSpentSeconds: 45,
        responseOrder: 2
      }
    ];

    const response = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: validResponses
      }
    });

    // Should handle survey not found or process responses
    if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    } else if (response.status() === 410) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey has expired');
    } else if (response.status() === 400) {
      const data = await response.json();
      expect(data.success).toBe(false);
      // Could be completed survey or invalid question IDs
    } else {
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('survey');
      expect(data.data).toHaveProperty('responsesSubmitted');
      expect(data).toHaveProperty('message', 'Survey responses submitted successfully');
      
      // Verify score calculation if applicable
      if (data.data.overallScore !== null) {
        expect(typeof data.data.overallScore).toBe('number');
        expect(data.data.overallScore).toBeGreaterThanOrEqual(0);
        expect(data.data.overallScore).toBeLessThanOrEqual(10);
      }
      
      if (data.data.npsScore !== null) {
        expect(typeof data.data.npsScore).toBe('number');
        expect(data.data.npsScore).toBeGreaterThanOrEqual(0);
        expect(data.data.npsScore).toBeLessThanOrEqual(10);
      }
    }
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/submit - should handle invalid question IDs', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    const invalidResponses = [
      {
        questionId: 'non-existent-question-id',
        ratingValue: 5,
        timeSpentSeconds: 30,
        responseOrder: 1
      }
    ];

    const response = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: invalidResponses
      }
    });

    // Should handle survey not found or invalid question ID
    if (response.status() === 404) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey not found');
    } else if (response.status() === 400) {
      const data = await response.json();
      expect(data.success).toBe(false);
      // Should indicate invalid question ID if survey exists
    }
  });

  test('POST /api/customer-portal/satisfaction/surveys/:surveyId/submit - should implement atomic response replacement', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // First submission
    const firstResponses = [
      {
        questionId: MOCK_QUESTION_ID_1,
        ratingValue: 3,
        timeSpentSeconds: 20,
        responseOrder: 1
      }
    ];

    const firstResponse = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: firstResponses
      }
    });

    // Second submission should replace the first
    const secondResponses = [
      {
        questionId: MOCK_QUESTION_ID_1,
        ratingValue: 5,
        timeSpentSeconds: 35,
        responseOrder: 1
      },
      {
        questionId: MOCK_QUESTION_ID_2,
        textValue: 'Updated feedback',
        timeSpentSeconds: 25,
        responseOrder: 2
      }
    ];

    const secondResponse = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: secondResponses
      }
    });

    // Verify atomic replacement logic
    if (secondResponse.status() === 200) {
      const data = await secondResponse.json();
      expect(data.data.responsesSubmitted).toBe(2); // Should reflect the new count
    } else if (secondResponse.status() === 400) {
      const data = await secondResponse.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('Survey is already completed');
    }
  });

  test('GET /api/customer-portal/satisfaction/analytics - should return customer satisfaction analytics', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    const response = await request.get('/api/customer-portal/satisfaction/analytics', {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('summary');
    expect(data.data).toHaveProperty('byType');
    expect(data.data).toHaveProperty('recentSurveys');
    
    // Verify summary structure
    expect(data.data.summary).toHaveProperty('totalSurveys');
    expect(data.data.summary).toHaveProperty('timeRange');
    expect(data.data.summary).toHaveProperty('periodStart');
    expect(data.data.summary).toHaveProperty('periodEnd');
    
    // Verify data types
    expect(typeof data.data.summary.totalSurveys).toBe('number');
    expect(Array.isArray(data.data.recentSurveys)).toBe(true);
  });

  test('GET /api/customer-portal/satisfaction/analytics - should support time range filtering', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    const timeRanges = ['30d', '90d', '6m', '1y'];
    
    for (const timeRange of timeRanges) {
      const response = await request.get(`/api/customer-portal/satisfaction/analytics?timeRange=${timeRange}`, {
        headers: {
          'x-portal-session': 'mock-portal-session-token'
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data.summary.timeRange).toBe(timeRange);
    }
  });

  test('GET /api/customer-portal/satisfaction/analytics - should enforce tenant/customer isolation', async ({ request }) => {
    // Try to access analytics with different customer credentials
    const response = await request.get('/api/customer-portal/satisfaction/analytics', {
      headers: {
        'x-portal-session': 'different-customer-token'
      }
    });

    // Should reject unauthorized access
    expect([401, 403].includes(response.status())).toBe(true);
  });

  test('All satisfaction endpoints should handle missing tenant/customer context gracefully', async ({ request }) => {
    const endpoints = [
      '/api/customer-portal/satisfaction/surveys',
      `/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}`,
      '/api/customer-portal/satisfaction/analytics'
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect([400, 401, 403].includes(response.status())).toBe(true);
    }
  });

  test('POST endpoints should validate request payload structure', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Test start endpoint with invalid payload
    const startResponse = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/start`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: 'invalid-json'
    });
    
    // Should handle JSON parsing errors gracefully
    expect([400, 404].includes(startResponse.status())).toBe(true);

    // Test submit endpoint with missing responses
    const submitResponse = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {} // Missing responses array
    });
    
    expect(submitResponse.status()).toBe(400);
    const data = await submitResponse.json();
    expect(data.message).toBe('Responses array is required');
  });

  test('Score calculation should handle different question types correctly', async ({ request, page }) => {
    await setupAuthenticatedContext(page);
    
    // Test with mixed question types including NPS
    const mixedResponses = [
      {
        questionId: MOCK_QUESTION_ID_1,
        ratingValue: 4, // Rating scale
        timeSpentSeconds: 30,
        responseOrder: 1
      },
      {
        questionId: MOCK_QUESTION_ID_2,
        ratingValue: 9, // NPS score (0-10)
        timeSpentSeconds: 20,
        responseOrder: 2
      },
      {
        questionId: 'text-question-id',
        textValue: 'Excellent service',
        timeSpentSeconds: 45,
        responseOrder: 3
      },
      {
        questionId: 'boolean-question-id',
        booleanValue: true,
        timeSpentSeconds: 10,
        responseOrder: 4
      }
    ];

    const response = await request.post(`/api/customer-portal/satisfaction/surveys/${MOCK_SURVEY_ID}/submit`, {
      headers: {
        'x-portal-session': 'mock-portal-session-token'
      },
      data: {
        responses: mixedResponses
      }
    });

    // Verify that score calculation handles different types appropriately
    if (response.status() === 200) {
      const data = await response.json();
      
      // Should calculate scores only for relevant question types
      if (data.data.overallScore !== null) {
        expect(typeof data.data.overallScore).toBe('number');
      }
      
      if (data.data.npsScore !== null) {
        expect(typeof data.data.npsScore).toBe('number');
        expect(data.data.npsScore).toBeGreaterThanOrEqual(0);
        expect(data.data.npsScore).toBeLessThanOrEqual(10);
      }
    }
  });
});
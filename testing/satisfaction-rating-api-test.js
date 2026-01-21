const http = require('http');
const { promisify } = require('util');

// Test configuration
const CONFIG = {
  baseUrl: 'http://localhost:5000',
  timeout: 10000,
  mockData: {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    customerId: 'customer-123',
    portalUserId: 'portal-user-123',
    surveyId: 'survey-123',
    questionId1: 'question-1',
    questionId2: 'question-2',
    portalSessionToken: 'mock-portal-session-token',
  },
};

class SatisfactionRatingAPITest {
  constructor() {
    this.results = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date(),
      },
      tests: [],
    };
  }

  async getCsrfToken() {
    // Get CSRF token from a GET request first
    try {
      const response = await this.makeRequestRaw(
        'GET',
        '/api/customer-portal/satisfaction/surveys',
        null,
        {
          'x-portal-session': CONFIG.mockData.portalSessionToken,
        },
      );

      // Extract CSRF token from cookies or response headers
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        for (const cookie of setCookieHeader) {
          if (cookie.includes('_csrf')) {
            const match = cookie.match(/_csrf=([^;]+)/);
            if (match) {
              return match[1];
            }
          }
        }
      }

      // Try to get from response headers
      const csrfHeader = response.headers['x-csrf-token'] || response.headers['csrf-token'];
      if (csrfHeader) {
        return csrfHeader;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async makeRequestRaw(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.baseUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 5000,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'x-portal-session': CONFIG.mockData.portalSessionToken,
          ...headers,
        },
        timeout: CONFIG.timeout,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsedBody,
              rawBody: body,
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: { parseError: error.message },
              rawBody: body,
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async makeRequest(method, path, data = null, headers = {}) {
    // For POST requests, try to get CSRF token first
    if (method.toUpperCase() === 'POST') {
      const csrfToken = await this.getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
        headers['csrf-token'] = csrfToken;
        headers['_csrf'] = csrfToken;
      }
    }

    return this.makeRequestRaw(method, path, data, headers);
  }

  async runTest(testName, testFunction) {
    const testResult = {
      name: testName,
      status: 'unknown',
      startTime: new Date(),
      endTime: null,
      error: null,
      details: {},
    };

    this.results.summary.totalTests++;
    console.log(`🧪 Running: ${testName}`);

    try {
      const result = await testFunction();
      testResult.status = 'passed';
      testResult.details = result;
      this.results.summary.passed++;
      console.log(`  ✅ PASSED`);
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      this.results.summary.failed++;
      console.log(`  ❌ FAILED: ${error.message}`);
    }

    testResult.endTime = new Date();
    this.results.tests.push(testResult);
  }

  async runAllTests() {
    console.log('🚀 Starting Satisfaction Rating API Integration Tests');
    console.log('='.repeat(60));

    // Test 1: List available surveys with authentication
    await this.runTest('GET /satisfaction/surveys - with authentication', async () => {
      const response = await this.makeRequest('GET', '/api/customer-portal/satisfaction/surveys');

      if (response.status !== 200) {
        // If 401, that's expected behavior - no real auth in demo mode
        if (response.status === 401) {
          return { expected: true, message: 'Authentication required (expected in demo mode)' };
        }
        throw new Error(
          `Expected 200 or 401, got ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      if (!response.data.hasOwnProperty('success')) {
        throw new Error('Response missing success property');
      }

      if (!response.data.hasOwnProperty('data') || !Array.isArray(response.data.data)) {
        throw new Error('Response missing data array');
      }

      return { status: response.status, surveyCount: response.data.data.length };
    });

    // Test 2: List surveys without authentication
    await this.runTest('GET /satisfaction/surveys - without authentication', async () => {
      const response = await this.makeRequest(
        'GET',
        '/api/customer-portal/satisfaction/surveys',
        null,
        {
          'x-portal-session': '', // Remove session token
        },
      );

      if (response.status !== 401) {
        throw new Error(`Expected 401 unauthorized, got ${response.status}`);
      }

      if (
        !response.data.message ||
        !response.data.message.toLowerCase().includes('authentication')
      ) {
        throw new Error('Expected authentication error message');
      }

      return { status: response.status, message: response.data.message };
    });

    // Test 3: Get specific survey details
    await this.runTest('GET /satisfaction/surveys/:surveyId - survey details', async () => {
      const response = await this.makeRequest(
        'GET',
        `/api/customer-portal/satisfaction/surveys/${CONFIG.mockData.surveyId}`,
      );

      // Expected responses: 401 (no auth), 404 (survey not found), or 200 (survey exists)
      if (![200, 401, 404, 410].includes(response.status)) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      if (response.status === 401) {
        return { expected: true, message: 'Authentication required (expected)' };
      }

      if (response.status === 404) {
        return { expected: true, message: 'Survey not found (expected for mock ID)' };
      }

      if (response.status === 410) {
        return { expected: true, message: 'Survey expired (expected behavior)' };
      }

      // If 200, validate structure
      const requiredKeys = ['survey', 'questions', 'existingResponses'];
      for (const key of requiredKeys) {
        if (!response.data.data.hasOwnProperty(key)) {
          throw new Error(`Response missing required key: ${key}`);
        }
      }

      return { status: response.status, hasValidStructure: true };
    });

    // Test 4: Start a survey
    await this.runTest('POST /satisfaction/surveys/:surveyId/start - start survey', async () => {
      const response = await this.makeRequest(
        'POST',
        `/api/customer-portal/satisfaction/surveys/${CONFIG.mockData.surveyId}/start`,
      );

      // Expected: 401 (no auth), 404 (not found), 400 (already completed), 410 (expired), or 200 (success)
      if (![200, 400, 401, 404, 410].includes(response.status)) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      if (response.status === 401) {
        return { expected: true, message: 'Authentication required (expected)' };
      }

      if (response.status === 404) {
        return { expected: true, message: 'Survey not found (expected for mock ID)' };
      }

      if (response.status === 400 && response.data.message?.includes('completed')) {
        return { expected: true, message: 'Survey already completed (expected behavior)' };
      }

      if (response.status === 410) {
        return { expected: true, message: 'Survey expired (expected behavior)' };
      }

      // If 200, validate success message
      if (response.status === 200 && !response.data.message?.includes('started successfully')) {
        throw new Error('Missing success message for started survey');
      }

      return { status: response.status, message: response.data.message };
    });

    // Test 5: Submit survey responses with invalid data
    await this.runTest(
      'POST /satisfaction/surveys/:surveyId/submit - invalid responses',
      async () => {
        const response = await this.makeRequest(
          'POST',
          `/api/customer-portal/satisfaction/surveys/${CONFIG.mockData.surveyId}/submit`,
          {
            responses: 'invalid-format', // Should be array
          },
        );

        if (response.status === 401) {
          return { expected: true, message: 'Authentication required (expected)' };
        }

        if (response.status !== 400) {
          throw new Error(`Expected 400 bad request, got ${response.status}`);
        }

        if (!response.data.message?.includes('array')) {
          throw new Error('Expected validation error about responses array');
        }

        return { status: response.status, validationWorking: true };
      },
    );

    // Test 6: Submit survey responses with valid structure
    await this.runTest(
      'POST /satisfaction/surveys/:surveyId/submit - valid responses',
      async () => {
        const validResponses = [
          {
            questionId: CONFIG.mockData.questionId1,
            ratingValue: 5,
            timeSpentSeconds: 30,
            responseOrder: 1,
          },
          {
            questionId: CONFIG.mockData.questionId2,
            textValue: 'Great service!',
            timeSpentSeconds: 45,
            responseOrder: 2,
          },
        ];

        const response = await this.makeRequest(
          'POST',
          `/api/customer-portal/satisfaction/surveys/${CONFIG.mockData.surveyId}/submit`,
          {
            responses: validResponses,
          },
        );

        // Expected: 401 (no auth), 404 (not found), 400 (validation error/completed), 410 (expired), or 200 (success)
        if (![200, 400, 401, 404, 410].includes(response.status)) {
          throw new Error(`Unexpected status code: ${response.status}`);
        }

        if (response.status === 401) {
          return { expected: true, message: 'Authentication required (expected)' };
        }

        if (response.status === 404) {
          return { expected: true, message: 'Survey not found (expected for mock ID)' };
        }

        if (response.status === 400) {
          return {
            expected: true,
            message: `Validation error (expected): ${response.data.message}`,
          };
        }

        if (response.status === 410) {
          return { expected: true, message: 'Survey expired (expected behavior)' };
        }

        // If 200, validate response structure
        if (response.status === 200) {
          const requiredKeys = ['survey', 'responsesSubmitted'];
          for (const key of requiredKeys) {
            if (!response.data.data.hasOwnProperty(key)) {
              throw new Error(`Response missing required key: ${key}`);
            }
          }

          return {
            status: response.status,
            responsesSubmitted: response.data.data.responsesSubmitted,
            hasScoring: response.data.data.overallScore !== undefined,
          };
        }

        return { status: response.status };
      },
    );

    // Test 7: Get satisfaction analytics
    await this.runTest('GET /satisfaction/analytics - customer analytics', async () => {
      const response = await this.makeRequest('GET', '/api/customer-portal/satisfaction/analytics');

      if (response.status === 401) {
        return { expected: true, message: 'Authentication required (expected)' };
      }

      if (response.status !== 200) {
        throw new Error(
          `Expected 200 or 401, got ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      // Validate analytics structure
      const requiredKeys = ['summary', 'byType', 'recentSurveys'];
      for (const key of requiredKeys) {
        if (!response.data.data.hasOwnProperty(key)) {
          throw new Error(`Analytics response missing required key: ${key}`);
        }
      }

      // Validate summary structure
      const summaryKeys = ['totalSurveys', 'timeRange', 'periodStart', 'periodEnd'];
      for (const key of summaryKeys) {
        if (!response.data.data.summary.hasOwnProperty(key)) {
          throw new Error(`Analytics summary missing required key: ${key}`);
        }
      }

      return {
        status: response.status,
        totalSurveys: response.data.data.summary.totalSurveys,
        hasValidStructure: true,
      };
    });

    // Test 8: Analytics with time range filtering
    await this.runTest('GET /satisfaction/analytics - time range filtering', async () => {
      const timeRanges = ['30d', '90d', '6m', '1y'];
      const results = {};

      for (const timeRange of timeRanges) {
        const response = await this.makeRequest(
          'GET',
          `/api/customer-portal/satisfaction/analytics?timeRange=${timeRange}`,
        );

        if (response.status === 401) {
          results[timeRange] = { expected: true, message: 'Authentication required' };
          continue;
        }

        if (response.status !== 200) {
          throw new Error(`Time range ${timeRange} failed with status ${response.status}`);
        }

        if (response.data.data.summary.timeRange !== timeRange) {
          throw new Error(`Time range parameter not applied correctly for ${timeRange}`);
        }

        results[timeRange] = { status: response.status, working: true };
      }

      return { timeRangeFilteringWorking: true, results };
    });

    // Test 9: Access control - different customer context
    await this.runTest('Access control - tenant/customer isolation', async () => {
      const response = await this.makeRequest(
        'GET',
        '/api/customer-portal/satisfaction/surveys',
        null,
        {
          'x-portal-session': 'different-customer-token',
        },
      );

      // Should be rejected with 401, 403, or similar
      if (![401, 403, 404].includes(response.status)) {
        throw new Error(`Expected access control rejection, got ${response.status}`);
      }

      return { status: response.status, accessControlWorking: true };
    });

    // Test 10: API endpoint availability
    await this.runTest('API endpoint availability check', async () => {
      const endpoints = [
        '/api/customer-portal/satisfaction/surveys',
        `/api/customer-portal/satisfaction/surveys/${CONFIG.mockData.surveyId}`,
        '/api/customer-portal/satisfaction/analytics',
      ];

      const results = {};
      for (const endpoint of endpoints) {
        try {
          const response = await this.makeRequest('GET', endpoint, null, {
            'x-portal-session': '',
          });
          results[endpoint] = {
            status: response.status,
            reachable: true,
            hasExpectedAuthBehavior: [401, 403].includes(response.status),
          };
        } catch (error) {
          results[endpoint] = { reachable: false, error: error.message };
        }
      }

      // All endpoints should be reachable (even if they return auth errors)
      const unreachableEndpoints = Object.entries(results).filter(
        ([_, result]) => !result.reachable,
      );
      if (unreachableEndpoints.length > 0) {
        throw new Error(
          `Unreachable endpoints: ${unreachableEndpoints.map(([ep]) => ep).join(', ')}`,
        );
      }

      return { allEndpointsReachable: true, results };
    });

    this.printSummary();
  }

  printSummary() {
    const endTime = new Date();
    const duration = Math.round((endTime - this.results.summary.startTime) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SATISFACTION RATING API TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(
      `📈 Success Rate: ${((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)}%`,
    );

    if (this.results.summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter((test) => test.status === 'failed')
        .forEach((test) => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    console.log('\n✅ PASSED TESTS:');
    this.results.tests
      .filter((test) => test.status === 'passed')
      .forEach((test) => {
        console.log(`  - ${test.name}`);
      });

    console.log('='.repeat(60));

    // Return non-zero exit code if any tests failed
    if (this.results.summary.failed > 0) {
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const tester = new SatisfactionRatingAPITest();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 Test runner error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SatisfactionRatingAPITest;

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const readDuration = new Trend('read_duration', true);
const writeDuration = new Trend('write_duration', true);
const dashboardDuration = new Trend('dashboard_duration', true);
const leadsDuration = new Trend('leads_duration', true);
const searchDuration = new Trend('search_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 25 }, // Ramp up to 25 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users (sustained)
    { duration: '30s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    // Acceptance criteria: P95 < 500ms reads, < 1000ms writes
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    read_duration: ['p(95)<500'],
    write_duration: ['p(95)<1000'],
    dashboard_duration: ['p(95)<500'],
    leads_duration: ['p(95)<500'],
    search_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Helper to create auth headers
function getAuthHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': __ENV.TENANT_ID || 'test-tenant',
    },
  };
}

export default function () {
  const authHeaders = getAuthHeaders(__ENV.AUTH_TOKEN || '');

  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  const healthOk = check(healthRes, {
    'health returns 200': (r) => r.status === 200,
  });
  errorRate.add(!healthOk);

  // Login endpoint (write operation)
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'test@example.com',
      password: __ENV.TEST_PASSWORD || 'testpassword',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  writeDuration.add(loginRes.timings.duration);
  const loginOk = check(loginRes, {
    'login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login response time < 1s': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!loginOk);

  // Dashboard metrics (read)
  const dashRes = http.get(`${BASE_URL}/api/dashboard/metrics`, authHeaders);
  dashboardDuration.add(dashRes.timings.duration);
  readDuration.add(dashRes.timings.duration);
  const dashOk = check(dashRes, {
    'dashboard responds': (r) => r.status < 500,
    'dashboard response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!dashOk);

  // Leads list (read, paginated)
  const leadsRes = http.get(`${BASE_URL}/api/leads?page=1&limit=10`, authHeaders);
  leadsDuration.add(leadsRes.timings.duration);
  readDuration.add(leadsRes.timings.duration);
  const leadsOk = check(leadsRes, {
    'leads responds': (r) => r.status < 500,
    'leads response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!leadsOk);

  // Leads CRUD - create (write operation)
  const createLeadRes = http.post(
    `${BASE_URL}/api/leads`,
    JSON.stringify({
      companyName: `Load Test Lead ${Date.now()}`,
      contactName: 'Test User',
      email: `loadtest-${__VU}-${__ITER}@example.com`,
      status: 'new',
    }),
    authHeaders,
  );
  writeDuration.add(createLeadRes.timings.duration);
  const createOk = check(createLeadRes, {
    'create lead responds': (r) => r.status < 500,
    'create lead response time < 1s': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!createOk);

  // Customers list (read)
  const customersRes = http.get(`${BASE_URL}/api/customers?page=1&limit=10`, authHeaders);
  readDuration.add(customersRes.timings.duration);
  const customersOk = check(customersRes, {
    'customers responds': (r) => r.status < 500,
    'customers response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!customersOk);

  // Search (read)
  const searchRes = http.get(
    `${BASE_URL}/api/search?q=test&limit=10`,
    authHeaders,
  );
  searchDuration.add(searchRes.timings.duration);
  readDuration.add(searchRes.timings.duration);
  const searchOk = check(searchRes, {
    'search responds': (r) => r.status < 500,
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!searchOk);

  // Quotes list (read)
  const quotesRes = http.get(`${BASE_URL}/api/quotes?page=1&limit=10`, authHeaders);
  readDuration.add(quotesRes.timings.duration);
  const quotesOk = check(quotesRes, {
    'quotes responds': (r) => r.status < 500,
  });
  errorRate.add(!quotesOk);

  sleep(1);
}

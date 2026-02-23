import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const dashboardDuration = new Trend('dashboard_duration', true);
const leadsDuration = new Trend('leads_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 25 }, // Ramp up to 25 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    dashboard_duration: ['p(95)<1500'],
    leads_duration: ['p(95)<1500'],
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

  // Login endpoint
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'test@example.com',
      password: __ENV.TEST_PASSWORD || 'testpassword',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const loginOk = check(loginRes, {
    'login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(!loginOk);

  // Dashboard metrics
  const dashRes = http.get(`${BASE_URL}/api/dashboard/metrics`, authHeaders);
  dashboardDuration.add(dashRes.timings.duration);
  const dashOk = check(dashRes, {
    'dashboard responds': (r) => r.status < 500,
    'dashboard response time < 1.5s': (r) => r.timings.duration < 1500,
  });
  errorRate.add(!dashOk);

  // Leads list (paginated)
  const leadsRes = http.get(`${BASE_URL}/api/leads?page=1&limit=10`, authHeaders);
  leadsDuration.add(leadsRes.timings.duration);
  const leadsOk = check(leadsRes, {
    'leads responds': (r) => r.status < 500,
    'leads response time < 1.5s': (r) => r.timings.duration < 1500,
  });
  errorRate.add(!leadsOk);

  // Customers list
  const customersRes = http.get(`${BASE_URL}/api/customers?page=1&limit=10`, authHeaders);
  const customersOk = check(customersRes, {
    'customers responds': (r) => r.status < 500,
  });
  errorRate.add(!customersOk);

  // Quotes list
  const quotesRes = http.get(`${BASE_URL}/api/quotes?page=1&limit=10`, authHeaders);
  const quotesOk = check(quotesRes, {
    'quotes responds': (r) => r.status < 500,
  });
  errorRate.add(!quotesOk);

  sleep(1);
}

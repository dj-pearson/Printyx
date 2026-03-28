import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestCount = new Counter('total_requests');
const dashboardDuration = new Trend('dashboard_duration', true);
const leadsDuration = new Trend('leads_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to normal load
    { duration: '1m', target: 100 }, // Around breaking point
    { duration: '1m', target: 200 }, // 200 concurrent users burst (acceptance criteria)
    { duration: '1m', target: 200 }, // Sustain 200 users
    { duration: '30s', target: 0 }, // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.15'],
    errors: ['rate<0.2'],
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
  requestCount.add(1);
  const healthOk = check(healthRes, {
    'health returns 200': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!healthOk);

  // Login endpoint - stress the auth system
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'test@example.com',
      password: __ENV.TEST_PASSWORD || 'testpassword',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  requestCount.add(1);
  const loginOk = check(loginRes, {
    'login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(!loginOk);

  // Dashboard metrics - typically a heavy query
  const dashRes = http.get(`${BASE_URL}/api/dashboard/metrics`, authHeaders);
  requestCount.add(1);
  dashboardDuration.add(dashRes.timings.duration);
  const dashOk = check(dashRes, {
    'dashboard responds': (r) => r.status < 500,
  });
  errorRate.add(!dashOk);

  // Leads list
  const leadsRes = http.get(`${BASE_URL}/api/leads?page=1&limit=10`, authHeaders);
  requestCount.add(1);
  leadsDuration.add(leadsRes.timings.duration);
  const leadsOk = check(leadsRes, {
    'leads responds': (r) => r.status < 500,
  });
  errorRate.add(!leadsOk);

  // Customers list
  const customersRes = http.get(`${BASE_URL}/api/customers?page=1&limit=10`, authHeaders);
  requestCount.add(1);
  const customersOk = check(customersRes, {
    'customers responds': (r) => r.status < 500,
  });
  errorRate.add(!customersOk);

  // Quotes list
  const quotesRes = http.get(`${BASE_URL}/api/quotes?page=1&limit=10`, authHeaders);
  requestCount.add(1);
  const quotesOk = check(quotesRes, {
    'quotes responds': (r) => r.status < 500,
  });
  errorRate.add(!quotesOk);

  // Invoices list
  const invoicesRes = http.get(`${BASE_URL}/api/invoices?page=1&limit=10`, authHeaders);
  requestCount.add(1);
  const invoicesOk = check(invoicesRes, {
    'invoices responds': (r) => r.status < 500,
  });
  errorRate.add(!invoicesOk);

  // Equipment list
  const equipmentRes = http.get(`${BASE_URL}/api/equipment?page=1&limit=10`, authHeaders);
  requestCount.add(1);
  const equipmentOk = check(equipmentRes, {
    'equipment responds': (r) => r.status < 500,
  });
  errorRate.add(!equipmentOk);

  sleep(0.5);
}

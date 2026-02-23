import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
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
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { 'health returns 200': (r) => r.status === 200 });

  // Login endpoint
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'test@example.com',
      password: __ENV.TEST_PASSWORD || 'testpassword',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Dashboard (with auth if available)
  const dashRes = http.get(
    `${BASE_URL}/api/dashboard/metrics`,
    getAuthHeaders(__ENV.AUTH_TOKEN || ''),
  );
  check(dashRes, { 'dashboard responds': (r) => r.status < 500 });

  // Leads list
  const leadsRes = http.get(
    `${BASE_URL}/api/leads?page=1&limit=10`,
    getAuthHeaders(__ENV.AUTH_TOKEN || ''),
  );
  check(leadsRes, { 'leads responds': (r) => r.status < 500 });

  sleep(1);
}

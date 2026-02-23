# Performance Load Tests (k6)

This directory contains [k6](https://k6.io/) performance load test scripts for the Printyx application.

## Prerequisites

Install k6 on your system:

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

## Test Scripts

| Script       | Purpose                    | VUs      | Duration | Use Case                                      |
| ------------ | -------------------------- | -------- | -------- | --------------------------------------------- |
| `smoke.js`   | Basic sanity check         | 1        | 30s      | Verify endpoints work under minimal load       |
| `load.js`    | Normal load simulation     | up to 50 | 5 min    | Validate performance under expected traffic    |
| `stress.js`  | Stress / breaking point    | 10-200   | 10 min   | Find system limits and observe failure modes   |

## Running Tests

### Quick Start (npm)

```bash
npm run test:load:smoke
```

### Direct k6 Commands

```bash
# Smoke test (1 VU, 30 seconds)
k6 run tests/load/smoke.js

# Load test (ramp to 50 VUs over 5 minutes)
k6 run tests/load/load.js

# Stress test (ramp 10 to 200 VUs over 10 minutes)
k6 run tests/load/stress.js
```

### With Environment Variables

Use environment variables to configure the target server, authentication, and tenant:

```bash
# Against a staging server with auth
k6 run \
  -e BASE_URL=https://staging.printyx.net \
  -e AUTH_TOKEN=your-jwt-token \
  -e TENANT_ID=your-tenant-id \
  -e TEST_EMAIL=user@example.com \
  -e TEST_PASSWORD=password123 \
  tests/load/smoke.js
```

### With Docker

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:5000 \
  grafana/k6 run - < tests/load/smoke.js
```

### JSON Output for CI

```bash
k6 run --out json=results.json tests/load/load.js
```

## Environment Variables

| Variable         | Default                  | Description                     |
| ---------------- | ------------------------ | ------------------------------- |
| `BASE_URL`       | `http://localhost:5000`  | Target server URL               |
| `AUTH_TOKEN`     | (empty)                  | JWT bearer token for auth       |
| `TENANT_ID`     | `test-tenant`            | Tenant ID for multi-tenant auth |
| `TEST_EMAIL`     | `test@example.com`       | Email for login endpoint test   |
| `TEST_PASSWORD`  | `testpassword`           | Password for login endpoint     |

## Interpreting Results

After a test run, k6 outputs a summary with key metrics:

### Key Metrics

| Metric               | Description                                       | Healthy Target          |
| -------------------- | ------------------------------------------------- | ----------------------- |
| `http_req_duration`  | Total request time (send + wait + receive)         | p(95) < 500ms (smoke)   |
| `http_req_failed`    | Percentage of failed HTTP requests (status >= 400) | < 1% (smoke), < 5% (load) |
| `http_reqs`          | Total number of HTTP requests made                 | Higher is better         |
| `vus`                | Current number of active virtual users             | Should match config      |
| `iterations`         | Total completed test iterations                    | Higher is better         |

### Custom Metrics (load.js and stress.js)

| Metric                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `errors`               | Rate of failed check assertions                  |
| `dashboard_duration`   | Response time trend for `/api/dashboard/metrics`  |
| `leads_duration`       | Response time trend for `/api/leads`              |
| `total_requests`       | Total request count (stress.js only)             |

### Thresholds

Each test script defines pass/fail thresholds:

- **Smoke**: p(95) < 500ms, failure rate < 1%
- **Load**: p(95) < 1000ms, p(99) < 2000ms, failure rate < 5%
- **Stress**: p(95) < 3000ms, p(99) < 5000ms, failure rate < 15%

### Example Output

```
     checks.........................: 100.00% 120 out of 120
     data_received..................: 1.2 MB  40 kB/s
     data_sent......................: 52 kB   1.7 kB/s
     http_req_duration..............: avg=45ms min=2ms med=30ms max=320ms p(90)=95ms p(95)=150ms
     http_req_failed................: 0.00%   0 out of 120
     http_reqs......................: 120     4/s
     iteration_duration.............: avg=1.18s min=1.01s med=1.1s max=1.95s p(90)=1.4s p(95)=1.6s
     iterations.....................: 30      1/s
     vus............................: 1       min=1 max=1
```

- **checks**: Percentage of assertions that passed. 100% means all checks passed.
- **http_req_duration**: Look at p(95) - 95% of requests should be under the threshold.
- **http_req_failed**: Should be near 0% for smoke tests.
- **http_reqs**: Total requests and requests per second (throughput).
- **iterations**: Number of complete test loop iterations.

### When Tests Fail

If thresholds are breached, k6 exits with a non-zero code. Common causes:

1. **High p(95) latency**: Slow database queries, missing indexes, or N+1 queries
2. **High failure rate**: Server errors (5xx), connection refused, or timeouts
3. **Degraded throughput**: Resource exhaustion (CPU, memory, DB connections)

## Recommended Test Workflow

1. **Smoke test first** - Verify basic functionality before heavier tests
2. **Load test** - Validate performance under expected production traffic
3. **Stress test** - Find the breaking point and observe how the system recovers
4. **Fix bottlenecks** - Address issues found in steps 2-3
5. **Re-test** - Confirm improvements with another round of tests

# Monitoring & Observability Guide

This document describes the comprehensive monitoring infrastructure for Printyx, including structured logging, APM (Application Performance Monitoring), and log aggregation.

## Table of Contents

1. [Overview](#overview)
2. [Structured Logging](#structured-logging)
3. [APM Integration](#apm-integration)
4. [Log Aggregation](#log-aggregation)
5. [Database Query Logging](#database-query-logging)
6. [HTTP Request/Response Logging](#http-requestresponse-logging)
7. [Configuration Reference](#configuration-reference)
8. [Usage Examples](#usage-examples)
9. [Best Practices](#best-practices)

---

## Overview

The Printyx monitoring infrastructure provides:

- **Structured Logging** with Pino for JSON-formatted, searchable logs
- **APM Integration** with Sentry (and support for DataDog/New Relic)
- **Log Aggregation** to CloudWatch, Elasticsearch, Splunk, or custom endpoints
- **Correlation IDs** for distributed tracing across requests
- **Database Query Logging** with slow query detection
- **HTTP Request/Response Logging** with automatic context injection

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Logger     │  │     APM      │  │  Log Transport       │  │
│  │   (Pino)     │  │   (Sentry)   │  │  (CloudWatch/ELK)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Monitoring Middleware                        │  │
│  │  - Request ID injection                                   │  │
│  │  - Context propagation (AsyncLocalStorage)               │  │
│  │  - HTTP logging                                          │  │
│  │  - Error capture                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │         External Services            │
        │  - Sentry (error tracking + APM)     │
        │  - CloudWatch / Elasticsearch        │
        │  - Splunk                            │
        └──────────────────────────────────────┘
```

---

## Structured Logging

### Overview

Printyx uses [Pino](https://getpino.io/) for structured JSON logging. Pino is one of the fastest JSON loggers for Node.js.

### Log Levels

| Level    | Value | Description                                           |
| -------- | ----- | ----------------------------------------------------- |
| `trace`  | 10    | Most detailed debugging information                   |
| `debug`  | 20    | Debugging information                                 |
| `metric` | 25    | Custom level for metrics (between debug and info)     |
| `info`   | 30    | General information (default)                         |
| `audit`  | 35    | Custom level for audit events (between info and warn) |
| `warn`   | 40    | Warning messages                                      |
| `error`  | 50    | Error messages                                        |
| `fatal`  | 60    | Critical errors that may cause application shutdown   |

### Basic Usage

```typescript
import { log, createModuleLogger } from './lib/monitoring';

// Simple logging
log.info('Server started');
log.error(new Error('Something went wrong'), 'Error occurred');

// With context
log.info({ userId: '123', action: 'login' }, 'User logged in');

// Module-specific logger
const dbLog = createModuleLogger('database');
dbLog.debug({ query: 'SELECT...', duration: 50 }, 'Query executed');
```

### Log Output Format

**Development (pretty printed):**

```
[2025-01-15 10:30:45.123] INFO (server): Server listening on port 5000
[2025-01-15 10:30:45.456] DEBUG (database): Query executed
    query: "SELECT * FROM users WHERE id = $1"
    duration: 50
```

**Production (JSON):**

```json
{
  "level": "info",
  "time": "2025-01-15T10:30:45.123Z",
  "msg": "Server listening on port 5000",
  "app": "printyx",
  "version": "1.0.0",
  "env": "production",
  "module": "server",
  "requestId": "abc-123-def",
  "pid": 12345
}
```

### Automatic Context Injection

Logs automatically include request context when available:

```typescript
// Context is automatically injected from AsyncLocalStorage
log.info('Processing request');
// Output includes: requestId, userId, tenantId, sessionId
```

### Sensitive Data Redaction

The following fields are automatically redacted:

- `password`, `token`, `secret`
- `apiKey`, `api_key`
- `accessToken`, `refreshToken`
- `creditCard`, `cvv`, `ssn`
- `authorization` header

---

## APM Integration

### Sentry (Default)

Sentry provides error tracking and performance monitoring.

**Configuration:**

```env
APM_PROVIDER=sentry
SENTRY_DSN=https://your_key@sentry.io/project_id
APM_TRACES_SAMPLE_RATE=0.1
APM_PROFILES_SAMPLE_RATE=0.1
```

### Features

1. **Error Tracking**: Automatic capture of unhandled exceptions
2. **Performance Monitoring**: Transaction and span tracing
3. **Profiling**: CPU profiling for performance analysis
4. **User Context**: Automatic user association with errors
5. **Request Context**: Full request details with errors

### Usage

```typescript
import { getAPM, withSpan, traceDBOperation } from './lib/monitoring';

// Manual error capture
getAPM().captureException(error, {
  requestId: '123',
  userId: 'user-456',
});

// Manual span tracing
const result = await withSpan('processOrder', 'business.logic', async () => {
  // Your code here
  return order;
});

// Database operation tracing
const users = await traceDBOperation('select', 'users', async () => {
  return db.select().from(users);
});
```

### DataDog (Optional)

```env
APM_PROVIDER=datadog
DD_API_KEY=your_api_key
DD_SITE=datadoghq.com
DD_SERVICE=printyx
DD_ENV=production
```

### New Relic (Optional)

```env
APM_PROVIDER=newrelic
NEW_RELIC_LICENSE_KEY=your_license_key
NEW_RELIC_APP_NAME=printyx
```

---

## Log Aggregation

### Supported Providers

1. **AWS CloudWatch Logs**
2. **Elasticsearch / OpenSearch (ELK Stack)**
3. **Splunk (HEC)**
4. **Generic HTTP endpoint**
5. **Local file with rotation**

### CloudWatch Configuration

```env
LOG_TRANSPORT=cloudwatch
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
CLOUDWATCH_LOG_GROUP=/printyx/application
CLOUDWATCH_LOG_STREAM=production-2025-01-15
```

### Elasticsearch Configuration

```env
LOG_TRANSPORT=elasticsearch
ELASTICSEARCH_NODE=https://your-cluster:9200
ELASTICSEARCH_INDEX=printyx-logs
ELASTICSEARCH_API_KEY=your_api_key
```

### Splunk Configuration

```env
LOG_TRANSPORT=splunk
SPLUNK_HOST=splunk.example.com
SPLUNK_HEC_TOKEN=your_token
SPLUNK_INDEX=main
SPLUNK_SOURCE=printyx
```

### Batching and Performance

Logs are batched for performance:

```env
LOG_BATCH_SIZE=100          # Logs per batch
LOG_FLUSH_INTERVAL_MS=5000  # Flush every 5 seconds
LOG_MAX_RETRIES=3           # Retry failed batches
LOG_RETRY_DELAY_MS=1000     # Delay between retries
```

---

## Database Query Logging

### Configuration

```env
DB_LOG_QUERIES=true              # Enable query logging
DB_LOG_PARAMS=false              # Log query parameters (security risk)
DB_SLOW_QUERY_THRESHOLD_MS=1000  # Slow query threshold
```

### Features

- Automatic query timing
- Slow query detection and alerting
- Query operation classification (SELECT, INSERT, UPDATE, DELETE)
- Table name extraction
- APM span creation for database operations

### Usage

```typescript
import { tracedDbOperation, getQueryStats } from './lib/monitoring';

// Traced database operation
const users = await tracedDbOperation('select', 'users', async () => {
  return db.select().from(users).where(eq(users.tenantId, tenantId));
});

// Get query statistics
const stats = getQueryStats();
// { queryCount: 1234, avgDuration: 45, slowQueries: 12, errorCount: 3 }
```

### Slow Query Detection

When a query exceeds `DB_SLOW_QUERY_THRESHOLD_MS`:

1. A warning is logged with full query details
2. APM is notified with `slow_query` tag
3. Query is tracked in slow query statistics

---

## HTTP Request/Response Logging

### Automatic Logging

All HTTP requests are automatically logged with:

- Request ID (X-Request-Id header)
- Method, path, status code
- Duration
- User and tenant context
- Response size

### Audit Logging

Sensitive endpoints are audited with additional details:

- `/api/root-admin/*`
- `/api/security/*`
- `/api/platform/*`
- `/api/seo/*`

Audited requests include:

- Request body hash (SHA-256)
- Full request/response logging (if enabled)
- Written to both structured logs and `server/audit.log`

### Performance Tracking

Request performance can be manually instrumented:

```typescript
app.get('/api/example', (req, res) => {
  req.perf.mark('start');

  // Do some work
  doWork();
  req.perf.measure('work_duration', 'start');

  // More work
  doMoreWork();
  req.perf.measure('total_duration', 'start');

  res.json({ success: true });
});
```

---

## Configuration Reference

### Environment Variables

| Variable                     | Default   | Description                            |
| ---------------------------- | --------- | -------------------------------------- |
| `LOG_LEVEL`                  | `info`    | Minimum log level                      |
| `APP_NAME`                   | `printyx` | Application name in logs               |
| `APP_VERSION`                | `1.0.0`   | Application version                    |
| `APM_PROVIDER`               | `none`    | APM provider (sentry/datadog/newrelic) |
| `SENTRY_DSN`                 | -         | Sentry DSN                             |
| `APM_TRACES_SAMPLE_RATE`     | `0.1`     | APM trace sampling rate                |
| `APM_PROFILES_SAMPLE_RATE`   | `0.1`     | APM profile sampling rate              |
| `APM_ENABLE_TRACING`         | `true`    | Enable performance tracing             |
| `LOG_TRANSPORT`              | `console` | Log transport provider                 |
| `LOG_BATCH_SIZE`             | `100`     | Log batch size                         |
| `LOG_FLUSH_INTERVAL_MS`      | `5000`    | Log flush interval                     |
| `DB_LOG_QUERIES`             | `true`    | Enable query logging                   |
| `DB_SLOW_QUERY_THRESHOLD_MS` | `1000`    | Slow query threshold                   |

### Monitoring Endpoints

| Endpoint                       | Description               |
| ------------------------------ | ------------------------- |
| `GET /api/monitoring/health`   | Monitoring system health  |
| `GET /api/monitoring/db-stats` | Database query statistics |

---

## Usage Examples

### Basic Service with Logging

```typescript
import { createModuleLogger, withSpan } from './lib/monitoring';

const log = createModuleLogger('order-service');

export async function createOrder(orderData: OrderInput): Promise<Order> {
  log.info({ customerId: orderData.customerId }, 'Creating order');

  return withSpan('createOrder', 'order.create', async () => {
    try {
      const order = await db.insert(orders).values(orderData).returning();

      log.info({ orderId: order.id }, 'Order created successfully');
      return order;
    } catch (error) {
      log.error({ err: error, orderData }, 'Failed to create order');
      throw error;
    }
  });
}
```

### Error Handling with APM

```typescript
import { getAPM, createModuleLogger } from './lib/monitoring';

const log = createModuleLogger('payment-service');

export async function processPayment(paymentData: PaymentInput): Promise<Payment> {
  try {
    const result = await stripeClient.charges.create(paymentData);
    log.info({ paymentId: result.id }, 'Payment processed');
    return result;
  } catch (error) {
    // Log locally
    log.error({ err: error, amount: paymentData.amount }, 'Payment failed');

    // Report to APM with additional context
    getAPM().captureException(error, {
      customerId: paymentData.customerId,
      amount: paymentData.amount,
      currency: paymentData.currency,
    });

    throw error;
  }
}
```

### Request Context in Route Handlers

```typescript
import { log, getRequestContext } from './lib/monitoring';

app.post('/api/orders', async (req, res) => {
  // Context is automatically available
  const context = getRequestContext();

  log.info(
    {
      orderItems: req.body.items.length,
    },
    'Processing new order',
  );

  // All logs in this request will include:
  // - requestId
  // - userId
  // - tenantId
  // - sessionId

  const order = await orderService.create(req.body);
  res.json(order);
});
```

---

## Best Practices

### 1. Use Module Loggers

Create module-specific loggers for better organization:

```typescript
// Good
const log = createModuleLogger('payment-service');
log.info('Processing payment');

// Avoid
console.log('[payment-service] Processing payment');
```

### 2. Include Relevant Context

Always include context that helps with debugging:

```typescript
// Good
log.info(
  {
    orderId: order.id,
    customerId: order.customerId,
    amount: order.total,
  },
  'Order processed',
);

// Avoid
log.info('Order processed');
```

### 3. Use Appropriate Log Levels

- `debug`: Development debugging information
- `info`: Normal operations (requests, business events)
- `warn`: Potential issues that don't stop operations
- `error`: Failures that affect specific operations
- `fatal`: System-wide failures

### 4. Don't Log Sensitive Data

Even with redaction, avoid logging:

- Full credit card numbers
- Passwords or tokens
- Personal identification numbers
- Raw API keys

### 5. Use Structured Data

```typescript
// Good
log.info({ userId: '123', action: 'login', ip: '1.2.3.4' }, 'User login');

// Avoid
log.info(`User 123 logged in from 1.2.3.4`);
```

### 6. Sample High-Volume Operations

For high-frequency operations, consider sampling:

```typescript
// Log 1% of successful health checks
if (Math.random() < 0.01) {
  log.debug('Health check passed');
}

// Always log errors
log.error(error, 'Health check failed');
```

### 7. Set Appropriate APM Sampling Rates

- **Development**: 1.0 (100%) for full visibility
- **Staging**: 0.5 (50%) for testing
- **Production**: 0.1-0.2 (10-20%) to balance cost and visibility

---

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` is set correctly
2. Verify transport configuration
3. Check network connectivity to external services

### APM Not Reporting

1. Verify `SENTRY_DSN` is correct
2. Check `APM_ENABLE_TRACING` is true
3. Review sample rates (may be set too low)

### Slow Query Alerts Not Working

1. Verify `DB_LOG_QUERIES=true`
2. Check `DB_SLOW_QUERY_THRESHOLD_MS` setting
3. Ensure Drizzle logger is configured

### High Log Volume

1. Increase `LOG_LEVEL` to reduce verbosity
2. Exclude health check endpoints
3. Increase `LOG_BATCH_SIZE` for better throughput

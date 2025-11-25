# Phase 4 RBAC Reporting - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Printyx RBAC Reporting System (Phase 4) to production.

**Deployment Type**: Rolling deployment with zero downtime
**Estimated Duration**: 2-4 hours
**Rollback Time**: < 15 minutes
**Risk Level**: Medium (database migrations required)

---

## Pre-Deployment Checklist

### 1. Code Review & Testing ✓

- [ ] All unit tests passing (`npm run test:unit`)
- [ ] All integration tests passing (`npm run test:integration`)
- [ ] E2E tests passing on all browsers (`npm run test:e2e`)
- [ ] Code review completed and approved
- [ ] Performance tests passed (100+ concurrent users)
- [ ] Security audit completed
- [ ] TypeScript compilation successful (`npm run check`)
- [ ] No linting errors (`npm run lint`)

### 2. Database Preparation ✓

- [ ] Backup production database
- [ ] Test database migrations on staging
- [ ] Verify migration rollback scripts
- [ ] Review all schema changes
- [ ] Check index creation (may be slow on large tables)
- [ ] Verify foreign key constraints

### 3. Environment Configuration ✓

- [ ] Environment variables set correctly
- [ ] Secrets rotated (if applicable)
- [ ] CDN cache invalidation plan ready
- [ ] SSL certificates valid
- [ ] DNS records verified
- [ ] Load balancer health checks configured

### 4. Dependencies & Infrastructure ✓

- [ ] Node.js version: 20.x LTS
- [ ] PostgreSQL version: 14+ (Neon serverless)
- [ ] Redis available for caching (optional but recommended)
- [ ] Monitoring tools configured (DataDog, New Relic, etc.)
- [ ] Log aggregation ready (CloudWatch, Splunk, etc.)
- [ ] Alert thresholds configured

### 5. Communication ✓

- [ ] Maintenance window scheduled and communicated
- [ ] Customer support team briefed
- [ ] Escalation contacts identified
- [ ] Rollback decision-makers assigned
- [ ] Status page prepared (status.printyx.com)

---

## Deployment Steps

### Phase 1: Database Migration (30-45 minutes)

#### 1.1. Backup Database

```bash
# Create timestamped backup
BACKUP_FILE="printyx_backup_$(date +%Y%m%d_%H%M%S).sql"

# Neon PostgreSQL backup via pg_dump
pg_dump $DATABASE_URL > backups/$BACKUP_FILE

# Verify backup integrity
pg_restore --list backups/$BACKUP_FILE

# Upload to S3 for disaster recovery
aws s3 cp backups/$BACKUP_FILE s3://printyx-backups/phase4/
```

#### 1.2. Run Migrations

```bash
# Dry run first (test mode)
npm run db:push -- --dry-run

# Review migration SQL
cat migrations/0042_add_reporting_tables.sql

# Apply migrations
npm run db:push

# Verify migration success
psql $DATABASE_URL -c "SELECT * FROM report_definitions LIMIT 1;"
```

Expected new tables:
- `report_definitions` (75 rows)
- `report_schedules`
- `report_executions`
- `kpi_definitions` (43 rows)
- `user_report_preferences`

#### 1.3. Seed Report Definitions

```bash
# Seed RBAC roles and permissions (if not already done)
npm run seed:rbac

# Seed all 75 report definitions
npm run seed:reports

# Seed 43 KPI definitions
npm run seed:kpis

# Verify seeding
psql $DATABASE_URL -c "SELECT COUNT(*) FROM report_definitions;"
# Expected: 75

psql $DATABASE_URL -c "SELECT COUNT(*) FROM kpi_definitions;"
# Expected: 43
```

#### 1.4. Create Database Indexes

```sql
-- Critical indexes for report performance
CREATE INDEX CONCURRENTLY idx_report_definitions_category ON report_definitions(category);
CREATE INDEX CONCURRENTLY idx_report_definitions_required_level ON report_definitions(required_level);
CREATE INDEX CONCURRENTLY idx_report_executions_user_report ON report_executions(user_id, report_code);
CREATE INDEX CONCURRENTLY idx_report_executions_created_at ON report_executions(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_opportunities_tenant_owner ON opportunities(tenant_id, owner_id);
CREATE INDEX CONCURRENTLY idx_service_calls_tenant_location ON service_calls(tenant_id, location_id);
```

**Note**: `CONCURRENTLY` allows index creation without locking tables.

---

### Phase 2: Application Deployment (45-60 minutes)

#### 2.1. Build Application

```bash
# Pull latest code
git checkout main
git pull origin main

# Install dependencies
npm ci --production

# Run type checking
npm run check

# Build client and server
npm run build

# Verify build artifacts
ls -lh dist/
ls -lh dist/client/
```

#### 2.2. Deploy to Staging

```bash
# Deploy to staging environment
npm run deploy:staging

# Run smoke tests
npm run test:e2e -- --project=chromium --grep="smoke"

# Manual verification on staging
# 1. Login as different role levels
# 2. Execute 5-10 key reports
# 3. Test export functionality
# 4. Verify caching behavior
```

#### 2.3. Deploy to Production

```bash
# Tag release
git tag -a v3.0.0-phase4 -m "Phase 4: RBAC Reporting System"
git push origin v3.0.0-phase4

# Deploy to production (rolling deployment)
npm run deploy:production

# This will:
# 1. Build application
# 2. Deploy to 1 server (canary)
# 3. Wait 10 minutes, monitor metrics
# 4. Deploy to 50% of servers
# 5. Wait 10 minutes, monitor metrics
# 6. Deploy to remaining servers
```

#### 2.4. Verify Deployment

```bash
# Check application health
curl https://api.printyx.com/health

# Expected response:
# {"status":"healthy","version":"3.0.0","uptime":123}

# Verify reporting endpoints
curl -H "Authorization: Bearer $TOKEN" \
  https://api.printyx.com/api/reports

# Should return list of reports

# Check database connectivity
curl https://api.printyx.com/api/reports/SALES_PIPELINE_INDIVIDUAL/execute \
  -H "Authorization: Bearer $TOKEN" \
  -X POST -d '{}'

# Should execute report successfully
```

---

### Phase 3: Cache Warming (15-30 minutes)

#### 3.1. Pre-populate Cache

```bash
# Run cache warming script
node server/scripts/warm-report-cache.js

# This will execute all 75 reports for test users
# to populate Redis/in-memory cache
```

#### 3.2. CDN Purge

```bash
# Purge CDN cache for frontend assets
curl -X POST https://cdn.printyx.com/purge \
  -H "X-Purge-Key: $CDN_PURGE_KEY" \
  -d '{"files": ["*.js", "*.css"]}'

# Verify new assets served
curl -I https://cdn.printyx.com/assets/main.js
# Check X-Cache header should be MISS
```

---

### Phase 4: Monitoring & Validation (30 minutes)

#### 4.1. Monitor Key Metrics

**Application Metrics**:
- [ ] Response time < 500ms (p95)
- [ ] Error rate < 0.1%
- [ ] Report execution success rate > 99%
- [ ] Cache hit rate > 70%

**Database Metrics**:
- [ ] Query time < 200ms (p95)
- [ ] Connection pool utilization < 80%
- [ ] No slow query alerts

**Infrastructure Metrics**:
- [ ] CPU utilization < 70%
- [ ] Memory usage < 80%
- [ ] No disk space warnings

#### 4.2. Smoke Testing

Test each role level:

```bash
# Sales Rep (Level 1)
curl -X POST https://api.printyx.com/api/reports/SALES_PIPELINE_INDIVIDUAL/execute \
  -H "Authorization: Bearer $SALES_REP_TOKEN"

# Sales Manager (Level 4)
curl -X POST https://api.printyx.com/api/reports/SALES_TEAM_DASHBOARD/execute \
  -H "Authorization: Bearer $SALES_MANAGER_TOKEN"

# CEO (Level 7)
curl -X POST https://api.printyx.com/api/reports/EXECUTIVE_CEO_DASHBOARD/execute \
  -H "Authorization: Bearer $CEO_TOKEN"
```

All should return `success: true`.

#### 4.3. Permission Validation

```bash
# Test denied access (Sales Rep trying to access Executive report)
curl -X POST https://api.printyx.com/api/reports/EXECUTIVE_CEO_DASHBOARD/execute \
  -H "Authorization: Bearer $SALES_REP_TOKEN"

# Expected: 403 Forbidden
# {"error": "Insufficient permissions", "code": "PERMISSION_DENIED"}
```

---

### Phase 5: User Communication (15 minutes)

#### 5.1. Send Launch Announcement

```bash
# Trigger email campaign via SendGrid/Mailchimp
node server/scripts/send-launch-email.js

# Email template: docs/PHASE4_LAUNCH_ANNOUNCEMENT.md
```

#### 5.2. Update Documentation

- [ ] Update help.printyx.com with new reporting guides
- [ ] Publish video tutorials to learn.printyx.com
- [ ] Update in-app help tooltips
- [ ] Enable feature tour for first-time users

#### 5.3. Enable Feature Flags

```bash
# Enable RBAC reporting for all users
redis-cli SET feature:rbac_reporting:enabled true

# Enable report scheduling for Manager+ roles
redis-cli SET feature:report_scheduling:enabled true

# Enable export functionality for Director+ roles
redis-cli SET feature:report_export:enabled true
```

---

## Post-Deployment Validation

### Automated Tests

```bash
# Run full E2E suite on production
BASE_URL=https://app.printyx.com npm run test:e2e

# Run load tests (100 concurrent users)
artillery run tests/load/report-execution.yml

# Expected:
# - p95 response time < 1s
# - Error rate < 0.5%
# - Throughput > 1000 req/min
```

### Manual Validation (30 minutes)

**Test Plan**:

1. **Login as Different Roles** (10 min)
   - Sales Rep → Execute 3 individual reports ✓
   - Sales Manager → Execute team and location reports ✓
   - Regional Director → Execute regional reports ✓
   - CEO → Execute executive dashboard ✓

2. **Test Export Functionality** (10 min)
   - Export report as CSV ✓
   - Export report as Excel ✓
   - Export report as PDF ✓

3. **Test Report Scheduling** (5 min)
   - Schedule daily report for Manager ✓
   - Verify schedule saved ✓
   - Check email delivery (wait 5 min if scheduled immediately)

4. **Test Permissions** (5 min)
   - Sales Rep tries to access Executive report → Denied ✓
   - Manager tries to export report → Allowed if has permission ✓
   - Verify tenant isolation (create test tenant) ✓

---

## Performance Benchmarks

### Expected Performance

| Metric | Target | Acceptable | Action Required If |
|--------|--------|------------|-------------------|
| Report Execution (Simple) | < 500ms | < 1s | > 2s |
| Report Execution (Complex) | < 2s | < 5s | > 10s |
| Report Export (CSV) | < 3s | < 10s | > 30s |
| Report Export (Excel) | < 5s | < 15s | > 60s |
| Report Export (PDF) | < 10s | < 30s | > 120s |
| Cache Hit Rate | > 80% | > 60% | < 50% |
| Database Query Time (p95) | < 100ms | < 300ms | > 500ms |
| API Response Time (p95) | < 300ms | < 800ms | > 1.5s |

### Load Testing Results

```bash
# Artillery load test output
artillery run tests/load/report-execution.yml

# Expected output:
Summary report:
  scenarios launched:  10000
  scenarios completed: 10000
  requests completed:  50000
  RPS sent: 833.33
  Request latency:
    min: 45
    max: 1823
    median: 267
    p95: 589
    p99: 912
  Scenario duration:
    min: 234
    max: 8234
    median: 1456
    p95: 3421
    p99: 5123
  Scenario counts:
    Execute individual report: 3000
    Execute team dashboard: 2500
    Execute regional report: 1500
    Execute executive report: 1000
    Export report as CSV: 1500
    Export report as Excel: 500
  Errors:
    ECONNREFUSED: 0
    HTTP 500: 12 (0.024%)
    HTTP 403: 45 (0.09%) # Expected - permission denials
    HTTP 429: 0 # No rate limiting triggered
  Codes:
    200: 49943 (99.9%)
    403: 45 (0.09%)
    500: 12 (0.024%)
```

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:
- ❌ Error rate > 5% for 5 minutes
- ❌ Response time p95 > 5s for 10 minutes
- ❌ Critical bug affecting data integrity
- ❌ Security vulnerability discovered
- ❌ Database corruption detected

Consider rollback if:
- ⚠️ Error rate 1-5% for 15 minutes
- ⚠️ User complaints about performance
- ⚠️ Unexpected behavior in production

### Rollback Steps (15 minutes)

#### 1. Application Rollback

```bash
# Revert to previous version
git checkout v2.9.5  # Previous stable version

# Rebuild
npm run build

# Deploy previous version
npm run deploy:production --rollback

# This will:
# 1. Deploy to all servers simultaneously
# 2. Restart application processes
# 3. Verify health checks
```

#### 2. Database Rollback

```bash
# Restore from backup
pg_restore --clean --if-exists \
  -d $DATABASE_URL \
  backups/printyx_backup_YYYYMMDD_HHMMSS.sql

# Or run down migrations
npm run migrate:rollback

# Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM opportunities;"
# Should match pre-migration count
```

#### 3. Cache Invalidation

```bash
# Clear all Redis cache
redis-cli FLUSHALL

# Restart application to clear in-memory cache
pm2 restart all
```

#### 4. Verify Rollback

```bash
# Check version
curl https://api.printyx.com/health
# Should show previous version (e.g., 2.9.5)

# Test basic functionality
curl https://api.printyx.com/api/customers
# Should return customer list

# Monitor error rates
# Error rate should return to < 0.1%
```

#### 5. Communicate Rollback

```bash
# Update status page
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth $STATUSPAGE_TOKEN" \
  -d '{
    "incident": {
      "name": "Rollback of Phase 4 Deployment",
      "status": "investigating",
      "impact_override": "minor",
      "body": "We have rolled back the Phase 4 deployment due to [reason]. Investigating the issue."
    }
  }'

# Send email to affected customers
node server/scripts/send-rollback-notification.js
```

---

## Troubleshooting

### Common Issues

#### Issue: Reports Not Loading

**Symptoms**:
- Report execution fails with timeout
- `504 Gateway Timeout` errors

**Diagnosis**:
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check slow queries
psql $DATABASE_URL -c "
  SELECT pid, query, state, query_start
  FROM pg_stat_activity
  WHERE state = 'active' AND query_start < NOW() - INTERVAL '10 seconds'
  ORDER BY query_start;
"

# Check application logs
tail -f /var/log/printyx/application.log | grep "Report execution"
```

**Solution**:
1. Restart database connection pool: `pm2 restart all`
2. Scale database resources (if cloud-based)
3. Add missing indexes (see Phase 1.4)
4. Enable query caching

---

#### Issue: Permission Denied Errors

**Symptoms**:
- Users cannot access reports they should have access to
- `403 Forbidden` errors for valid requests

**Diagnosis**:
```bash
# Check user permissions
psql $DATABASE_URL -c "
  SELECT u.id, u.email, r.name AS role, up.permission
  FROM users u
  JOIN roles r ON u.role_id = r.id
  LEFT JOIN user_permissions up ON u.id = up.user_id
  WHERE u.email = 'user@example.com';
"

# Check role level
psql $DATABASE_URL -c "
  SELECT id, name, level
  FROM roles
  WHERE id = (SELECT role_id FROM users WHERE email = 'user@example.com');
"
```

**Solution**:
1. Re-seed RBAC permissions: `npm run seed:rbac`
2. Clear permission cache: `redis-cli DEL permission_cache:*`
3. Verify user role assignment
4. Check report `required_level` and `required_permissions`

---

#### Issue: High Database Load

**Symptoms**:
- Slow report execution
- High CPU on database server
- Connection pool exhaustion

**Diagnosis**:
```bash
# Check active connections
psql $DATABASE_URL -c "
  SELECT COUNT(*), state
  FROM pg_stat_activity
  GROUP BY state;
"

# Check expensive queries
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

**Solution**:
1. Add missing indexes (see Phase 1.4)
2. Increase connection pool size: `MAX_POOL_SIZE=50`
3. Enable query result caching
4. Optimize report SQL queries
5. Scale database vertically (more CPU/RAM)

---

## Monitoring Dashboard

### Key Metrics to Watch (First 24 Hours)

**Application Health**:
- API Response Time (p50, p95, p99)
- Error Rate (4xx, 5xx)
- Request Volume (requests/min)
- Report Execution Success Rate

**Business Metrics**:
- Report Executions by Role Level
- Most Popular Reports
- Export Count by Format
- Scheduled Report Deliveries

**Database Health**:
- Query Latency (p95, p99)
- Connection Pool Utilization
- Slow Queries (> 1s)
- Deadlocks

**User Engagement**:
- Daily Active Users (DAU)
- Reports per User
- Average Session Duration
- Feature Adoption Rate

### Alerts to Configure

**Critical Alerts** (PagerDuty/OpsGenie):
- Error rate > 5% for 5 minutes
- API response time p95 > 5s for 10 minutes
- Database connection pool exhausted
- Application server down

**Warning Alerts** (Slack/Email):
- Error rate > 1% for 15 minutes
- API response time p95 > 2s for 20 minutes
- Cache hit rate < 50%
- Slow query detected (> 5s)

---

## Success Criteria

Deployment considered successful if:

✅ **Technical Criteria**:
- [ ] Error rate < 0.5% after 24 hours
- [ ] API response time p95 < 800ms
- [ ] All 75 reports executing successfully
- [ ] Export functionality working for all formats
- [ ] Report scheduling delivering emails
- [ ] Zero data integrity issues
- [ ] Zero security vulnerabilities

✅ **Business Criteria**:
- [ ] > 80% of users access at least 1 report in first week
- [ ] < 10 support tickets related to reporting
- [ ] Positive feedback from pilot users
- [ ] No escalations to engineering leadership

✅ **Performance Criteria**:
- [ ] Report execution < 1s (p95)
- [ ] Database query time < 300ms (p95)
- [ ] Cache hit rate > 70%

---

## Post-Deployment Tasks

### Week 1

- [ ] Daily check of error logs
- [ ] Monitor user adoption metrics
- [ ] Collect user feedback via surveys
- [ ] Address critical bugs within 24 hours
- [ ] Publish blog post about new reporting features

### Week 2-4

- [ ] Weekly performance review
- [ ] Optimize slow-running reports
- [ ] Add additional indexes based on query patterns
- [ ] Conduct user training sessions
- [ ] Iterate on report designs based on feedback

### Month 2

- [ ] Comprehensive performance review
- [ ] User satisfaction survey
- [ ] Plan Phase 5 enhancements
- [ ] Document lessons learned

---

**Deployment Owner**: CTO/VP Engineering
**On-Call Engineer**: SRE Team
**Escalation Contact**: CEO
**Rollback Decision-Maker**: CTO

**Last Updated**: November 25, 2025
**Version**: 1.0
**Next Review**: Post-deployment retrospective

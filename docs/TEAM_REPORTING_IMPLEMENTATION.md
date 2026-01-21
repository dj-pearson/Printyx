# Team-Level Reporting & Stats Implementation

**Date:** 2025-11-25
**Version:** 1.0
**Status:** ✅ Complete - Phase 1

## 📋 Overview

This document describes the implementation of **team-level reporting and stats** for the Printyx RBAC system. This fills the critical gap between individual rep stats (Level 1) and regional/company-wide stats (Level 4+).

### What Was Built

1. **Backend Service Layer** (`team-reporting-service.ts`)
   - 5 comprehensive reports (Reports 6-10 from RBAC_REPORTING_REQUIREMENTS.md)
   - RBAC-aware data scoping using HierarchicalQueryBuilder
   - Caching layer for performance optimization

2. **API Endpoints** (`team-reports-api.ts`)
   - 6 RESTful endpoints with proper RBAC middleware
   - Permission-based access control
   - Quick stats endpoint for in-module widgets

3. **Frontend Components**
   - TeamStatsWidget: Reusable in-module stats display
   - TeamLeaderboard: Real-time team rankings
   - TeamLeadDashboardNew: Comprehensive dashboard page

---

## 🔐 RBAC Implementation

### Permission Requirements

All endpoints enforce proper RBAC permissions using the `requireAnyPermission` middleware:

| Endpoint                 | Required Permissions                      | Access Level |
| ------------------------ | ----------------------------------------- | ------------ |
| `/pipeline-comparison`   | `sales.pipeline.view_team` (or higher)    | Level 2+     |
| `/activity-leaderboard`  | `sales.activity.view_team` (or higher)    | Level 2+     |
| `/performance-dashboard` | `sales.performance.view_team` (or higher) | Level 3+     |
| `/lead-management`       | `sales.lead.view_team` (or higher)        | Level 3+     |
| `/coaching`              | `sales.coaching.view_team` (or higher)    | Level 3+     |
| `/quick-stats`           | `sales.performance.view_team` (or higher) | Level 2+     |

### Permission Hierarchy

Permissions follow a hierarchical model where higher scopes grant access to lower scopes:

```
platform > company > regional > location > team > own
```

Example:

- User with `sales.pipeline.view_company` can access `/pipeline-comparison`
- User with `sales.pipeline.view_team` can access `/pipeline-comparison`
- User with `sales.pipeline.view_own` **cannot** access `/pipeline-comparison`

### Data Scoping

All queries use `HierarchicalQueryBuilder` to automatically scope data based on user's organizational position:

```typescript
const queryBuilder = new HierarchicalQueryBuilder(userContext);
const accessibleUserIds = await queryBuilder.getAccessibleUserIds();
```

This ensures:

- **Team Leads (Level 2)** see only their direct reports
- **Supervisors (Level 3)** see all team members at their location
- **Managers (Level 4+)** see aggregated data across locations/regions

---

## 📊 Reports Implemented

### Report 6: Team Pipeline Comparison

**Access:** Level 2+ (Team Lead, Senior Sales Rep)
**Permission:** `sales.pipeline.view_team`

**Metrics:**

- Pipeline value per rep
- Weighted pipeline value
- Deal count
- Average deal size
- Pipeline coverage (pipeline / quota ratio)
- Stage distribution per rep

**Business Value:**

- Identify reps with low pipeline coverage
- Balance workload across team
- Forecast team performance

**API:** `GET /api/team-reports/pipeline-comparison`

---

### Report 7: Team Activity Leaderboard

**Access:** Level 2+ (Team Lead, Senior Sales Rep)
**Permission:** `sales.activity.view_team`

**Metrics:**

- Activities by type (calls, emails, meetings, demos, proposals)
- Total activities per rep
- Activity completion rate
- Low activity flags (< 50% of team average)
- Rankings

**Business Value:**

- Identify low activity reps for coaching
- Recognize top performers
- Track team engagement

**API:** `GET /api/team-reports/activity-leaderboard`

---

### Report 8: Team Performance Dashboard

**Access:** Level 3+ (Sales Supervisor)
**Permission:** `sales.performance.view_team`

**Metrics:**

- Team revenue (MTD, QTD, YTD)
- Team quota attainment
- Individual quota attainment for each rep
- Win rate
- Average sales cycle
- Average lead response time

**Business Value:**

- Monitor team progress toward goals
- Identify quota attainment gaps
- Track performance trends

**API:** `GET /api/team-reports/performance-dashboard`

---

### Report 9: Lead Management Report

**Access:** Level 3+ (Sales Supervisor)
**Permission:** `sales.lead.view_team`

**Metrics:**

- Leads created (period)
- Leads by source with conversion rates
- Leads by status
- Overall conversion rate
- Average lead age
- Unassigned leads count
- Overdue follow-ups count

**Business Value:**

- Optimize lead distribution
- Improve lead response time
- Identify best/worst lead sources
- Prevent lead leakage

**API:** `GET /api/team-reports/lead-management`

---

### Report 10: Coaching Report

**Access:** Level 3+ (Sales Supervisor)
**Permission:** `sales.coaching.view_team` OR `sales.performance.view_team`

**Metrics Per Rep:**

- Call volume and talk time
- Meetings held vs planned
- Quote volume and win rate
- Deals stuck (> 30 days in stage)
- Average stage velocity

**Flags:**

- Low activity (< 70% of team average)
- Low conversion (< 70% of team average)
- Deals stuck (> 3 deals)

**Recommendations:**

- Auto-generated coaching suggestions based on flags
- Prioritized by severity (critical, high, medium)

**Business Value:**

- Proactive coaching intervention
- Performance improvement
- Rep development
- Reduce attrition

**API:** `GET /api/team-reports/coaching`

---

## 🎨 Frontend Components

### 1. TeamStatsWidget

**Location:** `client/src/components/stats/TeamStatsWidget.tsx`

**Purpose:** Embeddable widget for displaying quick team stats

**Variants:**

- **Compact:** Minimal view with quota, pipeline, team size
- **Full:** Detailed view with quota progress, pipeline coverage, activity

**Features:**

- Auto-refresh toggle
- Manual refresh button
- Real-time data updates
- RBAC-aware (shows permission errors gracefully)
- Loading states and error handling

**Usage:**

```tsx
// Compact variant (for sidebars)
<TeamStatsWidget variant="compact" />

// Full variant (for dashboards)
<TeamStatsWidget variant="full" showDetails={true} />
```

**RBAC:**

- Requires `sales.performance.view_team` permission
- Shows permission error if user lacks access
- No retry on 403 errors

---

### 2. TeamLeaderboard

**Location:** `client/src/components/stats/TeamLeaderboard.tsx`

**Purpose:** Real-time team rankings across multiple metrics

**Tabs:**

1. **Activity:** Rankings by total activities, with coaching flags
2. **Pipeline:** Rankings by pipeline value and coverage
3. **Quota:** Rankings by quota attainment

**Features:**

- Medal/trophy icons for top 3 performers
- Color-coded status indicators
- Team summary stats below each tab
- Responsive design
- Avatar initials for each rep

**Usage:**

```tsx
<TeamLeaderboard defaultMetric="activity" showCoachingFlags={true} />
```

**RBAC:**

- Fetches data based on selected metric
- Each tab queries different endpoint with appropriate permissions
- Graceful error handling for permission issues

---

### 3. TeamLeadDashboardNew

**Location:** `client/src/pages/dashboards/TeamLeadDashboardNew.tsx`

**Purpose:** Comprehensive dashboard for Team Leads and Supervisors

**Sections:**

1. **Header:** Quick summary cards (team size, coaching needed, leads, health)
2. **Alerts:** Coaching alerts, lead management alerts
3. **Main Grid:**
   - Left: TeamStatsWidget + TeamLeaderboard
   - Right: Coaching priorities + Lead sources
4. **Detailed Tabs:**
   - Team Performance
   - Coaching Details
   - Lead Management

**Features:**

- Refresh all data with one click
- Date range filtering
- Critical alerts at top
- Coaching priority list
- Top performing lead sources
- Detailed coaching recommendations

**RBAC:**

- Requires minimum Level 2 (Team Lead)
- Different tabs may require different permission levels
- Shows only accessible data based on user's scope

---

## 📡 API Endpoints

### Base URL

All endpoints are under `/api/team-reports`

### 1. Pipeline Comparison

```
GET /api/team-reports/pipeline-comparison
```

**Query Parameters:**

- `dateFrom` (optional): ISO date string
- `dateTo` (optional): ISO date string

**Response:**

```json
{
  "teamMembers": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "pipelineValue": 500000,
      "weightedPipelineValue": 300000,
      "dealCount": 15,
      "averageDealSize": 33333,
      "pipelineCoverage": 250,
      "stageDistribution": [
        { "stage": "Discovery", "count": 5, "value": 100000 },
        { "stage": "Proposal", "count": 7, "value": 250000 },
        { "stage": "Negotiation", "count": 3, "value": 150000 }
      ]
    }
  ],
  "summary": {
    "totalPipeline": 500000,
    "totalDeals": 15,
    "averagePipelinePerRep": 500000,
    "teamPipelineCoverage": 250,
    "topPerformer": { ... }
  },
  "teamInfo": {
    "teamLeadId": "uuid",
    "teamLeadName": "Jane Manager",
    "teamSize": 1
  },
  "insights": {
    "pipelineCoverageStatus": "good",
    "topPerformers": [...],
    "lowCoverage": [...],
    "averageCoverage": 250
  }
}
```

---

### 2. Activity Leaderboard

```
GET /api/team-reports/activity-leaderboard
```

**Query Parameters:**

- `dateFrom` (optional): Defaults to 30 days ago
- `dateTo` (optional): Defaults to now

**Response:**

```json
{
  "activities": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "calls": 45,
      "emails": 78,
      "meetings": 12,
      "demos": 5,
      "proposals": 8,
      "totalActivities": 148,
      "completionRate": 85.5,
      "rank": 1,
      "isLowActivity": false
    }
  ],
  "summary": {
    "totalActivities": 148,
    "averagePerRep": 148,
    "topPerformer": { ... },
    "lowPerformers": []
  },
  "insights": {
    "activityTypeBreakdown": { ... },
    "averageCompletionRate": 85.5,
    "coachingNeeded": 0,
    "topPerformer": { ... }
  }
}
```

---

### 3. Performance Dashboard

```
GET /api/team-reports/performance-dashboard
```

**Response:**

```json
{
  "teamRevenue": {
    "mtd": 250000,
    "qtd": 750000,
    "ytd": 2500000
  },
  "teamQuota": {
    "amount": 300000,
    "achieved": 250000,
    "attainment": 83.3,
    "remaining": 50000
  },
  "individualQuotas": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "quota": 100000,
      "achieved": 85000,
      "attainment": 85,
      "onTrack": false
    }
  ],
  "metrics": {
    "teamWinRate": 35.5,
    "averageSalesCycle": 45,
    "averageLeadResponseTime": 2.5
  },
  "insights": {
    "quotaAttainmentStatus": "fair",
    "winRateStatus": "good",
    "repsOnTrack": 0,
    "repsAtRisk": 1,
    "topPerformers": [...],
    "needsAttention": [...]
  }
}
```

---

### 4. Lead Management

```
GET /api/team-reports/lead-management
```

**Response:**

```json
{
  "leadsCreated": 150,
  "leadsBySource": [
    {
      "source": "Website",
      "count": 75,
      "conversionRate": 25.5
    }
  ],
  "leadsByStatus": [
    {
      "status": "lead",
      "count": 100
    },
    {
      "status": "customer",
      "count": 50
    }
  ],
  "conversionMetrics": {
    "overallConversionRate": 25.5,
    "averageLeadAge": 15,
    "leadsUnassigned": 5,
    "leadsOverdueForFollowup": 10
  },
  "leadFunnel": [],
  "insights": {
    "conversionHealth": "healthy",
    "responseTimeHealth": "excellent",
    "urgentActions": {
      "unassignedLeads": 5,
      "overdueFollowups": 10,
      "total": 15
    },
    "topSources": [...],
    "worstConvertingSources": [...]
  }
}
```

---

### 5. Coaching Report

```
GET /api/team-reports/coaching
```

**Response:**

```json
{
  "opportunities": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "flags": {
        "lowActivity": true,
        "lowConversion": false,
        "dealsStuck": true
      },
      "metrics": {
        "callVolume": 20,
        "callTalkTime": 15.5,
        "meetingsHeld": 5,
        "meetingsPlanned": 8,
        "quoteVolume": 10,
        "quoteWinRate": 40,
        "dealsStuck": 4,
        "avgStageVelocity": 30
      },
      "recommendations": [
        "Increase daily call volume to match team average",
        "Focus on moving stale opportunities forward or disqualifying"
      ],
      "priority": "critical"
    }
  ],
  "summary": {
    "totalReps": 5,
    "needsAttention": 2,
    "criticalFlags": 3,
    "improvementAreas": [
      {
        "area": "Low Activity",
        "affectedReps": 1
      },
      {
        "area": "Stuck Deals",
        "affectedReps": 1
      }
    ]
  },
  "insights": {
    "criticalReps": 1,
    "highPriorityReps": 1,
    "mostCommonIssue": { ... },
    "coachingPriority": [...]
  }
}
```

---

### 6. Quick Stats (For Widgets)

```
GET /api/team-reports/quick-stats
```

**Purpose:** Lightweight endpoint for in-module widgets

**Response:**

```json
{
  "pipeline": {
    "totalValue": 500000,
    "totalDeals": 15,
    "coverage": 250,
    "topRep": "John Doe"
  },
  "performance": {
    "quotaAttainment": 83.3,
    "revenue": 250000,
    "winRate": 35.5,
    "repsOnTrack": 3,
    "totalReps": 5
  },
  "activity": {
    "totalActivities": 740,
    "averagePerRep": 148,
    "topRep": "Jane Smith",
    "lowPerformers": 1
  },
  "teamSize": 5
}
```

---

### 7. Clear Cache

```
POST /api/team-reports/clear-cache
```

**Access:** Level 4+ (Manager)
**Permission:** `sales.reports.manage`

**Body:**

```json
{
  "pattern": "team-pipeline" // Optional
}
```

---

## 🎯 Use Cases

### 1. Sales Supervisor Daily Routine

**Morning:**

1. Open Team Lead Dashboard
2. Check coaching alerts (critical reps)
3. Review unassigned leads and overdue follow-ups
4. Check team quota attainment

**Throughout Day:** 5. Monitor activity leaderboard (embedded widget in opportunities page) 6. Check pipeline coverage for each rep 7. Address low activity flags

**End of Day:** 8. Review daily metrics 9. Plan next day's coaching sessions

---

### 2. Team Lead Coaching Session

**Preparation:**

1. Open Coaching Report tab
2. Review rep's flags and metrics
3. Read auto-generated recommendations

**During Session:** 4. Discuss specific metrics (calls, meetings, quote win rate) 5. Address stuck deals 6. Set action items based on recommendations

**Follow-up:** 7. Monitor rep's activity leaderboard ranking 8. Track improvement over next 30 days

---

### 3. Manager Reviewing Team Lead Performance

**Weekly Review:**

1. Compare team pipeline coverage across all teams
2. Review team quota attainment
3. Identify teams needing support
4. Check lead conversion rates by team

---

## 🔄 Caching Strategy

### Cache Configuration

All reports use an in-memory caching layer with the following settings:

- **Default TTL:** 5 minutes
- **Cache Key:** Includes user ID and query parameters
- **Invalidation:** Manual via `/clear-cache` endpoint

### Cache Behavior

```typescript
// Example cache key format
`team-pipeline:${userId}:${JSON.stringify(dateRange)}`;
```

**Benefits:**

- Reduces database load
- Faster response times
- Scales better under high concurrency

**Limitations:**

- Data may be up to 5 minutes stale
- Cache cleared on server restart
- No distributed caching (yet)

---

## 🚀 Performance Optimizations

### Database Queries

1. **Parallel Execution:**

   ```typescript
   const [pipelineData, performanceData, activityData] = await Promise.all([...]);
   ```

2. **Indexed Columns:**
   - `opportunities.owner_id`
   - `opportunities.tenant_id`
   - `opportunities.stage`
   - `activities.user_id`
   - `activities.created_at`

3. **Aggregations:**
   - Use SQL aggregations instead of application-level loops
   - Minimize data transferred from database

### Frontend

1. **Code Splitting:**
   - Dashboard components loaded on-demand
   - Reduces initial bundle size

2. **Query Deduplication:**
   - TanStack Query automatically deduplicates identical requests

3. **Optimistic Updates:**
   - Quick stats widget supports auto-refresh
   - Manual refresh doesn't block UI

---

## 🧪 Testing Guide

### Manual Testing by Role Level

#### Level 1 (Sales Rep) - Should NOT Have Access

```bash
# Expected: 403 Forbidden or permission error
curl -X GET http://localhost:5000/api/team-reports/quick-stats \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: Permission denied

---

#### Level 2 (Team Lead) - Should Have Basic Access

```bash
# Should work: Pipeline comparison
curl -X GET http://localhost:5000/api/team-reports/pipeline-comparison \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"

# Should work: Activity leaderboard
curl -X GET http://localhost:5000/api/team-reports/activity-leaderboard \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"

# Should work: Quick stats
curl -X GET http://localhost:5000/api/team-reports/quick-stats \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 200 OK with data scoped to their direct reports

---

#### Level 3 (Supervisor) - Should Have Full Access

```bash
# Should work: All Level 2 endpoints PLUS:

# Performance dashboard
curl -X GET http://localhost:5000/api/team-reports/performance-dashboard \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"

# Lead management
curl -X GET http://localhost:5000/api/team-reports/lead-management \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"

# Coaching report
curl -X GET http://localhost:5000/api/team-reports/coaching \
  -H "Cookie: connect.sid=<session>" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 200 OK with data scoped to their location

---

#### Level 4+ (Manager) - Should Have All Access + Cache Management

```bash
# Should work: All Level 3 endpoints PLUS:

# Clear cache
curl -X POST http://localhost:5000/api/team-reports/clear-cache \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "team-pipeline"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 200 OK with success message

---

### Data Validation Tests

#### 1. Team Size Consistency

```sql
-- Should match across all endpoints
SELECT teamSize FROM quick_stats;
SELECT teamInfo.teamSize FROM pipeline_comparison;
SELECT COUNT(DISTINCT userId) FROM activity_leaderboard;
```

#### 2. Quota Attainment Calculation

```sql
-- Verify formula: (achieved / quota) * 100
SELECT
  quota,
  achieved,
  attainment,
  ((achieved / quota) * 100) as calculated_attainment
FROM performance_dashboard.individualQuotas;
```

#### 3. Pipeline Coverage

```sql
-- Verify formula: (pipeline / quota) * 100
SELECT
  pipelineValue,
  quota,
  pipelineCoverage,
  ((pipelineValue / quota) * 100) as calculated_coverage
FROM pipeline_comparison.teamMembers;
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Permission Denied" Errors

**Symptom:** 403 errors or "You do not have permission" messages

**Cause:** User lacks required permission

**Solution:**

1. Check user's role level: `SELECT role_level FROM users WHERE id = ?`
2. Check user's permissions: `SELECT * FROM user_permissions WHERE user_id = ?`
3. Verify permission hierarchy in RBAC middleware
4. Ensure permission seeding ran: `npm run seed:rbac`

---

#### 2. Empty Data / No Team Members

**Symptom:** `teamSize: 0`, empty arrays

**Cause:** HierarchicalQueryBuilder returns no accessible user IDs

**Solution:**

1. Check organizational hierarchy:
   ```sql
   SELECT * FROM organizational_units WHERE id = <user's unit>
   ```
2. Verify nested set model (lft, rght values):
   ```sql
   SELECT id, name, lft, rght, depth FROM organizational_units;
   ```
3. Check user assignments:
   ```sql
   SELECT * FROM users WHERE organizational_unit_id IN (<accessible units>)
   ```

---

#### 3. Stale Cache Data

**Symptom:** Data not updating after changes

**Cause:** Cache TTL hasn't expired

**Solution:**

1. Wait 5 minutes for automatic expiration
2. OR manually clear cache:
   ```bash
   curl -X POST /api/team-reports/clear-cache \
     -H "Cookie: ..." \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
3. OR restart server (clears all cache)

---

#### 4. Slow Query Performance

**Symptom:** Requests taking > 2 seconds

**Cause:** Missing indexes or inefficient queries

**Solution:**

1. Check query explain plan:
   ```sql
   EXPLAIN ANALYZE <query>
   ```
2. Add missing indexes (see schema documentation)
3. Reduce date range
4. Optimize SQL queries in service layer

---

## 📈 Next Steps (Phase 2)

### In-Module Stats Integration

Embed `TeamStatsWidget` into existing pages:

1. **Opportunities Page**
   - Add compact widget to sidebar
   - Show team pipeline coverage
   - Link to full dashboard

2. **Deals Page**
   - Add quota attainment widget
   - Show team progress to goal
   - Highlight reps at risk

3. **Leads Page**
   - Add lead distribution widget
   - Show conversion rates
   - Alert on unassigned leads

4. **Dashboard Page**
   - Add TeamLeaderboard widget
   - Show real-time rankings
   - Coaching alerts

---

### Service & Operations Teams (Phase 3)

Apply same pattern to other departments:

1. **Service Team Stats**
   - Technician productivity
   - Ticket completion rates
   - SLA compliance by team
   - First-time fix rates

2. **Warehouse Team Stats**
   - FPY (First Pass Yield) by team
   - Productivity metrics
   - Accuracy rates
   - Kitting performance

---

### Advanced Features (Phase 4)

1. **Trend Analysis**
   - Week-over-week comparison
   - Month-over-month trends
   - Seasonality detection

2. **Forecasting**
   - Team quota attainment forecast
   - Pipeline health predictions
   - Activity trend projections

3. **Alerts & Notifications**
   - Slack/email alerts for coaching flags
   - Daily digest for supervisors
   - Real-time notifications for critical issues

4. **Export & Scheduling**
   - PDF/Excel export of reports
   - Scheduled email delivery
   - Integration with reporting engine

---

## ✅ Checklist

### Deployment Readiness

- [x] Backend service layer implemented
- [x] API endpoints with RBAC middleware
- [x] Routes registered in server
- [x] Frontend components created
- [x] Dashboard page implemented
- [x] Error handling implemented
- [x] Caching implemented
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Performance testing
- [ ] Load testing
- [ ] Documentation complete
- [ ] Code review completed
- [ ] Deployed to staging
- [ ] User acceptance testing
- [ ] Deployed to production

---

## 📚 Related Documentation

- [RBAC_REPORTING_REQUIREMENTS.md](./RBAC_REPORTING_REQUIREMENTS.md) - Full report specifications
- [RBAC_IMPLEMENTATION_PLAN.md](./RBAC_IMPLEMENTATION_PLAN.md) - Implementation roadmap
- [RBAC_FUNCTIONALITY_MATRIX.md](./RBAC_FUNCTIONALITY_MATRIX.md) - Permission matrix
- [Enhanced RBAC Guide](./ENHANCED_RBAC_GUIDE.md) - RBAC system architecture

---

## 🎓 Key Learnings

1. **RBAC First:** Always implement permission checks before writing business logic
2. **Data Scoping:** Use HierarchicalQueryBuilder consistently for all team queries
3. **Caching:** 5-minute TTL strikes good balance between freshness and performance
4. **Widget Pattern:** Reusable widgets > page-specific components
5. **Progressive Disclosure:** Show summary stats first, details on demand
6. **Error Boundaries:** Gracefully handle permission errors in UI
7. **Parallel Queries:** Fetch independent data in parallel for performance
8. **Type Safety:** Strong typing catches errors early

---

**Implementation By:** Claude
**Review By:** [Team Lead Name]
**Approved By:** [Manager Name]
**Date Approved:** [Date]

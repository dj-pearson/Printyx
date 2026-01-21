# RBAC Implementation Plan - Role-Based Reporting Structure

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Implementation Roadmap

## Executive Summary

This document provides a **comprehensive implementation plan** for building out the role-based reporting structure for Printyx. The implementation is organized into phases over a 12-week period.

**Goals:**

1. Consolidate to enhanced RBAC system
2. Seed role definitions and permissions for all dealer sizes
3. Build 75+ role-based reports
4. Create department-specific dashboards
5. Implement default dashboard layouts per role
6. Enforce RBAC middleware across all routes

---

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Phase 1: Foundation (Weeks 1-2)](#phase-1-foundation-weeks-1-2)
3. [Phase 2: Core Reports & Dashboards (Weeks 3-6)](#phase-2-core-reports--dashboards-weeks-3-6)
4. [Phase 3: Advanced Reports (Weeks 7-10)](#phase-3-advanced-reports-weeks-7-10)
5. [Phase 4: Refinement & Launch (Weeks 11-12)](#phase-4-refinement--launch-weeks-11-12)
6. [Technical Implementation Details](#technical-implementation-details)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Plan](#deployment-plan)

---

## Prerequisites & Setup

### Required Resources

**Development Team:**

- 1 Backend Developer (full-time)
- 1 Frontend Developer (full-time)
- 1 Database Developer (part-time, weeks 1-2)
- 1 QA Engineer (part-time, weeks 8-12)
- 1 Technical Writer (part-time, weeks 10-12)

**Infrastructure:**

- Development environment (existing)
- Staging environment (should match production)
- Test database with realistic data
- CI/CD pipeline (for automated testing)

**Documentation Review:**

- RBAC_CURRENT_STATE.md ✅
- RBAC_IDEAL_STRUCTURE.md ✅
- RBAC_FUNCTIONALITY_MATRIX.md ✅
- RBAC_REPORTING_REQUIREMENTS.md ✅

---

## Phase 1: Foundation (Weeks 1-2)

**Goal:** Consolidate RBAC systems, seed roles and permissions, establish reporting infrastructure

### Week 1: RBAC System Consolidation

#### Task 1.1: Audit All Routes for RBAC Usage

**Assigned to:** Backend Developer
**Duration:** 2 days

**Steps:**

1. Create spreadsheet listing all API routes
2. Document which RBAC system each route uses (legacy vs enhanced)
3. Document which routes have NO RBAC enforcement
4. Prioritize routes by risk (highest: financial, user management, admin)

**Deliverables:**

- `docs/ROUTE_RBAC_AUDIT.xlsx` - Complete route inventory
- List of high-risk routes requiring immediate attention

---

#### Task 1.2: Create Enhanced RBAC Seeder

**Assigned to:** Backend Developer
**Duration:** 3 days

**Steps:**

1. Consolidate existing seeders into single source of truth
2. Create `server/database-updater/seeders/rbac-seeder.ts`
3. Define all 8 role levels with proper hierarchy
4. Define all 200+ granular permissions
5. Create role-permission mappings for each role template
6. Create organizational unit seeders (company, region, location)

**Seed Data Requirements:**

**Role Templates to Create:**

- Platform Admin
- CEO/President
- CFO, COO, VP Sales, VP Service
- Regional Sales Director, Regional Service Manager
- Sales Manager, Service Manager, Operations Manager, Finance Manager
- Sales Supervisor, Service Supervisor, Warehouse Supervisor
- Senior Sales Rep, Senior Technician
- Sales Rep, Field Technician, Warehouse Associate, Accounting Clerk

**Permission Categories:**

- Sales: lead._, opportunity._, quote._, customer._, territory._, commission._
- Service: ticket._, workorder._, equipment._, parts._, schedule.\*
- Operations: inventory._, warehouse._, purchasing._, logistics._
- Finance: ar._, ap._, gl._, financial_reports._
- Admin: user._, role._, settings._, audit._
- Platform: platform.\*

**Deliverables:**

- `server/database-updater/seeders/rbac-seeder.ts`
- Seeder execution script: `npm run seed:rbac`
- Documentation: `docs/RBAC_SEEDER_GUIDE.md`

---

#### Task 1.3: Seed Report Definitions

**Assigned to:** Backend Developer
**Duration:** 2 days

**Steps:**

1. Create report definition seeder: `server/database-updater/seeders/report-seeder.ts`
2. Seed all 75 reports from RBAC_REPORTING_REQUIREMENTS.md
3. Create report categories (sales, service, operations, finance, executive, platform)
4. Define report access levels (minimum role level required)
5. Define report scopes (own, team, location, regional, company, platform)

**Report Definition Schema:**

```typescript
{
  code: "personal_pipeline",
  name: "Personal Pipeline Report",
  description: "Individual sales rep pipeline overview",
  category: "sales",
  minimumLevel: 1, // Available to Level 1+
  scope: "own",
  permissions: ["sales.opportunity.view_own"],
  metrics: ["pipeline_value", "opportunity_count", "weighted_value"],
  filters: ["date_range", "product_category", "stage"],
  visualizations: ["funnel", "bar_chart", "line_chart"],
  canExport: false, // Level 1 cannot export
  canSchedule: false
}
```

**Deliverables:**

- `server/database-updater/seeders/report-seeder.ts`
- Seeder execution script: `npm run seed:reports`
- All 75 report definitions seeded in database

---

#### Task 1.4: Seed KPI Definitions

**Assigned to:** Backend Developer
**Duration:** 1 day

**Steps:**

1. Create KPI definition seeder: `server/database-updater/seeders/kpi-seeder.ts`
2. Define KPIs for each department
3. Set KPI thresholds (red/yellow/green)
4. Define KPI calculations (formulas, aggregations)

**KPI Examples:**

**Sales KPIs:**

- `quota_attainment`: (actual_revenue / quota) \* 100
- `win_rate`: (won_deals / (won_deals + lost_deals)) \* 100
- `pipeline_coverage`: pipeline_value / quota
- `average_deal_size`: total_revenue / deal_count
- `sales_cycle_days`: avg(close_date - create_date)

**Service KPIs:**

- `sla_compliance`: (tickets_within_sla / total_tickets) \* 100
- `first_time_fix`: (tickets_fixed_first_visit / total_tickets) \* 100
- `csat`: avg(customer_satisfaction_score)
- `utilization_rate`: (billable_hours / total_hours) \* 100
- `avg_resolution_time`: avg(close_date - create_date)

**Deliverables:**

- `server/database-updater/seeders/kpi-seeder.ts`
- All department KPI definitions seeded

---

### Week 2: Middleware & Infrastructure

#### Task 2.1: Create Enhanced RBAC Middleware

**Assigned to:** Backend Developer
**Duration:** 2 days

**Steps:**

1. Create unified middleware: `server/middleware/enhanced-rbac-middleware.ts`
2. Implement `requirePermission(permission: string | string[])` - Check single or multiple permissions
3. Implement `requireLevel(level: number)` - Check minimum role level
4. Implement `requireScope(scope: string)` - Check organizational scope
5. Implement permission caching (L1 memory cache)
6. Add detailed error messages with permission requirements
7. Add audit logging for failed permission checks

**Middleware Functions:**

```typescript
// Check single permission
requirePermission('sales.lead.view_team');

// Check multiple permissions (ANY)
requirePermission(['sales.lead.view_team', 'sales.lead.view_location']);

// Check multiple permissions (ALL)
requireAllPermissions(['sales.quote.create', 'sales.quote.approve_standard']);

// Check minimum level
requireLevel(4); // Manager or higher

// Check scope
requireScope('location'); // User must have location-level access or higher

// Combined checks
requirePermission('sales.report.view', { minLevel: 3, minScope: 'team' });
```

**Deliverables:**

- `server/middleware/enhanced-rbac-middleware.ts`
- Unit tests for middleware
- Documentation: `docs/RBAC_MIDDLEWARE_GUIDE.md`

---

#### Task 2.2: Create Hierarchical Query Builder

**Assigned to:** Backend Developer
**Duration:** 2 days

**Steps:**

1. Enhance `server/reporting-rbac-middleware.ts`
2. Implement automatic data filtering based on user's organizational position
3. Support nested set queries for organizational units
4. Implement scope-based WHERE clause injection

**Query Builder Functions:**

```typescript
// Automatically filters to user's scope
async function getScopedData(user, entity, baseQuery) {
  const scope = await getUserScope(user);

  switch (scope.level) {
    case 'own':
      return baseQuery.where(eq(entity.userId, user.id));
    case 'team':
      const teamUserIds = await getTeamUserIds(user);
      return baseQuery.where(inArray(entity.userId, teamUserIds));
    case 'location':
      return baseQuery.where(eq(entity.locationId, user.locationId));
    case 'regional':
      const locationIds = await getRegionalLocationIds(user.regionId);
      return baseQuery.where(inArray(entity.locationId, locationIds));
    case 'company':
      return baseQuery.where(eq(entity.tenantId, user.tenantId));
    case 'platform':
      return baseQuery; // No filtering
  }
}
```

**Deliverables:**

- Enhanced hierarchical query builder
- Helper functions for scope resolution
- Unit tests

---

#### Task 2.3: Create Report Engine API

**Assigned to:** Backend Developer
**Duration:** 2 days

**Steps:**

1. Create `server/routes/reporting-api.ts`
2. Implement generic report execution endpoint
3. Support dynamic filtering, sorting, pagination
4. Implement report export (PDF, Excel, CSV)
5. Implement report scheduling (background jobs)

**API Endpoints:**

```
GET  /api/reports                     - List available reports (based on user permissions)
GET  /api/reports/:code               - Get report definition
POST /api/reports/:code/execute       - Execute report (with filters)
POST /api/reports/:code/export        - Export report (format: pdf, excel, csv)
POST /api/reports/:code/schedule      - Schedule recurring report
GET  /api/reports/scheduled           - Get user's scheduled reports
DELETE /api/reports/scheduled/:id     - Delete scheduled report
```

**Report Execution Request:**

```json
{
  "filters": {
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "productCategory": "Copiers",
    "stage": ["Discovery", "Proposal"]
  },
  "sort": {
    "field": "value",
    "direction": "desc"
  },
  "pagination": {
    "page": 1,
    "limit": 50
  }
}
```

**Deliverables:**

- `server/routes/reporting-api.ts`
- Report execution engine
- Export functionality (PDF, Excel, CSV)
- Scheduling infrastructure

---

#### Task 2.4: Update CLAUDE.md Documentation

**Assigned to:** Backend Developer
**Duration:** 1 day

**Steps:**

1. Document enhanced RBAC system in CLAUDE.md
2. Add permission reference table
3. Document middleware usage patterns
4. Add examples for common scenarios
5. Document report system architecture

**Deliverables:**

- Updated `CLAUDE.md` with RBAC documentation

---

### Week 2 End-of-Phase Deliverables

✅ Enhanced RBAC system fully implemented
✅ All routes audited for RBAC compliance
✅ Roles, permissions, reports, KPIs seeded in database
✅ RBAC middleware created and tested
✅ Report engine API created
✅ Documentation updated

---

## Phase 2: Core Reports & Dashboards (Weeks 3-6)

**Goal:** Build critical reports and dashboards for Levels 1-4 (individual contributors to managers)

### Week 3: Level 1 & 2 Reports (Individual Contributors & Team Leads)

#### Task 3.1: Build Sales Rep Reports (Reports 1-7)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement report logic for Reports 1-5:
   - Personal Pipeline Report
   - Personal Activity Report
   - Personal Quota Attainment
   - Personal Commission Report
   - Personal Leaderboard Position
2. Add report SQL queries in `server/services/sales-reporting-service.ts`
3. Implement data aggregations
4. Add caching for performance

**Frontend:**

1. Create Sales Rep Dashboard: `client/src/pages/dashboards/SalesRepDashboard.tsx`
2. Build report components:
   - `PipelineFunnel.tsx` - Funnel visualization
   - `QuotaGauge.tsx` - Circular gauge
   - `ActivityChart.tsx` - Bar chart
   - `LeaderboardTable.tsx` - Sortable table
3. Implement real-time data refresh
4. Add loading states and error handling

**Deliverables:**

- Backend report services
- Frontend dashboard and components
- Unit tests (backend)
- Component tests (frontend)

---

#### Task 3.2: Build Technician Reports (Reports 25-28)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement service technician report logic:
   - Personal Productivity Report
   - Personal Schedule Report
   - Personal Parts Usage Report
2. Add in `server/services/service-reporting-service.ts`

**Frontend:**

1. Create Technician Dashboard: `client/src/pages/dashboards/TechnicianDashboard.tsx`
2. Build mobile-optimized components:
   - `TechScheduleView.tsx` - Calendar view
   - `ProductivityMetrics.tsx` - Metric cards
   - `PartsUsageChart.tsx` - Bar chart
3. Implement GPS check-in integration

**Deliverables:**

- Backend service reports
- Mobile-optimized technician dashboard
- Tests

---

#### Task 3.3: Build Team Lead Reports (Reports 6-7, 28)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement team comparison reports:
   - Team Pipeline Comparison
   - Team Activity Leaderboard
   - Team Workload Report

**Frontend:**

1. Enhance dashboards with team views
2. Add team comparison charts
3. Implement drill-down to individual rep details

**Deliverables:**

- Team lead reports
- Enhanced dashboards
- Tests

---

### Week 4: Level 3 Reports (Supervisors)

#### Task 4.1: Build Sales Supervisor Reports (Reports 8-10)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement supervisor reports:
   - Team Performance Dashboard
   - Lead Management Report
   - Coaching Report
2. Add location-level aggregations

**Frontend:**

1. Create Sales Supervisor Dashboard: `client/src/pages/dashboards/SalesSupervisorDashboard.tsx`
2. Build supervisor-specific components:
   - `TeamPerformanceTable.tsx`
   - `LeadFunnel.tsx`
   - `CoachingAlerts.tsx`
3. Add export buttons (Excel, PDF)

**Deliverables:**

- Sales supervisor reports
- Supervisor dashboard
- Tests

---

#### Task 4.2: Build Service Supervisor Reports (Reports 29-31)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement service supervisor reports:
   - Team Productivity Report
   - SLA Compliance Report
   - Dispatch Efficiency Report

**Frontend:**

1. Create Service Supervisor Dashboard: `client/src/pages/dashboards/ServiceSupervisorDashboard.tsx`
2. Build components:
   - `TeamProductivityChart.tsx`
   - `SLAComplianceGauge.tsx`
   - `DispatchMapView.tsx` (if GPS available)
3. Add real-time ticket updates

**Deliverables:**

- Service supervisor reports
- Supervisor dashboard
- Tests

---

#### Task 4.3: Build Operations Supervisor Reports (Reports 45-47)

**Assigned to:** Backend + Frontend Developers
**Duration:** 1 day

**Backend:**

1. Implement warehouse supervisor reports:
   - Team Productivity Report (Warehouse)
   - Inventory Accuracy Report
   - FPY Report

**Frontend:**

1. Create Warehouse Supervisor Dashboard
2. Build warehouse-specific components
3. Add FPY charts and alerts

**Deliverables:**

- Warehouse supervisor reports
- Dashboard
- Tests

---

### Weeks 5-6: Level 4 Reports (Managers)

#### Task 5.1: Build Sales Manager Reports (Reports 11-15)

**Assigned to:** Backend + Frontend Developers (Pair)
**Duration:** 5 days

**Backend:**

1. Implement manager reports:
   - Location Sales Performance Report
   - Sales Forecasting Report
   - Win/Loss Analysis Report
   - Territory Performance Report
   - Product Mix Report
2. Implement forecasting algorithms (weighted pipeline, historical win rates)
3. Add regional comparison data (read-only)

**Frontend:**

1. Create Sales Manager Dashboard: `client/src/pages/dashboards/SalesManagerDashboard.tsx`
2. Build advanced components:
   - `ForecastWaterfall.tsx` - Waterfall chart
   - `WinLossAnalysis.tsx` - Comparison charts
   - `TerritoryMap.tsx` - Geographic visualization
   - `ProductMixPie.tsx` - Pie/donut charts
3. Implement custom dashboard builder (drag-and-drop widgets)
4. Add report scheduling UI

**Deliverables:**

- Sales manager reports
- Manager dashboard with customization
- Tests

---

#### Task 5.2: Build Service Manager Reports (Reports 32-36)

**Assigned to:** Backend + Frontend Developers
**Duration:** 5 days

**Backend:**

1. Implement service manager reports:
   - Location Service Performance Report
   - Technician Performance Report
   - Service Profitability Report
   - Equipment Health Report
   - Parts Usage & Cost Report
2. Calculate service profitability (revenue - labor costs - parts costs)
3. Add equipment health scoring

**Frontend:**

1. Create Service Manager Dashboard: `client/src/pages/dashboards/ServiceManagerDashboard.tsx`
2. Build components:
   - `ServiceProfitabilityChart.tsx`
   - `TechnicianScorecard.tsx`
   - `EquipmentHealthMap.tsx`
   - `PartsEfficiencyChart.tsx`
3. Add drill-down capabilities

**Deliverables:**

- Service manager reports
- Dashboard
- Tests

---

#### Task 5.3: Build Operations Manager Reports (Reports 48-51)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement operations manager reports:
   - Warehouse Performance Report
   - Inventory Valuation Report
   - Purchase Order Report
   - Logistics & Delivery Report
2. Calculate inventory metrics (turns, carrying cost, aging)

**Frontend:**

1. Create Operations Manager Dashboard: `client/src/pages/dashboards/OperationsManagerDashboard.tsx`
2. Build components:
   - `InventoryValueBreakdown.tsx`
   - `POAgingChart.tsx`
   - `DeliveryPerformance.tsx`

**Deliverables:**

- Operations manager reports
- Dashboard
- Tests

---

#### Task 5.4: Build Finance Manager Reports (Reports 56-60)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement finance manager reports:
   - AR Aging Report
   - AP Aging Report
   - Cash Flow Report
   - Financial Statements (P&L, Balance Sheet)
   - Budget vs Actual Report
2. Integrate with accounting system (QuickBooks if applicable)
3. Implement financial calculations

**Frontend:**

1. Create Finance Manager Dashboard: `client/src/pages/dashboards/FinanceManagerDashboard.tsx`
2. Build components:
   - `ARAgingTable.tsx`
   - `CashFlowWaterfall.tsx`
   - `FinancialStatements.tsx`
   - `BudgetVarianceChart.tsx`

**Deliverables:**

- Finance manager reports
- Dashboard
- Tests

---

### Week 6 End-of-Phase Deliverables

✅ All Level 1-4 reports implemented (Reports 1-60)
✅ Dashboards created for all roles (Sales Rep → Manager)
✅ Export functionality working (Excel, PDF, CSV)
✅ Report scheduling implemented
✅ Mobile-optimized views for field staff

---

## Phase 3: Advanced Reports (Weeks 7-10)

**Goal:** Build regional, executive, and platform reports (Levels 5-8)

### Week 7: Level 5 Reports (Regional Managers)

#### Task 7.1: Build Regional Sales Reports (Reports 16-19)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement regional sales reports:
   - Regional Sales Performance Report
   - Location Comparison Report
   - Regional Forecasting Report
   - Market Share Analysis Report
2. Aggregate data across multiple locations
3. Implement cross-location analytics

**Frontend:**

1. Create Regional Sales Director Dashboard: `client/src/pages/dashboards/RegionalSalesDirectorDashboard.tsx`
2. Build components:
   - `LocationComparisonTable.tsx`
   - `RegionalForecastChart.tsx`
   - `MarketSharePie.tsx`
3. Add heat maps for location performance

**Deliverables:**

- Regional sales reports
- Dashboard
- Tests

---

#### Task 7.2: Build Regional Service Reports (Reports 37-39)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement regional service reports:
   - Regional Service Performance Report
   - Location Comparison Report (Service)
   - Regional Capacity Planning Report

**Frontend:**

1. Create Regional Service Manager Dashboard
2. Build regional service components
3. Add capacity planning visualizations

**Deliverables:**

- Regional service reports
- Dashboard
- Tests

---

#### Task 7.3: Build Regional Operations Reports (Reports 52-53)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement regional operations reports:
   - Regional Operations Performance Report
   - Supply Chain Report

**Frontend:**

1. Create Regional Operations Dashboard
2. Build supply chain components

**Deliverables:**

- Regional operations reports
- Dashboard
- Tests

---

### Weeks 8-9: Level 6-7 Reports (Directors & Executives)

#### Task 8.1: Build Executive Sales Reports (Reports 20-24)

**Assigned to:** Backend + Frontend Developers
**Duration:** 4 days

**Backend:**

1. Implement company-wide sales reports:
   - Executive Sales Dashboard
   - Company-Wide Sales Analytics Report
   - Sales Team Effectiveness Report
   - Strategic Account Report
   - Board-Level Sales Report
2. Implement advanced analytics (cohort analysis, CLV trends)
3. Create board-ready report templates (PDF, PowerPoint)

**Frontend:**

1. Create VP Sales Dashboard: `client/src/pages/dashboards/VPSalesDashboard.tsx`
2. Build executive components:
   - `ExecutiveSalesKPIs.tsx` - KPI cards with trends
   - `SalesAnalyticsDashboard.tsx` - Multi-dimensional analytics
   - `StrategicAccountsView.tsx` - Account portfolio
3. Implement PowerPoint export

**Deliverables:**

- Executive sales reports
- VP Sales dashboard
- Board report templates
- Tests

---

#### Task 8.2: Build Executive Service Reports (Reports 40-43)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement company-wide service reports:
   - Executive Service Dashboard
   - Company-Wide Service Analytics Report
   - Service Quality Report
   - Board-Level Service Report

**Frontend:**

1. Create VP Service Dashboard: `client/src/pages/dashboards/VPServiceDashboard.tsx`
2. Build executive service components
3. Add service quality analytics

**Deliverables:**

- Executive service reports
- VP Service dashboard
- Tests

---

#### Task 8.3: Build Executive Operations Reports (Report 54)

**Assigned to:** Backend + Frontend Developers
**Duration:** 1 day

**Backend:**

1. Implement Executive Operations Dashboard

**Frontend:**

1. Create COO Dashboard: `client/src/pages/dashboards/COODashboard.tsx`

**Deliverables:**

- COO dashboard
- Tests

---

#### Task 8.4: Build CFO Reports (Reports 61-64)

**Assigned to:** Backend + Frontend Developers
**Duration:** 4 days

**Backend:**

1. Implement CFO reports:
   - Executive Financial Dashboard
   - Profitability Analysis Report
   - KPI Scorecard (Financial)
   - Board-Level Financial Report
2. Implement financial analytics (ROA, current ratio, quick ratio, DSO, DPO)
3. Create board-ready financial templates

**Frontend:**

1. Create CFO Dashboard: `client/src/pages/dashboards/CFODashboard.tsx`
2. Build financial components:
   - `FinancialKPIScorecard.tsx`
   - `ProfitabilityMatrix.tsx`
   - `FinancialTrends.tsx`

**Deliverables:**

- CFO reports
- CFO dashboard
- Tests

---

#### Task 8.5: Build CEO Reports (Reports 65-68)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement CEO reports:
   - Executive Summary Dashboard
   - Company Performance Report
   - Strategic KPI Report
   - Board Report

**Frontend:**

1. Create CEO Dashboard: `client/src/pages/dashboards/CEODashboard.tsx`
2. Build comprehensive executive view
3. Integrate all department metrics

**Deliverables:**

- CEO reports and dashboard
- Tests

---

### Week 10: Platform Admin Reports (Level 8)

#### Task 10.1: Build Platform Admin Reports (Reports 69-72)

**Assigned to:** Backend + Frontend Developers
**Duration:** 3 days

**Backend:**

1. Implement platform reports:
   - Platform System Metrics
   - Tenant Usage Report
   - Platform Billing Report
   - Security & Audit Report
2. Add cross-tenant analytics (privacy-safe aggregations)

**Frontend:**

1. Create Platform Admin Dashboard: `client/src/pages/dashboards/PlatformAdminDashboard.tsx`
2. Build platform monitoring components
3. Add tenant drill-down

**Deliverables:**

- Platform admin reports
- Admin dashboard
- Tests

---

#### Task 10.2: Build Cross-Department Reports (Reports 73-75)

**Assigned to:** Backend + Frontend Developers
**Duration:** 2 days

**Backend:**

1. Implement cross-department reports:
   - Customer 360 Report
   - Employee Performance Report
   - Location Performance Report (Multi-Department)
2. Aggregate data from all departments

**Frontend:**

1. Create Customer 360 view
2. Create employee performance view
3. Create multi-department location view

**Deliverables:**

- Cross-department reports
- Integrated views
- Tests

---

### Week 10 End-of-Phase Deliverables

✅ All 75 reports implemented
✅ All dashboards created (Levels 1-8)
✅ Advanced analytics implemented
✅ Board-ready report templates created
✅ Platform admin tools built

---

## Phase 4: Refinement & Launch (Weeks 11-12)

**Goal:** Polish, test, document, and launch

### Week 11: Testing & Bug Fixes

#### Task 11.1: Comprehensive Testing

**Assigned to:** QA Engineer + Developers
**Duration:** 5 days

**Testing Activities:**

1. **Unit Testing**
   - All report services (backend)
   - All dashboard components (frontend)
   - Middleware functions
   - Query builders

2. **Integration Testing**
   - End-to-end report execution
   - Export functionality (PDF, Excel, CSV, PowerPoint)
   - Scheduling functionality
   - Permission enforcement

3. **Permission Testing**
   - Test each role level can access appropriate reports
   - Test each role level CANNOT access restricted reports
   - Test data scoping (own, team, location, regional, company, platform)
   - Test export restrictions
   - Test scheduling restrictions

4. **Performance Testing**
   - Load test report execution (concurrent users)
   - Test report caching
   - Test large dataset handling
   - Test export performance

5. **Cross-Browser Testing**
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers (iOS Safari, Android Chrome)

6. **User Acceptance Testing (UAT)**
   - Select users from each role level
   - Real-world usage scenarios
   - Gather feedback

**Deliverables:**

- Test results documentation
- Bug list with priorities
- Performance benchmarks

---

#### Task 11.2: Bug Fixes & Performance Optimization

**Assigned to:** Developers
**Duration:** 5 days

**Activities:**

1. Fix all critical bugs
2. Fix high-priority bugs
3. Optimize slow queries
4. Implement additional caching where needed
5. Optimize frontend bundle sizes
6. Fix UI/UX issues from UAT

**Deliverables:**

- All critical and high-priority bugs fixed
- Performance improvements implemented
- UAT feedback addressed

---

### Week 12: Documentation & Launch

#### Task 12.1: User Documentation

**Assigned to:** Technical Writer + Developers
**Duration:** 3 days

**Documentation to Create:**

1. **User Guides** (per role level):
   - Sales Rep User Guide
   - Sales Manager User Guide
   - Technician User Guide
   - Service Manager User Guide
   - Operations User Guide
   - Finance User Guide
   - Executive User Guide

2. **Report Catalog**:
   - All 75 reports documented
   - Description, metrics, filters, access level
   - Screenshots of each report

3. **Administrator Guide**:
   - Role management
   - Permission management
   - Report definition management
   - KPI management
   - Dashboard customization

4. **API Documentation**:
   - Reporting API endpoints
   - Authentication
   - Request/response examples
   - Error codes

**Deliverables:**

- Complete user documentation
- Admin guide
- API documentation

---

#### Task 12.2: Training Materials

**Assigned to:** Technical Writer
**Duration:** 2 days

**Materials to Create:**

1. Video tutorials (per role level)
2. Quick start guides (1-page)
3. FAQ documents
4. Troubleshooting guides

**Deliverables:**

- Training videos
- Quick start guides
- FAQ and troubleshooting docs

---

#### Task 12.3: Deployment & Launch

**Assigned to:** Backend Developer + DevOps
**Duration:** 2 days

**Pre-Deployment:**

1. Code review (all changes)
2. Security audit (especially RBAC enforcement)
3. Final QA sign-off
4. Backup production database

**Deployment Steps:**

1. Deploy database migrations (roles, permissions, reports, KPIs)
2. Run seeders (in production)
3. Deploy backend code
4. Deploy frontend code
5. Smoke testing in production
6. Monitor error logs

**Post-Deployment:**

1. Monitor system performance
2. Monitor error rates
3. Gather user feedback
4. Support early adopters

**Deliverables:**

- Production deployment completed
- System monitoring active
- Support channels ready

---

#### Task 12.4: Rollout Communication

**Assigned to:** Product Manager
**Duration:** 1 day

**Communication Activities:**

1. Announcement email to all users
2. Release notes
3. Schedule training sessions
4. Set up support channels (Slack, email, helpdesk)
5. Prepare for user onboarding

**Deliverables:**

- Rollout communications sent
- Training sessions scheduled
- Support ready

---

## Technical Implementation Details

### Database Schema Changes

#### New Tables (if not already present):

**1. report_definitions**

```sql
CREATE TABLE report_definitions (
  id UUID PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- sales, service, operations, finance, executive, platform
  minimum_level INTEGER NOT NULL,
  scope VARCHAR(50) NOT NULL, -- own, team, location, regional, company, platform
  permissions JSONB, -- required permissions
  metrics JSONB, -- metrics included
  filters JSONB, -- available filters
  visualizations JSONB, -- chart types
  can_export BOOLEAN DEFAULT false,
  can_schedule BOOLEAN DEFAULT false,
  query_template TEXT, -- SQL template
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. kpi_definitions**

```sql
CREATE TABLE kpi_definitions (
  id UUID PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(50) NOT NULL,
  calculation_formula TEXT NOT NULL,
  unit VARCHAR(50), -- %, $, count, days, etc.
  threshold_green NUMERIC,
  threshold_yellow NUMERIC,
  threshold_red NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**3. scheduled_reports**

```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  report_code VARCHAR(100) NOT NULL REFERENCES report_definitions(code),
  frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, quarterly
  recipients JSONB, -- email addresses
  filters JSONB, -- saved filters
  export_format VARCHAR(20), -- pdf, excel, csv, ppt
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**4. report_execution_history**

```sql
CREATE TABLE report_execution_history (
  id UUID PRIMARY KEY,
  report_code VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  filters JSONB,
  execution_time_ms INTEGER,
  row_count INTEGER,
  export_format VARCHAR(20),
  status VARCHAR(50), -- success, error
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

**5. dashboard_layouts**

```sql
CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id), -- NULL for default layouts
  role_id UUID REFERENCES roles(id), -- NULL for user-specific layouts
  department VARCHAR(50),
  layout_config JSONB NOT NULL, -- widget positions, sizes, settings
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### API Route Structure

**Reporting API Routes:**

```
server/routes/reporting-api.ts
├── GET    /api/reports                     # List available reports
├── GET    /api/reports/:code               # Get report definition
├── POST   /api/reports/:code/execute       # Execute report
├── POST   /api/reports/:code/export        # Export report
├── POST   /api/reports/:code/schedule      # Schedule report
├── GET    /api/reports/scheduled           # Get scheduled reports
├── PUT    /api/reports/scheduled/:id       # Update scheduled report
├── DELETE /api/reports/scheduled/:id       # Delete scheduled report
├── GET    /api/reports/history             # Get execution history
├── GET    /api/kpis                        # Get KPI definitions
├── POST   /api/kpis/:code/calculate        # Calculate KPI
├── GET    /api/dashboards/layouts          # Get dashboard layouts
├── POST   /api/dashboards/layouts          # Save dashboard layout
└── DELETE /api/dashboards/layouts/:id      # Delete dashboard layout
```

---

### Frontend Component Structure

```
client/src/
├── pages/
│   └── dashboards/
│       ├── SalesRepDashboard.tsx
│       ├── SalesManagerDashboard.tsx
│       ├── VPSalesDashboard.tsx
│       ├── TechnicianDashboard.tsx
│       ├── ServiceManagerDashboard.tsx
│       ├── VPServiceDashboard.tsx
│       ├── OperationsManagerDashboard.tsx
│       ├── COODashboard.tsx
│       ├── FinanceManagerDashboard.tsx
│       ├── CFODashboard.tsx
│       ├── CEODashboard.tsx
│       └── PlatformAdminDashboard.tsx
├── components/
│   ├── reports/
│   │   ├── ReportViewer.tsx              # Generic report viewer
│   │   ├── ReportFilters.tsx             # Dynamic filter UI
│   │   ├── ReportExport.tsx              # Export UI
│   │   ├── ReportScheduler.tsx           # Scheduling UI
│   │   └── ReportExecutionHistory.tsx    # History viewer
│   ├── dashboards/
│   │   ├── DashboardGrid.tsx             # Drag-and-drop grid
│   │   ├── DashboardWidget.tsx           # Widget container
│   │   ├── KPICard.tsx                   # KPI metric card
│   │   └── WidgetLibrary.tsx             # Available widgets
│   ├── charts/
│   │   ├── PipelineFunnel.tsx
│   │   ├── QuotaGauge.tsx
│   │   ├── TrendLineChart.tsx
│   │   ├── ComparisonBarChart.tsx
│   │   ├── WaterfallChart.tsx
│   │   ├── HeatMap.tsx
│   │   ├── GeoMap.tsx
│   │   └── RadarChart.tsx
│   └── tables/
│       ├── DataTable.tsx                 # Generic data table
│       ├── PaginatedTable.tsx
│       └── SortableTable.tsx
└── hooks/
    ├── useReport.ts                      # Report execution hook
    ├── useKPI.ts                         # KPI calculation hook
    ├── useDashboard.ts                   # Dashboard management hook
    └── useReportExport.ts                # Export hook
```

---

### Caching Strategy

**L1 Cache (In-Memory):**

- Permission lookups (5-minute TTL)
- Report definitions (10-minute TTL)
- KPI definitions (10-minute TTL)

**L2 Cache (Database):**

- Report execution results (configurable TTL per report)
- KPI calculation results (configurable TTL per KPI)

**Cache Invalidation:**

- Permission changes → invalidate user permission cache
- Report definition changes → invalidate report cache
- Data changes → invalidate related report results

---

### Performance Optimization

**Backend:**

1. Database query optimization (indexes, query plans)
2. Pagination for large result sets
3. Lazy loading for dashboard widgets
4. Background job processing for scheduled reports
5. Connection pooling for database
6. Caching strategies (see above)

**Frontend:**

1. Code splitting by route and role
2. Lazy loading of dashboard widgets
3. Virtual scrolling for large tables
4. Chart rendering optimization (canvas vs SVG)
5. Image optimization
6. Bundle size optimization

---

## Testing Strategy

### Unit Testing

**Backend:**

- All report services (100% coverage target)
- RBAC middleware (100% coverage required)
- Query builders
- KPI calculation functions
- Export functions

**Frontend:**

- Dashboard components
- Chart components
- Report viewer components
- Hooks

**Tools:**

- Backend: Jest
- Frontend: React Testing Library, Vitest

---

### Integration Testing

**Test Scenarios:**

1. Report execution end-to-end
2. Report export (all formats)
3. Report scheduling
4. Permission enforcement
5. Data scoping
6. Dashboard customization
7. Cross-department reports

**Tools:**

- Playwright (E2E)
- Supertest (API)

---

### Performance Testing

**Metrics to Test:**

- Report execution time (target: < 2 seconds for most reports)
- Export generation time (target: < 5 seconds)
- Dashboard load time (target: < 3 seconds)
- Concurrent users (target: 100+ concurrent)

**Tools:**

- Artillery (load testing)
- Lighthouse (frontend performance)

---

### Security Testing

**Test Scenarios:**

1. Unauthorized report access attempts
2. Data leakage across tenants
3. Data leakage across organizational levels
4. SQL injection attempts
5. XSS attempts in report filters

**Tools:**

- OWASP ZAP
- Manual penetration testing

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All code reviewed and approved
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Training materials ready
- [ ] Support team briefed
- [ ] Rollback plan prepared
- [ ] Production database backed up
- [ ] Staging environment tested

---

### Deployment Steps

**1. Database Deployment (30 minutes):**

```bash
# Run migrations
npm run db:migrate

# Run seeders (roles, permissions, reports, KPIs)
npm run seed:rbac
npm run seed:reports
npm run seed:kpis
npm run seed:dashboard-layouts
```

**2. Backend Deployment (15 minutes):**

```bash
# Build backend
npm run build

# Deploy to production
# (deployment method depends on infrastructure)

# Restart server
pm2 restart printyx-server
```

**3. Frontend Deployment (15 minutes):**

```bash
# Build frontend
npm run build

# Deploy static assets
# (deployment method depends on infrastructure)
```

**4. Smoke Testing (15 minutes):**

- Test login (each role level)
- Test dashboard load (each role)
- Test report execution (sample reports)
- Test export (sample export)
- Monitor error logs

**5. Monitoring (ongoing):**

- Application logs
- Error tracking (Sentry, if available)
- Performance monitoring (New Relic, DataDog, if available)
- User feedback channels

---

### Rollback Plan

**If critical issues occur:**

**1. Immediate Actions:**

- Revert frontend deployment
- Revert backend deployment
- Restore database from backup (if necessary)

**2. Communication:**

- Notify users of rollback
- Explain issue and expected resolution time
- Provide workarounds if available

**3. Post-Rollback:**

- Analyze root cause
- Fix issues in development
- Re-test thoroughly
- Schedule new deployment

---

## Success Metrics

### Adoption Metrics

**Target Metrics (90 days post-launch):**

- 90%+ user login rate (all roles)
- 75%+ dashboard usage rate
- 50%+ custom dashboard creation rate
- 60%+ report export usage rate
- 40%+ scheduled report usage rate

### Performance Metrics

**Target Metrics (ongoing):**

- 95%+ report execution success rate
- < 2 seconds average report load time
- < 5 seconds average export generation time
- 99.9%+ system uptime
- < 0.1% error rate

### Business Metrics

**Target Metrics (90 days post-launch):**

- 20%+ increase in data-driven decisions (survey)
- 15%+ reduction in manual reporting time
- 30%+ increase in forecast accuracy (sales)
- 10%+ improvement in operational efficiency (service, operations)

---

## Post-Launch Activities

### Week 13+: Ongoing Support & Iteration

**Activities:**

1. Monitor system performance and user adoption
2. Gather user feedback (surveys, interviews, support tickets)
3. Prioritize enhancement requests
4. Fix bugs as reported
5. Optimize performance based on real-world usage
6. Iterate on dashboards based on user behavior
7. Add new reports as requested
8. Refine KPI thresholds based on business performance

**Quarterly Reviews:**

- Review adoption metrics
- Review performance metrics
- Review business impact metrics
- Plan next iteration of features
- Update documentation
- Conduct additional training as needed

---

## Risk Management

### Identified Risks

| Risk                        | Likelihood | Impact   | Mitigation                                             |
| --------------------------- | ---------- | -------- | ------------------------------------------------------ |
| Database migration issues   | Medium     | High     | Thorough testing in staging, backup plan               |
| Performance issues at scale | Medium     | High     | Load testing, caching strategy, performance monitoring |
| User adoption challenges    | High       | Medium   | Training, documentation, early user engagement         |
| Permission enforcement bugs | Low        | Critical | Extensive security testing, code review                |
| Data scoping errors         | Low        | Critical | Integration testing, manual verification               |
| Report accuracy issues      | Medium     | High     | Data validation, business user review                  |
| Scope creep                 | High       | Medium   | Strict change management, phased approach              |

---

## Conclusion

This implementation plan provides a **comprehensive roadmap** for building out the role-based reporting structure for Printyx over a 12-week period.

**Key Success Factors:**

1. **Phased approach** - Incremental delivery reduces risk
2. **Strong foundation** - RBAC consolidation and seeding in Phase 1
3. **User-centric design** - Reports designed for specific roles
4. **Thorough testing** - Comprehensive testing before launch
5. **Clear documentation** - Users and admins well-supported
6. **Post-launch support** - Ongoing iteration and improvement

**Next Steps:**

1. Review and approve this implementation plan
2. Assemble development team
3. Kick off Phase 1 (Week 1)
4. Begin RBAC system consolidation

---

**For Questions or Clarifications:**
Refer to the companion documents:

- RBAC_CURRENT_STATE.md
- RBAC_IDEAL_STRUCTURE.md
- RBAC_FUNCTIONALITY_MATRIX.md
- RBAC_REPORTING_REQUIREMENTS.md

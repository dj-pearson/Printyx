# RBAC Current State Analysis

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Current State Assessment

## Executive Summary

Printyx currently has **two parallel RBAC systems** in operation:

1. **Legacy System**: 8-level hierarchy with boolean permission flags
2. **Enhanced System**: Sophisticated nested-set model with 60+ granular permissions

The enhanced system is implemented but **not fully integrated** across the application. This creates inconsistencies in permission enforcement and reporting access.

---

## 1. Current Role Hierarchy

### Enhanced RBAC System (Recommended)

| Level | Title                   | Typical Roles                                     | Scope                   |
| ----- | ----------------------- | ------------------------------------------------- | ----------------------- |
| 8     | Platform Administrators | Printyx Staff, Support Engineers                  | Cross-tenant access     |
| 7     | Company Executives      | CEO, President, CFO, VP                           | Company-wide            |
| 6     | Company Directors       | VP Sales, VP Service, Operations Director         | Company-wide department |
| 5     | Regional Managers       | Regional Sales Director, Regional Service Manager | Multi-location          |
| 4     | Location Managers       | Branch Manager, Sales Manager, Service Manager    | Single location         |
| 3     | Department Supervisors  | Sales Supervisor, Service Supervisor              | Team + location         |
| 2     | Team Leads              | Senior Sales Rep, Senior Technician               | Small team              |
| 1     | Individual Contributors | Sales Rep, Field Technician, Accounting Clerk     | Self only               |

### Legacy System (Deprecated - Still in Use)

Similar 8-level structure but with less granular permissions and no organizational unit hierarchy.

---

## 2. Current Departments

### Defined Departments:

1. **Sales**
   - Lead/opportunity management
   - Quote/proposal generation
   - Territory management
   - Commission tracking

2. **Service**
   - Ticket management
   - Equipment installation/maintenance
   - Mobile field service
   - Parts tracking

3. **Finance**
   - Accounts receivable/payable
   - Invoicing and billing
   - Financial reporting
   - Commission payments

4. **Operations**
   - Warehouse/inventory management
   - Purchase orders
   - Multi-department oversight
   - Branch operations

5. **Administration**
   - User management
   - System configuration
   - Tenant setup
   - Security/compliance

6. **Platform** (Printyx Staff)
   - Cross-tenant support
   - System monitoring
   - Platform administration

7. **Other Departments** (Partially Implemented)
   - HR, IT, Compliance, Quality

---

## 3. Current Permission Model

### Enhanced RBAC Permissions (60+ defined)

#### Permission Structure:

- **Code**: Unique identifier (e.g., `lead.view_team`)
- **Module**: sales, service, finance, operations, admin, platform
- **Scope**: own, team, location, regional, company, platform
- **Risk Level**: low, medium, high, critical
- **Requires Approval**: Boolean flag
- **Requires MFA**: Boolean flag for sensitive operations

#### Key Permission Categories:

**Sales & CRM:**

```
lead.view_own, lead.view_team, lead.view_location, lead.view_regional, lead.view_company
lead.create, lead.edit_own, lead.edit_team, lead.assign, lead.delete
quote.create, quote.approve_standard, quote.approve_high_value, quote.approve_enterprise
territory.manage_assignments, territory.view_performance
```

**Service Management:**

```
ticket.view_own, ticket.view_team, ticket.view_location
ticket.create, ticket.assign, ticket.close
equipment.install, equipment.configure, equipment.remote_access
```

**Financial:**

```
commission.view_own, commission.view_team, commission.approve
financial.view_location, financial.view_regional, financial.view_company
invoice.create, invoice.approve, invoice.void
```

**User & Role Management:**

```
user.create_location, user.create_regional, user.create_company
user.edit_profile, user.manage_permissions
role.create, role.assign, role.manage_permissions
```

**Audit & Compliance:**

```
audit.view_location, audit.view_regional, audit.view_company
compliance.manage, compliance.view_reports
```

**Platform:**

```
platform.access_all_tenants
platform.view_system_metrics
platform.manage_subscriptions
```

### Legacy Permissions (Boolean Flags)

20+ boolean flags on roles table:

```
canAccessDashboard, canManageCustomers, canManageLeads,
canManageOpportunities, canManageInvoices, canManageInventory,
canManageUsers, canManageRoles, canViewReports,
canManageSettings, canAccessPlatformAdmin, etc.
```

---

## 4. Organizational Structure

### 4-Tier Hierarchy:

```
Platform (Printyx System)
└── Company (Tenant)
    └── Regional (Territory/Division)
        └── Location (Branch/Office)
```

### Nested Set Model:

- Uses `lft`, `rght`, `depth` fields for efficient hierarchy queries
- Supports complex organizational structures
- Enables permission inheritance down the tree

### Example Multi-Location Dealer:

```
ABC Copiers (Company)
├── Eastern Region
│   ├── New York Office
│   ├── Boston Office
│   └── Philadelphia Office
├── Western Region
│   ├── Los Angeles Office
│   ├── San Francisco Office
│   └── Seattle Office
└── Central Region
    ├── Chicago Office
    └── Dallas Office
```

---

## 5. Current Reporting Capabilities

### Reporting Schema Components:

**1. Report Definitions Table:**

- Categories: sales, service, finance, operations, hr, it, compliance, executive
- Scopes: platform, company, regional, location, team, individual
- **Status**: Schema defined but **no reports seeded**

**2. KPI Definitions Table:**

- Department-specific KPIs
- Aggregation methods (sum, avg, count, etc.)
- Thresholds for alerts
- **Status**: Schema defined but **no KPIs seeded**

**3. Report Execution Tracking:**

- Tracks who runs reports and when
- Export format tracking
- **Status**: Implemented but **not actively used**

**4. Dashboard Layouts:**

- Custom layouts per role/user
- Widget positioning
- **Status**: Schema defined but **no default layouts**

### Current Report Access by Level:

| Level          | Access Scope          | Capabilities                          | Limitations               |
| -------------- | --------------------- | ------------------------------------- | ------------------------- |
| 1 - Individual | Own data only         | View personal metrics                 | Cannot export or schedule |
| 2 - Team Lead  | Self + direct reports | Team performance reports              | Limited export            |
| 3 - Supervisor | Team + location       | Export reports, operational metrics   | No scheduling             |
| 4 - Manager    | Location-wide         | Schedule reports, financial summaries | Location-scoped only      |
| 5 - Regional   | Multi-location        | Advanced analytics, forecasting       | Regional-scoped only      |
| 6 - Director   | Company-wide dept     | Advanced analytics, KPI management    | Department-specific       |
| 7 - Executive  | Company-wide all      | All reports, sensitive financials     | Single company            |
| 8 - Platform   | Cross-tenant          | System metrics, all tenant data       | Full access               |

### Reporting Middleware:

**File**: `server/reporting-rbac-middleware.ts`

**Permission Checks:**

- `canViewReports`: Basic report access
- `canViewSalesReports`: Sales-specific reports
- `canViewServiceReports`: Service-specific reports
- `canViewFinanceReports`: Financial reports
- `canViewExecutiveReports`: Executive dashboards
- `canViewOwnData`, `canViewTeamData`, `canViewLocationData`, etc.

**Hierarchical Query Builder:**

- Automatically filters data based on user's organizational position
- Injects WHERE clauses for tenancy and hierarchy
- Prevents unauthorized data access

---

## 6. Existing Dashboard Implementations

### General Dashboards:

- **ModularDashboard** (client/src/pages/dashboard.tsx): Role-based widget display
- **Executive Dashboard** (client/src/pages/ExecutiveDashboard.tsx): C-suite metrics

### Department-Specific Dashboards (80+):

**Sales:**

- Sales Command Center
- Deal Pipeline Dashboard
- Territory Performance Dashboard
- Commission Dashboard

**Service:**

- Service Hub
- Technician Performance Dashboard
- Equipment Health Dashboard
- SLA Compliance Dashboard

**Finance:**

- Financial Intelligence Dashboard
- AR/AP Dashboard
- Revenue Recognition Dashboard

**Operations:**

- Warehouse Dashboard
- Inventory Dashboard
- FPY (First Pass Yield) Dashboard

**Analytics:**

- Predictive Analytics Dashboard
- Customer Success Dashboard
- Performance Monitoring Dashboard

---

## 7. Current Implementation Status

### ✅ Fully Implemented:

1. **Enhanced RBAC Schema**
   - Roles, permissions, role-permission mappings
   - Organizational units with nested set model
   - Permission overrides and caching

2. **Role Hierarchy**
   - 8-level structure defined
   - Department associations
   - Scope levels (own, team, location, regional, company, platform)

3. **Reporting Schema**
   - Report definitions, KPI definitions
   - Report execution tracking
   - Dashboard layouts

4. **Client-Side RBAC Utilities**
   - Permission checking hooks
   - Role-based component rendering
   - RBAC context provider

5. **Reporting Middleware**
   - Hierarchical query filtering
   - Permission-based report access
   - Data scoping by organizational level

### ⚠️ Partially Implemented:

1. **RBAC Middleware Enforcement**
   - Some routes use enhanced RBAC
   - Many routes still use legacy system
   - Inconsistent permission checking

2. **Department Dashboards**
   - Many dashboards exist
   - Not all enforce role-based filtering
   - Inconsistent data scoping

3. **Report Definitions**
   - Schema exists
   - **No reports seeded into database**
   - Manual report implementation per dashboard

4. **Role Seeding**
   - Multiple seeders exist (legacy, enhanced, multi-location)
   - Unclear which is current/active
   - Potential conflicts

### ❌ Not Implemented:

1. **Unified RBAC System**
   - Two systems running in parallel
   - No migration plan from legacy to enhanced
   - Confusion about which to use

2. **Seeded Report Definitions**
   - Reports defined in code, not database
   - No dynamic report system
   - Cannot add reports without code changes

3. **Default Dashboard Layouts**
   - No role-based default dashboards
   - Users must manually configure
   - No onboarding dashboard setup

4. **Department-Specific Reporting Structure**
   - No clear sales department reporting hierarchy
   - No clear service department reporting hierarchy
   - Ad-hoc reporting implementation

5. **Permission-Based Feature Flags**
   - Features not consistently gated by permissions
   - Some routes bypass RBAC entirely
   - Navigation doesn't hide unauthorized routes

---

## 8. Current Issues & Gaps

### Critical Issues:

**1. Dual RBAC Systems**

- Legacy and enhanced systems both active
- Leads to inconsistent permission enforcement
- Developers unclear which to use
- Potential security gaps

**2. No Seeded Data**

- Report definitions table empty
- KPI definitions table empty
- Dashboard layouts table empty
- Requires seeding for system to be functional

**3. Inconsistent Middleware**

- Some routes use `requirePermission()`
- Others use legacy `requireRole()`
- Some routes have no RBAC checks
- Creates security vulnerabilities

**4. No Department Hierarchy**

- Departments defined but not structured
- No clear reporting chain
- Cannot map role → department → reports

### Moderate Issues:

**5. Documentation Gap**

- Enhanced RBAC not documented in CLAUDE.md
- Developers unaware of proper implementation
- No permission code reference

**6. Dashboard Inconsistency**

- 80+ dashboards but inconsistent role filtering
- Some respect RBAC, others don't
- No standard pattern

**7. Role Seeding Confusion**

- Three different seeders
- Unclear which to use
- Potential data conflicts

### Minor Issues:

**8. Permission Caching**

- L1 (memory) cache implemented
- L2 (database) cache defined but unused
- Could improve performance

**9. Approval Workflows**

- Permissions have `requiresApproval` flag
- No approval workflow implemented
- Flag ignored in current code

**10. MFA Enforcement**

- Permissions have `requiresMFA` flag
- MFA implemented but not enforced per-permission
- Critical operations not protected

---

## 9. Technical Debt

### High Priority:

1. **Consolidate RBAC systems** → Migrate fully to enhanced RBAC
2. **Seed report definitions** → Populate database with standard reports
3. **Enforce RBAC middleware** → Audit all routes, add missing checks
4. **Document enhanced RBAC** → Update CLAUDE.md with current system

### Medium Priority:

5. **Create department hierarchies** → Define sales, service, finance, operations structures
6. **Standardize dashboard patterns** → Consistent role-based filtering
7. **Implement default layouts** → Role-specific dashboard defaults
8. **Unify role seeders** → Single source of truth for role definitions

### Low Priority:

9. **Implement approval workflows** → Honor `requiresApproval` flags
10. **Enforce MFA per permission** → Use `requiresMFA` flags
11. **Optimize permission caching** → Implement L2 database cache
12. **Add permission audit log** → Track permission changes

---

## 10. Recommendations

### Immediate Actions (Week 1):

1. **Audit all routes** for RBAC enforcement
2. **Create comprehensive role-permission mapping** document
3. **Seed initial report definitions** for each department
4. **Document enhanced RBAC** in CLAUDE.md

### Short-term (Month 1):

5. **Migrate all routes** to enhanced RBAC middleware
6. **Build department reporting hierarchies**
7. **Create default dashboard layouts** per role
8. **Deprecate legacy RBAC system**

### Long-term (Quarter 1):

9. **Implement dynamic report builder**
10. **Build approval workflow system**
11. **Enforce per-permission MFA**
12. **Create RBAC admin UI** for managing roles/permissions

---

## Conclusion

Printyx has a **robust enhanced RBAC system** with sophisticated permissions and organizational hierarchy support. However, the system is **not fully integrated** into the application:

- **Dual systems** create confusion and security gaps
- **Missing seeded data** prevents dynamic reporting
- **Inconsistent enforcement** across routes and dashboards
- **No clear department structure** for role-based reporting

**Priority**: Consolidate to enhanced RBAC, seed report definitions, and build department-specific reporting hierarchies.

---

**Next Steps**: See `RBAC_IDEAL_STRUCTURE.md` for recommended architecture and implementation plan.

# RBAC Ideal Structure - Role-Based Reporting Architecture

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Proposed Architecture

## Executive Summary

This document defines the **ideal role-based reporting structure** for Printyx, designed to support copier dealers of all sizes—from single-location shops to multi-location enterprise accounts. The structure provides:

- **Clear role hierarchy** from individual contributors to C-suite
- **Department-specific reporting** aligned with organizational structure
- **Scalable permissions** that grow with the business
- **Consistent access patterns** across all modules

---

## 1. Organizational Structure

### Business Size Categories:

| Category              | Locations | Employees | Annual Revenue | Structure          |
| --------------------- | --------- | --------- | -------------- | ------------------ |
| **Micro Dealer**      | 1         | 1-10      | $0-$2M         | Flat               |
| **Small Dealer**      | 1-2       | 11-25     | $2M-$10M       | Simple hierarchy   |
| **Mid-Size Dealer**   | 3-5       | 26-75     | $10M-$50M      | Department heads   |
| **Large Dealer**      | 6-15      | 76-200    | $50M-$150M     | Regional structure |
| **Enterprise Dealer** | 16+       | 201+      | $150M+         | Multi-regional     |

### Organizational Tiers:

```
Platform (Printyx)
└── Company (Tenant)
    └── Division (Optional - Enterprise only)
        └── Region (Optional - Large/Enterprise)
            └── Location (Branch/Office)
                └── Department (Sales, Service, Ops, Finance)
                    └── Team (Optional)
```

---

## 2. Comprehensive Role Hierarchy

### Level 8: Platform Administrators (Printyx Staff Only)

**Roles:**

- Platform Administrator
- Support Engineer
- Platform Developer

**Scope:** Cross-tenant, all data access

**Responsibilities:**

- Platform maintenance and monitoring
- Cross-tenant support
- System configuration
- Tenant provisioning

**Reporting Access:**

- System-wide metrics
- All tenant data
- Platform health monitoring
- Cross-tenant analytics

---

### Level 7: C-Suite / Company Executives

**Roles:**

- **CEO / President**: Overall company leadership
- **CFO**: Financial oversight
- **COO**: Operations oversight
- **VP Sales**: Sales leadership
- **VP Service**: Service leadership
- **VP Finance**: Financial leadership (reports to CFO)

**Scope:** Company-wide, all departments

**Responsibilities:**

- Strategic planning
- P&L ownership
- Company-wide goals
- Board reporting
- Major decisions (M&A, expansion, etc.)

**Reporting Access:**

- Executive dashboard (comprehensive)
- Company-wide P&L
- Revenue by department/location/region
- Strategic KPIs (market share, growth rate, EBITDA)
- Customer acquisition/retention metrics
- Employee performance (aggregate)
- Competitive analysis
- Board-level reports

---

### Level 6: Company Directors / VPs of Departments

**Roles:**

**Sales Department:**

- VP of Sales (if no separate VP role at Level 7)
- Director of Sales

**Service Department:**

- VP of Service (if no separate VP role at Level 7)
- Director of Service Operations

**Operations:**

- Director of Operations
- Director of Logistics

**Finance:**

- Director of Finance (if no CFO)
- Controller

**IT:**

- Director of IT / CTO

**HR:**

- Director of HR / CHRO

**Scope:** Company-wide for specific department

**Responsibilities:**

- Departmental strategy
- Multi-location oversight
- Budget ownership
- Hiring/firing (department)
- Policy creation
- Cross-department collaboration

**Reporting Access by Department:**

**Sales Directors:**

- Company-wide sales metrics
- Pipeline by location/region
- Win/loss analysis
- Sales rep performance (all)
- Territory performance
- Product mix analysis
- Commission structure effectiveness
- Sales forecasting (company-wide)

**Service Directors:**

- Company-wide service metrics
- SLA compliance (all locations)
- Technician productivity (all)
- Parts usage and costs
- Equipment health (all customers)
- Service profitability by location
- Capacity planning
- Warranty vs billable analysis

**Operations Directors:**

- Inventory levels (all locations)
- Warehouse efficiency
- FPY (First Pass Yield) metrics
- Supply chain metrics
- Cross-departmental operational KPIs
- Process efficiency metrics

**Finance Directors:**

- Company-wide financials
- AR/AP aging (all)
- Cash flow
- Profitability by location/product/customer
- Budget vs actual
- Financial forecasting
- Audit reports

---

### Level 5: Regional Managers (Large/Enterprise Only)

**Roles:**

**Sales:**

- Regional Sales Director
- Area Sales Manager

**Service:**

- Regional Service Manager
- Area Service Manager

**Operations:**

- Regional Operations Manager

**Scope:** Multi-location within region

**Responsibilities:**

- Regional strategy execution
- Multi-location coordination
- Regional goal achievement
- Manager development
- Resource allocation across locations

**Reporting Access by Department:**

**Regional Sales Managers:**

- Regional sales performance
- Location comparison within region
- Regional pipeline health
- Territory coverage
- Regional forecasting
- Sales rep rankings (region)
- Regional customer satisfaction
- Competitive positioning (region)

**Regional Service Managers:**

- Regional service metrics
- Location SLA comparison
- Technician utilization (region)
- Parts inventory optimization (region)
- Regional service profitability
- Equipment coverage (region)
- Customer health scores (region)

**Regional Operations Managers:**

- Regional inventory levels
- Cross-location logistics
- Regional warehouse metrics
- Supply chain efficiency (region)

---

### Level 4: Location Managers

**Roles:**

**General Management:**

- Branch Manager / General Manager
- Location Manager

**Sales:**

- Sales Manager (location)
- Sales Director (small single-location dealers)

**Service:**

- Service Manager (location)
- Service Director (small single-location dealers)

**Operations:**

- Operations Manager (location)
- Warehouse Manager

**Finance:**

- Finance Manager (location)
- Accounting Manager

**Scope:** Single location, all departments OR single department company-wide (small dealers)

**Responsibilities:**

- Location P&L (Branch Managers)
- Department goal achievement (Department Managers)
- Team management
- Local customer relationships
- Hiring/firing (with approval)
- Schedule management
- Budget management (location/department)

**Reporting Access by Role:**

**Branch Managers:**

- Location P&L
- Location sales vs targets
- Location service metrics
- Location inventory
- Employee performance (all location staff)
- Location customer satisfaction
- Location profitability
- Cross-departmental location KPIs

**Sales Managers:**

- Location sales pipeline
- Sales team performance
- Territory coverage (location)
- Lead conversion rates
- Location sales forecasting
- Individual rep metrics
- Commission reports (location team)

**Service Managers:**

- Location service tickets
- Technician productivity
- SLA compliance (location)
- Parts usage (location)
- Service profitability (location)
- Equipment coverage (location customers)
- Technician certifications/training

**Operations/Warehouse Managers:**

- Location inventory
- Warehouse metrics (FPY, kitting)
- Purchase orders
- Receiving/shipping
- Inventory accuracy
- Supply chain metrics (location)

**Finance Managers:**

- Location AR/AP
- Location billing
- Location collections
- Location budget vs actual
- Invoice approvals
- Expense management

---

### Level 3: Supervisors

**Roles:**

**Sales:**

- Sales Supervisor
- Inside Sales Supervisor

**Service:**

- Service Supervisor
- Dispatch Supervisor

**Operations:**

- Warehouse Supervisor
- Inventory Supervisor

**Finance:**

- Accounting Supervisor

**Scope:** Team + location visibility

**Responsibilities:**

- Daily team oversight
- Quality assurance
- Coaching and mentoring
- Schedule management (team)
- First-level problem resolution
- Process enforcement

**Reporting Access by Department:**

**Sales Supervisors:**

- Team sales performance
- Individual rep pipelines (team)
- Team activity metrics (calls, meetings, quotes)
- Lead distribution (team)
- Team coaching reports
- Quota attainment (team)

**Service Supervisors:**

- Team service tickets
- Technician daily schedules
- Team productivity metrics
- Work order status (team)
- Team time tracking
- Quality metrics (team)

**Warehouse Supervisors:**

- Daily warehouse operations
- Team productivity
- Inventory movements
- Receiving/picking accuracy
- Team time tracking

---

### Level 2: Team Leads / Senior Staff

**Roles:**

**Sales:**

- Senior Sales Representative
- Lead Sales Representative
- Inside Sales Team Lead

**Service:**

- Senior Field Technician
- Lead Technician
- Senior Service Dispatcher

**Operations:**

- Lead Warehouse Associate
- Senior Inventory Specialist

**Finance:**

- Senior Accountant

**Scope:** Self + small team (2-5 people)

**Responsibilities:**

- Mentoring junior staff
- Subject matter expertise
- Lead on complex deals/tickets
- Training delivery
- Process improvement suggestions
- Backup for supervisor

**Reporting Access:**

**Sales Senior Reps:**

- Own pipeline and performance
- Team performance comparison (for coaching)
- Activity leaderboard (team visibility)
- Commission reports (own + team overview)

**Senior Technicians:**

- Own tickets and time
- Team workload visibility (for distribution)
- Team efficiency comparison
- Mentee performance

**Senior Staff (Other):**

- Own performance
- Team metrics (read-only)
- Peer comparison

---

### Level 1: Individual Contributors

**Roles:**

**Sales:**

- Sales Representative
- Inside Sales Representative
- Business Development Representative (BDR)

**Service:**

- Field Service Technician
- Bench Technician
- Service Dispatcher

**Operations:**

- Warehouse Associate
- Inventory Specialist
- Purchasing Clerk
- Delivery Driver

**Finance:**

- Accounting Clerk
- AR Specialist
- AP Specialist
- Billing Specialist

**Administration:**

- Administrative Assistant
- Receptionist
- Data Entry Clerk

**Scope:** Self only (own data)

**Responsibilities:**

- Execute assigned tasks
- Meet individual quotas/targets
- Follow processes
- Time tracking
- Maintain data quality

**Reporting Access:**

**Sales Reps:**

- Own pipeline
- Own activity metrics
- Own quota attainment
- Own commission
- Leaderboard position

**Field Technicians:**

- Own service tickets
- Own schedule
- Own time tracking
- Own parts usage
- Own customer feedback scores

**Operations Staff:**

- Own task assignments
- Own productivity metrics
- Own time tracking

**Finance Staff:**

- Own task queue
- Own transaction volume
- Own accuracy metrics

---

## 3. Department-Specific Structures

### Sales Department Structure

```
VP Sales (Level 7)
└── Director of Sales (Level 6)
    └── Regional Sales Director (Level 5) [Large/Enterprise only]
        └── Sales Manager (Level 4)
            └── Sales Supervisor (Level 3)
                └── Senior Sales Rep (Level 2)
                    └── Sales Rep / BDR (Level 1)
```

**Parallel Structure: Inside Sales**

```
VP Sales (Level 7)
└── Director of Inside Sales (Level 6)
    └── Inside Sales Manager (Level 4)
        └── Inside Sales Supervisor (Level 3)
            └── Senior Inside Sales Rep (Level 2)
                └── Inside Sales Rep (Level 1)
```

---

### Service Department Structure

```
VP Service (Level 7)
└── Director of Service (Level 6)
    └── Regional Service Manager (Level 5) [Large/Enterprise only]
        └── Service Manager (Level 4)
            └── Service Supervisor (Level 3)
                └── Senior Field Technician (Level 2)
                    └── Field Technician (Level 1)
```

**Parallel Structures:**

**Dispatch:**

```
Service Manager (Level 4)
└── Dispatch Supervisor (Level 3)
    └── Senior Dispatcher (Level 2)
        └── Dispatcher (Level 1)
```

**Parts:**

```
Service Manager (Level 4)
└── Parts Manager (Level 4)
    └── Parts Supervisor (Level 3)
        └── Senior Parts Specialist (Level 2)
            └── Parts Specialist (Level 1)
```

---

### Operations Department Structure

```
COO / Director of Operations (Level 6/7)
└── Operations Manager (Level 4-5)
    ├── Warehouse Manager (Level 4)
    │   └── Warehouse Supervisor (Level 3)
    │       └── Lead Warehouse Associate (Level 2)
    │           └── Warehouse Associate (Level 1)
    ├── Inventory Manager (Level 4)
    │   └── Inventory Supervisor (Level 3)
    │       └── Senior Inventory Specialist (Level 2)
    │           └── Inventory Specialist (Level 1)
    └── Logistics Manager (Level 4)
        └── Delivery Supervisor (Level 3)
            └── Lead Driver (Level 2)
                └── Delivery Driver (Level 1)
```

---

### Finance Department Structure

```
CFO (Level 7)
└── Controller / Director of Finance (Level 6)
    └── Finance Manager (Level 4-5)
        ├── AR Manager (Level 4)
        │   └── AR Supervisor (Level 3)
        │       └── Senior AR Specialist (Level 2)
        │           └── AR Specialist (Level 1)
        ├── AP Manager (Level 4)
        │   └── AP Supervisor (Level 3)
        │       └── Senior AP Specialist (Level 2)
        │           └── AP Specialist (Level 1)
        └── Billing Manager (Level 4)
            └── Billing Supervisor (Level 3)
                └── Senior Billing Specialist (Level 2)
                    └── Billing Specialist (Level 1)
```

---

### IT Department Structure

```
CTO / Director of IT (Level 6/7)
└── IT Manager (Level 4-5)
    ├── Systems Administrator (Level 3-4)
    ├── Network Administrator (Level 3-4)
    ├── Help Desk Manager (Level 4)
    │   └── Help Desk Supervisor (Level 3)
    │       └── Senior Help Desk Technician (Level 2)
    │           └── Help Desk Technician (Level 1)
    └── Database Administrator (Level 3-4)
```

---

### HR Department Structure

```
CHRO / Director of HR (Level 6/7)
└── HR Manager (Level 4-5)
    ├── Recruiting Manager (Level 4)
    │   └── Recruiter (Level 2-3)
    ├── Benefits Administrator (Level 3)
    ├── Payroll Manager (Level 4)
    │   └── Payroll Specialist (Level 1-2)
    └── HR Generalist (Level 2-3)
```

---

## 4. Reporting Scope by Level

### Data Access Hierarchy

| Level          | Self | Direct Reports | Team | Location | Region | Company | Cross-Tenant |
| -------------- | ---- | -------------- | ---- | -------- | ------ | ------- | ------------ |
| 1 - Individual | ✅   | ❌             | ❌   | ❌       | ❌     | ❌      | ❌           |
| 2 - Team Lead  | ✅   | ✅             | ✅   | 👁️       | ❌     | ❌      | ❌           |
| 3 - Supervisor | ✅   | ✅             | ✅   | ✅       | 👁️     | ❌      | ❌           |
| 4 - Manager    | ✅   | ✅             | ✅   | ✅       | 👁️     | 👁️      | ❌           |
| 5 - Regional   | ✅   | ✅             | ✅   | ✅       | ✅     | 👁️      | ❌           |
| 6 - Director   | ✅   | ✅             | ✅   | ✅       | ✅     | ✅      | ❌           |
| 7 - Executive  | ✅   | ✅             | ✅   | ✅       | ✅     | ✅      | ❌           |
| 8 - Platform   | ✅   | ✅             | ✅   | ✅       | ✅     | ✅      | ✅           |

**Legend:**

- ✅ Full Access (read/write appropriate to role)
- 👁️ Read-Only Access (for comparison/context)
- ❌ No Access

### Report Capabilities by Level

| Capability                | L1  | L2  | L3  | L4  | L5  | L6   | L7  | L8  |
| ------------------------- | --- | --- | --- | --- | --- | ---- | --- | --- |
| View own metrics          | ✅  | ✅  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| View team metrics         | ❌  | ✅  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| View location metrics     | ❌  | ❌  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| View regional metrics     | ❌  | ❌  | ❌  | 👁️  | ✅  | ✅   | ✅  | ✅  |
| View company metrics      | ❌  | ❌  | ❌  | 👁️  | 👁️  | ✅   | ✅  | ✅  |
| Export reports            | ❌  | ✅  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| Schedule reports          | ❌  | ❌  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| Create custom reports     | ❌  | ❌  | ❌  | ✅  | ✅  | ✅   | ✅  | ✅  |
| Manage KPIs               | ❌  | ❌  | ❌  | ❌  | 👁️  | ✅   | ✅  | ✅  |
| View sensitive financials | ❌  | ❌  | ❌  | ❌  | ❌  | Dept | ✅  | ✅  |
| Customize dashboards      | ✅  | ✅  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |
| Share dashboards          | ❌  | ✅  | ✅  | ✅  | ✅  | ✅   | ✅  | ✅  |

---

## 5. Permission Model Structure

### Permission Naming Convention

Format: `<module>.<entity>.<action>_<scope>`

**Examples:**

- `sales.lead.view_own` - View only leads assigned to me
- `sales.lead.view_team` - View leads for my team
- `sales.lead.view_location` - View all leads at my location
- `sales.quote.approve_standard` - Approve quotes up to $X
- `service.ticket.assign` - Assign tickets to technicians
- `finance.invoice.void` - Void invoices

### Core Permission Categories

**1. View Permissions** (Read-only access)

```
<module>.<entity>.view_own
<module>.<entity>.view_team
<module>.<entity>.view_location
<module>.<entity>.view_regional
<module>.<entity>.view_company
<module>.<entity>.view_all_tenants (Platform only)
```

**2. Modify Permissions** (Write access)

```
<module>.<entity>.create
<module>.<entity>.edit_own
<module>.<entity>.edit_team
<module>.<entity>.edit_any
<module>.<entity>.delete_own
<module>.<entity>.delete_any
```

**3. Special Permissions** (Workflows)

```
<module>.<entity>.assign
<module>.<entity>.approve
<module>.<entity>.reject
<module>.<entity>.close
<module>.<entity>.reopen
```

**4. Administrative Permissions**

```
<module>.settings.configure
<module>.users.manage
<module>.roles.assign
```

### Permission Properties

Each permission has:

- **code**: Unique identifier
- **module**: sales, service, finance, operations, admin, platform
- **riskLevel**: low, medium, high, critical
- **requiresApproval**: Boolean (high-value transactions)
- **requiresMFA**: Boolean (critical operations)
- **scope**: own, team, location, regional, company, platform

---

## 6. Role Templates by Dealer Size

### Micro Dealer (1-10 employees)

**Typical Roles:**

- Owner (Level 7) - All permissions
- Sales Rep (Level 1-2) - Basic sales
- Technician (Level 1-2) - Basic service
- Admin Assistant (Level 1) - Data entry

**Simplified Structure:**

- No regional hierarchy
- Minimal role separation
- Owner has executive + manager + director permissions
- Focus: Individual productivity

---

### Small Dealer (11-25 employees)

**Typical Roles:**

- Owner/President (Level 7)
- Sales Manager (Level 4)
- Service Manager (Level 4)
- Office Manager (Level 4)
- Sales Reps (Level 1-2) x 3-5
- Technicians (Level 1-2) x 3-5
- Admin/Finance Staff (Level 1-2) x 2-3

**Structure:**

- Single location
- Department managers
- Clear separation: sales, service, admin
- Focus: Team productivity + department metrics

---

### Mid-Size Dealer (26-75 employees)

**Typical Roles:**

- President (Level 7)
- VP Sales / Sales Director (Level 6)
- VP Service / Service Director (Level 6)
- Controller (Level 6)
- Sales Managers (Level 4) x 2-3
- Service Managers (Level 4) x 2-3
- Operations Manager (Level 4)
- Sales Supervisors (Level 3) x 2-3
- Service Supervisors (Level 3) x 2-3
- Sales Reps (Level 1-2) x 10-15
- Technicians (Level 1-2) x 10-15
- Operations/Admin Staff (Level 1-3) x 8-10

**Structure:**

- 3-5 locations
- Department directors
- Supervisors at each location
- Focus: Location comparison + process optimization

---

### Large Dealer (76-200 employees)

**Typical Roles:**

- President/CEO (Level 7)
- CFO (Level 7)
- VP Sales (Level 6-7)
- VP Service (Level 6-7)
- COO (Level 6-7)
- Regional Sales Directors (Level 5) x 2-3
- Regional Service Managers (Level 5) x 2-3
- Sales Managers (Level 4) x 6-10
- Service Managers (Level 4) x 6-10
- Operations Managers (Level 4) x 3-5
- Supervisors (Level 3) x 15-20
- Individual Contributors (Level 1-2) x 100-150

**Structure:**

- 6-15 locations
- Regional hierarchy
- Full department structure (sales, service, ops, finance, IT, HR)
- Focus: Regional optimization + strategic planning

---

### Enterprise Dealer (201+ employees)

**Typical Roles:**

- CEO (Level 7)
- CFO, COO, CTO, CHRO (Level 7)
- VPs (Level 6-7) x 6-10
- Regional Directors (Level 5) x 6-12
- Location/Department Managers (Level 4) x 20-40
- Supervisors (Level 3) x 40-60
- Team Leads (Level 2) x 60-100
- Individual Contributors (Level 1) x 150-300+

**Structure:**

- 16+ locations
- Multiple regions/divisions
- Full corporate structure
- Specialized roles (compliance, security, analytics, etc.)
- Focus: Enterprise-wide optimization + market expansion

---

## 7. Next Steps Summary

To implement this ideal structure:

1. **Consolidate RBAC** → Migrate to enhanced RBAC system
2. **Seed role templates** → Create roles for each dealer size
3. **Define permissions** → Map 200+ granular permissions
4. **Seed report definitions** → Create 100+ standard reports
5. **Build department dashboards** → Role-filtered department homes
6. **Create default layouts** → Per-role dashboard defaults
7. **Implement middleware** → Enforce permissions on all routes
8. **Document permissions** → Create permission reference guide

**See**: `RBAC_FUNCTIONALITY_MATRIX.md` for detailed functionality by role and department
**See**: `RBAC_REPORTING_REQUIREMENTS.md` for comprehensive reporting requirements
**See**: `RBAC_IMPLEMENTATION_PLAN.md` for step-by-step implementation roadmap

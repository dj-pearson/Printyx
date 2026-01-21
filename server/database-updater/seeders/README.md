# Database Seeders

This directory contains database seeder scripts for populating initial data.

## Available Seeders

### RBAC Seeder (`rbac-seeder.ts`)

Seeds the complete Role-Based Access Control (RBAC) system foundation.

**What it seeds:**

- **150+ Granular Permissions** across all modules (sales, service, operations, finance, admin, reporting, audit, platform)
- **24 Role Templates** covering all 8 hierarchy levels and departments
- **Role-Permission Mappings** - automatic linking of permissions to roles
- **Organizational Structure** support (platform, company, regional, location)

**Role Templates Included:**

| Level                    | Role Templates                                                                      | Count |
| ------------------------ | ----------------------------------------------------------------------------------- | ----- |
| **Level 8** (Platform)   | Platform Administrator                                                              | 1     |
| **Level 7** (Executive)  | CEO, CFO, COO                                                                       | 3     |
| **Level 6** (Director)   | VP Sales, VP Service, Director Operations, Controller                               | 4     |
| **Level 5** (Regional)   | Regional Sales Director, Regional Service Manager                                   | 2     |
| **Level 4** (Manager)    | Sales Manager, Service Manager, Operations Manager, Finance Manager, Branch Manager | 5     |
| **Level 3** (Supervisor) | Sales Supervisor, Service Supervisor, Warehouse Supervisor                          | 3     |
| **Level 2** (Team Lead)  | Senior Sales Rep, Senior Technician                                                 | 2     |
| **Level 1** (Individual) | Sales Rep, Field Technician, Warehouse Associate, Accounting Clerk                  | 4     |

**Permission Categories:**

- **Sales**: Lead management, opportunities, quotes, customers, territories, commissions (45+ permissions)
- **Service**: Tickets, equipment, parts, work orders, schedules (30+ permissions)
- **Operations**: Inventory, warehouse, purchase orders (15+ permissions)
- **Finance**: AR, AP, GL, invoices, payments, reporting (20+ permissions)
- **Admin**: User management, role management, impersonation (15+ permissions)
- **Reporting**: Reports, dashboards, KPIs, exports (10+ permissions)
- **Audit**: Audit logs, compliance (5+ permissions)
- **Platform**: Cross-tenant access, subscriptions, provisioning (5+ permissions)

### Usage

```bash
# Run the RBAC seeder
npm run seed:rbac
```

**Output:**

```
🌱 Starting RBAC Seeder...

📝 Seeding permissions...
✅ Created 150 permissions (150 total)

👥 Seeding roles...
✅ Created 24 roles (24 total)

🔗 Mapping role-permission relationships...
✅ Created 450+ role-permission mappings

============================================================
✅ RBAC Seeding Complete!
============================================================
📊 Summary:
   - Permissions: 150
   - Roles: 24
   - Mappings: 450+

🎯 Role Breakdown:
   - Level 8 (Platform): 1 role
   - Level 7 (Executive): 3 roles
   - Level 6 (Director): 4 roles
   - Level 5 (Regional): 2 roles
   - Level 4 (Manager): 5 roles
   - Level 3 (Supervisor): 3 roles
   - Level 2 (Team Lead): 2 roles
   - Level 1 (Individual): 4 roles
============================================================
```

### When to Run

**Initial Setup:**
Run once when setting up a new environment (development, staging, production):

```bash
npm run seed:rbac
```

**After Schema Changes:**
If you modify the enhanced RBAC schema (`server/enhanced-rbac-schema.ts`), you may need to run migrations first:

```bash
npm run db:push
npm run seed:rbac
```

**Idempotent:**
The seeder is designed to be idempotent - it will skip existing permissions and roles rather than creating duplicates. Safe to run multiple times.

### Customization

To add new permissions or roles:

1. **Add Permission:**
   Edit `rbac-seeder.ts` and add to `PERMISSION_DEFINITIONS`:

   ```typescript
   {
     name: 'My New Permission',
     code: 'module.resource.action_scope',
     description: 'Description of permission',
     module: 'sales',
     resourceType: 'lead',
     action: 'custom_action',
     scopeLevel: 'own',
     riskLevel: 'low',
   },
   ```

2. **Add Role:**
   Add to `ROLE_TEMPLATES`:

   ```typescript
   {
     name: 'My Custom Role',
     code: 'CUSTOM_ROLE',
     description: 'Description',
     hierarchyLevel: 'level_4',
     organizationalTier: 'location',
     department: 'sales',
     permissions: [
       'sales.lead.view_own',
       'sales.lead.create',
       // ... more permission codes
     ],
     isSystemRole: false,
   },
   ```

3. **Re-run seeder:**
   ```bash
   npm run seed:rbac
   ```

### Permission Naming Convention

Permissions follow this format: `<module>.<resource>.<action>_<scope>`

**Examples:**

- `sales.lead.view_own` - View only leads assigned to me
- `sales.lead.view_team` - View leads for my team
- `sales.lead.view_location` - View all leads at my location
- `sales.quote.approve_standard` - Approve standard quotes
- `finance.payment.process` - Process vendor payments

**Modules:**

- `sales` - Sales and CRM operations
- `service` - Service dispatch and tickets
- `operations` - Warehouse and inventory
- `finance` - Financial operations
- `admin` - User and role management
- `reporting` - Reports and dashboards
- `audit` - Audit logs
- `platform` - Platform-level operations (Printyx staff)

**Scope Levels:**

- `own` - Only data assigned to/owned by the user
- `team` - User + their direct reports
- `location` - All data at user's location
- `regional` - All data in user's region (multiple locations)
- `company` - All company data (all locations/regions)
- `platform` - Cross-tenant data (Printyx staff only)

### Integration with Middleware

After seeding, use the permissions in middleware:

```typescript
import { requirePermission } from './middleware/enhanced-rbac-middleware';

// Require single permission
router.get('/leads',
  requireAuth,
  requirePermission('sales.lead.view_own'),
  async (req, res) => { ... }
);

// Require multiple permissions (ANY)
router.post('/quotes',
  requireAuth,
  requirePermission(['sales.quote.create', 'sales.quote.approve_standard']),
  async (req, res) => { ... }
);

// Check permission in code
if (await hasPermission(userId, 'sales.lead.delete')) {
  // User can delete leads
}
```

### Troubleshooting

**Error: "Permission not found"**

- Ensure you've run the seeder: `npm run seed:rbac`
- Check permission code spelling

**Error: "Role already exists"**

- Normal - seeder skips existing roles
- If you need to update a role, delete it first or modify the seeder to handle updates

**Error: "Cannot insert duplicate key"**

- Seeder has already run successfully
- Safe to ignore or check if you need to modify existing data

### Data Model

**Tables:**

- `permissions` - Granular permission definitions
- `enhanced_roles` - Role definitions with hierarchy
- `role_permissions` - Junction table (roles ↔ permissions)
- `user_role_assignments` - User role assignments (not seeded, managed at runtime)
- `organizational_units` - Company/regional/location structure (not seeded here)

## Report Definitions Seeder (`report-seeder.ts`)

Seeds 75+ comprehensive report definitions across all departments and hierarchy levels.

**What it seeds:**

- **24 Sales Reports**: Personal pipeline to board-level sales analytics
- **19 Service Reports**: Technician productivity to executive service dashboards
- **11 Operations Reports**: Warehouse productivity to supply chain analytics
- **10 Finance Reports**: AR/AP aging to profitability analysis
- **4 Executive Reports**: CEO dashboards and board reports
- **4 Platform Admin Reports**: System metrics, tenant usage, billing, and security
- **3 Cross-Department Reports**: Customer 360, employee performance, location performance

**Each report includes:**

- SQL query templates with parameterization
- Required permissions mapping (integrates with RBAC)
- Default filters and groupings
- Visualization configurations (charts, tables, dashboards)
- Export capabilities (CSV, Excel, PDF, PowerPoint)
- Scheduling capabilities
- Cache and performance settings
- Real-time vs batch processing flags

### Usage

```bash
# Run the report definitions seeder
npm run seed:reports
```

**Prerequisites:**

- RBAC seeder must be run first: `npm run seed:rbac`
- Database schema must include reporting tables (from `shared/reporting-schema.ts`)

**Output:**

```
🌱 Starting Report Definitions Seeder...

📊 Seeding 75 report definitions...

  ✅ SALES_PERSONAL_PIPELINE                - Personal Pipeline Report
  ✅ SALES_PERSONAL_ACTIVITY                - Personal Activity Report
  ...
  ✅ CROSS_LOCATION_PERFORMANCE             - Location Performance Report (Multi-Department)

============================================================
📈 SEEDING SUMMARY

  Total Reports Processed: 75
  ✅ Successfully Seeded:  75
  ❌ Errors:               0

============================================================
✅ Report Definitions Seeder Completed!
```

**Report Categories:**

| Category             | Count | Access Levels |
| -------------------- | ----- | ------------- |
| **Sales**            | 24    | Levels 1-6    |
| **Service**          | 19    | Levels 1-6    |
| **Operations**       | 11    | Levels 1-6    |
| **Finance**          | 10    | Levels 1-6    |
| **Executive**        | 4     | Levels 6-7    |
| **Platform Admin**   | 4     | Level 8       |
| **Cross-Department** | 3     | Levels 3-4    |

## KPI Definitions Seeder (`kpi-seeder.ts`)

Seeds 43 comprehensive Key Performance Indicator (KPI) definitions across all departments and hierarchy levels.

**What it seeds:**

- **11 Sales KPIs**: Personal quota attainment, win rate, pipeline metrics, deal size, sales cycle
- **8 Service KPIs**: First-time fix rate, CSAT, utilization, SLA compliance, service revenue/margin
- **6 Operations KPIs**: Inventory accuracy/turns, fill rate, FPY, on-time delivery, warehouse productivity
- **7 Finance KPIs**: Revenue growth, gross/operating/EBITDA margins, DSO, current/quick ratios
- **6 Executive KPIs**: CAC, CLV, CLV:CAC ratio, NPS, employee engagement, customer retention
- **5 Platform Admin KPIs**: Uptime, API response time, error rate, MRR, tenant churn

**Each KPI includes:**

- SQL calculation queries with parameterization
- Target values and thresholds
- Display formatting (currency, percentage, decimal, number)
- Color schemes with performance ranges (red/yellow/green/blue)
- Alert configurations with critical/warning thresholds
- Refresh and cache frequencies
- RBAC permission requirements
- Organizational scope mapping (individual → platform)
- High priority flags for critical metrics

### Usage

```bash
# Run the KPI definitions seeder
npm run seed:kpis
```

**Prerequisites:**

- RBAC seeder must be run first: `npm run seed:rbac`
- Database schema must include KPI tables (from `shared/reporting-schema.ts`)

**Output:**

```
🌱 Starting KPI Definitions Seeder...

📊 Seeding 43 KPI definitions...

  ✅ SALES_PERSONAL_QUOTA_ATTAINMENT          - Personal Quota Attainment
  ✅ SALES_PERSONAL_WIN_RATE                  - Personal Win Rate
  ...
  ✅ PLATFORM_TENANT_CHURN_RATE               - Tenant Churn Rate

════════════════════════════════════════════════════════════════
📈 SEEDING SUMMARY

  Total KPIs Processed: 43
  ✅ Successfully Seeded:  43
  ❌ Errors:               0

════════════════════════════════════════════════════════════════
✅ KPI Definitions Seeder Completed!
```

**KPI Categories:**

| Category           | Count | Access Levels | Examples                                                                    |
| ------------------ | ----- | ------------- | --------------------------------------------------------------------------- |
| **Sales**          | 11    | Levels 1-7    | Quota attainment, win rate, pipeline value/coverage, deal size, sales cycle |
| **Service**        | 8     | Levels 1-6    | FTF rate, CSAT, utilization, SLA compliance, service revenue/margin         |
| **Operations**     | 6     | Levels 3-4    | Inventory accuracy/turns, fill rate, FPY, on-time delivery, productivity    |
| **Finance**        | 7     | Levels 6-7    | Revenue growth, margins (gross/operating/EBITDA), DSO, liquidity ratios     |
| **Executive**      | 6     | Level 7       | CAC, CLV, CLV:CAC ratio, NPS, employee engagement, retention                |
| **Platform Admin** | 5     | Level 8       | Uptime, API performance, error rate, MRR, tenant churn                      |

**Display Formats:**

- **Currency**: `$1,234,567` (prefix: $, decimalPlaces: 0)
- **Percentage**: `85.5%` (suffix: %, decimalPlaces: 1)
- **Decimal**: `3.2x` (suffix: x, decimalPlaces: 1)
- **Number**: `45 days` (suffix: days, decimalPlaces: 0)

**Color Schemes:**
KPIs use performance-based color coding:

- 🔴 **Red** (#ff4d4f): Below target / Poor performance
- 🟡 **Yellow** (#faad14): Near target / Fair performance
- 🟢 **Green** (#52c41a): On target / Good performance
- 🔵 **Blue** (#1890ff): Exceeds target / Excellent performance

Some KPIs use inverted color schemes (lower is better):

- Sales Cycle Days: Lower days = Blue (excellent)
- DSO: Lower days = Blue (excellent)
- API Response Time: Lower ms = Blue (excellent)
- Error Rate: Lower % = Blue (excellent)

**Alert Configuration:**
High-priority KPIs have automated alerts:

- **Critical threshold**: Immediate notification (e.g., Quota < 70%)
- **Warning threshold**: Proactive notification (e.g., Quota < 85%)
- **Alert message**: Custom message describing the issue

Examples of high-priority KPIs with alerts:

- Personal Quota Attainment (critical: 70%, warning: 85%)
- Pipeline Coverage (critical: 2.0x, warning: 2.5x)
- First-Time Fix Rate (critical: 70%, warning: 80%)
- SLA Compliance (critical: 90%, warning: 93%)
- Platform Uptime (critical: 99.0%, warning: 99.5%)

### Next Steps

After seeding RBAC, Reports, and KPIs:

1. **Create organizational units** for your company/regions/locations
2. **Assign roles to users** via admin UI or API
3. **Test permission enforcement** across all routes
4. **Access reports** through the reporting UI at `/reports`
5. **Monitor KPIs** through executive dashboards and real-time widgets

### Related Documentation

- `docs/RBAC_CURRENT_STATE.md` - Current RBAC implementation
- `docs/RBAC_IDEAL_STRUCTURE.md` - Ideal role structure design
- `docs/RBAC_FUNCTIONALITY_MATRIX.md` - Detailed functionality by role
- `docs/RBAC_IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `server/enhanced-rbac-schema.ts` - Database schema
- `server/middleware/enhanced-rbac-middleware.ts` - Middleware implementation (to be created)

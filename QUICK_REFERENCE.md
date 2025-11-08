# PRINTYX - QUICK REFERENCE GUIDE

## Feature Inventory Summary

### By the Numbers
- **160+ Pages**: Application screens and routes
- **75+ Route Files**: Specialized API endpoint modules
- **26 Schema Files**: Feature-specific data models
- **13 Major Domains**: Main feature hubs/categories
- **137 Database Tables**: Core business entities
- **4-Tier Organization**: Platform → Company → Region → Location
- **8-Level Role Hierarchy**: RBAC permission structure

---

## Feature Domains Quick Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRINTYX PLATFORM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  SALES HUB   │  │ SERVICE HUB  │  │ PRODUCT HUB  │          │
│  │  17 features │  │  18 features │  │  9 features  │          │
│  │  (CRM, Leads,│  │  (Dispatch,  │  │  (Catalog,   │          │
│  │   Quotes,    │  │   Technician,│  │   Accessories│          │
│  │   Pipeline)  │  │   Mobile Ops)│  │   Supplies)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ EQUIPMENT    │  │ BILLING HUB  │  │ REPORTS HUB  │          │
│  │ LIFECYCLE    │  │  11 features │  │  10 features │          │
│  │  6 features  │  │  (Invoices,  │  │  (Analytics, │          │
│  │  (PO, Ware   │  │   Leases,    │  │   Reporting) │          │
│  │   Inventory) │  │   AR/AP)     │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   AI HUB     │  │   KNOWLEDGE  │  │INTEGRATIONS  │          │
│  │  6 features  │  │     BASE     │  │  5 features  │          │
│  │  (Employees, │  │              │  │  (Salesforce,│          │
│  │   Calendar,  │  │  (Articles,  │  │   QBO, E-Sig)│          │
│  │   Meetings)  │  │  Categories) │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ TASK MGMT    │  │  SYS ADMIN   │  │  CUSTOMERS   │          │
│  │  2 features  │  │  9 features  │  │  3 features  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            PLATFORM ADMIN (Super Admin Only)               │ │
│  │  Tenants, Users, Roles, Security, Database, SEO, etc.     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Data Flows

### Most Connected Path: Lead → Customer → Service → Billing
```
Lead Management
    ↓
Lead Enrichment (Apollo/ZoomInfo)
    ↓
Sales Pipeline & Forecasting
    ↓
Quote → Proposal Generation
    ↓
E-Signature Integration
    ↓
Convert to Customer
    ↓
Equipment Onboarding
    ↓
Service Contracts
    ↓
Service Dispatch & Mobile Ops
    ↓
Meter Readings (Usage Capture)
    ↓
Meter-Based Billing
    ↓
Invoices → Payments (Stripe)
    ↓
Financial Reporting & Forecasting
```

---

## Feature Tier Classification

### TIER 1: Core/Highly Integrated (Critical Path)
- **CRM Pipeline** - Lead → Customer → Quote → Contract → Invoice
- **Equipment Lifecycle** - Purchase → Delivery → Service → Lease → Billing
- **Service Dispatch** - Ticket → Technician → Field ops → Completion
- **Billing Operations** - Invoices → AR/AP → GL → Reporting
- **Mobile Field Ops** - Dispatch → Navigation → Documentation → Completion

### TIER 2: Well Integrated (Supporting)
- Sales Pipeline & Forecasting
- Preventive Maintenance Automation
- Meter Readings (Usage Tracking)
- Lease Management
- Service Analytics

### TIER 3: Partially Integrated (Standalone)
- Onboarding Checklists (Could integrate with CSM)
- Demo Scheduling (Weak lead linkage)
- Fleet Monitoring (Limited dispatch integration)
- Commission Management (Not linked to deal closure)
- Pricing Management (Not auto-synced to quotes)

### TIER 4: Standalone/Low Integration
- Social Media Generator
- Customer Number Settings
- Knowledge Base (Read-only)
- Customer Portal (Limited integration)
- Manufacturer Integration (Minimal automation)

---

## API Architecture Overview

### Route Organization
```
Main Routes File: routes.ts (514 KB - largest file)
├── Specialized Modules (70+ files)
├── Key Modules:
│   ├── routes-business-records.ts
│   ├── routes-service-dispatch.ts
│   ├── routes-billing.ts
│   ├── routes-crm-goals.ts
│   ├── routes-tasks.ts
│   ├── routes-onboarding.ts
│   ├── routes-integrations.ts
│   ├── routes-salesforce-integration.ts
│   ├── routes-quickbooks-integration.ts
│   ├── routes-proposals.ts
│   ├── routes-reporting.ts
│   └── routes-workflow-automation.ts
│
└── Cross-Cutting Services:
    ├── Dashboard Service (unified metrics)
    ├── Stripe Service (payments)
    ├── Storage Layer
    ├── Tenancy Middleware
    └── RBAC Enforcement
```

---

## Feature Strengths & Gaps

### Strengths
✓ Unified Lead-to-Customer conversion with data preservation
✓ Comprehensive equipment lifecycle tracking
✓ Mobile-first field operations with GPS/location
✓ Multi-tenant architecture with RLS
✓ Enterprise billing (meter-based, tiered rates, leases)
✓ Real-time service dispatch optimization
✓ Deep Salesforce & QuickBooks integration
✓ Role-based access control (8 levels)
✓ Mobile-optimized responsive design

### Opportunities for Integration
▸ Customer Portal ← Service Tickets visibility
▸ Demo Scheduling → Auto-create followup tasks
▸ Commission ← Auto-trigger on deal close
▸ Pricing ← Real-time sync to quote builder
▸ Manufacturer Integration → Trigger preventive maintenance
▸ Fleet Monitoring → Inform service dispatch routes
▸ Knowledge Base → Contextual help & recommendations
▸ Onboarding → Customer success tracking

---

## Component Organization

### Frontend Components by Feature
```
client/src/components/
├── dashboard/          - Modular dashboard components
├── crm/               - Sales/CRM features (leads, contacts, deals)
├── service/           - Service tickets, dispatch, technician workflows
├── quote-builder/     - Quote creation and line items
├── proposal-builder/  - Proposal generation
├── mobile/            - Mobile-optimized components & navigation
├── customer-portal/   - Customer self-service features
├── tasks/             - Task management & workflows
├── reports/           - Report generation & visualization
├── analytics/         - Analytics & KPI components
├── integrations/      - External integration UIs
├── contextual/        - Contextual help & alerts
├── customer/          - Customer management & profiles
├── product-management/- Product catalog & accessories
├── forms/             - Reusable form components
├── layout/            - Navigation, sidebar, header
└── ui/                - Base UI components (Radix + shadcn)
```

---

## Database Schema Summary

### Business Core Schemas
- **schema.ts** - Main: users, tenants, companies, leads, customers, equipment, services, billing
- **equipment-schema.ts** - Equipment lifecycle, deliveries, installations, certifications
- **service-analysis-schema.ts** - Service calls, parts orders, analysis types
- **mobile-service-schema.ts** - Field sessions, time tracking, location history

### Sales/CRM Schemas
- **lead-scoring-schema.ts** - Lead enrichment, Apollo integration
- **quote-proposal-schema.ts** - Quotes, proposals, line items
- **apollo-schema.ts** - Apollo.io data model

### Finance Schemas
- **advanced-billing-schema.ts** - Complex billing rules, tiered rates
- **commission-schema.ts** - Commission plans, calculations, disputes
- **quickbooks-schema.ts** - QBO integration mappings

### Platform Schemas
- **security-schema.ts** - Access controls, audit logs
- **auth-schema.ts** - Authentication, sessions, MFA
- **customer-success-schema.ts** - CSM health scores, usage
- **knowledge-base-schema.ts** - Articles, categories, revisions

---

## Key Statistics

### Page/Route Count
- Total Pages: 160+
- Total Route Files: 75+
- Main Route File Lines: ~6,000+
- Largest Page Component: 127KB (CustomerDetail.tsx)
- Average Page Size: ~30KB

### Database
- Total Tables: 137
- Largest: businessRecords (lead/customer unified model)
- Key Relationships: Tenant → Company → BusinessRecord → Activities/Contacts/Equipment

### User Journey Complexity
- Lead → Customer → Billing: 9 major steps
- Equipment Lifecycle: 6 major stages
- Service Dispatch: 6 operational phases
- Sales → Commission: 5 major steps

---

## Development Patterns

### API Endpoint Patterns
```
/api/customers              - Customer CRUD
/api/leads                  - Lead CRUD & conversion
/api/service-tickets        - Service dispatch
/api/quotes & /api/proposals - Quote/proposal lifecycle
/api/invoices               - Billing operations
/api/service-dispatch/*     - Dispatch operations (recommendations, availability, etc.)
/api/commission/*           - Commission management
/api/integrations/*         - External integrations
/api/tasks                  - Task CRUD
/api/analytics/*            - Dashboard & analytics
/api/billing/*              - Billing operations
```

### Component Patterns
- React hooks + TanStack Query (formerly React Query)
- Form validation with Zod schemas
- Responsive design with Tailwind CSS
- Modal dialogs for CRUD operations
- Tab-based UIs for related entities
- Real-time updates via WebSocket

### Schema Patterns
- Drizzle ORM with PostgreSQL
- Zod validation schemas
- Type-safe with TypeScript
- Multi-tenant filtering via middleware
- Audit logging for compliance

---

## Recommended Next Steps for Understanding

### For Feature Deep Dive:
1. Pick a feature domain (e.g., Sales Hub)
2. Examine route file (routes-crm-goals.ts)
3. Review component structure (components/dashboard, components/leads)
4. Check schema definitions (schema.ts for leads/customers)
5. Trace API integration in hooks (hooks/useCRM*)

### For Integration Work:
1. Identify source and target features
2. Find relevant route files
3. Check shared data models
4. Design middleware/hooks for connection
5. Add cross-module hooks (useCrossModuleIntegration)

### For New Feature Development:
1. Create feature-specific schema file
2. Add route file in server/
3. Register routes in routes.ts
4. Create page component in client/src/pages/
5. Add navigation items in RoleAwareCollapsibleSidebar
6. Create component sub-directory if complex


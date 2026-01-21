# Living Technical Specification - Printyx

**Last Updated:** 2025-11-11
**Version:** 1.0
**Status:** Current Production State

---

## Executive Summary

**Printyx** is an enterprise-grade, multi-tenant SaaS platform designed for copier/printer dealer businesses. It provides comprehensive business management capabilities including CRM, service dispatch, inventory management, billing, and analytics.

**Platform Scale:**

- 169 frontend pages
- 126+ database tables
- 90+ API route handlers
- 40+ business logic services
- 8+ external integrations

**Technology Stack:**

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Authentication:** Replit Auth (OpenID Connect)
- **Hosting:** Replit with autoscale deployment

---

## 1. Project Structure & Organization

### Root Directory Structure

```
Printyx/
├── client/src/              # React frontend application
│   ├── components/          # Reusable UI components
│   ├── pages/              # 169 route/page components
│   ├── hooks/              # 13 custom React hooks
│   └── lib/                # Utilities and configurations
├── server/                 # Express.js backend
│   ├── routes*.ts          # 90+ modular route handlers
│   ├── middleware/         # Express middleware
│   ├── services/           # 40+ business logic services
│   └── integrations/       # Third-party API integrations
├── shared/                 # Shared TypeScript schemas
│   └── schema.ts           # Drizzle ORM schemas (126+ tables)
├── testing/                # Test suites
├── attached_assets/        # Static asset storage
└── db/                     # Database migrations
```

### Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Key Configuration Files

- **package.json** - 140+ npm dependencies
- **vite.config.ts** - Frontend build with code splitting
- **drizzle.config.ts** - Primary database configuration
- **drizzle.forecasting.config.ts** - Secondary forecasting database
- **tsconfig.json** - TypeScript strict mode configuration
- **.replit** - Deployment configuration

---

## 2. Frontend Architecture

### Technology Stack

- **Framework:** React 18.3.1 with TypeScript
- **Build Tool:** Vite 5.4.2
- **Routing:** Wouter 3.3.5 (lightweight client-side routing)
- **State Management:** TanStack Query v5 (React Query)
- **UI Components:** Radix UI + shadcn/ui + Tailwind CSS
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts for data visualization

### Component Architecture

#### UI Component Categories (20+ categories):

1. **Core UI Components** - Buttons, inputs, cards, dialogs, dropdowns
2. **Service Management** - ServiceRequestForm, TechnicianWorkflowView, DispatchBoard
3. **Customer Management** - CustomerForm, CustomerDetailView, BusinessRecordView
4. **Mobile Components** - MobileTechnicianView, MobileServiceRequestDetails
5. **Dashboard Components** - DashboardMetrics, RevenueChart, ServiceMetricsChart
6. **Report Components** - ReportBuilder, ReportViewer, ExportDialog
7. **Inventory Components** - InventoryGrid, WarehouseTransferForm
8. **Billing Components** - InvoiceGenerator, PaymentForm, MeterBillingForm
9. **Quote Components** - QuoteBuilder, VisualProposalBuilder
10. **Calendar Components** - ServiceCalendar, TechnicianSchedule
11. **Integration Components** - SalesforceSync, QuickBooksConnect
12. **AI Components** - AIAssistant, PredictiveMaintenanceAlert
13. **Analytics Components** - PerformanceMetrics, CustomReportBuilder
14. **Settings Components** - TenantSettings, UserRoleManager
15. **Authentication Components** - LoginForm, MFASetup
16. **Subscription Components** - SubscriptionManager, UsageTracker
17. **Customer Portal Components** - PortalDashboard, SupplyOrderForm
18. **Equipment Components** - EquipmentDetails, MaintenanceHistory
19. **Task Management** - TaskBoard, TaskAssignment
20. **Communication Components** - ChatInterface, NotificationCenter

### Page Structure (169 Pages)

#### CRM & Sales (25+ pages)

- Lead Management, Deal Pipeline, Contact Management
- Sales Forecasting, Commission Tracking, Territory Management
- Opportunity Tracking, Quote Management, Proposal Builder

#### Service Management (30+ pages)

- Service Request Management, Dispatch Board, Technician Workflow
- Equipment Maintenance, Preventive Maintenance, Service Calendar
- Parts Management, Remote Monitoring, Service Analytics

#### Inventory & Warehouse (20+ pages)

- Product Catalog, Warehouse Management, Equipment Tracking
- Parts Inventory, Supplier Management, Purchase Orders
- Transfer Management, Receiving, Stock Adjustments

#### Billing & Finance (25+ pages)

- Invoice Management, Meter Billing, Contract Management
- Payment Processing, Credit Management, Collections
- Financial Reports, Revenue Recognition, Tax Management

#### Customer Portal (15+ pages)

- Customer Dashboard, Supply Ordering, Meter Submission
- Service Request Creation, Invoice Viewing, Payment Portal
- Equipment Management, Document Access, Support

#### Analytics & Reporting (20+ pages)

- Executive Dashboard, Service Analytics, Sales Reports
- Financial Reports, Inventory Reports, Custom Report Builder
- Predictive Analytics, Performance Metrics, KPI Tracking

#### Administration (30+ pages)

- User Management, Role Management, Tenant Settings
- Integration Settings, Subscription Management, Billing Settings
- Security Settings, Audit Logs, System Configuration

### Custom React Hooks (13 hooks)

```typescript
useToast(); // Toast notifications
useUser(); // Current user context
useSubscription(); // Subscription status
useTenant(); // Current tenant context
usePermissions(); // RBAC permissions
useBusinessRecords(); // Business records management
useServiceRequests(); // Service request operations
useInventory(); // Inventory operations
useInvoices(); // Invoice management
useQuotes(); // Quote operations
useReports(); // Report generation
useIntegrations(); // External integrations
useAI(); // AI assistant features
```

### State Management Strategy

- **TanStack Query** for server state (API calls, caching, optimistic updates)
- **React Context** for global app state (user, tenant, theme)
- **Local State** with useState/useReducer for component-specific state
- **Form State** managed by React Hook Form

### Build Configuration

- **Code Splitting:** Vendor chunks for React, UI components, charts
- **Optimization:** Tree shaking, minification, lazy loading
- **Assets:** Image optimization, font loading
- **Environment Variables:** API endpoints, feature flags

---

## 3. Backend Architecture

### Technology Stack

- **Framework:** Express.js 4.19.2 with TypeScript
- **ORM:** Drizzle ORM with PostgreSQL adapter
- **Database:** PostgreSQL 16 (Neon serverless)
- **Session Store:** PostgreSQL session storage
- **Authentication:** Replit Auth (OpenID Connect)
- **Validation:** Zod schemas

### Middleware Stack (Order of Execution)

1. **CORS Middleware** - Cross-origin resource sharing
2. **Body Parser** - JSON request parsing
3. **Session Middleware** - PostgreSQL session store (7-day TTL)
4. **Replit Auth** - OpenID Connect authentication
5. **Tenant Resolution** - Subdomain/path-based tenant detection
6. **RBAC Middleware** - Role-based access control
7. **Cache Middleware** - ETag and tenant-aware caching
8. **Subscription Middleware** - Feature gating and usage limits
9. **Rate Limiting** - API request throttling
10. **Error Handler** - Centralized error handling

### Route Organization (90+ Files)

#### Core Business Routes

```
server/
├── routes.ts                    # Main router aggregator
├── routesAuth.ts               # Authentication endpoints
├── routesUsers.ts              # User management
├── routesTenants.ts            # Tenant administration
├── routesBusinessRecords.ts    # Unified lead/customer records
├── routesCustomers.ts          # Customer operations
├── routesLeads.ts              # Lead management
├── routesDeals.ts              # Deal pipeline
├── routesContacts.ts           # Contact management
├── routesServiceRequests.ts    # Service request handling
├── routesDispatch.ts           # Dispatch operations
├── routesTechnicians.ts        # Technician management
├── routesEquipment.ts          # Equipment tracking
├── routesInventory.ts          # Inventory operations
├── routesWarehouse.ts          # Warehouse management
├── routesProducts.ts           # Product catalog
├── routesParts.ts              # Parts management
├── routesInvoices.ts           # Invoice generation
├── routesMeterBilling.ts       # Meter-based billing
├── routesPayments.ts           # Payment processing
├── routesContracts.ts          # Contract management
├── routesQuotes.ts             # Quote management
├── routesProposals.ts          # Proposal builder
├── routesReports.ts            # Report generation
├── routesAnalytics.ts          # Analytics endpoints
├── routesIntegrations.ts       # Third-party integrations
├── routesSubscriptions.ts      # Subscription management
├── routesAI.ts                 # AI assistant endpoints
└── ... (60+ additional route files)
```

### Business Logic Services (40+ Services)

#### Service Categories

```typescript
// Authentication & Authorization
services / authService.ts;
services / rbacService.ts;
services / permissionService.ts;
services / sessionService.ts;

// CRM & Sales
services / businessRecordService.ts;
services / leadService.ts;
services / customerService.ts;
services / dealService.ts;
services / forecastingService.ts;
services / commissionService.ts;

// Service Management
services / serviceRequestService.ts;
services / dispatchService.ts;
services / technicianService.ts;
services / equipmentService.ts;
services / maintenanceService.ts;
services / remoteMonitoringService.ts;

// Inventory & Warehouse
services / inventoryService.ts;
services / warehouseService.ts;
services / productService.ts;
services / partsService.ts;
services / supplierService.ts;

// Billing & Finance
services / invoiceService.ts;
services / meterBillingService.ts;
services / paymentService.ts;
services / contractService.ts;
services / billingService.ts;

// Integrations
services / integrationService.ts;
services / salesforceService.ts;
services / quickbooksService.ts;
services / stripeService.ts;
services / calendarService.ts;

// Analytics & Reporting
services / analyticsService.ts;
services / reportService.ts;
services / forecastingService.ts;
services / aiService.ts;

// System Services
services / cacheService.ts;
services / notificationService.ts;
services / emailService.ts;
services / storageService.ts;
services / subscriptionService.ts;
```

### API Design Patterns

#### RESTful Endpoints

```
GET    /api/{resource}              # List resources (paginated)
GET    /api/{resource}/:id          # Get single resource
POST   /api/{resource}              # Create resource
PATCH  /api/{resource}/:id          # Update resource
DELETE /api/{resource}/:id          # Delete resource
POST   /api/{resource}/:id/action   # Custom actions
```

#### Tenant-Aware Queries

All database queries automatically include tenant filtering:

```typescript
const customers = await db.select().from(customers).where(eq(customers.tenantId, req.tenantId));
```

#### Error Handling

Standardized error responses:

```typescript
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {}
}
```

---

## 4. Database Architecture

### Database Configuration

- **Primary Database:** Neon PostgreSQL (main business data)
- **Secondary Database:** Neon PostgreSQL (forecasting/analytics)
- **ORM:** Drizzle ORM with type-safe queries
- **Migration Tool:** Drizzle Kit

### Schema Organization (126+ Tables)

#### Core Schema (`shared/schema.ts`)

```typescript
// Organizational Hierarchy
-platforms - // Top-level platform management
  tenants - // Company/dealer level
  regions - // Regional offices
  locations - // Physical locations
  // Identity & Access
  users - // User accounts
  sessions - // Session storage
  roles - // Role definitions
  permissions - // Permission definitions
  userRoles - // User-role assignments
  rolePermissions - // Role-permission assignments
  securityTokens - // API tokens
  mfaBackupCodes - // Multi-factor auth backup codes
  // CRM & Sales
  businessRecords - // Unified lead/customer records
  leads - // Sales leads
  customers - // Converted customers
  contacts - // Contact persons
  deals - // Sales opportunities
  dealStages - // Deal pipeline stages
  activities - // Activity tracking
  notes - // Notes and comments
  salesForecasts - // Sales forecasting
  commissionStructures - // Commission plans
  territories - // Sales territories
  // Service Management
  serviceRequests - // Service tickets
  serviceTypes - // Service categories
  servicePriorities - // Priority levels
  serviceStatuses - // Status definitions
  dispatches - // Dispatch assignments
  technicians - // Technician profiles
  technicianSkills - // Skill tracking
  appointments - // Scheduled appointments
  timeEntries - // Time tracking
  equipment - // Equipment records
  equipmentTypes - // Equipment categories
  equipmentModels - // Equipment models
  maintenanceSchedules - // Preventive maintenance
  maintenanceHistory - // Service history
  remoteMonitoring - // IoT monitoring data
  parts - // Parts catalog
  partsUsage - // Parts consumption
  // Inventory & Warehouse
  products - // Product catalog
  productCategories - // Product categories
  inventory - // Inventory levels
  warehouses - // Warehouse locations
  warehouseTransfers - // Transfer transactions
  warehouseBins - // Storage locations
  stockAdjustments - // Inventory adjustments
  purchaseOrders - // PO management
  suppliers - // Supplier directory
  receiving - // Receiving transactions
  // Billing & Finance
  invoices - // Invoice records
  invoiceLineItems - // Invoice details
  payments - // Payment transactions
  paymentMethods - // Payment method storage
  contracts - // Contract management
  contractLineItems - // Contract details
  meterBillings - // Meter-based billing
  meterReadings - // Meter reading history
  creditMemos - // Credit transactions
  collections - // Collections tracking
  billingSchedules - // Recurring billing
  // Quotes & Proposals
  quotes - // Quote records
  quoteLineItems - // Quote details
  proposals - // Visual proposals
  proposalSections - // Proposal content
  pricingTiers - // Pricing structures
  // Integrations
  integrationConfigs - // Integration settings
  integrationMappings - // Field mappings
  integrationLogs - // Sync logs
  salesforceSync - // Salesforce data
  quickbooksSync - // QuickBooks data
  apiWebhooks - // Webhook configurations
  // Analytics & Reporting
  reports - // Report definitions
  reportSchedules - // Scheduled reports
  dashboards - // Dashboard configurations
  metrics - // KPI tracking
  analyticsEvents - // Event tracking
  predictiveModels - // ML models
  // Subscriptions & Usage
  subscriptionPlans - // Plan definitions
  subscriptions - // Active subscriptions
  subscriptionAddons - // Add-on products
  subscriptionUsage - // Usage tracking
  subscriptionInvoices - // Subscription billing
  // Customer Portal
  portalUsers - // Portal access
  portalSupplyOrders - // Supply orders
  portalMeterSubmissions - // Meter submissions
  portalDocuments - // Document sharing
  // Communication
  notifications - // System notifications
  emailTemplates - // Email templates
  emailLogs - // Email tracking
  chatMessages - // Internal chat
  chatRooms - // Chat channels
  // Tasks & Workflow
  tasks - // Task management
  taskTemplates - // Task templates
  workflows - // Workflow definitions
  workflowSteps - // Workflow steps
  approvals - // Approval workflows
  // System & Configuration
  settings - // System settings
  auditLogs - // Audit trail
  fileAttachments - // File storage
  tags - // Tagging system
  customFields - // Custom field definitions
  customFieldValues; // Custom field data
```

#### Specialized Schemas

```typescript
// Equipment Schema (schemaEquipment.ts)
- Equipment tracking, models, manufacturers
- Maintenance schedules and history
- Warranty and lifecycle management

// Service Analysis Schema (schemaServiceAnalysis.ts)
- Service analytics and metrics
- Performance tracking
- Predictive maintenance data

// Tasks Schema (schemaTasks.ts)
- Task management and templates
- Workflow automation
- Approval processes

// Security Schema (schemaSecurity.ts)
- Security tokens and API keys
- MFA backup codes
- Session management

// Forecasting Schema (schemaForecasting.ts) - Secondary DB
- Sales forecasting models
- Predictive analytics
- Historical trend data
```

### Multi-Tenant Architecture

#### 4-Tier Organizational Hierarchy

```
Platform (Top Level)
  └── Tenant (Company/Dealer)
      └── Region (Regional Office)
          └── Location (Physical Location)
```

#### Data Isolation Strategy

1. **Row-Level Security:** Every table includes `tenantId` column
2. **Query Filtering:** Middleware automatically adds tenant filter to all queries
3. **Session Isolation:** Sessions tied to tenant context
4. **Cache Isolation:** Tenant-aware caching keys

#### Tenant Resolution Methods

1. **Subdomain-based (Primary):** `{tenant}.printyx.com`
2. **Path-based (Fallback):** `/tenant/{tenantId}/...`
3. **Development Mode:** Uses default tenant from environment

### Database Enumerations

```typescript
// Service Request Status
serviceRequestStatus: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];

// Deal Status
dealStatus: ['open', 'won', 'lost', 'abandoned'];

// Payment Status
paymentStatus: ['pending', 'processing', 'completed', 'failed', 'refunded'];

// Contract Status
contractStatus: ['draft', 'active', 'expired', 'cancelled', 'renewed'];

// User Status
userStatus: ['active', 'inactive', 'suspended', 'pending'];

// Subscription Status
subscriptionStatus: ['trial', 'active', 'past_due', 'cancelled', 'expired'];

// Invoice Status
invoiceStatus: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'void'];
```

### Key Relationships

```typescript
// Business Record Relationships
businessRecords → customers (1:1 conversion)
businessRecords → leads (1:1 conversion)
businessRecords → contacts (1:many)
businessRecords → equipment (1:many)
businessRecords → serviceRequests (1:many)

// Service Management Relationships
serviceRequests → technicians (via dispatches)
serviceRequests → equipment (1:1)
serviceRequests → parts (many:many via partsUsage)
equipment → maintenanceSchedules (1:many)
equipment → maintenanceHistory (1:many)

// Financial Relationships
customers → invoices (1:many)
invoices → invoiceLineItems (1:many)
invoices → payments (1:many)
contracts → contractLineItems (1:many)
contracts → invoices (1:many)

// Inventory Relationships
products → inventory (1:many by warehouse)
warehouses → warehouseBins (1:many)
inventory → warehouseTransfers (many:many)
parts → partsUsage (1:many)
```

---

## 5. Authentication & Authorization

### Authentication System

#### Replit Auth (OpenID Connect)

- **Provider:** Replit OpenID Connect
- **Flow:** Authorization Code with PKCE
- **Session Storage:** PostgreSQL (connect-pg-simple)
- **Session Duration:** 7 days
- **Token Refresh:** Automatic via middleware

#### Authentication Flow

```
1. User visits protected route
2. Redirected to Replit Auth login
3. User authenticates with Replit
4. Redirected back with authorization code
5. Backend exchanges code for tokens
6. Session created in PostgreSQL
7. User context attached to request
```

#### Multi-Factor Authentication (MFA)

- **TOTP-based:** Time-based one-time passwords
- **Backup Codes:** 10 single-use backup codes per user
- **Recovery:** Email-based account recovery
- **Audit Logging:** All MFA events logged

### Authorization System (RBAC)

#### Role Hierarchy (7 Levels)

```
1. Individual User        - Basic user access
2. Manager               - Team management
3. Location Admin        - Location-level administration
4. Regional Admin        - Multi-location administration
5. Tenant Admin          - Company-wide administration
6. Support Admin         - Cross-tenant support access
7. Platform Admin        - System-wide administration
```

#### Permission Structure

```typescript
{
  resource: string,      // e.g., 'customers', 'invoices'
  action: string,        // e.g., 'read', 'write', 'delete'
  scope: string,         // e.g., 'own', 'location', 'tenant'
  conditions?: object    // Optional conditions
}
```

#### Permission Examples

```typescript
// Read own customers
{ resource: 'customers', action: 'read', scope: 'own' }

// Write all customers in location
{ resource: 'customers', action: 'write', scope: 'location' }

// Delete any customer in tenant
{ resource: 'customers', action: 'delete', scope: 'tenant' }

// Wildcard permissions (admin)
{ resource: '*', action: '*', scope: 'tenant' }
```

#### RBAC Middleware

- **Route Protection:** `requireRole(['Manager', 'Tenant Admin'])`
- **Permission Checks:** `requirePermission('customers', 'write')`
- **Resource Ownership:** Automatic scope enforcement
- **Caching:** Permission cache with 5-minute TTL

#### Access Control Implementation

```typescript
// Route-level protection
router.get(
  '/customers',
  requireAuth(),
  requirePermission('customers', 'read'),
  async (req, res) => {
    /* ... */
  },
);

// Service-level checks
if (!hasPermission(user, 'customers', 'delete', 'tenant')) {
  throw new ForbiddenError();
}
```

### Security Features

#### API Security

- **Rate Limiting:** 100 requests/minute per IP
- **CORS:** Configured per tenant domain
- **CSRF Protection:** Token-based protection
- **XSS Prevention:** Content Security Policy headers
- **SQL Injection:** Parameterized queries via Drizzle ORM

#### Session Security

- **Secure Cookies:** HttpOnly, Secure, SameSite
- **Session Rotation:** On privilege escalation
- **Concurrent Session Limit:** 5 sessions per user
- **Session Invalidation:** On password change

#### Audit Logging

All security-relevant events logged:

- Login/logout
- Permission changes
- Role assignments
- Resource access
- Failed auth attempts
- MFA events

---

## 6. Key Business Features

### 6.1 CRM & Sales Management

#### Lead Management

- **Lead Capture:** Web forms, API, manual entry, integrations
- **Lead Scoring:** Automatic scoring based on engagement
- **Lead Assignment:** Round-robin, territory-based, manual
- **Lead Nurturing:** Automated follow-up workflows
- **Lead Conversion:** Zero-data-loss conversion to customers

#### Business Records (Unified System)

- **Unified Entity:** Single record for lead → customer lifecycle
- **Zero Data Loss:** All lead data preserved after conversion
- **Activity History:** Complete interaction history
- **Related Records:** Equipment, contacts, addresses maintained
- **Conversion Tracking:** Source tracking and attribution

#### Customer Management

- **360° View:** Complete customer profile with all interactions
- **Equipment Tracking:** All customer equipment with history
- **Contact Management:** Multiple contacts per customer
- **Document Storage:** Contracts, proposals, service records
- **Communication History:** Emails, calls, meetings tracked

#### Deal Pipeline

- **Pipeline Stages:** Customizable stages per tenant
- **Deal Tracking:** Opportunity management with probability
- **Sales Forecasting:** AI-powered forecast predictions
- **Commission Tracking:** Automated commission calculations
- **Win/Loss Analysis:** Deal outcome analytics

#### Territory Management

- **Geographic Territories:** ZIP code, city, region-based
- **Territory Assignment:** Sales rep territory management
- **Performance Tracking:** Territory-level metrics
- **Load Balancing:** Automatic lead distribution

### 6.2 Service Management

#### Service Request Management

- **Multi-Channel Creation:** Phone, email, portal, technician mobile
- **Priority Management:** Automatic priority assignment
- **SLA Tracking:** Response time and resolution tracking
- **Status Workflow:** Configurable status progression
- **Customer Communication:** Automated status updates

#### Dispatch System

- **Intelligent Routing:** Geographic and skill-based assignment
- **Calendar Integration:** Google/Microsoft Calendar sync
- **Technician Availability:** Real-time availability tracking
- **Appointment Scheduling:** Customer self-scheduling available
- **Route Optimization:** Geographic route planning

#### Technician Workflow

- **Mobile Interface:** Native mobile-optimized interface
- **Offline Mode:** Work offline with sync capability
- **Time Tracking:** Clock in/out, time per task
- **Parts Usage:** Real-time parts consumption tracking
- **Photo Documentation:** Upload photos from field
- **Customer Signatures:** Digital signature capture
- **Service Notes:** Detailed service documentation

#### Equipment Management

- **Equipment Registry:** Complete equipment database
- **Serial Number Tracking:** Unique equipment identification
- **Warranty Tracking:** Warranty expiration monitoring
- **Meter Tracking:** Automated meter reading collection
- **Lifecycle Management:** Equipment from sale to retirement
- **Service History:** Complete maintenance history

#### Preventive Maintenance

- **Maintenance Schedules:** Rule-based scheduling
- **Automatic Generation:** Service requests auto-created
- **Reminder System:** Customer and technician reminders
- **Compliance Tracking:** Contract compliance monitoring
- **Performance Analytics:** Maintenance effectiveness metrics

#### Remote Monitoring

- **IoT Integration:** Real-time equipment monitoring
- **Alert System:** Proactive issue detection
- **Usage Analytics:** Equipment usage patterns
- **Predictive Maintenance:** AI-powered failure prediction
- **Supply Level Monitoring:** Toner/ink level tracking

### 6.3 Inventory & Warehouse Management

#### Product Catalog

- **Multi-Level Categories:** Hierarchical product organization
- **Product Variants:** Size, color, configuration variants
- **Pricing Tiers:** Customer-specific pricing
- **Product Bundles:** Package deals and kits
- **Manufacturer Integration:** Direct manufacturer data sync

#### Inventory Management

- **Multi-Warehouse:** Multiple warehouse locations
- **Bin Management:** Warehouse bin/location tracking
- **Stock Levels:** Real-time inventory levels
- **Reorder Points:** Automatic reorder alerts
- **Stock Adjustments:** Manual adjustment tracking
- **Cycle Counting:** Regular inventory audits

#### Warehouse Operations

- **Receiving:** Purchase order receiving workflow
- **Transfers:** Inter-warehouse transfer management
- **Picking:** Order picking workflow
- **Shipping:** Shipping integration and tracking
- **Returns:** Return merchandise handling

#### Parts Management

- **Parts Catalog:** Equipment parts database
- **Parts Compatibility:** Equipment model compatibility
- **Parts Usage Tracking:** Service request parts consumption
- **Parts Pricing:** Cost and retail pricing
- **Supplier Management:** Multi-supplier sourcing

#### Purchase Orders

- **PO Creation:** Manual and automatic PO generation
- **Approval Workflow:** Multi-level PO approval
- **Receiving:** PO receiving and variance tracking
- **Supplier Performance:** Supplier metrics tracking

### 6.4 Billing & Finance

#### Invoice Management

- **Invoice Generation:** Manual and automated creation
- **Invoice Templates:** Customizable invoice layouts
- **Line Item Management:** Detailed invoice line items
- **Tax Calculation:** Automatic tax calculation
- **Discounts:** Line-level and invoice-level discounts
- **Invoice Delivery:** Email, portal, print options

#### Meter Billing

- **Meter Reading Collection:** Portal, email, API, manual
- **Automatic Billing:** Scheduled meter billing runs
- **Overage Calculation:** Base + overage pricing
- **Meter History:** Complete meter reading history
- **Billing Alerts:** Usage anomaly detection

#### Contract Management

- **Contract Types:** Service, supply, lease contracts
- **Contract Templates:** Reusable contract templates
- **Billing Schedules:** Recurring billing automation
- **Contract Renewals:** Automatic renewal reminders
- **Contract Compliance:** SLA and deliverable tracking

#### Payment Processing

- **Stripe Integration:** Credit card processing
- **Payment Methods:** Card, ACH, check, wire
- **Payment Plans:** Installment payment setup
- **Payment Portal:** Customer self-service payments
- **Payment Reconciliation:** Automatic payment matching

#### Collections Management

- **Aging Reports:** AR aging analysis
- **Collection Workflows:** Automated collection reminders
- **Payment Plans:** Past-due payment arrangements
- **Collection Tracking:** Collection action history

#### QuickBooks Integration

- **Bi-Directional Sync:** Two-way data synchronization
- **Chart of Accounts:** Automatic account mapping
- **Invoice Sync:** Invoice push to QuickBooks
- **Payment Sync:** Payment import from QuickBooks
- **Customer Sync:** Customer data synchronization

### 6.5 Quotes & Proposals

#### Quote Builder

- **Product Selection:** Drag-and-drop product selection
- **Pricing Configuration:** Tiered pricing options
- **Discount Management:** Quote-level discounts
- **Terms & Conditions:** Customizable terms
- **Approval Workflow:** Manager approval required
- **Quote Expiration:** Time-limited quotes

#### Visual Proposal Builder

- **Template Library:** Pre-designed proposal templates
- **Content Sections:** Modular section builder
- **Image Gallery:** Product image management
- **ROI Calculator:** Built-in ROI tools
- **Comparison Charts:** Side-by-side comparisons
- **Digital Signatures:** E-signature capability
- **Tracking:** Proposal view tracking

### 6.6 Customer Portal

#### Self-Service Features

- **Dashboard:** Customer-specific metrics
- **Supply Ordering:** Toner/ink ordering
- **Meter Submission:** Self-service meter readings
- **Service Requests:** Create and track service tickets
- **Invoice Access:** View and pay invoices
- **Document Library:** Access to contracts, manuals
- **Equipment List:** Customer equipment inventory
- **Contact Management:** Update contact information

#### Portal Administration

- **User Management:** Portal user invitation
- **Permission Control:** Feature-level access control
- **Branding:** Tenant-specific portal branding
- **Custom Domain:** Custom domain support

### 6.7 Subscriptions & Usage Tracking

#### Subscription Plans

- **Tiered Plans:** Multiple subscription tiers
- **Feature Gating:** Plan-based feature access
- **Usage Limits:** API calls, storage, users
- **Add-Ons:** Optional add-on products
- **Trial Management:** Free trial functionality

#### Subscription Management

- **Plan Changes:** Upgrade/downgrade handling
- **Proration:** Prorated billing calculations
- **Usage Tracking:** Real-time usage monitoring
- **Overage Billing:** Usage-based overage charges
- **Cancellation:** Self-service cancellation

### 6.8 Analytics & Reporting

#### Executive Dashboard

- **Revenue Metrics:** Real-time revenue tracking
- **Service Metrics:** Service request analytics
- **Sales Pipeline:** Visual pipeline representation
- **KPI Tracking:** Key performance indicators
- **Trend Analysis:** Historical trend visualization

#### Standard Reports

- **Sales Reports:** Revenue, pipeline, forecasting
- **Service Reports:** Technician, equipment, response time
- **Financial Reports:** AR aging, revenue, profitability
- **Inventory Reports:** Stock levels, usage, turnover
- **Customer Reports:** Activity, satisfaction, retention

#### Custom Report Builder

- **Drag-and-Drop:** Visual report builder
- **Data Sources:** All database tables available
- **Filters:** Complex filter criteria
- **Grouping:** Multi-level grouping
- **Calculations:** Custom calculated fields
- **Visualizations:** Charts, graphs, tables
- **Export:** PDF, Excel, CSV export
- **Scheduling:** Automated report delivery

#### Predictive Analytics

- **Sales Forecasting:** AI-powered revenue predictions
- **Equipment Failure:** Predictive maintenance alerts
- **Customer Churn:** Churn risk prediction
- **Inventory Optimization:** Demand forecasting

### 6.9 AI & Automation

#### AI Assistant

- **Claude Integration:** Anthropic Claude API
- **GPT Integration:** OpenAI GPT-4 API
- **Context-Aware:** Understands business context
- **Multi-Modal:** Text and data analysis
- **Task Automation:** Automated task suggestions

#### Intelligent Features

- **Smart Scheduling:** AI-powered appointment scheduling
- **Email Intelligence:** Automatic email categorization
- **Lead Scoring:** ML-based lead scoring
- **Anomaly Detection:** Usage anomaly alerts
- **Document Processing:** Automated document extraction

#### Workflow Automation

- **Workflow Builder:** Visual workflow designer
- **Triggers:** Event-based workflow triggers
- **Actions:** Automated actions and tasks
- **Approvals:** Multi-step approval workflows
- **Notifications:** Automated notification system

### 6.10 Integration Ecosystem

#### Salesforce Integration

- **Bi-Directional Sync:** Two-way data synchronization
- **Field Mapping:** Customizable field mapping
- **Real-Time Sync:** Webhook-based real-time sync
- **Conflict Resolution:** Automatic conflict handling
- **Sync Logs:** Detailed synchronization logs

#### QuickBooks Integration

- **Customer Sync:** Customer data synchronization
- **Invoice Sync:** Invoice push to QuickBooks
- **Payment Import:** Payment data import
- **Chart of Accounts:** Account mapping
- **Tax Mapping:** Tax code synchronization

#### Calendar Integrations

- **Google Calendar:** Two-way calendar sync
- **Microsoft 365:** Outlook calendar integration
- **Appointment Sync:** Service appointment sync
- **Availability:** Real-time availability checking

#### Communication Integrations

- **Email:** SMTP email sending
- **SMS:** Twilio SMS integration
- **VoIP:** Phone system integration capabilities

#### Data Enrichment

- **ZoomInfo:** Company data enrichment
- **Apollo.io:** Contact data enrichment
- **Address Validation:** USPS address validation

#### Manufacturer Integrations

- **Equipment Data:** Model specifications sync
- **Parts Catalog:** Parts compatibility data
- **Pricing:** Manufacturer pricing updates
- **Warranty:** Warranty registration

---

## 7. Configuration & Build System

### Build Configuration

#### Vite Configuration

```typescript
// vite.config.ts highlights
{
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'wouter'],
          'vendor-ui': ['@radix-ui/*', 'tailwindcss'],
          'vendor-charts': ['recharts'],
          'vendor-query': ['@tanstack/react-query']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query']
  }
}
```

#### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"],
      "@assets/*": ["./attached_assets/*"]
    }
  }
}
```

### NPM Scripts

```json
{
  "dev": "vite",
  "build": "vite build && tsc -p tsconfig.server.json",
  "start": "NODE_ENV=production node dist/server/index.js",
  "check": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --check .",
  "format:write": "prettier --write .",
  "db:push": "drizzle-kit push",
  "db:push:forecast": "drizzle-kit push --config=drizzle.forecasting.config.ts",
  "test:e2e": "playwright test"
}
```

### Environment Variables

```bash
# Database
DATABASE_URL=              # Primary PostgreSQL connection string
FORECASTING_DATABASE_URL=  # Forecasting database connection

# Authentication
REPLIT_AUTH_CLIENT_ID=     # Replit Auth client ID
REPLIT_AUTH_CLIENT_SECRET= # Replit Auth client secret
SESSION_SECRET=            # Session encryption secret

# Integrations
SALESFORCE_CLIENT_ID=      # Salesforce OAuth client ID
SALESFORCE_CLIENT_SECRET=  # Salesforce OAuth secret
QUICKBOOKS_CLIENT_ID=      # QuickBooks OAuth client ID
QUICKBOOKS_CLIENT_SECRET=  # QuickBooks OAuth secret
STRIPE_SECRET_KEY=         # Stripe API secret key
STRIPE_WEBHOOK_SECRET=     # Stripe webhook signing secret

# AI Services
ANTHROPIC_API_KEY=         # Claude API key
OPENAI_API_KEY=            # OpenAI API key

# Email
SMTP_HOST=                 # SMTP server host
SMTP_PORT=                 # SMTP server port
SMTP_USER=                 # SMTP username
SMTP_PASS=                 # SMTP password

# Storage
STORAGE_PROVIDER=          # S3, local, etc.
S3_BUCKET=                 # S3 bucket name
AWS_ACCESS_KEY_ID=         # AWS access key
AWS_SECRET_ACCESS_KEY=     # AWS secret key

# Feature Flags
ENABLE_AI_FEATURES=        # Enable AI features
ENABLE_FORECASTING=        # Enable forecasting
ENABLE_PORTAL=             # Enable customer portal
```

### Dependencies (140+ packages)

#### Core Dependencies

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.4.2",
  "express": "^4.19.2",
  "drizzle-orm": "^0.33.0",
  "postgres": "^3.4.4"
}
```

#### UI Libraries

```json
{
  "@radix-ui/react-*": "Latest",
  "tailwindcss": "^3.4.1",
  "recharts": "^2.12.2",
  "react-hook-form": "^7.51.0",
  "zod": "^3.22.4"
}
```

#### State Management

```json
{
  "@tanstack/react-query": "^5.28.6",
  "wouter": "^3.3.5"
}
```

#### Integrations

```json
{
  "stripe": "^14.21.0",
  "@anthropic-ai/sdk": "^0.20.0",
  "openai": "^4.28.4"
}
```

---

## 8. Multi-Tenant Implementation

### Tenant Resolution Strategy

#### Primary Method: Subdomain-Based

```typescript
// Extract tenant from subdomain
// Format: {tenant}.printyx.com
const host = req.get('host');
const subdomain = host.split('.')[0];
const tenant = await getTenantBySubdomain(subdomain);
```

#### Fallback Method: Path-Based

```typescript
// Extract tenant from URL path
// Format: /tenant/{tenantId}/...
const pathSegments = req.path.split('/');
if (pathSegments[1] === 'tenant') {
  const tenantId = pathSegments[2];
  const tenant = await getTenantById(tenantId);
}
```

#### Development Mode

```typescript
// Use default tenant in development
if (process.env.NODE_ENV === 'development') {
  const tenant = await getDefaultTenant();
}
```

### Data Isolation

#### Database Level

```typescript
// All queries automatically filtered by tenantId
const middleware = async (req, res, next) => {
  req.tenantId = await resolveTenant(req);
  next();
};

// Query example
const customers = await db
  .select()
  .from(customersTable)
  .where(eq(customersTable.tenantId, req.tenantId));
```

#### Session Level

```typescript
// Sessions scoped to tenant
session.tenantId = tenant.id;
session.userId = user.id;
```

#### Cache Level

```typescript
// Cache keys include tenant ID
const cacheKey = `tenant:${tenantId}:users:${userId}`;
```

### Tenant-Specific Configuration

#### Settings

- **Branding:** Logo, colors, custom domain
- **Features:** Feature flags per tenant
- **Integrations:** Tenant-specific API credentials
- **Email:** SMTP settings, email templates
- **Billing:** Payment gateway configuration

#### Database Isolation Options

- **Shared Database, Shared Schema:** Current implementation (RLS)
- **Shared Database, Separate Schema:** Possible future enhancement
- **Separate Database:** Available for enterprise tier

---

## 9. Testing & Quality Assurance

### Testing Infrastructure

#### Playwright E2E Tests

- **Test Runner:** Playwright
- **Browsers:** Chromium, Firefox, WebKit
- **Parallel Execution:** Multi-browser testing
- **Screenshots:** Automatic failure screenshots
- **Video Recording:** Test execution videos

#### Test Categories

```
testing/
├── e2e/
│   ├── auth.spec.ts           # Authentication flows
│   ├── crm.spec.ts            # CRM functionality
│   ├── service.spec.ts        # Service management
│   ├── inventory.spec.ts      # Inventory operations
│   ├── billing.spec.ts        # Billing workflows
│   └── portal.spec.ts         # Customer portal
```

### Code Quality Tools

#### ESLint

- **Parser:** @typescript-eslint/parser
- **Rules:** Airbnb + TypeScript recommended
- **Auto-fix:** Available for many rules

#### Prettier

- **Config:** Standardized formatting
- **Integration:** Pre-commit hooks
- **Format on Save:** IDE integration

#### TypeScript

- **Strict Mode:** Enabled
- **No Implicit Any:** Enforced
- **Type Checking:** Pre-build validation

### Quality Metrics

- **Test Coverage:** E2E critical paths covered
- **Type Safety:** 100% TypeScript coverage
- **Code Formatting:** Automated via Prettier
- **Linting:** Clean ESLint results required

---

## 10. Deployment & Hosting

### Deployment Platform

- **Platform:** Replit
- **Deployment Type:** Autoscale
- **Region:** Auto-selected based on traffic
- **Scaling:** Automatic based on load

### Replit Configuration

```toml
# .replit
run = "npm start"
entrypoint = "server/index.ts"
modules = ["nodejs-20"]

[deployment]
run = ["sh", "-c", "npm run build && npm start"]
deploymentTarget = "autoscale"

[[ports]]
localPort = 5000
externalPort = 80
```

### Build Process

```bash
# 1. Frontend build (Vite)
vite build → client/dist/

# 2. Backend build (TypeScript)
tsc -p tsconfig.server.json → dist/server/

# 3. Start production server
NODE_ENV=production node dist/server/index.js
```

### Environment-Specific Configuration

#### Development

- Hot module replacement
- Source maps enabled
- Detailed error messages
- Default tenant fallback

#### Production

- Minified assets
- Compressed responses
- Error tracking
- Performance monitoring

### Database Hosting

- **Provider:** Neon (serverless PostgreSQL)
- **Connection Pooling:** Managed by Neon
- **Backup:** Automatic daily backups
- **High Availability:** Multi-region replication

---

## 11. Performance Optimization

### Frontend Optimization

#### Code Splitting

- **Vendor Chunks:** React, UI libraries, charts separated
- **Route-Based:** Lazy loading for routes
- **Component-Based:** Dynamic imports for heavy components

#### Bundle Optimization

- **Tree Shaking:** Unused code elimination
- **Minification:** Terser for JavaScript, cssnano for CSS
- **Compression:** Gzip/Brotli compression

#### Asset Optimization

- **Image Optimization:** WebP format, lazy loading
- **Font Loading:** Font-display: swap
- **Icon System:** SVG sprite sheets

### Backend Optimization

#### Database Optimization

```typescript
// Indexes on frequently queried columns
- tenantId (all tables)
- userId (user-related tables)
- createdAt/updatedAt (time-based queries)
- Foreign keys (relationship queries)
- Composite indexes (multi-column queries)
```

#### Query Optimization

- **Select Specific Fields:** Avoid SELECT \*
- **Pagination:** Limit + offset for large datasets
- **Eager Loading:** Join related data when needed
- **Query Result Caching:** Redis for frequently accessed data

#### Caching Strategy

```typescript
// Cache layers
1. Browser Cache (static assets)
2. CDN Cache (if applicable)
3. Application Cache (Redis/in-memory)
4. Database Query Cache
```

#### API Optimization

- **Response Compression:** Gzip middleware
- **ETag Support:** Conditional requests
- **Rate Limiting:** Prevent abuse
- **Request Batching:** Batch similar requests

---

## 12. Known Issues & Technical Debt

### Known Issues

#### Disabled Features

```typescript
// SEO routes disabled due to cheerio dependency issues
// File: server/routes.ts
// app.use('/', routesSEO); // DISABLED
```

#### Development Warnings

- Cheerio dependency requires bundling workaround
- Some Radix UI components emit hydration warnings
- TanStack Query devtools not production-ready

### Technical Debt

#### Code Organization

- Some route files are very large (500+ lines)
- Service layer could use more abstraction
- Shared types should be centralized

#### Testing

- E2E test coverage is partial
- Unit tests needed for services
- Integration tests needed for critical paths

#### Documentation

- API documentation incomplete
- Component documentation sparse
- Some complex business logic undocumented

#### Performance

- Some N+1 query opportunities
- Cache invalidation strategy needs refinement
- Database connection pooling tuning needed

### Future Enhancements

#### Planned Features

- Mobile native apps (React Native)
- Advanced AI features (document processing, voice)
- More manufacturer integrations
- Enhanced analytics with ML models
- Real-time collaboration features

#### Architecture Improvements

- Microservices for resource-intensive operations
- Event-driven architecture for real-time updates
- GraphQL API alongside REST
- Enhanced monitoring and observability

---

## 13. Security Considerations

### Current Security Measures

#### Application Security

- ✅ SQL Injection Prevention (parameterized queries)
- ✅ XSS Prevention (React automatic escaping)
- ✅ CSRF Protection (token-based)
- ✅ Rate Limiting (API throttling)
- ✅ Input Validation (Zod schemas)
- ✅ Authentication (OpenID Connect)
- ✅ Authorization (RBAC)
- ✅ Session Security (secure cookies)

#### Data Security

- ✅ Multi-tenant isolation (RLS)
- ✅ Encryption at rest (PostgreSQL)
- ✅ Encryption in transit (HTTPS)
- ✅ Audit logging (all sensitive operations)
- ✅ MFA support (TOTP-based)
- ✅ Backup codes (account recovery)

#### Infrastructure Security

- ✅ Managed hosting (Replit)
- ✅ Automated backups (Neon)
- ✅ DDoS protection (Replit)
- ✅ SSL/TLS (automatic certificates)

### Security Best Practices

#### Code Review

- All PRs require review
- Security-sensitive changes require careful review
- Dependency updates reviewed for vulnerabilities

#### Secrets Management

- Environment variables for secrets
- No secrets in code or version control
- Rotation policy for API keys

#### Vulnerability Management

- Regular dependency updates
- npm audit for vulnerability scanning
- Security patches applied promptly

---

## 14. Growth Opportunities

### Business Expansion

#### New Markets

- **International:** Multi-currency, multi-language support
- **Adjacent Markets:** Office furniture, IT services dealers
- **Vertical Expansion:** Managed print services, document management

#### New Features

- **Mobile Apps:** Native iOS/Android applications
- **Advanced Analytics:** Predictive modeling, prescriptive recommendations
- **AI Enhancements:** Document processing, voice interface, chatbots
- **Marketplace:** Third-party app marketplace
- **White Label:** Partner-branded solutions

### Technical Enhancements

#### Scalability

- **Microservices:** Break out resource-intensive services
- **Event-Driven:** Real-time event processing
- **Edge Computing:** Geographically distributed processing
- **Database Sharding:** Horizontal database scaling

#### Performance

- **GraphQL:** More efficient data fetching
- **Serverless Functions:** Cost-effective compute
- **CDN Integration:** Global content delivery
- **Advanced Caching:** Multi-level cache strategy

#### Developer Experience

- **API Documentation:** OpenAPI/Swagger docs
- **SDK:** Client libraries for integrations
- **Webhooks:** Event notification system
- **Developer Portal:** Self-service integration

### Integration Expansion

#### Additional Integrations

- **More ERPs:** NetSuite, SAP, Microsoft Dynamics
- **More CRMs:** HubSpot, Zoho, Pipedrive
- **Payment Processors:** PayPal, Square, Authorize.net
- **Communication:** Slack, Microsoft Teams, Discord
- **Project Management:** Asana, Monday.com, Jira
- **Marketing Automation:** Mailchimp, Constant Contact

#### Data & Analytics

- **Business Intelligence:** Tableau, Power BI, Looker
- **Data Warehouse:** Snowflake, BigQuery integration
- **ETL Pipelines:** Automated data pipelines

---

## 15. Maintenance & Operations

### Regular Maintenance Tasks

#### Daily

- Monitor error logs
- Check system health metrics
- Review security alerts
- Monitor database performance

#### Weekly

- Review and update dependencies
- Database performance analysis
- Backup verification
- Security patch review

#### Monthly

- Performance optimization review
- Cost analysis and optimization
- Feature usage analytics
- User feedback review

#### Quarterly

- Major dependency updates
- Security audit
- Performance benchmarking
- Architecture review

### Monitoring & Alerting

#### Application Monitoring

- Error tracking (server errors, exceptions)
- Performance monitoring (response times, throughput)
- User activity (active users, feature usage)
- API usage (endpoint calls, rate limits)

#### Infrastructure Monitoring

- Server health (CPU, memory, disk)
- Database health (connections, query performance)
- Network health (latency, bandwidth)
- Uptime monitoring (availability)

#### Business Metrics

- Revenue tracking
- User growth
- Feature adoption
- Customer satisfaction

### Support & Documentation

#### User Support

- Help documentation
- Video tutorials
- In-app guidance
- Support ticket system

#### Developer Documentation

- API documentation
- Integration guides
- Code examples
- Architecture documentation

---

## Appendix A: Technology Stack Summary

### Frontend Stack

```
React 18.3.1               - UI framework
TypeScript 5.5.3          - Type safety
Vite 5.4.2                - Build tool
Wouter 3.3.5              - Routing
TanStack Query 5.28.6     - State management
Radix UI                  - Headless components
Tailwind CSS 3.4.1        - Styling
shadcn/ui                 - Component library
React Hook Form 7.51.0    - Form management
Zod 3.22.4                - Validation
Recharts 2.12.2           - Charts
```

### Backend Stack

```
Node.js 20                - Runtime
Express.js 4.19.2         - Web framework
TypeScript 5.5.3          - Type safety
Drizzle ORM 0.33.0        - Database ORM
PostgreSQL 16             - Database
Replit Auth               - Authentication
connect-pg-simple         - Session store
```

### Infrastructure Stack

```
Replit                    - Hosting platform
Neon PostgreSQL           - Database hosting
Stripe                    - Payment processing
Various APIs              - Integrations
```

---

## Appendix B: File Structure Reference

```
Printyx/
├── client/
│   ├── src/
│   │   ├── components/          # 200+ React components
│   │   ├── pages/              # 169 page components
│   │   ├── hooks/              # 13 custom hooks
│   │   ├── lib/                # Utilities
│   │   ├── main.tsx            # App entry point
│   │   └── index.html          # HTML template
│   └── dist/                   # Build output
├── server/
│   ├── index.ts                # Server entry point
│   ├── routes*.ts              # 90+ route files
│   ├── services/               # 40+ service files
│   ├── middleware/             # Middleware files
│   ├── integrations/           # Integration files
│   └── utils/                  # Utilities
├── shared/
│   ├── schema.ts               # Main schema (126+ tables)
│   ├── schemaEquipment.ts      # Equipment schema
│   ├── schemaServiceAnalysis.ts # Service analysis schema
│   ├── schemaTasks.ts          # Tasks schema
│   ├── schemaSecurity.ts       # Security schema
│   └── schemaForecasting.ts    # Forecasting schema
├── testing/
│   └── e2e/                    # Playwright tests
├── attached_assets/            # Asset storage
├── db/                         # Database files
├── dist/                       # Production build
├── package.json                # Dependencies
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── tsconfig.server.json        # Server TypeScript config
├── drizzle.config.ts           # Drizzle config
├── .replit                     # Replit config
├── CLAUDE.md                   # Development guide
└── README.md                   # Project readme
```

---

## Document Maintenance

### Updating This Document

This Living Technical Specification should be updated:

- **Weekly:** Review for accuracy
- **After Major Changes:** Update relevant sections
- **Before Releases:** Comprehensive review
- **On Request:** Ad-hoc updates as needed

### Version History

- **v1.0** (2025-11-11): Initial comprehensive specification

### Contributors

This document reflects the current state of the Printyx codebase as of November 11, 2025.

---

**End of Living Technical Specification**

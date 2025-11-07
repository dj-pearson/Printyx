# Printyx Platform: Comprehensive Knowledge Base System Documentation

## Executive Summary

Printyx is a unified SaaS platform for copier dealers consolidating operations across meter billing, service dispatch, inventory management, and CRM. The platform operates as a 4-tier multi-tenant architecture (Platform → Company → Regional → Location) with advanced features including AI documentation, workflow automation, predictive maintenance, and manufacturer integrations.

---

## 1. MAJOR FEATURE DOMAINS AND BUSINESS AREAS

### Core Business Domains (8 Primary Areas)

#### 1.1 CRM & Sales Management
**Features:**
- Lead/prospect management and tracking
- Business Records (unified lead-to-customer conversion system)
- Deal tracking and pipeline management
- Opportunities management
- Sales forecasting and analytics
- Commission management with tiered rates
- Apollo.io lead enrichment integration
- Customer contacts and relationship tracking
- Deal stages and activity logging

**Key Tables:**
- `businessRecords` - Unified lead/customer data
- `opportunities` - Sales opportunities
- `deals` - Deal tracking
- `dealStages` - Pipeline stages
- `commissionPlans`, `commissionCalculations` - Commission tracking

#### 1.2 Service Management & Field Service
**Features:**
- Service call scheduling and dispatch
- Technician management and assignment
- Mobile field service app
- Work order management
- Service ticket creation and tracking
- Preventive maintenance planning
- Service contract management
- Phone-in ticket creation
- Workflow step automation
- Dynamic rescheduling and optimization

**Key Tables:**
- `serviceCalls` - Service call records
- `serviceContracts` - Service contracts with coverage details
- `serviceTickets` - Ticketing system
- `workflowSteps` - Workflow automation
- `mobileServiceSessions` - Field technician sessions
- `locationHistory` - Technician location tracking

**Toner Coverage Integration:**
- Service contracts include `includes_toner` flag
- Automatic toner ordering when levels drop below threshold
- Integration with supplies inventory

#### 1.3 Meter Reading & Advanced Billing
**Features:**
- Real-time meter reading collection
- Automated billing rule engine
- Tiered billing with volume discounts
- Overage detection and billing
- Meter anomaly detection
- Billing cycles (daily, weekly, monthly, quarterly, annual)
- Contract-based rate management
- Time-based pricing (peak/off-peak)
- Negative billing prevention
- Custom billing formulas

**Key Tables:**
- `meterReadings` - Device meter readings
- `billingRules` - Billing configuration
- `meterAnomalies` - Anomaly detection
- `invoices`, `invoiceLineItems` - Invoice management

**Toner Billing Integration:**
- Toner covered under service contracts (zero-cost to customer)
- Automatic supply orders triggered by meter readings
- Parts/toner tracking in service calls

#### 1.4 Inventory & Warehouse Management
**Features:**
- Equipment lifecycle tracking (ordered → retired)
- Parts and consumables inventory
- Supply ordering and fulfillment
- Toner cartridge inventory by manufacturer/model/color
- Warehouse operations (receiving, QC, staging, shipping)
- Delivery schedule management
- Purchase order management
- Vendor management
- ABC inventory analysis
- Reorder point automation
- Warehouse kitting operations
- FPY (First Pass Yield) metrics

**Key Tables:**
- `equipment` - Copier/printer equipment
- `equipmentLifecycle` - Equipment status tracking
- `inventoryItems` - Parts and consumables
- `purchaseOrders`, `purchaseOrderItems` - PO management
- `warehouseOperations` - Warehouse activities
- `deliverySchedules` - Equipment delivery
- `supplies` - Toner and supplies catalog

**Toner-Specific Data:**
- Product codes like `TONER-BLACK-HP-P4015`
- Manufacturer part numbers
- Stock levels: onHand, committed, available, onOrder
- Color variants: BLACK, CYAN, MAGENTA, YELLOW

#### 1.5 Manufacturer Integrations
**Supported Manufacturers:**
- Canon (ImageRunner series)
- Xerox (ConnectKey)
- HP (PrintOS)
- Konica Minolta
- Lexmark
- FMaudit/Printanista
- Ricoh SmartSDK

**Features:**
- Device registration and monitoring
- Real-time meter collection (hourly, daily, weekly, monthly, real-time)
- Device status monitoring (online/offline/error/maintenance)
- Collection frequency management
- Authentication methods (API key, OAuth2, basic auth, certificate, HMAC)
- Integration audit logging
- API endpoint management

**Key Tables:**
- `manufacturerIntegrations` - Integration configuration
- `deviceRegistrations` - Registered devices
- `deviceMetrics` - Device metrics/meter readings
- `integrationAuditLogs` - Integration activity logs

#### 1.6 Remote Monitoring & IoT (Fleet Monitoring)
**Features:**
- Real-time equipment status monitoring
- Toner and paper level tracking
- Performance metrics (pages/minute, utilization rate)
- Predictive maintenance alerts
- Equipment health scoring
- Connection status monitoring
- Error and jam count tracking
- Temperature and humidity monitoring
- Client-side collector agent deployment
- Network device discovery

**Key Tables:**
- `monitoringClients` - Collector agent registration
- `clientActivityLogs` - Activity tracking
- `clientDiscoveredDevices` - Network device discovery
- Configuration includes toner threshold (15%), paper threshold (20%)

#### 1.7 Workflow Automation & Advanced Operations
**Features:**
- Event-based workflow triggers
- Scheduled workflow execution
- Manual workflow triggers
- Webhook integration
- Workflow step types: email, SMS, HTTP requests, database updates, task creation, ticket creation, notifications, CRM updates, invoice generation, parts ordering, technician assignment, appointment scheduling
- Conditional branching
- Loop automation
- Data transformation
- Execution status tracking

**Key Tables:**
- `workflows` - Workflow definitions
- `workflowSteps` - Step configurations
- `workflowExecutions` - Execution history
- `stepExecutions` - Individual step tracking

**Toner Workflow Example:**
- Trigger: Meter reading drops below threshold
- Action: Create purchase order for toner
- Action: Send notification to customer
- Action: Generate invoice

#### 1.8 AI & Automation Features
**Services Implemented:**
- **AI Documentation Service** - Create, manage, and assist with document generation
  - Document types: meeting minutes, proposals, reports, contracts, templates, knowledge base
  - AI writing assistance with tone and complexity settings
  - Section-level content suggestions
  - Version control and approval workflows
  
- **AI Search & Knowledge Service** - Vector-based semantic search
  - Embeddings for documents, transcriptions, knowledge articles
  - Query expansion and intent detection
  - Answer synthesis from multiple sources
  - Quality scoring and relevance ranking
  
- **AI Employee Service** - HR and employee optimization
  
- **Claude AI Service** - Core AI integration
  - Uses Claude 3.5 Sonnet model
  - Context management for conversations
  - Streaming response support
  
- **GPT-5 Routes** - Advanced AI analytics

**Key Tables:**
- AI documentation, search queries, embeddings tracked in application

---

## 2. DATABASE SCHEMA STRUCTURE

### Core Schema Files (24 Specialized Schemas)

**Main Schema** (`shared/schema.ts` - 7,730 lines):
- Contains 60+ core business tables
- All tables include tenant_id for multi-tenancy
- Session management and user/role tables
- Core business entities (companies, contacts, equipment, contracts, invoices)

**Specialized Schemas:**

| Schema File | Primary Tables | Purpose |
|---|---|---|
| `equipment-schema.ts` | `purchaseOrders`, `warehouseOperations`, `equipmentLifecycle`, `deliverySchedules`, `complianceDocuments` | Equipment lifecycle and warehouse |
| `service-analysis-schema.ts` | `serviceCallAnalysis`, `servicePartsUsed`, `partsOrders` | Service quality analysis |
| `manufacturer-integration-schema.ts` | `manufacturerIntegrations`, `deviceRegistrations`, `deviceMetrics` | Device integration |
| `client-monitor-schema.ts` | `monitoringClients`, `clientActivityLogs`, `clientDiscoveredDevices` | Fleet monitoring agents |
| `advanced-billing-schema.ts` | `billingRules`, `meterAnomalies`, `invoiceAdjustments` | Advanced billing engine |
| `customer-portal-schema.ts` | `customerPortalAccess`, `serviceRequests`, `supplyOrders`, `notifications` | Customer self-service portal |
| `workflow-automation-schema.ts` | `workflows`, `workflowSteps`, `workflowExecutions` | Workflow definitions |
| `commission-schema.ts` | `commissionPlans`, `commissionCalculations`, `commissionDisputes` | Commission management |
| `quickbooks-schema.ts` | `qbVendors`, `glAccounts`, `paymentTerms`, `vendorBills` | QuickBooks integration |
| `security-schema.ts` | `auditLogs`, `dataAccessLogs`, `gdprRequests`, `securitySessions` | Compliance and security |
| `task-schema.ts` | Task management tables | Task and checklist management |
| `mobile-service-schema.ts` | `mobileServiceSessions`, `timeTrackingEntries`, `servicePhotos` | Field service mobile |
| `enhanced-service-schema.ts` | `phoneInTickets`, `ticketPartsRequests`, `workflowSteps` | Service ticket details |
| `warehouse-fpy-schema.ts` | `warehouseKittingOperations`, `fpyMetrics` | Warehouse quality |
| `manufacturing-order-schema.ts` | `manufacturerOrderWorkflows`, `orderTracking` | Equipment orders |
| `gps-tracking-schema.ts` | `technicianLocations`, `routeOptimization` | GPS and routing |
| `lead-scoring-schema.ts` | Lead scoring models and history | Lead qualification |
| `quote-proposal-schema.ts` | Quote and proposal management | Quote generation |
| `reporting-schema.ts` | Reporting definitions and executions | Business intelligence |
| `seo-schema.ts` | SEO settings, pages, metadata | SEO management |
| `customer-success-schema.ts` | Customer health and success tracking | Customer success |
| `apollo-schema.ts` | Apollo.io data mapping | Lead enrichment |

### Multi-Tenancy Implementation

**Tenant Isolation:**
- All tables include `tenant_id` (UUID) column
- Row-level security (RLS) enforced via tenant context
- Session-based tenant resolution via middleware
- Tenant context attached to all requests

**Organizational Hierarchy:**
- Platform (root)
- Company (per tenant)
- Regional offices
- Individual locations

**Database Configuration:**
- Primary: PostgreSQL via Neon (cloud)
- ORM: Drizzle with TypeScript
- Forecasting DB: Separate database for analytics
- Backup: Automated per-tenant schedules

---

## 3. API ROUTING STRUCTURE

### Route Organization (70+ Route Files)

**Main Routes Registration** (`server/routes.ts`):
- Orchestrates all sub-router registrations
- Central middleware (auth, session, CSRF protection)
- Rate limiting
- File upload handling (CSV)

**Specialized Route Modules (23 route files in `/server/routes/`):**

#### CRM & Sales Routes
- `ai-search-knowledge-routes.ts` - Semantic search and knowledge management
- `ai-documentation-routes.ts` - Document creation and management
- `lead-scoring-routes.ts` - Lead qualification
- `apollo-routes.ts` - Lead enrichment
- `email-marketing-routes.ts` - Email campaigns

#### Service & Field Operations
- `advanced-scheduling-routes.ts` - AI scheduling optimization
- `field-service-routes.ts` - Mobile field service
- `gps-tracking-routes.ts` - GPS and routing
- `meeting-scheduling-routes.ts` - Appointment scheduling
- `performance-routes.ts` - KPI tracking

#### Billing & Financial
- `advanced-billing-routes.ts` - Tiered billing rules
- `lease-routes.ts` - Lease management

#### Integration & Data
- `manufacturer-order-routes.ts` - Equipment ordering
- `meeting-transcription-routes.ts` - Meeting notes/transcription
- `signature-routes.ts` - E-signature management
- `mfa-routes.ts` - Multi-factor authentication

### Core Route File Paths

```
/server/routes.ts (main orchestrator)
/server/routes-*.ts (legacy pattern, 50+ files)
/server/routes/*.ts (modern pattern, 23 files)
/server/integrations/routes.ts (third-party integrations)
/server/routes-client-monitoring.ts (fleet monitoring)
/server/routes-service-dispatch.ts (service dispatch)
```

### Key Route Patterns

**Authentication:**
- Replit Auth with OpenID Connect
- Session-based auth with express-session
- PostgreSQL session store
- MFA support via backup codes

**Authorization:**
- Role-based access control (RBAC)
- Tenant context middleware
- 8-level role hierarchy
- Permission inheritance

**Data Validation:**
- Zod schemas for request validation
- Type-safe response objects
- Error boundary handling

---

## 4. BACKEND SERVICES ARCHITECTURE

### Service Layer (`/server/services/`)

#### AI & Intelligence Services
1. **ClaudeAIService** (`claude-ai-service.ts`)
   - Claude 3.5 Sonnet integration
   - Completion and chat endpoints
   - Token counting
   
2. **AIDocumentationService** (`ai-documentation-service.ts`)
   - Document type management
   - AI writing assistance
   - Content suggestions
   - Document versioning
   
3. **AISearchKnowledgeService** (`ai-search-knowledge-service.ts`)
   - Vector embeddings (1536-dimensional)
   - Semantic search
   - Query expansion
   - Answer synthesis with citations

4. **AIEmployeeService** (`ai-employee-service.ts`)
   - Employee optimization

5. **GPT5Service** (`gpt5-service.ts`)
   - Advanced AI analytics

#### Operational Services
1. **EmailService** (`email-service.ts`)
   - Transactional email
   - Template rendering
   - Batch sending

2. **SMSService** (`sms-service.ts`)
   - SMS notifications
   - Delivery tracking

3. **ManufacturerIntegrationService** (`manufacturer-integration-service.ts`)
   - Orchestrates manufacturer adapters
   - Manages integration lifecycle
   - Handles authentication

4. **UnifiedMeterCollectionService** (`unified-meter-collection-service.ts`)
   - Schedules meter collections
   - Orchestrates adapter invocations
   - Handles multi-manufacturer collection
   - Error handling and retries

5. **DynamicReschedulingService** (`dynamic-rescheduling-service.ts`)
   - AI-driven technician scheduling
   - Route optimization

6. **CustomerPortalService** (`customer-portal-service.ts`)
   - Portal access management
   - Self-service workflows

7. **PerformanceMonitor** (`performance-monitor.ts`)
   - System metrics tracking

8. **CalendarService** (`calendar-service.ts`)
   - Appointment management

9. **TaskSchedulingService** (`task-scheduling-service.ts`)
   - Automated task creation

10. **MeetingSchedulingService** (`meeting-scheduling-service.ts`)
    - Calendar integration
    - Meeting coordination

11. **TeamCollaborationService** (`team-collaboration-service.ts`)
    - Team workflows

12. **SEOService** (`seo-service.ts`)
    - SEO optimization

13. **ConstraintSolver** (`constraint-solver.ts`)
    - Complex optimization problems

#### Manufacturer Adapters (`/server/services/manufacturer-adapters/`)
- **BaseAdapter** - Abstract base class for all adapters
- **CanonAdapter** - Canon ImageRunner/imageRUNNER integration
- **XeroxAdapter** - Xerox ConnectKey integration
- **HPAdapter** - HP PrintOS integration
- **FMAuditAdapter** - FMaudit/Printanista compatibility

### Integration Layer (`/server/integrations/`)

1. **IntegrationService** (`integration-service.ts`)
   - Manages third-party integrations
   - OAuth flow handling
   - Credential encryption

2. **WebhookService** (`webhook-service.ts`)
   - Webhook registration and delivery
   - Retry logic with exponential backoff
   - HMAC signature verification

3. **DataMapper** (`data-mapper.ts`)
   - Field mapping between systems
   - Data transformation
   - Schema translation

4. **DashboardService** (`dashboard-service.ts`)
   - Multi-system dashboard aggregation

5. **ErrorMonitor** (`error-monitor.ts`)
   - Integration error tracking

---

## 5. EXISTING AI & AUTOMATION CODE

### AI Capabilities Implemented

**1. AI Documentation System**
- Location: `/server/services/ai-documentation-service.ts`
- Routes: `/server/routes/ai-documentation-routes.ts`
- Features:
  - Intelligent document generation using templates
  - Section-level AI assistance
  - Content suggestion engine
  - Document versioning and approval workflow
  - Multi-format support (JSON, markdown, rich text)

**2. AI Search & Knowledge Management**
- Location: `/server/services/ai-search-knowledge-service.ts`
- Routes: `/server/routes/ai-search-knowledge-routes.ts`
- Features:
  - Vector-based semantic search
  - Multi-content-type support (documents, transcriptions, articles)
  - Query intent detection
  - Answer synthesis with source attribution
  - Search analytics and quality scoring

**3. AI/GPT Routes**
- `routes-ai-gpt5.ts` - Advanced AI analytics
- `routes-ai-analytics.ts` - AI-driven insights
- `routes-ai-employee.ts` - Employee optimization

**4. Meeting Transcription Service**
- Location: `/server/services/meeting-transcription-service.ts`
- Features:
  - Meeting recording integration
  - AI-powered transcription
  - Auto-generated meeting minutes
  - Action item extraction

**5. Workflow Automation**
- Location: `/server/routes-workflow-automation.ts`
- Features:
  - Event-triggered workflows
  - Scheduled workflows
  - Conditional logic and branching
  - Multi-step actions (email, SMS, API calls, database updates)
  - AI-powered workflow recommendations

**6. Predictive Analytics**
- Location: `/server/routes-predictive-analytics.ts`
- Features:
  - Meter reading pattern analysis
  - Equipment failure prediction
  - Demand forecasting
  - Churn prediction

**7. Advanced Scheduling**
- Dynamic technician scheduling
- Route optimization
- Constraint satisfaction
- Resource leveling

**8. Lead Scoring**
- AI-based lead qualification
- Scoring model training
- Conversion probability prediction

---

## 6. TONER MONITORING & BILLING FEATURES

### Toner Product Catalog

**Inventory Structure:**
- Products tracked in `supplies` table with:
  - Product code (e.g., `TONER-BLACK-HP-P4015`)
  - Manufacturer and model
  - Price and unit cost
  - Status (active/inactive)
  - Stock information

**Manufacturer Coverage (Seed Data):**
- HP LaserJet series (P4015, M604, M806)
- Canon ImageRunner (IR5075 with CMYK colors)
- Xerox Color series (C70 with CMYK)
- Ricoh MP series (MP6503 with CMYK)

### Automatic Toner Ordering Workflow

**Trigger Points:**
1. **Meter Reading Collection:**
   - Real-time monitoring via manufacturer integrations
   - Clients submit toner levels via API
   - Threshold configured in monitoring client config (default: 15%)

2. **Detection Logic:**
   - Compare current toner level against threshold
   - Check service contract `includes_toner` flag
   - Verify contract is active and in date range

3. **Order Creation:**
   - Automatic purchase order generation
   - Toner product lookup by manufacturer/model/color
   - Inventory assignment
   - Supply order creation in customer portal

4. **Notification:**
   - Email notification to customer (if configured)
   - SMS notification available
   - Customer portal notification
   - Service contract coverage applied

**Service Contract Integration:**

```sql
service_contracts table includes:
  - includes_toner (boolean) - Toner coverage flag
  - start_date, end_date - Coverage period
  - contract_status - Must be 'active'
  - monthly_base_rate - Service cost (toner = $0 add-on)
```

### Customer Portal Integration

**Tables:**
- `customerPortalAccess` - User access and credentials
- `customerSupplyOrders` - Supply orders from portal
- `customerSupplyOrderItems` - Order line items
- `customerNotifications` - Delivery notifications

**Features:**
- Self-service toner ordering
- Meter reading submission (manual, photo, or automated)
- Order history and tracking
- Reorder points and automatic replenishment
- Payment method management
- Service request creation

### Billing Rules for Toner

**Configuration:**
- Billing rule type: "supplies" or "services"
- Base charge for supplies
- Volume discounts
- Overage charges
- Time-based pricing (peak rates)

**Rule Application:**
- Rule priority determines order of application
- Effective date ranges
- Customer/equipment/contract-specific rules
- Override capabilities

---

## 7. PLATFORM ARCHITECTURE PATTERNS

### Multi-Tenant Architecture

**Implementation:**
- 4-tier organizational structure
- Tenant isolation via row-level security
- Shared database with RLS policies
- Separate forecasting database for analytics
- Session-based tenant resolution

**Security:**
- Tenant context middleware enforcement
- All queries filtered by tenant_id
- Cross-tenant access prevention
- Audit logging of access patterns

### Error Handling & Resilience

**Manufacturer Integration Resilience:**
- Retry logic with exponential backoff
- Connection pooling
- Fallback to cached data
- Integration status tracking
- Error monitoring and alerting

**Webhook Reliability:**
- Automatic retries (configurable)
- Dead letter queue for failed webhooks
- Signature verification for security
- Timeout handling

### Data Consistency

**Patterns:**
- Transactional updates via ORM
- Audit trail logging for all changes
- Data validation at schema level
- Conflict resolution for offline sync

### Performance Optimization

**Approaches:**
- Database indexes on tenant_id and frequently queried fields
- Query result caching
- Pagination for large result sets
- Lazy loading relationships
- Connection pooling

---

## 8. KEY PATTERNS FOR CREATING NEW FEATURES

### 1. Adding New Feature Domain

**Steps:**
1. Create schema file: `shared/<feature>-schema.ts`
2. Define Drizzle tables with tenant_id column
3. Create insert schemas with Zod validation
4. Export types and relations
5. Add to main schema re-exports
6. Create routes file: `server/routes/<feature>-routes.ts`
7. Register route in `server/routes.ts`

**Schema Template:**
```typescript
import { pgTable, varchar, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const myFeatureEnum = pgEnum('my_feature_status', ['active', 'inactive']);

export const myFeatureTable = pgTable('my_feature', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(), // REQUIRED
  status: myFeatureEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
});

export const insertMyFeatureSchema = createInsertSchema(myFeatureTable);
export type MyFeature = typeof myFeatureTable.$inferSelect;
```

### 2. Adding New API Endpoint

**Pattern:**
```typescript
// 1. Import required dependencies and schemas
import express from 'express';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from './auth-setup';

// 2. Create router
const router = express.Router();

// 3. Define endpoints with validation
router.post('/api/feature', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    
    // Validate input
    const validated = insertMyFeatureSchema.parse(req.body);
    
    // Insert with tenant_id
    const result = await db.insert(myFeatureTable).values({
      ...validated,
      tenantId,
    }).returning();
    
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// 4. Register in main routes
export function registerFeatureRoutes(app: Express) {
  app.use(router);
}
```

### 3. Integrating with Manufacturer Data

**Pattern:**
```typescript
// 1. Create adapter extending BaseManufacturerAdapter
class CustomManufacturerAdapter extends BaseManufacturerAdapter {
  async collectMetrics(): Promise<CollectionResult> {
    // Implement manufacturer-specific API calls
  }
}

// 2. Register in UnifiedMeterCollectionService
const adapter = new CustomManufacturerAdapter(config);

// 3. Handle data transformation
const metrics = await adapter.collectMetrics();
// Normalize to standard format
const standardMetrics = this.normalizeMetrics(metrics);
```

### 4. Adding Workflow Automation

**Pattern:**
```typescript
// 1. Define workflow template
const workflowTemplate = {
  name: 'Toner Low Alert',
  trigger: {
    type: 'event',
    event: 'meter_reading.toner_low',
    threshold: 15,
  },
  steps: [
    {
      action: 'create_task',
      config: { taskType: 'order_toner' }
    },
    {
      action: 'send_notification',
      config: { channel: 'email' }
    },
  ]
};

// 2. Register workflow in database
await db.insert(workflows).values({
  ...workflowTemplate,
  tenantId,
});

// 3. Trigger on event
eventEmitter.on('meter_reading.toner_low', async (data) => {
  const workflow = await getWorkflow(data.tenantId);
  await executeWorkflow(workflow, data);
});
```

### 5. Adding AI Integration

**Pattern:**
```typescript
// 1. Use Claude AI Service
const aiService = new ClaudeAIService();

// 2. Generate content
const response = await aiService.generateCompletion({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4000,
  temperature: 0.7,
  system: 'You are a business expert...',
  messages: [
    { role: 'user', content: userPrompt }
  ]
});

// 3. Store results with metadata
await db.insert(aiGeneratedContent).values({
  content: response,
  aiModel: 'claude-3-5-sonnet',
  tenantId,
  userId,
  timestamp: new Date(),
});
```

### 6. Multi-Tenant Query Pattern

**Always Include Tenant Filter:**
```typescript
// CORRECT - includes tenant_id
const result = await db.select()
  .from(myTable)
  .where(
    and(
      eq(myTable.tenantId, req.user.tenantId),
      eq(myTable.status, 'active')
    )
  );

// WRONG - missing tenant filter (data leak!)
const result = await db.select()
  .from(myTable)
  .where(eq(myTable.status, 'active'));
```

---

## 9. FRONTEND PAGES & USER INTERFACES (151 Pages)

### Dashboard & Analytics Pages
- AIAnalyticsDashboard, AIDocumentationDashboard, AIEmployeeDashboard
- AdvancedAnalytics, AdvancedAnalyticsDashboard
- SystemMonitoring, ReportsHub, AdvancedReporting

### CRM & Sales Pages
- BusinessRecords, CRMEnhanced, Contacts, CompanyContacts
- DealsManagementOptimization, DealsManagementOptimized
- SalesPipeline, SalesForecasting, Opportunities
- Proposals, ProposalBuilder, QuotesManagementOptimization

### Service & Field Operations
- ServiceDispatchDashboard, FleetMonitoringDashboard
- MobileServiceApp, MobileFieldService
- RemoteMonitoring, PreventiveMaintenanceScheduling
- TechnicianAssignment, ServiceForecastingAnalytics

### Inventory & Warehouse
- InventoryManagement, AssetManagement, EquipmentLifecycle
- ManufacturerIntegrationDevices, PurchaseOrdersOptimization
- ProductHub, ProductModels, WarehouseManagement

### Customer Portal & Self-Service
- CustomerSelfServicePortal, CustomerDashboard
- EquipmentHealthDashboard, ServiceRequestsDashboard

### AI & Automation Features
- AIHub, AISearchKnowledgeDashboard, AITaskScheduling, ConversationalAIDashboard
- BusinessProcessOptimization, AdvancedWorkflowsDashboard

### Administrative
- AccessControl, SecurityComplianceManagement, UserManagement
- CommissionManagement, AccountsPayable, AccountsReceivable

---

## 10. EXISTING DOCUMENTATION & ARTICLES

### Key Documentation Files
- `CLAUDE.md` - Development guidelines and architecture overview
- `PRD.md` - Comprehensive product requirements document
- `FLEET_MONITORING_DEPLOYMENT.md` - Fleet monitoring setup
- `PRINTYX_CLIENT_IMPLEMENTATION.md` - Client collector implementation
- `DATABASE_SCHEMA_HIERARCHY.md` - Schema relationships

### SEO & Knowledge Resources
- `seo-schema.ts` - SEO metadata and article schema
- `seo-routes.ts` - SEO management endpoints
- Schema support for 'Article' type in structured data

---

## 11. RECOMMENDATIONS FOR KNOWLEDGE BASE SYSTEM

### Core Requirements
1. **Document Storage:**
   - Use `documents` table with tenant_id
   - Version control via document versions table
   - Rich content support (JSON, markdown, HTML)

2. **Search Capabilities:**
   - Leverage AI Search & Knowledge Service
   - Vector embeddings for semantic search
   - Full-text search via PostgreSQL
   - Filter by category, tags, author

3. **Content Organization:**
   - Category hierarchy (Product, Service, Troubleshooting, Billing)
   - Tag-based organization
   - Related articles linking
   - Breadcrumb navigation

4. **AI Integration:**
   - Use AIDocumentationService for article generation
   - Suggest related articles based on search queries
   - AI-powered article summaries
   - Content quality scoring

5. **User Roles & Permissions:**
   - Admin: Create, edit, delete, publish
   - Manager: Create, edit own content
   - User: Read only
   - Customer: Read public articles

6. **Analytics:**
   - Track article views
   - Search analytics
   - User feedback (helpful/not helpful)
   - Popular articles
   - Search term analysis

### Implementation Approach
1. Extend `documents` table for articles
2. Create `articleCategories`, `articleTags` tables
3. Integrate with AI documentation service
4. Build search UI leveraging AI search service
5. Add customer portal article browsing
6. Implement feedback mechanism


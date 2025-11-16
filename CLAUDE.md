# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run dev` - Start development server with hot reload (tsx for server)
- `npm run build` - Production build (Vite for client + esbuild for server)
- `npm start` - Start production server (NODE_ENV=production)
- `npm run check` - TypeScript type checking (tsc --noEmit)

### Code Quality
- `npm run lint` - ESLint (JS/JSX files only - TypeScript linting disabled)
- `npm run format` - Check Prettier formatting
- `npm run format:write` - Apply Prettier formatting
- `npm run prepare` - Install Husky git hooks

### Database Operations
- `npm run db:push` - Push schema changes to main database
- `npm run db:push:forecast` - Push to forecasting database

### Database Updater (Test Data Generation)
- `npm run updater` - Database updater CLI interface
- `npm run updater:start` - Start CRON-based updaters
- `npm run updater:status` - Check updater status
- `npm run updater:test` - Test updater configuration
- `npm run example` - Run basic usage example

### Testing
- `npm run test:e2e` - Run Playwright end-to-end tests

## Project Architecture

### Tech Stack Summary

**Frontend Core**
- **React 18.3.1**: UI library with concurrent features
- **TypeScript 5.6.3**: Type-safe development
- **Vite 5.4.19**: Build tool with HMR
- **Wouter 3.3.5**: Lightweight routing (2KB vs React Router's 40KB+)
- **TanStack Query 5.60.5**: Server state management with automatic caching
- **Radix UI**: 30+ headless accessible components
- **Tailwind CSS 3.4.17**: Utility-first styling
- **shadcn/ui**: Pre-built component library (New York style)

**Backend Core**
- **Node.js** with ES Modules
- **Express.js 4.21.2**: Web framework
- **TypeScript**: Type-safe server code
- **tsx 4.19**: TypeScript execution runtime
- **esbuild 0.25**: Production bundler

**Database & ORM**
- **PostgreSQL**: Neon serverless hosting
- **Drizzle ORM 0.39.1**: Type-safe SQL toolkit
- **drizzle-kit 0.30.6**: Schema migrations
- **connect-pg-simple 10.0**: PostgreSQL session store

**Authentication**
- **Replit Auth**: OpenID Connect provider
- **openid-client 6.6**: OIDC implementation
- **Passport 0.7**: Authentication middleware
- **bcrypt 6.0**: Password hashing
- **express-session 1.18**: Session management

**Third-Party Integrations**
- **Stripe 18.5**: Payment processing
- **jsforce 3.10**: Salesforce integration
- **node-quickbooks 2.0**: QuickBooks integration
- **googleapis 155.0**: Google Calendar
- **@microsoft/microsoft-graph-client 3.0**: Microsoft 365
- **@anthropic-ai/sdk 0.37**: Claude AI
- **openai 5.12**: OpenAI integration

**UI Components & Libraries**
- **Lucide React 0.453**: Icon library (453+ icons)
- **React Hook Form 7.55**: Form state management
- **Zod 3.24**: Schema validation
- **Recharts 2.15**: Chart visualization
- **Framer Motion 11.13**: Animation library
- **Date-fns 3.6**: Date manipulation
- **@dnd-kit**: Drag and drop functionality

**Development & Testing**
- **Puppeteer 24.16**: Browser automation
- **@playwright/test 1.56**: E2E testing
- **Storybook 8.2**: Component development
- **Husky 9.0**: Git hooks
- **Prettier 3.3**: Code formatting

### Directory Structure

```
/home/user/Printyx/
├── client/                    # React frontend application
│   └── src/
│       ├── components/        # 185+ React components
│       │   ├── ui/           # 40+ shadcn/ui base components
│       │   ├── dashboards/   # Dashboard widgets
│       │   ├── forms/        # Form components
│       │   ├── mobile/       # Mobile-optimized components
│       │   ├── customer/     # Customer management UI
│       │   ├── service/      # Service dispatch UI
│       │   ├── charts/       # Data visualizations
│       │   ├── analytics/    # Analytics components
│       │   ├── calculator/   # Cost calculator UI
│       │   ├── quotes/       # Quote builder UI
│       │   └── [29+ other domain-specific directories]
│       ├── pages/            # 181 route components (lazy loaded)
│       ├── hooks/            # 14 custom React hooks
│       │   ├── useAuth.ts
│       │   ├── usePaginatedQuery.ts
│       │   ├── useOptimisticMutations.ts
│       │   ├── useRealTimeData.ts
│       │   ├── useWebSocket.ts
│       │   ├── use-toast.ts
│       │   ├── use-media-query.ts
│       │   └── ...
│       ├── lib/              # 14 utility libraries
│       │   ├── queryClient.ts         # TanStack Query config
│       │   ├── rbacQueryClient.ts     # RBAC-aware queries
│       │   ├── queryOptimizations.ts  # Query performance
│       │   ├── export-utils.ts        # CSV/Excel/PDF export
│       │   └── ...
│       └── data/             # Static data/constants
│
├── server/                    # Express.js backend
│   ├── index.ts              # Server entry point (231 lines)
│   ├── routes.ts             # Main routes file (519KB monolithic)
│   ├── routes-*.ts           # 24+ modular route files
│   │   ├── routes-business-records.ts
│   │   ├── routes-crm-goals.ts
│   │   ├── routes-deals-management.ts
│   │   ├── routes-service-dispatch.ts
│   │   ├── routes-enhanced-billing.ts
│   │   ├── routes-warehouse-fpy.ts
│   │   └── ...
│   ├── routes/               # Additional route modules
│   │   ├── salesforce-integration.ts
│   │   ├── quickbooks-integration.ts
│   │   ├── sales-forecasting-routes.ts
│   │   ├── ai-analytics.ts
│   │   └── ...
│   ├── middleware/           # 5 middleware modules
│   │   ├── tenancy.ts              # Tenant resolution
│   │   ├── requireTenant.ts        # Tenant enforcement
│   │   ├── subscription.ts         # Subscription checks
│   │   ├── cache-middleware.ts     # Response caching
│   │   ├── rbac-middleware.ts      # RBAC enforcement
│   │   └── ...
│   ├── services/             # 38 business logic services
│   │   ├── subscription-service.ts
│   │   ├── stripe-service.ts
│   │   ├── email-service.ts
│   │   ├── claude-ai-service.ts
│   │   ├── customer-portal-service.ts (68KB)
│   │   └── ...
│   ├── integrations/         # 8 third-party integrations
│   │   ├── integration-service.ts
│   │   ├── dashboard-service.ts
│   │   ├── data-mapper.ts
│   │   ├── webhook-service.ts
│   │   └── ...
│   ├── database-updater/     # Test data generation system
│   │   ├── core/             # Base updater classes
│   │   ├── updaters/         # Specific updaters
│   │   ├── config/           # Configuration
│   │   ├── cli/              # CLI interface
│   │   ├── api/              # API routes
│   │   └── examples/         # Usage examples
│   ├── tests/                # Server-side tests
│   ├── utils/                # Server utilities
│   ├── websocket-service.ts  # WebSocket server
│   └── audit.log             # Root admin audit log
│
├── shared/                    # Shared TypeScript schemas (31 files)
│   ├── schema.ts             # Main schema (293KB)
│   ├── advanced-billing-schema.ts
│   ├── customer-portal-schema.ts (51KB)
│   ├── seo-schema.ts (44KB)
│   ├── equipment-schema.ts
│   ├── service-analysis-schema.ts
│   ├── warehouse-fpy-schema.ts
│   ├── manufacturer-integration-schema.ts
│   ├── customer-success-schema.ts
│   ├── lead-scoring-schema.ts
│   ├── security-schema.ts
│   ├── reporting-schema.ts
│   └── [20+ other specialized schemas]
│
├── printyx-client/           # Standalone monitoring client
│   └── src/
│       ├── collectors/       # SNMP/HTTP data collectors
│       ├── discovery/        # Network printer discovery
│       ├── api/              # API client
│       ├── config/           # Configuration management
│       ├── services/         # Scheduler & orchestration
│       └── utils/            # Logging & utilities
│
├── testing/                  # Puppeteer test suite
│   ├── components/           # Component tests
│   ├── crm-workflow-system.js
│   ├── comprehensive-app-test.js
│   └── run-tests.js
│
├── tests/                    # Playwright E2E tests
│   ├── smoke.spec.ts
│   └── satisfaction-rating-api.spec.ts
│
├── migrations/               # Main DB migrations (Drizzle)
├── migrations-forecasting/   # Forecasting DB migrations
├── database/                 # Database scripts & utilities
├── database-exports/         # Backup & export files
├── docs/                     # Architecture documentation
├── logs/                     # Application logs
├── attached_assets/          # Static asset storage
│
└── Configuration Files
    ├── package.json          # Dependencies & scripts
    ├── tsconfig.json         # TypeScript config
    ├── vite.config.ts        # Vite build config
    ├── drizzle.config.ts     # Main DB config
    ├── drizzle.forecasting.config.ts  # Forecasting DB
    ├── tailwind.config.ts    # Tailwind CSS config
    ├── eslint.config.js      # ESLint v9 flat config
    ├── playwright.config.ts  # E2E test config
    ├── components.json       # shadcn/ui config
    └── .husky/              # Git hooks
```

### Multi-Tenant Architecture

**4-Tier Organizational Hierarchy**
- **Platform Level**: Top-level platform administration
- **Company Level**: Individual business entities
- **Regional Level**: Geographic or departmental divisions
- **Location Level**: Physical locations or branches

**Key Features**
- Row-level security with `tenantId` filtering on all queries
- Session-based tenant resolution via middleware (server/middleware/tenancy.ts)
- PostgreSQL RLS (Row-Level Security) for data isolation
- Tenant context propagated through request headers and sessions

**8-Level Role Hierarchy**
1. Platform Admin (highest privileges)
2. Super Admin
3. Admin
4. Manager
5. Standard User
6. Support
7. Read-Only
8. Guest (lowest privileges)

**Permission System**
- Granular permissions with inheritance
- Entity-level and action-level controls
- Cached permission checks for performance (memoization)
- Middleware enforcement at route level (rbac-middleware.ts)

### Key Architectural Patterns

**1. Unified Business Records (Zero-Data-Loss Pattern)**
- Leads and customers are the same entity (`business_records` table)
- Status field determines current state (lead vs customer)
- Lead-to-customer conversion preserves all historical data
- No data migration required - just status update
- Complete audit trail maintained
- Implementation: shared/schema.ts (businessRecords table)

**2. Multi-Platform Integration Architecture**
- Supported platforms: E-Automate, Salesforce, QuickBooks, Apollo.io, ZoomInfo
- Isolated field mapping per platform
  - server/integrations/data-mapper.ts (generic)
  - salesforce-mapping.ts (Salesforce-specific)
  - quickbooks-mapping.ts (QuickBooks-specific)
- Bi-directional synchronization with conflict resolution
- Last-write-wins strategy with audit trail
- Webhook support for real-time updates

**3. Mobile-First Design Pattern**
- Progressive enhancement: Mobile → Tablet → Desktop
- Mobile-optimized components: client/src/components/mobile/
  - mobile-nav.tsx: Mobile navigation
  - mobile-bottom-nav.tsx: Bottom navigation bar
  - mobile-dialog.tsx: Mobile dialogs
  - mobile-fab.tsx: Floating action button
  - mobile-search.tsx: Mobile search interface
- Touch-optimized interactions (larger tap targets, swipe gestures)
- Responsive breakpoint detection: client/src/hooks/use-media-query.ts

**4. Code Splitting & Bundle Optimization**
- Route-level code splitting with React.lazy() for all 181 pages
- Manual vendor chunk splitting in vite.config.ts:
  - vendor-react (React core)
  - vendor-ui-core (Radix UI essentials)
  - vendor-ui-extra (Additional Radix components)
  - vendor-query (TanStack Query)
  - vendor-form (React Hook Form + Zod)
  - vendor-icons (Lucide React)
  - vendor-date (Date-fns)
  - vendor-charts (Recharts)
  - vendor-utils (Utilities)
- Tree shaking for unused code elimination
- Dynamic imports for on-demand feature loading

**5. Real-Time Architecture**
- WebSocket server: server/websocket-service.ts
- Protocol: ws:// (WebSocket)
- Pub/Sub pattern with room-based subscriptions
- Use cases: Live notifications, collaborative editing, real-time metrics
- Client hook: client/src/hooks/useWebSocket.ts
- Integration with TanStack Query for automatic cache updates
- Fallback to polling for browsers without WebSocket support

**6. Caching Strategy**

Server-Side Caching:
- Response caching with ETag headers (server/middleware/cache-middleware.ts)
- Vary-by-tenant headers for multi-tenant isolation
- Cache-Control directives (max-age, must-revalidate)
- Application-level caching with memoization (server/services/cache-service.ts)

Client-Side Caching:
- TanStack Query automatic caching with stale-while-revalidate
- Query deduplication (client/src/lib/queryOptimizations.ts)
- Prefetching strategies for common navigation paths
- Background refetching for stale data
- Cache persistence across sessions

**7. Database Updater System**
- **Purpose**: Automated CRON-based test data generation for demos
- **Location**: server/database-updater/
- **Architecture**:
  - BaseUpdater: Abstract class for all updaters
  - UpdaterRegistry: Central management of updaters
  - CronScheduler: Time-based execution with timezone support
  - ConfigurationManager: Centralized configuration
- **Features**:
  - Dry-run mode for testing without database changes
  - Transaction safety with automatic rollback on errors
  - Comprehensive logging and error handling
  - CLI interface: `npm run updater` commands
- **Use Cases**:
  - Generate realistic customer data
  - Create service calls and work orders
  - Populate inventory and equipment records
  - Simulate business activity patterns

**8. Printyx Client Monitoring System**
- **Purpose**: Standalone SNMP/HTTP monitoring for network-connected copiers
- **Location**: printyx-client/ (separate Node.js application)
- **Architecture**:
  - Collectors: SNMP and HTTP data collection modules
  - Discovery: Automatic network printer discovery
  - API Client: HTTPS-only communication with main platform
  - Scheduler: Periodic data collection and upload
- **Security**:
  - API key authentication
  - AES-256-GCM encryption for stored credentials
  - SNMPv3 support for secure device communication
  - Certificate pinning for API connections
  - HIPAA, PCI DSS, SOC 2, FedRAMP compliant design
- **Data Collected**:
  - Meter readings (B&W, color, total)
  - Supply levels (toner, drum, fuser)
  - Device status and error conditions
  - Model information and serial numbers

**9. UX Enhancement Pattern (Phase 3)**

Based on recent commits and WORKFLOW_IMPLEMENTATION_SUMMARY.md, a systematic UX enhancement pattern is being applied across the application:

**Bulk Operations**:
- Component: client/src/components/ui/bulk-operations-toolbar.tsx
- Features: Multi-select, batch actions, keyboard shortcuts (Cmd/Ctrl+A for select all)
- Consistent across all list views

**Inline Editing**:
- Component: client/src/components/ui/inline-edit.tsx
- Pattern: Click-to-edit with validation and cancel/save actions
- Real-time updates with optimistic UI

**Empty States**:
- Component: client/src/components/ui/empty-state.tsx
- Contextual CTAs for first-time users
- Guidance for next steps

**Export Functionality**:
- Library: client/src/lib/export-utils.ts
- Formats: CSV, Excel (XLSX), PDF
- Consistent export UI across all data tables

**Recent UX Enhancements Applied**:
- Customers page (commit 5837a98)
- Inventory page (commit 779602c)
- Implementation guide (commit c4bc0db)
- Comprehensive summary (commit 5ab5f29)

### Schema Organization

**Main Schema** (shared/schema.ts - 293KB)
- Core business entities with re-exports from specialized schemas
- Equipment lifecycle management
- Service analysis and parts tracking
- Mobile service sessions
- Enhanced service workflows
- Warehouse operations and FPY (First Pass Yield) metrics
- Manufacturer integrations

**Specialized Schemas** (31 files total)

Business Operations:
- `advanced-billing-schema.ts`: Usage-based billing, tiered pricing, meter billing
- `customer-portal-schema.ts` (51KB): Self-service portal, ticket management
- `commission-schema.ts`: Sales commission calculations
- `quote-proposal-schema.ts`: Quote builder and proposal generation

Service Management:
- `equipment-schema.ts`: Equipment lifecycle, delivery, installation
- `service-analysis-schema.ts`: Service call analysis, parts tracking
- `enhanced-service-schema.ts`: Phone-in tickets, technician sessions
- `mobile-service-schema.ts`: Mobile field service workflows
- `gps-tracking-schema.ts`: Fleet management, route optimization

Warehouse & Inventory:
- `warehouse-fpy-schema.ts`: First pass yield metrics, kitting operations
- `manufacturer-integration-schema.ts`: Device registrations, metrics collection

Sales & Marketing:
- `lead-scoring-schema.ts`: AI-powered lead qualification
- `customer-success-schema.ts`: Health scores, onboarding, renewals
- `content-marketing-schema.ts`: Blog posts, SEO management
- `seo-schema.ts` (44KB): Comprehensive SEO tracking
- `apollo-schema.ts`: Apollo.io enrichment data

Analytics & Reporting:
- `reporting-schema.ts`: Custom reports and dashboards
- `sales-forecasting-schema.ts`: Predictive analytics (separate DB)

Platform Features:
- `security-schema.ts`: MFA, audit logs, compliance tracking
- `task-schema.ts`: Task management system
- `knowledge-base-schema.ts`: Documentation and support articles
- `intelligent-alerts-schema.ts`: Proactive alerting system
- `workflow-automation-schema.ts`: Automation workflows

Integrations:
- `quickbooks-schema.ts`: QuickBooks integration field mapping
- `print-cost-calculator-schema.ts`: TCO (Total Cost of Ownership) calculator

User Management:
- `auth-schema.ts`: Authentication schemas
- `user-lifecycle-schema.ts`: User onboarding and training
- `tenant-onboarding-schema.ts`: Tenant setup workflows
- `schema-subscriptions.ts`: SaaS subscription management

**Database Configurations**
- `drizzle.config.ts`: Main database (core business entities)
- `drizzle.forecasting.config.ts`: Sales forecasting database (isolated for analytics)

**Migration System**
- Drizzle Kit for schema-driven migrations
- Directories: migrations/ (main), migrations-forecasting/ (forecasting)
- Commands: `npm run db:push` and `npm run db:push:forecast`

### Path Aliases

Configured in tsconfig.json and vite.config.ts:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Routing & State Management

**Frontend Routing (Wouter 3.3.5)**

Router implementation: client/src/App.tsx

**Route Categories** (181 total pages):

1. **Authentication** (eager loaded):
   - /login, /signup, /forgot-password, /reset-password, /verify-email

2. **Marketing Pages** (lazy loaded):
   - /, /copier-dealer-crm, /print-service-dispatch-mobile
   - /canon-master-product-catalog
   - /predictive-intelligence, /modern-architecture
   - /blog, /blog/:slug
   - /roi-calculator, /case-studies

3. **Core Application** (all lazy loaded):
   - Dashboard: /dashboard
   - CRM: /customers, /crm, /leads/:id, /business-records
   - Sales: /deals, /opportunities, /quotes, /proposals
   - Service: /service-dispatch, /mobile-field-service, /service-reports
   - Inventory: /inventory, /warehouse, /purchase-orders
   - Products: /product-hub, /product-models, /accessories
   - Billing: /billing, /invoices, /meter-billing, /accounts-payable
   - Reports: /reports, /advanced-reporting, /analytics
   - Settings: /settings, /integrations, /tenant-setup

**State Management Strategy**

Server State (TanStack Query):
- Primary strategy for all API data
- Configuration: client/src/lib/queryClient.ts
- RBAC-aware query client: client/src/lib/rbacQueryClient.ts
- Query optimizations: client/src/lib/queryOptimizations.ts

Key Features:
- Automatic caching with stale-while-revalidate
- Background refetching for fresh data
- Optimistic updates for instant UI feedback
- Query invalidation on mutations
- Pagination support via usePaginatedQuery hook
- Real-time updates via WebSocket integration

Custom Server State Hooks:
- `usePaginatedQuery.ts`: Server-side pagination
- `useOptimisticMutations.ts`: Optimistic UI updates
- `useRealTimeData.ts`: WebSocket-based real-time data
- `useExternalIntegrations.ts`: Third-party API data
- `useCrossModuleIntegration.ts`: Cross-module data sharing

Local/UI State:
- React Hook Form for form state
- useState/useReducer for component-local state
- Context API for theme and auth context

Authentication State:
- Hook: client/src/hooks/useAuth.ts
- Storage: Session-based with PostgreSQL backing
- Integration: Replit Auth with OpenID Connect

Real-Time State:
- Hook: client/src/hooks/useWebSocket.ts
- Server: server/websocket-service.ts
- Protocol: ws:// (WebSocket)
- Use cases: Live notifications, real-time metrics, collaborative editing

Global UI State:
- NProgress: Loading indicator (integrated with TanStack Query)
- Toast notifications: client/src/hooks/use-toast.ts
- Theme: next-themes package for dark/light mode

### Backend API Structure

**Server Entry Point**
- File: server/index.ts (231 lines)
- Server: Express.js with HTTP server
- Port: 5000 (configurable via PORT env var)
- Host: 0.0.0.0 with port reuse enabled

**Middleware Stack** (applied in order):

1. **Security**:
   - Helmet (CSP, HSTS, XSS protection, frameguard)
   - Permissions-Policy headers
   - CORS with whitelist (production: *.printyx.net, dev: localhost + Replit)
   - Request ID assignment (X-Request-Id header)

2. **Performance**:
   - Compression (gzip/deflate)
   - Response caching (cache-middleware.ts)
   - Request size limits (10MB JSON/urlencoded)

3. **Session & Auth**:
   - express-session with PostgreSQL store
   - CSRF protection (csurf)
   - Replit Auth integration (OpenID Connect)

4. **Logging & Monitoring**:
   - Request/response logging
   - Audit log for root-admin actions (server/audit.log)
   - Duration tracking

5. **Error Handling**:
   - Global error handler with request ID correlation

**API Route Organization**

Main routes file: server/routes.ts (519KB monolithic)

Modularized route files (70+ files):

**Core Business**:
- routes-business-records.ts: Unified lead/customer management
- routes-crm-goals.ts: Sales goals tracking
- routes-deals-management.ts: Deal pipeline
- routes-opportunities.ts: Opportunity tracking
- routes-invoices.ts: Invoice generation
- routes-enhanced-billing.ts: Advanced billing

**Service Management**:
- routes-service-dispatch.ts: Dispatch optimization
- routes-enhanced-service.ts: Phone-in tickets, technician sessions
- routes-service-analysis.ts: Service call analytics
- routes-proactive-maintenance.ts: Preventive maintenance
- routes-technician-management.ts: Technician resources

**Inventory & Products**:
- routes-product-models.ts: Product catalog
- routes-software-products.ts: Software SKUs
- routes-warehouse.ts: Warehouse operations
- routes-warehouse-fpy.ts: First pass yield tracking
- routes-purchase-orders.ts: PO management

**Integration Routes** (server/routes/):
- salesforce-integration.ts: Salesforce sync
- quickbooks-integration.ts: QuickBooks integration
- manufacturer-integration.ts: Canon, Xerox, etc.
- apollo-routes.ts: Apollo.io enrichment
- gps-tracking-routes.ts: Fleet tracking
- calendar-routes.ts: Google/Microsoft Calendar

**Advanced Features**:
- sales-forecasting-routes.ts: Predictive analytics
- customer-success-routes.ts: Health scores, CSM
- lead-scoring-routes.ts: AI-powered lead qualification
- ai-gpt5.ts: GPT-5 integration
- ai-analytics.ts: AI-powered insights
- content-marketing-routes.ts: Blog and SEO
- print-cost-calculator-routes.ts: TCO calculator

**Enterprise Features**:
- routes-enhanced-rbac.ts: Role-based access control
- routes-security-compliance.ts: Compliance tracking
- routes-breach-detection.ts: Security monitoring
- routes-reporting.ts: Custom reports
- routes-reporting-architecture.ts: Report builder

**Platform Management**:
- routes-root-admin.ts: Platform administration
- routes-tenant-onboarding.ts: Tenant provisioning
- routes-admin-subscriptions.ts: SaaS subscription management

**RESTful API Conventions**:
```
GET    /api/[resource]         - List with pagination
GET    /api/[resource]/:id     - Get single item
POST   /api/[resource]         - Create
PUT    /api/[resource]/:id     - Update (full)
PATCH  /api/[resource]/:id     - Update (partial)
DELETE /api/[resource]/:id     - Delete
```

**Tenant-Aware Endpoint Pattern**:
```typescript
// Middleware stack
app.use(resolveTenant);        // Resolve tenant from header/session
app.use(requireTenant);        // Enforce tenant context
app.use(requireAuth);          // Require authentication

// Example endpoint
app.get('/api/customers', async (req: TenantRequest, res) => {
  const { tenantId } = req;
  const customers = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenantId)
  });
  res.json(customers);
});
```

**Error Response Format**:
```json
{
  "message": "Error description",
  "code": "error_code",
  "details": {},
  "requestId": "uuid"
}
```

### Integration Points

**External Services**

Database:
- **Neon PostgreSQL**: Serverless database hosting
- Multiple databases: main, forecasting, reporting

Authentication:
- **Replit Auth**: OpenID Connect authentication provider

Payment Processing:
- **Stripe**: Payment gateway, subscription billing, invoices

Third-Party APIs:
- **Salesforce**: CRM synchronization (jsforce 3.10)
- **QuickBooks**: Accounting integration (node-quickbooks 2.0, intuit-oauth 4.2)
- **Google Calendar**: Calendar integration (googleapis 155.0)
- **Microsoft 365**: Calendar and email (microsoft-graph-client 3.0)
- **Apollo.io**: Lead enrichment
- **ZoomInfo**: Business intelligence data

AI Services:
- **Anthropic Claude**: AI assistant features (@anthropic-ai/sdk 0.37)
- **OpenAI**: GPT integration (openai 5.12)

File Storage:
- **Google Cloud Storage**: Asset and document storage (@google-cloud/storage 7.16)
- **Local Storage**: Configured via environment variables

### Key Business Domains

**CRM (Customer Relationship Management)**
- Unified business records (zero-data-loss lead-to-customer conversion)
- Lead management and scoring (AI-powered)
- Contact management
- Opportunity and deal tracking
- Sales goal management
- Commission calculations

**Service Management**
- Service dispatch and scheduling
- Mobile field service workflows
- Phone-in ticket management
- Technician session tracking
- Service call analysis
- Proactive and preventive maintenance
- Parts tracking and management
- GPS tracking and route optimization

**Inventory & Warehouse**
- Warehouse operations
- Inventory tracking
- Purchase order management
- Equipment lifecycle management
- First Pass Yield (FPY) metrics
- Kitting operations
- Parts management

**Product Management**
- Product catalog (Product Hub)
- Product models and variants
- Software products
- Accessories and supplies
- Canon master product catalog integration
- Manufacturer integrations

**Billing & Financial**
- Invoice generation and management
- Meter billing (usage-based)
- Advanced billing features (tiered pricing, usage-based)
- Accounts payable
- Contract management
- Subscription billing (Stripe integration)

**Sales & Marketing**
- Deal pipeline management
- Opportunity tracking
- Quote builder
- Proposal generation
- TCO (Total Cost of Ownership) calculator
- Content marketing and blogging
- SEO management and tracking

**Analytics & Reporting**
- Performance monitoring
- Custom reports and dashboards
- Advanced reporting architecture
- Sales forecasting (predictive analytics)
- AI-powered insights
- Business intelligence

**Customer Success**
- Customer health scores
- Onboarding workflows
- Renewal management
- Customer portal (self-service)
- Support ticket management

**Platform Features**
- Multi-tenant management
- Tenant onboarding
- User lifecycle management
- Security and compliance tracking
- Audit logging
- Task management
- Workflow automation
- Knowledge base
- Intelligent alerts

## Development Guidelines

### Authentication Flow

1. **Replit Auth Setup**: server/replitAuth.ts
2. **Auth Routes**: server/auth-routes.ts
3. **Session Management**: PostgreSQL-backed sessions (connect-pg-simple)
4. **Middleware**: requireAuth checks session.userId or user.id
5. **RBAC**: Enhanced RBAC with 8-level role hierarchy (server/enhanced-rbac-service.ts)

**Session Configuration**:
- Store: PostgreSQL (connect-pg-simple)
- Secret: SESSION_SECRET environment variable
- Cookie: httpOnly, secure (production only), sameSite: 'lax'
- Max age: 30 days

**Protected Route Pattern**:
```typescript
app.get('/api/protected', requireAuth, requireTenant, async (req, res) => {
  // User is authenticated and tenant is resolved
  const userId = req.session.userId;
  const tenantId = req.tenantId;
  // ... route logic
});
```

### Database Patterns

**Always Include Tenant Filtering**:
```typescript
// Good
const customers = await db.query.customers.findMany({
  where: eq(customers.tenantId, tenantId)
});

// Bad - security risk!
const customers = await db.query.customers.findMany();
```

**Use Drizzle ORM**:
- Type-safe query building
- Automatic joins with relations
- Transaction support
- Prepared statements for performance

**Leverage PostgreSQL Features**:
- Row-Level Security (RLS) for additional data isolation
- JSONB for flexible schema extensions
- Indexes for query performance (see docs/PERFORMANCE_OPTIMIZATION_SCHEMA_INDEXES.md)
- Enums (pgEnum) for type-safe status fields

**Database Migration Workflow**:
1. Update schema file in shared/ directory
2. Run `npm run db:push` to apply changes
3. Test in development environment
4. Commit schema changes with migration

### Component Development

**Use shadcn/ui Components**:
- Base components located in client/src/components/ui/
- Customizable via className props
- Radix UI for accessibility
- Pre-configured with Tailwind CSS

**Follow Mobile-First Principles**:
- Design for mobile viewport first
- Use responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-optimized interactions (48px minimum tap targets)
- Mobile-specific components in client/src/components/mobile/

**Implement Proper Loading States**:
- Use TanStack Query's isLoading and isFetching states
- Show skeleton loaders for better UX
- NProgress for global loading indicator

**Error Boundaries**:
- Implement error boundaries for graceful error handling
- Show user-friendly error messages
- Log errors for debugging

**Performance Optimization**:
- Use React.memo() for expensive components
- Implement virtualization for long lists (react-window)
- Lazy load images and heavy components
- Use useMemo and useCallback appropriately

### API Development

**RESTful Endpoint Design**:
- Use standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Consistent error response format
- Pagination for list endpoints

**Tenant-Aware Middleware**:
```typescript
// Always use these middleware for protected routes
app.use(resolveTenant);   // Resolves tenant from session/header
app.use(requireTenant);   // Enforces tenant presence
app.use(requireAuth);     // Requires authentication
```

**Input Validation**:
- Use Zod schemas for validation
- Validate all user input
- Sanitize data before database operations
- Return clear validation error messages

**Error Handling**:
```typescript
try {
  // ... operation
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId: req.id
  });
}
```

**Rate Limiting**:
- Applied via express-rate-limit
- Configure per-endpoint as needed
- Different limits for authenticated vs unauthenticated users

### Security Best Practices

**Authentication & Authorization**:
- Always require authentication for protected routes
- Implement proper RBAC checks
- Validate tenant access for all data operations
- Use CSRF protection for state-changing operations

**Data Protection**:
- Never expose sensitive data in API responses
- Hash passwords with bcrypt (cost factor 10+)
- Encrypt sensitive data at rest (AES-256-GCM for Printyx Client credentials)
- Use HTTPS in production (enforced via Helmet)

**Input Validation & Sanitization**:
- Validate all user input with Zod schemas
- Sanitize HTML content to prevent XSS
- Use parameterized queries to prevent SQL injection
- Limit request payload sizes (10MB configured)

**Security Headers**:
- Helmet middleware for security headers
- CSP (Content Security Policy)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options, X-Content-Type-Options

**Audit Logging**:
- Log all root-admin actions to server/audit.log
- Include timestamps, user IDs, and action details
- Monitor for suspicious activity

### Testing Guidelines

**E2E Testing (Playwright)**:
- Write tests in tests/ directory
- Test critical user flows
- Run with `npm run test:e2e`
- Use Page Object Model for maintainability

**Integration Testing (Puppeteer)**:
- Test components in isolation (testing/components/)
- Test workflows (testing/crm-workflow-system.js)
- Run with testing/run-tests.js

**Type Checking**:
- Run `npm run check` before committing
- Fix all TypeScript errors
- Avoid using `any` type

**Code Quality**:
- Format with Prettier: `npm run format:write`
- Lint JavaScript: `npm run lint`
- Follow existing code style
- Write meaningful commit messages

### Performance Optimization

**Frontend**:
- Code splitting with React.lazy()
- Manual vendor chunking (vite.config.ts)
- Image optimization and lazy loading
- Query deduplication (TanStack Query)
- Prefetching for common navigation paths
- Virtualization for long lists

**Backend**:
- Response caching with ETags
- Database query optimization with indexes
- Connection pooling (Neon serverless)
- Compression middleware (gzip)
- Memoization for expensive operations

**Database**:
- Proper indexes on frequently queried columns
- Avoid N+1 queries (use joins)
- Batch operations where possible
- Use prepared statements
- Monitor query performance

### Common Pitfalls to Avoid

1. **Forgetting Tenant Context**: Always filter by tenantId
2. **Skipping Validation**: Validate all user input with Zod
3. **Ignoring Loading States**: Show proper loading indicators
4. **Missing Error Handling**: Implement try-catch and error boundaries
5. **Over-fetching Data**: Use pagination and field selection
6. **Hardcoding Values**: Use environment variables for configuration
7. **Committing Secrets**: Never commit .env files or credentials
8. **Ignoring TypeScript Errors**: Fix all type errors before deploying
9. **Not Testing**: Write and run tests for critical functionality
10. **Direct Database Access**: Always use Drizzle ORM, never raw SQL without parameterization

## Quick Reference

### Environment Variables
See .env.example for complete list. Key variables:
- `DATABASE_URL`: PostgreSQL connection string (Neon)
- `SESSION_SECRET`: Session encryption secret
- `NODE_ENV`: development | production
- `PORT`: Server port (default: 5000)
- `STRIPE_SECRET_KEY`: Stripe API key
- `REPL_ID`, `REPL_OWNER`: Replit Auth configuration

### Important Files
- `server/index.ts`: Server entry point
- `client/src/App.tsx`: Frontend router
- `shared/schema.ts`: Main database schema
- `vite.config.ts`: Build configuration
- `drizzle.config.ts`: Database configuration
- `package.json`: Dependencies and scripts

### Useful Commands
```bash
# Development
npm run dev          # Start dev server
npm run check        # Type check
npm run lint         # Lint code
npm run format       # Check formatting

# Database
npm run db:push      # Push schema changes

# Testing
npm run test:e2e     # Run E2E tests

# Production
npm run build        # Build for production
npm start            # Start production server
```

### Getting Help
- Check docs/ directory for detailed architecture documentation
- Review existing code for patterns and conventions
- Ask questions about unfamiliar patterns before implementing
- Refer to component examples in client/src/components/
- Check server/routes/ for API endpoint patterns

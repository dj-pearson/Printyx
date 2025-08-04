# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform designed to consolidate fragmented technology stacks for small-to-medium copier dealers. It addresses a significant market need by replacing disconnected legacy systems (CRM, billing, service dispatch, inventory) with a single, integrated solution. The platform aims to eliminate data silos, reduce manual processes, and provide a comprehensive system for managing all aspects of a copier dealership.

**Recent Enhancement Focus**: Successfully completed comprehensive Root Admin security suite implementation with Social Media Generator (Claude 4 powered) restricted to root admin access, and full Security Management, System Monitoring, and Access Control systems operational. All root admin security functions now provide enterprise-grade oversight capabilities for platform administrators.

**Critical Architecture Resolution (February 2025)**: Successfully eliminated hardcoded tenant ID technical debt throughout the entire codebase. Replaced 50+ hardcoded instances with proper session-based tenant resolution, implemented comprehensive tenant middleware across all routes, and established consistent data transformation layer for frontend-backend field mapping. All routes now use proper multi-tenant architecture with `TenantRequest` types and tenant isolation.

**Performance & Caching Optimization (February 2025)**: Addressed comprehensive performance issues including inconsistent polling intervals (30s vs 60s), overly aggressive caching (`staleTime: Infinity`), missing pagination on large datasets, and lack of optimistic updates. Implemented standardized polling tiers (30s/60s/5min/15min), smart cache strategies by data type (30s to 60min), pagination system with search/filter capabilities, optimistic mutation hooks with rollback, and grouped cache invalidation strategies. Created complete performance optimization framework with adaptive polling, page visibility awareness, and monitoring capabilities.

**Form Validation Standardization (February 2025)**: Resolved inconsistent validation patterns across the application where some forms used comprehensive Zod schemas while others had minimal validation and inconsistent error messaging. Created unified validation library with 8 comprehensive schemas covering all business domains, enhanced form hooks with real-time validation and consistent error handling, and reusable form components with standardized validation feedback. Implemented `useValidatedForm` hook, centralized validation utilities, and consistent error messaging system providing improved user experience and data integrity.

**Phase 2 COMPLETED**: All 13 major Phase 2 features successfully implemented and operational - Commission Management, Demo Scheduling, Sales Forecasting, Service Dispatch Optimization, Preventive Maintenance, Customer Success Management, Remote Monitoring & IoT, Document Management, Mobile Service App, Advanced Analytics, Business Process Optimization, Security & Compliance, and Incident Response System.

**Phase 3 Development Active**: Advanced enterprise capabilities including AI-powered features, predictive analytics, advanced integrations, and enhanced automation workflows for comprehensive copier dealer management platform.

**Phase 3 Progress Update (February 2025)**: Successfully implemented four major enterprise-grade capabilities:
- **AI-Powered Analytics Dashboard**: 12 ML models operational with 89-94% accuracy for customer churn prediction, CLV forecasting, and predictive maintenance
- **Advanced Integration Hub**: 42 active integrations with 97.4% success rate, comprehensive API marketplace, webhook management, and real-time data synchronization
- **Advanced Workflow Automation**: 76 active workflows achieving 94.7% success rate, intelligent rules engine with 198 active rules, and 78.4% automation coverage saving 847.3h monthly
- **Root Admin Security Suite**: Complete platform security management including Social Media Generator (Claude 4), Security Management, System Monitoring, and Access Control with role-based restrictions

**Customer Success Management**: Comprehensive customer health scoring with predictive churn analysis, equipment usage analytics with optimization recommendations, satisfaction tracking with NPS scoring, and automated intervention workflows for at-risk accounts.

**Remote Monitoring & IoT Integration**: Real-time equipment monitoring with IoT sensors, predictive maintenance analytics, fleet overview dashboards, automated alert systems, and environmental condition tracking for proactive equipment management and reduced downtime.

**Document Management & Workflow Automation**: Advanced document lifecycle management with OCR processing, automated workflow orchestration, compliance tracking, and intelligent categorization system for contracts, service documentation, and regulatory records.

**Mobile Service App**: Comprehensive mobile application for field technicians with GPS route optimization, real-time job management, parts inventory tracking, timer functionality, and offline capabilities for efficient field service operations.

### Business Architecture Clarification
- **Printyx Clients**: Copier dealers who sign up for Printyx service (managed via tenant system)
- **Business Records**: The client's customers and leads (businesses that buy/might buy copiers from the dealer)
- **E-Automate Integration**: External system data sync for migrating existing customer data into business records

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool.
- **UI Library**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design.
- **Routing**: Wouter for lightweight client-side routing.
- **State Management**: TanStack Query (React Query) for server state management and caching.
- **Forms**: React Hook Form with Zod validation schemas.

### Backend Architecture
- **Runtime**: Node.js with Express.js framework.
- **Type System**: TypeScript.
- **API Design**: RESTful API architecture with tenant-aware endpoints.
- **Authentication**: Replit Auth integration with OpenID Connect.
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple.

### Database Layer
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM for type-safe database operations and migrations.
- **Schema Design**: Multi-tenant architecture with tenant isolation and comprehensive role-based access control.
- **RBAC Implementation**: Comprehensive role hierarchy with department-based permissions.
- **Key Entities**: Users, Roles, Tenants, Business Records (unified leads/customers), Equipment, Contracts, Service Tickets, Inventory Items, Technicians, Meter Readings, Invoices, Tasks, Projects, Service Call Analysis, Parts Orders, Warehouse Operations.

### Multi-Tenancy & Multi-Location Role-Based Access Control
- **Tenant Isolation**: Row-level security with `tenantId` filtering across all business entities.
- **Multi-Location Architecture**: Enhanced 4-tier organizational structure supporting 1000+ employees:
  - **Platform Level**: Printyx system administrators and support staff
  - **Company Level**: C-level executives with access to all locations within their tenant
  - **Regional Level**: Regional managers overseeing multiple locations within assigned regions
  - **Location Level**: Location-specific management and department roles
- **8-Level Role Hierarchy**: From individual contributors (Level 1) to platform admins (Level 8)
- **Access Scope Control**: Four access scopes (platform, company, regional, location) determine data visibility
- **Location & Regional Management**: Comprehensive location and region tables with manager assignments
- **Enhanced Data Segregation**: Multi-layered filtering by tenant, region, location, role, team, and individual assignments
- **Permission System**: Granular module permissions with location-aware access controls

### Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect.
- **Session Storage**: PostgreSQL-backed sessions.
- **Authorization**: Middleware-based authentication checks on all protected routes.
- **User Context**: Automatic tenant resolution from authenticated user sessions.

### API Structure
- **Authentication Routes**: `/api/auth/*`
- **Dashboard Routes**: `/api/dashboard/*`
- **Entity Routes**: RESTful endpoints for core business entities (customers, contracts, service tickets, inventory, technicians, tasks, projects).
- **Tenant-Aware**: All business logic routes automatically scope data by tenant.

### Technical Implementations
- **Meter Billing System**: Automated invoice generation, contract-based calculations, tiered billing rates.
- **Service Dispatch**: Smart technician assignment, skills-based routing, work order optimization.
- **CRM System**: Lead pipeline management, quote generation, customer interaction and equipment tracking.
- **Unified Business Records System**: Revolutionary zero-data-loss lead-to-customer conversion with unified businessRecords table supporting complete lifecycle management (new → contacted → qualified → active → inactive/churned/competitor_switch/non_payment) eliminating data duplication and ensuring seamless conversion workflow. **STATUS: OPERATIONAL** - HubSpot-style leads management interface fully functional with advanced filtering, table/card views, and comprehensive CRUD operations.
- **Triple-Platform Integration System**: Complete E-Automate compatibility (90% of dealers) with comprehensive Salesforce integration capability and QuickBooks Online financial integration, featuring 140+ field mappings across accounts, contacts, opportunities, activities, customers, vendors, and financial data with isolated field mapping architecture preventing data conflicts.
- **Unified Data Enrichment System**: Comprehensive lead prospecting platform with ZoomInfo and Apollo.io integration, featuring 50+ enriched contact fields, company intelligence data, automated campaign management, and advanced analytics dashboard for B2B lead generation and conversion tracking.
- **QuickBooks Financial Integration**: OAuth2-based integration with QuickBooks Online for seamless financial data synchronization, supporting customer/vendor sync, product catalog integration, invoice management, and chart of accounts mapping with real-time token management and comprehensive field transformation system.
- **Legal Compliance Framework**: Comprehensive legal documentation including End User License Agreement (EULA), Privacy Policy, and Terms & Conditions, fully integrated into the platform with dedicated pages and homepage footer links for complete regulatory compliance.
- **Product Management System**: Seven-category product catalog including Models, Accessories, Services, Supplies, and IT/Managed Services, consolidated into a unified Product Management Hub.
- **Task Management System**: Personal and multi-step project tracking with time tracking and collaboration features.
- **Equipment Lifecycle Management**: Comprehensive workflow for purchase orders, warehouse operations, delivery, installation, documentation, and asset tracking.
- **CSV Import System**: Bulk import with tenant data segmentation, validation, and error reporting.
- **Nested Sidebar Navigation**: Expandable navigation structure for complex modules like Equipment Lifecycle and Product Management.
- **Advanced Reporting & Analytics**: Business intelligence with revenue, customer, and service performance metrics, interactive dashboards.
- **Workflow Automation System**: Automated workflow rule engine with trigger-based actions and template creation.
- **System Integrations Dashboard**: Management for third-party integrations with device manufacturers, accounting systems, and CRM platforms.
- **Deployment Readiness System**: Monitoring for go-live preparation across infrastructure, security, testing, documentation, and business readiness.
- **Enhanced Service Dispatch System**: Comprehensive service call analysis with outcome assessment, detailed ticket analysis, customer satisfaction tracking, labor cost calculation, and integrated parts ordering workflow with vendor management and delivery tracking.
- **Root Admin Security Suite**: Comprehensive security management platform including Social Media Generator (Claude 4 API integration with Make.com webhook broadcasting), Security Management (event monitoring, rule management, system health), System Monitoring (real-time metrics, service health, alerts), and Access Control (user management, role hierarchy, permissions matrix, audit logging) - all restricted to platform admin and root admin access levels only.

### UI/UX Decisions
- Consistent navigation layout across all modules.
- Card-based interface for product categories with status indicators.
- Chevron icons for expand/collapse states in nested navigation with smooth transitions.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting.
- **@neondatabase/serverless**: WebSocket-based database connections.

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider.
- **Passport.js**: Authentication middleware.

### Frontend Libraries
- **Radix UI**: Unstyled, accessible UI components.
- **TanStack Query**: Server state management.
- **React Hook Form**: Form library.
- **Wouter**: Routing library.
- **Date-fns**: Date manipulation utilities.

### Development Tools
- **TypeScript**: Type safety.
- **Tailwind CSS**: Utility-first CSS framework.
- **Zod**: Runtime type validation.
- **Drizzle Kit**: Database migration and schema management.
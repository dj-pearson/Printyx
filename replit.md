# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform for small-to-medium copier dealers, integrating CRM, billing, service dispatch, and inventory into a single solution. It aims to eliminate data silos, reduce manual processes, and provide comprehensive management capabilities. Key features include AI-powered analytics (customer churn, CLV, predictive maintenance), an Advanced Integration Hub, Advanced Workflow Automation, customer success management, remote monitoring with IoT, advanced document management, and a mobile service application. The platform supports essential dealer operations like meter billing, service dispatch, CRM, and unified business records, with existing integrations for E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io. It boasts 100% completion of critical modules, including a robust Lease Management System and comprehensive AI enhancements.

## Recent Changes

### November 3, 2025 - Apollo.io Lead Enrichment Integration Complete
- **Status**: ✅ 100% Complete (Architect Approved: Pass)
- **Scope**: 4 database tables, 23 composite indexes, Apollo API client, unified Lead Enrichment page
- **Features**: 
  - Apollo.io contact search with advanced filters (location, titles, seniority, departments, company size)
  - Platform-wide contact caching to minimize API costs
  - Smart deduplication against existing leads
  - Individual and bulk "Add to CRM" functionality
  - Centralized Lead Enrichment hub at `/data-enrichment` with tabs for Integrations, Contacts, Companies, Campaigns, and Analytics
  - Embedded Apollo.io interface within Integrations tab, extensible for future providers (ZoomInfo, etc.)
- **Security**: Multi-tenant isolation verified, SQL injection protection via Drizzle
- **Architecture**: Smart caching strategy (search cache + centralized contact cache + tenant overlay)
- **UI**: Added "Lead Enrichment" to Sales & CRM sidebar section, replaced direct Apollo.io link

### November 1, 2025 - Priority #11 Complete: Customer Success Automation
- **Status**: ✅ 100% Complete (Architect Approved)
- **Scope**: 5 database tables, 34 composite indexes, 44 storage methods, 42 API endpoints
- **Features**: Customer health scoring with component analysis, ML-based churn prediction, proactive intervention management, customer journey tracking across lifecycle stages, renewal opportunity pipeline management
- **Security**: All storage methods enforce server-side tenant isolation; zero post-fetch filtering vulnerabilities
- **Documentation**: CUSTOMER_SUCCESS_SYSTEM.md

### November 1, 2025 - Priority #10 Complete: Advanced Billing & Meter Processing Engine
- **Status**: ✅ 100% Complete (Architect Approved)
- **Scope**: 6 database tables, 30 composite indexes, 55 storage methods, 48 API endpoints
- **Features**: Usage-based billing rules, automated meter anomaly detection, billing dispute management, invoice generation automation, recurring billing schedules, credit memo system with approval workflows
- **Security**: All storage methods enforce server-side tenant isolation; zero post-fetch filtering vulnerabilities
- **Documentation**: ADVANCED_BILLING_SYSTEM.md

### October 2025 - Priority #9 Complete: Real-Time Service GPS Tracking
- **Status**: ✅ 100% Complete
- **Scope**: 7 database tables, 34 composite indexes, 46 storage methods, 35 API endpoints
- **Features**: Real-time location tracking, route optimization, automated deviation detection, traffic-adjusted ETA calculations, geofencing with entry/exit/dwell triggers
- **Documentation**: GPS_TRACKING_SYSTEM.md

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with CSS variables.
- **Routing**: Wouter.
- **State Management**: TanStack Query.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Consistent navigation, card-based interfaces, mobile-first design, accessibility, and responsive layouts.

### Backend
- **Runtime**: Node.js with Express.js.
- **Type System**: TypeScript.
- **API Design**: RESTful API architecture with tenant-aware endpoints.
- **Authentication**: Replit Auth with OpenID Connect, using Passport.js.
- **Session Management**: PostgreSQL-backed sessions.

### Database
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM.
- **Schema Design**: Multi-tenant architecture with tenant isolation and comprehensive role-based access control (RBAC).
- **Key Entities**: Users, Roles, Tenants, Business Records, Equipment, Contracts, Service Tickets, Inventory, Technicians, Meter Readings, Invoices, Tasks, Projects, Lease Management, E-Signature Integration, Field Service Photo & Signature Capture, GPS Tracking (Technician Locations, Location History, Route Assignments, Route Deviations, ETA Calculations, Geofences, Geofence Events).

### Multi-Tenancy & Role-Based Access Control
- **Tenant Isolation**: Row-level security using `tenantId`.
- **Organizational Structure**: 4-tier structure (Platform, Company, Regional, Location).
- **Role Hierarchy**: 8-level role hierarchy with specific access scopes.
- **Data Segregation**: Multi-layered filtering by tenant, region, location, role, team, and individual assignments.
- **Permission System**: Granular module permissions with location-aware access controls.

### Technical Implementations
- **Unified Business Records System**: Lead-to-customer conversion with zero data loss.
- **Triple-Platform Integration System**: Isolated field mapping for E-Automate, Salesforce, and QuickBooks Online.
- **Unified Data Enrichment System**: Lead prospecting integration with ZoomInfo and Apollo.io.
- **Enhanced RBAC System**: Enterprise-grade RBAC with 4-tier organizational structure, 8-level role hierarchy, nested set models, permission inheritance, and multi-level caching.
- **Multi-Tenant Architecture**: Session-based tenant resolution and comprehensive tenant middleware.
- **Performance Optimization**: Standardized polling, smart cache strategies, pagination, optimistic updates, grouped cache invalidation, and composite indexes.
- **Customer Success Management**: Customer health scoring, equipment usage analytics, NPS, and automated intervention.
- **Remote Monitoring & IoT**: Real-time equipment monitoring, predictive maintenance, and automated alerts.
- **Document Management**: Advanced document lifecycle, OCR, automated workflows, and compliance tracking.
- **Mobile Service App**: For field technicians with GPS, job management, parts tracking, and offline capabilities.
- **Advanced Billing & Meter Processing Engine**: Comprehensive billing automation with 6 database tables (billing_rules, meter_anomalies, billing_disputes, invoice_generation_logs, billing_schedules, credit_memos), 30 composite indexes, 55 storage methods, 48 API endpoints. Features include usage-based billing rules (tiered rates, volume discounts, overage pricing), automated meter anomaly detection (spikes, negative readings, stagnant meters), billing dispute management with resolution workflows, automated invoice generation with batch processing, recurring billing schedules, and credit memo system with approval workflows.
- **Service Dispatch**: Smart technician assignment and work order optimization, enhanced with AI for predictive maintenance and technician matching.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Lease Management System**: Comprehensive system for managing leases, payments, renewals, and dispositions.
- **E-Signature Integration System**: Provider-agnostic platform integration for electronic signatures (DocuSign, Adobe Sign, HelloSign) with full document lifecycle management and audit trails.
- **Field Service Photo & Signature Capture System**: Mobile-first solution for field service documentation with GPS-tagged photo capture, digital signature collection, and installation checklist management.
- **Email Marketing Service Integration**: Platform-level email marketing system for campaign management, engagement tracking, and automated communications, provider-agnostic (e.g., SendGrid).
- **Multi-Factor Authentication (MFA) Enforcement**: Comprehensive two-factor authentication system providing TOTP, backup recovery codes, and audit logging.
- **Workflow Automation System**: Comprehensive platform for creating, managing, and executing automated business workflows with version control, event-based/scheduled triggers, conditional branching, and action types.
- **Lead Scoring & Qualification Engine**: System for automatically scoring and qualifying sales leads based on configurable rules, BANT framework, and engagement tracking.
- **Manufacturer Order Submission System**: Platform for submitting equipment and supply orders directly to manufacturers through automated workflows, supporting 10 major manufacturers.
- **Real-Time Service GPS Tracking**: Comprehensive location monitoring and route management for field service technicians with 7 database tables (technician locations, location history, route assignments, route deviations, ETA calculations, geofences, geofence events), 34 composite indexes, 46 storage methods, 35 API endpoints. Features include real-time location tracking, route optimization, automated deviation detection, traffic-adjusted ETA calculations, and geofencing with entry/exit/dwell triggers.
- **AI-Powered Enhancements**: Across Service Hub, Advanced Billing Engine, Service Dispatch, Product Catalog, Deals Management, Purchase Orders, Quote Builder, Task Management, Quotes Management, Quote & Proposal Generation, and Equipment Lifecycle Management for optimization, recommendations, and predictive analytics.
- **Cross-Module Data Flow Integration**: Automated workflow pipelines and real-time service dispatch automation.
- **Product Accessories System**: Many-to-many relationship architecture for accessory compatibility.
- **Product Models Import Deduplication**: Smart deduplication logic based on product code and name.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting.
- **@neondatabase/serverless**: WebSocket database connections.

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

### Integrations (Business)
- **E-Automate**: Expanded automated syncing.
- **Salesforce**: Real-time lead and opportunity sync.
- **QuickBooks Online**: Enhanced financial data sync.
- **ZoomInfo**: Lead prospecting.
- **Apollo.io**: Lead prospecting.
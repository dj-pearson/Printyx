# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform designed for small-to-medium copier dealers. Its core purpose is to integrate disparate systems such as CRM, billing, service dispatch, and inventory into a single, cohesive solution. This platform aims to eliminate data silos, reduce manual processes, and provide comprehensive management capabilities. Key features include AI-powered analytics for customer churn, CLV, and predictive maintenance, an Advanced Integration Hub, Advanced Workflow Automation, customer success management, remote monitoring with IoT, advanced document management, and a mobile service application. It supports essential dealer operations like meter billing, service dispatch, CRM, and unified business records, with existing integrations for E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io. The platform has achieved 100% completion of critical modules, including a robust Lease Management System, and features comprehensive AI-powered enhancements across all functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **UI**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **Routing**: Wouter.
- **State Management**: TanStack Query for server state and caching.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Consistent navigation, card-based interfaces, chevron icons for expand/collapse, and a mobile-first design philosophy prioritizing accessibility and responsive layouts.

### Backend
- **Runtime**: Node.js with Express.js.
- **Type System**: TypeScript.
- **API Design**: RESTful API architecture with tenant-aware endpoints.
- **Authentication**: Replit Auth with OpenID Connect, using Passport.js.
- **Session Management**: PostgreSQL-backed sessions.

### Database
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM for type-safe operations and migrations.
- **Schema Design**: Multi-tenant architecture with tenant isolation and comprehensive role-based access control (RBAC).
- **Key Entities**: Users, Roles, Tenants, Business Records, Equipment, Contracts, Service Tickets, Inventory, Technicians, Meter Readings, Invoices, Tasks, Projects, Lease Management (leases, payments, renewals, dispositions), E-Signature Integration (integration credentials, signature requests, signature signers, signature documents, signature audit logs).

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
- **Enhanced RBAC System**: Enterprise-grade RBAC with a 4-tier organizational structure, 8-level role hierarchy, nested set models, permission inheritance, and multi-level caching.
- **Multi-Tenant Architecture**: Session-based tenant resolution and comprehensive tenant middleware.
- **Performance Optimization**: Standardized polling, smart cache strategies, pagination, optimistic updates, grouped cache invalidation, and composite indexes.
- **Customer Success Management**: Customer health scoring, equipment usage analytics, NPS, and automated intervention.
- **Remote Monitoring & IoT**: Real-time equipment monitoring, predictive maintenance, and automated alerts.
- **Document Management**: Advanced document lifecycle, OCR, automated workflows, and compliance tracking.
- **Mobile Service App**: For field technicians with GPS, job management, parts tracking, and offline capabilities.
- **Meter Billing System**: Automated invoice generation and tiered billing.
- **Service Dispatch**: Smart technician assignment and work order optimization, enhanced with AI for predictive maintenance and technician matching.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Lease Management System**: Comprehensive system for managing leases, payments, renewals, and dispositions with automated scheduling, payment health tracking, and integration points.
- **E-Signature Integration System**: Provider-agnostic platform integration for electronic signatures supporting DocuSign, Adobe Sign, and HelloSign. Complete backend infrastructure (5 database tables, 27 storage methods, 30+ API endpoints) enabling dealers to configure their own e-signature provider credentials. Supports full document lifecycle: create/send signature requests, track multiple signers, manage sequential/parallel workflows, automated reminders, webhook handling, and comprehensive audit trails for compliance (ESIGN Act, UETA). Integration credentials management with health monitoring, OAuth token refresh, and sandbox/production modes.
- **AI-Powered Enhancements**: Across Service Hub, Advanced Billing Engine, Service Dispatch, Product Catalog, Deals Management, Purchase Orders, Quote Builder, Task Management, Quotes Management, Quote & Proposal Generation, and Equipment Lifecycle Management for optimization, recommendations, and predictive analytics.
- **Cross-Module Data Flow Integration**: Automated workflow pipelines and real-time service dispatch automation.
- **Product Accessories System**: Many-to-many relationship architecture for accessory compatibility, manufacturer-based filtering, and enhanced data structure.
- **Product Models Import Deduplication**: Smart deduplication logic based on product code and name, with validation for required accessories.

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
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
- **Key Entities**: Users, Roles, Tenants, Business Records, Equipment, Contracts, Service Tickets, Inventory, Technicians, Meter Readings, Invoices, Tasks, Projects, Lease Management (leases, payments, renewals, dispositions), E-Signature Integration (integration credentials, signature requests, signature signers, signature documents, signature audit logs), Field Service Photo & Signature Capture (installations, service signatures, installation checklists, service photos).

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
- **Field Service Photo & Signature Capture System**: Comprehensive mobile-first solution for field service documentation with GPS-tagged photo capture, digital signature collection, and installation checklist management. Complete backend infrastructure (4 database tables: installations, service_signatures, installation_checklists, service_photos; 18 storage methods; 17 API endpoints) enabling quality assurance through structured checklists, photo requirements, and customer signatures. Features include installation tracking from scheduling to completion, multi-method signature capture (touchscreen, stylus, finger), comprehensive audit trails with GPS/device/timestamp tracking, photo categorization (before, during, after, completed), and bulk checklist operations. Integration with object storage for photo/signature management.
- **Email Marketing Service Integration**: Platform-level email marketing system enabling dealers to manage campaigns, track engagement, and automate customer communications. Complete backend infrastructure (7 database tables: email_templates, email_campaigns, email_sends, email_events, email_lists, email_list_members, email_unsubscribes; 28 storage methods; 30+ API endpoints) supporting template management with variable substitution, campaign creation (one-time, drip, recurring, A/B test), list segmentation (static/dynamic), comprehensive event tracking (delivered, open, click, bounce, spam, unsubscribe), engagement scoring, and real-time webhook processing. Provider-agnostic architecture where dealers configure their own SendGrid API credentials through integrationCredentials management system. Features include email builder with merge tags, automated drip sequences, recurring campaigns, engagement analytics with calculated metrics (delivery rate, open rate, click rate), unsubscribe management (global/campaign/list), and CAN-SPAM/GDPR compliance support.
- **Multi-Factor Authentication (MFA) Enforcement**: Comprehensive two-factor authentication system providing TOTP (Time-based One-Time Passwords) authentication, backup recovery codes, audit logging, and compliance tracking. Complete backend infrastructure (2 database tables: mfa_backup_codes, mfa_audit_logs; users table extended with two_factor_enabled and two_factor_secret; 12 storage methods; 14 API endpoints) enabling secure account protection through industry-standard TOTP implementation using Node.js crypto module. Features include QR code enrollment for authenticator apps (Google Authenticator, Authy, Microsoft Authenticator), bcrypt-hashed backup codes (10 per user), comprehensive audit trail with IP/device tracking, admin reset capabilities, and tenant-level compliance reporting. Supports ±30 second time window tolerance for clock drift, one-time use backup codes, event tracking (enrollment, verification success/failure, backup code usage, admin reset, disabled), and compliance metrics (MFA adoption rate, recent enrollments, recent failures).
- **Workflow Automation System**: Comprehensive platform for creating, managing, and executing automated business workflows. Complete backend infrastructure (13 database tables: workflows, workflow_versions, workflow_triggers, trigger_schedules, workflow_conditions, workflow_steps_automation, workflow_step_transitions, workflow_executions, workflow_execution_steps, workflow_execution_events, workflow_templates, template_variables, workflow_event_registry; 35+ storage methods; 25+ API endpoints) enabling dealers to automate repetitive tasks across customer management, service operations, financial processes, and sales activities. Features include immutable version control, event-based and scheduled triggers (cron), conditional branching with JSON-logic DSL, comprehensive action types (email, SMS, task creation, CRM updates, database operations, integration calls), retry logic with exponential backoff, complete audit trails, and execution analytics. Pre-built templates include Customer Onboarding Automation (3 hours saved per customer), Equipment Maintenance Alert Workflow (2 hours per cycle), Invoice Processing Automation (4 hours per billing cycle), and Quote Follow-up Automation (1.5 hours per quote). Business event registry with 8 pre-configured events (customer_created, ticket_created, maintenance_due, invoice_generated, quote_approved, lease_renewal_pending, meter_anomaly_detected, customer_updated). Supports manual and automated execution, workflow cloning from templates, execution monitoring with real-time status tracking, and tenant-level dashboard analytics. Execution engine and event bus system deferred for future enhancement.
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
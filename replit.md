# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform designed to consolidate fragmented technology stacks for small-to-medium copier dealers. It replaces disconnected legacy systems (CRM, billing, service dispatch, inventory) with a single, integrated solution, aiming to eliminate data silos, reduce manual processes, and provide comprehensive management for all aspects of a copier dealership.

The platform includes AI-powered analytics (customer churn, CLV, predictive maintenance), an Advanced Integration Hub, and Advanced Workflow Automation. Printyx also offers comprehensive customer success management, remote monitoring with IoT integration, advanced document management, and a mobile service app for field technicians. It provides meter billing, service dispatch, CRM, a unified business records system, and integrates with E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io.

### Recent LEAN End-to-End Implementation (August 2025)
Comprehensive implementation of LEAN End-to-End Playbook requirements including service lifecycle management, warehouse FPY tracking, auto-invoice generation, and Definition of Done (DoD) enforcement for stage transitions. Added complete reporting infrastructure with service SLA metrics, purchase order variance tracking, and billing analytics.

### Database Performance Optimization (August 2025)
Implemented comprehensive composite indexes across all high-volume tables to optimize query performance:

**business_records table (leads/customers):**
- Tenant-based composite indexes for general queries (tenant_id, created_at, status)
- ID-based lookups within tenant context for single record access
- Record type filtering for leads vs customers distinction
- Search functionality optimization for company name lookups
- Owner/assignment based queries for user-specific data access
- Sales pipeline queries for deal value and probability analysis
- Lead source analytics for marketing attribution
- Activity tracking indexes for follow-up and contact management

**Additional tables optimized:**
- invoices: tenant-customer billing, status tracking, due date management
- service_tickets: customer service dispatch, technician assignments, priority scheduling
- quotes: sales pipeline and proposal management
- contracts: customer relationship management
- equipment: asset tracking and service management
- deals: sales pipeline with stage and probability optimization

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

### Backend
- **Runtime**: Node.js with Express.js.
- **Type System**: TypeScript.
- **API Design**: RESTful API architecture with tenant-aware endpoints.
- **Authentication**: Replit Auth with OpenID Connect.
- **Session Management**: PostgreSQL-backed sessions.

### Database
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM for type-safe operations and migrations.
- **Schema Design**: Multi-tenant architecture with tenant isolation and comprehensive role-based access control (RBAC).
- **Key Entities**: Users, Roles, Tenants, Business Records (leads/customers), Equipment, Contracts, Service Tickets, Inventory, Technicians, Meter Readings, Invoices, Tasks, Projects, Service Call Analysis, Parts Orders, Warehouse Operations, Onboarding Checklists, Installation Management.

### Multi-Tenancy & Multi-Location Role-Based Access Control
- **Tenant Isolation**: Row-level security with `tenantId` filtering.
- **Organizational Structure**: 4-tier structure (Platform, Company, Regional, Location) supporting comprehensive access control.
- **Role Hierarchy**: 8-level role hierarchy with specific access scopes (platform, company, regional, location).
- **Data Segregation**: Multi-layered filtering by tenant, region, location, role, team, and individual assignments.
- **Permission System**: Granular module permissions with location-aware access controls.

### Technical Implementations
- **Unified Business Records System**: Zero-data-loss lead-to-customer conversion (new → contacted → qualified → active → inactive).
- **Triple-Platform Integration System**: E-Automate, Salesforce, and QuickBooks Online integration with isolated field mapping architecture.
- **Unified Data Enrichment System**: Lead prospecting with ZoomInfo and Apollo.io integration.
- **Root Admin Security Suite**: Comprehensive security platform including Social Media Generation, Security Management, System Monitoring, and Access Control, restricted to platform and root admins.
- **Enhanced RBAC System**: Enterprise-grade Role-Based Access Control with 4-tier organizational structure and 8-level role hierarchy, including nested set models for efficient hierarchy queries, permission inheritance, customizable roles, and multi-level caching.
- **Multi-Tenant Architecture**: Session-based tenant resolution and comprehensive tenant middleware.
- **Performance Optimization**: Standardized polling, smart cache strategies, pagination, optimistic updates, and grouped cache invalidation.
- **Customer Success Management**: Customer health scoring, equipment usage analytics, NPS scoring, and automated intervention workflows.
- **Remote Monitoring & IoT**: Real-time equipment monitoring, predictive maintenance, fleet dashboards, and automated alerts.
- **Document Management**: Advanced document lifecycle, OCR processing, automated workflows, and compliance tracking.
- **Mobile Service App**: For field technicians with GPS, job management, parts tracking, and offline capabilities.
- **Meter Billing System**: Automated invoice generation and tiered billing.
- **Service Dispatch**: Smart technician assignment and work order optimization.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Proposal Builder**: Quote-to-proposal conversion system with professional templates and branding integration.
- **Comprehensive Onboarding System**: Multi-step customer onboarding and equipment installation management.
- **Product Management System**: Seven-category product catalog.
- **Task Management System**: Personal and multi-step project tracking.
- **Equipment Lifecycle Management**: Purchase orders, warehouse, delivery, installation, and asset tracking.
- **CSV Import System**: Bulk import with tenant data segmentation and validation.
- **Advanced Reporting & Analytics**: Business intelligence dashboards.
- **Workflow Automation System**: Trigger-based actions and template creation.
- **System Integrations Dashboard**: Management for third-party integrations.
- **Legal Compliance Framework**: Integrated EULA, Privacy Policy, and Terms & Conditions.
- **Sidebar Consolidation**: All navigation is handled by `role-based-sidebar.tsx`.

### UI/UX Decisions
- Consistent navigation layout.
- Card-based interface for product categories.
- Chevron icons for expand/collapse states in nested navigation.
- **Mobile-First Design Philosophy**: All components prioritize mobile experience with progressive enhancement, adhering to accessibility standards (e.g., 44x44px touch targets, 16px minimum font size for inputs), responsive grid layouts, and safe area support.

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
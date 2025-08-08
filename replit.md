# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform designed to consolidate fragmented technology stacks for small-to-medium copier dealers. It replaces disconnected legacy systems (CRM, billing, service dispatch, inventory) with a single, integrated solution, aiming to eliminate data silos, reduce manual processes, and provide comprehensive management for all aspects of a copier dealership.

The platform includes AI-powered analytics (customer churn, CLV, predictive maintenance), an Advanced Integration Hub, and Advanced Workflow Automation. Printyx also offers comprehensive customer success management, remote monitoring with IoT integration, advanced document management, and a mobile service app for field technicians. It provides meter billing, service dispatch, CRM, a unified business records system, and integrates with E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **Comprehensive Pipeline Forecasting Enhancement (Aug 8, 2025)**: Enhanced sales forecasting system to integrate deals, quotes, proposals, forecasts, and CRM goals into a unified pipeline view. Added new `/api/pipeline-forecast` endpoint that pulls data from multiple sources with time-based filtering (monthly, quarterly, yearly). Features weighted pipeline calculations, goal progress tracking, breakdown by pipeline type (deals, quotes, proposals), and remaining targets analysis. Includes new PipelineForecast.tsx component with comprehensive dashboard showing active pipeline amounts vs forecast goals, CRM goal integration, and detailed pipeline item listings with probability weighting.
- **Sales Forecasting System (Aug 8, 2025)**: Implemented comprehensive sales forecasting functionality with real database integration. Added 4 new tables (`sales_forecasts`, `forecast_pipeline_items`, `forecast_metrics`, `forecast_rules`) with 37, 37, 25, and 18 columns respectively. Features tenant-based filtering, forecasting analytics, pipeline opportunity management, performance tracking, and rule-based automation. All API endpoints fully functional with proper authentication and JSON responses. Database schema documentation updated to reflect current 148 table structure.
- **Enhanced RBAC System (Aug 7, 2025)**: Implemented enterprise-grade Role-Based Access Control system based on RBAC.md research. Features 4-tier organizational structure (Platform/Company/Regional/Location) with 8-level role hierarchy, 6 new database tables with nested set models for efficient queries, granular permission system with 35+ business-specific permissions, customizable roles for company admins, permission overrides for exceptions, and multi-level caching for performance. Supports both small single-location dealers ($500K) and large multi-location enterprises ($300M) with specialized role templates.
- **Comprehensive Onboarding System (Aug 7, 2025)**: Built complete customer onboarding and equipment installation management system with 6 dedicated database tables (`onboarding_checklists`, `onboarding_dynamic_sections`, `onboarding_equipment`, `onboarding_tasks`, `onboarding_network_config`, `onboarding_print_management`). Features 9-step multi-workflow for equipment deployment including customer info, site details, scheduling, equipment tracking, network configuration, print management, security setup, and dynamic custom sections. Includes progress tracking, PDF generation, technician assignment, and comprehensive task management.
- **Database Schema Alignment (Aug 7, 2025)**: Fixed critical schema inconsistencies by adding missing columns to onboarding_checklists table and aligned database structure with schema definitions. All onboarding API endpoints now properly authenticated and functional.

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
- **Unified Business Records System**: Zero-data-loss lead-to-customer conversion (new → contacted → qualified → active → inactive) with HubSpot-style interface.
- **Triple-Platform Integration System**: E-Automate, Salesforce, and QuickBooks Online integration with isolated field mapping architecture.
- **Unified Data Enrichment System**: Lead prospecting with ZoomInfo and Apollo.io integration.
- **Root Admin Security Suite**: Comprehensive security platform including Social Media Generation, Security Management, System Monitoring, and Access Control, restricted to platform and root admins.
- **Enhanced RBAC System**: Enterprise-grade Role-Based Access Control with 4-tier organizational structure (Platform/Company/Regional/Location) and 8-level role hierarchy. Includes nested set models for efficient hierarchy queries, permission inheritance, customizable roles for company admins, and multi-level caching for performance.
- **Multi-Tenant Architecture**: Replaced hardcoded tenant IDs with session-based tenant resolution and comprehensive tenant middleware.
- **Performance Optimization**: Standardized polling, smart cache strategies, pagination, optimistic updates, and grouped cache invalidation.
- **Form Validation**: Unified validation library with comprehensive schemas.
- **Customer Success Management**: Customer health scoring, equipment usage analytics, NPS scoring, and automated intervention workflows.
- **Remote Monitoring & IoT**: Real-time equipment monitoring, predictive maintenance, fleet dashboards, and automated alerts.
- **Document Management**: Advanced document lifecycle, OCR processing, automated workflows, and compliance tracking.
- **Mobile Service App**: For field technicians with GPS, job management, parts tracking, and offline capabilities.
- **Meter Billing System**: Automated invoice generation and tiered billing.
- **Service Dispatch**: Smart technician assignment and work order optimization.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Proposal Builder**: Quote-to-proposal conversion system with professional templates, customizable sections, and company branding integration.
- **Comprehensive Onboarding System**: Multi-step customer onboarding and equipment installation management.
- **Product Management System**: Seven-category product catalog.
- **Task Management System**: Personal and multi-step project tracking.
- **Equipment Lifecycle Management**: Purchase orders, warehouse, delivery, installation, and asset tracking.
- **CSV Import System**: Bulk import with tenant data segmentation and validation.
- **Advanced Reporting & Analytics**: Business intelligence dashboards.
- **Workflow Automation System**: Trigger-based actions and template creation.
- **System Integrations Dashboard**: Management for third-party integrations.
- **Legal Compliance Framework**: Integrated EULA, Privacy Policy, and Terms & Conditions.
- **Sidebar Consolidation**: The application uses ONLY `role-based-sidebar.tsx` for all navigation. All navigation modifications must be done in `role-based-sidebar.tsx`.

### UI/UX Decisions
- Consistent navigation layout.
- Card-based interface for product categories.
- Chevron icons for expand/collapse states in nested navigation.
- **Mobile-First Design Philosophy**: All components prioritize mobile experience with progressive enhancement for larger screens, adhering to 44x44px touch targets, 16px minimum font size for inputs to prevent iOS zoom, responsive grid layouts, and safe area support.

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
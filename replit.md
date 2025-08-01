# Unified Copier Dealer Management Platform - Printyx

## Overview

Printyx is a unified SaaS platform designed to consolidate the fragmented technology stacks of small-to-medium copier dealers (5-200 employees). The platform addresses a $39.3 billion market with 4,762 dealers who currently struggle with disconnected systems for CRM, billing, service dispatch, and inventory management. The application replaces multiple legacy systems like e-automate ERP, AgentDealer CRM, and Printanista toner monitoring with a single, integrated solution that eliminates data silos and reduces manual processes.

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Status & Development Phases

### Current Phase: Phase 2 - Role-Based Access Control Implementation (Week 3-4)
**Priority Focus**: Implementing comprehensive role-based access control with hierarchical team structures

### Phase Progress
- **Phase 1 Complete**: Foundation architecture, basic CRUD operations, multi-tenant setup
- **Phase 2 Major Features Complete**: 
  - ✅ Meter billing system with automated invoice generation
  - ✅ Enhanced service dispatch with smart technician assignment and scheduling
  - ✅ CRM improvements with lead pipeline and quote management
  - ✅ Consistent navigation layout across all modules
  - ✅ Complete seven-category product management system
  - ✅ CSV import system with tenant data segmentation
  - 🔄 **IN PROGRESS**: Role-based access control with hierarchical permissions
- **Phase 2 Current Work**: RBAC implementation with department-specific navigation
- **Phase 3 Planned**: Mobile app, advanced reporting, workflow automation
- **Phase 4 Planned**: Third-party integrations, go-live preparation
- **Current Enhancement**: Comprehensive task management system with personal and project workflows

### Recent Architectural Changes (January 2025)
- **Phase 4 Third-Party Integrations Complete**: System integrations and deployment readiness features successfully implemented (January 1, 2025)
- **System Integrations Dashboard**: Comprehensive third-party integration management with device manufacturer APIs (Xerox, Canon, HP), accounting systems (QuickBooks), and CRM platforms (Salesforce)
- **Deployment Readiness System**: Complete go-live preparation monitoring with infrastructure, security, testing, documentation, and business readiness tracking
- **Integration API Infrastructure**: Full API endpoints for managing integrations, webhooks, deployment checks, and system readiness metrics
- **Phase 3 Advanced Features Complete**: All Phase 3 optimization and mobile features successfully implemented (January 1, 2025)
- **Mobile Optimization System**: Comprehensive mobile app performance monitoring with device analytics, battery optimization tracking, and GPS integration status monitoring
- **Performance Monitoring Dashboard**: Real-time system health monitoring with CPU, memory, disk usage tracking, API endpoint performance analysis, and automated alerting system
- **Enhanced Backend API Infrastructure**: Complete API endpoints for workflow automation and advanced reporting with comprehensive data analytics
- **Phase 2 Major Features Complete**: All core Phase 2 PRD requirements successfully implemented
- **Advanced Reporting & Analytics**: Comprehensive business intelligence system with revenue analytics, customer profitability analysis, service performance metrics, and interactive dashboards with date filtering (January 1, 2025)
- **Workflow Automation System**: Complete automated workflow rule engine with trigger-based actions, template-based rule creation, and business process automation (January 1, 2025)
- **Enhanced Role-Based Access Control**: Department-based navigation with granular permission system across Sales, Service, Finance, Admin, and Reports modules
- **Meter Billing System Complete**: Automated invoice generation with contract-based calculations, tiered billing rates, and profitability analysis
- **Service Dispatch Enhancement**: Smart technician assignment with skills-based routing, work order optimization, and mobile-responsive interface
- **CRM System Complete**: Full lead pipeline management, quote generation, customer interaction tracking, and equipment management
- **Marketing Homepage**: Professional SaaS landing page with comprehensive Features, Pricing ($99/$199/$399), Tools, and Resources sections
- **Authentication System**: Fully functional login system with bcrypt, PostgreSQL session management, and 7 demo accounts for RBAC testing
- **Complete Product Management System**: Implemented comprehensive seven-category product catalog system (January 1, 2025)
  - Product Models (copier equipment with CPC rates and manufacturer specifications)
  - Product Accessories (hardware add-ons with model compatibility)
  - Professional Services (consulting, installation, training services)
  - Service Products (ongoing service offerings with subscription models)
  - Software Products (digital solutions with licensing structures)
  - Supplies (consumables, toner, paper, maintenance kits with inventory tracking)
  - IT & Managed Services (network management, cloud services, security, and IT support offerings)
- **Task Management System**: Comprehensive task and project management capabilities (January 1, 2025)
  - Personal task tracking with priority, status, and assignment management
  - Multi-step project management with progress tracking and resource allocation
  - Project templates for common workflows (equipment installation, service campaigns)
  - Time tracking and task commenting for collaboration
  - Integration with customer and contract data for project context
  - Dashboard analytics showing task completion metrics and performance insights
- **CSV Import System**: Comprehensive bulk import system with tenant data segmentation
  - Example CSV templates for all seven product categories with proper field mapping
  - Secure file upload with 10MB limit and CSV validation
  - Tenant-isolated data processing ensuring complete company data segregation
  - Import progress tracking with detailed error reporting and success metrics
  - Field validation and data transformation for seamless catalog migration

### Reference Documents
- **PRD.md**: Complete Product Requirements Document with market analysis and technical specifications
- **DEVELOPMENT_PROGRESS.md**: Detailed development progress tracker with task status and metrics

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Forms**: React Hook Form with Zod validation schemas for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Type System**: TypeScript throughout the entire application stack
- **API Design**: RESTful API architecture with tenant-aware endpoints
- **Authentication**: Replit Auth integration with OpenID Connect for secure user authentication
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple

### Database Layer
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Schema Design**: Multi-tenant architecture with tenant isolation and role-based access control
- **RBAC Implementation**: Comprehensive role hierarchy with department-based permissions
- **Key Entities**: 
  - **Identity**: Users, Roles, Teams, UserCustomerAssignments
  - **Business**: Tenants, Customers, Equipment, Contracts, Service Tickets
  - **CRM**: Leads, LeadInteractions, Quotes, QuoteLineItems
  - **Operations**: Inventory Items, Technicians, Meter Readings, Invoices
  - **Task Management**: Tasks, Projects, TaskComments, TimeEntries, ProjectTemplates

### Multi-Tenancy & Role-Based Access Control
- **Tenant Isolation**: Row-level security with tenantId filtering across all business entities
- **Role Hierarchy**: 5-level system (Individual → Team Lead → Manager → Director → Admin)
- **Department Segmentation**: Sales, Service, Finance, Purchasing, Administration modules
- **Hierarchical Teams**: Nested team structures with manager relationships and territory assignments
- **Permission System**: Granular module permissions with department-specific access controls
- **Data Segregation**: Multi-layered filtering by tenant, role, team, and individual assignments

### Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect for seamless integration
- **Session Storage**: PostgreSQL-backed sessions for scalability and persistence
- **Authorization**: Middleware-based authentication checks on all protected routes
- **User Context**: Automatic tenant resolution from authenticated user sessions

### API Structure
- **Authentication Routes**: `/api/auth/*` for user authentication and session management
- **Dashboard Routes**: `/api/dashboard/*` for metrics, recent tickets, and top customers
- **Entity Routes**: RESTful endpoints for customers, contracts, service tickets, inventory, technicians, tasks, and projects
- **Tenant-Aware**: All business logic routes automatically scope data by tenant

### Development & Deployment
- **Build System**: Vite for frontend bundling with ESBuild for server compilation
- **Development**: Hot module replacement with Vite dev server integration
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Environment**: Replit-optimized with cartographer plugin for development debugging

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting with connection pooling
- **@neondatabase/serverless**: WebSocket-based database connections for serverless environments

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider
- **Passport.js**: Authentication middleware with OpenID Connect strategy

### Frontend Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI components
- **TanStack Query**: Server state management with caching and background updates
- **React Hook Form**: Performance-focused form library with minimal re-renders
- **Wouter**: Minimalist routing library for React applications
- **Date-fns**: Date manipulation and formatting utilities

### Development Tools
- **TypeScript**: Type safety across frontend, backend, and shared schemas
- **Tailwind CSS**: Utility-first CSS framework with design system integration
- **Zod**: Runtime type validation and schema generation
- **Drizzle Kit**: Database migration and schema management tools
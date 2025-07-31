# Unified Copier Dealer Management Platform - Printyx

## Overview

Printyx is a unified SaaS platform designed to consolidate the fragmented technology stacks of small-to-medium copier dealers (5-200 employees). The platform addresses a $39.3 billion market with 4,762 dealers who currently struggle with disconnected systems for CRM, billing, service dispatch, and inventory management. The application replaces multiple legacy systems like e-automate ERP, AgentDealer CRM, and Printanista toner monitoring with a single, integrated solution that eliminates data silos and reduces manual processes.

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Status & Development Phases

### Current Phase: Phase 2 - Core Functionality Enhancement (Week 3-4)
**Priority Focus**: Meter billing system implementation (highest ROI feature)

### Phase Progress
- **Phase 1 Complete**: Foundation architecture, basic CRUD operations, multi-tenant setup
- **Phase 2 In Progress**: Meter billing, enhanced service dispatch, CRM improvements
- **Phase 3 Planned**: Mobile app, advanced reporting, workflow automation
- **Phase 4 Planned**: Third-party integrations, go-live preparation

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
- **Schema Design**: Multi-tenant architecture with tenant isolation at the data level
- **Key Entities**: Users, Tenants, Customers, Equipment, Contracts, Service Tickets, Inventory Items, Technicians

### Multi-Tenancy Implementation
- **Tenant Isolation**: Row-level security with tenantId filtering across all business entities
- **User Management**: Users are scoped to specific tenants with role-based access control
- **Data Segregation**: All queries automatically filter by tenant context to ensure data isolation

### Authentication & Authorization
- **Provider**: Replit Auth with OpenID Connect for seamless integration
- **Session Storage**: PostgreSQL-backed sessions for scalability and persistence
- **Authorization**: Middleware-based authentication checks on all protected routes
- **User Context**: Automatic tenant resolution from authenticated user sessions

### API Structure
- **Authentication Routes**: `/api/auth/*` for user authentication and session management
- **Dashboard Routes**: `/api/dashboard/*` for metrics, recent tickets, and top customers
- **Entity Routes**: RESTful endpoints for customers, contracts, service tickets, inventory, and technicians
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
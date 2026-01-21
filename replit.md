# Printyx - Unified Copier Dealer Management Platform

## Overview

Printyx is a unified SaaS platform designed for small-to-medium copier dealers, integrating CRM, billing, service dispatch, and inventory into a single solution. Its primary goal is to eliminate data silos, reduce manual processes, and provide comprehensive management capabilities. Key features include AI-powered analytics (customer churn, CLV, predictive maintenance), an Advanced Integration Hub, Advanced Workflow Automation, customer success management, remote monitoring with IoT, advanced document management, and a mobile service application. The platform supports essential dealer operations such as meter billing, service dispatch, CRM, and unified business records, with existing integrations for E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io. The platform also includes a robust Lease Management System and comprehensive AI enhancements.

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
- **Advanced Billing & Meter Processing Engine**: Comprehensive billing automation including usage-based billing rules, automated meter anomaly detection, billing dispute management, invoice generation automation, recurring billing schedules, and credit memo system with approval workflows.
- **Service Dispatch**: Smart technician assignment and work order optimization, enhanced with AI for predictive maintenance and technician matching.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Lease Management System**: Comprehensive system for managing leases, payments, renewals, and dispositions.
- **E-Signature Integration System**: Provider-agnostic platform integration for electronic signatures with full document lifecycle management and audit trails.
- **Field Service Photo & Signature Capture System**: Mobile-first solution for field service documentation with GPS-tagged photo capture, digital signature collection, and installation checklist management.
- **Email Marketing Service Integration**: Platform-level email marketing system for campaign management, engagement tracking, and automated communications.
- **Multi-Factor Authentication (MFA) Enforcement**: Comprehensive two-factor authentication system providing TOTP, backup recovery codes, and audit logging.
- **Workflow Automation System**: Comprehensive platform for creating, managing, and executing automated business workflows with version control, event-based/scheduled triggers, conditional branching, and action types.
- **Lead Scoring & Qualification Engine**: System for automatically scoring and qualifying sales leads based on configurable rules, BANT framework, and engagement tracking.
- **Manufacturer Order Submission System**: Platform for submitting equipment and supply orders directly to manufacturers through automated workflows.
- **Real-Time Service GPS Tracking**: Comprehensive location monitoring and route management for field service technicians, including real-time tracking, route optimization, automated deviation detection, traffic-adjusted ETA calculations, and geofencing.
- **AI-Powered Enhancements**: Applied across Service Hub, Advanced Billing Engine, Service Dispatch, Product Catalog, Deals Management, Purchase Orders, Quote Builder, Task Management, Quotes Management, Quote & Proposal Generation, and Equipment Lifecycle Management for optimization, recommendations, and predictive analytics.
- **Cross-Module Data Flow Integration**: Automated workflow pipelines and real-time service dispatch automation.
- **Product Accessories System**: Many-to-many relationship architecture for accessory compatibility.
- **Product Models Import Deduplication**: Smart deduplication logic based on product code and name.
- **AI-Powered Knowledge Base System**: Comprehensive knowledge management platform with article creation, version control, semantic search capabilities, category organization, feedback collection, and analytics tracking. Features 8-table architecture (categories, articles, versions, views, feedback, AI generation queue, embeddings, search queries) with multi-tenant support and RBAC integration.
- **Subscription Management System**: Comprehensive SaaS pricing system with 3-tier pricing (Starter, Professional, Enterprise), 52 features across 8 categories, trial management, usage tracking, billing automation, and add-on support.

## Subscription Pricing & Features

### Pricing Tiers (Per User/Month)

- **Starter Plan**: $79/month ($758/year with 20% discount)
  - Target: 5-20 employees
  - Contracts: Up to 50
  - Locations: Up to 3
  - Storage: 100GB
  - API Calls: 10,000/month
  - Core Features: Lead management, customer management, service tickets, technician dispatch, equipment tracking, basic inventory, invoice generation, basic reports, email integration, team collaboration, role-based access, email support

- **Professional Plan**: $99/month ($950/year with 20% discount)
  - Target: 20-100 employees
  - Contracts: Unlimited
  - Locations: Up to 10
  - Storage: 100GB
  - API Calls: 50,000/month
  - Additional Features: All Starter features + Mobile service app, GPS tracking, mobile photo capture, digital signatures, preventive maintenance, purchase orders, multi-warehouse, meter billing, contract management, payment processing, recurring billing, advanced analytics, custom dashboards, QuickBooks/Salesforce/E-Automate integrations, API access, shared calendars, audit logs, priority support, phone support

- **Enterprise Plan**: $149/month ($1,430/year with 20% discount)
  - Target: 100+ employees
  - Everything: Unlimited
  - Additional Features: All Professional features + White label options, custom integrations, advanced forecasting, SLA guarantee (99.9% uptime), SSO integration, IP whitelisting, dedicated account manager, onboarding assistance, barcode scanning, predictive maintenance, webhook support

### Feature Categories

1. **CRM**: Lead management, customer management, deal pipeline, contact management, activity tracking
2. **Service**: Service tickets, technician dispatch, equipment tracking, service history, preventive maintenance, predictive maintenance, mobile service app, GPS tracking, mobile photo capture, digital signatures
3. **Inventory**: Parts inventory, stock levels, purchase orders, multi-warehouse, barcode scanning
4. **Billing**: Invoice generation, meter billing, contract management, payment processing, recurring billing
5. **Analytics**: Basic reports, advanced analytics, custom dashboards, advanced forecasting, data export
6. **Integrations**: Email integration, QuickBooks/Salesforce/E-Automate integrations, API access, webhook support, custom integrations
7. **Platform**: Team collaboration, document storage, shared calendars, white label options
8. **Security**: Role-based access, data encryption, audit logs, SSO integration, IP whitelisting
9. **Support**: Email support, priority support, phone support, dedicated account manager, onboarding assistance, SLA guarantee

### Add-Ons

**One-Time Add-Ons:**

- Professional Implementation: $3,000 (4-6 weeks, includes project manager, custom configuration, data migration, training)
- Data Migration Service: $2,000 (2-4 weeks, includes data extraction, cleansing, validation, mapping)
- Advanced Training Package: $1,500 (1-2 weeks, includes admin and end-user training for up to 25 participants)
- Custom Integration Development: $5,000 (6-8 weeks, includes custom API integration and 90-day support)

**Recurring Add-Ons:**

- Additional API Calls: $0.001/call (billed monthly, minimum 1,000 calls)
- Additional Storage (100GB): $50/month
- Premium Support Package: $500/month (24/7 support, 1-hour response time, priority bug fixes)
- Additional Locations (5-pack): $100/month
- Additional Users (10-pack): $200/month

### Trial Management

- All plans: 30-day free trial
- Starter & Professional: No payment method required
- Enterprise: Payment method required upfront
- Trial includes full feature access

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

- **E-Automate**: Automated syncing.
- **Salesforce**: Real-time lead and opportunity sync.
- **QuickBooks Online**: Enhanced financial data sync.
- **ZoomInfo**: Lead prospecting.
- **Apollo.io**: Lead prospecting.

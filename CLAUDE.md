# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Production build (Vite + esbuild for server)
- `npm start` - Start production server
- `npm run check` - TypeScript type checking

### Code Quality
- `npm run lint` - ESLint with TypeScript
- `npm run format` - Check Prettier formatting
- `npm run format:write` - Apply Prettier formatting

### Database Operations
- `npm run db:push` - Push schema changes to main database
- `npm run db:push:forecast` - Push to forecasting database

### Testing
- `npm run test:e2e` - Run Playwright end-to-end tests

## Project Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite, Wouter routing, TanStack Query for state
- **Backend**: Express.js + TypeScript, RESTful API with tenant-aware endpoints
- **Database**: PostgreSQL (Neon) + Drizzle ORM, multi-tenant with RLS
- **UI**: Radix UI + Tailwind CSS + shadcn/ui components
- **Auth**: Replit Auth with OpenID Connect, PostgreSQL sessions

### Directory Structure
```
client/src/           # React frontend
  components/         # Reusable UI components
  pages/             # Route components
  hooks/             # Custom React hooks
  lib/               # Utilities and configurations
server/              # Express.js backend
  routes*.ts         # API route handlers
  middleware/        # Express middleware
  services/          # Business logic services
  integrations/      # Third-party integrations
shared/              # Shared TypeScript schemas
testing/             # Puppeteer test suite
```

### Multi-Tenant Architecture
- 4-tier organizational structure: Platform → Company → Regional → Location
- Row-level security with `tenantId` filtering on all queries
- 8-level role hierarchy with granular permissions
- Session-based tenant resolution via middleware

### Key Architectural Patterns
- **Unified Business Records**: Zero-data-loss lead-to-customer conversion system
- **Multi-platform Integration**: E-Automate, Salesforce, QuickBooks with isolated field mapping
- **Mobile-First Design**: All components prioritize mobile experience with progressive enhancement
- **Role-Based Access Control**: Enterprise-grade RBAC with inheritance and caching

### Schema Organization
- Main schema: `shared/schema.ts` (core business entities)
- Specialized schemas: Equipment, service analysis, tasks, security, etc.
- Database configs: `drizzle.config.ts` (main), `drizzle.forecasting.config.ts`

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Integration Points

### External Services
- **Neon PostgreSQL**: Serverless database hosting
- **Replit Auth**: Authentication provider
- **Third-party APIs**: Salesforce, QuickBooks, ZoomInfo, Apollo.io integration

### Key Business Domains
- **CRM**: Lead management, customer conversion, deal tracking
- **Service Management**: Dispatch, technician workflow, equipment maintenance
- **Inventory**: Warehouse operations, parts tracking, equipment lifecycle
- **Billing**: Meter billing, invoice generation, contract management
- **Analytics**: Performance monitoring, predictive maintenance, business intelligence

## Development Guidelines

### Authentication Flow
- All API routes require tenant context via middleware
- User authentication through Replit Auth with session management
- Role-based access control enforced at route and component level

### Database Patterns
- Always include `tenantId` filtering in queries
- Use Drizzle ORM with type-safe operations
- Leverage PostgreSQL RLS for data isolation

### Component Development
- Use shadcn/ui components as base building blocks
- Follow mobile-first responsive design principles
- Implement proper loading states and error boundaries

### API Development
- RESTful endpoints with consistent error handling
- Tenant-aware middleware for all protected routes
- Proper validation using Zod schemas
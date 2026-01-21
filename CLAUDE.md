# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development

```bash
npm run dev              # Start dev server (tsx for backend, Vite HMR for frontend)
npm run dev:frontend     # Start frontend only (Vite)
npm run build            # Build frontend for production (Vite)
npm run build:fullstack  # Build frontend + bundle server with esbuild
npm start                # Start production server (NODE_ENV=production)
npm run check            # TypeScript type checking (tsc --noEmit)
```

### Code Quality

```bash
npm run lint             # ESLint (TS/TSX files)
npm run format           # Check Prettier formatting
npm run format:write     # Apply Prettier formatting
```

### Database

```bash
npm run db:push          # Push schema changes to main database
npm run db:push:forecast # Push to forecasting database
```

### Testing

```bash
npm run test             # Run Vitest unit tests
npm run test:watch       # Vitest in watch mode
npm run test:unit        # Unit tests only (server/tests/unit/)
npm run test:integration # Integration tests only (server/tests/integration/)
npm run test:coverage    # Tests with coverage report
npm run test:e2e         # Playwright E2E tests (all browsers)
npm run test:e2e:chromium # E2E on Chromium only
npm run test:all         # All tests (unit + E2E)
```

### Seeding & Setup

```bash
npm run seed:rbac        # Seed RBAC permissions and roles
npm run seed:reports     # Seed 75 report definitions
npm run seed:kpis        # Seed 43 KPI definitions
npm run seed:plans       # Seed subscription plans
npm run stripe:setup     # Setup Stripe products (test mode)
npm run stripe:setup:live # Setup Stripe products (live mode)
```

### CLI Tools

```bash
npm run updater          # Database updater CLI (test data generation)
npm run updater:start    # Start CRON-based updaters
npm run kb               # Knowledge Base CLI
npm run kb:list          # List KB articles
npm run kb:create        # Create new KB article
```

## Project Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Wouter (routing) + TanStack Query + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express.js + TypeScript (tsx runtime)
- **Database**: Self-hosted Supabase PostgreSQL (`209.145.59.219:5433`) + Drizzle ORM
- **Auth**: Supabase GoTrue (JWT-based) with session fallback
- **Edge Functions**: Supabase Edge Functions (`supabase/functions/`)

### Directory Structure

```
├── client/src/
│   ├── components/       # React components (ui/, mobile/, dashboards/, etc.)
│   ├── pages/            # Route components (lazy loaded)
│   ├── hooks/            # Custom hooks (useAuth, usePaginatedQuery, useWebSocket, etc.)
│   └── lib/              # Utilities (queryClient, rbac, export-utils, validation)
├── server/
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # Main routes file (monolithic)
│   ├── routes-*.ts       # Modular route files (109 files)
│   ├── routes/           # Additional route modules (42 files)
│   ├── middleware/       # tenancy, rbac, cache, auth
│   ├── services/         # Business logic (70 services)
│   └── database-updater/ # Test data generation system
├── shared/               # TypeScript schemas (43 files)
│   └── schema.ts         # Main Drizzle schema
├── supabase/functions/   # Edge Functions (activities, invoices, teams, etc.)
└── tests/                # Playwright E2E tests
```

### Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Key Architectural Patterns

### Multi-Tenant Architecture

- **4-Tier Hierarchy**: Platform → Company → Regional → Location
- **8-Level Role Hierarchy**: Platform Admin (8) → Guest (1)
- **Tenant Isolation**: Row-level security with `tenantId` filtering on ALL queries
- **Tenant Resolution Priority**: `x-tenant-id` header → JWT `app_metadata.tenantId` → Session

### Unified Business Records (Zero-Data-Loss)

Leads and customers share the same `business_records` table. Status field determines state. Lead-to-customer conversion is a status update, preserving all history.

### Authentication Pattern

```typescript
import { getUserId, getTenantId, isAuthenticated } from '../utils/auth-helpers';

app.get('/api/resource', requireAuth, requireTenant, async (req, res) => {
  const userId = getUserId(req); // Supports JWT + session fallback
  const tenantId = getTenantId(req);
  // Always filter by tenantId!
  const data = await db.query.table.findMany({
    where: eq(table.tenantId, tenantId),
  });
});
```

### RBAC Permission Format

```typescript
// Format: <module>.<resource>.<action>_<scope>
'sales.lead.view_own'; // View own leads
'sales.lead.view_team'; // View team's leads
'sales.quote.approve_standard'; // Approve standard quotes

import { requirePermission, hasPermission } from './middleware/enhanced-rbac-middleware';
app.get('/leads', requirePermission(['sales.lead.view_own', 'sales.lead.view_team']), handler);
```

## Database & Schema

### Main Schema

- `shared/schema.ts` (293KB) - Core business entities
- Specialized schemas in `shared/*-schema.ts` (43 files)

### Migration Workflow

1. Update schema in `shared/` directory
2. Run `npm run db:push` to apply changes
3. Test in development
4. Commit schema changes

### Critical: Always Include Tenant Filtering

```typescript
// CORRECT
const data = await db.query.customers.findMany({
  where: eq(customers.tenantId, tenantId),
});

// WRONG - Security vulnerability!
const data = await db.query.customers.findMany();
```

## API Development

### RESTful Conventions

```
GET    /api/[resource]         - List with pagination
GET    /api/[resource]/:id     - Get single item
POST   /api/[resource]         - Create
PUT    /api/[resource]/:id     - Full update
PATCH  /api/[resource]/:id     - Partial update
DELETE /api/[resource]/:id     - Delete
```

### Error Response Format

```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {},
  "requestId": "uuid"
}
```

### New Route File Pattern

1. Create `server/routes-[feature].ts`
2. Register in `server/routes.ts`
3. Use middleware: `requireAuth`, `requireTenant`, `requirePermission`
4. Validate input with Zod schemas

## Frontend Development

### Component Development

- Use shadcn/ui components from `client/src/components/ui/`
- Mobile-first design with breakpoints: sm(640px), md(768px), lg(1024px), xl(1280px)
- Touch targets: minimum 48px
- Mobile components: `client/src/components/mobile/`

### State Management

- **Server State**: TanStack Query for all API data
- **Form State**: React Hook Form + Zod validation
- **Local State**: useState/useReducer for component-local state
- **Real-time**: WebSocket via `useWebSocket` hook

### Key Hooks

- `useAuth` - Authentication state
- `usePaginatedQuery` - Server-side pagination
- `useOptimisticMutations` - Optimistic UI updates
- `useWebSocket` - Real-time data

## Supabase Infrastructure

### Connection Details

- **API**: `https://api.printyx.net`
- **Edge Functions**: `https://functions.printyx.net`
- **Database Pooler**: `209.145.59.219:5433`

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Edge Functions

Located in `supabase/functions/`:

- `activities/` - Business activity tracking
- `invoices/` - Invoice management with line items
- `contracts/` - Contracts with tiered rates
- `equipment/` - Equipment with service history
- `teams/` - Team member management
- `customers/`, `contacts/`, `quotes/`, `reports/`, etc.

## Key Files Reference

| Task             | Files                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Add API endpoint | Create `server/routes-*.ts`, register in `server/routes.ts`        |
| Add page         | Create `client/src/pages/*.tsx`, add route in `client/src/App.tsx` |
| Add schema       | Update `shared/schema.ts` or create `shared/*-schema.ts`           |
| Get user ID      | `import { getUserId } from '../utils/auth-helpers'`                |
| Get tenant ID    | `import { getTenantId } from '../utils/auth-helpers'`              |
| RBAC middleware  | `server/middleware/enhanced-rbac-middleware.ts`                    |
| Query scoping    | `server/middleware/hierarchical-query-builder.ts`                  |

## Development Workflow: Plan → Execute → Test → Commit

Follow this 4-step cycle for each feature or change:

### 1. Plan

Think through the approach together before writing any code. Discuss the strategy and get alignment on what you're building. Consider:

- What files need to change?
- What's the data flow?
- Are there edge cases to handle?
- Does this affect multi-tenant isolation?

### 2. Execute

Write the code that matches the plan. The AI isn't figuring out what to build—you've already done that together. Focus on implementation details.

### 3. Test

Validate the implementation matches the plan:

```bash
npm run check            # Type safety
npm run test             # Unit tests
npm run test:e2e         # E2E tests (if applicable)
npm run dev              # Manual QA
```

### 4. Commit

Commit the working code and start the cycle again for the next piece.

### Pre-Flight Checks

- **Before starting**: `npm run check` - Ensure no existing type errors
- **Before committing**: `npm run build` - Verify build passes
- **Code style**: `npm run format:write && npm run lint`

## Common Pitfalls

1. **Forgetting tenant context** - Always filter by `tenantId`
2. **Skipping validation** - Validate all input with Zod
3. **Missing loading states** - Use TanStack Query's `isLoading`
4. **No error handling** - Implement try-catch and error boundaries
5. **Over-fetching** - Use pagination and field selection
6. **Using `any` type** - Fix TypeScript errors, avoid `any`

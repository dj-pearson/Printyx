# Printyx - Unified Copier Dealer Management Platform

## Overview
Printyx is a unified SaaS platform designed to consolidate fragmented technology stacks for small-to-medium copier dealers. It replaces disconnected legacy systems (CRM, billing, service dispatch, inventory) with a single, integrated solution, aiming to eliminate data silos, reduce manual processes, and provide comprehensive management for all aspects of a copier dealership.

The platform has successfully implemented a Root Admin security suite with Social Media Generation, comprehensive Security Management, System Monitoring, and Access Control systems. Key features include AI-powered analytics (customer churn, CLV, predictive maintenance), an Advanced Integration Hub, and Advanced Workflow Automation. Printyx also offers comprehensive customer success management, remote monitoring with IoT integration, advanced document management, and a mobile service app for field technicians. It provides meter billing, service dispatch, CRM, a unified business records system, and integrates with E-Automate, Salesforce, QuickBooks Online, ZoomInfo, and Apollo.io.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **Enhanced Contact Form (Aug 5, 2025)**: Implemented intelligent company field with predictive dropdown and automatic company creation. Users can now type company names with real-time search and create new companies seamlessly during contact creation.
- **Mobile Optimization (Aug 5, 2025)**: Comprehensive mobile optimization for deals management including responsive Kanban board, mobile card view for table data, and optimized dialog layouts for mobile devices.
- **Proposal Builder System (Aug 6, 2025)**: Built comprehensive proposal builder that integrates with existing quotes. Sales reps can now select existing quotes, choose professional templates, configure sections, and transform quotes into polished proposals. The system includes a 5-step workflow: Quote Selection → Template Selection → Section Configuration → Content Management → Preview & Send.
- **Complete Mobile-First Optimization (Aug 6, 2025)**: Implemented comprehensive mobile-first design system with 44×44px touch targets, iOS zoom prevention, safe area support, mobile-optimized forms, responsive grids, and enhanced mobile table components. All components now follow mobile-first principles with proper touch interactions and accessibility.

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
- **Key Entities**: Users, Roles, Tenants, Business Records (leads/customers), Equipment, Contracts, Service Tickets, Inventory, Technicians, Meter Readings, Invoices, Tasks, Projects, Service Call Analysis, Parts Orders, Warehouse Operations.

### Multi-Tenancy & Multi-Location Role-Based Access Control
- **Tenant Isolation**: Row-level security with `tenantId` filtering.
- **Organizational Structure**: 4-tier structure (Platform, Company, Regional, Location) supporting comprehensive access control.
- **Role Hierarchy**: 8-level role hierarchy with specific access scopes (platform, company, regional, location).
- **Data Segregation**: Multi-layered filtering by tenant, region, location, role, team, and individual assignments.
- **Permission System**: Granular module permissions with location-aware access controls.

### Technical Implementations
- **Unified Business Records System**: Zero-data-loss lead-to-customer conversion (new → contacted → qualified → active → inactive) with HubSpot-style interface and full CRUD operations.
- **Triple-Platform Integration System**: E-Automate, Salesforce, and QuickBooks Online integration with 140+ field mappings and isolated field mapping architecture.
- **Unified Data Enrichment System**: Lead prospecting with ZoomInfo and Apollo.io integration, offering 50+ enriched contact fields, company intelligence, and automated campaign management.
- **Root Admin Security Suite**: Comprehensive security platform including Social Media Generation, Security Management, System Monitoring, and Access Control, restricted to platform and root admins.
- **Multi-Tenant Architecture**: Replaced hardcoded tenant IDs with session-based tenant resolution and comprehensive tenant middleware.
- **Performance Optimization**: Standardized polling, smart cache strategies, pagination, optimistic updates, and grouped cache invalidation.
- **Form Validation**: Unified validation library with 8 comprehensive schemas, enhanced form hooks, and reusable components.
- **Customer Success Management**: Customer health scoring, equipment usage analytics, NPS scoring, and automated intervention workflows.
- **Remote Monitoring & IoT**: Real-time equipment monitoring, predictive maintenance, fleet dashboards, and automated alerts.
- **Document Management**: Advanced document lifecycle, OCR processing, automated workflows, and compliance tracking.
- **Mobile Service App**: For field technicians with GPS, job management, parts tracking, and offline capabilities.
- **Meter Billing System**: Automated invoice generation and tiered billing.
- **Service Dispatch**: Smart technician assignment and work order optimization.
- **CRM System**: Lead pipeline, quote generation, customer interaction, and equipment tracking.
- **Proposal Builder**: Quote-to-proposal conversion system with professional templates, customizable sections, and company branding integration.
- **Product Management System**: Seven-category product catalog.
- **Task Management System**: Personal and multi-step project tracking.
- **Equipment Lifecycle Management**: Purchase orders, warehouse, delivery, installation, and asset tracking.
- **CSV Import System**: Bulk import with tenant data segmentation and validation.
- **Advanced Reporting & Analytics**: Business intelligence dashboards.
- **Workflow Automation System**: Trigger-based actions and template creation.
- **System Integrations Dashboard**: Management for third-party integrations.
- **Legal Compliance Framework**: Integrated EULA, Privacy Policy, and Terms & Conditions.

### UI/UX Decisions
- Consistent navigation layout.
- Card-based interface for product categories.
- Chevron icons for expand/collapse states in nested navigation.
- **Mobile-First Design Philosophy**: All components prioritize mobile experience with progressive enhancement for larger screens.

## Mobile-First Development Guidelines

### 🎯 Core Mobile Principles
**ALWAYS follow these mobile-first principles when developing any component:**

#### 1. Touch Target Standards (MANDATORY)
```typescript
// ✅ CORRECT - All interactive elements must meet 44×44px minimum
size: "mobile"           // min-h-12 px-6 py-3 text-base
className="min-h-11 touch-manipulation"

// ❌ INCORRECT - Too small for mobile
size: "sm"              // h-9 - TOO SMALL!
className="h-8 w-8"     // TOO SMALL!
```

#### 2. Form Input Optimization (MANDATORY)
```typescript
// ✅ CORRECT - Always include these for mobile forms
<Input
  inputMode="email"           // Shows appropriate keyboard
  className="min-h-11 text-base sm:text-sm"  // 16px prevents iOS zoom
  autoComplete="email"        // Enables autofill
/>

// ❌ INCORRECT - Missing mobile optimizations
<Input className="h-9 text-sm" />  // Will cause iOS zoom!
```

#### 3. Mobile-First Grid Layouts (MANDATORY)
```typescript
// ✅ CORRECT - Start with mobile, enhance for larger screens
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"

// ❌ INCORRECT - Desktop-first approach
className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
```

#### 4. Typography Scaling (MANDATORY)
```typescript
// ✅ CORRECT - Mobile-first typography with responsive scaling
className="text-base sm:text-lg"      // 16px mobile, 18px desktop
className="text-sm sm:text-base"      // 14px mobile, 16px desktop

// ❌ INCORRECT - Fixed small text that's hard to read on mobile
className="text-sm"                   // Too small for mobile!
```

#### 5. Safe Area Support (REQUIRED for fixed elements)
```typescript
// ✅ CORRECT - Support devices with notches/dynamic islands
className="pb-safe-bottom pt-safe-top"

// Add to index.css if not present:
@supports (padding: env(safe-area-inset-top)) {
  .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .pt-safe-top { padding-top: env(safe-area-inset-top); }
}
```

### 📱 Component-Specific Guidelines

#### Button Component Usage
```typescript
// ✅ Mobile-optimized button usage
<Button size="mobile" className="w-full sm:w-auto">
  Action Button
</Button>

// Available sizes in order of mobile-friendliness:
// "mobile" (best for mobile) → "default" → "lg" → "sm" (avoid on mobile)
```

#### Form Field Best Practices
```typescript
// ✅ Complete mobile-optimized form field
<TextField
  control={control}
  name="email"
  label="Email Address"
  type="email"
  inputMode="email"           // Keyboard optimization
  autoComplete="email"        // Autofill support
  placeholder="Enter your email"
/>
```

#### Mobile Table Component
```typescript
// ✅ Use enhanced mobile table for complex data
<MobileTable
  data={customers}
  columns={[
    { key: 'name', label: 'Name', priority: 'high', icon: <User /> },
    { key: 'status', label: 'Status', priority: 'medium', badge: true },
    { key: 'phone', label: 'Phone', priority: 'low', icon: <Phone /> }
  ]}
  onRowClick={handleRowClick}
  loading={isLoading}
  emptyMessage="No customers found"
/>
```

#### Bottom Navigation (Fixed Mobile Nav)
```typescript
// ✅ Mobile bottom navigation with safe area support
<div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur pb-safe-bottom">
  <nav className="flex items-center justify-around py-1 px-2 min-h-16">
    {/* Navigation items with proper touch targets */}
  </nav>
</div>
```

### 🛠️ Development Workflow

#### Before Creating Any Component:
1. **Start Mobile-First**: Design for 320px width first
2. **Ensure Touch Targets**: All interactive elements ≥ 44×44px
3. **Test on Device**: Use browser dev tools mobile simulator
4. **Validate Typography**: Ensure 16px minimum for inputs
5. **Check Accessibility**: Proper ARIA labels and keyboard navigation

#### Testing Checklist:
- [ ] Touch targets meet 44×44px minimum
- [ ] Forms prevent iOS zoom (16px font minimum)
- [ ] Responsive grid works on all screen sizes
- [ ] Safe area support on devices with notches
- [ ] Proper keyboard types for different inputs
- [ ] Accessibility with screen readers
- [ ] Performance on slower mobile devices

#### Mobile Test File:
Use `/workspaces/Printyx/mobile-test.html` to validate:
- Safe area support functionality
- Touch target compliance
- Form input behavior
- Mobile-first responsive grids
- Typography scaling
- Bottom navigation functionality

### ⚠️ Common Mobile Pitfalls to AVOID:

1. **Desktop-First Grids**: Never start with `md:grid-cols-*`
2. **Small Touch Targets**: Never use elements smaller than 44×44px
3. **Small Text Inputs**: Always use 16px minimum font size
4. **Fixed Small Typography**: Avoid non-responsive small text
5. **Missing inputMode**: Always specify appropriate keyboard type
6. **Ignoring Safe Areas**: Support devices with notches/islands
7. **Poor Touch Feedback**: Always include active/touch states

### 📚 Mobile-First Resources:
- **Button Component**: `/client/src/components/ui/button.tsx`
- **Form Components**: `/client/src/components/forms/FormField.tsx`
- **Mobile Table**: `/client/src/components/responsive/mobile-table.tsx`
- **Bottom Nav**: `/client/src/components/ui/mobile-bottom-nav.tsx`
- **Global Mobile CSS**: `/client/src/index.css`
- **Mobile Documentation**: `/workspaces/Printyx/Mobile.md`

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

## Critical Architecture Rules
- **SIDEBAR CONSOLIDATION**: The application uses ONLY `role-based-sidebar.tsx` for all navigation. The old `sidebar.tsx` has been permanently removed. All navigation modifications must be done in `role-based-sidebar.tsx`. Never create additional sidebar files or components.
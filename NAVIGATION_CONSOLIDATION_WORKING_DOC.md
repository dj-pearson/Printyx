# Sidebar Navigation Consolidation — Working Document

Purpose: Reduce sidebar surface area by nesting related pages under focused hubs, deprecate redundant pages, and define concrete edits required. This doc is tied to `client/src/components/layout/role-based-sidebar.tsx` and `client/src/App.tsx`.

## Consolidation Principles
- Prefer hubs with tabs/sections over many top-level pages
- Remove near-duplicates; redirect or link from hub subsections
- Keep canonical routes stable; add redirects for deprecated ones
- Align navigation with user roles but keep hub structure consistent for all

## Final Hub List (target top-level sidebar)
- Overview (Dashboard, Customers)
- Sales & CRM Hub
- Service Hub
- Product Hub
- Billing & Finance Hub
- Reports & Analytics Hub
- Integrations Hub
- Admin Hub (System Administration + Platform Management)
- Account (Settings)

---

## Deep Dive and Decisions (based on current sidebar and routes)

### Overview
- `/` (Dashboard) — Keep
- `/customers` — Keep; alias to unified Business Records filtered to companies
  - Action: Ensure Customers view reads from unified records; add preset filter
- `/business-records` — Keep but show in Admin Hub (not Overview)

### Sales & CRM
- Hub Entry: `/sales/command-center` — Keep; becomes Sales & CRM Hub container
- Nest as tabs/sections within the hub:
  - `/crm`
  - `/leads-management`
  - `/contacts`
  - `/deals-management`
  - `/sales-pipeline`
  - `/sales-pipeline-forecasting`
  - `/crm-goals-dashboard`
  - Quotes & Proposals module:
    - `/quote-proposal-generation` — Keep (primary)
    - `/proposal-builder` — Merge into above as “Builder” view
    - `/quotes`, `/quotes/new`, `/quotes/:quoteId`, `/quotes/:quoteId/view` — Deep links
  - `/demo-scheduling`
  - `/contracts`
  - `/document-builder`
  - `/customer-success-management`
  - `/commission-management`
  - `/task-management` — Keep globally visible; also link as “Tasks” tab in hub
- Actions:
  - Implement Sales & CRM Hub shell with tabs/left-nav for the above
  - Redirect: `/proposal-builder` → `/quote-proposal-generation?view=builder`

### Service
- Hub Entry: `/service-hub` — Keep; hub container
- Nest within hub:
  - `/onboarding` (Onboarding Checklists)
  - `/service-dispatch-optimization` (Dispatch)
  - Mobile (merge):
    - `/mobile-field-service` + `/mobile-field-operations` → `/mobile-service-app`
  - `/service-analytics`
  - `/remote-monitoring`
  - `/preventive-maintenance-scheduling`
  - `/preventive-maintenance-automation`
  - `/meter-readings`
  - `/incident-response-system`
  - `/manufacturer-integration` (or link to Integrations Hub)
- Actions:
  - Create unified Mobile Service App; add redirects from both legacy mobile routes
  - Redirect legacy: `/service-dispatch` → `/service-dispatch-optimization`

### Product Management (Product Hub)
- Hub Entry: `/admin/product-hub` and `/product-hub` — Keep; single Product Hub
- Nest within hub:
  - `/product-catalog`
  - `/admin/equipment-lifecycle-management`
  - `/admin/purchase-orders`
  - `/admin/warehouse-operations`
  - `/admin/supplies`
  - `/admin/vendor-management`
  - `/admin/pricing-management`
  - Additional product assets present in routes (nest as subsections):
    - `/product-models`, `/product-accessories`, `/service-products`, `/software-products`, `/supplies`, `/professional-services`, `/managed-services`
- Actions:
  - Expand Product Hub to include all catalog/supply/vendor/pricing/warehouse ops
  - Remove duplicate “Vendors” from Finance (link to Product Hub → Vendor Management)

### Billing & Finance
- Create Finance Hub container route (new): e.g., `/finance` (or reuse `/billing`)
- Nest within hub:
  - `/invoices`
  - `/advanced-billing-engine`
  - `/meter-billing`
  - `/accounts-receivable`
  - `/accounts-payable`
  - `/journal-entries`
  - `/chart-of-accounts`
  - `/financial-forecasting`
  - Redundant:
    - `/vendors` — Remove; use Product Hub → Vendor Management
- Actions:
  - Add Finance Hub shell and move routes under hub navigation
  - Redirect: `/vendors` → `/admin/vendor-management`

### Reports & Analytics
- Create/confirm Analytics Hub container route (can use `/reports` with tabs)
- Nest within hub:
  - `/reports`
  - `/advanced-reporting`
  - `/advanced-analytics`
  - `/advanced-analytics-dashboard`
  - `/ai-analytics-dashboard`
  - `/predictive-analytics`
  - Optional additions (present but not routed): `SalesPerformanceAnalytics`, `ServiceForecastingAnalytics` as subsections
- Actions:
  - Consolidate multiple analytics pages under a single hub with cross-filters and saved views

### Integrations
- Hub Entry: `/integration-hub` — Keep
- Nest within hub:
  - `/quickbooks-integration`
  - `/erp-integration`
  - `/esignature-integration`
  - `/system-integrations`
  - Link out or cross-link: `/manufacturer-integration` (also listed under Service)
- Actions:
  - Add health/status badges, OAuth state, and per-integration settings in hub

### Admin (System Administration + Platform Management)
- Create Admin Hub container (can reuse `/root-admin-dashboard` or new `/admin-hub`)
- Nest within hub:
  - `/workflow-automation`
  - `/business-process-optimization`
  - `/business-records`
  - `/document-management`
  - `/security-compliance-management` and `/security-compliance`
  - `/deployment-readiness`
  - `/performance-monitoring`
  - `/data-enrichment`
  - `/customer-number-settings`
  - `/tenant-setup`
  - `/platform-configuration`
  - `/root-admin-dashboard`
  - `/security-management`
  - `/system-monitoring`
  - `/role-management`
  - `/database-management`
  - `/root-admin/seo`
  - `/gpt5-dashboard`
  - `/professional-services`
  - `/managed-services`
  - `/customer-self-service-portal` and `/customer-portal`
  - `/mobile-optimization`
  - `/customer-access-management`
  - `/access-control`
- Actions:
  - Merge Root Admin and Platform Management into a single Admin Hub

### Account
- `/settings` — Keep

---

## Redundancies and Merges (explicit)
- Proposal Builder → merge into Quote & Proposal Generation (builder view)
- Mobile Field Service + Mobile Field Operations → merge into Mobile Service App
- Vendors (Finance) → remove; use Product Hub → Vendor Management
- “Customers” vs “Business Records” → keep Customers in Overview; move Business Records to Admin Hub
- Legacy `service-dispatch` (if present) → redirect to `/service-dispatch-optimization`
- Multiple analytics pages → nest under Reports & Analytics Hub

## Orphan/Unused Pages Detected (present in `pages/` but not routed)
- Review and either route under a hub or remove:
  - `ExecutiveDashboard.tsx`
  - `FinancialIntelligenceDashboard.tsx`
  - `Integrations.tsx`
  - `ReportsHub.tsx` (if superseded by `/reports`)
  - `ServiceDispatchEnhanced.tsx`
  - `service-dispatch.tsx` (legacy)
  - `SalesPerformanceAnalytics.tsx` (not currently routed)
  - `ServiceForecastingAnalytics.tsx` (not currently routed)

---

## Required Engineering Tasks
1) Create hub shells (tabs/subnav) for:
   - Sales & CRM Hub, Service Hub, Product Hub, Finance Hub, Analytics Hub, Integrations Hub, Admin Hub
2) Add client-side redirects in `client/src/App.tsx`:
   - `/proposal-builder` → `/quote-proposal-generation?view=builder`
   - `/mobile-field-service` and `/mobile-field-operations` → `/mobile-service-app`
   - `/service-dispatch` → `/service-dispatch-optimization`
   - `/vendors` → `/admin/vendor-management`
3) Update `client/src/components/layout/role-based-sidebar.tsx` to only show hub entries; move children to hub internal nav
4) Add deep links within hubs to preserve existing bookmarks (e.g., `?tab=proposals`)
5) Remove or route orphan pages listed above

---

## Implementation Checklist (tracked)
- [ ] Slim sidebar to hub entries only
- [ ] Sales & CRM Hub shell with tabs
- [ ] Service Hub shell with tabs
- [ ] Product Hub expanded with all product/supply/vendor/pricing ops
- [ ] Finance Hub shell created; Vendors redirected to Product Hub
- [ ] Reports & Analytics Hub consolidation
- [ ] Integrations Hub with health/status and settings
- [ ] Admin Hub merge (Root Admin + Platform Management)
- [ ] Client-side redirects implemented in `App.tsx`
- [ ] Deep links added (e.g., `?tab=…`)
- [ ] Orphan pages reviewed and resolved

## Owner and Timeline (proposal)
- Navigation consolidation design: 2 days
- Hub scaffolding (7 hubs): 1–2 weeks
- Redirects and QA: 2–3 days
- Documentation & training updates: 2 days

## Open Questions
- Should “Task Management” remain global or live only inside Sales & CRM?
- Do we keep “Customers” and “Business Records” both visible to Admins?
- Any compliance-driven reason to keep Finance “Vendors” visible?

# iOS App Feature Expansion Plan

Analysis of the current iOS app vs. available Supabase edge functions, with recommended tabs, layouts, and features to make the app well-rounded.

---

## Current State

### What's Built (5 Tabs)

| Tab | Feature | Edge Functions Used |
|-----|---------|---------------------|
| Tasks | Full CRUD, stats, comments, time logging, bulk ops | `tasks` |
| CRM | Unified business records (leads/prospects/customers), activities, conversion | `customers`, `leads`, `business-records` |
| Pipeline | Opportunities with Kanban + list views, stage management | `opportunities` |
| Quotes | Proposals & quotes with status tracking, PDF download | `proposals`, `quotes`, `proposal-templates` |
| Settings | User info, logout, placeholder preferences | `mobile-auth` |

### What's Available but Unused (Key Edge Functions)

The backend has **184 edge functions**. The iOS app uses roughly **10** of them. Below are the most impactful unused functions grouped by domain:

| Domain | Edge Functions Available | iOS Impact |
|--------|------------------------|------------|
| **Dashboard/Analytics** | `today-dashboard`, `dashboards`, `analytics`, `reports`, `sales-reports`, `team-reports` | No home screen or daily summary |
| **Service Operations** | `service-tickets`, `work-orders`, `scheduling`, `appointments`, `technician-management` | Missing entire service vertical |
| **Field Service (Mobile)** | `mobile-field`, `mobile` (sessions, photos, sync) | Purpose-built for mobile, completely unused |
| **Financial** | `invoices`, `billing`, `account-receivable`, `payment-processing` | No invoice or billing visibility |
| **Contracts** | `contracts`, `contract-renewal`, `service-contracts` | No contract management |
| **Inventory** | `inventory`, `supplies`, `parts-inventory`, `parts-orders` | No inventory visibility |
| **Equipment/Devices** | `equipment`, `devices`, `remote-monitoring`, `meter-readings` | No equipment tracking |
| **Contacts** | `contacts`, `company-contacts` | Contacts buried inside CRM records only |
| **Notifications** | `notifications` | No push/in-app notifications |
| **Knowledge Base** | `knowledge-base` | No self-service reference |
| **User/Profile** | `user`, `auth-me`, `settings` | Minimal profile management |
| **Search** | `search` | No global search |
| **Activities** | `activities`, `activity-log` | No activity feed |

---

## Recommended Tab Structure

### Proposed: 5 Tabs with "More" Navigation

iOS Human Interface Guidelines recommend a maximum of 5 tabs. The current app uses all 5 for sales-focused features, leaving no room for service, financial, or operational features. The recommended restructure:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Home    │   CRM    │ Service  │  Sales   │   More   │
│ 🏠       │ 👥       │ 🔧       │ 💰       │ •••      │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

| Tab | Contents | Why |
|-----|----------|-----|
| **Home** | Today dashboard, activity feed, quick actions, notifications | Every mobile app needs a landing page. Currently users launch into a task list with no context. |
| **CRM** | Business records, contacts, lead activities (existing, enhanced) | Keep the existing CRM tab — it works well. Add standalone contacts access. |
| **Service** | Service tickets, work orders, scheduling, equipment | This is the biggest gap. Printyx is a print/copier service business — field service is core. |
| **Sales** | Pipeline, quotes/proposals, contracts (consolidated) | Merge the current Pipeline + Quotes tabs into one sales hub. They're part of the same workflow. |
| **More** | Tasks, invoices, inventory, reports, knowledge base, settings | Group less-frequently-accessed features here. Still important but not daily-driver tabs. |

---

## Feature Details by Tab

### Tab 1: Home (NEW)

**Edge functions**: `today-dashboard`, `analytics`, `notifications`, `activities`, `search`

```
┌─────────────────────────────────┐
│  Good morning, David            │
│  Wednesday, Feb 19              │
├─────────────────────────────────┤
│  🔍 Search everything...        │
├─────────────────────────────────┤
│  TODAY'S SNAPSHOT               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ 12 │ │  3 │ │  5 │ │ $8K│   │
│  │Open│ │Due │ │Tick│ │Rev │   │
│  │Task│ │Todo│ │ets │ │ue  │   │
│  └────┘ └────┘ └────┘ └────┘   │
├─────────────────────────────────┤
│  QUICK ACTIONS                  │
│  [+ Lead] [+ Ticket] [+ Task]  │
├─────────────────────────────────┤
│  ACTIVITY FEED                  │
│  • John closed deal — $12K  2m │
│  • New ticket #1042 assign  15m│
│  • Quote #89 accepted       1h │
│  • Lead converted: Acme    2h  │
├─────────────────────────────────┤
│  NOTIFICATIONS (3 unread)       │
│  🔔 Contract renewal due in 7d │
│  🔔 Invoice #445 overdue       │
│  🔔 New lead assigned to you   │
└─────────────────────────────────┘
```

**Implementation components:**
- `HomeView.swift` — main container
- `TodaySnapshotView.swift` — KPI cards from `today-dashboard`
- `QuickActionsBar.swift` — shortcuts to create common items
- `ActivityFeedView.swift` — recent activity list from `activities`
- `NotificationListView.swift` — from `notifications`
- `GlobalSearchView.swift` — from `search` (modal overlay)

**Models & Services:**
- `DashboardModels.swift` — `TodaySnapshot`, `DashboardMetric`, `ActivityItem`
- `NotificationModels.swift` — `AppNotification`, `NotificationType`
- `DashboardService.swift` — fetches today dashboard + activity feed
- `NotificationService.swift` — fetch/mark-read notifications
- `SearchService.swift` — global search across entities

---

### Tab 2: CRM (ENHANCED)

**Edge functions**: existing + `contacts`, `company-contacts`, `crm-goals`

Keep the existing CRM tab structure but add:

1. **Standalone Contacts section** — Currently contacts are only visible within a business record. Add a segmented control option or a sub-navigation:
   ```
   [All Records] [Leads] [Prospects] [Customers] [Contacts]
   ```

2. **CRM Goals tracking** — Show sales goals and progress from `crm-goals`:
   ```
   ┌─────────────────────────────────┐
   │  MY GOALS THIS MONTH           │
   │  ████████████░░░░  74% (37/50) │
   │  New leads                      │
   │  ██████████████░░  89% ($89K)  │
   │  Revenue target                 │
   └─────────────────────────────────┘
   ```

3. **Contact detail view** — Tap a contact to see their details, associated records, and communication history.

**New files:**
- `Features/Contacts/` — full MVVM stack (Models, Services, ViewModels, Views)
- `ContactListView.swift`, `ContactDetailView.swift`, `ContactFormView.swift`
- `CRMGoalsView.swift` — goals progress widget

---

### Tab 3: Service (NEW)

**Edge functions**: `service-tickets`, `work-orders`, `scheduling`, `appointments`, `equipment`, `mobile-field`

This is the most impactful addition. Printyx manages printers/copiers — service operations are the core business.

```
┌─────────────────────────────────┐
│  Service                        │
│  [Tickets] [Work Orders] [Equip]│
├─────────────────────────────────┤
│  TICKET STATS                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ 23 │ │  8 │ │  3 │ │ 12 │   │
│  │Open│ │Mine│ │Urg │ │Done│   │
│  └────┘ └────┘ └────┘ └────┘   │
├─────────────────────────────────┤
│  MY TICKETS                     │
│  🔴 #1042 HP LaserJet — Acme   │
│     Paper jam, urgent   Today   │
│  🟡 #1038 Canon iR — Beta Co   │
│     Toner low          Tomorrow │
│  🟢 #1035 Ricoh MP — Gamma     │
│     Maintenance         Mar 1   │
├─────────────────────────────────┤
│  SCHEDULE TODAY                 │
│  09:00  Acme Corp — Ticket#1042│
│  11:30  Beta Co — PM visit      │
│  14:00  Gamma Inc — Install     │
└─────────────────────────────────┘
```

**Sub-views:**

1. **Service Tickets** (primary)
   - List with status/priority filters
   - Ticket detail with timeline, notes, parts used
   - Create/update tickets
   - Swipe to assign, escalate, close

2. **Work Orders**
   - Active work orders assigned to user
   - Start/complete workflow
   - Parts and labor logging

3. **Equipment**
   - Customer equipment list
   - Equipment detail (model, serial, service history, meter readings)
   - Scan serial number (camera integration, future)

4. **Field Mode** (from `mobile-field`)
   - "My tickets today" quick view
   - Check-in / check-out at customer site
   - Add service notes
   - Log time
   - Take photos (from `mobile` sessions/photos)

**New files:**
- `Features/ServiceTickets/` — full MVVM stack
  - `ServiceTicketModels.swift` — `ServiceTicket`, `TicketStatus`, `TicketPriority`, `TicketUpdate`
  - `ServiceTicketService.swift` — CRUD + status updates
  - `ServiceTicketListViewModel.swift`, `ServiceTicketDetailViewModel.swift`
  - `ServiceTicketListView.swift`, `ServiceTicketDetailView.swift`, `ServiceTicketFormView.swift`
- `Features/WorkOrders/` — full MVVM stack
  - `WorkOrderModels.swift`, `WorkOrderService.swift`
  - `WorkOrderListView.swift`, `WorkOrderDetailView.swift`
- `Features/Equipment/` — full MVVM stack
  - `EquipmentModels.swift`, `EquipmentService.swift`
  - `EquipmentListView.swift`, `EquipmentDetailView.swift`
- `Features/FieldService/` — field mode views
  - `FieldDayView.swift` — today's schedule
  - `CheckInView.swift` — site check-in with location
  - `ServiceNotesView.swift`, `ServicePhotoView.swift`

---

### Tab 4: Sales (CONSOLIDATED)

**Edge functions**: existing + `contracts`, `contract-renewal`, `deals`, `sales-pipeline`, `commission`

Merge the current Pipeline and Quotes tabs into a single Sales hub with sub-navigation:

```
┌─────────────────────────────────┐
│  Sales                          │
│  [Pipeline] [Quotes] [Contracts]│
├─────────────────────────────────┤
│  PIPELINE SUMMARY               │
│  Total: $245K  Weighted: $128K  │
│  Closing this month: 5 deals    │
├─────────────────────────────────┤
│         (existing Pipeline      │
│          or Quotes content      │
│          based on segment)      │
└─────────────────────────────────┘
```

**New sub-section — Contracts:**
- List active contracts with renewal dates
- Contract detail with terms, tiered rates, equipment covered
- Renewal alerts (due in 30/60/90 days)
- Renew / mark churned actions

**New files:**
- `Features/Contracts/` — full MVVM stack
  - `ContractModels.swift` — `Contract`, `ContractStatus`, `TieredRate`, `ContractRenewal`
  - `ContractService.swift` — CRUD + renewal operations
  - `ContractListViewModel.swift`
  - `ContractListView.swift`, `ContractDetailView.swift`
- `SalesHubView.swift` — container with segmented control wrapping Pipeline, Quotes, Contracts

---

### Tab 5: More (NEW)

A `List`-based menu providing access to secondary features:

```
┌─────────────────────────────────┐
│  More                           │
├─────────────────────────────────┤
│  WORK                           │
│  ☑️  Tasks                      │
│  📊  Reports                    │
│  📋  Activity Log               │
├─────────────────────────────────┤
│  FINANCIAL                      │
│  🧾  Invoices                   │
│  📦  Inventory                  │
├─────────────────────────────────┤
│  RESOURCES                      │
│  📚  Knowledge Base             │
│  👥  Team                       │
├─────────────────────────────────┤
│  ACCOUNT                        │
│  ⚙️  Settings                   │
│  👤  Profile                    │
│  🔔  Notifications              │
└─────────────────────────────────┘
```

**New feature modules:**

#### Invoices
**Edge functions**: `invoices`
- Invoice list with status filters (draft, sent, paid, overdue)
- Invoice detail with line items, payment history
- Mark as paid, send reminder actions

**Files:** `Features/Invoices/` — `InvoiceModels.swift`, `InvoiceService.swift`, `InvoiceListView.swift`, `InvoiceDetailView.swift`

#### Inventory
**Edge functions**: `inventory`, `supplies`, `parts-inventory`
- Current stock levels with low-stock alerts
- Parts search
- Adjust quantities, reserve parts for work orders

**Files:** `Features/Inventory/` — `InventoryModels.swift`, `InventoryService.swift`, `InventoryListView.swift`, `InventoryDetailView.swift`

#### Reports
**Edge functions**: `reports`, `sales-reports`, `team-reports`, `analytics`
- Pre-built report cards (executive summary, pipeline health, service metrics)
- Tap to expand with charts/details
- Date range selector

**Files:** `Features/Reports/` — `ReportModels.swift`, `ReportService.swift`, `ReportsView.swift`, `ReportDetailView.swift`

#### Knowledge Base
**Edge functions**: `knowledge-base`
- Searchable article list by category
- Article detail view with markdown rendering
- Useful for field techs referencing troubleshooting guides

**Files:** `Features/KnowledgeBase/` — `KBModels.swift`, `KBService.swift`, `KBListView.swift`, `KBArticleView.swift`

#### Team
**Edge functions**: `teams`, `users-team`
- Team member list with roles and contact info
- Tap to call/email a team member

**Files:** `Features/Team/` — `TeamModels.swift`, `TeamService.swift`, `TeamListView.swift`

#### Enhanced Settings & Profile
**Edge functions**: `user`, `settings`, `auth-me`
- Full profile editing (name, phone, avatar)
- Notification preferences (push notification toggles)
- Appearance settings (dark mode, compact mode)
- Cache management

**Files:** Update existing `SettingsView.swift`, add `ProfileEditView.swift`, `NotificationSettingsView.swift`, `AppearanceSettingsView.swift`

---

## Implementation Priority

### Phase 1 — Foundation (Highest Impact)

These create the most value with the least structural change:

| # | Feature | Why First | Edge Functions |
|---|---------|-----------|----------------|
| 1 | **Home/Dashboard tab** | Every app needs a landing page; provides daily context | `today-dashboard`, `activities`, `notifications` |
| 2 | **Service Tickets** | Core business function for a copier/printer company | `service-tickets` |
| 3 | **Restructure tabs** | Reorganize from 5 sales tabs → Home/CRM/Service/Sales/More | — |
| 4 | **Global Search** | Users need to find things fast on mobile | `search` |

### Phase 2 — Depth

| # | Feature | Why | Edge Functions |
|---|---------|-----|----------------|
| 5 | **Contracts** | High-value business data, renewal tracking | `contracts`, `contract-renewal` |
| 6 | **Invoices** | Financial visibility on the go | `invoices` |
| 7 | **Equipment tracking** | Core to service operations | `equipment`, `devices`, `meter-readings` |
| 8 | **Contacts (standalone)** | Users need quick contact lookup | `contacts`, `company-contacts` |
| 9 | **Notifications** | Keep users informed in real-time | `notifications` |

### Phase 3 — Polish

| # | Feature | Why | Edge Functions |
|---|---------|-----|----------------|
| 10 | **Work Orders** | Extends service operations | `work-orders` |
| 11 | **Field Service Mode** | Mobile-specific check-in/out, photos, notes | `mobile-field`, `mobile` |
| 12 | **Reports** | On-the-go business intelligence | `reports`, `analytics`, `sales-reports` |
| 13 | **Inventory** | Parts availability for field techs | `inventory`, `parts-inventory` |
| 14 | **Knowledge Base** | Field tech reference material | `knowledge-base` |
| 15 | **Enhanced Settings** | Profile editing, notification prefs | `user`, `settings` |
| 16 | **Scheduling/Calendar** | Appointment management | `scheduling`, `appointments` |
| 17 | **Team Directory** | Quick team contact lookup | `teams`, `users-team` |

---

## New API Endpoints to Add

Following the pattern in `APIEndpoint.swift`:

```swift
// MARK: - Dashboard Endpoints
static func todayDashboard() -> APIEndpoint
static func activityFeed(page: Int, limit: Int) -> APIEndpoint
static func notifications(page: Int, limit: Int) -> APIEndpoint
static func markNotificationRead(id: String) -> APIEndpoint
static func globalSearch(query: String) -> APIEndpoint

// MARK: - Service Ticket Endpoints
static func serviceTickets(status: String?, priority: String?, assignedTo: String?, page: Int, limit: Int) -> APIEndpoint
static func serviceTicket(id: String) -> APIEndpoint
static func createServiceTicket(body: Encodable) -> APIEndpoint
static func updateServiceTicket(id: String, body: Encodable) -> APIEndpoint
static func addTicketNote(ticketId: String, body: Encodable) -> APIEndpoint

// MARK: - Work Order Endpoints
static func workOrders(status: String?, page: Int, limit: Int) -> APIEndpoint
static func workOrder(id: String) -> APIEndpoint
static func startWorkOrder(id: String) -> APIEndpoint
static func completeWorkOrder(id: String, body: Encodable) -> APIEndpoint

// MARK: - Equipment Endpoints
static func equipment(customerId: String?, page: Int, limit: Int) -> APIEndpoint
static func equipmentDetail(id: String) -> APIEndpoint
static func meterReadings(equipmentId: String) -> APIEndpoint

// MARK: - Contract Endpoints
static func contracts(status: String?, customerId: String?, page: Int, limit: Int) -> APIEndpoint
static func contract(id: String) -> APIEndpoint
static func upcomingRenewals(days: Int) -> APIEndpoint
static func renewContract(id: String, body: Encodable) -> APIEndpoint

// MARK: - Invoice Endpoints
static func invoices(status: String?, customerId: String?, page: Int, limit: Int) -> APIEndpoint
static func invoice(id: String) -> APIEndpoint
static func markInvoicePaid(id: String, body: Encodable) -> APIEndpoint

// MARK: - Inventory Endpoints
static func inventoryItems(search: String?, lowStock: Bool?, page: Int, limit: Int) -> APIEndpoint
static func adjustInventory(id: String, body: Encodable) -> APIEndpoint

// MARK: - Contact Endpoints
static func contacts(companyId: String?, search: String?, page: Int, limit: Int) -> APIEndpoint
static func contact(id: String) -> APIEndpoint
static func createContact(body: Encodable) -> APIEndpoint
static func updateContact(id: String, body: Encodable) -> APIEndpoint

// MARK: - Knowledge Base Endpoints
static func kbArticles(category: String?, search: String?, page: Int, limit: Int) -> APIEndpoint
static func kbArticle(id: String) -> APIEndpoint

// MARK: - Field Service Endpoints
static func myTicketsToday() -> APIEndpoint
static func checkIn(ticketId: String, body: Encodable) -> APIEndpoint
static func checkOut(ticketId: String, body: Encodable) -> APIEndpoint
static func addServiceNote(ticketId: String, body: Encodable) -> APIEndpoint
static func logFieldTime(ticketId: String, body: Encodable) -> APIEndpoint

// MARK: - Team Endpoints
static func teamMembers() -> APIEndpoint

// MARK: - Report Endpoints
static func executiveSummary() -> APIEndpoint
static func salesReport(type: String, dateRange: String?) -> APIEndpoint

// MARK: - User/Settings Endpoints
static func userProfile() -> APIEndpoint
static func updateProfile(body: Encodable) -> APIEndpoint
static func userPreferences() -> APIEndpoint
static func updatePreferences(body: Encodable) -> APIEndpoint
```

---

## Architecture Notes

### Following Existing Patterns

Each new feature module should follow the established MVVM pattern:

```
Features/
  NewFeature/
    Models/
      NewFeatureModels.swift       # Codable structs + enums
    Services/
      NewFeatureService.swift      # async API calls via APIClient
    ViewModels/
      NewFeatureListViewModel.swift    # @MainActor, @Published state
      NewFeatureDetailViewModel.swift
    Views/
      NewFeatureListView.swift     # NavigationStack, search, filters
      NewFeatureDetailView.swift   # Detail with sections
      NewFeatureFormView.swift     # Create/edit sheet
      NewFeatureRowView.swift      # List row component
```

### Key Integration Points

Per the [Supabase Edge Functions iOS Integration Guide](supabase-edge-functions-ios-integration.md):

1. **Date handling** — server.ts normalizes all timestamps to `YYYY-MM-DDTHH:mm:ssZ`. iOS decoder has fallback chain. No additional work needed for new features.

2. **Snake case** — `keyDecodingStrategy = .convertFromSnakeCase` is set globally. New models should use camelCase property names.

3. **Nullable fields** — Always use `Optional` for fields that could be null in PostgreSQL. Non-optional properties will cause full-response decode failure.

4. **Enum resilience** — Use `String` type or add `.unknown` fallback case for enums where the backend may add new values.

5. **Tenant isolation** — All edge functions already filter by tenant. The iOS app sends `x-tenant-id` header via APIClient. No per-feature work needed.

### Tab Structure Implementation

The `MainTabView.swift` restructure:

```swift
TabView(selection: $selectedTab) {
    HomeView(...)           // NEW
        .tabItem { Label("Home", systemImage: "house") }
        .tag(0)

    CRMListView(...)        // EXISTING (enhanced)
        .tabItem { Label("CRM", systemImage: "person.2") }
        .tag(1)

    ServiceHubView(...)     // NEW
        .tabItem { Label("Service", systemImage: "wrench.and.screwdriver") }
        .tag(2)

    SalesHubView(...)       // CONSOLIDATED (Pipeline + Quotes + Contracts)
        .tabItem { Label("Sales", systemImage: "chart.line.uptrend.xyaxis") }
        .tag(3)

    MoreView(...)           // NEW (Tasks, Invoices, Inventory, Reports, KB, Settings)
        .tabItem { Label("More", systemImage: "ellipsis") }
        .tag(4)
}
```

---

## Summary

| Metric | Current | After Expansion |
|--------|---------|-----------------|
| Tabs | 5 (all sales-focused) | 5 (balanced across sales, service, operations) |
| Features | 4 (Tasks, CRM, Pipeline, Quotes) | 15+ (Dashboard, CRM, Contacts, Service Tickets, Work Orders, Equipment, Pipeline, Quotes, Contracts, Invoices, Inventory, Reports, KB, Team, Field Service) |
| Edge functions used | ~10 of 184 (5%) | ~40 of 184 (22%) |
| User personas served | Sales reps only | Sales reps, field technicians, managers, admins |
| Settings depth | User info + logout | Profile editing, notification prefs, appearance, cache |

The biggest wins for making the app "well-rounded" are:
1. **Home dashboard** — gives users a reason to open the app every morning
2. **Service operations** — covers the other half of the business (not just sales)
3. **Tab consolidation** — Pipeline + Quotes merge into Sales, freeing room for Service and More
4. **Financial visibility** — invoices and contracts are high-value data for on-the-go access
5. **Global search** — the single most-requested mobile feature in enterprise apps

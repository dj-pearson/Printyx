# Workflow deep dive: sales to service, and who is allowed to see what

**Date:** 2026-09-02 · **Branch:** `claude/codebase-audit-workflow-0iw235` · **Stories filed:** 67 (`WF-*` in `prd.json`)

This is the page-by-page audit of the target workflow: lead identification, nurturing, outreach,
quotes, proposals, closed deal, lease-or-payment check, handoff to purchasing and project
management, receiving, build and functional check (mechanical and network), delivery, acceptance,
then service (toner monitoring and service calls per unit) through to meter billing. It also
audits the tier model the owner wants: individual contributors see their own work, supervisors and
managers see team or location, district and area managers see a region, president and admin see
the company, platform admin sees every tenant.

Every claim below was verified against the tree on the date above. Where a claim rests on a live
database or a deployed host, it is marked UNVERIFIED. The six stage reports with full page tables
are in `docs/workflow-audit-2026-09-02/`.

Guard counts on the day (Node 20, `npm run check:*`): typecheck 315 at baseline 315; 53 both-divergent
route domains; 82 of 269 edge functions with no caller; 67 of 269 edge functions with any role check;
65 unsatisfiable Express permission gates, 43 of them on prefixes the frontend calls; 104 orphan files;
39 tables read and written by nothing.

## The one-paragraph diagnosis

The parts exist and the joins do not. Each stage has a real table, usually a real edge function, and
often a real page, built in its own campaign. What is missing is the spine: the foreign keys and the
state transitions that carry a record from one stage to the next. A deal has no contract, a contract
has no deal, lease or payment type, a purchase order has no contract or customer, receiving a PO
creates no equipment, an onboarded device is not an equipment row, acceptance flips nothing, and the
role tiers filter nothing. Below the joins, the migration from Neon to self-hosted Supabase left a
second class of break: production runs edge functions that dev never exercises, so a whole function
can be unparseable (`equipment-lifecycle`), read a table no migration creates (`sales-handoffs`,
`work-orders`, `scheduling`, `auto-lead-routing` rules, `maintenance`), or serve a different table
than the page's other half (`companies` versus `business_records`), while dev, served by Express,
looks fine.

## The spine as it stands

Read left to right; a cell says which column carries the link, or what is missing.

| From                    | To                                                                    | Link today                                                                                              | Story                          |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| lead list (`companies`) | lead detail, routing, scoring, Apollo, web forms (`business_records`) | none; different tables, different ids                                                                   | WF-S-01                        |
| lead                    | deal                                                                  | none; `deals` has no source lead column, `leadId` is dropped on insert                                  | WF-S-03                        |
| deal stage move         | workflow automation                                                   | none from the UI; the only dispatch sits on an endpoint no client calls                                 | WF-C-01                        |
| proposal accepted       | deal won, contract created                                            | works (`/p/:token` respond)                                                                             | WF-C-08 fixes the stage lookup |
| deal                    | contract                                                              | none; `contracts` has 12 columns and no `deal_id`, `deals` has no `contract_id`                         | WF-C-09                        |
| contract                | lease or payment type                                                 | none; acceptance always creates a contract, never a lease; `paymentTerms` unread                        | WF-C-05                        |
| closed deal             | operations handoff                                                    | none reachable; real tables and an Express router with no caller, an edge function over a phantom table | WF-C-06                        |
| contract                | purchase order                                                        | none; `purchase_orders` has no contract, deal or customer column; Book Order drops the id               | WF-P-03, WF-P-04               |
| PO create               | PO lines                                                              | dropped; page sends `items`, handler reads `lineItems`; sub-resource targets a phantom table            | WF-P-01                        |
| PO received             | equipment row with serial                                             | none; receive moves inventory counts only; Add Equipment dialog is a placeholder                        | WF-L-04                        |
| received                | built and QA passed                                                   | none wired; kitting and first-pass-yield backend has no caller; Build tab is a placeholder              | WF-L-05                        |
| onboarding device       | `equipment`                                                           | unconstrained nullable column nobody fills                                                              | WF-L-09                        |
| network config          | queryable rows                                                        | stored in a jsonb blob; dedicated tables have no writer                                                 | WF-L-10                        |
| staged                  | delivery and install scheduled                                        | none; `installation_schedules` has no reader or writer, Delivery tab is a placeholder                   | WF-L-06                        |
| delivered               | accepted                                                              | none; the only signature capability (`field-service`) has no caller                                     | WF-L-07                        |
| accepted                | active, monitored, billable                                           | log line only, dev only; no baseline meter, no contract start                                           | WF-L-08                        |
| active unit             | ticket                                                                | works (`service_tickets.equipment_id`)                                                                  |                                |
| ticket                  | assigned technician                                                   | no working assign UI anywhere                                                                           | WF-V-03                        |
| technician              | working the ticket                                                    | backend real, page pinned to `ticket-123`                                                               | WF-V-02                        |
| device                  | toner runway, replenish order                                         | works (printyx-client agent to `device_metrics`)                                                        |                                |
| meter reading           | invoice                                                               | works (`/billing/generate-invoices`)                                                                    |                                |

## Stage by stage

### 1. Lead identification, nurturing, outreach

What works: the AI Outreach Hub (five pages, one edge function, every call matched); web-form capture
with dedupe, scoring, routing and workflow dispatch; email sequence enrolment and SendGrid send;
the lead map; sales-rep assignment writes.

What is broken: the sales-rep-facing lists (`/leads`, `/leads-management`, `/crm/leads`, `/prospects`,
`/customers`) read `companies`, and everything automated (routing, scoring, Apollo add-to-CRM,
web forms, the `leads` function behind `/leads/:id` and the map) reads and writes `business_records`.
A row click from the CRM leads shell navigates to `/leads/<companies id>` and 404s. A lead the
router assigned to a rep never appears on that rep's list. CRMX-011 (web forms to leads) is marked
passing and its output is invisible for this reason. COP-B00 records the root split; the fan-out
across seven writers is new (WF-S-01).

Also: `lead_routing_rules` is declared nowhere, so the rule editor 503s (WF-S-02); Apollo's
bulk-add and stats endpoints do not exist on the edge function (WF-S-05); six CRM Goals actions 404
in production (WF-S-06); `Contacts.tsx` reads `companies` from the browser with no RLS policy on the
table (WF-S-07); `LeadDetail.tsx` ships a debug `alert()` button (WF-S-08); the BANT component is
imported by nothing (WF-S-09); `data-enrichment` is a dead duplicate of `enrichment` (WF-S-10).
Nurturing has no entry point from the record: no lead or deal page offers "enroll in sequence"
(WF-S-04).

### 2. Quotes, proposals, close, financing

What works: the quote engine (recurring and one-time buckets, discount guardrails, margin floors),
proposal templates and branding, the public proposal page, and acceptance through `/p/:token`,
which moves the deal to won and creates a contract. This is the real closed-won path.

What is broken: the board and the deal page move stages through `pipeline-config`, which never
dispatches `deal.stage_changed`; the dispatch lives on a `PATCH /deals/:id` branch no client sends
`stage_id` to, and the automation log it writes instead is read by nothing (WF-C-01). Mark Won on
the table changes status only, so the board keeps the deal in its old column (WF-C-02). Deal Desk
cannot be entered: nothing creates a request, and an approval never unblocks the rep, because the
send guardrail trusts the sender's own manager flag (WF-C-03, WF-C-04). The lease-or-payment check
does not exist: acceptance always creates a contract and never a lease, `leases` is a disconnected
CRUD module, `payment-processing` and `subscriptions` have no caller (WF-C-05). The contract row
carries no deal, proposal, lease or start date (WF-C-09). Won-stage resolution on acceptance reads
legacy `deal_stages`, which the pipeline configuration UI never mirrors (WF-C-08, a slice of
COP-M07). The commission engine does not exist and the Calculate button 501s (WF-C-07).

The handoff to purchasing and project management has no screen. The four tables in
`shared/sales-handoff-schema.ts` are real and served by `server/routes-sales-handoff.ts`, which no
client calls; `supabase/functions/sales-handoffs` reads `sales_handoffs`, which no schema or migration
creates. No `prd.json` story mentioned handoff before this audit (WF-C-06).

### 3. Purchasing and project management

What works: PO status transitions (draft, pending approval, approved, ordered, received), vendors,
accounts payable, the task hub, and the one wired leg: PO approved, Release to Warehouse,
onboarding checklist with `order_id`.

What is broken: PO lines are dropped on create and the line-item sub-resource references
`purchase_order_line_items` nineteen times, a table that exists nowhere; `purchase_orders` and
`purchase_order_items` are each declared twice with different shapes (WF-P-01). No Receive action
exists on the page (WF-P-02). A PO cannot name its contract or customer (WF-P-03), so no "needs
ordering" queue can exist (WF-P-04). PO approval is checked by three vocabularies and enforced by
none in production (WF-P-05). A complete manufacturer EDI ordering subsystem (six tables, 43
endpoints, `manufacturer_orders.purchase_order_id`) has no UI (WF-P-06). `implementation_projects`
and `handoff_tasks` are real and unreachable; the reachable `projects` table lost `contract_id` in
migration 0002 (WF-P-07). Tasks cannot be attached to a customer, deal or handoff (WF-P-08).
Workflow automation still answers 401 for every user (CRMX-008a, open). No purchasing or project
role is seeded (WF-R-11).

### 4. Receiving, build, delivery, acceptance

The equipment lifecycle state machine has the right stages (ordered, received, staged, in transit,
delivered, installed, active, maintenance, retired, disposed, traded in) and 25 named transition
requirements (`quality_control_passed`, `serial_number_verified`, `delivery_scheduled`,
`driver_assigned`, `delivery_signature_collected`, `acceptance_signed`, `customer_trained`, and so
on). Two things undo it. The production edge function never loads: it imports three helpers from
the shared transitions module and re-declares them locally, which is a parse error; the dispatcher
swallows it at boot and answers 404 for every lifecycle request (WF-L-01, WF-G-01). And the
requirements are strings the caller asserts, backed by no record (WF-L-13).

Around it: the lifecycle hub's five main queries and three mutations have no backend on either
host (WF-L-02); the warehouse operations edge function lacks the list, create and status endpoints
the page uses and implements six branches nothing calls (WF-L-03); receiving never creates an
equipment row and the Add Equipment dialog is a placeholder (WF-L-04); the Build, Serial Numbers
and Delivery tabs are placeholders while a real kitting and first-pass-yield backend sits uncalled
(WF-L-05); `installation_schedules` has no reader or writer and `delivery_schedules` one uncalled
writer (WF-L-06); the only signature capture has no caller (WF-L-07); "activate monitoring" is a
log line, dev only (WF-L-08); onboarded devices never become equipment rows (WF-L-09); network and
print-management settings are buried in jsonb (WF-L-10); OID mappings and address books are
unlinked admin pages (WF-L-11); Asset and Vehicle Management are hard-coded mock arrays (WF-L-12).

### 5. Service

What works, verified end to end: device agent to `device_metrics` to supply runway and toner
replenish; customer portal to a real ticket; meter reading to a real tiered invoice; predictive
failure and proactive maintenance both create real tickets.

What is broken: production ticket lists never join equipment or technician (WF-V-01); the only
page with a working check-in backend is pinned to `ticket-123` and `tech-456` (WF-V-02); no page
assigns a technician to a ticket, and ServiceHub's Smart Routing modal is hard-coded names with an
Assign button that has no handler (WF-V-03); the preventive-maintenance Express routes are sample
fixtures, auto-generate persists nothing and invents a savings figure, and the production edge
function reads `maintenance_schedules`, which no schema or migration declares (WF-V-04); ticket
status is three vocabularies with no constraint (WF-V-05); three supply-order tables and two toner
pipelines, one of them unwritten (WF-V-06); a technician schedule route reads `work_orders`, which
does not exist (WF-V-07).

### 6. Role tiers and data scoping

Tenant isolation holds everywhere checked. Intra-tenant tiering does not exist on any live path.

| Layer                   | State                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT claims              | signup writes `tenantId`, `roleId`, `accessScope`, `isPlatformUser:false`; nothing ever writes `roleLevel`, `role` or `permissions`, so `getRoleLevel()` returns 1 for everyone, platform admins included |
| edge function gates     | 67 of 269 check a level; all read the claim above, so they lock everyone out or let everyone in                                                                                                           |
| query scoping           | the nine core list endpoints filter on `tenant_id` only; the two scoping engines (`hierarchical-query-builder.ts`, `scope-middleware.ts`) are Express-only orphans                                        |
| `/api/me`               | never returns `role.code`; fails open to every module permission when the role is missing                                                                                                                 |
| sidebar and route guard | a real tiered vocabulary, client-side only, fed by System A JSONB in production                                                                                                                           |
| role dashboards         | `effectiveRoleCode` upper-cases a display name and matches no layout key, so every user gets DEFAULT                                                                                                      |
| org structure           | `users` has `manager_id`, `team_id`, `primary_location_id`, `region_id`; `locations`, `regions`, `teams` exist; no reachable UI populates any of it, and the ten edge functions for it have no caller     |
| roles table seed        | the table signup depends on has no seed path that runs                                                                                                                                                    |
| RLS                     | eighteen peripheral areas, none of the core tables; moot for edge functions, which use the service role                                                                                                   |

RBAC-008 and RBAC-009 are marked passing and are not implemented (WF-R-01). The fix order is:
decide the role system (WF-R-01), seed it (WF-R-02), put the claims in the JWT (WF-R-03), build one
Deno scope helper and apply it to the nine core endpoints (WF-R-04), then per domain (WF-R-05,
WF-R-06, WF-R-07), build the org-structure admin so the columns have values (WF-R-08), close the
`/api/me` fail-open (WF-R-09), fix dashboards (WF-R-10), add the missing roles (WF-R-11), and lock it
with an integration suite (WF-R-12).

## Story map and order

Foundation first, because every stage story after it assumes claims in the JWT and a scope helper:

1. **WF-R-01 to WF-R-04, WF-R-09** and the guards **WF-G-01, WF-G-02**.
2. **Sales spine:** WF-S-01 (with COP-B00), WF-C-01, WF-C-02, WF-C-03, WF-C-04, WF-C-05, WF-C-09, WF-C-06.
3. **Purchasing:** WF-P-01, WF-P-02, WF-P-03, WF-P-05, WF-P-04.
4. **Logistics:** WF-L-01, WF-L-02, WF-L-03, WF-L-04, WF-L-09, WF-L-08.
5. **Service:** WF-V-01, WF-V-03, WF-V-02, WF-V-04.
6. **Scoping per domain and the org admin:** WF-R-05, WF-R-06, WF-R-07, WF-R-08, WF-R-11, WF-R-12.
7. **Second pass:** WF-L-05, WF-L-06, WF-L-07, WF-L-10, WF-L-13, WF-P-06, WF-P-07, WF-P-08, WF-C-07, WF-C-08, WF-S-02 to WF-S-06, WF-R-10.
8. **Cleanup:** the priority-3 stories.

Each story's `dependsOn` field carries the exact prerequisites; `notes` carries the file and line
evidence.

## Findings that correct existing records

- RBAC-008 and RBAC-009 (`passes: true`): deliverables are orphan files or dead branches. WF-R-01.
- PA-052 (`passes: true`): the equipment-lifecycle endpoints it added were never reachable. WF-L-01.
- US-050 (`passes: true`): the monitoring side effect is a log line and the whole chain is dev-only. WF-L-08.
- CRMX-011 (`passes: true`): correct as built; its output is invisible to reps because of WF-S-01.
- AUDIT-013 (`passes: true`): fixed the dev join only; production is still blank. WF-V-01.
- EDGE-002h: its warehouse-operations finding missed the bare list, create and PATCH. WF-L-03, WF-G-05.
- The undeclared-table class now has six members, not three: `sales_handoffs`, `work_orders`,
  `appointments`, `lead_routing_rules`, `maintenance_schedules`, `purchase_order_line_items`. WF-G-02.

## Not re-filed (already open and still accurate)

COP-B00, COP-M01, COP-M03, COP-E02, COP-E03, COP-M07, CRMX-008a, CRMX-010 / COP-B07, PA-041,
PA-043, AUDIT-026, AUDIT-033, IOS-051, CRMX-018, SEC-EDGE-001, SEC-EDGE-002, CR-012, PROD-008a,
EDGE-002h, EDGE-008. Where a new story narrows one of these it says so in its notes.

## UNVERIFIED

- Live database state: whether `maintenance_schedules`, `sales_territories` data, RLS on `companies`,
  and `isPlatformUser` on real admin accounts exist as the code assumes.
- Whether the Node process that runs the sequence scheduler and web-form processor runs
  continuously in production.
- Email open and click tracking for sequences (SendGrid event handlers exist; not traced).
- `/import`, `/demo-scheduling`, `/booking-pages`, `/calendar`, `/supplies`, `/inventory`: routed and
  classified, not deep-audited.

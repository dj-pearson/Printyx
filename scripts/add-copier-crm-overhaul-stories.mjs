// One-shot: append COP-E01..E07 / COP-M01..M07 / COP-B01..B14 / COP-I01..I07
// (the copier CRM overhaul backlog) to prd.json.
//
// Source: docs/crm-copier-overhaul.md — a code-grounded audit of the CRM against
// HubSpot's 2026 Sales Hub. All 35 stories are priority 1; the ARRAY ORDER below
// is the intended work order, because scripts/prd-loop.mjs sorts open stories by
// `priority` with a stable sort, so equal-priority stories are worked in file order.
// The order encodes the 5 phases from the report (Phase 0 first).
//
// Run: node scripts/add-copier-crm-overhaul-stories.mjs
import fs from 'node:fs';

const PRD = new URL('../prd.json', import.meta.url);

const SRC =
  'Source: docs/crm-copier-overhaul.md (copier CRM overhaul audit, 2026-08-10), grounded in a direct read of the CRM client/server/schema trees rather than the docs.';

const stories = [
  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 0 — Make the good stuff visible. No new features: repoint nav,
  // delete dead code, one URL per object, one word per object.
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'COP-M01',
    title: 'Repoint the sidebar at the CrmIndexShell pages for leads, contacts, and companies',
    description:
      'As a sales rep, I need the CRM list pages to have saved views, a board/table toggle, inline editing, and bulk operations, because those were already built in CRM-001..010 but the sidebar still points at the older hand-rolled pages so nobody can reach them.',
    acceptanceCriteria: [
      "RoleAwareCollapsibleSidebar.tsx 'Sales Hub' children point Leads at /crm/leads (CrmLeadsPage), Contacts at /crm/contacts (CrmContactsPage), and Companies/Customers at /crm/companies (CrmCompaniesPage) — replacing /leads-management (LeadsPage), /contacts (Contacts.tsx), and /customers (CustomersPage).",
      'Before switching, confirm each shell page has parity on the capabilities the legacy page provided (create dialog, CSV export, the filters reps actually use); file any true parity gap as a follow-up rather than silently dropping it.',
      'Each shell page renders saved-view tabs, the table/board toggle where the object supports a board, advanced filters, the column picker, bulk selection, and inline cell editing — i.e. the CrmIndexShell feature set is live for all four object types, not just deals.',
      'matchPatterns on the Sales Hub nav entry still highlight the hub for every legacy path so deep links keep the correct section expanded.',
      'Legacy pages are left routed (not deleted) in this story — COP-E03 retires them once parity is confirmed in a running environment.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / NAV] ${SRC} Highest ratio of impact to effort in the whole report: a one-line-per-object nav change that instantly upgrades three object types. Audit evidence: CrmLeadsPage (261 lines) / CrmContactsPage (176) / CrmCompaniesPage (174) are routed under /crm/* but absent from the sidebar, while nav points at LeadsPage (661), Contacts.tsx (1959), CustomersPage (877). Only deals reaches the shell, via /opportunities.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M02',
    title: 'Restructure the Sales Hub navigation into Work / Sell / Manage groups',
    description:
      'As a sales rep, I need the Sales Hub menu to be grouped by what I am doing, because today it is 17 ungrouped children mixing CRM objects, selling tools, dashboards, and admin settings in one flat list.',
    acceptanceCriteria: [
      'Sales Hub children are grouped under three headings: Work (My Day, Deals, Leads/Contacts/Companies, Tasks), Sell (Quotes, Proposals, Deal Desk, Meetings, Sequences, Web Forms), and Manage (Forecast, Goals, Territories, Commission, Customer Success).',
      'Admin/config entries move out of Sales Hub into Settings: Custom Fields (/settings/custom-fields), Proposal Branding (/proposals/branding), and Pipeline Configuration (/pipeline-config).',
      'Meeting Transcription moves from the Productivity hub into Sell — it is a selling tool, not a productivity utility.',
      'The sidebar component supports a group heading within a hub section (non-navigable label) without breaking collapse, keyboard navigation, or the active-path highlight.',
      'Every moved item keeps its existing route; this story changes grouping and placement only, not destinations.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / NAV] ${SRC} Audit evidence: RoleAwareCollapsibleSidebar.tsx 'crm' section has 17 flat children mixing objects, tools, dashboards, and settings; Meeting Transcription sits under Productivity.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E01',
    title: 'Delete the nine unrouted CRM/sales pages (~10,065 lines of dead code)',
    description:
      'As a developer, I need dead CRM pages removed, because nine sizeable page components are not routed anywhere in App.tsx yet still appear in every search, creating constant "which page is the real one?" confusion.',
    acceptanceCriteria: [
      'Delete client/src/pages/{DealsManagement,LeadsManagement,customers,TaskManagement,BasicTaskManagement,AITaskScheduling,my-tasks,TaskManagementPage}.tsx after re-confirming each has no lazy() import in App.tsx and no import from any other module.',
      'TerritoryManagement.tsx is NOT simply deleted — first move its reusable logic/components somewhere COP-B09 can revive them (or record in that story exactly what was removed and where to find it in git history), then delete the page.',
      'Re-verify emptiness mechanically before deleting: for each candidate, grep the whole client/src tree for the component name and for the @/pages/<name> path, and confirm zero hits outside the file itself.',
      'Delete any components/hooks that become orphaned as a result and are referenced by nothing else.',
      'Update the ProtectedRoute.tsx doc comment that references LeadsManagement as an example.',
      'npm run check && npm run build && npm run lint pass, and the app boots with no missing-module errors.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / CLEANUP] ${SRC} Line counts at audit time: DealsManagement 2851, LeadsManagement 1733, customers 1419, TaskManagement 1072, BasicTaskManagement 855, TerritoryManagement 700, AITaskScheduling 629, my-tasks 464, TaskManagementPage 342 = 10,065. Tasks are served by TaskHub at /tasks. CAVEAT: the audit was static (read App.tsx + grep), so re-verify each file is truly unreachable before deleting.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E04',
    title: 'Collapse CRM URL sprawl to one canonical path per object',
    description:
      'As a user, I need one URL per CRM object, because /deals, /deals-management, /crm/deals, and /opportunities all render the same page today, so bookmarks, emailed links, and support docs all disagree with each other.',
    acceptanceCriteria: [
      'Canonical paths are /crm/deals, /crm/leads, /crm/contacts, /crm/companies. Each object has exactly ONE Route entry rendering its component.',
      'Every legacy path (/deals, /deals-management, /opportunities, /leads, /leads-management, /contacts, /customers, /crm) becomes a redirect to its canonical path — a redirect, not a second Route rendering the same component.',
      'Detail routes are made consistent with the index routes (e.g. /crm/deals/:id) with the old detail paths redirecting.',
      'Sidebar matchPatterns and any internal links (command palette, breadcrumbs, dashboard cards, notification deep links) are updated to the canonical paths.',
      'Redirects preserve query strings so shared filtered links keep working.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / IA] ${SRC} Audit evidence: App.tsx routes /deals, /deals-management, /crm/deals and /opportunities all to CrmDealsPage; /leads and /leads-management both to LeadsPage; /crm to CustomersPage. Sequence after COP-M01 so nav already points at the shell pages.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E05',
    title: 'Delete the duplicate ActivityTimeline component',
    description:
      'As a developer, I need one activity timeline component, because two exist (components/ActivityTimeline.tsx and components/ui/activity-timeline.tsx) and record pages pick between them arbitrarily, so the same events render differently on different screens.',
    acceptanceCriteria: [
      'Compare both implementations, choose the one with the better API/feature set, and fold any unique capability from the loser into the survivor.',
      'Repoint every consumer (LeadDetail.tsx, CustomerDetail.tsx, and any others) at the survivor and delete the other file.',
      'The survivor lives in one agreed location and is the component COP-B02 builds the deal timeline on.',
      'Timeline rendering on Lead and Customer detail is visually and functionally unchanged after the swap.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / CLEANUP] ${SRC} Blocks COP-B02, which needs a single canonical timeline to build the deal record on.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E07',
    title: 'Retire "Opportunities" from user-facing vocabulary — the object is a Deal',
    description:
      'As a user, I need one name for the sales object, because the sidebar says "Opportunities", the canonical model doc says the object is `deals`, and `opportunities` is a deprecated Salesforce-mirror table — three words for one thing.',
    acceptanceCriteria: [
      'All user-facing strings (nav labels, page titles, headings, buttons, empty states, toasts, table headers, command palette entries) say Deal/Deals.',
      "crm-object-registry.ts drops the 'opportunities' CrmObjectType from the user-facing union, or keeps it only as an explicitly-commented Salesforce-sync alias with no UI surface.",
      'The `opportunities` table and /api/opportunities/convert-to-deal remain intact as Salesforce sync staging (per docs/crm-canonical-model.md) — this story changes vocabulary and UI, not the sync bridge.',
      'Any help text, onboarding copy, or product tour referencing Opportunities is updated.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / VOCAB] ${SRC} docs/crm-canonical-model.md (CRMX-002) already ruled "deals" canonical and "opportunities" a deprecated SF-mirror; this makes the UI agree. Do NOT delete the opportunities table — it is sanctioned sync staging.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I04',
    title: 'Real empty states with a first action on every CRM surface',
    description:
      'As a new user, I need every empty CRM screen to tell me what to do next, because blank tables and empty boards give no path forward and make the product feel broken on day one.',
    acceptanceCriteria: [
      'Every CRM index (deals, leads, contacts, companies), the board views, and the record sub-panels (notes, tasks, activities, quotes) render a purposeful empty state instead of a bare table or "No data".',
      'Each empty state states what the object is, why it is empty, and offers a primary action (create, import, or connect) wired to the real flow.',
      'Empty states distinguish "nothing exists yet" from "your filters matched nothing" — the latter offers Clear filters, not Create.',
      'Empty states hook into the existing onboarding flow (CRMX-014) so first-run guidance and these CTAs agree rather than competing.',
      'Loading and error states are present and distinct from empty on every one of these surfaces (a spinner is not an empty state).',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 0 / UX] ${SRC} Cheap, high-perceived-quality, and it lands naturally alongside the nav repoint since reps will be seeing the shell pages for the first time.`,
    category: 'crm-copier-overhaul',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — One pipeline, one deal.
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'COP-E02',
    title: 'Retire the two non-canonical pipeline boards (Prospects, Sales Pipeline)',
    description:
      'As a sales rep, I need one pipeline board, because three ship in the sidebar at once — Prospects (business_records by status), Opportunities (deals by pipelineStages), and Sales Pipeline (a third stage model) — and I cannot tell where a deal actually lives.',
    acceptanceCriteria: [
      'The canonical board is CrmDealsPage/EnhancedPipelineBoard, driven by pipelineStages/pipelineTemplates via /api/pipeline-config.',
      'Audit ProspectsPage.tsx and SalesPipelineWorkflow.tsx for any capability the canonical board lacks and either port it or record it as an explicit, accepted loss in this story.',
      'Any prospect/pipeline data those boards moved through is reachable from the canonical board (via a saved view or a migration) — no records become invisible.',
      '/prospects and /sales-pipeline redirect to the canonical board with a preset saved view that reproduces the useful part of what each showed.',
      'Both nav entries are removed; the pages are deleted.',
      'npm run check && npm run build && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / PIPELINE] ${SRC} Audit evidence: ProspectsPage.tsx (677 lines) drags business_records by status; SalesPipelineWorkflow.tsx (872) uses a third stage model; only CrmDealsPage binds the canonical pipeline_config layer. Depends on COP-M01/COP-E04.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E03',
    title: 'Retire the legacy CRM index pages once shell parity is confirmed',
    description:
      'As a developer, I need the superseded index pages gone, because after COP-M01 repoints navigation, LeadsPage, Contacts.tsx, and CustomersPage are unreachable duplicates that still have to be maintained and still confuse search.',
    acceptanceCriteria: [
      'Parity is confirmed in a running environment first: every capability reps used on LeadsPage / Contacts.tsx / CustomersPage exists on the corresponding shell page, or is filed as an accepted gap with an owner.',
      'Delete client/src/pages/{LeadsPage,Contacts,CustomersPage}.tsx and any components orphaned by their removal.',
      'Detail pages (LeadDetail, CustomerDetail) are NOT deleted — they are separate records still in use.',
      'Any residual imports, routes, or nav matchPatterns referencing the deleted pages are cleaned up.',
      'npm run check && npm run build && npm run lint pass, and the app boots clean.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / CLEANUP] ${SRC} Hard dependency on COP-M01 landing AND being exercised — do not delete on the strength of a static read. Contacts.tsx also reads the standalone supabase-companies source, so check COP-E06 (model consolidation) does not need it first.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M03',
    title: 'Collapse Leads / Prospects / Customers into one nav entry with lifecycle saved views',
    description:
      'As a sales rep, I need one place to see accounts at any lifecycle stage, because Leads, Prospects, and Customers are three sidebar entries over ONE table (business_records, discriminated by status) — which hides the unified-record design and presents exactly the fragmented model HubSpot gets criticised for.',
    acceptanceCriteria: [
      'One nav entry (e.g. Companies, or Accounts) opens the business_records index with built-in saved views: All, Leads, Prospects, Customers, My accounts, Recently active.',
      'Lifecycle views are real saved views on the existing saved_views infrastructure, not hardcoded tabs, so users can add their own.',
      'Changing a record status moves it between views with no conversion step and no data loss, and that behaviour is visible in the UI (the record does not disappear).',
      'The separate Leads, Prospects, and Customers nav entries are removed; their paths redirect to the unified index with the matching view preselected.',
      'Deals and Contacts remain their own nav entries — this story unifies the ACCOUNT lifecycle only, not every object.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / IA] ${SRC} This is the story that turns the product's best CRM idea (zero-data-loss lifecycle on business_records) from a hidden implementation detail into a visible advantage. Depends on COP-M01 + COP-E04.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M07',
    title:
      'Standardize stage semantics on pipelineStages and remove remaining legacy dealStages reads',
    description:
      'As an admin, I need one stage model, because CRMX-005 bound the board to pipelineStages via a legacy_stage_id map but other surfaces (forecasting, reports, automations, the API) may still read deal_stages, leaving two sources of truth for what a stage means.',
    acceptanceCriteria: [
      'Inventory every read of deal_stages/dealStages across client, server, and edge functions, and record the result in the story.',
      'Every surface that needs stage config (name, order, probability, forecast weighting, SLA, closing/won flags) reads pipelineStages; deal_stages survives only as the identity map CRMX-005 established, if at all.',
      'Forecast math uses per-stage defaultProbability/weightedValue/includeInForecast rather than the free-text deals.probability column.',
      'Any remaining writer of deal_stages is either removed or documented as the sync-staging exception with a comment pointing at docs/crm-canonical-model.md.',
      'Existing deals do not orphan: verify stage resolution for every deal in a seeded tenant before and after.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / ARCH] ${SRC} Finishes what CRMX-005 started. Blocks COP-I06 (forecast accuracy), which needs one authoritative stage weighting.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B02',
    title: 'Rebuild the Deal record page — timeline, notes, tasks, quotes, equipment, next step',
    description:
      'As a sales rep, I need the deal page to be where I actually work the deal, because DealDetail.tsx is 238 lines of read-only fields with no timeline, notes, tasks, quotes, email, next step, or stage advance — while Lead and Customer detail are 2,287 and 2,935 lines.',
    acceptanceCriteria: [
      'The deal record is built on the record-layout engine (server/routes-record-layout.ts, CRM-008) so its layout is configurable like the other object types.',
      'A unified activity timeline shows notes, emails, calls, meetings, tasks, stage changes, and quote events in one chronological stream, sourced through the crm_associations layer (CRMX-006) and the single ActivityTimeline component from COP-E05.',
      'Inline creation from the record: add a note, log an activity, create a task, all without leaving the page and all appearing immediately in the timeline.',
      'Associated records are shown and navigable: contacts, the account, quotes/proposals, and (once COP-M05 lands) the equipment the deal places or replaces.',
      'The header carries stage with one-click advance (writing deal_stage_history and firing the pipelineStages triggers), amount, close date, owner, probability, and an explicit Next Step field.',
      'A right-hand panel is present and structured to receive the COP-B11 insights — rendering an honest empty state until then, never fabricated scores.',
      'Every read is tenant-scoped; every write validated with Zod.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / CORE] ${SRC} The single most important screen in the product and the biggest single build in Phase 1. Depends on COP-E05 (one timeline) and COP-M07 (one stage model); COP-M05 and COP-B11 extend it later.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M04',
    title: 'Extend the deals table with the copier-dealer fields the sales motion needs',
    description:
      'As a copier sales rep, I need the deal to carry the facts that decide a copier deal, because `deals` today is a generic B2B deal — no motion type, no forecast category, no incumbent vendor, no lease buyout exposure, no trade-in, no current print volume, no target CPC.',
    acceptanceCriteria: [
      'Add to `deals`: dealMotion (new_logo | fleet_refresh | lease_rollover | expansion | renewal | competitive_takeaway | service_only), forecastCategory (pipeline | best_case | commit | closed), incumbentVendor, leaseBuyoutExposure (decimal), tradeInValue (decimal), currentMonthlyVolumeBw + currentMonthlyVolumeColor (integer), targetCpcBlack + targetCpcColor (decimal 10,4 to match contracts), and replacesContractId.',
      'Migration generated with npm run db:generate (journal entry included — never hand-drop a .sql), reviewed, and committed with the schema change.',
      'CPC decimal precision matches contracts.blackRate/colorRate (10,4) so quote and contract math do not disagree.',
      'The fields surface on the deal record (COP-B02), are filterable/columnable in the deals index, and are available to the pipeline board card config.',
      'dealMotion and forecastCategory replace free-text usage of the existing dealType/probability columns where they overlap; the old columns are back-filled or explicitly kept with a documented reason.',
      'Every new field is optional at the API layer so existing deals remain valid; Zod schemas updated.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / SCHEMA] ${SRC} Foundation for COP-B04/B05/B06/B10 and COP-I06. Raw material already exists elsewhere and should be reused, not reinvented: business_records.competitorName/mainCompetitors, leases.buyoutAmount + buyout type enums, contracts.blackRate/colorRate.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M05',
    title: 'Associate deals with installed-base equipment (the serials a deal places or replaces)',
    description:
      'As a copier sales rep, I need a deal to know which machines it replaces and which it places, because today `deals` has no link to `equipment` at all — so the system cannot tell what fleet a deal is actually about.',
    acceptanceCriteria: [
      "Deal↔equipment links use the existing crm_associations layer (CRMX-006) with an explicit role on each link — 'replaces' vs 'places' — rather than a new bespoke join table.",
      "'equipment' is added to CRM_ASSOCIABLE_TYPES and the API-layer validation that guards those values.",
      "API: attach/detach equipment to a deal, and list a deal's associated equipment with the fields a rep needs (serial, model, manufacturer, install date, lease expiry, meter type, location).",
      "The deal record (COP-B02) shows an Equipment section listing associated machines with their current meters and contract rates, and lets a rep attach from the account's installed base in one step.",
      'Attaching equipment that carries a lease or contract populates the COP-M04 fields (leaseBuyoutExposure, replacesContractId, current volumes) rather than making the rep retype them.',
      'All queries tenant-scoped; associations survive the account lifecycle (lead→customer) without re-linking.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 1 / SCHEMA] ${SRC} This is the join that makes the whole Phase 3 copier wedge possible — COP-B04/B05/B06 all depend on it. Depends on COP-M04.`,
    category: 'crm-copier-overhaul',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — The rep's day.
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'COP-B01',
    title: 'Sales Workspace — the rep\'s "My Day" home screen',
    description:
      'As a sales rep, I need one screen that tells me what to do today, because there is no work surface at all — SalesCommandCenter is a forecast analytics dashboard, so reps have to go hunting across pages to assemble their own day.',
    acceptanceCriteria: [
      'A new /crm/my-day workspace is the default landing page for sales roles, composed of cards: Overdue tasks, Due today, Stalled deals (no activity in N days / past stage SLA), Meetings needing follow-up, Quotes awaiting signature, and Suggested tasks (COP-B03).',
      'Cards are user-customizable — show/hide and reorder — with the layout persisted per user.',
      'Every card is actionable in place: complete a task, log an activity, open the record, or snooze — without navigating away.',
      'Every number is derived from real tenant data with an honest empty state; no mock fallbacks (see COP-I07).',
      'The workspace loads in under 1s at realistic data volumes and degrades gracefully card-by-card if one query is slow or fails.',
      'Role-aware: managers additionally see team roll-up cards; the card set respects RBAC scope (view_own vs view_team).',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / CORE] ${SRC} Mirrors HubSpot's Sales Workspace (forced migration 27 Apr 2026) — the shape worth copying: one home that tells the rep what to do next. Pairs with COP-B03. Do not replace SalesCommandCenter's forecast analytics; this is a different surface for a different job.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B03',
    title:
      'Suggested Tasks engine — ranked next actions from real signals, auto-expiring when stale',
    description:
      'As a sales rep, I need the system to tell me which accounts need attention today, because nothing surfaces the signals the database already holds — stalled deals, breached stage SLAs, expiring quotes, lease windows, meter anomalies, ticket spikes.',
    acceptanceCriteria: [
      'Suggestions are generated on the existing workflow runtime (workflow-execution-service.ts + workflow-runtime.ts) via dispatchWorkflowEvent — no new parallel scheduler.',
      'Signal set at minimum: no activity on an open deal in N days; deal past its pipelineStages SLA; quote expiring within N days; lease/contract inside the COP-B04 window; meter volume materially over contracted tier; service ticket spike on a customer machine.',
      'Each suggestion carries the record, the reason in plain language, the suggested action, and a score used for ranking.',
      'Suggestions AUTO-EXPIRE when the underlying condition clears (the rep logged the activity, the quote was signed) — a stale suggestion must never linger.',
      'Admins can enable/disable each suggestion type per tenant and set its threshold; the whole engine respects the workflow kill switch.',
      'Suggestions render on the COP-B01 workspace and are dismissible with the dismissal recorded.',
      'Generation is idempotent — re-running a sweep does not duplicate suggestions (reuse the dedupeKey pattern).',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / AUTOMATION] ${SRC} HubSpot renamed Guided Actions to Suggested Tasks in 2026 specifically to add auto-expiry — copy that behaviour, it is the part that makes the feature trustworthy. The durable runtime already exists; this is a signal library plus ranking on top of it.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B07',
    title: 'Finish 1:1 sales email — real OAuth, inbox sync, send, and open/click tracking',
    description:
      "As a sales rep, I need to send and track individual emails from inside a record, because Email Autopilot generates real drafts but its OAuth, inbox fetch, send, and provider-draft calls are all stubbed — so the rep's most-used tool produces nothing, and sequences are a runtime with no output.",
    acceptanceCriteria: [
      'Real Gmail and Outlook OAuth with tokens stored in the shared credential vault (replacing the base64 obfuscation the route file flags as TODO(vault)) — never returned to the client, only *_set booleans.',
      "Real inbox sync replaces the stubbed message list; real send replaces createProviderDraft()'s fake external id.",
      'Open and click tracking recorded per message and attributed to the contact and deal.',
      'Every sent and received message is logged to the unified activity timeline via crm_associations, so it appears on the deal (COP-B02), contact, and account.',
      "buildVoiceFingerprint() derives from the rep's real sent mail rather than injected samples, or is removed if that is out of scope.",
      'Sequences (CRMX-009) send through this path — verify an enrolled contact actually receives a real message.',
      'Send is gated by an explicit permission and respects unsubscribe/suppression state; scopes requested are the minimum needed.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / ENGAGEMENT] ${SRC} Supersedes CRMX-010 — mark that story as folded into this one. Audit evidence: routes-email-autopilot.ts documents its own stubs at lines 35-51 (OAuth, inbox, voice fingerprint, createProviderDraft). Marketing email via SendGrid is already real and is a separate path — do not conflate them.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I01',
    title: 'Speed floor for daily CRM surfaces — sub-second board and table at 5,000 records',
    description:
      "As a sales rep, I need CRM lists and boards to feel instant, because a CRM reps love is a CRM that never makes them wait, and today's indexes are not held to any performance bar.",
    acceptanceCriteria: [
      'Board and table views render in under 1s at 5,000 records in a tenant, measured and recorded as a repeatable benchmark.',
      'Every long list is virtualized (reuse VirtualizedDataTable where it fits).',
      'Drag-to-change-stage is optimistic with rollback on failure — the card never waits on the round trip.',
      'Server-side pagination, filtering, and sorting on every CRM index endpoint; the client never downloads a whole object type to filter locally.',
      'Supporting DB indexes exist for the actual filter/sort combinations the saved views use (tenant-scoped composite indexes).',
      'A regression guard exists so the benchmark is re-run rather than trusted — document how to run it.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / PERF] ${SRC} Speed is the single most-cited reason reps abandon a CRM; this is a product requirement, not an optimization pass.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I02',
    title: 'Keyboard-first CRM — command palette actions and list navigation',
    description:
      'As a power user, I need to drive the CRM from the keyboard, because the command palette exists but only navigates, so every create, edit, and log action still costs a mouse trip.',
    acceptanceCriteria: [
      'The command palette gains ACTIONS as well as destinations: create deal/lead/contact/company/task/note, log activity, send email, and search-and-open a record by name, serial, or quote number.',
      'The palette opens on the standard shortcut from every CRM screen and is reachable on all supported platforms.',
      'j/k (or arrow) navigation moves the selection through list rows and board cards; Enter opens; Escape clears.',
      'Single-key shortcuts on a record for the frequent actions (note, task, email, log call), with a discoverable shortcuts dialog listing them all.',
      'Every shortcut is keyboard-accessible with a visible focus state and does not trap focus or fire while typing in an input.',
      'Shortcuts respect RBAC — a palette action the user lacks permission for is not offered.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / UX] ${SRC} components/layout/command-palette.tsx already exists and is wired in main-layout.tsx — this extends it rather than building new. keyboard-shortcuts-dialog.tsx exists too.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I05',
    title: 'Global search ranked by relevance, with serial and contract number lookup',
    description:
      'As a copier rep, I need to find a record by whatever I have in hand, because I search by serial number and contract number constantly and search does not know about either.',
    acceptanceCriteria: [
      'Search covers equipment serial numbers, asset tags, contract numbers, and quote numbers in addition to deals, contacts, companies, and leads.',
      'A serial or contract number match resolves to the owning account and shows the machine/contract inline so the rep can jump straight to the right record.',
      'Results are ranked by relevance plus recency and ownership (my records first), not returned in arbitrary table order.',
      'Results are grouped by object type with the type visible on each row.',
      'Search stays tenant-scoped in every branch, including the new equipment and contract lookups.',
      'Search is reachable from the command palette (COP-I02) and returns first results in under 300ms at realistic volumes.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 2 / UX] ${SRC} Builds on the ranked full-text search from CRMX-013 — this adds the copier-specific identifiers, which is the part reps actually type.`,
    category: 'crm-copier-overhaul',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — The copier wedge. This is the phase that wins deals.
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'COP-B04',
    title:
      'Installed-Base Opportunity Radar — turn equipment, contracts, and meters into ranked pipeline',
    description:
      "As a copier sales rep, I need the system to hand me today's best opportunities out of our own installed base, because every lease expiry, contract end, meter overage, and service-cost spike is already a dated, quantified sales trigger sitting in the database — and today it drives no pipeline at all.",
    acceptanceCriteria: [
      'A scheduled scan over equipment, contracts, leases, meter_readings, and service history produces ranked "plays", each with: the account, the machines, the trigger, the date it becomes live, and an estimated dollar value.',
      'Play types at minimum: lease expiring within a configurable window; service contract ending; volume materially over the contracted tier; machine past a service-cost/margin threshold; color-capable device with negligible color usage; device off-network or not reporting meters.',
      'Each play one-clicks into a deal pre-populated with the COP-M04 fields and the COP-M05 equipment associations — the rep never retypes what the system knows.',
      "Plays are ranked by value and urgency, scoped to the rep's territory/ownership (COP-B09) and RBAC scope, and surfaced on the COP-B01 workspace.",
      'Windows and thresholds are per-tenant configurable; the scan runs on the existing workflow runtime and honours the kill switch.',
      'Dismissing or converting a play records the outcome so play-to-deal and play-to-won conversion can be reported later.',
      'The scan is idempotent — re-running does not duplicate plays for the same trigger.',
      'Every query tenant-scoped; the scan is chunked so a large installed base does not block.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} THE differentiating story in this backlog — a general CRM structurally cannot build it because it does not know what is in the customer's copier room. Audit evidence: equipment.leaseExpiresDate is rendered in exactly ONE place today (CustomerEquipment.tsx:345, a badge) and generates zero pipeline. Depends on COP-M04 + COP-M05. Overlaps the existing renewal auto-quote generator (US-SUPER-010) — reuse its T12-actuals and CPC re-tiering logic rather than duplicating it, and see COP-M06.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B05',
    title: 'Fleet Assessment / TCO builder — cost the current fleet, model the proposed one',
    description:
      'As a copier sales rep, I need to show a prospect what their current fleet really costs and what ours would cost instead, because the fleet assessment is the core copier sales motion and today it is done by hand outside the system.',
    acceptanceCriteria: [
      "Assessment pulls the account's current fleet from equipment, its actual volumes from meter_readings, and its actual rates from contracts/contract_tiered_rates — no manual re-entry of data the system holds.",
      'Computes current-state true cost per page and total monthly/annual spend, including base charges, click charges by tier, and (where known) supplies and service cost.',
      'A proposed fleet is modelled against the same volumes, producing a side-by-side current-vs-proposed comparison with the delta stated in dollars per month and over the term.',
      'The calculation engine reuses print-cost-calculator-service.ts rather than introducing a third cost model; if the shared Deno copy is touched, both stay in sync (per CLAUDE.md).',
      'The assessment attaches to the deal, appears on its timeline, and feeds COP-B06 so the quote inherits the modelled fleet.',
      'Output is presentable to a customer — an exportable/printable summary, not just an internal screen.',
      'Machines with missing meters or unknown rates are shown as explicit gaps, never silently defaulted to zero or a guessed rate.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} Depends on COP-M05. The honest-gaps criterion matters: a TCO story built on silently-defaulted rates is worse than no TCO story, because the rep will be corrected in front of the customer.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B06',
    title: 'Installed-base-aware Quote Builder — "start from the customer\'s fleet"',
    description:
      'As a copier sales rep, I need to start a quote from what the customer already runs, because Quote Builder is catalog-only — its "equipment" means product_models (what we sell), not equipment (what they have) — so I retype fleet, volumes, and current rates the system already knows.',
    acceptanceCriteria: [
      "Quote Builder offers \"Start from customer's fleet\": pre-loads the account's machines with their trailing volumes and current CPC as the quote's starting context.",
      "A replacement line carries the serial it displaces (via COP-M05) and surfaces that machine's remaining lease term and buyout exposure on the line.",
      'Total buyout exposure across the quote rolls up and is visible to the rep before send — a copier deal is routinely won or lost on this number.',
      'A COP-B05 fleet assessment can be pulled into the quote so the savings story and the quote agree line-for-line.',
      'Existing quote math is not forked: recurring/one-time bucketing, per-line dollar discounts, effective-discount guardrails and margin floors in shared/quote-math.ts continue to govern, and the Deno proposals copy stays in sync.',
      'A quote with no fleet context behaves exactly as today — this is additive, not a rewrite of the wizard.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} Audit evidence: LineItemManager.tsx maps 'equipment' to product_models; nothing in the quote-builder tree reads the equipment table. Depends on COP-M05 (+ COP-B05 for the assessment hand-off). Respect the QUOTE-016/017/019/020 invariants documented in CLAUDE.md.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-M06',
    title: 'Land renewal auto-quote drafts as deals in the pipeline',
    description:
      'As a sales rep, I need renewals to show up where I work, because the renewal auto-quote generator produces good drafts on its own page outside the pipeline — and reps do not work there, so the drafts go unseen.',
    acceptanceCriteria: [
      'Each generated renewal draft creates (or updates) a deal with dealMotion = renewal, the contract linked via replacesContractId, and the associated equipment attached.',
      'Renewal deals appear on the canonical board in an appropriate stage and are visible in the normal pipeline and forecast, not a parallel list.',
      'The rep approval gate is preserved — nothing is auto-sent to a customer; generating a deal is not sending a quote.',
      'The generator stays idempotent: regenerating for the same contract updates the existing deal rather than creating duplicates.',
      'Existing outcome tracking (pending/won/lost, auto vs manual win-rate comparison) keeps working now that outcomes flow through deals.',
      'Suppressed customers (renewal_suppressions, "manual renewal only") produce no deal.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} Builds on US-SUPER-010 (renewal_auto_quotes, renewal_autoquote_settings, renewal_suppressions). Coordinate with COP-B04 so a lease/contract-end play and a renewal draft do not both create a deal for the same contract.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B09',
    title: 'Revive territory management — territories over accounts and installed base',
    description:
      'As a sales manager, I need territories that actually scope the CRM, because copier sales is territory-run, the sales_territories schema exists, and the 700-line management page is unrouted dead code.',
    acceptanceCriteria: [
      'Territory definition and assignment UI is restored on the existing sales_territories schema (lead-assignment-schema.ts), reusing whatever COP-E01 preserved from TerritoryManagement.tsx.',
      'Accounts, deals, and installed-base equipment resolve to a territory, and territory is available as a filter and a saved-view dimension on every CRM index.',
      'Reps see their territory by default; managers can switch or roll up across territories, consistent with the hierarchical RBAC scope.',
      'The COP-B04 Opportunity Radar is territory-scoped so reps get their own plays.',
      'Quotas/goals can be set and reported per territory (feeding COP-I06).',
      'Territory changes reassign cleanly without orphaning records, and the change is auditable.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} Hard sequencing note: COP-E01 must preserve the reusable parts of TerritoryManagement.tsx before deleting it, or this story restarts from scratch.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B10',
    title: 'Competitive knockout intelligence — surface the competitor data we already capture',
    description:
      'As a copier sales rep, I need to know who I am up against and what beats them, because competitorName, mainCompetitors, and churnReason=competitor_switch are captured today and surfaced in no selling motion at all.',
    acceptanceCriteria: [
      'A competitive card on the deal record shows the incumbent/competing vendor (COP-M04 incumbentVendor plus the business_records fields) and any prior competitor history on the account.',
      'Per-competitor battlecards are authorable by admins and render in-context on the deal — positioning, common objections, and where we win.',
      'Win/loss reporting by competitor, using deals.lostReason and the churn reason data, with enough volume handling to be useful rather than anecdotal.',
      'Accounts lost to a competitor (churnReason = competitor_switch) are identifiable as takeaway targets and can feed a COP-B04 play.',
      'Competitor fields are consistent across business_records and deals — one vocabulary, not two free-text columns that drift.',
      'Honest empty states where there is not yet enough win/loss data to report; no fabricated win rates.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 3 / WEDGE] ${SRC} Audit evidence: business_records.competitorName (schema.ts:1416), mainCompetitors (:1616), churnReason including competitor_switch (:1413). Depends on COP-M04.`,
    category: 'crm-copier-overhaul',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4 — Intelligence and reach.
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'COP-B08',
    title: 'Call logging and click-to-call, with an optional recording/transcription path',
    description:
      'As a copier sales rep, I need calls logged from inside the CRM, because copier sales is still a phone business and the product has no telephony, call logging, or conversation intelligence of any kind.',
    acceptanceCriteria: [
      'Click-to-call from a contact, deal, or account, with the call logged to the unified timeline on completion.',
      'Manual call logging with outcome, duration, and notes for calls placed outside the system.',
      'Call activity counts toward the activity-recency signals used by COP-B03 and COP-B11.',
      'Optional recording and transcription reuses the existing meeting-transcription stack rather than a second pipeline.',
      'Recording is off by default, per-tenant opt-in, with consent handling and retention configurable — do not ship recording as an on-by-default behaviour.',
      'Provider credentials stored in the credential vault; never returned to the client.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / ENGAGEMENT] ${SRC} Consent/retention is a legal requirement in two-party-consent jurisdictions, not a nice-to-have — hence opt-in by default.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B11',
    title: 'Deal insights panel — real deal score and AI summary over actual interaction history',
    description:
      'As a sales rep, I need a read on where a deal stands, because the deal record has no insights panel and nothing summarises what has happened or flags what is at risk.',
    acceptanceCriteria: [
      'An AI summary of the deal derived from its REAL interaction history (notes, emails, calls, meetings, stage changes, quotes) via the crm_associations timeline.',
      'A deal score computed from explicit, inspectable signals — activity recency, stage age vs. SLA, contact/committee coverage, quote margin, competitor present, buyout exposure — with the contributing factors shown, not a black-box number.',
      'Risk flags call out concrete conditions (single-threaded, gone quiet, past close date, discount over policy) in plain language.',
      'Where signal is insufficient, the panel says so and shows nothing — no fabricated score, no mock data (see COP-I07).',
      'The panel renders in the slot COP-B02 created on the deal record.',
      'Summaries regenerate on meaningful change rather than on every render, and the cost/latency of generation is bounded.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / AI] ${SRC} Mirrors HubSpot's Deal Insights / Breeze summary panel. Depends on COP-B02 (slot + timeline) and benefits from COP-B07 (email in the timeline). CRMX-001 already established the house rule: real data or an honest empty state, never mock.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B12',
    title:
      'Wire meetings into deals — transcripts on the timeline, action items as tasks, cited field updates',
    description:
      'As a sales rep, I need my meetings to update the CRM for me, because MeetingTranscription and MeetingToProposalDashboard exist but are disconnected from deals and filed under Productivity, so the transcript never reaches the record.',
    acceptanceCriteria: [
      "A meeting associates to a deal/contact/account and its transcript and summary appear on that record's unified timeline.",
      'Action items detected in a meeting are drafted as tasks against the right record, for the rep to confirm rather than auto-committed.',
      'Proposed CRM field updates (close date, next step, amount, competitor, stage) are surfaced WITH the transcript citation that justifies each one, and require rep confirmation before writing.',
      "A pre-meeting briefing card assembles the account's recent activity, open deals, installed base, and service state.",
      'Nothing writes to the record without a human accept — citation-backed suggestion, not silent mutation.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / AI] ${SRC} Equivalent of HubSpot's Smart Sales Meetings + Smart Deal Progression. Mostly a connector: the transcription stack already exists. COP-M02 moves the nav entry into Sell.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B13',
    title: 'Copier sales playbooks — guided discovery rendered inside the record',
    description:
      'As a new copier rep, I need the discovery questions in front of me while I am on the call, because the industry motion (fleet walk, volume qualification, lease-position discovery, committee mapping) is tribal knowledge with no support in the product.',
    acceptanceCriteria: [
      'Admins author playbooks with structured questions; playbooks render in-context on the deal, contact, or account record.',
      'Starter playbooks ship for the core copier motions: fleet walk, volume/workflow qualification, lease position and buyout discovery, and decision-committee mapping.',
      'Answers write back to real fields where one exists (COP-M04 fields, contacts, equipment associations) rather than being trapped in free text.',
      'Playbook completion is visible on the record and can gate or inform stage advance where an admin configures it.',
      'Playbooks can be triggered by stage entry via the pipelineStages automation triggers.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / ENABLEMENT] ${SRC} The write-back criterion is what separates this from a notes template — it is how discovery becomes data the radar and forecast can use.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-B14',
    title: 'Public meeting booking pages (prospect self-scheduling)',
    description:
      'As a prospect, I want to book a meeting from a public link, because scheduling today is internal-facing only — the Google/Outlook/iCloud sync is real but there is no prospect-facing booking page.',
    acceptanceCriteria: [
      'Per-rep and per-team public booking pages with configurable meeting types, durations, buffers, and availability windows.',
      'Availability is computed from the existing real calendar sync so double-booking is impossible.',
      'A booking creates the meeting, the contact (if new), and the timeline entry on the right record automatically.',
      'The booking page is unauthenticated and safe: no tenant data leaks beyond what the page must show, rate-limited, and bot-resistant.',
      'Booking links are shareable from a record and from sequences/email.',
      'Reschedule and cancel work from the same link, and confirmation/reminder emails send.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / ENGAGEMENT] ${SRC} Supersedes CRMX-016. Follow the public-calculator precedent for unauthenticated edge functions: the Coolify dispatcher enforces auth per-handler and ignores config.toml verify_jwt, so "public" means the handler never calls auth.getUser.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-E06',
    title: 'Consolidate the duplicate contact and company models onto the canonical tables',
    description:
      'As a user, I need every screen to show the same contact and company data, because enhancedContacts, customerContacts, leadContacts, and the standalone companies table still coexist with the canonical companyContacts and business_records — so a record looks different depending on which page opened it.',
    acceptanceCriteria: [
      'Fold the genuinely useful fields from enhancedContacts (isDecisionMaker, contactLevel, contactRole, leadSource) onto companyContacts and repoint the Salesforce sync/dedup/GDPR/CSV services at it.',
      'Migrate customerContacts and leadContacts rows into companyContacts and drop both tables.',
      'Fold the columns companies holds that business_records lacks (parentBusiness, numberOfLocations, SIC code) onto business_records, repoint all reads including the supabase-companies reads, keep companies read-only for one release, then drop it.',
      'No page reads a deprecated table after cutover — verify by grep across client, server, and edge functions.',
      'Migration is reversible and validated: backup first, then row-count and spot-check association validation before and after each step.',
      'Migrations are generated via npm run db:generate so the journal stays intact; npm run check:migrations passes.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / ARCH] ${SRC} This is CRMX-007 — carried forward unchanged; mark that story as folded into this one. Highest-risk consolidation in the CRM (companies is referenced by ~58 files) which is why it sits in Phase 4 behind the surface work, per docs/crm-canonical-model.md.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I03',
    title: 'One hardened mobile rep experience (first slice of the three-app consolidation)',
    description:
      'As a mobile rep, I need one polished app, because three parallel mobile implementations exist (mobile/, mobile-app/, ios/) and none is production-hardened.',
    acceptanceCriteria: [
      'One implementation is chosen as canonical and the decision is recorded with its rationale; the others are frozen (no new features) pending removal.',
      'The canonical app covers the rep core: pipeline board, record view, notes, tasks, click-to-call, and meter photo capture.',
      'Offline-tolerant for the field: reads cached, writes queued and reconciled rather than lost.',
      'Auth, tenant scoping, and RBAC behave identically to web — no mobile-only shortcut around tenant isolation.',
      'Touch targets meet the 48px floor and the layout follows the mobile-first breakpoints already established.',
      'This story delivers the rep slice only; field-service consolidation is explicitly out of scope and tracked separately.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / MOBILE] ${SRC} First slice of CRMX-018 (largest single effort in the CRM backlog, which is why it is scoped down to the rep experience here). Meter photo capture ties to the meter-read vision schema.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I06',
    title: 'Forecast accuracy — categories, roll-up, and commit-vs-actual history',
    description:
      'As a sales manager, I need a forecast I can defend, because forecasting runs off free-text probability rather than the stage config, and there is no forecast category or commit-vs-actual history.',
    acceptanceCriteria: [
      'Forecast category (COP-M04 forecastCategory) is settable on a deal and drives the forecast, replacing reliance on the free-text probability column.',
      'Forecast weighting comes from pipelineStages (defaultProbability, weightedValue, includeInForecast) per COP-M07 — one authoritative source.',
      'Roll-up by rep, team, and territory (COP-B09), respecting the hierarchical RBAC scope.',
      'Commit-vs-actual history is captured per period so forecast accuracy can be measured over time rather than asserted.',
      'Copier-specific split: one-time equipment revenue vs. recurring CPC/service revenue are forecast separately as well as combined, consistent with the quote-math recurring/one-time buckets.',
      'Every number traces to real deals with an honest empty state for periods with no history.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / REPORTING] ${SRC} Depends on COP-M04 + COP-M07. The recurring/one-time split matters commercially: a copier forecast that blends box revenue with CPC streams is not decision-grade.`,
    category: 'crm-copier-overhaul',
  },
  {
    id: 'COP-I07',
    title: 'Purge mock-data fallbacks from every CRM dashboard',
    description:
      'As a manager, I need to trust the numbers, because several CRM and analytics pages use the `|| mockData` fallback pattern — so when an endpoint returns the wrong shape or nothing, the page silently renders fabricated numbers instead of failing visibly.',
    acceptanceCriteria: [
      'Every CRM, sales, and pipeline dashboard is audited for `|| mock`/`|| [...]` fallbacks and the findings listed in the story.',
      'Each one is resolved by fixing the data contract so real data flows, or by rendering an honest empty/error state — never by keeping the fabricated fallback.',
      'Data-contract mismatches found during the audit (flat-vs-nested response shapes) are fixed at the endpoint or the type, not papered over with a cast.',
      'Where a page is genuinely not backed by data yet, it says so plainly instead of showing plausible fake numbers.',
      'A guard (lint rule, test, or CI grep) prevents the pattern being reintroduced on these pages.',
      'npm run check && npm run lint pass.',
    ],
    priority: 1,
    passes: false,
    notes: `[PHASE 4 / TRUST] ${SRC} Extends CRMX-001 (which established the rule) to the surfaces this overhaul touches. CLAUDE.md batches 9 and 12 document the exact failure mode: PlatformAnalytics.tsx reads flat keys while the edge fn returns a nested shape, so the page silently shows mock data.`,
    category: 'crm-copier-overhaul',
  },
];

// ── Merge ───────────────────────────────────────────────────────────────
const prd = JSON.parse(fs.readFileSync(PRD, 'utf8'));

const existing = new Set(prd.userStories.map((s) => s.id));
const dupes = stories.filter((s) => existing.has(s.id));
if (dupes.length) {
  console.error('Refusing to run — these ids already exist:', dupes.map((s) => s.id).join(', '));
  process.exit(1);
}

const seen = new Set();
for (const s of stories) {
  if (seen.has(s.id)) {
    console.error('Duplicate id within this batch:', s.id);
    process.exit(1);
  }
  seen.add(s.id);
  for (const k of [
    'id',
    'title',
    'description',
    'acceptanceCriteria',
    'priority',
    'passes',
    'notes',
    'category',
  ]) {
    if (s[k] === undefined) {
      console.error(`Story ${s.id} is missing required field: ${k}`);
      process.exit(1);
    }
  }
}

prd.userStories.push(...stories);
fs.writeFileSync(PRD, JSON.stringify(prd, null, 2) + '\n');

console.log(`Appended ${stories.length} stories. userStories: ${prd.userStories.length}`);
console.log(`Open stories now: ${prd.userStories.filter((s) => s.passes !== true).length}`);

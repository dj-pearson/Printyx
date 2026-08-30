# The Copier CRM Overhaul

**Status:** Strategy + backlog · **Date:** 2026-08-10 · **Branch:** `claude/copier-crm-overhaul-3myzdo`
**Scope:** Analysis and roadmap. This document changes no runtime behavior.

---

## The diagnosis in one paragraph

Printyx does not have a CRM feature problem. It has a **CRM composition problem**. Nearly every
part a HubSpot-class CRM needs is already built and, in several places, better than HubSpot's
equivalent for this industry — but the parts were built in separate campaigns, wired to separate
navigation entries, and never composed into one motion a salesperson can live inside. The
strongest surface in the codebase (`CrmIndexShell` with saved views, board/table toggle, inline
edit, bulk ops) is **not reachable from the sidebar for leads, contacts, or companies**. The object
reps live in — the Deal — has a **238-line read-only detail page** while Lead and Customer have
2,287 and 2,935. And the thing that would actually differentiate Printyx from HubSpot — that the
system already knows every machine, meter, contract rate, and lease expiry in the customer's
building — is **connected to nothing on the sales side**. The overhaul is therefore three moves:
**collapse the surfaces**, **finish the rep's day**, and **wire the copier layer into the pipeline**.

---

## Part 1 — What is actually built (and is good)

Confirmed by reading the code, not the docs. These are assets to lead with, not rebuild.

| Asset                            | Where                                                                                          | Why it matters                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified lead→customer record     | `business_records` (`shared/schema.ts:1257`)                                                   | Status drives lifecycle; conversion preserves all history. HubSpot splits Lead/Contact/Company and loses context on conversion. This is a genuine advantage.                                    |
| Unified CRM index shell          | `client/src/components/crm/CrmIndexShell.tsx` (645 lines)                                      | Saved view tabs, table/board toggle, search, advanced filters, column picker, bulk ops, inline edit. This is HubSpot's index experience.                                                        |
| Pipeline board on real config    | `EnhancedPipelineBoard.tsx` → `/api/pipeline-config/*`                                         | Bound to `pipelineStages`/`pipelineTemplates` with SLAs, forecast weighting, and `on_enter`/`on_exit`/`on_sla_breach` triggers. CRMX-005 landed.                                                |
| Workflow execution runtime       | `server/services/workflow-execution-service.ts` + `workflow-runtime.ts`                        | Durable, DB-persisted, idempotent, resumable, with a kill switch. This is genuinely HubSpot-grade automation infrastructure.                                                                    |
| Custom fields framework          | `shared/custom-fields-schema.ts` (CRMX-003/004)                                                | Definitions + render in forms, lists, filters.                                                                                                                                                  |
| Notes + polymorphic associations | `shared/crm-associations-schema.ts` (CRMX-006)                                                 | `crm_notes` and `crm_associations` let any record attach to any record. The hard primitive is done.                                                                                             |
| Quote engine                     | `shared/quote-math.ts`, `quote-builder/`, deal desk                                            | Recurring vs one-time buckets, per-line dollar discounts, effective-discount guardrails, margin floors, approval routing, versioning, e-sign. **Better than HubSpot Quotes for this industry.** |
| Copier data model                | `equipment`, `contracts` + `contract_tiered_rates`, `meter_readings`, `leases`, `contract_pnl` | Serial, model, install date, meter type, lease expiry, warranty, per-click black/color rates, volume tiers, buyout types. Nobody else's CRM has this.                                           |
| Renewal auto-quote               | `shared/renewal-autoquote-schema.ts` (US-SUPER-010)                                            | Finds contracts ending in ~90 days, computes T12 actuals, re-tiers CPC, drafts a quote. Rep keeps the approval gate.                                                                            |
| Meeting intelligence             | `MeetingTranscription.tsx`, `MeetingToProposalDashboard.tsx`                                   | Maps directly onto HubSpot's 2026 "Smart Sales Meetings" — but filed under _Productivity_, not Sales.                                                                                           |
| Command palette                  | `components/layout/command-palette.tsx`, wired in `main-layout.tsx`                            | Global keyboard entry point already exists.                                                                                                                                                     |

---

## Part 2 — Where the flow breaks

### 2.1 Three parallel pipeline boards

A rep cannot answer "where does my deal live?"

| Surface                                | Component                                    | Backing data                             |
| -------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| **Prospects** (`/prospects`)           | `ProspectsPage.tsx` (677)                    | `business_records` dragged by **status** |
| **Opportunities** (`/opportunities`)   | `CrmDealsPage.tsx` → `EnhancedPipelineBoard` | `deals` dragged by **`pipelineStages`**  |
| **Sales Pipeline** (`/sales-pipeline`) | `SalesPipelineWorkflow.tsx` (872)            | a third stage model                      |

All three are in the Sales Hub sidebar simultaneously. Only the middle one is canonical.

### 2.2 The best surface is invisible

`CrmIndexShell` was built for four object types. Only one is in the navigation.

| Object    | Shell page (exists, routed)                              | What the sidebar actually points at                           |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Deals     | `/crm/deals`, `/opportunities` → `CrmDealsPage`          | ✅ `/opportunities`                                           |
| Leads     | `/crm/leads` → `CrmLeadsPage` (261 lines, shell-based)   | ❌ `/leads-management` → `LeadsPage` (661 lines, hand-rolled) |
| Contacts  | `/crm/contacts` → `CrmContactsPage` (176, shell-based)   | ❌ `/contacts` → `Contacts.tsx` (1,959, hand-rolled)          |
| Companies | `/crm/companies` → `CrmCompaniesPage` (174, shell-based) | ❌ `/customers` → `CustomersPage` (877, hand-rolled)          |

Three CRM-001..010 stories shipped a saved-views experience that **most users will never see**.

### 2.3 One table, three sidebar entries

Leads, Prospects, and Customers are three navigation items over **one table** (`business_records`,
discriminated by `status`). The unified-record advantage is the product's best CRM idea and the
navigation actively hides it — it presents exactly the fragmented model HubSpot is criticized for.

### 2.4 Vocabulary collision

The sidebar says **Opportunities**. The canonical model doc says the deal object is `deals` and
that `opportunities` is a _deprecated Salesforce-mirror table_. Reps, admins, and the schema are
using three different words for the same thing.

### 2.5 URL sprawl

`/deals`, `/deals-management`, `/crm/deals`, and `/opportunities` all render `CrmDealsPage`.
`/leads` and `/leads-management` both render `LeadsPage`. `/crm` renders `CustomersPage`.
Bookmarks, links in emails, and support docs all disagree.

### 2.6 The Deal detail page is a dead end

`DealDetail.tsx` is **238 lines of read-only fields**. No timeline, no notes, no tasks, no
associated quotes, no email, no next step, no stage advance, no equipment. Compare
`LeadDetail.tsx` (2,287) and `CustomerDetail.tsx` (2,935). The single screen a copier rep spends
their day on is the least built screen in the CRM.

### 2.7 Sales Hub navigation is a flat dump

17 children in one ungrouped list, mixing objects (Leads, Prospects, Customers, Contacts,
Opportunities), tools (Deal Desk, Quotes & Proposals, Proposal Templates, Proposal Branding),
dashboards (Sales Command Center), and **settings** (Custom Fields). Meanwhile Meeting
Transcription — a core selling tool — sits under _Productivity_.

### 2.8 ~10,000 lines of dead CRM code

Not routed anywhere in `App.tsx`:

`DealsManagement` (2,851) · `LeadsManagement` (1,733) · `customers` (1,419) ·
`TaskManagement` (1,072) · `BasicTaskManagement` (855) · `TerritoryManagement` (700) ·
`AITaskScheduling` (629) · `my-tasks` (464) · `TaskManagementPage` (342) — **10,065 lines.**

Every one of them is a maintenance tax, a search-result false positive, and a source of "which
page is the real one?" confusion for anyone new to the codebase.

### 2.9 Engagement gaps

| Capability                                         | State                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1:1 sales email (send + open/click)                | **Draft-only.** `routes-email-autopilot.ts` documents stubbed OAuth, inbox fetch, send, and `createProviderDraft()`. |
| Marketing email                                    | ✅ Real (SendGrid, `supabase/functions/email-marketing/`)                                                            |
| Calling / call logging / conversation intelligence | **Absent.** No telephony routes exist.                                                                               |
| Public meeting booking                             | **Absent** (CRMX-016 open) — internal calendar sync is real                                                          |
| Shared inbox / live chat                           | **Absent** (CRMX-017 open)                                                                                           |
| Rep "my day" work queue                            | **Absent.** `SalesCommandCenter` is a forecast analytics dashboard, not a work surface.                              |

### 2.10 Model debt still open

CRMX-007 has not landed: `enhancedContacts`, `customerContacts`, `leadContacts` and the standalone
`companies` table still coexist with the canonical `companyContacts` / `business_records`. Two
`ActivityTimeline` components exist (`components/ActivityTimeline.tsx` and
`components/ui/activity-timeline.tsx`).

---

## Part 3 — The HubSpot benchmark (2026)

What HubSpot shipped this year, and the honest read on each.

| HubSpot capability                                  | What it is                                                                                                                                                 | Printyx position                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Sales Workspace** (forced migration Apr 27, 2026) | One home for the rep: customizable Summary page with drag-and-drop cards, Stalled Deals, Follow-up on Meetings, and CRM task queues replacing bespoke tabs | **Missing.** Biggest single gap. Highest ROI to copy.                                                                |
| **Suggested Tasks** (was Guided Actions)            | AI-ranked next actions that **auto-expire when stale**; admins choose which types appear                                                                   | Missing. The workflow runtime can generate these today.                                                              |
| **Prospecting Agent**                               | Monitors funding rounds and job postings for buying signals; ZoomInfo/Apollo enrichment; buying-committee mapping                                          | Partial — Apollo enrichment exists (`ApolloLeadEnrichment.tsx`). **Copier equivalent is far stronger** (see Part 4). |
| **Smart Sales Meetings**                            | Pre-meeting AI briefing, transcription, auto action items and summaries                                                                                    | Parts exist (`MeetingTranscription`, `MeetingToProposalDashboard`) but are unwired from deals and mis-filed in nav.  |
| **Smart Deal Progression**                          | Parses meeting transcripts and proposes CRM field updates **with citations**                                                                               | Missing. Transcripts already exist — this is a connector, not a build.                                               |
| **Deal insights panel**                             | Side panel on the deal with Deal Score, Breeze Summary over the last 100 interactions                                                                      | Missing entirely — `DealDetail` has no panel at all.                                                                 |
| **Sequences**                                       | Multi-step 1:1 email cadences with enrollment rules                                                                                                        | ✅ Built (CRMX-009) on the real workflow runtime — but **the send leg is stubbed**.                                  |
| **Forecasting**                                     | Categories, roll-up, quota attainment                                                                                                                      | Partial — `SalesPipelineForecasting`, `CrmGoalsDashboard`, `sales_forecasts`; no forecast category on `deals`.       |
| **Conversation intelligence**                       | Call recording, transcription, coaching signals                                                                                                            | Missing (no telephony).                                                                                              |
| **Playbooks**                                       | Guided call scripts rendered inside the record                                                                                                             | Missing. High copier value (discovery scripts for fleet assessment).                                                 |
| **Quotes**                                          | Basic line items, e-sign                                                                                                                                   | ✅ **Printyx is ahead** — recurring/one-time split, CPC math, margin guardrails, deal-desk approvals.                |
| **Automation**                                      | Workflows                                                                                                                                                  | ✅ **Printyx is at parity** on the runtime.                                                                          |

**The pattern worth stealing:** HubSpot's 2026 direction is not more features — it is _one workspace
that tells the rep what to do next, and AI that removes CRM data entry_. Printyx should copy the
**shape** (workspace + suggested tasks + deal insights panel), not the feature list.

**The pattern worth refusing:** HubSpot's object model. Printyx's single `business_records` lifecycle
is better. Do not split it to look more like HubSpot.

---

## Part 4 — The copier layer (this is the wedge)

Everything above gets Printyx to parity. This is what makes it un-competable by HubSpot.

### The core insight

**In a copier dealership, the pipeline is already sitting in the database.** Every machine's lease
expiry, every contract's end date, every meter trend, every service-call cluster is a dated,
quantified, named sales trigger. Printyx stores all of it — `equipment.leaseExpiresDate`,
`contracts.endDate`, `meter_readings`, `service_contracts`, `contract_pnl` — and today it drives
**zero** pipeline. `leaseExpiresDate` is rendered in exactly one place: a badge on the customer
equipment tab (`CustomerEquipment.tsx:345`). A HubSpot instance can never do this because HubSpot
does not know what is in the customer's copier room.

### The gaps, concretely

1. **`deals` has no link to the installed base.** No `equipmentId`, no serial list, no
   fleet-being-replaced snapshot, no contract/lease being displaced, no trade-in, no buyout
   exposure, no incumbent vendor, no current CPC. The deal is a generic B2B deal that happens to
   live in a copier product.

2. **Quote Builder is catalog-only.** `LineItemManager.tsx` maps "equipment" to `product_models` —
   what we _sell_. It has no awareness of `equipment` — what they _have_. A rep quoting a fleet
   refresh retypes from scratch what the system already knows.

3. **Lease and contract expiry generate nothing.** No deal, no task, no sequence enrollment, no
   board column. The single richest deal source in the business is inert data.

4. **Renewal auto-quote is siloed.** `renewal_auto_quotes` produces good drafts, outside the CRM
   pipeline, on its own page. Reps don't work there.

5. **Service never becomes a sales signal.** Fleet monitoring, predictive failure, ticket volume,
   and contract P&L exist. A machine burning margin or generating tickets is the best upgrade
   conversation in the industry, and it never reaches the rep.

6. **Territory is dead code.** `sales_territories` exists in `lead-assignment-schema.ts`;
   `TerritoryManagement.tsx` (700 lines) is unrouted. Copier sales is territory-run.

7. **Competitive intel is stored but unused.** `business_records.competitorName`,
   `mainCompetitors`, `churnReason: 'competitor_switch'` are captured and never surfaced in a
   selling motion or a knockout play.

---

## Part 5 — The backlog

Tagged `COP-###` — 35 items, all filed in `prd.json` at priority 1, category `crm-copier-overhaul`.
Effort is S (≤3d) / M (≤2w) / L (>2w).

### ELIMINATE

| ID      | Item                                                                                                                                                                                                                                                                                  | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| COP-E01 | Delete the 9 unrouted CRM/sales pages (~10,065 lines): `DealsManagement`, `LeadsManagement`, `customers`, `TaskManagement`, `BasicTaskManagement`, `TerritoryManagement`*, `AITaskScheduling`, `my-tasks`, `TaskManagementPage`. *Extract territory logic first — COP-B09 revives it. | S      |
| COP-E02 | Retire `SalesPipelineWorkflow.tsx` and `ProspectsPage.tsx` as pipeline surfaces; 301-redirect `/sales-pipeline` and `/prospects` into the unified board with a preset saved view.                                                                                                     | M      |
| COP-E03 | Retire the legacy index pages `LeadsPage`, `Contacts.tsx`, `CustomersPage` once COP-M01 repoints navigation and feature parity is confirmed.                                                                                                                                          | M      |
| COP-E04 | Collapse URL sprawl to one canonical path per object (`/crm/{deals,leads,contacts,companies}`); every legacy path becomes a redirect, not a second route.                                                                                                                             | S      |
| COP-E05 | Delete the duplicate `ActivityTimeline`; keep one.                                                                                                                                                                                                                                    | S      |
| COP-E06 | Land CRMX-007 — migrate `enhancedContacts`/`customerContacts`/`leadContacts`/`companies` onto the canonical tables and drop them (backup + row-count validation, one read-only release).                                                                                              | L      |
| COP-E07 | Remove "Opportunities" from the vocabulary everywhere user-facing. The object is a **Deal**.                                                                                                                                                                                          | S      |

### MODIFY

| ID      | Item                                                                                                                                                                                                                                                                                                                                                                                           | Effort |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| COP-M01 | Repoint the sidebar at the `CrmIndexShell` pages. One-line-per-object nav change that instantly upgrades leads, contacts, and companies to saved views + board/table + bulk + inline edit. **Highest ratio of impact to effort in this document.**                                                                                                                                             | S      |
| COP-M02 | Restructure Sales Hub nav into three groups — **Work** (My Day, Deals, Leads, Contacts, Companies, Tasks), **Sell** (Quotes, Proposals, Deal Desk, Meetings, Sequences, Forms), **Manage** (Forecast, Goals, Territories, Commission, Customer Success). Move settings (Custom Fields, Proposal Branding, Pipeline Config) out of the hub into Settings. Move Meeting Transcription into Sell. | S      |
| COP-M03 | Collapse Leads / Prospects / Customers into **one** nav entry with lifecycle-stage saved views — making the unified-record advantage visible instead of hiding it.                                                                                                                                                                                                                             | M      |
| COP-M04 | Extend `deals` with the copier fields the motion needs: `dealMotion` (new logo / fleet refresh / lease rollover / expansion / renewal / competitive takeaway), `forecastCategory` (pipeline / best case / commit / closed), `incumbentVendor`, `leaseBuyoutExposure`, `tradeInValue`, `currentMonthlyPrint`, `targetCpcBlack`/`targetCpcColor`, `replacesContractId`.                          | M      |
| COP-M05 | Add a `deal ↔ equipment` association (via `crm_associations`) so a deal carries the exact serials it replaces or places.                                                                                                                                                                                                                                                                      | M      |
| COP-M06 | Make renewal auto-quote drafts land **as deals in the pipeline** in a "Renewal" stage, not on a separate page.                                                                                                                                                                                                                                                                                 | M      |
| COP-M07 | Standardize stage semantics on `pipelineStages` everywhere; remove remaining `dealStages` reads.                                                                                                                                                                                                                                                                                               | M      |

### BUILD

| ID      | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| COP-B01 | **Sales Workspace / "My Day"** — the rep's home. Overdue + today's tasks, stalled deals, meetings needing follow-up, quotes awaiting signature, suggested next actions. Customizable cards. Replaces `SalesCommandCenter` as the default landing page for sales roles.                                                                                                                                                                                                                                                                                  | L      |
| COP-B02 | **Rebuild `DealDetail` on the record-layout engine** — unified timeline (notes, emails, calls, meetings, stage changes, quotes), tasks, contacts, associated equipment, quote history, next step, one-click stage advance, and a right-hand insights panel. This is the single most important screen in the product.                                                                                                                                                                                                                                    | L      |
| COP-B03 | **Suggested Tasks engine** — generate ranked next actions from real signals (no activity in N days, stage SLA breach, quote expiring, lease within window, meter anomaly, ticket spike) on top of the existing workflow runtime, with auto-expiry when stale and admin control over which types fire.                                                                                                                                                                                                                                                   | M      |
| COP-B04 | **🔑 Installed-Base Opportunity Radar** — the copier wedge. A scheduled scan over `equipment`, `contracts`, `leases`, `meter_readings`, and service history that produces dated, quantified, ranked plays: _lease expiring in 120 days_, _contract ending_, _volume up 40% vs. contracted tier_, _machine past service-cost threshold_, _color capability underused_, _device off-network_. Each play one-clicks into a deal pre-loaded with the fleet, the current spend, and the recommended replacement. **HubSpot structurally cannot build this.** | L      |
| COP-B05 | **Fleet Assessment / TCO builder** — walk the customer's current fleet from `equipment` + `meter_readings` + `contracts`, compute today's true cost per page and monthly spend, model the proposed fleet against it, output a side-by-side savings story. Feeds Quote Builder directly. Reuses `print-cost-calculator-service.ts`.                                                                                                                                                                                                                      | L      |
| COP-B06 | **Installed-base-aware Quote Builder** — "Start from customer's fleet": pre-load their machines, volumes, and current CPC; a replacement line auto-carries the serial it displaces and the buyout exposure. Closes the biggest daily friction for a copier rep.                                                                                                                                                                                                                                                                                         | M      |
| COP-B07 | **Finish 1:1 email** (CRMX-010) — real Gmail/Outlook OAuth, inbox sync, send, open/click tracking, logged to the unified timeline. Unblocks sequences, which are otherwise a runtime with no output.                                                                                                                                                                                                                                                                                                                                                    | L      |
| COP-B08 | **Call logging + click-to-call**, with an optional recording/transcription path reusing the meeting-transcription stack. Copier sales is still a phone business.                                                                                                                                                                                                                                                                                                                                                                                        | M      |
| COP-B09 | **Territory management, revived** — map `sales_territories` to accounts and installed base; territory-scoped boards, quotas, and the opportunity radar.                                                                                                                                                                                                                                                                                                                                                                                                 | M      |
| COP-B10 | **Competitive knockout intelligence** — surface `competitorName` / `mainCompetitors` / `churnReason` as a per-deal competitive card with battlecards, win/loss by competitor, and takeaway plays.                                                                                                                                                                                                                                                                                                                                                       | M      |
| COP-B11 | **Deal insights panel** — AI summary over the record's real interaction history, deal score from actual signals (activity recency, stage age vs. SLA, contact coverage, margin, competitor present), risk flags. Honest empty states where signal is absent.                                                                                                                                                                                                                                                                                            | M      |
| COP-B12 | **Meeting → deal wiring** — attach transcripts to the deal timeline, auto-draft action items as tasks, propose CRM field updates with citations (HubSpot's Smart Deal Progression). Parts already exist; this connects them.                                                                                                                                                                                                                                                                                                                            | M      |
| COP-B13 | **Copier playbooks** — guided discovery rendered inside the record: fleet walk, volume qualification, lease-position discovery, decision-committee mapping. Answers write back to deal fields.                                                                                                                                                                                                                                                                                                                                                          | M      |
| COP-B14 | **Public meeting booking pages** (CRMX-016) — leverages real calendar sync.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | M      |

### IMPROVE

| ID      | Item                                                                                                                                                                            | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | --- |
| COP-I01 | Speed floor for daily surfaces: board and table under 1s at 5,000 records; virtualize every list; optimistic drag. A CRM reps love is a CRM that never makes them wait.         | M      |
| COP-I02 | Keyboard-first: extend the command palette to actions (`n d` new deal, `/` search, `e` email, `t` task), j/k list navigation, `⌘K` everywhere.                                  | M      |
| COP-I03 | Mobile: one hardened rep experience — board, record, notes, tasks, click-to-call, meter photo capture — as the first slice of CRMX-018's three-app consolidation.               | L      |
| COP-I04 | Every CRM surface gets a real empty state with a first-action CTA and sample data, wired to the CRMX-014 onboarding flow.                                                       | S      |
| COP-I05 | Global search: rank deals/contacts/companies by recency + ownership, add serial-number and contract-number lookup (a copier rep searches by serial constantly).                 | M      |
| COP-I06 | Forecast accuracy: forecast category on deals, roll-up by rep/team/territory, commit vs. actual history, weighted by `pipelineStages` config rather than free-text probability. | M      |
| COP-I07 | Audit every CRM dashboard for mock fallbacks (the `                                                                                                                             |        | mockData`pattern flagged in`CLAUDE.md` batches 9/12) and replace with real data or honest empty states. | M   |

---

## Part 6 — Sequencing

**Phase 0 — Make the good stuff visible (1–2 weeks).**
COP-M01, COP-M02, COP-E01, COP-E04, COP-E05, COP-E07, COP-I04.
No new features. Repoint navigation, delete 10k lines of dead code, one URL per object, one word per
object. The product will feel dramatically less choppy before a single feature is written.

**Phase 1 — One pipeline, one deal (3–4 weeks).**
COP-E02, COP-E03, COP-M03, COP-M07, COP-B02, COP-M04, COP-M05.
Collapse three boards into one. Rebuild the deal record. Give the deal its copier fields and its
installed-base link.

**Phase 2 — The rep's day (4–6 weeks).**
COP-B01, COP-B03, COP-B07, COP-I01, COP-I02, COP-I05.
Sales Workspace, suggested tasks, working email, and the speed/keyboard floor. This is where
"streamlined for salespeople" becomes true.

**Phase 3 — The copier wedge (6–8 weeks).**
COP-B04, COP-B05, COP-B06, COP-M06, COP-B09, COP-B10.
Opportunity Radar, Fleet Assessment, installed-base quoting, renewals in-pipeline, territories,
competitive intel. **This is the phase that wins deals against HubSpot.**

**Phase 4 — Intelligence and reach (ongoing).**
COP-B08, COP-B11, COP-B12, COP-B13, COP-B14, COP-E06, COP-I03, COP-I06, COP-I07.

---

## The positioning this earns

> HubSpot knows your emails. Printyx knows your copier room.
>
> Every lease expiring in 120 days, every contract ending, every machine running 40% over its
> contracted tier, every device burning service margin — already a ranked, dated, dollar-quantified
> opportunity on your rep's screen this morning, with the replacement quote pre-built from the
> customer's own meter data.

Phases 0–2 make that claim credible by making the CRM a place reps will actually work.
Phase 3 makes it true.

---

## Sources

- [HubSpot Sales Workspace update, April 2026](https://vantagepoint.io/blog/sf/hs/hubspot-sales-workspace-update-april-2026-preparation-guide)
- [Manage deals in the sales workspace — HubSpot Knowledge Base](https://knowledge.hubspot.com/prospecting/create-and-manage-deals-in-the-sales-workspace)
- [Customize guided actions — HubSpot Knowledge Base](https://knowledge.hubspot.com/prospecting/customize-guided-actions)
- [HubSpot Sales Hub AI features: 2026 capability list](https://www.modgility.com/blog/what-are-the-new-ai-features-in-hubspot-sales-hub-a-complete-guide)
- [HubSpot's June 2026 updates — MarTech](https://martech.org/hubspots-june-2026-updates-agents-get-more-access-revenue-hub-starts-connecting-the-dots/)
- [HubSpot May 2026 updates: Sales Workspace, Breeze AI](https://www.lupodigital.com/blog/hubspot-may-2026-product-feature-updates)
- [Copier sales training that sells past the box — Revenueify](https://revenueify.today/industry-sales-training/copier-sales-training/)
- [Solutions for leasing companies — FleetProcure](https://www.fleetprocure.com/solutions-leasing-companies)
- Internal: `docs/crm-canonical-model.md` (CRMX-002), `prd.json` stories `CRM-001`..`CRM-010`, `CRMX-001`..`CRMX-018`

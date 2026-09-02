# Audit B — Sales Close (deals/pipeline -> quotes -> proposals -> closed-won -> lease-or-payment -> commission)

Repo: `/home/user/Printyx`. READ-ONLY audit; no files modified. All claims below were verified by reading
the cited file/line; anything not directly verified is marked UNVERIFIED.

---

## 1. Page-by-page table

Legend for **status**: working = real backend, wired, no known break · partially working = works but with a
gap noted in Evidence · orphan = no sidebar/in-app link (URL-only) · fabricated = shows invented data.

| Route                                                       | Page file                                                              | Status                                                               | Backend                                                                             | Tables                                                                               | Evidence                                                                                                                                                                                                                                                                            | RBAC gate                                                                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/crm/deals`                                                | `client/src/pages/CrmDealsPage.tsx`                                    | Partially working                                                    | `deals` edge fn (proxied)                                                           | `deals`, `pipeline_stages`, `deal_stages`                                            | Board view is fine (`EnhancedPipelineBoard.tsx:431` posts to `/api/pipeline-config/deals/:id/move`). Table-view "Mark Won"/"Mark Lost" row+bulk actions (`CrmDealsPage.tsx:176-231`) PATCH only `status`+`actualCloseDate`, never `stage_id` — see Defect D1.                       | `navigation-permissions.ts:540-546`: `sales.opportunity.view_{own,team,location}`, no minLevel. No server-side enforcement (see D6). |
| `/crm/deals/:id`                                            | `client/src/pages/DealDetail.tsx`                                      | Working                                                              | `deals` + `pipeline-config` edge fns                                                | `deals`, `pipeline_stages`/`deal_stages`, `deal_activities`                          | Stage change correctly posts to `/move` (`DealDetail.tsx:274`); other-field edits PUT `/api/deals/:id` (`:286`), never touching `stage_id`.                                                                                                                                         | No explicit entry in `navigation-permissions.ts` (visible by default per `checkNavigationAccess`, line 993).                         |
| `/sales-pipeline`, `/sales-pipeline-workflow`               | `client/src/pages/SalesPipelineWorkflow.tsx`                           | Working, but a THIRD stage vocabulary                                | `sales-pipeline` edge fn                                                            | `business_records.status` (own stage-slug vocabulary, NOT `deals`)                   | Header comment `SalesPipelineWorkflow.tsx:47-48` states stage ids come from `/api/sales-pipeline/stages` and map onto `business_records.status`. Already tracked as **COP-E02** (open).                                                                                             | `navigation-permissions.ts:161-166` `sales.opportunity.view_*`.                                                                      |
| `/pipeline-config`                                          | `client/src/pages/PipelineConfiguration.tsx`                           | Working                                                              | `pipeline-config` edge fn                                                           | `pipeline_stages`, `pipeline_templates`, `stage_transitions`                         | CRUD confirmed (`PipelineConfiguration.tsx:142-264`).                                                                                                                                                                                                                               | `navigation-permissions.ts:197-200`, `sales.territory.manage_assignments`, minLevel 4.                                               |
| `/sales-pipeline-forecasting`                               | `client/src/pages/SalesPipelineForecasting.tsx`                        | Working                                                              | `sales-forecasts` + `pipeline-forecast` edge fns                                    | `deals`, canonical `pipeline_stages`                                                 | `SalesPipelineForecasting.tsx:71-88`; `pipeline-forecast/index.ts:154-203` reads `legacy_stage_id, is_closed_won` off `pipeline_stages` — consistent with deals model.                                                                                                              | `navigation-permissions.ts:168-175`, minLevel 3.                                                                                     |
| `/quotes`                                                   | `client/src/pages/QuotesManagement.tsx`                                | Working, not sidebar-linked directly                                 | `proposals` edge fn (`quotes` object = `proposals` rows filtered by `proposalType`) | `proposals`, `proposal_line_items`                                                   | Reachable via `QuoteProposalGeneration.tsx:732,768` (sidebar's "Quotes & Proposals" item). Not in `navigation-permissions.ts` explicitly for `/quotes`? — actually present at line 592-593.                                                                                         | `navigation-permissions.ts:592-593`, `sales.quote.create`/`edit_own`.                                                                |
| `/quotes/new`, `/quotes/:quoteId`                           | `client/src/pages/QuoteBuilderPage.tsx`                                | Working                                                              | `quotes`/`quote-line-items`/`proposals` edge fns                                    | `proposals`, `proposal_line_items`                                                   | QUOTE-016/017/019/020 guardrail logic lives in `client/src/components/quote-builder/QuoteBuilder.tsx`.                                                                                                                                                                              | `navigation-permissions.ts:595-603`.                                                                                                 |
| `/quotes/:quoteId/view`                                     | `client/src/pages/QuoteView.tsx`                                       | Working                                                              | `proposals` edge fn                                                                 | same                                                                                 | `QuoteView.tsx` GETs `/api/proposals/:id`.                                                                                                                                                                                                                                          | same permission entry.                                                                                                               |
| `/quote-proposal-generation`                                | `client/src/pages/QuoteProposalGeneration.tsx`                         | Working (hub/launcher page)                                          | n/a (navigation only)                                                               | —                                                                                    | Links onward to `/quotes`, `/quotes/new`, `/proposal-builder?quoteId=` (`QuotesManagement.tsx:459`, `QuoteBuilderPage.tsx:38`, `QuoteView.tsx:365`).                                                                                                                                | `navigation-permissions.ts:183-184`.                                                                                                 |
| `/proposal-builder`                                         | `client/src/pages/ProposalBuilder.tsx`                                 | Working                                                              | `proposals` edge fn                                                                 | `proposals`, `proposal_line_items`                                                   | `ProposalBuilder.tsx` calls `/api/proposals/proposal-templates`, `/api/proposals`, `/api/business-records`.                                                                                                                                                                         | `navigation-permissions.ts:186-188`.                                                                                                 |
| `/proposal-templates`, `/proposal-templates/:id/edit`       | `client/src/pages/ProposalTemplates.tsx`, `ProposalTemplateEditor.tsx` | Working                                                              | `proposals` edge fn (templates sub-resource)                                        | `proposal_templates`                                                                 | Real CRUD confirmed via `apiRequest` calls.                                                                                                                                                                                                                                         | No explicit nav-permissions entry (visible by default). Sidebar link at `RoleAwareCollapsibleSidebar.tsx:263`.                       |
| `/proposals/branding`                                       | `client/src/pages/BrandingSettings.tsx`                                | Working                                                              | `proposals` edge fn (branding sub-resource)                                         | `proposal_branding_profiles`? (UNVERIFIED table name)                                | Real CRUD confirmed.                                                                                                                                                                                                                                                                | No explicit nav-permissions entry. Sidebar link (Settings) `RoleAwareCollapsibleSidebar.tsx:542-547`.                                |
| `/deal-desk`                                                | `client/src/pages/DealDeskDashboard.tsx`                               | **Built-but-unreachable at the front door**                          | `deal-desk` edge fn                                                                 | `approval_requests`, `approval_comments`                                             | Page only lists requests and posts decisions (`DealDeskDashboard.tsx:127-144`). **No client code anywhere creates an approval request** (`grep -rn "'/api/deal-desk/requests'"` returns only the GET/decision calls). See Defect D2.                                                | `navigation-permissions.ts:189-196`, minLevel 3, `sales.quote.approve_*`. Also `ProtectedRoute` in `App.tsx:738-750`.                |
| `/deal-desk/requests/:id`                                   | `client/src/pages/ApprovalRequestDetail.tsx`                           | Working (review-only)                                                | `deal-desk` edge fn                                                                 | same                                                                                 | Approve/reject only updates `approval_requests`; never touches `proposals`/`quotes` (`deal-desk/index.ts:513-560`). See D2/D3.                                                                                                                                                      | `navigation-permissions.ts:604-611`.                                                                                                 |
| `/deal-desk/rules`                                          | `client/src/pages/ApprovalRulesConfiguration.tsx`                      | Working                                                              | `deal-desk` edge fn                                                                 | `approval_rules` (UNVERIFIED exact name)                                             | Linked from `DealDeskDashboard.tsx:412`.                                                                                                                                                                                                                                            | `navigation-permissions.ts:612-615`, minLevel 5.                                                                                     |
| `/pricing/settings`                                         | `client/src/pages/PricingSettings.tsx`                                 | Working, dashboard-widget-linked                                     | `pricing` edge fn                                                                   | `pricing_settings`/`company_pricing_settings`                                        | Linked from `PricingDashboardWidgets.tsx`, `PricingNotificationBadge.tsx` (no sidebar entry).                                                                                                                                                                                       | `navigation-permissions.ts:732-735`, minLevel 4.                                                                                     |
| `/pricing/margin-report`                                    | `client/src/pages/MarginAnalysisReport.tsx`                            | Working, dashboard-widget-linked                                     | `pricing` edge fn                                                                   | derived from `proposals`/`proposal_line_items`                                       | same linkage as above.                                                                                                                                                                                                                                                              | `navigation-permissions.ts:736-739`, minLevel 4.                                                                                     |
| `/pricing/approvals`                                        | `client/src/pages/PriceApprovals.tsx`                                  | Working, dashboard-widget-linked                                     | `pricing` edge fn                                                                   | `pricing_approvals`? (UNVERIFIED)                                                    | `PriceApprovals.tsx:81` PATCHes `/api/pricing/approval/:id`. Note: this is a SEPARATE approval object from `deal-desk`'s `approval_requests` — a third approvals model.                                                                                                             | `navigation-permissions.ts:740` area, minLevel 4.                                                                                    |
| `/contracts`                                                | `client/src/pages/contracts.tsx`                                       | Working                                                              | `contracts` edge fn                                                                 | `contracts`                                                                          | `contracts.tsx` GETs `/api/contracts`, `/api/quotes`.                                                                                                                                                                                                                               | `navigation-permissions.ts:201-203`.                                                                                                 |
| `/contracts/:id/pnl`                                        | `client/src/pages/ContractPnlDetail.tsx`                               | Working                                                              | `contract-pnl` edge fn                                                              | `contracts`, derived margin data                                                     | Real per App.tsx comment at `:1028` ("actual-margin half is what /contracts/profitability [...] ").                                                                                                                                                                                 | No explicit nav-permissions entry.                                                                                                   |
| `/contracts/profitability`                                  | `client/src/pages/ContractProfitability.tsx`                           | Working                                                              | `contract-pnl` edge fn                                                              | same                                                                                 | `ContractProfitability.tsx` calls `/api/contract-pnl/refresh`, `/digest/preview`, `/settings`.                                                                                                                                                                                      | `navigation-permissions.ts:819` area.                                                                                                |
| `/leases`, `/leases/new`, `/leases/:id`, `/leases/:id/edit` | `Leases.tsx`, `LeaseForm.tsx`, `LeaseDetail.tsx`                       | Working CRUD, **disconnected from the deal-close flow**              | `leases` edge fn (incl. `lease-payments` sub-route)                                 | `leases`                                                                             | Full CRUD confirmed (`LeaseForm.tsx:101,125`; `LeaseDetail.tsx:82,105` — payment processing + renewal). **`LeaseForm.tsx` reads no `dealId`/`proposalId` query param** — a lease is never pre-filled or auto-created from a won deal/accepted proposal. See D4/(c).                 | `navigation-permissions.ts:370-373` (`/leases`), `:871-880` (`/leases/*`), minLevel 2.                                               |
| `/esignature-integration`                                   | `client/src/pages/ESignatureIntegration.tsx`                           | Partially working — real data, but send is a stub                    | `signatures` edge fn                                                                | `signature_requests`                                                                 | Data-contract fixed by **PA-036** (closed) — `mapSignatureRequest` at `ESignatureIntegration.tsx:181-192` reads real columns. Send/webhook is a deliberate stub — **PA-041** (open); `signatures/index.ts:6-10`, `handlers/requests.ts:9,53-54`, `handlers/credentials.ts:130-161`. | `navigation-permissions.ts:464-467`, minLevel 3.                                                                                     |
| `/commission-management`                                    | `client/src/pages/CommissionManagement.tsx`                            | Partially working                                                    | `commission` edge fn                                                                | `commission_plans`, `commission_calculations` (never written), `commission_disputes` | "Calculate" button (`CommissionManagement.tsx:252`) hits `POST /commission/calculate`, which is a deliberate `501` (`commission/index.ts:578-589`). `GET /calculations` reads a table nothing ever inserts into (see D5).                                                           | `navigation-permissions.ts:223-225`.                                                                                                 |
| `/sales-command-center`                                     | `client/src/pages/SalesCommandCenter.tsx`                              | Working                                                              | `sales-forecasts`/other edge fns                                                    | `deals`                                                                              | Real `apiRequest` calls confirmed, no mock hits.                                                                                                                                                                                                                                    | `navigation-permissions.ts:211-217`, minLevel 4.                                                                                     |
| `/sales-performance-analytics`                              | `client/src/pages/SalesPerformanceAnalytics.tsx`                       | Working                                                              | `sales-reports`? / `reports` handlers                                               | derived                                                                              | Real `apiRequest` calls to `/api/reports/sales-reps`, `/team-performance`, `/pipeline-funnel`.                                                                                                                                                                                      | `navigation-permissions.ts:219-222`, minLevel 3.                                                                                     |
| `/meeting-transcription`                                    | `client/src/pages/MeetingTranscription.tsx`                            | Working (own audit scope — LEGAL-009/AUDIT-019)                      | `meeting-transcription` edge fn                                                     | `meeting_*` drift tables                                                             | Out of this scope's deep-dive; sidebar-linked.                                                                                                                                                                                                                                      | `navigation-permissions.ts:513`, alwaysVisible.                                                                                      |
| `/meeting-to-proposal`                                      | `client/src/pages/MeetingToProposalDashboard.tsx`                      | Honest placeholder, orphan                                           | none                                                                                | none                                                                                 | Gated to a "Coming soon" card by **PROP-009** (`MeetingToProposalDashboard.tsx:100-119`); not linked from any sidebar item or `MeetingTranscription.tsx`.                                                                                                                           | `navigation-permissions.ts:657-659`.                                                                                                 |
| `/p/:token`                                                 | `client/src/pages/ProposalPublicView.tsx`                              | **Working — this is the real closed-won mechanism**                  | `proposals` edge fn `/public/:token[/respond]`                                      | `proposals`, `deals`, `contracts`, `proposal_analytics`                              | See Section 2 and D-none (this is the one part of the flow that fully works end-to-end).                                                                                                                                                                                            | Public, no auth (`App.tsx:465-474`).                                                                                                 |
| `/renewals`                                                 | `client/src/pages/RenewalAutoQuote.tsx`                                | Working, navigational orphan                                         | `renewal-autoquote` edge fn                                                         | `renewal_auto_quotes`, `renewal_proposals`, etc.                                     | No sidebar entry, no in-app link found anywhere (`grep` for `'/renewals'` across `client/src` returns nothing but the route + nav-permissions is silent too — visible-by-default, reachable only by typed URL).                                                                     | No `navigation-permissions.ts` entry (defaults visible).                                                                             |
| `/contract-renewals`                                        | `client/src/pages/ContractRenewalDashboard.tsx`                        | Working, navigational orphan, **name collision with a dead edge fn** | `contract-renewal` edge fn (NOT the `contract-renewals` edge fn)                    | `contract_renewal_tracking`, etc.                                                    | Same component also mounted at `/contract-renewal-autopilot` (`App.tsx:837,855`, duplicate route mapping). See D7/AUDIT-026.                                                                                                                                                        | `navigation-permissions.ts:674-676`.                                                                                                 |
| `/contract-renewal-autopilot`                               | same as above                                                          | Working, navigational orphan                                         | same                                                                                | same                                                                                 | see above                                                                                                                                                                                                                                                                           | `navigation-permissions.ts:645-647`.                                                                                                 |

---

## 2. Workflow-stage gaps

Target chain in scope: **deals/pipeline → quotes → proposals → closed-won → lease-or-payment check →
handoff to Purchasing/Project Management → commission.**

### Stage: Deal moves to Closed Won (drag/drop or manual mark)

- **What exists:** `POST /api/pipeline-config/deals/:id/move` (`pipeline-config/index.ts:686-776`) is the
  path both `EnhancedPipelineBoard.tsx:431` (board drag) and `DealDetail.tsx:274` (detail-page stage picker)
  actually call. When the target stage's canonical `pipeline_stages.is_closed_won` is true, it sets
  `deals.status='won'`, `probability=100`, `actual_close_date=now` (`:720-723`) and writes a
  `deal_stage_history` row (`:749-758`).
- **What does NOT happen on that transition:** no contract is created, no `business_records.status` is
  updated, no handoff/project record is created, and (see D1 below) **no workflow event fires** — the
  `pipeline_automation_logs` rows it writes (`recordStageMoveAutomations`, `:1100-1200`) are stamped
  `status:'skipped'` / `note: QUEUED_NOTE` and **nothing in the codebase ever reads `pipeline_automation_logs`**
  (`grep -rln "pipeline_automation_logs" server/ supabase/` returns only this one file) — the log is
  write-only, permanently inert.
- **The one seam that WOULD fire a real workflow event** (`deal.stage_changed`, `dispatchWorkflowEventSafe`,
  `supabase/functions/deals/index.ts:898-919`) lives on the `PATCH /api/deals/:id` endpoint's `stage_id`
  branch — but no UI anywhere (web, `mobile/`, `mobile-app/`) ever sends `stageId`/`stage_id`/`stage` to that
  endpoint. It is dead code from every client's perspective. See D1.
- **Built-but-unreachable:** the `deal.stage_changed` dispatch is fully implemented and unit-tested
  (per `CLAUDE.md`'s CRMX-008a note) but the UI never triggers it.

### Stage: Quote → Proposal → Accept/Sign

- **What exists (works end-to-end):** `POST /public/:token/respond {action:'accept'}`
  (`proposals/index.ts:936-965`) — the customer-facing `/p/:token` page — sets `proposals.status='accepted'`,
  then calls `upsertDealForProposal(..., {forceWon:true})` (moves/creates the deal into the "won" stage,
  `:729-800`) and `createContractFromProposal` (creates a `contracts` row, `:822-850`). This IS the real
  closed-won trigger for the sales-close flow, not the pipeline board.
- **The internal PATCH `/proposals/:id` status='accepted' path** (used when a rep marks it accepted
  internally, `:2001-2010`) does the same sync.
- **Gap — stage vocabulary drift (COP-M07):** `getWonStageId` (`proposals/index.ts:702-712`) resolves the
  "won" stage by querying **`deal_stages.is_won_stage`** (the legacy table), falling back to a name lookup
  for `'Closed Won'`, then to the tenant's first stage. Meanwhile the canonical config surface
  (`/pipeline-config`, `PipelineConfiguration.tsx`) edits **`pipeline_stages`** only
  (`pipeline-config/index.ts:581-613`, no write-back to `deal_stages`). If a tenant customizes their pipeline
  through the canonical UI (renames the won stage, adds a second closed-won stage, etc.), proposal
  acceptance never sees it and can silently land a "won" deal in the tenant's **first pipeline stage**
  instead. This is a new, concrete instance of the open **COP-M07** story ("Standardize stage semantics on
  pipelineStages and remove remaining legacy dealStages reads").
- **E-signature is not this pathway.** The formal e-signature module (`/esignature-integration`,
  `signatures` edge fn) is a completely separate, still-stubbed system (**PA-041**, open) — sending a
  document never actually reaches a signer, and nothing in it calls `upsertDealForProposal` or
  `createContractFromProposal`. The two "sign/accept" mechanisms are unconnected.

### Stage: Closed-won → lease-or-payment check

- **Nothing exists.** `deals` has no acquisition-type/financing field; `proposals.proposalType` is a free
  string (`'equipment_lease' | 'service_contract' | ...`, `shared/schema.ts:5988`) and `paymentTerms`
  (`shared/quote-proposal-schema.ts:204`, `'net_30'|'net_60'|'upfront'|'financing'`) exists on a schema but
  is never read by `createContractFromProposal`, which unconditionally creates a `contracts` row — never a
  `leases` row — regardless of what the proposal says it is. `leases` is a fully-built, independent CRUD
  module (`Leases.tsx`/`LeaseForm.tsx`/`LeaseDetail.tsx`) with no query-param or code path that connects it to
  a specific deal/proposal at the moment of close; a rep must remember to separately open `/leases/new` and
  manually fill in `proposalId`/`businessRecordId` if they want the link (`leases` schema does have those
  columns, `shared/schema.ts:2817-2819`, but nothing populates them automatically).
- **`payment-processing` and `subscriptions` edge fns** have zero callers anywhere in `client/src` — no UI
  captures "how is this being paid" at all.

### Stage: Handoff to Purchasing & Project Management

- **Nothing reachable exists**, despite two complete backends:
  1. `supabase/functions/sales-handoffs/index.ts` — queries a **phantom table `sales_handoffs`** that exists
     in no schema and no migration (`index.ts:50,77,103,132,158,180`), and has zero callers anywhere.
  2. `server/routes-sales-handoff.ts` — a fully registered Express router
     (`routes-registry.ts:66,854`) serving `/api/sales-handoffs`, `/api/handoff-task-templates`,
     `/api/handoff-tasks`, `/api/implementation-projects` over four REAL tables in
     `shared/sales-handoff-schema.ts` (`salesHandoffChecklists:18`, `handoffTaskTemplates:188`,
     `handoffTasks:234`, `implementationProjects:297`) — and **also has zero callers anywhere** in
     `client/src`, `mobile/`, `mobile-app/`, `printyx-client/`, `printyx-desktop/`, `ios/`.
  3. Because `/api/sales-handoffs` is not in `crmProxies`, dev would hit the real Express router while
     production would hit the phantom-table edge fn — a "both-divergent" pair neither list in
     `context.md` names — but since NOTHING calls either host, the divergence is moot; what matters is
     there is no screen at all for the "handoff to Purchasing/Project Management" step of the target workflow.
- Confirmed no `prd.json` story (open or closed) mentions "handoff", "implementation project", or
  "purchasing" — this is a **genuinely uncovered gap**.

### Stage: Commission

- `commission_plans`, `commission_disputes` are real, written, and read (`commission/index.ts:259-291,
347-398`).
- `commission_calculations` is read (`:100-115`, `:405-441` analytics) but **nothing ever inserts into it** —
  confirmed by grepping every `.insert` in the file (only `commission_plans:264` and
  `commission_disputes:361`). `POST /commission/calculate`, the only endpoint that could write it, is a
  deliberate `501` (`:578-589`). The `CommissionManagement.tsx` "Calculate" button therefore always fails.
  Matches `CLAUDE.md`'s CR-017 note; not yet built.
- `GET /commission/my-earnings` (`:228-256`) still hardcodes `baseCommission = totalSales * 0.05` — the exact
  "invented pay" pattern CR-017 says it fixed elsewhere in this same file — but **this endpoint has zero
  callers anywhere** (web or mobile), so it is a dormant landmine rather than an active defect. See D5.

---

## 3. Defects found

**D1 — The only real workflow-dispatch seam for deal stage changes is dead code from every client.**
Severity: High (silently defeats CRMX-008's automation runtime for the single most important CRM event).
`supabase/functions/deals/index.ts:898-919` dispatches `deal.stage_changed` only when the PATCH body
includes `stage_id`. Every UI path that actually changes a deal's stage
(`EnhancedPipelineBoard.tsx:431`, `DealDetail.tsx:274`) posts to `pipeline-config`'s
`/deals/:id/move` instead, which never calls `dispatchWorkflowEventSafe` at all
(`pipeline-config/index.ts:682-776`, confirmed by `grep -n "dispatchWorkflowEvent" supabase/functions/pipeline-config/index.ts` = no hits). `CrmDealsPage.tsx`'s "Mark Won"/"Mark Lost" actions
(`:176-231`) PATCH `/api/deals/:id` but only send `status`+`actualCloseDate`, never `stage_id`, so even
that path never triggers dispatch. No client tree (checked `client/src`, `mobile/`, `mobile-app/`) ever
sends `stageId`/`stage_id`/`stage` to `PATCH /api/deals/:id`. **Not covered by an open story** — closest is
**COP-M07** (stage-vocabulary unification) and CRMX-008a (which built the dispatch itself, unaware the UI
bypasses it), but neither names this specific wiring gap. New finding.

**D1b — `CrmDealsPage`'s "Mark Won"/"Mark Lost" desyncs the Kanban board.**
Severity: Medium. Because it never sets `stage_id`, and `EnhancedPipelineBoard.tsx:392-393` groups deals
strictly by `record.stageId`, a deal marked won from the table view keeps sitting in its old Kanban column
(e.g. "Negotiation") forever, even though its status badge says "Won" in the table. Switching between the
table and board views for the same deal shows contradictory state. Not covered by an open story.

**D2 — Deal Desk has no way to originate a request.** Severity: High (the feature cannot be entered as
designed). `DealDeskDashboard.tsx` only lists requests and posts `decision` (`:127-144`); no component in
`client/src` ever `POST`s to `/api/deal-desk/requests` to create one — confirmed with
`grep -rn "'/api/deal-desk/requests'" client/src/`. `client/src/components/quote-builder/QuoteBuilder.tsx`
(the one place a rep would trip the pricing guardrail) never references `deal-desk` at all. A rep who hits
the margin/discount 409 (`proposals/index.ts:1905-1957`) has no in-product path to request an exception.
Not covered by an open story (checked "deal desk"/"deal-desk"/"approval_requests" keywords).

**D3 — Deal Desk approval and the quote-send guardrail are two disconnected systems.** Severity: High.
Approving a request only updates `approval_requests.status` (`deal-desk/index.ts:513-560`) — it never writes
back to the `proposals`/`quotes` row it was about. The guardrail bypass on the sending side
(`proposals/index.ts:1905`, `body.approved`) is populated purely from `isManager = pricingVisibility?.showDealerCost === true`
for the **current sender** (`QuoteBuilder.tsx:211,476`) — i.e. a manager sending their own quote self-approves
with no second reviewer, while a rep whose request a manager _did_ approve through Deal Desk still cannot
send it themselves (the guardrail re-checks `isManager` of whoever clicks Send, not any approval record).
Not covered by an open story.

**D4 — No lease-or-payment decision is captured anywhere in the close flow.** Severity: Medium (matches the
target workflow's explicit "lease-or-payment check" step, which does not exist). `createContractFromProposal`
(`proposals/index.ts:822-850`) always creates a `contracts` row regardless of `proposals.proposalType`
('equipment_lease' vs anything else); `leases` is a fully separate, manually-driven CRUD module with no
`dealId`/`proposalId` prefill (`LeaseForm.tsx` reads no query params). Not covered by an open story.

**D5 — `commission.my-earnings` still hardcodes a flat 5%.** Severity: Low today (dormant — zero callers
anywhere), High if ever wired up. `commission/index.ts:228-256`. Same invented-pay pattern CR-017 fixed on
the sibling `calculations`/`analytics` endpoints in the same file, missed here. Not covered by an open story
(EDGE-002h is about porting missing sub-routes, not fixing this fabrication).

**D6 — No role/team/location scoping is enforced server-side anywhere in the sales-close surface.**
Severity: High (matches the target workflow's explicit tiering requirement — L1/L2 own-work only,
L3/L4 team, L5/L6 region). `grep -c "requireRoleLevel\|requireRole\b"` across
`deals, quotes, proposals, deal-desk, pricing, commission, contracts, leases, pipeline-config, sales-pipeline`
edge functions returns **0 for all ten**. `deals/index.ts`'s `GET /` only filters by `tenantId`, plus an
`ownerId` filter the caller must explicitly request (`:696,718`) — and no UI component
(`CrmDataTable.tsx`, `CrmIndexShell.tsx`, `EnhancedPipelineBoard.tsx`) ever sets it based on the current
user's role. Any authenticated tenant member — a level-1 `SALES_REP` included — can list, read and edit
every deal/quote/proposal/contract/lease/commission-plan/pricing-setting in the tenant via direct API calls.
This is the same class of issue already generally described in `docs/rbac-landscape.md`
("281 of 284 edge fns enforce auth+tenant but NO role/permission check") — cited there in general terms;
this audit confirms it specifically and exhaustively for all ten sales-close functions. Not a new story
category, but worth calling out as fully verified for this scope rather than assumed.

**D7 — Duplicate route mapping / dead renewal backends (already tracked).** `App.tsx:837,855` mount the same
`ContractRenewalDashboard` component at both `/contract-renewals` and `/contract-renewal-autopilot`.
Separately, the `contract-renewals`, `renewal-activities`, `renewal-playbooks` edge functions and
`server/routes-renewal-management.ts` (four real tables in `shared/renewal-management-schema.ts`) have zero
callers anywhere (`grep -rln "api/contract-renewals\|api/renewal-activities\|api/renewal-playbooks"
client/src` = empty), confirmed independently. **Covered by AUDIT-026** (open) — no new story needed; the
route-name collision (page path `/contract-renewals` vs. dead edge fn `contract-renewals`) is worth folding
into that story's cleanup since it is easy to mis-click while fixing it.

**D8 — Stage-vocabulary drift on proposal acceptance (new specific instance of COP-M07).**
Severity: Medium. See Section 2, "Gap — stage vocabulary drift." `getWonStageId`
(`proposals/index.ts:702-712`) reads legacy `deal_stages.is_won_stage`; the canonical config UI
(`pipeline-config/index.ts:581-613`) never mirrors edits back to `deal_stages`. **Covered by COP-M07**
(open) as a general problem statement; this is a concrete, previously-unlisted call site for it.

**D9 — Three separate "approval" data models in one scope, none aware of the others.** Severity: Low
(design smell, not a functional break by itself, but compounds D3). `approval_requests`
(Deal Desk, `deal-desk/index.ts`), the ad hoc pricing-approval object read by `PriceApprovals.tsx:81`
(`PATCH /api/pricing/approval/:id`), and the `body.approved` self-declared flag on
`PATCH /api/proposals/:id` (`:1905`) are three independent "is this discount okay" mechanisms. Not covered
by an open story as a unification task (PA/QUOTE stories cover pieces of quote math but not this).

---

## 4. Proposed stories

All 9 depend only on files/tables already verified above; none duplicate an open `prd.json` story (checked
by id and keyword per section 3).

1. **Fire `deal.stage_changed` from the actual stage-move endpoint** (Priority 1)
   Move the `dispatchWorkflowEventSafe('deal.stage_changed', ...)` call (or an equivalent) from the dead
   `PATCH /api/deals/:id` branch into `POST /api/pipeline-config/deals/:id/move` in
   `supabase/functions/pipeline-config/index.ts`, since that is the endpoint every real UI (`EnhancedPipelineBoard.tsx`,
   `DealDetail.tsx`) actually calls. Keep the existing dedupe-key shape (`stage:<dealId>:<toStageId>`).
   - AC1: `pipeline-config/index.ts`'s `/deals/:id/move` handler imports and calls `dispatchWorkflowEventSafe`.
   - AC2: a unit test (new or extending `server/tests/unit/workflow-conditions-parity.test.ts`'s sibling
     suite) asserts the event fires with `stageId` equal to the target stage on a move.
   - AC3: `grep -n "dispatchWorkflowEvent" supabase/functions/pipeline-config/index.ts` returns at least one hit.
   - AC4: the now-redundant dead branch in `supabase/functions/deals/index.ts:898-919` is either removed or
     documented as a secondary direct-API path, not the primary one.
   - dependsOn: []

2. **Make `CrmDealsPage`'s Mark Won/Mark Lost move the deal's stage, not just its status** (Priority 1)
   `CrmDealsPage.tsx`'s row/bulk "Mark Won"/"Mark Lost" actions should resolve the tenant's closed-won/lost
   stage id (via `/api/pipeline-config/board`) and call the same `/deals/:id/move` endpoint the Kanban board
   uses, instead of a bare `PATCH status`.
   - AC1: `CrmDealsPage.tsx`'s won/lost handlers call `apiRequest('/api/pipeline-config/deals/${id}/move', ...)`.
   - AC2: after marking won from the table view, the same deal appears in the Closed Won column when the
     board view is opened (manual/E2E check).
   - AC3: story 1 above ships first so this path also fires `deal.stage_changed`.
   - dependsOn: [1]

3. **Build a "Request Approval" entry point into Deal Desk from the Quote Builder** (Priority 1)
   When `QuoteBuilder.tsx`'s guardrail (`belowMinMargin`/`overMaxDiscount`) blocks sending and the current
   user is not a manager, show a "Request Approval" action that `POST`s to `/api/deal-desk/requests` with the
   proposal id, discount/margin figures, and routes to the applicable `deal-desk` approval chain.
   - AC1: `deal-desk/index.ts`'s existing `POST /requests` handler (`:343+`) gains a caller in
     `client/src/components/quote-builder/QuoteBuilder.tsx`.
   - AC2: `grep -rn "'/api/deal-desk/requests'" client/src/` shows a POST call, not just GET/decision.
   - AC3: `DealDeskDashboard.tsx` shows the newly created request without a manual refresh (query invalidation).
   - dependsOn: []

4. **Wire an approved Deal Desk request back to the quote so the original rep can send it** (Priority 1)
   On `deal-desk/index.ts`'s final-step approve (`newStatus='approved'`, `:513-517`), write a marker onto the
   related `proposals` row (e.g. `pricing_approval_id`/`pricing_approved_at`) and have
   `PATCH /proposals/:id {status:'sent'}` accept `approved:true` implicitly when such a marker exists for the
   current proposal, instead of only trusting the sender's own `isManager` flag.
   - AC1: `approval_requests` gains (or already has, if verified) a `related_proposal_id` column consulted by
     `proposals/index.ts`'s `sent` guardrail branch (`:1905`).
   - AC2: a rep whose quote was approved via Deal Desk can send it without needing a manager to click Send.
   - AC3: `server/tests/unit/` gains a test asserting an approved `approval_requests` row unblocks the sent-status guardrail for the ORIGINAL (non-manager) sender.
   - AC4: a manager sending their own under-margin quote is unaffected (regression guard).
   - dependsOn: [3]

5. **Capture financing type on the deal/proposal and act on it at acceptance** (Priority 2)
   Add an explicit "how is this being acquired" field (cash / lease / finance) surfaced in the Quote/Proposal
   builder, and make `createContractFromProposal`/`upsertDealForProposal` in `proposals/index.ts` branch on it:
   create a `leases` row (pre-filled with `proposalId`/`businessRecordId`/`customerId`/line-item totals) when
   the proposal is lease-type, instead of unconditionally creating a `contracts` row.
   - AC1: `proposals.proposalType` (or a new explicit field) is read by `createContractFromProposal`
     (`proposals/index.ts:822-850`).
   - AC2: accepting a lease-type proposal via `/p/:token` creates a `leases` row with `proposalId` set
     (verifiable by a new unit test against the accept handler).
   - AC3: `LeaseForm.tsx` gains the ability to open pre-filled from a deal/proposal (`?proposalId=`), for the
     manual-correction path.
   - AC4: accepting a non-lease proposal is unaffected (regression guard against D4's current contract-only behavior).
   - dependsOn: []

6. **Build a minimal sales-to-purchasing handoff screen over the real, already-registered
   `server/routes-sales-handoff.ts` tables** (Priority 2)
   Wire a page (e.g. under `/deal-desk` or a new `/handoffs` route) that lists `sales_handoff_checklists` /
   `handoff_tasks` for won deals, lets ops mark tasks complete, and creates an `implementation_projects` row —
   giving the target workflow's "handoff to Purchasing & Project Management" step an actual UI. Delete the
   phantom-table `supabase/functions/sales-handoffs/` edge function (queries `sales_handoffs`, which exists
   nowhere) since the real, callable backend already exists in Express.
   - AC1: a new page calls `GET /api/sales-handoffs`, `GET /api/handoff-tasks`,
     `POST /api/handoff-tasks/:id/complete` (all pre-existing in `server/routes-sales-handoff.ts`).
   - AC2: `supabase/functions/sales-handoffs/index.ts` is deleted or repointed at the real
     `shared/sales-handoff-schema.ts` tables (decide which per PROD-008-style triage).
   - AC3: `docs/unreferenced-edge-fns-baseline.json` drops the `sales-handoffs` entry once it has a caller
     (or the file is removed and the baseline is updated to remove it).
   - AC4: accepting a proposal (`proposals/index.ts`'s accept flow) creates a `sales_handoff_checklists` row
     for the new contract, closing the loop from closed-won into this new screen.
   - dependsOn: [5] (so the handoff record can reference whichever of contract/lease was actually created)

7. **Build the commission calculation engine, or remove the dead button** (Priority 2)
   Either implement `POST /commission/calculate` (`commission/index.ts:578-589`) against
   `commission_plans`/`commission_plan_tiers`/`deals`, writing `commission_calculations`, or remove the
   "Calculate" action from `CommissionManagement.tsx` and replace the empty-list state with an honest
   "not yet calculated" message plus a manual-entry path via the existing `commission_calculations` table.
   - AC1: `commission/index.ts`'s `/calculate` branch either performs a real insert into
     `commission_calculations` or the frontend button is removed/relabeled.
   - AC2: `CommissionManagement.tsx:252`'s mutation no longer surfaces a raw 501 to the user.
   - AC3: if implemented, a unit test asserts a won deal with a matched `commission_plans` tier produces a
     `commission_calculations` row with the correct rate (not the flat 5% in D5).
   - AC4: `commission/index.ts:228-256`'s `my-earnings` is fixed to use the same real calculation path (or
     removed, since it currently has zero callers) rather than left with an independent hardcoded 5%.
   - dependsOn: []

8. **Mirror canonical `pipeline_stages.is_closed_won` edits back onto legacy `deal_stages`, or stop reading `deal_stages` on the acceptance path** (Priority 2, concrete slice of open COP-M07)
   Either extend `pipeline-config/index.ts`'s `PUT /stages/:id` to also update the mirrored `deal_stages` row
   (reverse of `server/lib/pipeline-stage-mirror.ts`'s existing one-directional mirror), or change
   `getWonStageId`/`getProposalSentStageId` in `proposals/index.ts` to read canonical `pipeline_stages`
   (`is_closed_won`/`legacy_stage_id`) the same way `pipeline-config/index.ts:702-720`'s `/move` endpoint
   already does.
   - AC1: `proposals/index.ts`'s `getWonStageId` resolves the same stage id the Kanban board's
     `/move` endpoint would treat as closed-won for the same tenant, verified by a shared unit test fixture.
   - AC2: `npm run check:stage-resolution` (already exists per `CLAUDE.md`) passes after the change.
   - AC3: no `deals.stage_id` written by proposal acceptance is orphaned relative to `pipeline_stages`.
   - dependsOn: []

9. **Add server-side scope filtering to the ten sales-close edge functions (own/team/location/regional)**
   (Priority 1 — security)
   Add a shared helper (mirroring `server/middleware/hierarchical-query-builder.ts`'s intent, ported to Deno)
   that resolves the caller's effective scope (own/team/location/regional/company) from their role level and
   applies it as an `owner_id in (...)` / territory filter by default on `GET /` list endpoints for
   `deals`, `quotes` (`proposals`), `commission`, `contracts`, `leases` — the same permission names already
   gate the nav (`sales.opportunity.view_own` vs `view_team` vs `view_location`).
   - AC1: `supabase/functions/deals/index.ts`'s `GET /` applies an owner/team filter by default when the
     caller's highest matching permission is `view_own` or `view_team`, not just when the client explicitly
     passes `ownerId`.
   - AC2: a new unit/integration test asserts a level-1 `SALES_REP` JWT gets only their own deals from
     `GET /deals`, while a level-4 `SALES_MANAGER` gets their team's.
   - AC3: `npm run check:edge-rbac` (already exists per `CLAUDE.md`) is extended to flag any of these ten
     functions that still has zero role/scope enforcement.
   - AC4: `docs/rbac-landscape.md` is updated to move these ten functions out of the "no role/permission
     check" bucket once fixed.
   - dependsOn: []

---

### Notes on things checked but found to be already fine / already tracked

- E-signature send-is-a-stub: **PA-041** (open) — not re-proposed.
- `ESignatureIntegration.tsx` data-contract mismatch: fixed by **PA-036** (closed) — verified via
  `mapSignatureRequest` in the live file.
- Three pipeline boards in the sidebar simultaneously (Prospects/Deals/Sales Pipeline): **COP-E02** (open) —
  not re-proposed, cited in Section 2.
- Renewal-management duplicate data models: **AUDIT-026** (open) — not re-proposed; D7 folds the specific
  route-name collision into it as a note.
- General "no role check on most edge fns": already documented at the repo level in
  `docs/rbac-landscape.md`; story 9 above narrows it to a concrete, actionable slice for this scope only,
  rather than duplicating a repo-wide initiative.

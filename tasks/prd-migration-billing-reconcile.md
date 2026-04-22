# PRD: Reconcile Billing (Express + Edge Function overlap)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 2 · **Week:** 4

**Why:** Billing has 94 Express handlers across 2 files vs. 1 consolidated edge function. Biggest overlap in the codebase — highest reconciliation risk.

---

## 1. Scope

**Express side:**
- `server/routes/advanced-billing-routes.ts`
- `server/routes/automated-billing-routes.ts`
- `server/services/*billing*` (contract-renewal-service.ts, commission-service.ts, billing-engine-service.ts — scope TBD in audit)

**Edge side:**
- `supabase/functions/billing/index.ts`

**Target:** `supabase/functions/billing/` canonical. Complex business logic (meter aggregation, invoice generation, commission calculation, contract renewals) ported over.

---

## 2. Parity audit

Produce `docs/billing-parity.md` — all 94+ endpoints listed with current implementation.

| Method | Path | Express impl | Edge impl | Business logic complexity | Action |
|---|---|---|---|---|---|
| POST | `/billing/meter-reading` | ✓ | ? | High (aggregation) | port-to-edge |
| POST | `/billing/invoice/generate` | ✓ | ? | High (PDF + lines) | port-to-edge |
| ... | ... | ... | ... | ... | ... |

Pay special attention to:
- **Meter reading aggregation** — monthly billing run logic
- **Invoice generation** — line item assembly, tax calc, PDF (this may block on Puppeteer decision in Phase 6)
- **Commission calculations** — multi-rep splits, tiered rates
- **Contract renewal automation** — notifications, price escalations
- **Billing rules engine** — conditional pricing

---

## 3. Tables touched

Many. At minimum: `invoices`, `invoice_line_items`, `billing_rules`, `meter_readings`, `meter_anomalies`, `billing_schedules`, `invoice_generation_logs`, `credit_memos`, `billing_disputes`, `commissions`, `commission_splits`.

RLS file: `drizzle/rls/billing.sql` — will apply to 10+ tables.

---

## 4. Special considerations

### PDF generation blocker
Invoice PDFs currently use `pdfkit` (Node-only) or a similar. Options:
- Port to `pdf-lib` via esm.sh (pure JS, works in Deno). Limited styling but handles invoice layouts fine.
- External Browserless.io for HTML→PDF (more flexible, $).
- Decision lands in this PRD, not deferred.

### Automated billing cron
Monthly / daily billing jobs use `node-cron` in Express. These move to `pg_cron` per Phase 6 (US-026) — document the schedule in `drizzle/cron/billing.sql` but the migration itself waits for Phase 6.

### QuickBooks sync
`quickbooks-schema.ts` + `quickbooks-service.ts`. QuickBooks uses `node-quickbooks` npm which is Node-only. Options:
- Port to direct REST calls against QuickBooks Online API via fetch.
- Move QuickBooks sync to a dedicated scheduled job (runs once daily).

---

## 5. Acceptance criteria

- [ ] `docs/billing-parity.md` published
- [ ] All 94+ Express endpoints ported or reconciled
- [ ] RLS on all billing tables (`drizzle/rls/billing.sql`)
- [ ] PDF generation approach decided + working (document in PRD addendum)
- [ ] Invoice generation produces correct totals, line items, tax on sample data
- [ ] Meter reading aggregation produces the same monthly totals as Express did (regression test with historical data)
- [ ] Frontend pages that work:
  - `/billing` (Billing.tsx)
  - `/billing-analytics` (BillingAnalytics.tsx)
  - `/billing-rules` (BillingRules.tsx)
  - `/advanced-billing-engine` (AdvancedBillingEngine.tsx)
  - `/accounts-payable` (AccountsPayable.tsx)
  - `/accounts-receivable` (AccountsReceivable.tsx)
  - `/invoices` (Invoices.tsx)
- [ ] Express files deleted; routes-registry.ts entries removed
- [ ] Verify each page in browser via Playwright MCP

---

## 6. Rollback

Billing is mission-critical. Rollback plan:
1. Keep an off switch — feature flag `BILLING_USE_EDGE_FUNCTION` that routes frontend calls. Default true after migration.
2. If edge function regresses, flip flag, frontend falls back to… nothing (since Express is deleted). So really: **keep Express alive for billing until 2 billing cycles prove the edge function works**.
3. Exception to the master PRD's "no Express fallback" rule — billing is the one place where we keep Express temporarily alive via Coolify. Redeploy Express container specifically for `/api/billing/*` routes until the edge function has 2 clean monthly billing runs behind it.

---

## 7. Open questions

1. Does the existing `supabase/functions/billing/` use `_shared/` utilities? If not, refactor first.
2. What's the volume / latency tolerance for invoice generation? Does Deno edge runtime have enough memory / CPU budget for a 500-line invoice?
3. Are there scheduled billing jobs running today in production (node-cron)? If yes, document them — Phase 6 cron migration depends on knowing what's live.
4. QuickBooks sync frequency and criticality — a few hours of downtime acceptable during migration?

---

## 8. Test plan

- Unit: billing math helpers (tax calc, tiered rates) as `deno test` files.
- Integration: run a full monthly billing cycle against staging data; compare output to same cycle run through Express.
- E2E: Playwright flow to generate an invoice from a customer, approve, verify PDF renders.
- Production smoke: first monthly billing run post-migration — Dan watches it run.

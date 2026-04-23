# PRD: Migrate Leases to Edge Function

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 4 · **Week:** 10 (June 24 – June 30) · **Story:** US-017 part A

**Why:** Lease management has 28 Express endpoints covering the full lifecycle (origination → payments → renewals → dispositions). An edge-function counterpart (`supabase/functions/leases/`, 362 lines) already exists but lacks the payment schedule, renewal workflow, and disposition endpoints. This PRD reconciles the two and decides the PDF generation strategy flagged as an Open Question in the master PRD.

---

## 1. Scope

**Express source:**
- `server/routes/lease-routes.ts` (600 lines, **28 endpoints**)

**Edge side:**
- `supabase/functions/leases/index.ts` (362 lines) — partial coverage; merge target

**Services:**
- `server/services/document-generation-service.ts` — **uses `puppeteer` + `Handlebars`** for HTML→PDF (Node-only, will not run in Deno)
- `server/services/pdf-generation-service.ts` — **uses `pdfkit`** (Node-only)
- `server/services/service-report-pdf.ts` — field-service-scoped, not lease-scoped

**Target:** `supabase/functions/leases/` grown to cover all 28 endpoints + PDF generation via the Deno-compatible strategy chosen in §4.

**File layout:**
```
supabase/functions/leases/
├── index.ts                        # dispatcher (expanded)
├── handlers/
│   ├── leases.ts                   # 7 endpoints (CRUD + by-status + by-customer)
│   ├── payments.ts                 # 6 endpoints (list, upcoming, past-due, CRUD, process)
│   ├── renewals.ts                 # 6 endpoints (list, action-needed, CRUD, initiate)
│   ├── dispositions.ts             # 6 endpoints (CRUD + complete)
│   └── schedule.ts                 # POST /leases/:id/generate-payment-schedule
└── _pdf.ts                         # PDF generation (pdf-lib OR Browserless)
```

**Explicitly out of scope:**
- Automated lease renewal notifications (cron-driven) — move to `pg_cron` in Phase 6 US-026.
- QuickBooks integration for lease payments — if tied to billing, tracked in billing reconcile PRD.

---

## 2. Endpoint parity matrix

### Leases (7)
| Method | Path | Express line |
|---|---|---|
| GET    | `/leases` | 15 |
| GET    | `/leases/:id` | 30 |
| GET    | `/customers/:customerId/leases` | 49 |
| GET    | `/leases/status/:status` | 64 |
| POST   | `/leases` | 79 |
| PATCH  | `/leases/:id` | 101 |
| DELETE | `/leases/:id` | 125 |

### Payments (6)
| Method | Path | Express line |
|---|---|---|
| GET    | `/leases/:leaseId/payments` | 142 |
| GET    | `/lease-payments/upcoming` | 157 |
| GET    | `/lease-payments/past-due` | 173 |
| POST   | `/lease-payments` | 188 |
| PATCH  | `/lease-payments/:id` | 208 |
| DELETE | `/lease-payments/:id` | 227 |
| POST   | `/lease-payments/:id/process` | 479 |

### Renewals (6)
| Method | Path | Express line |
|---|---|---|
| GET    | `/lease-renewals` | 244 |
| GET    | `/leases/:leaseId/renewal` | 259 |
| GET    | `/lease-renewals/action-needed` | 274 |
| POST   | `/lease-renewals` | 290 |
| PATCH  | `/lease-renewals/:id` | 312 |
| DELETE | `/lease-renewals/:id` | 331 |
| POST   | `/leases/:id/initiate-renewal` | 515 |

### Dispositions (5)
| Method | Path | Express line |
|---|---|---|
| GET    | `/lease-dispositions` | 348 |
| GET    | `/leases/:leaseId/disposition` | 363 |
| POST   | `/lease-dispositions` | 378 |
| PATCH  | `/lease-dispositions/:id` | 400 |
| DELETE | `/lease-dispositions/:id` | 423 |
| POST   | `/leases/:id/complete-disposition` | 556 |

### Schedule generation (1)
| Method | Path | Express line |
|---|---|---|
| POST | `/leases/:id/generate-payment-schedule` | 440 |

**Total: 28 endpoints.** Verified against file content; matches the initial grep.

---

## 3. Tables + RLS plan

Expected tables (verify in `shared/schema.ts`):
- `leases`
- `lease_payments`
- `lease_renewals`
- `lease_dispositions`
- `lease_payment_schedules` (or embedded in `leases` as JSON — verify)

RLS file: `drizzle/rls/leases.sql` — standard 4-policy template on all 4-5 tables.

---

## 4. PDF generation strategy (decision)

**Problem:** both PDF services today use Node-only libraries (`puppeteer`, `pdfkit`). Neither runs in Deno.

**Options evaluated:**

| Option | Pros | Cons | Est. cost | Recommendation |
|---|---|---|---|---|
| **A. `pdf-lib` via esm.sh** | Free, runs in Deno, pure JS, small bundle | Limited styling (no HTML→PDF, no CSS), manual layout | $0 | **Choose for lease PDFs** — lease documents are tabular + signatures, manual layout works |
| **B. Browserless.io (hosted Chromium)** | HTML→PDF, full CSS support, handles anything | External service dependency, $50+/mo, adds 500-1500ms per render | $50/mo+ | Reject for leases; consider for future branded-marketing PDFs |
| **C. Google Cloud Run with Chromium sidecar** | Self-hosted, flexible | New infra surface area (violates master PRD FR-18) | Server cost | Reject — violates "no new infra" goal |
| **D. Keep Puppeteer alive in a separate Node container just for PDFs** | Minimal code change | Two runtimes forever, defeats the point of the migration | Container cost | Reject |

**Decision: Option A — `pdf-lib` via `https://esm.sh/pdf-lib@1.17.1`.**

Lease PDFs are structured documents (header, lessee/lessor info, terms table, payment schedule table, signature blocks). This fits `pdf-lib`'s drawing primitives. We accept slightly more verbose template code in exchange for zero external dependency and zero per-render cost.

**Port plan for `_pdf.ts`:**
1. Inspect the current Handlebars template in `document-generation-service.ts` → extract the fields used
2. Rewrite layout manually in `pdf-lib`:
   ```typescript
   import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
   export async function generateLeasePdf(lease: Lease, schedule: LeasePayment[]): Promise<Uint8Array> {
     const pdf = await PDFDocument.create();
     const page = pdf.addPage([612, 792]); // US Letter
     const font = await pdf.embedFont(StandardFonts.Helvetica);
     // Draw header, party info, terms, schedule table, sig blocks
     return pdf.save();
   }
   ```
3. Store generated PDFs in Supabase Storage (`lease-documents` bucket) with RLS on object-level metadata

**Fallback:** if a lease requires a design that exceeds `pdf-lib`'s practical limit (e.g., per-tenant branded templates in the future), revisit Browserless at that point.

---

## 5. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `pdfkit` | `pdf-generation-service.ts` | **Delete** — replace with `pdf-lib` |
| `puppeteer` + `handlebars` | `document-generation-service.ts` | **Delete** (from lease flow) — replace with `pdf-lib` |
| `IStorage` methods for leases | `server/storage.ts` | Reimplement as Drizzle calls |
| Supabase Storage for PDF blobs | new for leases | Use `@supabase/storage-js` via esm.sh; bucket `lease-documents` with RLS by `tenant_id/lease_id/` path prefix |

No other external deps — no SendGrid, no Claude, no websockets.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 28 endpoints return the same shape as Express for equivalent inputs
- [ ] `POST /leases/:id/generate-payment-schedule` produces the same payment rows as Express for the same lease terms (unit-tested fixtures)
- [ ] `POST /lease-payments/:id/process` updates payment status + records receipt
- [ ] `POST /leases/:id/initiate-renewal` creates a renewal record with correct terms carry-over
- [ ] `POST /leases/:id/complete-disposition` marks lease closed + writes disposition outcome
- [ ] PDF generation: `GET /leases/:id?format=pdf` (or equivalent endpoint — verify current API) returns a `pdf-lib`-generated PDF that visually matches the `pdfkit`/`puppeteer` output on fixture lease

### Security / RLS
- [ ] RLS on all lease tables
- [ ] Two-tenant test: lease in tenant A invisible to tenant B
- [ ] Supabase Storage bucket RLS: PDFs are scoped to tenant path prefix
- [ ] Signed URL for PDF download expires in 15 min (configurable)

### PDF generation
- [ ] Generated lease PDF renders correctly in Chrome, Acrobat, Preview
- [ ] Schedule table handles 36-month leases (long schedule) without overflow
- [ ] Signature blocks render with correct field positions for e-signature integration (US-019)
- [ ] PDF file size < 200KB for a typical lease (no embedded fonts unless needed)

### Frontend compatibility
- [ ] `Leases.tsx` list loads; filtering + search work
- [ ] `LeaseForm.tsx` create/edit flow succeeds
- [ ] `LeaseDetail.tsx` shows lease details + payment schedule + download PDF button
- [ ] Playwright MCP: complete lease origination flow, download PDF, verify file downloads + opens

### Deletion
- [ ] `server/routes/lease-routes.ts` deleted
- [ ] `server/services/pdf-generation-service.ts` deleted (if only used by leases — verify grep)
- [ ] Puppeteer code path in `document-generation-service.ts` removed (file may remain if other domains use it)
- [ ] `pdfkit` removed from `package.json` (if not used elsewhere)
- [ ] `puppeteer` removed from `package.json` (if not used elsewhere)
- [ ] Route registry entry removed

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds (smaller bundle without Puppeteer)

---

## 7. Test plan

### Unit (Deno)
- `_pdf.test.ts` — generate PDF, assert length > 0 + decode first page text extraction matches expected fields
- Payment schedule generator: fixture lease terms → verify row count + amounts

### Integration
- Local: full lease lifecycle — create → schedule → pay → renew → dispose — verify each state transition
- PDF fixture regression: generate PDF from 5 saved lease fixtures, diff against known-good outputs (visual or byte-level with tolerance for timestamp metadata)

### Visual QA
- Open generated PDFs side-by-side with Express-rendered equivalents; verify layout acceptable (not pixel-perfect required, but no field truncation / missing signatures)

### Production smoke
- Create a lease in prod, generate schedule, download PDF, verify legal language + signature block positions

---

## 8. Rollback

Standard: revert PR. Express lease file is already non-functional in prod. Existing partial edge function may regress if merge breaks it — mitigate by:

1. Deploy new canonical `leases/` as `leases-v2/` first; run parallel for 24h
2. Swap frontend calls to `leases-v2/` via config flag
3. After 24h stable, rename `leases-v2/` → `leases/` and redeploy

If PDF generation breaks post-sunset, `pdf-lib` in Deno is stateless — just roll back the `_pdf.ts` changes.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `pdf-lib` output differs enough from Puppeteer that customers complain about formatting | Medium | Medium | Beta with 1 tenant for 1 week before full rollout; document accepted differences |
| `pdf-lib` bundle size (~1-2MB via esm.sh) slows cold start | Low | Low | Measure — typical impact is 100-200ms acceptable for lease rendering |
| Payment schedule generator math drift (rounding, leap years, amortization) vs. Express version | Medium | High | Fixture-driven regression test on 20 real leases; diff cent-by-cent |
| Supabase Storage signed URL costs (egress) on PDF downloads | Low | Low | Cache PDFs in bucket, don't regenerate on every GET; invalidate on lease update |
| Puppeteer removal breaks another service we didn't grep for | Medium | Medium | `grep -r "puppeteer\|pdfkit" server/` before removing from package.json; keep packages if any other caller exists |

---

## 10. Open questions

1. **Is the current PDF generation endpoint actually reachable today in prod?** If Express is 404'ing, users may not have been getting PDFs at all. Ask Dan whether PDF download has a live user base — affects rollout urgency.
2. **Which service is the lease PDF path?** `document-generation-service.ts` (Puppeteer) or `pdf-generation-service.ts` (pdfkit)? Grep callers to be sure.
3. **Amortization method for payment schedules** — straight-line, declining balance, annuity? The current code should reveal — confirm before porting math.
4. **Signed PDF workflow** — is the lease PDF the document that goes through US-019's e-signature flow? If so, field positions for signature placeholders need to match the e-signer provider's expected coordinates.
5. **Lease disposition — what does "complete" do besides mark status?** Equipment return, buyout pricing, accounting write-off? All need to port cleanly.
6. **Per-tenant branded PDF templates** — is that a feature today or a future request? Affects whether `pdf-lib` is durable or needs Browserless eventually.

---

## 11. Definition of done

- [ ] All 28 lease endpoints live at `functions.printyx.net/leases/*`
- [ ] Lease PDF generation works via `pdf-lib`; output reviewed by stakeholder
- [ ] RLS on all lease tables + Supabase Storage bucket
- [ ] Express lease route + pdfkit code deleted
- [ ] `puppeteer` / `pdfkit` removed from package.json (if lease was their only consumer)
- [ ] Full lease lifecycle verified end-to-end in prod
- [ ] Type checks + build pass
- [ ] 72 hours stable before US-017 part B (manufacturer-orders) begins

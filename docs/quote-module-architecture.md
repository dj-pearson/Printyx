# Quote Module Architecture (canonical)

Status: **active** — established by stories QUOTE-001..010 (prd.json).
Last updated: 2026-06-09.

## 1. Decision: one canonical model

The quote flow standardizes on the **`proposals` / `proposal_line_items`** tables, served
by the **`supabase/functions/proposals/`** edge function and consumed by the UI through
`/api/proposals`. This is the only quote system the UI actually used, and the line-item
table already carries `unit_cost`, `unit_price`, `margin`, and `discount`.

The three-tier cost *concepts* (dealer cost → rep/selling price → customer price, plus
margin/discount thresholds) are **absorbed into this model**, rather than re-wiring the UI
onto the parallel `enhanced_quote_pricing` tables.

### Deprecated (do not build on; not yet deleted)

| Thing | Location | Why deprecated |
|---|---|---|
| `quotes` edge fn | `supabase/functions/quotes/index.ts` | Duplicate quote CRUD; UI never calls it |
| `quote-line-items` edge fn | `supabase/functions/quote-line-items/index.ts` | Duplicate line-item CRUD |
| `quotePricing` / `quotePricingLineItems` | `shared/schema.ts` (~6228) | Parallel quote-document tables, unused by UI |
| `enhancedQuotePricing` / `enhancedQuotePricingLineItems` | `shared/product-pricing-schema.ts` (~174/235) | Parallel quote-document tables, unused by UI |

### Retained from the "enhanced" set (still used)

| Thing | Location | Use |
|---|---|---|
| `company_pricing_settings` | `shared/product-pricing-schema.ts` (~44) | Per-tenant **pricing policy** (min margin, max discount, price floor, approval) — QUOTE-006 |

## 2. End-to-end data flow

```
business_records (customer)            product_models / product_accessories /
   │  id, company_name, address*,         professional-services / service-products /
   │  primary_contact_email               supplies / managed-services / software-products
   │                                         │  msrp (list), *_rep_price (selling),
   │                                         │  *_dealer_cost (hard cost)   ← source of cost
   ▼                                         ▼
proposals  ──────────────  proposal_line_items
   business_record_id          proposal_id, item_type, product_id,
   contact_id                  quantity,
   subtotal, discount_amount,  unit_cost  (dealer/hard cost  → margin source)
   tax_amount, total_amount,   unit_price (customer price)
   total_dealer_cost,          total_price, margin, discount, notes
   total_margin_percentage
```

- **Customer** comes from `business_records` (leads + customers share this table).
- **Products** come from the per-type product catalog edge functions. Each line item stores
  a *snapshot* of `unit_cost` (dealer/hard cost) and `unit_price` (customer price) at the
  time it is added, so later catalog price changes never rewrite historical quotes.
- **Cost/margin** is computed from the line-item snapshots and rolled up onto the proposal.

## 3. Field reference (the bits that were broken)

### Line items — UI ⇄ DB

The proposals edge function **normalizes** line items (camelCase **or** snake_case in →
snake_case columns out) and only writes real columns. Previously the UI sent camelCase keys
(`unitPrice`, `productName`) plus a non-existent `notes` column, which made the whole
line-item insert fail silently. Canonical columns:

`line_number, item_type, product_id, product_code, product_name, description, quantity,
unit_cost, unit_price, total_price, discount, margin, notes, is_recurring,
recurring_frequency, recurring_duration, lead_time, warranty_period, service_level,
is_optional, is_customizable, configuration_options, alternative_options`

### Product catalog price/cost columns (ACTUAL live columns)

| Type | List | Selling price | Hard cost |
|---|---|---|---|
| `product_models` | `msrp` | `new_rep_price`, `upgrade_rep_price`, `lexmark_rep_price` | `new_dealer_cost`, `upgrade_dealer_cost`, `lexmark_dealer_cost` *(added QUOTE-002)* |
| `product_accessories` | `*_suggested_retail` | `standard/new/upgrade_rep_price` | `standard/new/upgrade_dealer_cost` *(already present)* |

> The Drizzle declarations in `shared/schema.ts` for `product_models` use different names
> (`newRepCost`, `newSuggestedRetail`); the **live** table uses `new_rep_price` etc. The live
> columns above are authoritative for the quote flow.

### Margin formula (must match in UI and server)

Canonical definition lives in `shared/quote-math.ts` (unit-tested in
`server/tests/unit/quote-math.test.ts`):

```
lineMargin%  = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0
quoteMargin% = revenue > 0   ? ((revenue   - totalCost) / revenue)   * 100 : 0
               where revenue = subtotal − discount   (tax excluded — not revenue)
```

`PricingCalculator.tsx` imports `quoteMarginPct` directly. The proposals edge function
recompute and `_pdf.ts` (Deno — cannot import the Node module) replicate the same
arithmetic inline; the parity test in `quote-math.test.ts` locks them against drift.

## 5. Verification (QUOTE-010)

- Unit: `npm run test -- server/tests/unit/quote-math.test.ts` (margin parity).
- E2E: `npm run test:e2e:chromium -- tests/quote-flow.spec.ts` (wizard + gating).
- Manual checklist: see the bottom of `tests/quote-flow.spec.ts` — covers billing
  autofill, cost→margin, manager PDF vs cost-free customer PDF, the min-margin send
  gate, and email.

## 4. Manager quote

- `GET /proposals/:id/export/manager-pdf` renders cost + margin (role-gated: sales-only roles
  get 403). The customer PDF (`/export/pdf`) never includes cost/margin.
- UI surfaces a role-gated "Manager Quote" action (QUOTE-007) via `usePricingVisibility`.

## 6. Proposal templates & branding (PROP-001..004, in progress)

The proposal-presentation layer is being made first-class and reusable.

### Templates (`proposal_templates`)

- Canonical content lives in `template_content` jsonb: `{ sections: [...], globalStyling: {...} }`
  (migration 0015). Legacy per-section text columns are kept readable for back-compat.
- Served by the **proposals edge function** (`supabase/functions/proposals/index.ts`):
  `GET /proposal-templates` (`?templateType=`, `?includeInactive=`), `POST` (Zod-validated,
  normalizes camelCase), `POST /:id/clone`, `PUT`/`PATCH /:id`, `DELETE /:id` (soft delete via
  `is_active=false`). At most one default per `(tenant, template_type)` — enforced in the
  function and by a partial unique index.

### Branding (`company_branding_profiles`)

- Dedicated **`branding-profiles` edge function** (`supabase/functions/branding-profiles/`):
  `GET` (auto-seeds a default), `GET/:id`, `POST`, `PUT/PATCH/:id`, `DELETE/:id`,
  `POST /:id/set-default`, `POST /:id/logo` (multipart → Supabase Storage bucket
  `branding-assets` at `<tenant>/<profile>/logo-<uuid>.<ext>` → `logo_url`).
- Flat columns (primary_color, heading_font, logo_url, company_name, address, …) are the
  queryable source of truth the merge engine reads; the rich BrandManager extras (extended
  colors, full typography, page layout, gradients, logo variants, template presets) round-trip
  through the `settings` jsonb column (migration 0016).
- UI: `client/src/pages/BrandingSettings.tsx` (route `/proposals/branding`, sidebar "Proposal
  Branding") drives `BrandManager`; mapping in `client/src/lib/branding/profile-mapping.ts`.

> **Deploy note:** migrations 0014, 0015, 0016 are hand-written files NOT in the drizzle
> journal (same convention as 0010–0013) — apply them manually at deploy. Until applied,
> `template_content` / branding `settings` writes will error against the live DB.

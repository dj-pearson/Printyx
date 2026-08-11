# CRM Canonical Object Model (CRMX-002)

**Status:** Accepted decision · **Date:** 2026-07-14 · **Story:** CRMX-002
**Scope:** Decision record only — this document changes **no runtime behavior**. It is the
contract that the consolidation stories (CRMX-005, CRMX-006, CRMX-007) implement against.

## Why this exists

The CRM is mid-migration and currently runs **multiple parallel models for the same entity**:
three deal/pipeline models, four contact models, and two company models. Which model a screen
uses is accidental, so the same record can look different depending on the page. HubSpot's core
advantage is one clean object graph (Contact ↔ Company ↔ Deal ↔ Ticket). This doc picks **one
canonical table per entity** and marks the rest deprecated with a migration path.

Reference: the 3-agent CRM audit (see the CRMX roadmap stories `CRMX-001`..`CRMX-018` in
`prd.json`). File-reference counts below are from that audit (`grep -rl` across
`client/src`, `server/`, `shared/`).

---

## Canonical decisions

| Entity                     | ✅ Canonical                                                                                       | ⛔ Deprecated (fold/migrate)                             | Implemented by |
| -------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------- |
| Account / Lead / Customer  | **`business_records`** (`shared/schema.ts:1257`, aliased `leads`/`customers`)                      | — (already unified)                                      | done           |
| Contact                    | **`companyContacts`** (`shared/schema.ts:1205`)                                                    | `enhancedContacts`, `customerContacts`, `leadContacts`   | CRMX-007       |
| Company / Account org      | **`business_records`** as the account of record                                                    | standalone `companies` table                             | CRMX-007       |
| Deal / Pipeline            | **`deals`** + **`pipelineStages`/`pipelineTemplates`** (`shared/pipeline-configuration-schema.ts`) | `opportunities`, legacy `dealStages`                     | CRMX-005       |
| Notes / Tasks / Activities | **`businessRecordActivities`** + a polymorphic association layer                                   | `dealActivities` (fold), ad-hoc `tasks.customerId` links | CRMX-006       |

### 1. Account / Lead / Customer → `business_records`

Already the unified model (97 files) and the intended design: `recordType` ∈
`{lead, customer, former_customer}` plus `status` drives lifecycle, and lead→customer conversion
is a status update that preserves history. **No change needed.** All new work binds here.

### 2. Contact → `companyContacts`

- **Canonical: `companyContacts`.** It is what the live CRM UI writes/reads via
  `/api/company-contacts` (`CrmContactsPage.tsx`, `Contacts.tsx`) and it carries the richer
  CRM shape (salutation, `reportsTo`, `contactRoles`, `isPrimaryContact`, `leadStatus`, mailing +
  other addresses).
- **`enhancedContacts`** (10 files) is a **Salesforce-mirror / sync-staging** model used only by
  backend services (`routes-salesforce-integration.ts`, dedup, GDPR export, CSV import,
  `storage.ts`). Decision: it is **not** a CRM-user-facing contact table. Fold its genuinely useful
  fields (`isDecisionMaker`, `contactLevel`, `contactRole`, `leadSource`) into `companyContacts`,
  then repoint the sync services and retire it as a distinct contact of record.
- **`customerContacts`** and **`leadContacts`** (2 files each) are thin legacy clones — migrate any
  rows into `companyContacts` and drop.

### 3. Company / Account org → `business_records`

- `business_records` already **is** the account (it has `parentAccountId` and every CRM screen
  treats it as the company). It is the account of record.
- The standalone **`companies`** table (58 files, incl. the Supabase `supabase-companies` reads in
  `Contacts.tsx`) is the widest-blast-radius duplicate and holds a few fields not on
  `business_records` (`parentBusiness`, `numberOfLocations`, SIC code). **Phased** migration
  (CRMX-007): first fold those columns onto `business_records`, repoint reads, keep `companies`
  read-only for one release, then drop. This is the **highest-risk** consolidation — do it behind a
  backup + row-count validation.

### 4. Deal / Pipeline → `deals` + `pipelineStages`/`pipelineTemplates`

- **Canonical deal record: `deals`** (`shared/schema.ts:2416`) — this is what the kanban
  (`DealsManagement.tsx`, `@dnd-kit`) already renders.
- **Canonical stage config: `pipelineStages` + `pipelineTemplates`**
  (`shared/pipeline-configuration-schema.ts`) — the richer layer with SLAs, forecast weighting,
  and `on_enter/on_exit/on_sla_breach` automation triggers. **Today the kanban binds to the legacy
  `dealStages`, so this config never runs** — CRMX-005 rebinds `deals.stageId` onto `pipelineStages`
  and back-fills/aliases `dealStages`.
- **`opportunities`** (Salesforce-mirror) is deprecated for net-new work; the existing
  `/api/opportunities/convert-to-deal` path is the bridge. Keep it only as an SF-sync staging object,
  not a second pipeline.

### 5. Notes / Tasks / Activities → `businessRecordActivities` + associations

- `businessRecordActivities` is the canonical typed activity/timeline model. CRMX-006 adds a
  **polymorphic association layer** (attach a note/task/activity to any contact/company/deal/lead)
  and promotes **Notes** to first-class. Fold `dealActivities` into the unified timeline; keep
  `tasks.customerId`/`projectId` for back-compat while adding polymorphic associations.

---

## Migration principles (for CRMX-005/006/007)

1. **One source of truth per screen** — after each cutover, no page may read a deprecated table.
2. **Reversible migrations** — back up, migrate, validate row counts + spot-check associations,
   keep the old table read-only for one release, then drop in a follow-up.
3. **Fold, don't fake** — move real columns onto the canonical table; delete fields with no backing
   rather than inventing them (see CRMX-001 and the phantom-shape lessons in `CLAUDE.md`).
4. **Integration-staging tables are allowed** — `enhancedContacts`/`opportunities` may survive as
   internal Salesforce-sync staging, but they are **not** CRM objects of record and get no user-facing UI.

## Out of scope here

No code changes beyond `@deprecated` banners on the deprecated Drizzle tables/route files pointing
to this document. The actual data migration and repointing happen in CRMX-005/006/007.

---

## Addendum — COP-B00: the runtime contradicts this doc, and why the doc still wins

**Added 2026-08-11.** A later session found that the deployed runtime does the opposite of what
this document says, and initially read that as "production already migrated the other way, so the
canonical decision is unsettled." The dates say otherwise. Recording the evidence so nobody has to
re-derive it.

### What the runtime actually does

`supabase/functions/business-records/index.ts` — which serves `/api/business-records` in production
via `edge-function-proxy.ts` — lists **FROM `companies`**, inserts **INTO `companies`**, maps rows
through `mapCompanyToBusinessRecord()`, and its own comment on the by-id branch reads
_"Fallback: try business_records table for unmigrated records."_

Express (`server/routes-business-records.ts`) meanwhile queries the real `businessRecords` table.
So the same page reads a **different table in dev than in prod**.

### Why this is legacy rather than a competing decision

| Date           | Artefact                                                                                                               | Direction                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2026-06-26     | `scripts/migrate-business-records-to-companies.ts`, and `mapCompanyToBusinessRecord()` introduced in the edge function | `business_records` → **`companies`** |
| **2026-07-14** | **CRMX-002 — this document, plus the `@deprecated` banner on `companies`**                                             | **`companies` → `business_records`** |

The edge function's binding **predates this decision by roughly three weeks**. The team reversed
course in July; the edge function was never updated, and CRMX-007 (the implementation) has never
been started.

### What that settles, and what it does not

**Settled — do not re-open:** `business_records` is the canonical account table. This document is
the most recent authority and the evidence against it is older than it is.

**Still open — needs database access, not a decision:**

1. Repoint the `business-records` edge function at `business_records`, retiring
   `mapCompanyToBusinessRecord()`. Until then dev and prod disagree, which is what actually blocks
   COP-M01 (the navigation repoint) — reps would see different data by environment.
2. Migrate the rows. Count `companies` vs `business_records` per tenant, find rows present in only
   one, and check whether any id appears in both. That is CRMX-007 / COP-E06.
3. Order matters: repointing the edge function **before** migrating rows would hide records that
   currently live only in `companies`.

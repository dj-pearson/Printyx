# Document surfaces: which table is which (AUDIT-037)

Four prefixes in this repo have "document" in the name and three different
tables behind them. They were built at different times and nothing recorded
which was which, so a page ended up reading a purchase agreement as if it were
a file in a library. This is the map.

## `documents` -- purchase agreements and service contracts

`shared/schema.ts:2700`. One row is a signed deal: `agreement_number`,
`buyer_name`, `ship_to_address`, `po_number`, `line_items` (jsonb),
`black_rate`, `colour_rate`, `monthly_base`, `payment_terms`,
`warranty_terms`. `customer_id`, `document_number`, `document_type`,
`created_by` and `updated_by` are all NOT NULL.

Served by `supabase/functions/documents/` (`/`, `/:id`, `/:id/pdf`) for
`DocumentBuilder.tsx`, ported under PROD-013. `/api/documents` is in
`crmProxies`, so that function answers on both hosts.

It is **not** a file store. It has no `name`, `file_path`, `file_size`,
`mime_type`, `folder`, `tags`, `version` or `uploaded_by`.

## `document_uploads` + `document_templates` -- the real file model

`shared/document-automation-schema.ts`. `document_uploads` holds actual file
metadata (`file_name`, `file_type`, `file_size`, `file_path`), OCR text and
confidence, AI-extracted fields, a review/approval trail and an archive flag.
`document_templates` and `generated_documents` cover generation;
`document_workflow_actions` covers the automation steps.

Real tables, real Drizzle inserts, and **nothing reaches them**. Half of
`server/routes-document-automation.ts` sits under `/api/documents`, which the
proxy claims first, and the other half (`/api/document-templates`,
`/api/document-field-mappings`) has no caller in any client tree. That is
PROD-008d: connecting it means building a UI, retiring it means dropping
tables, and neither is cleanup. The router's own header says so.

**If someone builds a document library, this is what it goes on.**

## `/api/document-management` -- deleted (AUDIT-037)

`DocumentManagement.tsx` was routed at `/document-management`, listed in the
sidebar and the mobile drawer, and gated at level 3 in
`navigation-permissions.ts`. It called four paths and none of them worked on
either host:

- In **production** all four 404'd. `supabase/functions/document-management/`
  read `parts[0]` as a document id, so `/library` was a lookup for a document
  whose id is the string `library`; `/workflows`, `/search` and `/upload` had
  no branch at all. This is SUPA-024's recorded hazard, and
  `docs/edge-path-coverage-baseline.json` had already listed the three
  segments as gaps without anyone connecting the entry to the page.
- In **dev** two fixtures in `server/routes-sample-data.ts` answered `/library`
  and `/workflows` with 2,847 documents, 12 categories, 4.2 GB of 50 GB used,
  23 pending approval and a **96.5% compliance score**. `/search` and
  `/upload` had no live handler either: `server/routes-document-management.ts`
  implemented them over real Drizzle queries but was registered nowhere.

The edge function also read twelve columns off `documents` that do not exist
on it (`name`, `description`, `file_path`, `file_size`, `file_type`,
`mime_type`, `folder`, `entity_type`, `entity_id`, `tags`, `version`,
`uploaded_by`) and queried `document_folders`, a table declared in no schema
and created by no migration. Its POST omitted five NOT NULL columns, so every
create was a 23502 even before the column names were considered.

Repairing it was never a rebind: the page's own `Document` interface wanted
per-document `permissions.{view,edit,approve}`, a `workflow` with a current
stage and an assignee, a `checksumMD5`, a retention policy and a compliance
status, none of which any table in this repo stores. Making the calls succeed
would have meant inventing the twelve columns and then inventing the rest, so
the page, the edge function, the unregistered router and the two fixtures were
all deleted -- the rule LEGAL-010 and PROD-010 already set. A compliance score
with nothing behind it is the specific thing those stories exist to remove.

`server/tests/unit/document-surfaces.test.ts` locks the removal.

## `compliance_documents`

`shared/equipment-schema.ts:138`. Equipment compliance paperwork, unrelated to
the three above. Named here only so the next search for "document" does not
have to work out what it is.
